import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Map, Satellite, BarChart2, Wind, Radio, ChevronDown, ChevronUp, Volume2, VolumeX, Focus, Maximize2, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { WorkMap } from '../map/WorkMap';
import { FlightTimer } from '../timer/FlightTimer';
import { SettingsModal } from '../ui/SettingsModal';
import { LandingModal } from '../ui/LandingModal';
import { Button } from '../ui/Button';
import { formatAltitude, formatSpeed, formatDuration, formatTime } from '../../utils/format';
import { fetchFlightByIcao } from '../../services/opensky';
import { saveSession as saveLocalSession } from '../../services/sessions';
import { haversineDistance } from '../../utils/geo';
import { startEngine, stopEngine, setEngineVolume } from '../../services/ambient';
import {
  playChime, playLanding,
  startCabinAmbience, stopCabinAmbience,
  startAtcRadio, stopAtcRadio,
  startCockpitMode, stopCockpitMode,
  muteAll, unmuteAll, isGloballyMuted,
} from '../../services/sounds';
import { requestNotifyPermission, notify } from '../../utils/notifications';
import { fetchWeather } from '../../services/weather';
import { getAirlineFromCallsign } from '../../data/airlineThemes';
import { startAtcChatter, stopAtcChatter } from '../../services/atc';
import { approxLocalTime } from '../../utils/solar';

function deadReckon(pos, velocityMs, headingDeg, dtSeconds) {
  if (!pos || !velocityMs || !headingDeg) return pos;
  const R = 6371000;
  const hRad = (headingDeg * Math.PI) / 180;
  const latRad = (pos.lat * Math.PI) / 180;
  const dlat = (velocityMs * Math.cos(hRad) * dtSeconds) / R;
  const dlon = (velocityMs * Math.sin(hRad) * dtSeconds) / (R * Math.cos(latRad));
  return {
    lat: pos.lat + dlat * (180 / Math.PI),
    lon: pos.lon + dlon * (180 / Math.PI),
    heading: headingDeg,
  };
}

