// Deterministic city-pair picker for live group focus sessions.
// Everyone in the same session code sees the same route.

const ROUTES = {
  // 10-20 min → ~250-350 km
  short: [
    { origin: {city:'Istanbul',code:'IST',lat:40.98,lon:28.82}, dest: {city:'Ankara',code:'ESB',lat:40.12,lon:32.99} },
    { origin: {city:'Paris',code:'CDG',lat:49.01,lon:2.55},    dest: {city:'Brussels',code:'BRU',lat:50.90,lon:4.48} },
    { origin: {city:'Munich',code:'MUC',lat:48.35,lon:11.79},  dest: {city:'Vienna',code:'VIE',lat:48.11,lon:16.57} },
    { origin: {city:'Madrid',code:'MAD',lat:40.47,lon:-3.56},  dest: {city:'Barcelona',code:'BCN',lat:41.30,lon:2.08} },
    { origin: {city:'Zurich',code:'ZRH',lat:47.46,lon:8.55},   dest: {city:'Milan',code:'MXP',lat:45.63,lon:8.72} },
    { origin: {city:'Berlin',code:'BER',lat:52.36,lon:13.50},  dest: {city:'Hamburg',code:'HAM',lat:53.63,lon:9.99} },
    { origin: {city:'Amsterdam',code:'AMS',lat:52.31,lon:4.76},dest: {city:'Brussels',code:'BRU',lat:50.90,lon:4.48} },
    { origin: {city:'Stockholm',code:'ARN',lat:59.65,lon:17.92},dest:{city:'Oslo',code:'OSL',lat:60.20,lon:11.08} },
  ],
  // 25-50 min → ~500-700 km
  medium: [
    { origin: {city:'Istanbul',code:'IST',lat:40.98,lon:28.82}, dest: {city:'Athens',code:'ATH',lat:37.94,lon:23.94} },
    { origin: {city:'London',code:'LHR',lat:51.48,lon:-0.46},   dest: {city:'Paris',code:'CDG',lat:49.01,lon:2.55} },
    { origin: {city:'Paris',code:'CDG',lat:49.01,lon:2.55},     dest: {city:'Frankfurt',code:'FRA',lat:50.03,lon:8.57} },
    { origin: {city:'Dubai',code:'DXB',lat:25.25,lon:55.36},    dest: {city:'Muscat',code:'MCT',lat:23.59,lon:58.28} },
    { origin: {city:'Barcelona',code:'BCN',lat:41.30,lon:2.08}, dest: {city:'Lisbon',code:'LIS',lat:38.77,lon:-9.13} },
    { origin: {city:'Frankfurt',code:'FRA',lat:50.03,lon:8.57}, dest: {city:'Warsaw',code:'WAW',lat:52.17,lon:20.97} },
    { origin: {city:'Rome',code:'FCO',lat:41.80,lon:12.24},     dest: {city:'Munich',code:'MUC',lat:48.35,lon:11.79} },
    { origin: {city:'New York',code:'JFK',lat:40.64,lon:-73.78},dest: {city:'Boston',code:'BOS',lat:42.36,lon:-71.01} },
  ],
  // 50-90 min → ~900-1400 km
  long: [
    { origin: {city:'Istanbul',code:'IST',lat:40.98,lon:28.82}, dest: {city:'Dubai',code:'DXB',lat:25.25,lon:55.36} },
    { origin: {city:'London',code:'LHR',lat:51.48,lon:-0.46},   dest: {city:'Madrid',code:'MAD',lat:40.47,lon:-3.56} },
    { origin: {city:'Paris',code:'CDG',lat:49.01,lon:2.55},     dest: {city:'Moscow',code:'SVO',lat:55.97,lon:37.41} },
    { origin: {city:'Dubai',code:'DXB',lat:25.25,lon:55.36},    dest: {city:'Mumbai',code:'BOM',lat:19.09,lon:72.87} },
    { origin: {city:'New York',code:'JFK',lat:40.64,lon:-73.78},dest: {city:'Chicago',code:'ORD',lat:41.97,lon:-87.91} },
    { origin: {city:'Tokyo',code:'NRT',lat:35.77,lon:140.39},   dest: {city:'Seoul',code:'ICN',lat:37.46,lon:126.44} },
    { origin: {city:'Berlin',code:'BER',lat:52.36,lon:13.50},   dest: {city:'Athens',code:'ATH',lat:37.94,lon:23.94} },
    { origin: {city:'Singapore',code:'SIN',lat:1.36,lon:103.99},dest: {city:'Bangkok',code:'BKK',lat:13.69,lon:100.75} },
  ],
  // 90+ min → ~1500 km+
  veryLong: [
    { origin: {city:'London',code:'LHR',lat:51.48,lon:-0.46},   dest: {city:'Istanbul',code:'IST',lat:40.98,lon:28.82} },
    { origin: {city:'New York',code:'JFK',lat:40.64,lon:-73.78},dest: {city:'Miami',code:'MIA',lat:25.80,lon:-80.29} },
    { origin: {city:'Paris',code:'CDG',lat:49.01,lon:2.55},     dest: {city:'Cairo',code:'CAI',lat:30.12,lon:31.41} },
    { origin: {city:'Dubai',code:'DXB',lat:25.25,lon:55.36},    dest: {city:'Nairobi',code:'NBO',lat:-1.32,lon:36.93} },
    { origin: {city:'Singapore',code:'SIN',lat:1.36,lon:103.99},dest: {city:'Tokyo',code:'NRT',lat:35.77,lon:140.39} },
    { origin: {city:'Sydney',code:'SYD',lat:-33.94,lon:151.18}, dest: {city:'Melbourne',code:'MEL',lat:-37.67,lon:144.84} },
    { origin: {city:'Toronto',code:'YYZ',lat:43.68,lon:-79.63}, dest: {city:'New York',code:'JFK',lat:40.64,lon:-73.78} },
    { origin: {city:'Istanbul',code:'IST',lat:40.98,lon:28.82}, dest: {city:'Riyadh',code:'RUH',lat:24.96,lon:46.70} },
  ],
};

/**
 * Pick a city pair deterministically based on duration + session code.
 * All participants with the same code see the same route.
 */
/** Flat map of ICAO code → {city, code, lat, lon} built from the ROUTES catalog. */
const AIRPORT_MAP = (() => {
  const m = {};
  Object.values(ROUTES).flat().forEach(({ origin, dest }) => {
    m[origin.code] = origin;
    m[dest.code]   = dest;
  });
  return m;
})();

/** Look up coordinates for an airport code. Returns null if not found. */
export function lookupAirport(code) {
  return AIRPORT_MAP[code] ?? null;
}

export function pickLiveRoute(durationMinutes, sessionCode = '') {
  const tier =
    durationMinutes <= 22  ? 'short' :
    durationMinutes <= 55  ? 'medium' :
    durationMinutes <= 95  ? 'long'   : 'veryLong';

  const list = ROUTES[tier];
  // Use first 6 hex chars of code as seed
  const seed = parseInt(sessionCode.replace(/[^0-9a-f]/gi, '').substring(0, 6) || '0', 16);
  const pair = list[seed % list.length];
  return { origin: pair.origin, destination: pair.dest };
}
