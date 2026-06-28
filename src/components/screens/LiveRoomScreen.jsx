import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Lock, UserCheck, Globe, ArrowLeft,
  Copy, Check, X, Plane, Crown, LogOut, Send,
  Play, Square, Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api, openSessionSocket } from '../../services/api';
import { pickLiveRoute, lookupAirport } from '../../data/liveRoutes';

const MONO = "'JetBrains Mono', 'Courier New', monospace";

// ─── Route tier labels ────────────────────────────────────────────────────────
function routeTier(min) {
  if (min <= 25)  return { label: 'SHORT', color: '#22c55e' };
  if (min <= 55)  return { label: 'MED',   color: '#00b4d8' };
  if (min <= 95)  return { label: 'LONG',  color: '#E8A030' };
  return                { label: 'ULTRA', color: '#8b5cf6' };
}

// ─── Route picker list (replaces Leaflet map — no lifecycle issues) ───────────
function RouteList({ routes, selected, onSelect, T }) {
  const selKey = selected ? `${selected.from.code}-${selected.to.code}` : null;
  return (
    <div style={{
      maxHeight: 260, overflowY: 'auto',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: 5,
    }}>
      {routes.map(r => {
        const key  = `${r.from.code}-${r.to.code}`;
        const isSel = key === selKey;
        const tier  = routeTier(r.minutes);
        return (
          <button
            key={key}
            onClick={() => onSelect(r)}
            style={{
              background: isSel
                ? (T.isDark ? `${tier.color}18` : `${tier.color}12`)
                : (T.isDark ? '#040e18' : T.surface),
              border: `1px solid ${isSel ? tier.color + '60' : T.border}`,
              borderRadius: 7, padding: '8px 10px',
              cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: isSel ? tier.color : T.textBright, letterSpacing: 0.5 }}>
                {r.from.code}<span style={{ color: T.textMuted, fontWeight: 400, margin: '0 3px', fontSize: 10 }}>→</span>{r.to.code}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: tier.color,
                background: `${tier.color}18`, borderRadius: 3, padding: '1px 5px', letterSpacing: 1 }}>
                {tier.label}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: T.textMuted, letterSpacing: 0.3 }}>
                {r.from.city.slice(0, 7).toUpperCase()}→{r.to.city.slice(0, 7).toUpperCase()}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: isSel ? tier.color : T.textMuted }}>
                {r.minutes}M
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function makeBar(pct, width = 16) {
  const filled = Math.round(pct * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function makeT(isDark) {
  if (!isDark) return {
    bg: '#e8f4f8', surface: '#f4faff', display: '#ddeef5',
    header: 'rgba(232,244,248,0.98)',
    border: '#a8ccd8', border2: '#c4dce8',
    text: '#1a3a4c', textBright: '#061828', textMuted: '#3a6070', textDim: '#6090a8',
    cyan: '#007898', green: '#128840', amber: '#a06000',
    isDark: false,
  };
  return {
    bg: '#030e18', surface: '#061828', display: '#041020',
    header: 'rgba(3,14,24,0.98)',
    border: '#0c2238', border2: '#071a2c',
    text: '#4a8098', textBright: '#c0dcec', textMuted: '#1e4060', textDim: '#0c1e2c',
    cyan: '#00b4d8', green: '#22c55e', amber: '#E8A030',
    isDark: true,
  };
}

// ─── CDU data row ─────────────────────────────────────────────────────────────
function CduRow({ label, value, valueColor, T, dimLabel, mono = true, small }) {
  const lColor = dimLabel ? T.textMuted : T.text;
  const vColor = valueColor || T.textBright;
  const fs = small ? 10 : 11;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, padding: '3px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: fs - 1, color: lColor, letterSpacing: 0.3, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', fontFamily: MONO, fontSize: 9, color: T.textDim, letterSpacing: 0.5 }}>
        {'·'.repeat(60)}
      </span>
      <span style={{ fontFamily: mono ? MONO : 'inherit', fontSize: fs, color: vColor, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

// ─── CDU divider ──────────────────────────────────────────────────────────────
function CduLine({ T, color }) {
  return (
    <div style={{ height: 1, background: color || T.border, margin: '6px 0' }} />
  );
}

// ─── Crew bottom sheet ────────────────────────────────────────────────────────
function CrewSheet({ participants, hostUID, userId, onClose, T }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2,8,14,0.88)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '55vh',
          background: T.isDark ? '#040e18' : T.surface,
          borderRadius: '16px 16px 0 0', border: `1px solid ${T.border}`,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom,20px))',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: T.cyan, letterSpacing: 3, fontWeight: 700, flex: 1 }}>
            CDU  CREW MANIFEST  /{participants.length} ABOARD
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 0' }}>
          {participants.map((p, i) => {
            const isHostP = p.user_id === hostUID;
            const isMe    = p.user_id === userId;
            return (
              <div key={p.user_id || p.id} style={{
                display: 'flex', alignItems: 'center', padding: '9px 14px',
                borderBottom: i < participants.length - 1 ? `1px solid ${T.border2}` : 'none',
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 10, color: isHostP ? T.amber : isMe ? T.cyan : T.textMuted,
                  letterSpacing: 0.5, width: 54, flexShrink: 0,
                }}>
                  {isHostP ? 'CAPT' : isMe ? 'YOU' : 'PAX'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: T.textBright, letterSpacing: 0.5 }}>
                  {p.display_name.toUpperCase()}
                </span>
                {isHostP && <Crown size={11} style={{ color: T.amber, marginLeft: 8 }} />}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── FMC Mission panel (active focus) ─────────────────────────────────────────
function MissionPanel({ focusState, isHost, onJoin, onEndFocus, myFocusElapsed, T }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!focusState.active) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [focusState.active]);

  const { duration, startedAt, originCode, destCode, fromCity, toCity } = focusState;
  const elapsed   = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const remaining = Math.max(0, duration * 60 - elapsed);
  const pct       = Math.min(1, elapsed / (duration * 60));
  const isExpired = remaining <= 0;
  const hasRoute  = originCode && destCode;

  return (
    <div style={{
      margin: '0 12px 8px',
      background: T.isDark ? '#041628' : T.display,
      border: `1px solid ${isExpired ? T.amber + '40' : T.cyan + '30'}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* CDU page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px 6px',
        background: T.isDark ? '#030d1e' : T.display,
        borderBottom: `1px solid ${T.border2}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: isExpired ? T.amber : T.cyan, letterSpacing: 3, fontWeight: 700 }}>
          {isExpired ? 'MISSION COMPLETE' : 'ACT MISSION'}
        </span>
        {hasRoute && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: T.textBright, letterSpacing: 1 }}>
            {originCode}/{destCode}
          </span>
        )}
      </div>

      <div style={{ padding: '10px 12px' }}>
        {/* Big timer */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{
            fontFamily: MONO, fontSize: isExpired ? 32 : 44, fontWeight: 900,
            color: isExpired ? T.amber : T.cyan,
            letterSpacing: -1, lineHeight: 1,
          }}>
            {isExpired ? 'DONE' : formatTime(remaining)}
          </div>
          {!isExpired && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, marginTop: 5, letterSpacing: 2 }}>
              TIME REMAINING
            </div>
          )}
        </div>

        {/* Progress bar row */}
        {!isExpired && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: T.textMuted, letterSpacing: 2 }}>PROGRESS</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: T.cyan }}>{Math.round(pct * 100)}%</span>
            </div>
            <div style={{ height: 3, background: T.border2, borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: `linear-gradient(90deg, ${T.cyan}, #48cae4)`, borderRadius: 2, width: `${pct * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* CDU data rows */}
        {!isExpired && hasRoute && (
          <>
            <CduLine T={T} />
            <CduRow label="ROUTE" value={`${fromCity?.toUpperCase()} → ${toCity?.toUpperCase()}`} valueColor={T.textBright} T={T} small />
          </>
        )}
        {!isExpired && (
          <CduRow label="DURATION" value={`${duration}MIN`} valueColor={T.textBright} T={T} small />
        )}

        {/* Action buttons — CDU LSK style */}
        {!isExpired && (
          <>
            <CduLine T={T} />
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {myFocusElapsed != null ? (
                <>
                  <div style={{
                    flex: 1, padding: '7px 10px',
                    background: T.isDark ? '#061e30' : T.surface,
                    border: `1px solid ${T.cyan}30`,
                    borderRadius: 7,
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: T.textMuted, letterSpacing: 1, marginBottom: 2 }}>YOUR FLT TIME</div>
                    <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 900, color: T.cyan, letterSpacing: -0.5 }}>
                      {formatTime(myFocusElapsed)}
                    </div>
                  </div>
                  <button
                    onClick={onEndFocus}
                    style={{
                      padding: '7px 12px', borderRadius: 7, border: `1px solid rgba(239,68,68,0.25)`,
                      background: 'rgba(239,68,68,0.07)', cursor: 'pointer',
                      color: '#ef4444', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    }}
                  >
                    LAND &gt;
                  </button>
                </>
              ) : (
                <button
                  onClick={onJoin}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 7, border: 'none',
                    background: `linear-gradient(135deg, ${T.cyan}, #0096c7)`,
                    color: '#fff', cursor: 'pointer',
                    fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1,
                  }}
                >
                  &lt; JOIN MISSION
                </button>
              )}
              {isHost && (
                <button
                  onClick={onEndFocus}
                  style={{
                    padding: '7px 12px', borderRadius: 7, border: `1px solid rgba(239,68,68,0.25)`,
                    background: 'rgba(239,68,68,0.07)', cursor: 'pointer',
                    color: '#ef4444', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                  }}
                >
                  END&gt;
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FMC Preflight panel (host, no focus) ─────────────────────────────────────
function PreflightPanel({ onStart, T }) {
  const [tab, setTab]           = useState('preset');
  const [dur, setDur]           = useState(25);
  const [sel, setSel]           = useState(null);
  const [routes, setRoutes]     = useState([]);
  const [loadingR, setLoadingR] = useState(false);

  useEffect(() => {
    if (tab !== 'route' || routes.length > 0) return;
    setLoadingR(true);
    api.getRoutes()
      .then(d => setRoutes(d.routes || []))
      .catch(() => setRoutes([]))
      .finally(() => setLoadingR(false));
  }, [tab]);

  const canStart  = tab === 'preset' || sel != null;
  const activeDur = tab === 'preset' ? dur : sel?.minutes;

  const handleLaunch = () => {
    if (!canStart) return;
    if (tab === 'preset') {
      onStart(dur, null);
    } else if (sel) {
      onStart(sel.minutes, {
        from: sel.from.code, to: sel.to.code,
        fromCity: sel.from.city, toCity: sel.to.city,
      });
    }
  };

  return (
    <div style={{
      margin: '0 12px 8px',
      background: T.isDark ? '#04121e' : T.display,
      border: `1px solid ${T.border}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '7px 12px 6px',
        background: T.isDark ? '#030d1e' : T.display,
        borderBottom: `1px solid ${T.border2}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#8b5cf6', letterSpacing: 3, fontWeight: 700 }}>
          PREFLIGHT  ·  SELECT MISSION
        </span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        {/* Tab row */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 10,
          border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden',
        }}>
          {[['preset', 'PRESET'], ['route', 'ROUTE MAP ✈']].map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: '6px', border: 'none', cursor: 'pointer',
                background: tab === id ? '#8b5cf620' : 'transparent',
                color: tab === id ? '#8b5cf6' : T.textMuted,
                fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                borderRight: id === 'preset' ? `1px solid ${T.border}` : 'none',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        {tab === 'preset' && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {[15, 25, 50, 90].map(d => (
              <button
                key={d}
                onClick={() => setDur(d)}
                style={{
                  flex: 1, padding: '7px 0',
                  border: `1px solid ${dur === d ? '#8b5cf6' : T.border}`,
                  borderRadius: 6,
                  background: dur === d ? '#8b5cf618' : 'transparent',
                  color: dur === d ? '#8b5cf6' : T.textMuted,
                  fontFamily: MONO, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                }}
              >
                {d}<span style={{ fontSize: 8 }}>M</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'route' && (
          <div style={{ marginBottom: 8 }}>
            {loadingR ? (
              <div style={{
                height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: T.isDark ? '#020c16' : T.display, borderRadius: 6, marginBottom: 8,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, letterSpacing: 2 }}>
                  LOADING ROUTES…
                </span>
              </div>
            ) : (
              <RouteList routes={routes} selected={sel} onSelect={setSel} T={T} />
            )}
          </div>
        )}

        <button
          onClick={handleLaunch}
          disabled={!canStart}
          style={{
            width: '100%', padding: '11px', borderRadius: 7, border: 'none',
            background: canStart ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : T.textDim,
            color: '#fff', cursor: canStart ? 'pointer' : 'not-allowed',
            fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            opacity: canStart ? 1 : 0.45,
          }}
        >
          {!canStart
            ? '< TAP A ROUTE TO SELECT >'
            : tab === 'route' && sel
              ? `< LAUNCH  ${sel.from.code}→${sel.to.code}  ${activeDur}M >`
              : `< LAUNCH MISSION  ${activeDur}M >`}
        </button>
      </div>
    </div>
  );
}

// ─── Chat log entry ───────────────────────────────────────────────────────────
function LogEntry({ msg, isOwn, T }) {
  // System events
  if (msg.type === 'join') {
    return (
      <div style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, padding: '2px 0', letterSpacing: 0.5 }}>
        ▶ {msg.display_name?.toUpperCase()} JOINED
      </div>
    );
  }
  if (msg.type === 'leave') {
    return (
      <div style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, padding: '2px 0', letterSpacing: 0.5 }}>
        ◀ {msg.display_name?.toUpperCase()} DEPARTED
      </div>
    );
  }
  if (msg.type === 'system') {
    return (
      <div style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, padding: '2px 0', fontStyle: 'italic' }}>
        {msg.content}
      </div>
    );
  }
  if (msg.type === 'focus_started') {
    const routePart = msg.origin_code ? `  ${msg.origin_code}→${msg.dest_code}` : '';
    return (
      <div style={{
        fontFamily: MONO, fontSize: 9, padding: '4px 8px', margin: '4px 0',
        background: T.isDark ? `${T.cyan}0c` : `${T.cyan}10`,
        border: `1px solid ${T.cyan}25`,
        borderRadius: 5, color: T.cyan, letterSpacing: 0.5,
      }}>
        ⚡ MISSION INIT  {msg.duration}M{routePart}
      </div>
    );
  }
  if (msg.type === 'focus_ended') {
    return (
      <div style={{
        fontFamily: MONO, fontSize: 9, padding: '4px 8px', margin: '4px 0',
        background: T.isDark ? `${T.amber}0c` : `${T.amber}10`,
        border: `1px solid ${T.amber}25`,
        borderRadius: 5, color: T.amber, letterSpacing: 0.5,
      }}>
        ✓ MISSION COMPLETE
      </div>
    );
  }
  if (msg.type === 'session_ended') {
    return (
      <div style={{
        fontFamily: MONO, fontSize: 9, padding: '4px 8px', margin: '4px 0',
        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 5, color: '#ef4444', letterSpacing: 0.5,
      }}>
        ✈ SESSION CLOSED  RETURNING TO LOUNGE
      </div>
    );
  }

  // Regular chat
  return (
    <div style={{ padding: '2px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: isOwn ? T.cyan : T.textMuted, letterSpacing: 0.5 }}>
        {isOwn ? '▶' : ' '}{(msg.display_name || '').toUpperCase().padEnd(12)}
      </span>
      <span style={{ fontSize: 13, color: isOwn ? T.textBright : T.text, lineHeight: 1.45, wordBreak: 'break-word' }}>
        {msg.content}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LiveRoomScreen() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const code   = state.liveCode;
  const isDark = state.theme !== 'light';
  const T      = makeT(isDark);

  const [session, setSession]           = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [chatInput, setChatInput]       = useState('');
  const [copied, setCopied]             = useState(false);
  const [wsStatus, setWsStatus]         = useState('connecting');
  const [showCrew, setShowCrew]         = useState(false);

  const [focusState, setFocusState] = useState({
    active: false, duration: 25, startedAt: null,
    originCode: null, destCode: null, fromCity: null, toCity: null,
  });
  const [myFocusElapsed, setMyFocusElapsed] = useState(null);

  const wsRef           = useRef(null);
  const chatBottomRef   = useRef(null);
  const myTimerRef      = useRef(null);
  const autoEndFiredRef = useRef(false);

  const myId   = user?.id ?? 0;
  const isHost = !!myId && session?.host_user_id === myId;

  useEffect(() => {
    if (!code) return;
    api.getLiveSession(code)
      .then(({ session: s, participants: p, messages: m }) => {
        setSession(s);
        setParticipants(p || []);
        const history = (m || []).map(cm => ({ type: 'chat', ...cm }));
        setMessages(prev => {
          const histIds = new Set(history.map(h => h.id).filter(Boolean));
          const wsExtra = prev.filter(msg => !msg.id || !histIds.has(msg.id));
          return [...history, ...wsExtra];
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [code]);

  // Auto-end
  useEffect(() => {
    if (!focusState.active || !focusState.startedAt) { autoEndFiredRef.current = false; return; }
    if (autoEndFiredRef.current) return;
    const elapsed   = Math.floor((Date.now() - focusState.startedAt) / 1000);
    const remaining = Math.max(0, focusState.duration * 60 - elapsed);
    const fireEnd   = () => {
      if (autoEndFiredRef.current) return;
      autoEndFiredRef.current = true;
      setMessages(prev => [...prev, { type: 'session_ended', id: null }]);
      if (isHost) {
        wsRef.current?.send(JSON.stringify({ type: 'end_focus' }));
        api.endLiveSession(code).catch(console.warn);
      }
      setTimeout(() => {
        wsRef.current?.close();
        dispatch({ type: 'SET_LIVE_CODE', payload: null });
        dispatch({ type: 'SET_SCREEN', payload: 'live-sessions' });
      }, 3000);
    };
    if (remaining <= 0) { fireEnd(); return; }
    const t = setTimeout(fireEnd, remaining * 1000);
    return () => clearTimeout(t);
  }, [focusState.active, focusState.startedAt, focusState.duration, isHost, code, dispatch]);

  // WebSocket
  useEffect(() => {
    if (!code || !user) return;
    const ws = openSessionSocket(code, (msg) => {
      switch (msg.type) {
        case 'chat':
          setMessages(prev => {
            if (msg.id && prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          break;
        case 'join':
          setParticipants(prev =>
            prev.find(p => p.user_id === msg.user_id) ? prev
              : [...prev, { user_id: msg.user_id, display_name: msg.display_name }]
          );
          setMessages(prev => [...prev, msg]);
          break;
        case 'leave':
          setParticipants(prev => prev.filter(p => p.user_id !== msg.user_id));
          setMessages(prev => [...prev, msg]);
          break;
        case 'focus_started':
          setFocusState({
            active: true, duration: msg.duration, startedAt: Date.now(),
            originCode: msg.origin_code || null, destCode: msg.dest_code || null,
            fromCity: msg.from_city || null, toCity: msg.to_city || null,
          });
          setMessages(prev => [...prev, msg]);
          break;
        case 'focus_state':
          setFocusState({
            active: msg.active, duration: msg.duration,
            startedAt: msg.active ? Date.now() - (msg.elapsed_seconds ?? 0) * 1000 : null,
            originCode: msg.origin_code || null, destCode: msg.dest_code || null,
            fromCity: msg.from_city || null, toCity: msg.to_city || null,
          });
          break;
        case 'focus_ended':
          setFocusState(prev => ({ ...prev, active: false, startedAt: null, originCode: null, destCode: null, fromCity: null, toCity: null }));
          setMyFocusElapsed(null);
          clearInterval(myTimerRef.current);
          setMessages(prev => [...prev, msg]);
          break;
        default: break;
      }
    }, () => setWsStatus('disconnected'));
    ws.onopen = () => setWsStatus('connected');
    wsRef.current = ws;
    return () => { ws.close(); clearInterval(myTimerRef.current); };
  }, [code, user]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const content = chatInput.trim();
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content }));
    setChatInput('');
  }, [chatInput]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const startFocus = useCallback((duration, route = null) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg = { type: 'start_focus', duration };
    if (route) { msg.origin_code = route.from; msg.dest_code = route.to; msg.from_city = route.fromCity; msg.to_city = route.toCity; }
    wsRef.current.send(JSON.stringify(msg));
  }, []);

  const joinFocus = useCallback(() => {
    const elapsed          = focusState.startedAt ? Math.floor((Date.now() - focusState.startedAt) / 1000) : 0;
    const remainingSeconds = Math.max(0, focusState.duration * 60 - elapsed);
    const durationMinutes  = Math.ceil(remainingSeconds / 60);
    let origin, destination;
    if (focusState.originCode && focusState.destCode) {
      // Look up lat/lon from local catalog — WorkMap needs them for greatCirclePoints().
      // Without lat/lon, WorkMap gets NaN coords and Leaflet crashes (black screen + sound).
      const aptFrom = lookupAirport(focusState.originCode);
      const aptTo   = lookupAirport(focusState.destCode);
      origin      = aptFrom ?? { city: focusState.fromCity || focusState.originCode, code: focusState.originCode };
      destination = aptTo   ?? { city: focusState.toCity   || focusState.destCode,  code: focusState.destCode   };
    } else {
      ({ origin, destination } = pickLiveRoute(focusState.duration, code));
    }
    dispatch({ type: 'SET_LIVE_CODE', payload: code });
    dispatch({ type: 'START_SESSION', payload: { mode: 'live-group', duration: durationMinutes, origin, destination, callsign: `LIVE-${code.toUpperCase()}`, isRealistic: false } });
    dispatch({ type: 'SET_SCREEN', payload: 'work' });
  }, [code, dispatch, focusState]);

  const endFocus = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (isHost) wsRef.current.send(JSON.stringify({ type: 'end_focus' }));
    setMyFocusElapsed(null);
    clearInterval(myTimerRef.current);
  }, [isHost]);

  const leaveRoom = () => {
    wsRef.current?.close();
    dispatch({ type: 'SET_LIVE_CODE', payload: null });
    dispatch({ type: 'SET_SCREEN', payload: 'live-sessions' });
  };

  const endSession = async () => {
    try { await api.endLiveSession(code); } catch {}
    wsRef.current?.close();
    dispatch({ type: 'SET_LIVE_CODE', payload: null });
    dispatch({ type: 'SET_SCREEN', payload: 'live-sessions' });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}?join=${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code || loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}>
          <Plane size={20} style={{ color: T.cyan }} />
        </motion.div>
        <span style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, letterSpacing: 3 }}>CONNECTING…</span>
      </div>
    );
  }

  const statusColor = wsStatus === 'connected' ? T.green : wsStatus === 'connecting' ? T.amber : '#ef4444';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: T.bg, paddingTop: 'max(0px, env(safe-area-inset-top,0px))' }}>

      {/* ── CDU System header ── */}
      <div style={{ flexShrink: 0, background: T.isDark ? '#020a12' : T.display, borderBottom: `1px solid ${T.border}` }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px' }}>
          <button onClick={leaveRoom} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: '0 4px 0 0' }}>
            <ArrowLeft size={14} />
          </button>

          <span style={{ fontFamily: MONO, fontSize: 8, color: T.cyan, letterSpacing: 3, fontWeight: 700 }}>
            FLODORO CDU
          </span>
          <div style={{ width: 1, height: 12, background: T.border }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: T.textBright, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
            {session?.title?.toUpperCase() || 'LIVE SESSION'}
          </span>

          {/* Code */}
          <button
            onClick={copyLink}
            style={{
              background: 'transparent', border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10, color: T.textMuted, letterSpacing: 2 }}>
              {code.toUpperCase()}
            </span>
            {copied ? <Check size={9} style={{ color: T.green }} /> : <Copy size={9} style={{ color: T.textMuted }} />}
          </button>

          {isHost && (
            <button
              onClick={endSession}
              style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                color: '#ef4444', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
              }}
            >
              END&gt;
            </button>
          )}
        </div>

        {/* Status strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px 8px',
          fontFamily: MONO, fontSize: 8, letterSpacing: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <motion.div
              animate={wsStatus === 'connected' ? { opacity: [1, 0.4, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, flexShrink: 0 }}
            />
            <span style={{ color: statusColor }}>
              {wsStatus === 'connected' ? 'COMM ON' : wsStatus.toUpperCase()}
            </span>
          </div>

          <span style={{ color: T.textMuted }}>·</span>

          <button
            onClick={() => setShowCrew(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: MONO, fontSize: 8, color: T.textMuted, letterSpacing: 1,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            CREW/{participants.length}
          </button>

          {focusState.active && focusState.originCode && (
            <>
              <span style={{ color: T.textMuted }}>·</span>
              <span style={{ color: T.cyan }}>RTE/{focusState.originCode}→{focusState.destCode}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Focus / preflight panel ──
          PreflightPanel (contains Leaflet map) unmounts instantly — no exit animation.
          Framer Motion opacity on a Leaflet parent triggers stacking context conflicts
          causing the screen to go black. MissionPanel fades in normally. */}
      <div style={{ flexShrink: 0, paddingTop: 8 }}>
        {focusState.active ? (
          <MissionPanel
            focusState={focusState} isHost={isHost}
            onJoin={joinFocus} onEndFocus={endFocus}
            myFocusElapsed={myFocusElapsed} T={T}
          />
        ) : isHost ? (
          <PreflightPanel onStart={startFocus} T={T} />
        ) : (
          <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: T.isDark ? '#04121e' : T.display, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: T.textMuted, letterSpacing: 3 }}>
              STANDBY  ·  AWAITING PREFLIGHT FROM CAPT
            </div>
          </div>
        )}
      </div>

      {/* ── Comms log ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Log label */}
        <div style={{
          padding: '2px 12px 4px',
          borderTop: `1px solid ${T.border2}`,
          flexShrink: 0,
        }}>
          <div style={{ height: 1, background: T.border2, marginBottom: 5 }} />
          <span style={{ fontFamily: MONO, fontSize: 7, color: T.textMuted, letterSpacing: 3 }}>
            COMMS LOG
          </span>
        </div>

        <div style={{ flex: 1, padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: T.textDim, letterSpacing: 3 }}>
                NO TRANSMISSIONS
              </div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: T.textMuted, letterSpacing: 0.5 }}>
                Comms channel open — say hello
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <LogEntry key={msg.id ? `db-${msg.id}` : idx} msg={msg} isOwn={!!myId && msg.user_id === myId} T={T} />
          ))}
          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* ── Transmit bar (CDU scratch pad) ── */}
      <div style={{
        flexShrink: 0,
        background: T.isDark ? '#020a12' : T.display,
        borderTop: `1px solid ${T.border}`,
        padding: `6px 12px max(10px, env(safe-area-inset-bottom,10px)) 12px`,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 7, color: T.textMuted, letterSpacing: 3, marginBottom: 5 }}>
          SCRATCH PAD  ·  TRANSMIT
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="TYPE MESSAGE…"
            rows={1}
            style={{
              flex: 1, padding: '9px 12px',
              background: T.isDark ? '#061626' : T.surface,
              border: `1px solid ${chatInput.trim() ? T.cyan + '50' : T.border}`,
              borderRadius: 8, color: T.textBright,
              fontFamily: MONO, fontSize: 12, outline: 'none', resize: 'none',
              lineHeight: 1.4, boxSizing: 'border-box', letterSpacing: 0.3,
              transition: 'border-color 0.15s',
            }}
          />
          <motion.button
            onClick={sendMessage}
            whileTap={{ scale: 0.92 }}
            disabled={!chatInput.trim() || wsStatus !== 'connected'}
            style={{
              padding: '9px 12px', borderRadius: 8, border: 'none', flexShrink: 0,
              background: chatInput.trim() && wsStatus === 'connected'
                ? `linear-gradient(135deg, ${T.cyan}, #0096c7)`
                : T.textDim,
              cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
              color: '#fff', transition: 'background 0.15s',
              fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            }}
          >
            TX&gt;
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showCrew && (
          <CrewSheet participants={participants} hostUID={session?.host_user_id} userId={myId} onClose={() => setShowCrew(false)} T={T} />
        )}
      </AnimatePresence>
    </div>
  );
}