export function WorkScreen() {
  const { state, dispatch } = useApp();
  const { session, settings, selectedFlight } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [mapView, setMapView] = useState(session?.mode === 'live' ? 'realtime' : settings.mapView);
  const [showLandingModal, setShowLandingModal] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null); // pending nav destination
  const [weather, setWeather] = useState({ origin: null, dest: null });
  const [atcOn, setAtcOn] = useState(false);
  const [hudOpen, setHudOpen] = useState(true);
  const [soundMuted, setSoundMuted] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const cursorTimer = useRef(null);
  const soundEnabled = settings?.soundEnabled !== false; // default on

  const [displayPos, setDisplayPos] = useState(null);
  const lastApiPos = useRef(null);
  const lastApiTime = useRef(null);
  const drRef = useRef(null);
  const landingDetected = useRef(false);
  const soundStarted = useRef(false);
  const saveSessionRef = useRef(null); // populated after useTimer; avoids TDZ in handleComplete

  const airline = session?.flightData?.callsign
    ? getAirlineFromCallsign(session.flightData.callsign)
    : null;

  const isCockpit = session?.seat === 'KOKPIT';

  // ── handleComplete — uses ref so it can call saveSession without TDZ ──
  const handleComplete = useCallback(() => {
    playLanding();
    notify('Flight Complete! ✈', `${session?.origin?.city} → ${session?.destination?.city} — Break time!`);
    stopEngine();
    if (isCockpit) stopCockpitMode(); else stopCabinAmbience();
    stopAtcRadio();
    if (session?.flightPlanLegId) dispatch({ type: 'FLIGHT_PLAN_COMPLETE_LEG', payload: session.flightPlanLegId });
    if (settings.autoStartBreak) dispatch({ type: 'GO_BREAK' });
    saveSessionRef.current?.('completed');
  }, [settings.autoStartBreak, dispatch, session, isCockpit]); // eslint-disable-line

  const { elapsed, remaining, progress, status, pause, resume, totalSeconds, isRealistic } =
    useTimer(handleComplete);

  // ── saveSession — persists to localStorage ──────────────────────────
  const saveSession = useCallback((st, useElapsed = false) => {
    const finalMin = (isRealistic || useElapsed) ? Math.round(elapsed / 60) : Math.round(totalSeconds / 60);
    const dist = session?.origin && session?.destination
      ? haversineDistance(session.origin.lat, session.origin.lon, session.destination.lat, session.destination.lon)
      : 0;
    saveLocalSession({
      status: st,
      duration_min: finalMin,
      distance_km: dist,
      mode: session?.mode || 'city',
      origin_code: session?.origin?.code || '',
      dest_code: session?.destination?.code || '',
      origin_city: session?.origin?.city || '',
      dest_city: session?.destination?.city || '',
    });
  }, [isRealistic, elapsed, totalSeconds, session]);
  saveSessionRef.current = saveSession; // always current, no closure staleness

  // ── Sound on mount ──────────────────────────────────────────────
  useEffect(() => {
    requestNotifyPermission();
    if (soundEnabled && !soundStarted.current) {
      soundStarted.current = true;
      playChime();
      setTimeout(() => {
        startEngine(0.10);
        if (isCockpit) startCockpitMode(); else startCabinAmbience(0.10);
      }, 1000);
    }
    return () => {
      stopEngine();
      if (isCockpit) stopCockpitMode(); else stopCabinAmbience();
      stopAtcRadio();
      soundStarted.current = false;
    };
  }, []); // eslint-disable-line

  const handleToggleAtc = useCallback(() => {
    if (atcOn) { stopAtcRadio(); setAtcOn(false); }
    else { startAtcRadio(0.28); setAtcOn(true); }
  }, [atcOn]);

  const handleToggleMute = useCallback(() => {
    if (soundMuted) { unmuteAll(); setEngineVolume(0.10); setSoundMuted(false); }
    else { muteAll(); setEngineVolume(0); setSoundMuted(true); }
  }, [soundMuted]);

  // ── Weather fetch ──
  useEffect(() => {
    if (!session) return;
    const { origin, destination } = session;
    Promise.all([
      origin?.lat != null ? fetchWeather(origin.lat, origin.lon).catch(() => null) : Promise.resolve(null),
      destination?.lat != null ? fetchWeather(destination.lat, destination.lon).catch(() => null) : Promise.resolve(null),
    ]).then(([orig, dest]) => setWeather({ origin: orig, dest }));
  }, []); // eslint-disable-line


  // ── API position fetch every 30-45s ──
  useEffect(() => {
    if (session?.mode !== 'live' || !session.flightData?.icao24) return;

    const fetchPos = async () => {
      try {
        const f = await fetchFlightByIcao(session.flightData.icao24);
        if (!f) return;
        const pos = { lat: f.lat, lon: f.lon, heading: f.heading, velocity: f.velocity };
        lastApiPos.current = pos;
        lastApiTime.current = Date.now();
        setDisplayPos(pos);
        dispatch({ type: 'UPDATE_FLIGHT_POS', payload: pos });

        if (isRealistic && f.onGround && !landingDetected.current && status === 'running') {
          landingDetected.current = true;
          playLanding();
          pause();
          setShowLandingModal(true);
        }
      } catch {}
    };

    fetchPos();
    const id = setInterval(fetchPos, isRealistic ? 30000 : 45000);
    return () => clearInterval(id);
  }, [session?.mode, session?.flightData?.icao24, isRealistic, status, pause, dispatch]);

  // ── Dead reckoning every 2s — halves re-render frequency vs 1s ─────
  useEffect(() => {
    if (session?.mode !== 'live') return;
    drRef.current = setInterval(() => {
      if (!lastApiPos.current || !lastApiTime.current) return;
      const dt = (Date.now() - lastApiTime.current) / 1000;
      const v = lastApiPos.current.velocity || selectedFlight?.velocity || 250;
      const h = lastApiPos.current.heading || selectedFlight?.heading || 0;
      const pos = deadReckon(lastApiPos.current, v, h, dt);
      if (pos) setDisplayPos(pos);
    }, 2000);
    return () => clearInterval(drRef.current);
  }, [session?.mode, selectedFlight]);

  // ── Init position (live mode only) ──
  useEffect(() => {
    if (session?.mode !== 'live') return;
    if (!displayPos && session?.flightData?.lat) {
      const f = session.flightData;
      const pos = { lat: f.lat, lon: f.lon, heading: f.heading, velocity: f.velocity };
      lastApiPos.current = pos;
      lastApiTime.current = Date.now();
      setDisplayPos(pos);
    }
  }, []); // eslint-disable-line

  const handleLandingBreak = () => {
    setShowLandingModal(false);
    notify('Landed! 🛬', 'Break time started.');
    // Realistic + auto-detected landing = fully completed; manual early land = cancelled (won't count in stats)
    const isActualLanding = isRealistic && landingDetected.current;
    saveSession(isActualLanding ? 'completed' : 'cancelled', !isActualLanding);
    dispatch({ type: 'GO_BREAK' });
  };
  const handleStayOnboard = () => { setShowLandingModal(false); landingDetected.current = false; resume(); };
  // Ask before leaving WorkScreen — keeps flight session alive until confirmed
  const safeNavigate = (screen) => setLeaveTarget(screen);

  const confirmLeave = () => {
    stopEngine();
    if (isCockpit) stopCockpitMode(); else stopCabinAmbience();
    stopAtcRadio();
    saveSession('cancelled');
    dispatch({ type: 'RESET' });
    if (leaveTarget && leaveTarget !== 'home') dispatch({ type: 'SET_SCREEN', payload: leaveTarget });
    setLeaveTarget(null);
  };

  const stop = () => safeNavigate('home');

  const goBreak = () => {
    playLanding();
    stopEngine();
    if (isCockpit) stopCockpitMode(); else stopCabinAmbience();
    stopAtcRadio();
    notify('Landed! 🛬', 'Break time started.');
    saveSession('completed');
    dispatch({ type: 'GO_BREAK' });
  };

  // ── Keyboard shortcuts (after useTimer + goBreak) ───────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (status === 'paused') resume(); else pause();
          break;
        case 'l': case 'L':
          if (isRealistic) goBreak(); else setShowLandingModal(true);
          break;
        case 'f': case 'F':
          setHudOpen(v => !v);
          break;
        case 'm': case 'M':
          handleToggleMute();
          break;
        case 'a': case 'A':
          setAmbientMode(v => !v);
          break;
        case 't': case 'T':
          dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' });
          break;
        case 'Escape':
          setAmbientMode(false);
          setLeaveTarget(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, resume, pause, isRealistic, handleToggleMute]); // eslint-disable-line

  // ── Cursor auto-hide in ambient mode ──────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!ambientMode) { setShowCursor(true); clearTimeout(cursorTimer.current); return; }
    const onMove = () => {
      setShowCursor(true);
      clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setShowCursor(false), 2500);
    };
    window.addEventListener('mousemove', onMove);
    cursorTimer.current = setTimeout(() => setShowCursor(false), 2500);
    return () => { window.removeEventListener('mousemove', onMove); clearTimeout(cursorTimer.current); setShowCursor(true); };
  }, [ambientMode]);

  if (!session) return null;
  const { origin, destination, flightData } = session;
  const isPaused = status === 'paused';
  const isDark = state.theme !== 'light';
  const destLocalTime = destination?.lon != null ? approxLocalTime(destination.lon) : null;
  const origLocalTime = origin?.lon != null ? approxLocalTime(origin.lon) : null;

  // ── Ambient wallpaper mode ──────────────────────────────────────────
  if (ambientMode) {
    return (
      <div
        className="h-screen relative overflow-hidden"
        style={{ cursor: showCursor ? 'default' : 'none' }}
        onClick={() => setAmbientMode(false)}
      >
        <div className="absolute inset-0" style={{ isolation: 'isolate' }}>
          <WorkMap
            session={session}
            progress={isRealistic ? 0.5 : progress}
            livePos={session?.mode === 'live' ? displayPos : null}
            mapView={session?.mode === 'live' ? mapView : 'animated'}
            theme={state.theme}
            airlineColor={airline?.color}
          />
        </div>
        <motion.div
          animate={{ opacity: showCursor ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'absolute', bottom: 18, right: 18, zIndex: 800,
            pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
          }}
        >
          <div style={{
            fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.7)',
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}>
            {formatTime(isRealistic ? elapsed : (remaining ?? 0))}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)' }}>
            {origin?.code} — {destination?.code} · CLICK TO EXIT
          </div>
        </motion.div>
        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // helper: panel glass style
  const panelStyle = isDark
    ? { background: 'rgba(4,7,18,0.88)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }
    : { background: 'rgba(248,252,255,0.93)', border: '1px solid rgba(0,0,0,0.09)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' };
  const monoLabel = { fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.16em', color: '#334155' };
  const progressColor = isRealistic ? '#00b4d8' : progress < 0.5 ? '#00b4d8' : progress < 0.8 ? '#48cae4' : '#f4a261';

  return (
    <div className="h-screen relative overflow-hidden">
      {/* ── Full-screen map ────────────────────────────────────── */}
      {/* isolation:isolate confines Leaflet's internal z-indices (up to 700) within this div */}
      <div className="absolute inset-0" style={{ isolation: 'isolate' }}>
        <WorkMap
          session={session}
          progress={isRealistic ? 0.5 : progress}
          livePos={session?.mode === 'live' ? displayPos : null}
          mapView={session?.mode === 'live' ? mapView : 'animated'}
          theme={state.theme}
          airlineColor={airline?.color}
        />
        {isPaused && !showLandingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">⏸</div>
              <p className="text-white font-semibold text-lg">Paused</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Floating top bar ──────────────────────────────────── */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 flex items-center gap-1.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b"
        style={isDark
          ? { zIndex: 900, background: 'rgba(4,7,18,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.05)' }
          : { zIndex: 900, background: 'rgba(248,252,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(0,0,0,0.08)' }
        }
      >
        <button
          onClick={() => safeNavigate('home')}
          className="text-lg font-bold tracking-tight hover:opacity-70 transition-opacity"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isDark ? '#fff' : '#0f172a' }}
        >
          Flo<span className="text-[#00b4d8]">doro</span>
        </button>

        <div className="flex items-center gap-1.5 ml-1 sm:ml-2 min-w-0 flex-shrink text-sm">
          {/* Mobile: just ICAO codes */}
          <span className="sm:hidden font-mono text-xs font-bold" style={{ color: '#00b4d8' }}>{origin?.code}</span>
          <span className="sm:hidden text-[#475569] text-xs">→</span>
          <span className="sm:hidden font-mono text-xs font-bold" style={{ color: '#f4a261' }}>{destination?.code}</span>
          {/* Desktop: full city names with animated plane */}
          <span className="hidden sm:inline font-medium truncate" style={{ color: isDark ? '#e0e6f0' : '#334155' }}>{origin?.city}</span>
          <motion.span
            className="hidden sm:inline text-[#00b4d8] text-base"
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >✈</motion.span>
          <span className="hidden sm:inline font-medium truncate" style={{ color: isDark ? '#e0e6f0' : '#334155' }}>{destination?.city}</span>
        </div>

        {/* Cockpit badge */}
        {isCockpit && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border"
            style={{ background: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.35)', color: '#fbbf24', letterSpacing: '0.06em' }}
          >
            🎙 COCKPIT
          </motion.span>
        )}

        {/* Airline badge */}
        {!isCockpit && airline && airline.name !== 'Flodoro Air' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border"
            style={{ background: `${airline.color}20`, borderColor: `${airline.color}40`, color: airline.color }}
          >
            {airline.flag} {airline.name}
          </motion.span>
        )}

        {isRealistic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 font-medium animate-pulse">
            LIVE
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setMapView((v) => (v === 'animated' ? 'realtime' : 'animated'))}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mapView === 'realtime'
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'glass border border-white/10 text-[#64748b] hover:text-white'
            }`}
          >
            {mapView === 'realtime' ? <><Satellite size={12} /> Live</> : <><Map size={12} /> Simulated</>}
          </button>
          {/* Cockpit audio toggle */}
          <motion.button
            onClick={handleToggleAtc}
            whileTap={{ scale: 0.9 }}
            title="Cockpit Audio"
            className="relative p-2 rounded-lg transition-all"
            style={{
              background: atcOn ? 'rgba(0,180,216,0.15)' : 'transparent',
              border: atcOn ? '1px solid rgba(0,180,216,0.35)' : '1px solid transparent',
            }}
          >
            <Radio size={16} style={{ color: atcOn ? '#00b4d8' : '#64748b' }} />
            {atcOn && (
              <motion.span
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#00b4d8', display: 'block',
                }}
              />
            )}
          </motion.button>
          {/* Ambient wallpaper mode */}
          <button
            onClick={() => setAmbientMode(true)}
            title="Ambient mode (A)"
            className="hidden sm:block p-2 rounded-lg transition-all"
            style={{ background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <Maximize2 size={15} />
          </button>

          {/* Focus mode toggle */}
          <button
            onClick={() => setHudOpen(v => !v)}
            title={hudOpen ? 'Enter focus mode' : 'Show info'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={!hudOpen
              ? { background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.35)', color: '#00b4d8' }
              : { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }
            }
            onMouseEnter={e => { if (hudOpen) { e.currentTarget.style.borderColor = 'rgba(0,180,216,0.3)'; e.currentTarget.style.color = '#00b4d8'; } }}
            onMouseLeave={e => { if (hudOpen) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#64748b'; } }}
          >
            <Focus size={13} />
            <span className="hidden sm:inline" style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.08em' }}>
              FOCUS
            </span>
          </button>

          {/* Sound mute toggle */}
          <button
            onClick={handleToggleMute}
            title={soundMuted ? 'Unmute' : 'Mute'}
            className="p-2 rounded-lg transition-all"
            style={soundMuted
              ? { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }
              : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }
            }
            onMouseEnter={e => { if (!soundMuted) { e.currentTarget.style.color = '#fff'; } }}
            onMouseLeave={e => { if (!soundMuted) { e.currentTarget.style.color = '#64748b'; } }}
          >
            {soundMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => dispatch({ type: 'SET_THEME', payload: isDark ? 'light' : 'dark' })}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="p-2 rounded-lg transition-all"
            style={{ background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#fbbf24' : '#0f172a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button onClick={() => safeNavigate('stats')} className="hidden sm:block p-2 hover:bg-white/5 rounded-lg text-[#64748b] hover:text-white transition-colors">
            <BarChart2 size={16} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/5 rounded-lg text-[#64748b] hover:text-white transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </motion.div>

      {/* ── Bottom HUD ────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1.5 px-2 sm:px-3" style={{ zIndex: 800 }}>
        <AnimatePresence>
          {hudOpen && (
            <motion.div
              key="hud"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-full flex gap-2"
              style={{ maxWidth: 700 }}
            >
              {/* LEFT — Origin (hidden on mobile) */}
              <div className="hidden sm:block rounded-2xl p-3.5 flex-1 min-w-0" style={panelStyle}>
                <div style={monoLabel} className="mb-2">DEPARTURE</div>
                <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#00b4d8', lineHeight: 1 }}>
                  {origin?.code || '???'}
                </div>
                <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#475569', marginTop: 3 }} className="truncate">
                  {origin?.city}
                </div>
                {origLocalTime && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 5 }}>
                    {origLocalTime.isNight ? '🌙' : '☀️'} {origLocalTime.time}
                  </div>
                )}
                {weather.origin && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                    {weather.origin.emoji} {weather.origin.temp}°C · {weather.origin.wind} km/s
                  </div>
                )}
                {session.mode === 'live' && flightData && (
                  <>
                    <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, margin: '8px 0' }} />
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#48cae4', fontWeight: 700 }}>
                      {flightData.callsign || flightData.icao24}
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                      {formatAltitude(flightData.baroAlt)} · {formatSpeed(flightData.velocity)}
                    </div>
                  </>
                )}
              </div>

              {/* CENTER — Timer + controls */}
              <div className="flex-1 rounded-2xl p-3.5 flex flex-col items-center gap-2.5 min-w-0" style={panelStyle}>
                {/* Mobile-only compact route */}
                <div className="sm:hidden flex items-center gap-3 w-full justify-center pb-1 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: '#00b4d8' }}>{origin?.code}</span>
                  <span style={{ color: '#475569', fontSize: 12 }}>✈</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: '#f4a261' }}>{destination?.code}</span>
                  {weather.origin && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{weather.origin.emoji} {weather.origin.temp}°C</span>}
                  {weather.dest && <span style={{ fontSize: 10, color: '#64748b' }}>→ {weather.dest.emoji} {weather.dest.temp}°C</span>}
                </div>
                {/* Status chip */}
                <div className="flex items-center gap-2 w-full justify-between">
                  <span style={{ ...monoLabel }}>
                    {isRealistic ? 'LIVE TRACK' : isPaused ? 'PAUSED' : 'EN ROUTE'}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: isPaused ? '#f59e0b' : '#22c55e' }}>
                    {isPaused ? '● HOLD' : '● ACT'}
                  </span>
                </div>

                {/* Big timer */}
                <div className="flex flex-col items-center">
                  <span
                    className="timer-display tabular-nums"
                    style={{
                      fontSize: 36, fontWeight: 800, lineHeight: 1,
                      color: isPaused ? '#f59e0b' : (isDark ? '#ffffff' : '#0f172a'),
                      fontFamily: 'monospace',
                      textShadow: isPaused ? '0 0 20px rgba(245,158,11,0.4)' : '0 0 20px rgba(0,180,216,0.3)',
                    }}
                  >
                    {formatTime(isRealistic ? elapsed : (remaining ?? 0))}
                  </span>
                  <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    {isRealistic ? 'elapsed' : 'remaining'}
                  </span>
                </div>

                {/* Progress bar (non-realistic only) */}
                {!isRealistic && (
                  <div style={{ width: '100%' }}>
                    <div style={{ height: 3, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      <motion.div
                        style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, #00b4d8, ${progressColor})` }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </div>
                    <div style={{ fontSize: 9, color: '#475569', marginTop: 3, fontFamily: 'monospace', textAlign: 'center' }}>
                      {Math.round(progress * 100)}% · {formatDuration(session.duration)} total
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {isRealistic ? (
                  <button
                    onClick={goBreak}
                    style={{
                      width: '100%', height: 44, background: 'transparent',
                      border: '1px solid rgba(251,191,36,0.4)', borderRadius: 8,
                      fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.12em', color: '#fbbf24', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.7)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.4)'; }}
                  >
                    ▼ LAND &amp; BREAK
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                    <button
                      onClick={isPaused ? resume : pause}
                      style={{
                        flex: 1, height: 44, background: 'transparent',
                        border: `1px solid ${isPaused ? 'rgba(0,180,216,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        borderRadius: 8, fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.1em', color: isPaused ? '#00b4d8' : '#64748b',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,180,216,0.6)'; e.currentTarget.style.color = '#00b4d8'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = isPaused ? 'rgba(0,180,216,0.5)' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = isPaused ? '#00b4d8' : '#64748b'; }}
                    >
                      {isPaused ? '▶ RESUME' : '‖ PAUSE'}
                    </button>
                    <button
                      onClick={() => setShowLandingModal(true)}
                      style={{
                        flex: 1, height: 44, background: 'transparent',
                        border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8,
                        fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.1em', color: '#22c55e',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.07)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.35)'; }}
                    >
                      ▼ LAND
                    </button>
                  </div>
                )}

                {/* Abort — subtle text link */}
                <button
                  onClick={stop}
                  style={{ background: 'none', border: 'none', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', color: '#334155', cursor: 'pointer', transition: 'color 0.15s', padding: '6px 0', minHeight: 32 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
                >
                  ✕ ABORT
                </button>
              </div>

              {/* RIGHT — Destination (hidden on mobile) */}
              <div className="hidden sm:block rounded-2xl p-3.5 flex-1 min-w-0" style={{ ...panelStyle, textAlign: 'right' }}>
                <div style={{ ...monoLabel, textAlign: 'right' }} className="mb-2">ARRIVAL</div>
                <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#f4a261', lineHeight: 1 }}>
                  {destination?.code || '???'}
                </div>
                <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#475569', marginTop: 3 }} className="truncate">
                  {destination?.city}
                </div>
                {destLocalTime && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 5 }}>
                    {destLocalTime.isNight ? '🌙' : '☀️'} {destLocalTime.time}
                  </div>
                )}
                {weather.dest && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                    {weather.dest.emoji} {weather.dest.temp}°C · {weather.dest.wind} km/s
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, margin: '8px 0' }} />
                {!isRealistic && (
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Break: {formatDuration(settings.breakDuration)}
                  </div>
                )}
                {session.seat && (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: isDark ? '#94a3b8' : '#475569', marginTop: 4 }}>
                    {session.seat === 'KOKPIT' ? '🎙 COCKPIT' : `💺 ${session.seat}`}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed mini-pill */}
        {!hudOpen && (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 sm:gap-4 rounded-full px-4 sm:px-5 py-3"
            style={{
              background: isDark ? 'rgba(4,7,18,0.9)' : 'rgba(248,252,255,0.94)',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            }}
          >
            {/* Route */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', color: '#475569', lineHeight: 1 }}>
                {origin?.code} <span style={{ color: '#334155' }}>→</span> {destination?.code}
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: isDark ? '#fff' : '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {formatTime(isRealistic ? elapsed : (remaining ?? 0))}
              </span>
            </div>
            <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            {isRealistic ? (
              <button onClick={goBreak} style={{ background: 'none', border: 'none', fontFamily: 'monospace', fontSize: 11, color: '#fbbf24', cursor: 'pointer', fontWeight: 700 }}>
                ▼ LAND
              </button>
            ) : (
              <>
                <button onClick={isPaused ? resume : pause} style={{ background: 'none', border: 'none', fontFamily: 'monospace', fontSize: 12, color: isPaused ? '#00b4d8' : '#64748b', cursor: 'pointer', fontWeight: 700 }}>
                  {isPaused ? '▶' : '‖'}
                </button>
                <button onClick={() => setShowLandingModal(true)} style={{ background: 'none', border: 'none', fontFamily: 'monospace', fontSize: 11, color: '#22c55e', cursor: 'pointer', fontWeight: 700 }}>
                  ▼ LAND
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setHudOpen(v => !v)}
          style={{
            background: isDark ? 'rgba(4,7,18,0.7)' : 'rgba(248,252,255,0.85)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            borderRadius: '50%', width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.2s',
            color: '#475569',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00b4d8'; e.currentTarget.style.borderColor = 'rgba(0,180,216,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; }}
        >
          {hudOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <LandingModal open={showLandingModal} elapsed={elapsed} onBreak={handleLandingBreak} onStay={handleStayOnboard} />

      {/* Leave confirmation */}
      {leaveTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: isDark ? 'rgba(4,7,18,0.98)' : 'rgba(248,252,255,0.98)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 10, padding: '28px 32px', maxWidth: 340, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.18em', color: '#f87171', marginBottom: 10 }}>
              ⚠ WARNING
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a', marginBottom: 8, lineHeight: 1.4 }}>
              End flight?
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
              The {origin?.city} → {destination?.city} flight will be cancelled. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setLeaveTarget(null)}
                style={{
                  flex: 1, height: 48, background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.08em', color: '#64748b',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#64748b'; }}
              >
                GO BACK
              </button>
              <button
                onClick={confirmLeave}
                style={{
                  flex: 1, height: 48, background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.08em', color: '#f87171',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.18)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.35)'; }}
              >
                TERMINATE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, accent, isDark, sub }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-[#64748b] flex-shrink-0">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-medium truncate block max-w-[140px] ${accent ? 'text-[#00b4d8]' : ''}`}
          style={{ color: accent ? undefined : (isDark ? '#e0e6f0' : '#334155') }}>
          {value}
        </span>
        {sub && <span className="text-[10px] text-[#475569]">{sub}</span>}
      </div>
    </div>
  );
}

function WeatherRow({ label, code, w, isDark, type }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#64748b' }}>{type} · {code}</span>
        <span className="text-xs font-medium" style={{ color: isDark ? '#94a3b8' : '#334155' }}>{label}</span>
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="text-base leading-none">{w.emoji}</span>
        <div>
          <div className="text-xs font-bold" style={{ color: isDark ? '#e0e6f0' : '#0f172a' }}>{w.temp}°C</div>
          <div className="text-[10px]" style={{ color: isDark ? '#475569' : '#64748b' }}>{w.wind} km/s</div>
        </div>
      </div>
    </div>
  );
}
