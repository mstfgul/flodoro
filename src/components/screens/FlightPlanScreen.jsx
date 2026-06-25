import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Play, ChevronRight, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { airports } from '../../data/cityPairs';

const STATUS_STYLE = {
  pending:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', label: 'Pending'  },
  active:    { color: '#00b4d8', bg: 'rgba(0,180,216,0.12)',  border: 'rgba(0,180,216,0.35)',  label: 'Active'   },
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',  label: 'Done ✓'   },
  missed:    { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)', label: 'Missed'   },
};

function AirportSelect({ value, onChange, label }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ap = airports.find(a => a.code === value);
  const filtered = airports.filter(a =>
    !search || a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.city.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 10, textAlign: 'left',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          color: ap ? '#e0e6f0' : '#475569', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>{ap ? `${ap.code} · ${ap.city}` : 'Select...'}</span>
        <ChevronRight size={12} style={{ opacity: 0.5, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'rgba(9,14,30,0.98)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, overflow: 'hidden', marginTop: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)',
                color: '#e0e6f0', fontSize: 12, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {filtered.map(a => (
              <button key={a.code}
                onClick={() => { onChange(a.code); setOpen(false); setSearch(''); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                  background: value === a.code ? 'rgba(0,180,216,0.15)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: value === a.code ? '#00b4d8' : '#94a3b8',
                  fontSize: 12,
                }}
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 700, marginRight: 8 }}>{a.code}</span>
                {a.city} <span style={{ opacity: 0.5 }}>· {a.country}</span>
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
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.2)',
        borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#00b4d8', letterSpacing: '0.05em' }}>ADD NEW LEG</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AirportSelect value={origin} onChange={setOrigin} label="Departure" />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10, color: '#475569' }}>→</div>
          <AirportSelect value={dest} onChange={setDest} label="Arrival" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Departure Time</div>
            <input
              type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e0e6f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration (min)</div>
            <input
              type="number" value={dur} min="5" max="180" onChange={e => setDur(Math.max(5, parseInt(e.target.value) || 25))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e0e6f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} style={{
            flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 600, fontSize: 13,
            background: 'rgba(0,180,216,0.2)', border: '1px solid rgba(0,180,216,0.4)',
            color: '#00b4d8', cursor: 'pointer',
          }}>Add</button>
          <button onClick={onCancel} style={{
            padding: '9px 20px', borderRadius: 10, fontSize: 13,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#64748b', cursor: 'pointer',
          }}>Cancel</button>
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

  const addLeg = useCallback(({ originCode, destCode, originAp, destAp, duration, scheduledTime }) => {
    const newLeg = {
      id: Date.now(),
      origin: { code: originCode, city: originAp.city, lat: originAp.lat, lon: originAp.lon },
      dest:   { code: destCode,   city: destAp.city,   lat: destAp.lat,   lon: destAp.lon   },
      duration,
      scheduledTime,
      status: 'pending',
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
        duration:    leg.duration,
        flightPlanLegId: leg.id,
      },
    });
    dispatch({ type: 'FLIGHT_PLAN_SET_ACTIVE', payload: leg.id });
  }, [dispatch]);

  const completedCount = legs.filter(l => l.status === 'completed').length;
  const totalMin       = legs.reduce((s, l) => s + l.duration, 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(7,11,26,0.95)',
      }}>
        <button onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
          <ArrowLeft size={16} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#00b4d8', letterSpacing: '0.1em' }}>FPL</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#e0e6f0' }}>Daily Flight Plan</span>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {today} · {legs.length} legs · {totalMin} min
          </div>
        </div>

        {/* Progress */}
        {legs.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{completedCount}/{legs.length}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>completed</div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '20px', maxWidth: 640, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        <AnimatePresence>
          {showForm && <AddLegForm onAdd={addLeg} onCancel={() => setShowForm(false)} />}
        </AnimatePresence>

        {legs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Flight plan empty</div>
            <div style={{ fontSize: 13, marginBottom: 24 }}>Plan your day with routes and durations</div>
            <button onClick={() => setShowForm(true)} style={{
              padding: '10px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.35)',
              color: '#00b4d8', cursor: 'pointer',
            }}>
              + Add First Leg
            </button>
          </motion.div>
        ) : (
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
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    background: isNext ? 'rgba(0,180,216,0.07)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isNext ? 'rgba(0,180,216,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 14, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  {/* Leg number */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: `${st.bg}`, border: `1px solid ${st.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: st.color,
                  }}>
                    {idx + 1}
                  </div>

                  {/* Scheduled time */}
                  <div style={{ minWidth: 44, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
                      {leg.scheduledTime}
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                      <Clock size={9} />{leg.duration}m
                    </div>
                  </div>

                  {/* Route */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#e0e6f0' }}>{leg.origin.code}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{leg.origin.city}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
                      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${st.color}50, transparent)` }} />
                      <span style={{ fontSize: 12 }}>✈</span>
                      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${st.color}50, transparent)` }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#e0e6f0' }}>{leg.dest.code}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{leg.dest.city}</div>
                    </div>
                  </div>

                  {/* Status / Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                      background: st.bg, border: `1px solid ${st.border}`, color: st.color,
                      letterSpacing: '0.05em',
                    }}>{st.label}</span>

                    {isNext && (
                      <button onClick={() => startLeg(leg)} style={{
                        width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(0,180,216,0.2)', border: '1px solid rgba(0,180,216,0.4)',
                        color: '#00b4d8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Play size={13} fill="#00b4d8" />
                      </button>
                    )}

                    {leg.status === 'pending' && (
                      <button onClick={() => removeLeg(leg.id)} style={{
                        width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)',
                        color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Add button */}
        {!showForm && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', marginTop: 12, padding: '11px 0',
              borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
              color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, transition: 'all 0.15s',
            }}
          >
            <Plus size={14} /> Add Leg
          </motion.button>
        )}
      </div>
    </div>
  );
}
