import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wifi, WifiOff, RefreshCw, Loader, Clock, Radio, X, Search, Navigation } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SeatPickerModal } from '../ui/SeatPickerModal';
import { useOpenSky } from '../../hooks/useOpenSky';
import { LiveFlightMap } from '../map/LiveFlightMap';
import { formatAltitude, formatSpeed } from '../../utils/format';
import { fetchFlightByCallsign } from '../../services/opensky';
import { airports } from '../../data/cityPairs';
import { projectAhead, haversineDistance } from '../../utils/geo';

// Guess departure airport by projecting backward along heading
function guessOrigin(flight) {
  if (!flight?.lat || flight.heading == null) return null;
  const v = flight.velocity || 230;
  const backHeading = (flight.heading + 180) % 360;
  const proj = projectAhead(flight.lat, flight.lon, backHeading, v, 2);
  let best = null, bestD = Infinity;
  for (const ap of airports) {
    const d = haversineDistance(proj.lat, proj.lon, ap.lat, ap.lon);
    if (d < bestD) { bestD = d; best = ap; }
  }
  return bestD < 3000 ? best : null; // ignore if too far
}

// Guess destination airport from position + heading + velocity
function guessDestination(flight) {
  if (!flight?.lat || flight.heading == null) return null;
  const v = flight.velocity || 230;
  // try 2h ahead, fallback to nearest in wide radius
  const proj = projectAhead(flight.lat, flight.lon, flight.heading, v, 2);
  let best = null, bestD = Infinity;
  for (const ap of airports) {
    const d = haversineDistance(proj.lat, proj.lon, ap.lat, ap.lon);
    if (d < bestD) { bestD = d; best = ap; }
  }
  // Only accept if within 1000km of projected pos (sanity check)
  return (best && bestD < 1000) ? best : null;
}

function altColor(alt) {
  if (!alt || alt < 3000) return '#f4a261';
  if (alt < 7000) return '#48cae4';
  return '#00b4d8';
}

