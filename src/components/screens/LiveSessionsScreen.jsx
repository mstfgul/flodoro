import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Users, Lock, UserCheck, Plus, X, Copy, Check,
  ArrowLeft, Search, UserPlus, Plane,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

const TC = createContext(null);
const useT = () => useContext(TC);

const MONO = "'JetBrains Mono', 'Courier New', monospace";

function makeT(isDark) {
  if (!isDark) return {
    bg: '#e8f4f8', surface: '#f0f8fc', display: '#ddeef5',
    header: 'rgba(232,244,248,0.98)',
    border: '#b0ccd8', border2: '#c8dce6',
    text: '#1a3a4c', textBright: '#0a2030', textMuted: '#3a6070', textDim: '#6090a8',
    cyan: '#007898', green: '#12883a', amber: '#a06000',
    isDark: false,
  };
  return {
    bg: '#030e18', surface: '#061828', display: '#041020',
    header: 'rgba(3,14,24,0.98)',
    border: '#0c2238', border2: '#081a2e',
    text: '#4a8098', textBright: '#b8d8ec', textMuted: '#1e4060', textDim: '#0c1e2c',
    cyan: '#00b4d8', green: '#22c55e', amber: '#E8A030',
    isDark: true,
  };
}

function getStatus(elapsed) {
  if (elapsed < 300)  return { code: 'BOARDING',   color: '#22c55e', pulse: true  };
  if (elapsed < 2700) return { code: 'ACTIVE',     color: '#00b4d8', pulse: false };
  return                     { code: 'IN FLIGHT',  color: '#E8A030', pulse: false };
}

function visLabel(v) {
  if (v === 'friends') return 'CREW ONLY';
  if (v === 'private') return 'PRIVATE';
  return 'PUBLIC';
}

// ─── Scanline overlay (MFD CRT effect) ───────────────────────────────────────
function Scanlines({ isDark }) {
  if (!isDark) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)',
    }} />
  );
}

// ─── Blinking cursor ──────────────────────────────────────────────────────────
function Cursor({ color }) {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      style={{ color, fontFamily: MONO, fontSize: 12 }}
    >▌</motion.span>
  );
}

