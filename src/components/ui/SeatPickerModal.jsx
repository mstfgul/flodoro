import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

const BUSINESS_ROWS = 4;
const ECONOMY_ROWS = 26;
const TOTAL_ROWS = BUSINESS_ROWS + ECONOMY_ROWS; // 30

// Pseudo-random occupancy seeded by position
function isOccupied(row, col) {
  const n = (row * 7 + col * 13 + 17) % 100;
  if (row < BUSINESS_ROWS) return n < 55; // 55% occupancy in business
  if (row === 13 || row === 14) return false; // exit rows always free
  return n < 72; // 72% occupancy in economy
}

const COLS = ['A', 'B', 'C', null, 'D', 'E', 'F'];
const COL_INDICES = [0, 1, 2, 4, 5, 6]; // skip aisle (index 3)

function seatId(row, col) {
  return `${row + 1}${col}`;
}

const COCKPIT_ID = 'KOKPIT';

export function SeatPickerModal({ onConfirm, onClose }) {
  const [selected, setSelected] = useState(null);
  const [hovering, setHovering] = useState(null);
  const isCockpit = selected === COCKPIT_ID;

  const occupied = useMemo(() => {
    const set = new Set();
    for (let r = 0; r < TOTAL_ROWS; r++) {
      COLS.forEach((col, ci) => {
        if (col && isOccupied(r, ci)) set.add(seatId(r, col));
      });
    }
    return set;
  }, []);

  const handleSeat = (id) => {
    if (occupied.has(id)) return;
    setSelected(prev => prev === id ? null : id);
  };

  const handleCockpit = () => {
    setSelected(prev => prev === COCKPIT_ID ? null : COCKPIT_ID);
  };

  const classLabel = (row) => {
    if (row < BUSINESS_ROWS) return { text: 'Business', color: '#f4a261' };
    return { text: 'Economy', color: '#00b4d8' };
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #0d1226 0%, #080c1c 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          width: 'min(360px, calc(100vw - 24px))',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Choose Seat</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Pick a seat for your flight</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, padding: '6px 8px', color: '#64748b', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            {[
              { color: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)', label: 'Taken' },
              { color: 'rgba(0,180,216,0.1)', border: 'rgba(0,180,216,0.45)', label: 'Free' },
              { color: 'rgba(0,180,216,0.9)', border: '#00b4d8', label: 'Selected' },
            ].map(({ color, border, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 10, borderRadius: 3, background: color, border: `1px solid ${border}` }} />
                <span style={{ fontSize: 10, color: '#475569' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable cabin */}
        <div style={{ overflowY: 'auto', padding: '10px 16px 16px', flexGrow: 1 }}>
          {/* Nose */}
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <svg width="40" height="28" viewBox="0 0 40 28">
              <path d="M20 2 L36 26 H4 Z" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* ── Cockpit option ── */}
          <motion.button
            onClick={handleCockpit}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%', marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 12,
              border: `1px solid ${isCockpit ? 'rgba(251,191,36,0.55)' : 'rgba(255,255,255,0.08)'}`,
              background: isCockpit
                ? 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.08) 100%)'
                : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              textAlign: 'left',
              boxShadow: isCockpit ? '0 0 18px rgba(251,191,36,0.15)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {/* Instrument panel mini SVG */}
            <div style={{
              width: 42, height: 32, flexShrink: 0, borderRadius: 8,
              background: isCockpit ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isCockpit ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 36 28" width="34" height="26">
                {/* Cockpit window */}
                <rect x="2" y="2" width="32" height="16" rx="3" fill="none" stroke={isCockpit ? '#fbbf24' : '#334155'} strokeWidth="1.2"/>
                {/* Horizon line */}
                <line x1="4" y1="10" x2="32" y2="10" stroke={isCockpit ? 'rgba(251,191,36,0.6)' : '#1e293b'} strokeWidth="1"/>
                {/* Sky */}
                <rect x="4" y="4" width="28" height="6" fill={isCockpit ? 'rgba(251,191,36,0.08)' : 'rgba(56,189,248,0.06)'} rx="1"/>
                {/* Ground */}
                <rect x="4" y="10" width="28" height="6" fill={isCockpit ? 'rgba(251,191,36,0.05)' : 'rgba(120,53,15,0.06)'} rx="1"/>
                {/* Center marker */}
                <circle cx="18" cy="10" r="2" fill="none" stroke={isCockpit ? '#fbbf24' : '#334155'} strokeWidth="1"/>
                {/* Dials row */}
                {[8, 14, 22, 28].map(x => (
                  <circle key={x} cx={x} cy="24" r="2.5" fill="none" stroke={isCockpit ? 'rgba(251,191,36,0.5)' : '#1e293b'} strokeWidth="1"/>
                ))}
                {/* Pitch wings */}
                <line x1="10" y1="10" x2="14" y2="10" stroke={isCockpit ? '#fbbf24' : '#334155'} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="22" y1="10" x2="26" y2="10" stroke={isCockpit ? '#fbbf24' : '#334155'} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: isCockpit ? '#fbbf24' : '#94a3b8', fontFamily: 'monospace' }}>
                COCKPIT
              </div>
              <div style={{ fontSize: 10, color: isCockpit ? 'rgba(251,191,36,0.7)' : '#334155', marginTop: 2, lineHeight: 1.4 }}>
                Pilot perspective · ATC radio + ambient sound
              </div>
            </div>

            {/* Radio wave indicator */}
            {isCockpit && (
              <motion.div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16 }}>
                {[4, 8, 6, 10, 5].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [1, 1.8, 1] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1, ease: 'easeInOut' }}
                    style={{ width: 2.5, height: h, borderRadius: 2, background: '#fbbf24', transformOrigin: 'bottom' }}
                  />
                ))}
              </motion.div>
            )}

            {isCockpit && (
              <div style={{ color: '#fbbf24' }}><Check size={14} strokeWidth={3} /></div>
            )}
          </motion.button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: 9, color: '#1e293b', fontWeight: 700, letterSpacing: '0.12em' }}>PASSENGER CABIN</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3,24px) 8px repeat(3,24px)', gap: 3, alignItems: 'center', marginBottom: 5, paddingLeft: 28 }}>
            {['A','B','C',null,'D','E','F'].map((col, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                {col || ''}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: TOTAL_ROWS }, (_, row) => {
              const { text, color } = classLabel(row);
              const isExit = row === 13 || row === 14;
              const isFirstOfClass = row === 0 || row === BUSINESS_ROWS;
              return (
                <div key={row}>
                  {isFirstOfClass && (
                    <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3, marginTop: row === BUSINESS_ROWS ? 8 : 0, paddingLeft: 28, borderTop: row === BUSINESS_ROWS ? '1px dashed rgba(255,255,255,0.06)' : 'none', paddingTop: row === BUSINESS_ROWS ? 8 : 0 }}>
                      {text}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '24px repeat(3,24px) 8px repeat(3,24px)', gap: 3, alignItems: 'center' }}>
                    {/* Row number */}
                    <div style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', textAlign: 'right', paddingRight: 4 }}>
                      {row + 1}
                    </div>
                    {/* Seats + aisle */}
                    {COLS.map((col, ci) => {
                      if (!col) return <div key={ci} style={{ height: 22 }} />;
                      const id = seatId(row, col);
                      const taken = occupied.has(id);
                      const isSel = selected === id;
                      const isHov = hovering === id;
                      const isWindow = col === 'A' || col === 'F';

                      return (
                        <motion.button
                          key={col}
                          onClick={() => handleSeat(id)}
                          onMouseEnter={() => !taken && setHovering(id)}
                          onMouseLeave={() => setHovering(null)}
                          whileTap={!taken ? { scale: 0.88 } : {}}
                          style={{
                            height: row < BUSINESS_ROWS ? 26 : 22,
                            borderRadius: 4,
                            border: `1px solid ${
                              isSel ? '#00b4d8' :
                              taken ? 'rgba(255,255,255,0.07)' :
                              isHov ? 'rgba(0,180,216,0.6)' :
                              isExit ? 'rgba(34,197,94,0.3)' :
                              'rgba(0,180,216,0.25)'
                            }`,
                            background: isSel
                              ? 'rgba(0,180,216,0.88)'
                              : taken
                              ? 'rgba(255,255,255,0.05)'
                              : isHov
                              ? 'rgba(0,180,216,0.2)'
                              : isExit
                              ? 'rgba(34,197,94,0.06)'
                              : isWindow
                              ? 'rgba(0,180,216,0.05)'
                              : 'rgba(0,180,216,0.07)',
                            cursor: taken ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            transition: 'all 0.1s',
                            boxShadow: isSel ? '0 0 8px rgba(0,180,216,0.5)' : 'none',
                          }}
                        >
                          {isSel && <Check size={10} color="#fff" strokeWidth={3} />}
                          {taken && !isSel && (
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          )}
                          {isExit && !taken && !isSel && (
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(34,197,94,0.4)' }} />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tail */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <svg width="40" height="20" viewBox="0 0 40 20">
              <path d="M4 2 H36 L20 18 Z" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                fontSize: 13,
                color: isCockpit ? '#fbbf24' : '#00b4d8',
                fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em',
              }}
            >
              {isCockpit ? '🎙 Cockpit' : `Seat ${selected}`}
            </motion.div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={() => onConfirm(null)}
              style={{ fontSize: 12, color: '#475569', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
            >
              Skip
            </button>
            <motion.button
              onClick={() => selected && onConfirm(selected)}
              whileTap={selected ? { scale: 0.96 } : {}}
              disabled={!selected}
              style={{
                fontSize: 13, fontWeight: 700,
                background: selected ? 'linear-gradient(135deg, #00b4d8, #0096b7)' : 'rgba(255,255,255,0.04)',
                color: selected ? '#fff' : '#334155',
                border: `1px solid ${selected ? '#00b4d8' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10, padding: '8px 20px', cursor: selected ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                boxShadow: selected ? '0 0 16px rgba(0,180,216,0.3)' : 'none',
              }}
            >
              ✈ Board Flight
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
