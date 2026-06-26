import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, ChevronRight, Zap, Clock, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SeatPickerModal } from '../ui/SeatPickerModal';
import { shortFlights, classicPairs, airports } from '../../data/cityPairs';
import { haversineDistance, estimateDuration } from '../../utils/geo';
import { formatDuration } from '../../utils/format';

const SUB_MODES = [
  { id: 'short',   label: 'Short Flights',    sub: '20–35 min · Real short-haul routes', icon: Zap,   color: '#00b4d8' },
  { id: 'classic', label: 'Classic Pomodoro', sub: '25 min · Thematic city pairs',        icon: Clock, color: '#E8A030' },
  { id: 'custom',  label: 'Custom Route',     sub: '40+ airports · Auto duration',        icon: Globe, color: '#8b5cf6' },
];

function PairCard({ pair, onClick, accent = '#00b4d8' }) {
  return (
    <motion.button
      whileHover={{ x: 5, borderColor: `${accent}50` }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onClick(pair)}
      style={{
        width: '100%', padding: '14px 16px',
        background: '#08101E', border: '1px solid #131D30',
        borderRadius: 12, display: 'flex', alignItems: 'center',
        gap: 12, cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Departure */}
      <div style={{ minWidth: 48, textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#DDE3F5', lineHeight: 1 }}>
          {pair.from.code}
        </div>
        <div style={{ fontSize: 10, color: '#3C4566', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 52 }}>
          {pair.from.city}
        </div>
      </div>

      {/* Route line */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accent}60)` }} />
        <span style={{ fontSize: pair.emoji ? 14 : 12, color: pair.emoji ? undefined : accent, lineHeight: 1 }}>
          {pair.emoji || '✈'}
        </span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}60, transparent)` }} />
      </div>

      {/* Arrival */}
      <div style={{ minWidth: 48, textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#DDE3F5', lineHeight: 1 }}>
          {pair.to.code}
        </div>
        <div style={{ fontSize: 10, color: '#3C4566', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 52 }}>
          {pair.to.city}
        </div>
      </div>

      {/* Duration */}
      <div style={{ textAlign: 'right', minWidth: 44, flexShrink: 0 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: accent, lineHeight: 1 }}>
          {formatDuration(pair.duration)}
        </div>
        <div style={{ fontSize: 9, color: '#2A3450', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {pair.description?.split(' ').slice(0, 2).join(' ')}
        </div>
      </div>
    </motion.button>
  );
}

function AirportSearch({ placeholder, value, onChange, onSelect, exclude }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return airports
      .filter((a) => a.code !== exclude?.code)
      .filter((a) =>
        a.city.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, exclude]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#08101E', border: '1px solid #131D30',
        borderRadius: 10, padding: '10px 14px',
        transition: 'border-color 0.15s',
      }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(0,180,216,0.4)'}
        onBlur={(e) => e.currentTarget.style.borderColor = '#131D30'}
      >
        <Search size={14} style={{ color: '#2A3450', flexShrink: 0 }} />
        <input
          type="text"
          placeholder={placeholder}
          value={value ? `${value.city} (${value.code})` : query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => { if (value) setQuery(''); }}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 13, color: '#DDE3F5',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        />
        {value && (
          <button
            onClick={() => { onChange(null); setQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3C4566', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        )}
      </div>
      <AnimatePresence>
        {filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: '#0C0F1C', border: '1px solid #1A1D2E',
              borderRadius: 10, overflow: 'hidden', zIndex: 50,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            {filtered.map((a) => (
              <button
                key={a.code}
                onClick={() => { onSelect(a); setQuery(''); }}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 12,
                  padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid #0F1220', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,180,216,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, color: '#00b4d8', minWidth: 36 }}>{a.code}</span>
                <div>
                  <div style={{ fontSize: 13, color: '#DDE3F5' }}>{a.city}</div>
                  <div style={{ fontSize: 11, color: '#3C4566' }}>{a.country}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CityModeScreen() {
  const { dispatch, state } = useApp();
  const isDark = state.theme === 'dark';
  const [subMode, setSubMode] = useState(null);
  const [fromAirport, setFromAirport] = useState(null);
  const [toAirport, setToAirport] = useState(null);
  const [showSeatPicker, setShowSeatPicker] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const customDuration = useMemo(() => {
    if (!fromAirport || !toAirport) return null;
    const dist = haversineDistance(fromAirport.lat, fromAirport.lon, toAirport.lat, toAirport.lon);
    return estimateDuration(dist);
  }, [fromAirport, toAirport]);

  const openSeatPicker = (payload) => { setPendingPayload(payload); setShowSeatPicker(true); };
  const handleSeatConfirm = (seat) => {
    setShowSeatPicker(false);
    if (pendingPayload) dispatch({ type: 'START_SESSION', payload: { ...pendingPayload, seat } });
    setPendingPayload(null);
  };

  const selectPair = (pair) => openSeatPicker({ mode: 'city', subMode, origin: pair.from, destination: pair.to, duration: pair.duration });
  const startCustom = () => {
    if (!fromAirport || !toAirport || !customDuration) return;
    openSeatPicker({ mode: 'city', subMode: 'custom', origin: fromAirport, destination: toAirport, duration: customDuration });
  };

  const activeSubMode = SUB_MODES.find(s => s.id === subMode);
  const headerBg = isDark ? 'rgba(4,6,14,0.97)' : 'rgba(248,252,255,0.97)';
  const borderCol = isDark ? '#111828' : 'rgba(0,0,0,0.08)';

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence>
        {showSeatPicker && <SeatPickerModal onConfirm={handleSeatConfirm} onClose={() => setShowSeatPicker(false)} />}
      </AnimatePresence>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px',
        background: headerBg,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${borderCol}`,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => { if (subMode) setSubMode(null); else dispatch({ type: 'SET_SCREEN', payload: 'home' }); }}
          style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: `1px solid ${borderCol}`, cursor: 'pointer',
            color: isDark ? '#3C4566' : '#64748b', transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#DDE3F5' : '#0f172a'; e.currentTarget.style.borderColor = isDark ? '#1E2540' : 'rgba(0,0,0,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#3C4566' : '#64748b'; e.currentTarget.style.borderColor = borderCol; }}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeSubMode && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', color: activeSubMode.color,
                padding: '2px 7px', borderRadius: 4,
                background: `${activeSubMode.color}14`, border: `1px solid ${activeSubMode.color}40`,
              }}>
                {subMode === 'short' ? 'SHORT' : subMode === 'classic' ? 'POMO' : 'CUSTOM'}
              </span>
            )}
            <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#DDE3F5' : '#0f172a' }}>
              {activeSubMode ? activeSubMode.label : 'City Route'}
            </span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: isDark ? '#2A3450' : '#94a3b8', marginTop: 2, letterSpacing: '0.08em' }}>
            {subMode ? activeSubMode?.sub : 'SELECT MODE'}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 600, margin: '0 auto', width: '100%', padding: '24px 20px' }}>
        <AnimatePresence mode="wait">

          {/* Sub-mode selection */}
          {!subMode && (
            <motion.div
              key="submodes"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {SUB_MODES.map((m, i) => (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, type: 'spring', damping: 20, stiffness: 120 }}
                  whileHover={{ x: 6 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSubMode(m.id)}
                  style={{
                    width: '100%', padding: '18px 20px',
                    background: '#08101E',
                    border: '1px solid #131D30',
                    borderLeft: `3px solid ${m.color}`,
                    borderRadius: '0 12px 12px 0',
                    display: 'flex', alignItems: 'center', gap: 16,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${m.color}08`}
                  onMouseLeave={e => e.currentTarget.style.background = '#08101E'}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${m.color}14`, border: `1px solid ${m.color}30`,
                  }}>
                    <m.icon size={17} style={{ color: m.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#DDE3F5', marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: '#3C4566' }}>{m.sub}</div>
                  </div>
                  <ChevronRight size={15} style={{ color: '#2A3450', flexShrink: 0 }} />
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Short flights */}
          {subMode === 'short' && (
            <motion.div
              key="short"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#2A3450', textTransform: 'uppercase', marginBottom: 8 }}>
                REAL SHORT-HAUL ROUTES · 20–35 MIN
              </div>
              {shortFlights.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.045, type: 'spring', damping: 22, stiffness: 130 }}
                >
                  <PairCard pair={p} onClick={selectPair} accent="#00b4d8" />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Classic Pomodoro */}
          {subMode === 'classic' && (
            <motion.div
              key="classic"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {/* Info chip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', marginBottom: 8,
                background: 'rgba(232,160,48,0.07)', border: '1px solid rgba(232,160,48,0.2)',
                borderRadius: 10,
              }}>
                <Clock size={13} style={{ color: '#E8A030', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#E8A030' }}>
                  Timer is exactly 25 min. Cities set the atmosphere.
                </span>
              </div>
              {classicPairs.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.045, type: 'spring', damping: 22, stiffness: 130 }}
                >
                  <PairCard pair={p} onClick={selectPair} accent="#E8A030" />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Custom route */}
          {subMode === 'custom' && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#2A3450', textTransform: 'uppercase' }}>
                40+ AIRPORTS · DURATION AUTO-CALCULATED
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em', color: '#3C4566', textTransform: 'uppercase', marginBottom: 8 }}>
                    DEPARTURE ✈
                  </div>
                  <AirportSearch
                    placeholder="Istanbul, IST, Turkey…"
                    value={fromAirport}
                    onChange={setFromAirport}
                    onSelect={setFromAirport}
                    exclude={toAirport}
                  />
                </div>

                {/* Connector line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #1E2540)' }} />
                  <span style={{ fontSize: 11, color: '#2A3450' }}>↓</span>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #1E2540, transparent)' }} />
                </div>

                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em', color: '#3C4566', textTransform: 'uppercase', marginBottom: 8 }}>
                    ARRIVAL 🛬
                  </div>
                  <AirportSearch
                    placeholder="London, LHR, UK…"
                    value={toAirport}
                    onChange={setToAirport}
                    onSelect={setToAirport}
                    exclude={fromAirport}
                  />
                </div>
              </div>

              {/* Route preview */}
              <AnimatePresence>
                {fromAirport && toAirport && customDuration && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    style={{
                      background: '#08101E', border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: 14, padding: '18px 20px',
                    }}
                  >
                    {/* Route display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: '#DDE3F5', lineHeight: 1 }}>
                          {fromAirport.code}
                        </div>
                        <div style={{ fontSize: 11, color: '#3C4566', marginTop: 4 }}>{fromAirport.city}</div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5))' }} />
                        <span style={{ color: '#8b5cf6', fontSize: 14 }}>✈</span>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(139,92,246,0.5), transparent)' }} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: '#DDE3F5', lineHeight: 1 }}>
                          {toAirport.code}
                        </div>
                        <div style={{ fontSize: 11, color: '#3C4566', marginTop: 4 }}>{toAirport.city}</div>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: '#8b5cf6', lineHeight: 1 }}>
                          {formatDuration(customDuration)}
                        </div>
                        <div style={{ fontSize: 10, color: '#3C4566', marginTop: 4, letterSpacing: '0.08em' }}>EST. DURATION</div>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={startCustom}
                      style={{
                        width: '100%', height: 48, borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.1em', color: '#8b5cf6', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.25)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; }}
                    >
                      ✈ &nbsp;BOARD FLIGHT
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
