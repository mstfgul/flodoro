import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { greatCirclePoints } from '../../utils/geo';
import { airports } from '../../data/cityPairs';

const TILES_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTR = '&copy; OpenStreetMap &copy; CARTO';

function dotIcon(color) {
  return L.divIcon({
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></div>`,
    className: '',
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

const ORIGIN_ICON = dotIcon('#48cae4');
const DEST_ICON = dotIcon('#f4a261');

// Fit map to show all routes
function MapFitter({ routes }) {
  const map = useMap();
  useEffect(() => {
    if (!routes.length) return;
    const all = routes.flatMap(r => [r.from, r.to]);
    if (all.length < 2) return;
    const bounds = L.latLngBounds(all.map(([lat, lon]) => [lat, lon]));
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
  }, [map, routes]);
  return null;
}

export function HistoryMap({ sessions = [], theme = 'dark' }) {
  const airportMap = useMemo(() => {
    const m = {};
    airports.forEach(a => { m[a.code] = a; });
    return m;
  }, []);

  const routes = useMemo(() => {
    return sessions
      .filter(s => s.origin_code && s.dest_code)
      .map(s => {
        const orig = airportMap[s.origin_code];
        const dest = airportMap[s.dest_code];
        if (!orig || !dest) return null;
        return {
          id: s.id || Math.random(),
          from: [orig.lat, orig.lon],
          to: [dest.lat, dest.lon],
          points: greatCirclePoints(orig.lat, orig.lon, dest.lat, dest.lon, 60),
          mode: s.mode,
        };
      })
      .filter(Boolean);
  }, [sessions, airportMap]);

  const uniqueEndpoints = useMemo(() => {
    const seen = new Set();
    const points = [];
    routes.forEach(r => {
      const fk = `${r.from[0].toFixed(2)},${r.from[1].toFixed(2)}`;
      const tk = `${r.to[0].toFixed(2)},${r.to[1].toFixed(2)}`;
      if (!seen.has(fk)) { seen.add(fk); points.push({ pos: r.from, type: 'origin' }); }
      if (!seen.has(tk)) { seen.add(tk); points.push({ pos: r.to, type: 'dest' }); }
    });
    return points;
  }, [routes]);

  if (!routes.length) return (
    <div className="h-64 flex items-center justify-center text-[#374151] text-sm rounded-xl overflow-hidden glass border border-white/8">
      No completed city mode flights
    </div>
  );

  return (
    <div className="h-64 rounded-xl overflow-hidden border border-white/8">
      <MapContainer
        center={[40, 20]}
        zoom={3}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%', background: '#0d1226' }}
      >
        <TileLayer url={TILES_DARK} attribution={ATTR} />
        <MapFitter routes={routes} />

        {routes.map((r, i) => (
          r.points.length > 1 && (
            <Polyline
              key={r.id}
              positions={r.points}
              pathOptions={{
                color: r.mode === 'live' ? '#00b4d8' : '#f4a261',
                weight: 1.5,
                opacity: 0.6,
              }}
            />
          )
        ))}

        {uniqueEndpoints.map((ep, i) => (
          <Marker
            key={i}
            position={ep.pos}
            icon={ep.type === 'origin' ? ORIGIN_ICON : DEST_ICON}
          />
        ))}
      </MapContainer>
    </div>
  );
}
