// Solar position and day/night calculations

export function getSubsolarPoint(date = new Date()) {
  const dayOfYear = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / 86400000
  );
  // Solar declination (simplified Spencer formula, ±0.3° accuracy)
  const decDeg = -23.45 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);

  // Subsolar longitude: at 12:00 UTC the sun is on the Greenwich meridian
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lonDeg = ((12 - utcH) * 15 + 540) % 360 - 180;

  return { lat: decDeg, lon: lonDeg };
}

// Is a map pixel in day or night?
// cosZ > 0 → day, cosZ ≤ 0 → night
export function cosSolarZenith(latDeg, lonDeg, solar) {
  const latR = latDeg * Math.PI / 180;
  const lonR = lonDeg * Math.PI / 180;
  const slatR = solar.lat * Math.PI / 180;
  const slonR = solar.lon * Math.PI / 180;
  return (
    Math.sin(latR) * Math.sin(slatR) +
    Math.cos(latR) * Math.cos(slatR) * Math.cos(lonR - slonR)
  );
}

// Approximate local time at a given longitude (ignores real TZ boundaries)
export function approxLocalTime(lonDeg, date = new Date()) {
  const offsetH = lonDeg / 15;
  const localMs = date.getTime() + offsetH * 3_600_000;
  const d = new Date(localMs);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const isNight = h >= 21 || h < 6;
  const isDusk  = (h >= 19 && h < 21) || (h >= 6 && h < 8);
  const ampm    = h >= 12 ? 'PM' : 'AM';
  const h12     = ((h % 12) || 12).toString().padStart(2, '0');
  return { time: `${h12}:${m} ${ampm}`, h, isNight, isDusk };
}
