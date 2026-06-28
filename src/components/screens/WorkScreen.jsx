import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Map, Satellite, BarChart2, Wind, Radio, ChevronDown, ChevronUp, Volume2, VolumeX, Focus, Maximize2, Sun, Moon, MessageCircle, Send, X, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api, openSessionSocket } from '../../services/api';
import { useTimer } from '../../hooks/useTimer';
import { WorkMap } from '../map/WorkMap';
import { FlightTimer } from '../timer/FlightTimer';
import { SettingsModal } from '../ui/SettingsModal';
import { LandingModal } from '../ui/LandingModal';
import { Button } from '../ui/Button';
import { formatAltitude, formatSpeed, formatDuration, formatTime } from '../../utils/format';
import { fetchFlightByIcao, parseState, getDemoFlights } from '../../services/opensky';
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

// ─── Radar Widget ────────────────────────────────────────────────────────────
// Pre-seeded phantom traffic blips (angle°, radius fraction, blip size)
const PHANTOM_BLIPS = [
  { a: 32,  r: 0.52, s: 1.6 },
  { a: 78,  r: 0.73, s: 2.2 },
  { a: 118, r: 0.38, s: 1.4 },
  { a: 165, r: 0.61, s: 1.8 },
  { a: 214, r: 0.44, s: 1.5 },
  { a: 255, r: 0.80, s: 2.0 },
  { a: 298, r: 0.56, s: 1.7 },
  { a: 342, r: 0.29, s: 1.3 },
];

// Degree tick labels around the edge
const TICK_LABELS = [
  { a: 0,   label: '0' },
  { a: 90,  label: '90' },
  { a: 180, label: '180' },
  { a: 270, label: '270' },
];