export function FlightModeScreen() {
  const { state, dispatch } = useApp();
  const { flights, loading, isDemo, refresh } = useOpenSky();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [customDuration, setCustomDuration] = useState(90);
  const [isRealistic, setIsRealistic] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { theme } = state;

  const destination = useMemo(() => selected ? guessDestination(selected) : null, [selected]);

  const handleSelect = useCallback((flight) => {
    setSelected(flight);
    dispatch({ type: 'SELECT_FLIGHT', payload: flight });
  }, [dispatch]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const f = await fetchFlightByCallsign(search.trim().toUpperCase());
      if (f) { handleSelect(f); setShowSearch(false); setSearch(''); }
      else setSearchError(`"${search.toUpperCase()}" not found`);
    } catch { setSearchError('Connection error.'); }
    finally { setSearching(false); }
  };

  const [showSeatPicker, setShowSeatPicker] = useState(false);
  const pendingStart = useRef(null);

  const buildPayload = (seat) => {
    if (!selected) return null;
    const dest = destination || (() => {
      const v = selected.velocity || 230;
      const proj = projectAhead(selected.lat, selected.lon, selected.heading || 0, v, 2);
      return { city: 'Destination', code: '—', lat: proj.lat, lon: proj.lon };
    })();
    const originAirport = guessOrigin(selected);
    return {
      mode: 'live', isRealistic, seat,
      origin: originAirport
        ? { city: originAirport.city, code: originAirport.code, lat: selected.lat, lon: selected.lon }
        : { city: selected.country || 'Unknown', code: selected.callsign?.slice(0, 3) || '?', lat: selected.lat, lon: selected.lon },
      destination: { city: dest.city, code: dest.code || '—', lat: dest.lat, lon: dest.lon },
      duration: isRealistic ? 999 : customDuration,
      flightData: selected,
    };
  };

  const startFlight = () => {
    if (!selected) return;
    setShowSeatPicker(true);
  };

  const handleSeatConfirm = (seat) => {
    setShowSeatPicker(false);
    const payload = buildPayload(seat);
    if (payload) dispatch({ type: 'START_SESSION', payload });
  };

  const altFt = selected?.baroAlt ? Math.round(selected.baroAlt * 3.28084) : null;
  const color = selected ? altColor(selected.baroAlt) : '#00b4d8';
  const isDark = theme === 'dark';

  return (
    <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: isDark ? '#080d1a' : '#e8f0fa' }}>
      <AnimatePresence>
        {showSeatPicker && (
          <SeatPickerModal onConfirm={handleSeatConfirm} onClose={() => setShowSeatPicker(false)} />
        )}
      </AnimatePresence>

      {/* ── Header Bar ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 relative z-10"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(5,8,20,0.98) 0%, rgba(5,8,20,0.9) 100%)'
            : 'linear-gradient(180deg, rgba(240,248,255,0.98) 0%, rgba(230,240,250,0.9) 100%)',
          borderBottom: isDark ? '1px solid rgba(0,180,216,0.12)' : '1px solid rgba(2,132,199,0.15)',
        }}
      >
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          className="p-2 rounded-lg hover:bg-white/5 text-[#64748b] hover:text-white transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2 mr-2">
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${isDemo ? 'bg-amber-400' : 'bg-green-400'}`}
              style={{ boxShadow: isDemo ? '0 0 8px #fbbf24' : '0 0 8px #4ade80' }}
            />
            {!isDemo && <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />}
          </div>
          <span className={`text-xs font-bold tracking-[0.15em] uppercase ${isDark ? 'text-[#94a3b8]' : 'text-[#475569]'}`}>
            {isDemo ? 'Demo Radar' : 'Live Radar'}
          </span>
        </div>

        {/* Flight count badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
          style={{
            background: isDark ? 'rgba(0,180,216,0.1)' : 'rgba(2,132,199,0.08)',
            border: '1px solid rgba(0,180,216,0.2)',
            color: '#00b4d8',
          }}
        >
          <span className="text-sm">✈</span>
          <span>{flights.length}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search toggle */}
        <button
          onClick={() => setShowSearch(v => !v)}
          className={`p-2 rounded-lg transition-colors ${showSearch ? 'text-[#00b4d8] bg-[#00b4d8]/10' : 'text-[#64748b] hover:text-white hover:bg-white/5'}`}
        >
          <Search size={15} />
        </button>

        <button onClick={refresh} className="p-2 rounded-lg text-[#64748b] hover:text-[#00b4d8] hover:bg-white/5 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Search bar (collapsible) ── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0 z-10"
            style={{ background: isDark ? 'rgba(5,8,20,0.95)' : 'rgba(240,248,255,0.97)', borderBottom: '1px solid rgba(0,180,216,0.1)' }}
          >
            <div className="flex gap-2 px-4 py-3">
              <input
                autoFocus
                type="text"
                placeholder="Search callsign: TK1, LH455, BA92…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,180,216,0.2)',
                  color: isDark ? '#e0e6f0' : '#0f172a',
                }}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00b4d8, #0284c7)' }}
              >
                {searching ? <Loader size={14} className="animate-spin" /> : 'Search'}
              </button>
            </div>
            {searchError && <p className="px-4 pb-2 text-xs text-amber-400">{searchError}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full-screen map ── */}
      <div className="flex-1 relative min-h-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader size={28} className="animate-spin text-[#00b4d8]" />
              <span className="text-sm text-[#64748b]">Scanning radar…</span>
            </div>
          </div>
        ) : (
          <LiveFlightMap flights={flights} selectedFlight={selected} onSelect={handleSelect} theme={theme} />
        )}

        {/* Hint when nothing selected */}
        {!selected && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm pointer-events-none"
            style={{ background: isDark ? 'rgba(5,8,20,0.85)' : 'rgba(240,248,255,0.92)', border: '1px solid rgba(0,180,216,0.2)', color: isDark ? '#94a3b8' : '#475569' }}
          >
            <span>✈</span>
            <span>Select a flight from the map</span>
          </motion.div>
        )}

        {/* Altitude legend */}
        <div
          className="absolute top-16 right-3 rounded-xl p-2.5 text-[10px] space-y-1.5 pointer-events-none"
          style={{ background: isDark ? 'rgba(5,8,20,0.82)' : 'rgba(240,248,255,0.88)', border: '1px solid rgba(0,180,216,0.12)' }}
        >
          {[['#f4a261','< 10k ft'],['#48cae4','10-25k ft'],['#00b4d8','> 25k ft']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c, boxShadow: `0 0 5px ${c}` }} />
              <span style={{ color: isDark ? '#64748b' : '#475569' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Flight Strip (bottom sheet) ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="flight-strip"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}
          >
            <div
              className="rounded-t-2xl"
              style={{
                background: isDark ? 'rgba(7,11,26,0.98)' : 'rgba(248,252,255,0.98)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderTop: `2px solid ${color}30`,
              }}
            >
              {/* Strip header */}
              <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
                {/* Live indicator */}
                <div className="relative flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.4 }} />
                </div>

                {/* Callsign + country */}
                <div className="flex items-baseline gap-2 flex-1 min-w-0">
                  <span className="text-2xl font-black tracking-wider" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                    {selected.callsign || selected.icao24}
                  </span>
                  <span className="text-xs font-medium truncate" style={{ color: isDark ? '#64748b' : '#64748b' }}>
                    {selected.country}
                  </span>
                  {destination && (
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                      <Navigation size={11} className="text-[#00b4d8]" />
                      <span className="text-xs font-semibold" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                        {destination.city} <span style={{ color: '#00b4d8' }}>({destination.code})</span>
                      </span>
                    </div>
                  )}
                </div>

                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-white/5 transition-colors flex-shrink-0">
                  <X size={15} />
                </button>
              </div>

              {/* Data row */}
              <div className="grid grid-cols-4 gap-px px-5 py-3"
                style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                {[
                  { label: 'ALT', value: altFt ? `${(altFt/1000).toFixed(0)}k ft` : '—', sub: altFt ? `${altFt.toLocaleString()} ft` : '' },
                  { label: 'SPD', value: selected.velocity ? `${Math.round(selected.velocity * 3.6)}` : '—', sub: 'km/h' },
                  { label: 'HDG', value: selected.heading ? `${Math.round(selected.heading)}°` : '—', sub: headingLabel(selected.heading) },
                  { label: 'ICAO', value: selected.icao24?.toUpperCase().slice(0,6), sub: '' },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="text-center py-2">
                    <div className="text-[9px] font-bold tracking-[0.15em] mb-1" style={{ color: isDark ? '#334155' : '#94a3b8' }}>{label}</div>
                    <div className="text-lg font-black leading-none" style={{ color: isDark ? '#e0e6f0' : '#0f172a', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                    {sub && <div className="text-[9px] mt-0.5" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{sub}</div>}
                  </div>
                ))}
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                {/* Realistic toggle */}
                <button
                  onClick={() => setIsRealistic(v => !v)}
                  className="flex items-center gap-2.5 flex-1 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: isRealistic
                      ? 'rgba(34,197,94,0.1)'
                      : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: isRealistic ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                    style={{ background: isRealistic ? '#22c55e' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)' }}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                      style={{ transform: isRealistic ? 'translateX(17px)' : 'translateX(2px)' }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: isRealistic ? '#22c55e' : isDark ? '#94a3b8' : '#475569' }}>
                      Realistic Mode
                    </div>
                    <div className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                      {isRealistic ? 'Landing detection active' : 'Countdown mode'}
                    </div>
                  </div>
                </button>

                {/* Duration picker */}
                {!isRealistic && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl flex-shrink-0"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: '1px solid rgba(0,180,216,0.2)',
                    }}
                  >
                    <Clock size={12} className="text-[#00b4d8]" />
                    <select
                      value={customDuration}
                      onChange={e => setCustomDuration(Number(e.target.value))}
                      className="text-sm font-semibold bg-transparent focus:outline-none"
                      style={{ color: isDark ? '#e0e6f0' : '#0f172a' }}
                    >
                      {[25,30,45,60,90,120,180].map(m => (
                        <option key={m} value={m} style={{ background: isDark ? '#0d1226' : '#f8fcff' }}>
                          {m < 60 ? `${m} min` : `${m/60} hr`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="px-5 py-4">
                <button
                  onClick={startFlight}
                  className="w-full py-4 rounded-2xl font-black text-base text-white tracking-wide transition-all active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${color} 0%, #0284c7 100%)`,
                    boxShadow: `0 0 28px ${color}40, 0 4px 20px rgba(0,0,0,0.35)`,
                    letterSpacing: '0.05em',
                  }}
                >
                  ✈ &nbsp;BOARD FLIGHT
                  {!isRealistic && (
                    <span className="ml-2 text-sm font-normal opacity-80">
                      — {customDuration < 60 ? `${customDuration} min` : `${customDuration/60} hr`}
                    </span>
                  )}
                  {destination && (
                    <span className="ml-2 text-sm font-normal opacity-70">→ {destination.code}</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function headingLabel(h) {
  if (h == null) return '';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(h / 45) % 8];
}
