export function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} sa ${m} dk` : `${h} saat`;
}

export function formatAltitude(meters) {
  if (!meters) return '—';
  const feet = Math.round(meters * 3.28084);
  return `${feet.toLocaleString()} ft`;
}

export function formatSpeed(mps) {
  if (!mps) return '—';
  const kmh = Math.round(mps * 3.6);
  return `${kmh} km/s`;
}

export function formatDistance(km) {
  return `${Math.round(km).toLocaleString()} km`;
}