function RadarWidget({ session, progress = 0 }) {
  const canvasRef = useRef(null);
  const sweepRef  = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = W / 2 - 3;
    let raf;

    // ── Project lat/lon → canvas xy ──────────────────────────────
    const orig = session?.origin;
    const dest = session?.destination;

    let routePoints = null;
    let originPx = null, destPx = null, posPx = null;

    if (orig?.lat != null && dest?.lat != null) {
      const midLat = (orig.lat + dest.lat) / 2;
      const midLon = (orig.lon + dest.lon) / 2;

      // Scale: longest axis fills ~68% of radius
      const dLat = Math.abs(dest.lat - orig.lat);
      const dLon = Math.abs(dest.lon - orig.lon) * Math.cos(midLat * Math.PI / 180);
      const maxDelta = Math.max(dLat, dLon, 1);
      const scale = (R * 0.68) / (maxDelta * 0.5);

      const project = (lat, lon) => ({
        x: cx + (lon - midLon) * Math.cos(midLat * Math.PI / 180) * scale,
        y: cy - (lat - midLat) * scale,
      });

      originPx = project(orig.lat, orig.lon);
      destPx   = project(dest.lat, dest.lon);

      // Interpolate current position (great-circle approximation with arc)
      const steps = 40;
      routePoints = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Simple spherical interpolation (SLERP-ish for short distances)
        const lat = orig.lat + (dest.lat - orig.lat) * t;
        const lon = orig.lon + (dest.lon - orig.lon) * t;
        routePoints.push(project(lat, lon));
      }

      // Current aircraft position along route
      const posLat = orig.lat + (dest.lat - orig.lat) * progress;
      const posLon = orig.lon + (dest.lon - orig.lon) * progress;
      posPx = project(posLat, posLon);
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // ── Clip to circle ─────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // ── Background ─────────────────────────────────────────────
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      bgGrad.addColorStop(0, '#011409');
      bgGrad.addColorStop(1, '#000d04');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── CRT scanlines (subtle horizontal stripes) ───────────────
      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(0, y, W, 1);
      }

      // ── Range rings ───────────────────────────────────────────
      [0.33, 0.55, 0.77, 1.0].forEach((f, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = i === 3 ? 'rgba(0,220,60,0.25)' : 'rgba(0,200,50,0.14)';
        ctx.lineWidth = i === 3 ? 0.8 : 0.5;
        ctx.stroke();
      });

      // ── Cross lines ───────────────────────────────────────────
      ctx.strokeStyle = 'rgba(0,200,50,0.13)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

      // ── Degree tick marks around edge ─────────────────────────
      for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg - 90) * Math.PI / 180;
        const isMajor = deg % 30 === 0;
        const inner = R * (isMajor ? 0.88 : 0.92);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
        ctx.lineTo(cx + Math.cos(rad) * R,     cy + Math.sin(rad) * R);
        ctx.strokeStyle = isMajor ? 'rgba(0,230,60,0.5)' : 'rgba(0,200,50,0.2)';
        ctx.lineWidth = isMajor ? 0.8 : 0.4;
        ctx.stroke();
      }

      // ── Degree number labels ──────────────────────────────────
      ctx.font = `bold 6px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(0,230,60,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      TICK_LABELS.forEach(({ a, label }) => {
        const rad = (a - 90) * Math.PI / 180;
        const lr = R * 0.78;
        ctx.fillText(label, cx + Math.cos(rad) * lr, cy + Math.sin(rad) * lr);
      });

      // ── Route line ────────────────────────────────────────────
      if (routePoints && routePoints.length > 1) {
        // Completed route segment (brighter)
        ctx.beginPath();
        const splitIdx = Math.round(progress * routePoints.length);
        routePoints.slice(0, splitIdx + 1).forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = 'rgba(0,255,65,0.5)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        ctx.stroke();

        // Remaining route (dashed, dimmer)
        ctx.beginPath();
        routePoints.slice(splitIdx).forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = 'rgba(0,180,40,0.25)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Origin marker ─────────────────────────────────────────
      if (originPx) {
        ctx.beginPath();
        ctx.arc(originPx.x, originPx.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,200,50,0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,255,65,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // ── Destination marker (diamond) ──────────────────────────
      if (destPx) {
        const ds = 4;
        ctx.beginPath();
        ctx.moveTo(destPx.x,      destPx.y - ds);
        ctx.lineTo(destPx.x + ds, destPx.y);
        ctx.lineTo(destPx.x,      destPx.y + ds);
        ctx.lineTo(destPx.x - ds, destPx.y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0,255,65,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── ICAO code labels ──────────────────────────────────────
      if (originPx && session?.origin?.code) {
        ctx.font = 'bold 5.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(0,255,65,0.55)';
        ctx.textAlign = 'left';
        ctx.fillText(session.origin.code, originPx.x + 5, originPx.y);
      }
      if (destPx && session?.destination?.code) {
        ctx.font = 'bold 5.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(0,255,65,0.55)';
        ctx.textAlign = 'right';
        ctx.fillText(session.destination.code, destPx.x - 5, destPx.y);
      }

      // ── Phantom traffic blips ─────────────────────────────────
      PHANTOM_BLIPS.forEach(b => {
        const bAngle = b.a * (Math.PI / 180);
        const bx = cx + Math.cos(bAngle) * R * b.r;
        const by = cy + Math.sin(bAngle) * R * b.r;

        let diff = sweepRef.current - b.a;
        if (diff < 0) diff += 360;
        const bright = diff < 100 ? (1 - diff / 100) : 0;

        if (bright > 0.02) {
          const grd = ctx.createRadialGradient(bx, by, 0, bx, by, b.s * 3.5);
          grd.addColorStop(0, `rgba(150,255,150,${bright * 0.85})`);
          grd.addColorStop(0.5, `rgba(0,255,65,${bright * 0.28})`);
          grd.addColorStop(1, 'rgba(0,255,65,0)');
          ctx.beginPath(); ctx.arc(bx, by, b.s * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = grd; ctx.fill();
          ctx.beginPath(); ctx.arc(bx, by, b.s * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,255,220,${Math.min(bright, 1)})`;
          ctx.fill();
        }
      });

      // ── Current aircraft position blip ────────────────────────
      if (posPx) {
        const t = performance.now() / 1000;
        const pulse = 0.55 + 0.45 * Math.sin(t * 3);

        // Outer glow
        const grd = ctx.createRadialGradient(posPx.x, posPx.y, 0, posPx.x, posPx.y, 10);
        grd.addColorStop(0, `rgba(180,255,180,${pulse * 0.8})`);
        grd.addColorStop(0.5, `rgba(0,255,65,${pulse * 0.25})`);
        grd.addColorStop(1, 'rgba(0,255,65,0)');
        ctx.beginPath(); ctx.arc(posPx.x, posPx.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();

        // Core
        ctx.beginPath(); ctx.arc(posPx.x, posPx.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
        ctx.fill();

        // ✈ symbol at position
        ctx.font = '8px sans-serif';
        ctx.fillStyle = `rgba(200,255,200,${pulse * 0.9})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✈', posPx.x + 1, posPx.y - 1);
      }

      // ── Trailing sweep glow ───────────────────────────────────
      const sweepA = sweepRef.current * (Math.PI / 180);
      const TRAIL = Math.PI * 0.52;
      for (let i = 0; i < 52; i++) {
        const frac = i / 52;
        const a = sweepA - TRAIL * (1 - frac);
        const opacity = frac * 0.32;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a - 0.055, a + 0.005);
        ctx.fillStyle = `rgba(0,255,65,${opacity})`;
        ctx.fill();
      }

      // ── Sweep line ────────────────────────────────────────────
      const sweepGrad = ctx.createLinearGradient(
        cx, cy,
        cx + Math.cos(sweepA) * R, cy + Math.sin(sweepA) * R
      );
      sweepGrad.addColorStop(0,   'rgba(0,255,65,0)');
      sweepGrad.addColorStop(0.5, 'rgba(0,255,65,0.55)');
      sweepGrad.addColorStop(1,   'rgba(0,255,65,0.98)');
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepA) * R, cy + Math.sin(sweepA) * R);
      ctx.strokeStyle = sweepGrad;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.restore();

      // ── Outer border ring ─────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,255,65,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // ── Center cross ─────────────────────────────────────────
      ctx.strokeStyle = 'rgba(0,255,65,0.5)';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); ctx.stroke();

      sweepRef.current = (sweepRef.current + 1.2) % 360;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [session, progress]);

  return (
    <div
      className="hidden sm:block absolute pointer-events-none select-none"
      style={{
        bottom: 162, left: 14, zIndex: 830,
        filter: 'drop-shadow(0 0 14px rgba(0,255,65,0.32)) drop-shadow(0 0 4px rgba(0,255,65,0.18))',
      }}
    >
      <canvas
        ref={canvasRef}
        width={116}
        height={116}
        style={{ borderRadius: '50%' }}
      />
      <div style={{
        textAlign: 'center', marginTop: 3,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
        letterSpacing: '0.22em', color: 'rgba(0,255,65,0.4)',
      }}>
        ATC · RADAR
      </div>
    </div>
  );
}

// Generate ghost traffic scattered around a route — always in the current viewport
const GHOST_CARRIERS = ['TK','LH','BA','AF','EK','QR','IB','KL','AZ','U2','FR','W6','SU','PC','VY'];
function generateLocalTraffic(origin, destination, count = 20) {
  const midLat = (origin.lat + destination.lat) / 2;
  const midLon = (origin.lon + destination.lon) / 2;
  const spread = Math.max(Math.abs(destination.lat - origin.lat), Math.abs(destination.lon - origin.lon), 5);
  return Array.from({ length: count }, (_, i) => {
    const phi = (i * 137.508) % 360; // golden-angle spread avoids clustering
    const r   = (0.12 + (i % 6) * 0.13) * spread;
    const lat = midLat + Math.sin(phi * Math.PI / 180) * r;
    const lon = midLon + Math.cos(phi * Math.PI / 180) * r;
    return {
      icao24:   `ghost${i.toString(16).padStart(4, '0')}`,
      callsign: `${GHOST_CARRIERS[i % GHOST_CARRIERS.length]}${100 + i * 47}`,
      lat, lon,
      heading:  Math.round(phi / 22.5) * 22.5,
      baroAlt:  9000 + (i % 5) * 600,
      velocity: 220 + (i % 6) * 12,
      onGround: false,
    };
  });
}

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
  const { isAuthenticated } = useAuth();
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
  const [ghostFlights, setGhostFlights] = useState(() =>
    session?.origin?.lat ? generateLocalTraffic(session.origin, session.destination) : []
  );

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

  // ── saveSession — persists to backend (authenticated) or localStorage (guest) ──
  const saveSession = useCallback(async (st, useElapsed = false) => {
    const finalMin = (isRealistic || useElapsed) ? Math.round(elapsed / 60) : Math.round(totalSeconds / 60);
    const dist = session?.origin && session?.destination
      ? haversineDistance(session.origin.lat, session.origin.lon, session.destination.lat, session.destination.lon)
      : 0;

    if (isAuthenticated) {
      try {
        const created = await api.createSession({
          mode: session?.mode || 'city',
          sub_mode: session?.subMode || 'classic',
          origin_city: session?.origin?.city || '',
          origin_code: session?.origin?.code || '',
          dest_city: session?.destination?.city || '',
          dest_code: session?.destination?.code || '',
          duration_min: finalMin,
          distance_km: dist,
          callsign: session?.callsign || '',
          is_realistic: session?.isRealistic || false,
        });
        await api.completeSession(created.id, {
          duration_min: finalMin,
          distance_km: dist,
          status: st,
        });
      } catch (err) {
        console.error('session save failed:', err);
      }
    } else {
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
    }
  }, [isAuthenticated, isRealistic, elapsed, totalSeconds, session]);
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

  // ── Nearby traffic fetch (OpenSky → route-local fallback) ──
  useEffect(() => {
    if (!session) return;
    const { origin, destination } = session;
    if (!origin?.lat || !destination?.lat) return;

    const pad = 9;
    const lamin = Math.min(origin.lat, destination.lat) - pad;
    const lamax = Math.max(origin.lat, destination.lat) + pad;
    const lomin = Math.min(origin.lon, destination.lon) - pad;
    const lomax = Math.max(origin.lon, destination.lon) + pad;
    const ownIcao = session.flightData?.icao24;

    const fetchTraffic = async () => {
      try {
        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('rate-limited');
        const data = await res.json();
        const flights = (data.states || [])
          .map(parseState)
          .filter(s => s.lat && s.lon && !s.onGround && s.baroAlt > 1000 && s.icao24 !== ownIcao);
        // If API returned real flights, use them; otherwise keep local fallback
        if (flights.length > 0) setGhostFlights(flights.slice(0, 50));
      } catch {
        // Keep the route-local generated traffic already in state
      }
    };

    fetchTraffic();
    const id = setInterval(fetchTraffic, 90_000);
    return () => clearInterval(id);
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
    playLanding();
    stopEngine();
    if (isCockpit) stopCockpitMode(); else stopCabinAmbience();
    stopAtcRadio();
    notify('Landed! 🛬', 'Break time started.');
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
            ghostFlights={ghostFlights}
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
    ? { background: '#08101E', border: '1px solid #131D30' }
    : { background: 'rgba(248,252,255,0.98)', border: '1px solid rgba(0,0,0,0.09)' };
  const monoLabel = { fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.18em', color: '#2A3450', textTransform: 'uppercase' };
  const progressColor = isRealistic ? '#00b4d8' : progress < 0.5 ? '#00b4d8' : progress < 0.8 ? '#48cae4' : '#E8A030';

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
          ghostFlights={ghostFlights}
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

      {/* ── Radar widget ──────────────────────────────────────── */}
      <RadarWidget session={session} progress={isRealistic ? 0.5 : progress} />

      {/* ── Floating top bar ──────────────────────────────────── */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 flex items-center gap-1.5 sm:gap-3 px-3 sm:px-4 border-b"
        style={isDark
          ? { zIndex: 900, background: 'rgba(4,6,14,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: '#111828', paddingTop: 'max(10px, env(safe-area-inset-top, 10px))', paddingBottom: 10 }
          : { zIndex: 900, background: 'rgba(248,252,255,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(0,0,0,0.08)', paddingTop: 'max(10px, env(safe-area-inset-top, 10px))', paddingBottom: 10 }
        }
      >
        <button
          onClick={() => safeNavigate('home')}
          className="text-lg font-bold tracking-tight hover:opacity-70 transition-opacity"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isDark ? '#fff' : '#0f172a' }}
        >
          Flo<span className="text-[#00b4d8]">doro</span>
        </button>

        {/* Mobile compact route — visible only on mobile */}
        <div className="sm:hidden flex items-center gap-1 ml-1">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#00b4d8', lineHeight: 1 }}>{origin?.code}</span>
          <span style={{ color: '#2A3450', fontSize: 10 }}>→</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#E8A030', lineHeight: 1 }}>{destination?.code}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 ml-1 sm:ml-2 min-w-0 flex-shrink text-sm">
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

          <button onClick={() => dispatch({ type: 'SET_THEME', payload: isDark ? 'light' : 'dark' })}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="hidden sm:block p-2 rounded-lg transition-all"
            style={{ background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#fbbf24' : '#0f172a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={() => safeNavigate('stats')} className="hidden sm:block p-2 hover:bg-white/5 rounded-lg text-[#64748b] hover:text-white transition-colors">
            <BarChart2 size={16} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/5 rounded-lg text-[#64748b] hover:text-white transition-colors" style={{ minWidth: 36, minHeight: 36 }}>
            <Settings size={16} />
          </button>
        </div>
      </motion.div>

      {/* ── Bottom HUD ────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 flex flex-col items-center gap-1.5 px-2 sm:px-3" style={{ zIndex: 800, bottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
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
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 34, fontWeight: 700, color: '#00b4d8', lineHeight: 1 }}>
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
                <div className="sm:hidden flex items-center gap-2 w-full justify-center pb-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: '#00b4d8', lineHeight: 1 }}>{origin?.code}</span>
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} style={{ color: '#2A3450', fontSize: 13 }}>✈</motion.span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: '#E8A030', lineHeight: 1 }}>{destination?.code}</span>
                  {(weather.origin || weather.dest) && (
                    <span style={{ fontSize: 10, color: '#3C4566', marginLeft: 6 }}>
                      {weather.origin ? `${weather.origin.emoji} ${weather.origin.temp}°` : ''}
                      {weather.origin && weather.dest ? ' → ' : ''}
                      {weather.dest ? `${weather.dest.emoji} ${weather.dest.temp}°` : ''}
                    </span>
                  )}
                </div>
                {/* Status chip */}
                <div className="flex items-center gap-2 w-full justify-between">
                  <span style={{ ...monoLabel }}>
                    {isRealistic ? 'LIVE TRACK' : isPaused ? 'PAUSED' : 'EN ROUTE'}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: isPaused ? '#E8A030' : '#00b4d8' }}>
                    {isPaused ? '● HOLD' : '● ACT'}
                  </span>
                </div>

                {/* Big timer */}
                <div className="flex flex-col items-center">
                  <span
                    className="timer-display tabular-nums"
                    style={{
                      fontSize: 58, fontWeight: 700, lineHeight: 1,
                      color: isPaused ? '#E8A030' : (isDark ? '#DDE3F5' : '#0f172a'),
                      fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: '-0.02em',
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
                      border: '1px solid rgba(232,160,48,0.4)', borderRadius: 8,
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.12em', color: '#E8A030', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,160,48,0.08)'; e.currentTarget.style.borderColor = 'rgba(232,160,48,0.7)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(232,160,48,0.4)'; }}
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
                        border: '1px solid rgba(232,160,48,0.35)', borderRadius: 8,
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.1em', color: '#E8A030',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,160,48,0.08)'; e.currentTarget.style.borderColor = 'rgba(232,160,48,0.6)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(232,160,48,0.35)'; }}
                    >
                      ▼ LAND
                    </button>
                  </div>
                )}

                {/* Abort — subtle text link */}
                <button
                  onClick={stop}
                  style={{ background: 'none', border: 'none', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', color: '#334155', cursor: 'pointer', transition: 'color 0.15s', padding: '12px 0', minHeight: 44, width: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
                >
                  ✕ ABORT
                </button>
              </div>

              {/* RIGHT — Destination (hidden on mobile) */}
              <div className="hidden sm:block rounded-2xl p-3.5 flex-1 min-w-0" style={{ ...panelStyle, textAlign: 'right' }}>
                <div style={{ ...monoLabel, textAlign: 'right' }} className="mb-2">ARRIVAL</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 34, fontWeight: 700, color: '#E8A030', lineHeight: 1 }}>
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
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: isDark ? '#DDE3F5' : '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {formatTime(isRealistic ? elapsed : (remaining ?? 0))}
              </span>
            </div>
            <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            {isRealistic ? (
              <button onClick={goBreak} style={{ background: 'none', border: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#E8A030', cursor: 'pointer', fontWeight: 700 }}>
                ▼ LAND
              </button>
            ) : (
              <>
                <button onClick={isPaused ? resume : pause} style={{ background: 'none', border: 'none', fontFamily: 'monospace', fontSize: 12, color: isPaused ? '#00b4d8' : '#64748b', cursor: 'pointer', fontWeight: 700 }}>
                  {isPaused ? '▶' : '‖'}
                </button>
                <button onClick={() => setShowLandingModal(true)} style={{ background: 'none', border: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#E8A030', cursor: 'pointer', fontWeight: 700 }}>
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
            borderRadius: '50%', width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.2s',
            color: '#475569',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00b4d8'; e.currentTarget.style.borderColor = 'rgba(0,180,216,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; }}
        >
          {hudOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
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

      {/* ── Live Chat Panel (only when in a live session) ── */}
      {state.liveCode && <LiveChatPanel code={state.liveCode} />}
    </div>
  );
}

// ─── Floating live chat panel (shown when WorkScreen is inside a live session) ─
function LiveChatPanel({ code }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [participants, setParticipants] = useState(0);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const ws = openSessionSocket(code, (msg) => {
      if (msg.type === 'chat' || msg.type === 'join' || msg.type === 'leave' || msg.type === 'focus_ended') {
        setMessages(prev => [...prev, msg]);
        if (msg.type === 'join') setParticipants(n => n + 1);
        if (msg.type === 'leave') setParticipants(n => Math.max(0, n - 1));
        setUnread(n => n + 1);
      }
    });
    ws.onopen = () => {};
    wsRef.current = ws;
    return () => ws.close();
  }, [code]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, messages]);

  const send = () => {
    const content = input.trim();
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content }));
    setInput('');
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute', bottom: 'max(80px, calc(80px + env(safe-area-inset-bottom)))',
          right: 14, zIndex: 950,
          width: 46, height: 46, borderRadius: '50%', border: 'none',
          background: open ? '#0096c7' : 'linear-gradient(135deg, #00b4d8, #0077a8)',
          boxShadow: '0 4px 20px rgba(0,180,216,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff',
        }}
      >
        {open ? <X size={16} /> : <MessageCircle size={17} />}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: -3, right: -3,
            background: '#ef4444', borderRadius: '50%', width: 17, height: 17,
            fontSize: 9, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            style={{
              position: 'absolute',
              bottom: 'max(140px, calc(140px + env(safe-area-inset-bottom)))',
              right: 14, zIndex: 940,
              width: 290,
              background: 'rgba(8,16,30,0.97)',
              border: '1px solid rgba(0,180,216,0.2)',
              borderRadius: 16,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              maxHeight: '55vh',
            }}
          >
            {/* Panel header */}
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid #0d1929',
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,180,216,0.06)',
              flexShrink: 0,
            }}>
              <Users size={12} style={{ color: '#00b4d8' }} />
              <span style={{ fontSize: 11, color: '#00b4d8', fontWeight: 700, flex: 1 }}>
                Live Chat · {code.toUpperCase()}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#2a3a50', fontSize: 11, paddingTop: 20 }}>
                  No messages yet ✈️
                </div>
              )}
              {messages.map((msg, i) => {
                if (msg.type === 'join' || msg.type === 'leave') {
                  return (
                    <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#2a3a50', fontStyle: 'italic' }}>
                      {msg.type === 'join' ? `${msg.display_name} joined` : `${msg.display_name} left`}
                    </div>
                  );
                }
                const isOwn = !!user?.id && msg.user_id === user.id;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    {!isOwn && <span style={{ fontSize: 9, color: '#3a4a60', marginBottom: 1, paddingLeft: 4 }}>{msg.display_name}</span>}
                    <div style={{
                      maxWidth: '85%', padding: '6px 10px',
                      background: isOwn ? 'rgba(0,180,216,0.15)' : '#0C1627',
                      border: `1px solid ${isOwn ? 'rgba(0,180,216,0.2)' : '#1a2740'}`,
                      borderRadius: isOwn ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      fontSize: 12, color: isOwn ? '#e0f0ff' : '#c0d0e0',
                      wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '6px 8px', borderTop: '1px solid #0d1929', display: 'flex', gap: 6, flexShrink: 0 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Quick message…"
                style={{
                  flex: 1, padding: '7px 10px', background: '#0a1220',
                  border: '1px solid #1a2740', borderRadius: 9,
                  color: '#fff', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: 9, border: 'none',
                  background: input.trim() ? '#00b4d8' : '#1a2740',
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  flexShrink: 0,
                }}
              >
                <Send size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
