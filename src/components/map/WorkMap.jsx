import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { greatCirclePoints, interpolatePosition, bearing, getBounds, projectAhead } from '../../utils/geo';
import { DayNightLayer } from './DayNightLayer';

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};
const ATTR = '&copy; OpenStreetMap &copy; CARTO';
const TRAIL_MAX = 40;

const NEON = {
  dark:  { plane: '#ffffff', glow: 'rgba(255,255,255,0.9)',  ring: 'rgba(255,255,255,0.2)',  route: '#00e5ff', routeDim: '#00b4d8', origin: '#48cae4' },
  light: { plane: '#f4a261', glow: 'rgba(244,162,97,0.85)', ring: 'rgba(244,162,97,0.3)',   route: '#0041c2', routeDim: '#0055e9', origin: '#0041c2' },
};

function createPlaneIcon(deg, theme = 'dark') {
  const c = NEON[theme] || NEON.dark;
  return L.divIcon({
    html: `<div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:-8px;border-radius:50%;border:1.5px solid ${c.ring};animation:ping-slow 2.5s ease-out infinite;pointer-events:none;"></div>
      <div style="transform:rotate(${deg}deg);width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="${c.plane}"
          style="filter:drop-shadow(0 0 8px ${c.glow}) drop-shadow(0 0 4px ${c.glow}) drop-shadow(0 0 14px ${c.glow})">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
    </div>`,
    className: 'plane-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function createOriginIcon(theme = 'dark') {
  const color = NEON[theme]?.origin || '#48cae4';
  return L.divIcon({
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 0 3px ${color}33,0 0 10px ${color}99;"></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function createDestIcon() {
  return L.divIcon({
    html: `<div style="position:relative;width:18px;height:18px;">
      <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid #f4a261;opacity:0.4;animation:ping-slow 2s ease-out infinite;"></div>
      <div style="position:absolute;inset:-14px;border-radius:50%;border:1.5px solid #f4a261;opacity:0.2;animation:ping-slow 2s ease-out 0.5s infinite;"></div>
      <div style="width:18px;height:18px;border-radius:50%;background:#f4a261;box-shadow:0 0 0 3px rgba(244,162,97,0.2),0 0 14px rgba(244,162,97,0.7);"></div>
    </div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapFitter({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 });
  }, [map, bounds]);
  return null;
}

// Keep plane in view — pan gently when it drifts near/outside the bounds
function MapFollower({ planePos }) {
  const map = useMap();
  const prevPos = useRef(null);
  useEffect(() => {
    if (!planePos) return;
    const [lat, lon] = planePos;
    if (prevPos.current) {
      const [pLat, pLon] = prevPos.current;
      const moved = Math.abs(lat - pLat) > 0.08 || Math.abs(lon - pLon) > 0.08;
      if (!moved) return;
    }
    prevPos.current = planePos;
    const bounds = map.getBounds();
    const ne = bounds.getNorthEast(), sw = bounds.getSouthWest();
    const latSpan = ne.lat - sw.lat, lonSpan = ne.lng - sw.lng;
    const margin = 0.12;
    const nearEdge = lat > ne.lat - latSpan * margin || lat < sw.lat + latSpan * margin
      || lon > ne.lng - lonSpan * margin || lon < sw.lng + lonSpan * margin;
    if (!bounds.contains([lat, lon]) || nearEdge) {
      map.panTo([lat, lon], { animate: true, duration: 2.5, easeLinearity: 0.25 });
    }
  }, [planePos, map]);
  return null;
}

function createGhostIcon(heading, theme = 'dark') {
  const color   = theme === 'light' ? '#0369a1' : '#48cae4';
  const glow    = theme === 'light' ? 'rgba(3,105,161,0.5)' : 'rgba(72,202,228,0.5)';
  const opacity = theme === 'light' ? 0.55 : 0.52;
  return L.divIcon({
    html: `<div style="transform:rotate(${heading || 0}deg);width:26px;height:26px;display:flex;align-items:center;justify-content:center;opacity:${opacity};">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="${color}"
        style="filter:drop-shadow(0 0 4px ${glow}) drop-shadow(0 0 2px ${glow})">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>`,
    className: 'ghost-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export function WorkMap({ session, progress, livePos, mapView, theme = 'dark', airlineColor, ghostFlights = [] }) {
  const { origin, destination } = session;
  const trailRef = useRef([]);
  const [trail, setTrail] = useState([]);
  const trailTickRef = useRef(0);
  const isLive = mapView === 'realtime';

  // Animated mode: great circle — 50 pts is plenty for visual smoothness
  const routePoints = useMemo(
    () => greatCirclePoints(origin.lat, origin.lon, destination.lat, destination.lon, 50),
    [origin, destination]
  );

  const planePos = useMemo(() => {
    if (isLive && livePos) return [livePos.lat, livePos.lon];
    return interpolatePosition(origin.lat, origin.lon, destination.lat, destination.lon, progress);
  }, [isLive, livePos, progress, origin, destination]);

  // Live route: recalculate only when plane moves >0.15° to avoid every-second great-circle cost
  const lastLiveRoutePos = useRef(null);
  const liveRouteCache = useRef([]);
  const liveRoutePoints = useMemo(() => {
    if (!isLive || !planePos || !destination?.lat) return [];
    const [lat, lon] = planePos;
    const prev = lastLiveRoutePos.current;
    if (prev && Math.abs(lat - prev[0]) < 0.15 && Math.abs(lon - prev[1]) < 0.15) {
      return liveRouteCache.current; // reuse previous calculation
    }
    lastLiveRoutePos.current = planePos;
    liveRouteCache.current = greatCirclePoints(lat, lon, destination.lat, destination.lon, 35);
    return liveRouteCache.current;
  }, [isLive, planePos, destination]);

  // Build contrail trail — update every 5s, not every second
  useEffect(() => {
    if (!planePos) return;
    trailTickRef.current += 1;
    if (trailTickRef.current % 5 !== 0 && trailRef.current.length > 0) return;
    trailRef.current = [...trailRef.current.slice(-(TRAIL_MAX - 1)), planePos];
    setTrail([...trailRef.current]);
  }, [planePos?.[0], planePos?.[1]]); // eslint-disable-line

  const planeBearing = useMemo(() => {
    if (isLive && livePos?.heading != null) return livePos.heading;
    if (progress >= 0.99) return bearing(origin.lat, origin.lon, destination.lat, destination.lon);
    const ahead = interpolatePosition(origin.lat, origin.lon, destination.lat, destination.lon, Math.min(progress + 0.01, 1));
    return bearing(planePos[0], planePos[1], ahead[0], ahead[1]);
  }, [isLive, livePos, progress, origin, destination, planePos]);

  const bounds = useMemo(
    () => getBounds(origin.lat, origin.lon, destination.lat, destination.lon),
    [origin, destination]
  );

  const { flownPoints, remainingPoints } = useMemo(() => {
    const idx = Math.floor(progress * routePoints.length);
    return { flownPoints: routePoints.slice(0, idx + 1), remainingPoints: routePoints.slice(idx) };
  }, [progress, routePoints]);

  const neon = NEON[theme] || NEON.dark;
  const planeIcon = useMemo(() => createPlaneIcon(planeBearing, theme), [planeBearing, theme]);
  const originIcon = useMemo(() => createOriginIcon(theme), [theme]);
  const destIcon = useMemo(() => createDestIcon(), []);
  const ghostIcons = useMemo(
    () => ghostFlights.map(f => ({ ...f, icon: createGhostIcon(f.heading, theme) })),
    [ghostFlights, theme]
  );

  // Trail (behind) + projected path (ahead) for each ghost — use velocity or 240 m/s default
  const ghostRoutes = useMemo(() => ghostFlights.map(f => {
    const spd = f.velocity || 240;
    const hdg = f.heading || 0;
    const trail = projectAhead(f.lat, f.lon, (hdg + 180) % 360, spd, 1.0);
    const ahead = projectAhead(f.lat, f.lon, hdg, spd, 1.5);
    return {
      key:   f.icao24,
      trail: [[trail.lat, trail.lon], [f.lat, f.lon]],
      ahead: [[f.lat, f.lon], [ahead.lat, ahead.lon]],
    };
  }), [ghostFlights]);

  return (
    <MapContainer
      center={[(origin.lat + destination.lat) / 2, (origin.lon + destination.lon) / 2]}
      zoom={5}
      zoomControl={false}
      style={{ width: '100%', height: '100%', background: theme === 'dark' ? '#0d1226' : '#e8f4f8' }}
    >
      <TileLayer url={TILES[theme] || TILES.dark} attribution={ATTR} />
      <DayNightLayer opacity={theme === 'light' ? 0.35 : 0.55} />
      <MapFitter bounds={bounds} />
      {planePos && <MapFollower planePos={planePos} />}

      {/* Remaining route — dashed faint */}
      {!isLive && remainingPoints.length > 1 && (
        <Polyline
          positions={remainingPoints}
          pathOptions={{ color: neon.routeDim, weight: 1.5, opacity: theme === 'light' ? 0.35 : 0.2, dashArray: '6 6' }}
        />
      )}

      {/* Live mode — route always starts FROM plane's current position */}
      {isLive && liveRoutePoints.length > 1 && (
        <>
          <Polyline positions={liveRoutePoints} pathOptions={{ color: airlineColor || neon.routeDim, weight: 4, opacity: theme === 'light' ? 0.18 : 0.10 }} />
          <Polyline positions={liveRoutePoints} pathOptions={{ color: airlineColor || neon.routeDim, weight: 2, opacity: theme === 'light' ? 0.8 : 0.45, dashArray: '8 6' }} />
        </>
      )}

      {/* Flown route — bright solid */}
      {!isLive && flownPoints.length > 1 && (
        <>
          <Polyline positions={flownPoints} pathOptions={{ color: airlineColor || neon.routeDim, weight: 5, opacity: theme === 'light' ? 0.2 : 0.12 }} />
          <Polyline positions={flownPoints} pathOptions={{ color: airlineColor || neon.route, weight: 2.5, opacity: theme === 'light' ? 0.95 : 0.9 }} />
        </>
      )}

      {/* Contrail — three layers for depth */}
      {trail.length > 3 && (
        <>
          <Polyline positions={trail} pathOptions={{ color: neon.route, weight: 4, opacity: theme === 'light' ? 0.08 : 0.04 }} />
          <Polyline positions={trail} pathOptions={{ color: neon.route, weight: 2, opacity: theme === 'light' ? 0.35 : 0.18 }} />
          <Polyline positions={trail} pathOptions={{ color: theme === 'light' ? neon.routeDim : '#ffffff', weight: 1, opacity: 0.5, dashArray: '3 5' }} />
        </>
      )}

      {/* Ghost flight routes — trail behind + projected path ahead */}
      {ghostRoutes.map(r => (
        <React.Fragment key={r.key}>
          <Polyline
            positions={r.trail}
            pathOptions={{ color: '#48cae4', weight: 1.2, opacity: theme === 'light' ? 0.22 : 0.28 }}
          />
          <Polyline
            positions={r.ahead}
            pathOptions={{ color: '#48cae4', weight: 0.8, opacity: theme === 'light' ? 0.12 : 0.16, dashArray: '4 6' }}
          />
        </React.Fragment>
      ))}

      {/* Ghost flight icons */}
      {ghostIcons.map(f => (
        <Marker
          key={f.icao24}
          position={[f.lat, f.lon]}
          icon={f.icon}
          title={`#${f.icao24?.slice(-4).toUpperCase()}`}
        />
      ))}

      {/* In live mode, origin marker is where the plane WAS — only show destination */}
      {!isLive && <Marker position={[origin.lat, origin.lon]} icon={originIcon} />}
      {destination?.lat && <Marker position={[destination.lat, destination.lon]} icon={destIcon} />}
      {planePos && <Marker position={planePos} icon={planeIcon} />}
    </MapContainer>
  );
}
