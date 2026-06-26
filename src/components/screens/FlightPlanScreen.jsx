import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Play, ChevronRight, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { airports } from '../../data/cityPairs';

const STATUS_STYLE = {
  pending:   { color: '#3C4566', bg: 'rgba(60,69,102,0.1)',   border: 'rgba(60,69,102,0.2)',   label: 'PENDING'  },
  active:    { color: '#00b4d8', bg: 'rgba(0,180,216,0.12)',  border: 'rgba(0,180,216,0.35)',  label: 'ACTIVE'   },
  completed: { color: '#E8A030', bg: 'rgba(232,160,48,0.12)', border: 'rgba(232,160,48,0.3)',  label: 'DONE'     },
  missed:    { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)', label: 'MISSED'   },
};

function AirportSelect({ value, onChange, label }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ap = airports.find(a => a.code === value);
  const filtered = airports.filter(a =>
    !search ||
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.city.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em', color: '#3C4566', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 10, textAlign: 'left',
          background: '#08101E', border: `1px solid ${open ? 'rgba(0,180,216,0.4)' : '#131D30'}`,
          color: ap ? '#DDE3F5' : '#3C4566', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'border-color 0.15s',
          fontFamily: 'JetBrains Mono, monospace', fontWeight: ap ? 700 : 400,
        }}
      >
        <span>{ap ? `${ap.code} · ${ap.city}` : 'Select…'}</span>
        <ChevronRight size={12} style={{ opacity: 0.4, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: '#0C0F1C', border: '1px solid #1A1D2E',
              borderRadius: 10, overflow: 'hidden', marginTop: 4,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', padding: '9px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: 'none', borderBottom: '1px solid #1A1D2E',
                color: '#DDE3F5', fontSize: 12, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            {filtered.map(a => (
              <button key={a.code}
                onClick={() => { onChange(a.code); setOpen(false); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 12px', textAlign: 'left',
                  background: value === a.code ? 'rgba(0,180,216,0.1)' : 'transparent',
                  border: 'none', cursor: 'pointer', transition: 'background 0.1s',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
                onMouseEnter={e => { if (value !== a.code) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (value !== a.code) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: value === a.code ? '#00b4d8' : '#DDE3F5', minWidth: 36 }}>{a.code}</span>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.city}</div>
                  <div style={{ fontSize: 10, color: '#3C4566' }}>{a.country}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddLegForm({ onAdd, onCancel }) {
  const [origin, setOrigin] = useState('IST');
  const [dest, setDest]     = useState('FRA');
  const [dur, setDur]       = useState(25);
  const [time, setTime]     = useState('09:00');

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box',
    background: '#08101E', border: '1px solid #131D30',
    color: '#DDE3F5', fontSize: 13, outline: 'none',
    fontFamily: 'JetBrains Mono, monospace', transition: 'border-color 0.15s',
  };

  const submit = () => {
    const origAp = airports.find(a => a.code === origin);
    const destAp = airports.find(a => a.code === dest);
    if (!origAp || !destAp || origin === dest) return;
    onAdd({ originCode: origin, destCode: dest, originAp: origAp, destAp: destAp, duration: dur, scheduledTime: time });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      style={{ overflow: 'hidden', marginBottom: 10 }}
    >
      <div style={{
        background: '#08101E', border: '1px solid rgba(0,180,216,0.25)',
        borderLeft: '3px solid rgba(0,180,216,0.6)',
        borderRadius: '0 12px 12px 0', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#00b4d8', textTransform: 'uppercase' }}>
          NEW LEG
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <AirportSelect value={origin} onChange={setOrigin} label="Departure" />
          <div style={{ paddingBottom: 12, color: '#2A3450', flexShrink: 0 }}>→</div>
          <AirportSelect value={dest} onChange={setDest} label="Arrival" />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em', color: '#3C4566', textTransform: 'uppercase', marginBottom: 6 }}>Dep. Time</div>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(0,180,216,0.4)'}
              onBlur={e => e.target.style.borderColor = '#131D30'}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em', color: '#3C4566', textTransform: 'uppercase', marginBottom: 6 }}>Duration (min)</div>
            <input type="number" value={dur} min="5" max="180"
              onChange={e => setDur(Math.max(5, parseInt(e.target.value) || 25))}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(0,180,216,0.4)'}
              onBlur={e => e.target.style.borderColor = '#131D30'}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} style={{
            flex: 1, height: 40, borderRadius: 10,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.4)',
            color: '#00b4d8', cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.15)'; }}
          >
            ADD LEG
          </button>
          <button onClick={onCancel} style={{
            height: 40, padding: '0 16px', borderRadius: 10, fontSize: 12,
            background: 'transparent', border: '1px solid #131D30',
            color: '#3C4566', cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#1E2540'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#3C4566'; e.currentTarget.style.borderColor = '#131D30'; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function FlightPlanScreen() {
  const { state, dispatch } = useApp();
  const { flightPlan } = state;
  const [showForm, setShowForm] = useState(false);
  const legs = flightPlan?.legs ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const isDark = state.theme !== 'light';

  const addLeg = useCallback(({ originCode, destCode, originAp, destAp, duration, scheduledTime }) => {
    const newLeg = {
      id: Date.now(),
      origin: { code: originCode, city: originAp.city, lat: originAp.lat, lon: originAp.lon },
      dest:   { code: destCode,   city: destAp.city,   lat: destAp.lat,   lon: destAp.lon   },
      duration, scheduledTime, status: 'pending',
    };
    dispatch({ type: 'FLIGHT_PLAN_ADD_LEG', payload: newLeg });
    setShowForm(false);
  }, [dispatch]);

  const removeLeg = useCallback((id) => {
    dispatch({ type: 'FLIGHT_PLAN_REMOVE_LEG', payload: id });
  }, [dispatch]);

  const startLeg = useCallback((leg) => {
    dispatch({
      type: 'START_SESSION',
      payload: {
        mode: 'city',
        origin:      { city: leg.origin.city, code: leg.origin.code, lat: leg.origin.lat, lon: leg.origin.lon },
        destination: { city: leg.dest.city,   code: leg.dest.code,   lat: leg.dest.lat,   lon: leg.dest.lon   },
        duration: leg.duration,
        flightPlanLegId: leg.id,
      },
    });
    dispatch({ type: 'FLIGHT_PLAN_SET_ACTIVE', payload: leg.id });
  }, [dispatch]);

  const completedCount = legs.filter(l => l.status === 'completed').length;
  const totalMin = legs.reduce((s, l) => s + l.duration, 0);
  const progress = legs.length > 0 ? completedCount / legs.length : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        background: isDark ? 'rgba(4,6,14,0.97)' : 'rgba(248,252,255,0.97)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isDark ? '#111828' : 'rgba(0,0,0,0.08)'}`,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: `1px solid ${isDark ? '#131D30' : 'rgba(0,0,0,0.08)'}`,
            cursor: 'pointer', color: isDark ? '#3C4566' : '#64748b', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#DDE3F5' : '#0f172a'; e.currentTarget.style.borderColor = isDark ? '#1E2540' : 'rgba(0,0,0,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#3C4566' : '#64748b'; e.currentTarget.style.borderColor = isDark ? '#131D30' : 'rgba(0,0,0,0.08)'; }}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.18em', color: '#8b5cf6',
              padding: '2px 7px', borderRadius: 4,
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
            }}>FPL</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#DDE3F5' : '#0f172a' }}>
              Daily Flight Plan
            </span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: isDark ? '#2A3450' : '#94a3b8', marginTop: 2, letterSpacing: '0.06em' }}>
            {today} · {legs.length} legs · {totalMin} min total
          </div>
        </div>

        {/* Progress */}
        {legs.length > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: '#E8A030', lineHeight: 1 }}>
              {completedCount}<span style={{ color: '#2A3450', fontWeight: 400 }}>/{legs.length}</span>
            </div>
            <div style={{ fontSize: 9, color: '#3C4566', marginTop: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>done</div>
            <div style={{ width: 48, height: 2, background: '#131D30', borderRadius: 1, marginTop: 5, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: '#E8A030', borderRadius: 1 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '20px', maxWidth: 640, margin: '0 auto', width: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

        <AnimatePresence>
          {showForm && <AddLegForm onAdd={addLeg} onCancel={() => setShowForm(false)} />}
        </AnimatePresence>

        {/* Empty state */}
        {legs.length === 0 && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '64px 0' }}
          >
            <div style={{ marginBottom: 20 }}>
              <svg width="52" height="36" viewBox="0 0 52 36" fill="none" style={{ opacity: 0.2 }}>
                <circle cx="8" cy="18" r="4" stroke="#DDE3F5" strokeWidth="1.5" />
                <line x1="12" y1="18" x2="20" y2="18" stroke="#DDE3F5" strokeWidth="1" strokeDasharray="3 2" />
                <text x="22" y="22" fill="#DDE3F5" fontSize="12" fontFamily="monospace">✈</text>
                <line x1="32" y1="18" x2="44" y2="18" stroke="#DDE3F5" strokeWidth="1" strokeDasharray="3 2" />
                <circle cx="48" cy="18" r="4" stroke="#DDE3F5" strokeWidth="1.5" />
                <line x1="4" y1="28" x2="48" y2="28" stroke="#DDE3F5" strokeWidth="0.5" opacity="0.4" />
                <line x1="4" y1="32" x2="32" y2="32" stroke="#DDE3F5" strokeWidth="0.5" opacity="0.25" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#DDE3F5' : '#0f172a', marginBottom: 6 }}>
              No flight plan
            </div>
            <div style={{ fontSize: 13, color: '#3C4566', marginBottom: 24 }}>
              Plan your day as a series of flights
            </div>
            <button onClick={() => setShowForm(true)} style={{
              height: 44, padding: '0 24px', borderRadius: 10,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)',
              color: '#8b5cf6', cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; }}
            >
              + ADD FIRST LEG
            </button>
          </motion.div>
        )}

        {/* Leg list */}
        {legs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {legs.map((leg, idx) => {
              const st = STATUS_STYLE[leg.status];
              const isNext = leg.status === 'pending' && legs.slice(0, idx).every(l => l.status === 'completed' || l.status === 'missed');

              return (
                <motion.div
                  key={leg.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: idx * 0.04, type: 'spring', damping: 22, stiffness: 130 }}
                  style={{
                    background: isNext ? 'rgba(0,180,216,0.05)' : '#08101E',
                    border: `1px solid ${isNext ? 'rgba(0,180,216,0.3)' : '#131D30'}`,
                    borderLeft: `3px solid ${st.color}`,
                    borderRadius: '0 12px 12px 0',
                    padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  {/* Number */}
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: st.bg, border: `1px solid ${st.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: st.color,
                  }}>
                    {idx + 1}
                  </div>

                  {/* Time */}
                  <div style={{ minWidth: 44, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: isDark ? '#DDE3F5' : '#0f172a', lineHeight: 1 }}>
                      {leg.scheduledTime}
                    </div>
                    <div style={{ fontSize: 9, color: '#2A3450', marginTop: 3, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center', letterSpacing: '0.06em' }}>
                      <Clock size={8} />{leg.duration}m
                    </div>
                  </div>

                  {/* Route */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 17, fontWeight: 700, color: '#00b4d8', lineHeight: 1 }}>{leg.origin.code}</div>
                      <div style={{ fontSize: 9, color: '#3C4566', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 44 }}>{leg.origin.city}</div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${st.color}40)` }} />
                      <span style={{ fontSize: 10, color: st.color, opacity: 0.7 }}>✈</span>
                      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${st.color}40, transparent)` }} />
                    </div>

                    <div style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 17, fontWeight: 700, color: '#E8A030', lineHeight: 1 }}>{leg.dest.code}</div>
                      <div style={{ fontSize: 9, color: '#3C4566', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 44 }}>{leg.dest.city}</div>
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                      padding: '3px 8px', borderRadius: 5,
                      background: st.bg, border: `1px solid ${st.border}`, color: st.color,
                    }}>{st.label}</span>

                    {isNext && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => startLeg(leg)}
                        style={{
                          width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                          background: 'rgba(232,160,48,0.15)', border: '1px solid rgba(232,160,48,0.4)',
                          color: '#E8A030', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,160,48,0.28)'; e.currentTarget.style.borderColor = 'rgba(232,160,48,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,160,48,0.15)'; e.currentTarget.style.borderColor = 'rgba(232,160,48,0.4)'; }}
                      >
                        <Play size={13} fill="#E8A030" />
                      </motion.button>
                    )}

                    {leg.status === 'pending' && (
                      <button
                        onClick={() => removeLeg(leg.id)}
                        style={{
                          width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                          background: 'transparent', border: '1px solid #131D30',
                          color: '#2A3450', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.25)'; e.currentTarget.style.color = '#f87171'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#131D30'; e.currentTarget.style.color = '#2A3450'; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Add leg button */}
        {!showForm && legs.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: legs.length * 0.04 + 0.1 }}
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', marginTop: 10, height: 44,
              borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: 'transparent', border: '1px dashed #1A1D2E',
              color: '#2A3450', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A1D2E'; e.currentTarget.style.color = '#2A3450'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={14} /> Add Leg
          </motion.button>
        )}
      </div>
    </div>
  );
}
