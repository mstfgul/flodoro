const R = 6371; // Earth radius km

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Estimate flight duration in minutes based on distance
export function estimateDuration(distanceKm) {
  const cruiseSpeed = 870; // km/h average
  const groundTime = 20; // taxi + climb + descent
  return Math.round((distanceKm / cruiseSpeed) * 60 + groundTime);
}

// Great circle intermediate points for route drawing
export function greatCirclePoints(lat1, lon1, lat2, lon2, numPoints = 80) {
  const φ1 = toRad(lat1);
  const λ1 = toRad(lon1);
  const φ2 = toRad(lat2);
  const λ2 = toRad(lon2);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
      )
    );

  if (d === 0) return [[lat1, lon1]];

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x =
      A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y =
      A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)));
    const lon = toDeg(Math.atan2(y, x));
    points.push([lat, lon]);
  }
  return points;
}

// Interpolate position along the great circle at fraction t (0-1)
export function interpolatePosition(lat1, lon1, lat2, lon2, t) {
  const points = greatCirclePoints(lat1, lon1, lat2, lon2, 100);
  const idx = Math.min(Math.floor(t * 100), 99);
  const next = Math.min(idx + 1, 100);
  const localT = t * 100 - idx;
  const p1 = points[idx];
  const p2 = points[next] || points[idx];
  return [
    p1[0] + (p2[0] - p1[0]) * localT,
    p1[1] + (p2[1] - p1[1]) * localT,
  ];
}

// Bearing between two points in degrees
export function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Project a position ahead by given hours at velocity m/s and heading degrees
export function projectAhead(lat, lon, headingDeg, velocityMs, hours = 2) {
  const distKm = velocityMs * 3.6 * hours;
  const d = distKm / R;
  const h = toRad(headingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(h));
  const lon2 = lon1 + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lon: toDeg(lon2) };
}

// Get map bounds that fit both points with padding
export function getBounds(lat1, lon1, lat2, lon2, pad = 5) {
  return [
    [Math.min(lat1, lat2) - pad, Math.min(lon1, lon2) - pad],
    [Math.max(lat1, lat2) + pad, Math.max(lon1, lon2) + pad],
  ];
}
