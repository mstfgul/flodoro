import { useMemo, useRef, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatAltitude, formatSpeed } from '../../utils/format';

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};
const ATTR = '&copy; OpenStreetMap &copy; CARTO';

// Color by altitude
function altColor(alt) {
  if (!alt || alt < 3000) return '#f4a261';
  if (alt < 7000) return '#48cae4';
  return '#00b4d8';
}

function createPlaneIcon(heading, isSelected, alt) {
  const color = isSelected ? '#f4a261' : altColor(alt);
  const size = isSelected ? 32 : 22;
  const glow = isSelected ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 3px ${color})` : `drop-shadow(0 0 4px ${color}80)`;
  const pulse = isSelected
    ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color};animation:ping-slow 1.5s ease-out infinite;pointer-events:none;"></div>`
    : '';

  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse}
      <div style="transform:rotate(${heading || 0}deg);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" style="filter:${glow}">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
    </div>`,
    className: 'plane-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Smoothly pan map to selected plane
function MapPan({ target }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!target || (prevRef.current === target.icao24)) return;
    prevRef.current = target.icao24;
    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 6), { duration: 1.2 });
  }, [target, map]);
  return null;
}

// Hover card — positioned via mouse coords passed from marker event
function HoverCard({ flight, mousePos, theme }) {
  if (!flight || !mousePos) return null;
  const isDark = theme !== 'light';
  const color = altColor(flight.baroAlt);
  const altFt = flight.baroAlt ? Math.round(flight.baroAlt * 3.28084) : null;
  const kph = flight.velocity ? Math.round(flight.velocity * 3.6) : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: mousePos.x,
        top: mousePos.y - 14,
        transform: 'translate(-50%, -100%)',
        zIndex: 800,
        pointerEvents: 'none',
      }}
    >
      <div style={{
        background: isDark ? 'rgba(4,7,18,0.97)' : 'rgba(248,252,255,0.98)',
        border: `1px solid ${color}50`,
        borderRadius: 5,
        padding: '8px 11px 9px',
        minWidth: 140,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}15`,
      }}>
        {/* Callsign row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 7 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color, letterSpacing: '0.05em', lineHeight: 1 }}>
            {flight.callsign || flight.icao24}
          </span>
          {flight.country && (
            <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.08em' }}>
              {flight.country.slice(0, 12)}
            </span>
          )}
        </div>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {[
            ['ALT', altFt ? `${(altFt/1000).toFixed(0)}k` : '—', 'ft'],
            ['SPD', kph ? `${kph}` : '—', 'km/h'],
            ['HDG', flight.heading ? `${Math.round(flight.heading)}` : '—', '°'],
          ].map(([label, val, unit]) => (
            <div key={label}>
              <div style={{ fontSize: 8, color: '#334155', letterSpacing: '0.14em', fontFamily: 'monospace', marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: isDark ? '#cbd5e1' : '#0f172a', lineHeight: 1 }}>
                {val}<span style={{ fontSize: 8, color: '#475569', marginLeft: 1 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Caret */}
        <div style={{
          position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid ${isDark ? 'rgba(4,7,18,0.97)' : 'rgba(248,252,255,0.98)'}`,
        }} />
      </div>
    </div>
  );
}

export function LiveFlightMap({ flights, selectedFlight, onSelect, theme = 'dark' }) {
  const [hovered, setHovered] = useState(null); // { flight, mousePos }
  const containerRef = useRef(null);

  const markers = useMemo(
    () =>
      flights.map((f) => ({
        ...f,
        icon: createPlaneIcon(f.heading, f.icao24 === selectedFlight?.icao24, f.baroAlt),
      })),
    [flights, selectedFlight?.icao24]
  );

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[48, 15]}
        zoom={5}
        zoomControl={false}
        style={{ width: '100%', height: '100%', background: theme === 'dark' ? '#0d1226' : '#e8f4fd' }}
      >
        <TileLayer url={TILES[theme] || TILES.dark} attribution={ATTR} />
        <MapPan target={selectedFlight} />

        {markers.map((f) => (
          <Marker
            key={f.icao24}
            position={[f.lat, f.lon]}
            icon={f.icon}
            eventHandlers={{
              click: () => onSelect(f),
              mouseover: (e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const { clientX, clientY } = e.originalEvent;
                setHovered({ flight: f, mousePos: { x: clientX - rect.left, y: clientY - rect.top } });
              },
              mousemove: (e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const { clientX, clientY } = e.originalEvent;
                setHovered(h => h ? { ...h, mousePos: { x: clientX - rect.left, y: clientY - rect.top } } : null);
              },
              mouseout: () => setHovered(null),
            }}
          />
        ))}
      </MapContainer>

      <HoverCard flight={hovered?.flight} mousePos={hovered?.mousePos} theme={theme} />
    </div>
  );
}