// ─── Traffic contact card ─────────────────────────────────────────────────────
function TfcContact({ session, onJoin, index, T }) {
  const st = getStatus(session.elapsed_seconds || 0);
  const accentRgb = st.code === 'BOARDING' ? '34,197,94' : st.code === 'ACTIVE' ? '0,180,216' : '232,160,48';

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', damping: 20, stiffness: 120 }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onJoin(session.join_code)}
      className="group relative rounded-2xl p-0.5 w-full text-left"
      style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.2) 0%, rgba(${accentRgb},0.04) 100%)`, border: 'none', cursor: 'pointer' }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
        style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.35) 0%, rgba(${accentRgb},0.08) 100%)`, boxShadow: `0 0 30px rgba(${accentRgb},0.15)` }}
      />
      <div className="relative rounded-[14px] glass px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${accentRgb},0.15)` }}>
            {st.pulse ? (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                style={{ fontSize: 14, color: st.color }}
              >✈</motion.span>
            ) : (
              <span style={{ fontSize: 14, color: st.color }}>✈</span>
            )}
          </div>

          {/* Data */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white truncate">{session.title}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: `rgba(${accentRgb},0.15)`, color: st.color, border: `1px solid rgba(${accentRgb},0.3)` }}>
                {st.code}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#475569' }}>
                {session.host_name ?? '—'}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#475569' }}>
                {session.participant_count} crew
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#475569' }}>
                {visLabel(session.visibility)}
              </span>
            </div>
          </div>

          <div className="text-[#475569] group-hover:text-white transition-colors text-base flex-shrink-0">›</div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── CDU-style create page ────────────────────────────────────────────────────
function CreatePage({ onClose, onCreated, T }) {
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try { onCreated(await api.createLiveSession({ title, visibility })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const opts = [
    { id: 'public',  label: 'PUBLIC   — OPEN TO ALL PILOTS',  color: '#22c55e' },
    { id: 'friends', label: 'CREW     — FRIENDS ON ROSTER',    color: '#00b4d8' },
    { id: 'private', label: 'PRIVATE  — BOARDING PASS REQ',    color: '#E8A030' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(2,8,14,0.94)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 'max(0px, env(safe-area-inset-bottom,0px))' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500,
          background: T.isDark ? '#040e18' : T.surface,
          borderRadius: '18px 18px 0 0',
          border: `1px solid ${T.border}`, borderBottom: 'none',
          padding: '0 0 28px',
          boxShadow: T.isDark ? '0 -20px 80px rgba(0,180,216,0.06)' : '0 -20px 60px rgba(0,0,0,0.15)',
        }}
      >
        {/* CDU header */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: `1px solid ${T.border}`,
          background: T.isDark ? '#030c16' : T.display,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: T.cyan, letterSpacing: 3, fontWeight: 700 }}>
              FLODORO CDU  OPEN NEW GATE
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <form onSubmit={submit} style={{ padding: '14px 16px 0' }}>
          {/* Gate name row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, width: 80, flexShrink: 0, letterSpacing: 0.5 }}>GATE NAME</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="ENTER GATE NAME"
            autoFocus
            style={{
              width: '100%', padding: '10px 12px',
              background: T.isDark ? '#061626' : T.display,
              border: `1px solid ${T.border}`, borderRadius: 8,
              color: T.textBright, fontFamily: MONO, fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
              letterSpacing: 1, marginBottom: 16,
            }}
          />

          {/* Access control */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, width: 80, flexShrink: 0, letterSpacing: 0.5 }}>ACCESS</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
            {opts.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVisibility(opt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: visibility === opt.id
                    ? T.isDark ? `${opt.color}18` : `${opt.color}15`
                    : 'transparent',
                  outline: visibility === opt.id ? `1px solid ${opt.color}40` : `1px solid ${T.border}`,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: visibility === opt.id ? opt.color : T.textMuted, letterSpacing: 0.5 }}>
                  {visibility === opt.id ? '◆' : '◇'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: visibility === opt.id ? opt.color : T.textMuted, letterSpacing: 0.5 }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#ef4444', marginBottom: 12, letterSpacing: 0.5 }}>
              ERR: {error.toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button" onClick={onClose}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, border: `1px solid ${T.border}`,
                background: 'transparent', color: T.textMuted, cursor: 'pointer',
                fontFamily: MONO, fontSize: 11, letterSpacing: 1,
              }}
            >
              &lt; CANCEL
            </button>
            <button
              type="submit" disabled={loading}
              style={{
                flex: 1.5, padding: '12px', borderRadius: 8, border: 'none',
                background: loading ? T.textDim : `linear-gradient(135deg, ${T.cyan}, #0096c7)`,
                color: '#fff', cursor: 'pointer',
                fontFamily: MONO, fontSize: 11, letterSpacing: 1, fontWeight: 700,
              }}
            >
              {loading ? 'OPENING…' : 'OPEN GATE >'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Scan pass page ───────────────────────────────────────────────────────────
function ScanPassPage({ onClose, onJoin, T }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      await api.joinLiveSession(code.trim().toLowerCase());
      onJoin(code.trim().toLowerCase());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(2,8,14,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340,
          background: T.isDark ? '#040e18' : T.surface,
          border: `1px solid ${T.border}`, borderRadius: 14,
          overflow: 'hidden',
          boxShadow: T.isDark ? '0 20px 80px rgba(0,180,216,0.08)' : '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{
          padding: '12px 14px 10px',
          borderBottom: `1px solid ${T.border}`,
          background: T.isDark ? '#030c16' : T.display,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: T.cyan, letterSpacing: 3, fontWeight: 700 }}>
              CDU  GATE ACCESS
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted }}>
              <X size={14} />
            </button>
          </div>
        </div>
        <form onSubmit={submit} style={{ padding: '16px 14px 18px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: T.textMuted, letterSpacing: 2, marginBottom: 8 }}>
            ENTER GATE CODE
          </div>
          <input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.toLowerCase())}
            placeholder="00000000"
            maxLength={8}
            style={{
              width: '100%', padding: '14px',
              background: T.isDark ? '#061626' : T.display,
              border: `1px solid ${code.length >= 6 ? T.cyan : T.border}`,
              borderRadius: 8, color: T.cyan,
              fontSize: 24, fontFamily: MONO, letterSpacing: 8,
              outline: 'none', textAlign: 'center', marginBottom: 14,
              boxSizing: 'border-box', transition: 'border-color 0.15s',
            }}
          />
          {error && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#ef4444', marginBottom: 10, letterSpacing: 0.5 }}>
              ERR: {error.toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: 1 }}>
              &lt; CANCEL
            </button>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              style={{
                flex: 1.5, padding: '11px', borderRadius: 8, border: 'none',
                background: code.length >= 6 ? `linear-gradient(135deg, ${T.cyan}, #0096c7)` : T.textDim,
                color: '#fff', cursor: 'pointer',
                fontFamily: MONO, fontSize: 10, letterSpacing: 1, fontWeight: 700,
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'CONNECTING…' : 'BOARD GATE >'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LiveSessionsScreen() {
  const { state, dispatch } = useApp();
  const { isGuest } = useAuth();
  const isDark = state.theme !== 'light';
  const T = makeT(isDark);

  const [sessions, setSessions]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showCreate, setShowCreate]       = useState(false);
  const [showJoinCode, setShowJoinCode]   = useState(false);
  const [copiedCode, setCopiedCode]       = useState(null);
  const [error, setError]                 = useState('');
  const [friendSearch, setFriendSearch]   = useState('');
  const [friendResults, setFriendResults] = useState([]);
  const [friendMsg, setFriendMsg]         = useState('');
  const [showCrew, setShowCrew]           = useState(false);

  const load = () => {
    if (isGuest) return;
    setLoading(true);
    api.getLiveSessions().then(setSessions).catch(() => setSessions([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (isGuest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 relative overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute pointer-events-none"
          style={{ width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', top: '-10%', left: '50%', transform: 'translateX(-50%)' }}
        />
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <Lock size={24} style={{ color: '#8b5cf6' }} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-center">
          <div className="text-lg font-bold text-white mb-2">Login Required</div>
          <div className="text-sm text-[#64748b] max-w-[240px]">Live sessions require a pilot account.</div>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Back to Home
        </motion.button>
      </div>
    );
  }

  const goBack = () => dispatch({ type: 'SET_SCREEN', payload: 'hangar' });

  const joinSession = async (code) => {
    try {
      await api.joinLiveSession(code);
      dispatch({ type: 'SET_LIVE_CODE', payload: code });
      dispatch({ type: 'SET_SCREEN', payload: 'live-room' });
    } catch (err) { setError(err.message); }
  };

  const handleCreated = async (session) => {
    setShowCreate(false);
    await api.joinLiveSession(session.join_code);
    dispatch({ type: 'SET_LIVE_CODE', payload: session.join_code });
    dispatch({ type: 'SET_SCREEN', payload: 'live-room' });
  };

  const copyLink = async (code, e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(`${window.location.origin}?join=${code}`).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const searchFriends = async (q) => {
    if (q.length < 2) { setFriendResults([]); return; }
    try { setFriendResults(await api.searchUsers(q)); } catch {}
  };

  const addFriend = async (id) => {
    try {
      await api.sendFriendRequest(id);
      setFriendMsg('REQUEST SENT');
      setTimeout(() => setFriendMsg(''), 2500);
    } catch (err) { setFriendMsg(err.message.toUpperCase()); }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ paddingTop: 'max(0px, env(safe-area-inset-top,0px))' }}>

      {/* Background breathing orb */}
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
          top: '-20%', left: '50%', transform: 'translateX(-50%)', zIndex: 0,
        }}
      />

      {/* ── Header ── */}
      <div className="relative z-10 flex-shrink-0 border-b"
        style={{ background: 'rgba(7,8,14,0.95)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}>

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={goBack} style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', color: '#475569', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Live Sessions</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginTop: 2 }}>
              ACTIVE TRAFFIC · {sessions.length} SESSION{sessions.length !== 1 ? 'S' : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}
            />
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#22c55e', letterSpacing: 2 }}>LIVE</span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setShowCrew(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: showCrew ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showCrew ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: showCrew ? '#8b5cf6' : '#64748b',
            }}
          >
            <UserPlus size={12} /> Crew
          </button>
          <button
            onClick={() => setShowJoinCode(true)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#64748b',
            }}
          >
            Enter Code
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 py-2 rounded-xl text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, #00b4d8, #0096c7)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            + Open Gate
          </button>
        </div>

        {/* Collapsible crew search */}
        <AnimatePresence>
          {showCrew && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div style={{ padding: '10px 14px 12px' }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: '#475569', letterSpacing: '0.2em', marginBottom: 8 }}>
                  FIND CREW
                </div>
                <div style={{ position: 'relative', marginBottom: 7 }}>
                  <Search size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    value={friendSearch}
                    onChange={e => { setFriendSearch(e.target.value); searchFriends(e.target.value); }}
                    placeholder="Name or email"
                    style={{
                      width: '100%', padding: '9px 10px 9px 30px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                      color: '#fff', fontSize: 13,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                {friendMsg && (
                  <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 6 }}>
                    {friendMsg}
                  </div>
                )}
                {friendResults.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {friendResults.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                            {u.display_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#475569' }}>{u.email}</div>
                        </div>
                        <button
                          onClick={() => addFriend(u.id)}
                          className="px-3 py-1 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.3)', color: '#00b4d8', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Traffic contacts ── */}
      <div className="flex-1 relative z-10" style={{ padding: '12px 14px 100px' }}>

        {/* Board label */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#475569', letterSpacing: '0.2em' }}>
              ACTIVE TRAFFIC
            </span>
            {sessions.length > 0 && (
              <span className="text-xs font-bold" style={{ color: '#00b4d8' }}>{sessions.length}</span>
            )}
          </div>
          <button
            onClick={load}
            className="text-xs transition-colors hover:text-white"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center pt-16 gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}>
              <Plane size={20} style={{ color: '#475569' }} />
            </motion.div>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#475569', letterSpacing: '0.2em' }}>
              SCANNING TRAFFIC…
            </span>
          </div>
        ) : sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-16 gap-4 text-center"
          >
            <div className="text-4xl">🛫</div>
            <div>
              <div className="text-base font-semibold text-white mb-1">Airspace clear</div>
              <div className="text-sm" style={{ color: '#64748b' }}>No active sessions. Open the first gate.</div>
            </div>
            <motion.button
              onClick={() => setShowCreate(true)}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #00b4d8, #0096c7)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              + Open Gate
            </motion.button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s, i) => (
              <div key={s.id} className="relative">
                <TfcContact session={s} onJoin={joinSession} index={i} T={T} />
                <button
                  onClick={(e) => copyLink(s.join_code, e)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1 transition-colors z-10"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedCode === s.join_code ? '#22c55e' : '#475569' }}
                >
                  {copiedCode === s.join_code ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate   && <CreatePage   onClose={() => setShowCreate(false)}   onCreated={handleCreated} T={T} />}
        {showJoinCode && <ScanPassPage onClose={() => setShowJoinCode(false)} onJoin={joinSession}     T={T} />}
      </AnimatePresence>
    </div>
  );
}
