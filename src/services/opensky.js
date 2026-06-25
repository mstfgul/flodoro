const BASE = 'https://opensky-network.org/api';

// Wider Europe + Middle East + North Africa bounding box
const BOUNDS = { lamin: 25, lomin: -20, lamax: 75, lomax: 65 };

export function parseState(s) {
  return {
    icao24: s[0],
    callsign: (s[1] || '').trim() || null,
    country: s[2],
    lastContact: s[4],
    lon: s[5],
    lat: s[6],
    baroAlt: s[7],
    onGround: s[8],
    velocity: s[9],
    heading: s[10],
    vertRate: s[11],
    geoAlt: s[13],
  };
}

export async function fetchFlights() {
  const { lamin, lomin, lamax, lomax } = BOUNDS;
  const url = `${BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data = await res.json();
  return (data.states || [])
    .map(parseState)
    .filter((s) => s.lat && s.lon && !s.onGround && s.baroAlt > 1000);
}

export async function fetchFlightByCallsign(callsign) {
  const url = `${BASE}/states/all?callsign=${encodeURIComponent(callsign.padEnd(8))}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data = await res.json();
  if (!data.states?.length) return null;
  return parseState(data.states[0]);
}

export async function fetchFlightByIcao(icao24) {
  const url = `${BASE}/states/all?icao24=${encodeURIComponent(icao24)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data = await res.json();
  if (!data.states?.length) return null;
  return parseState(data.states[0]);
}

// Richer demo data — 40 flights across Europe/Middle East/North Africa
export function getDemoFlights() {
  const now = Date.now();
  return [
    { icao24:'a1b2c3', callsign:'TK1', country:'Turkey', lat:43.8, lon:20.1, heading:315, velocity:248, baroAlt:11280, geoAlt:11310, onGround:false, lastContact:now },
    { icao24:'d4e5f6', callsign:'LH455', country:'Germany', lat:48.4, lon:11.2, heading:225, velocity:252, baroAlt:11278, geoAlt:11300, onGround:false, lastContact:now },
    { icao24:'g7h8i9', callsign:'BA92', country:'United Kingdom', lat:47.0, lon:4.8, heading:280, velocity:261, baroAlt:10973, geoAlt:11000, onGround:false, lastContact:now },
    { icao24:'j1k2l3', callsign:'AF1234', country:'France', lat:44.5, lon:2.3, heading:195, velocity:237, baroAlt:9754, geoAlt:9780, onGround:false, lastContact:now },
    { icao24:'m4n5o6', callsign:'KL867', country:'Netherlands', lat:51.5, lon:8.2, heading:88, velocity:249, baroAlt:11278, geoAlt:11310, onGround:false, lastContact:now },
    { icao24:'p7q8r9', callsign:'VY6203', country:'Spain', lat:39.6, lon:0.4, heading:52, velocity:218, baroAlt:9144, geoAlt:9170, onGround:false, lastContact:now },
    { icao24:'s1t2u3', callsign:'TK78', country:'Turkey', lat:38.1, lon:27.8, heading:295, velocity:242, baroAlt:10668, geoAlt:10700, onGround:false, lastContact:now },
    { icao24:'v4w5x6', callsign:'EZY8411', country:'United Kingdom', lat:52.3, lon:3.1, heading:168, velocity:215, baroAlt:8839, geoAlt:8870, onGround:false, lastContact:now },
    { icao24:'y7z8a1', callsign:'RYR4401', country:'Ireland', lat:45.6, lon:-2.8, heading:122, velocity:222, baroAlt:9449, geoAlt:9480, onGround:false, lastContact:now },
    { icao24:'b2c3d4', callsign:'IB3163', country:'Spain', lat:41.2, lon:-5.1, heading:275, velocity:231, baroAlt:8839, geoAlt:8870, onGround:false, lastContact:now },
    { icao24:'e5f6g7', callsign:'SU2578', country:'Russia', lat:56.4, lon:32.5, heading:228, velocity:256, baroAlt:11278, geoAlt:11310, onGround:false, lastContact:now },
    { icao24:'h8i9j1', callsign:'QR17', country:'Qatar', lat:33.8, lon:39.1, heading:318, velocity:265, baroAlt:11887, geoAlt:11920, onGround:false, lastContact:now },
    { icao24:'k2l3m4', callsign:'EK204', country:'UAE', lat:27.5, lon:44.2, heading:305, velocity:270, baroAlt:12192, geoAlt:12220, onGround:false, lastContact:now },
    { icao24:'n5o6p7', callsign:'TK55', country:'Turkey', lat:50.6, lon:30.4, heading:230, velocity:243, baroAlt:10668, geoAlt:10700, onGround:false, lastContact:now },
    { icao24:'q8r9s1', callsign:'W64562', country:'Turkey', lat:40.9, lon:35.7, heading:90, velocity:221, baroAlt:8534, geoAlt:8560, onGround:false, lastContact:now },
    { icao24:'t2u3v4', callsign:'FR8802', country:'Ireland', lat:46.1, lon:10.3, heading:140, velocity:213, baroAlt:7924, geoAlt:7950, onGround:false, lastContact:now },
    { icao24:'w5x6y7', callsign:'DL400', country:'United States', lat:55.1, lon:-4.2, heading:255, velocity:268, baroAlt:11887, geoAlt:11920, onGround:false, lastContact:now },
    { icao24:'z8a1b2', callsign:'UA936', country:'United States', lat:57.8, lon:20.5, heading:270, velocity:271, baroAlt:12192, geoAlt:12220, onGround:false, lastContact:now },
    { icao24:'c3d4e5', callsign:'AY666', country:'Finland', lat:62.3, lon:24.1, heading:195, velocity:238, baroAlt:9754, geoAlt:9780, onGround:false, lastContact:now },
    { icao24:'f6g7h8', callsign:'SK905', country:'Sweden', lat:59.2, lon:14.7, heading:155, velocity:225, baroAlt:9449, geoAlt:9480, onGround:false, lastContact:now },
    { icao24:'i9j1k2', callsign:'OS121', country:'Austria', lat:48.7, lon:16.5, heading:95, velocity:234, baroAlt:10058, geoAlt:10090, onGround:false, lastContact:now },
    { icao24:'l3m4n5', callsign:'HV5561', country:'Netherlands', lat:36.8, lon:14.2, heading:345, velocity:209, baroAlt:7620, geoAlt:7650, onGround:false, lastContact:now },
    { icao24:'o6p7q8', callsign:'SN3692', country:'Belgium', lat:49.8, lon:5.4, heading:75, velocity:220, baroAlt:9144, geoAlt:9170, onGround:false, lastContact:now },
    { icao24:'r9s1t2', callsign:'TP472', country:'Portugal', lat:38.9, lon:-9.4, heading:310, velocity:244, baroAlt:9754, geoAlt:9780, onGround:false, lastContact:now },
    { icao24:'u3v4w5', callsign:'A3331', country:'Greece', lat:37.8, lon:21.5, heading:125, velocity:231, baroAlt:9449, geoAlt:9480, onGround:false, lastContact:now },
    { icao24:'x6y7z8', callsign:'U28877', country:'Ukraine', lat:49.4, lon:24.8, heading:190, velocity:218, baroAlt:8534, geoAlt:8560, onGround:false, lastContact:now },
    { icao24:'a9b1c2', callsign:'PC1234', country:'Netherlands', lat:43.7, lon:7.3, heading:60, velocity:207, baroAlt:7315, geoAlt:7340, onGround:false, lastContact:now },
    { icao24:'d3e4f5', callsign:'W63981', country:'Turkey', lat:36.5, lon:32.1, heading:275, velocity:228, baroAlt:9144, geoAlt:9170, onGround:false, lastContact:now },
    { icao24:'g6h7i8', callsign:'MS777', country:'Egypt', lat:30.5, lon:32.4, heading:45, velocity:246, baroAlt:10363, geoAlt:10390, onGround:false, lastContact:now },
    { icao24:'j9k1l2', callsign:'GF201', country:'Bahrain', lat:28.1, lon:46.3, heading:290, velocity:262, baroAlt:11582, geoAlt:11610, onGround:false, lastContact:now },
    { icao24:'m3n4o5', callsign:'SV786', country:'Saudi Arabia', lat:25.4, lon:38.8, heading:340, velocity:257, baroAlt:11278, geoAlt:11310, onGround:false, lastContact:now },
    { icao24:'p6q7r8', callsign:'LX38', country:'Switzerland', lat:47.6, lon:7.8, heading:225, velocity:241, baroAlt:10668, geoAlt:10700, onGround:false, lastContact:now },
    { icao24:'s9t1u2', callsign:'AZ610', country:'Italy', lat:41.6, lon:13.8, heading:165, velocity:226, baroAlt:8839, geoAlt:8870, onGround:false, lastContact:now },
    { icao24:'v3w4x5', callsign:'VKG9952', country:'Norway', lat:65.2, lon:14.6, heading:180, velocity:218, baroAlt:9144, geoAlt:9170, onGround:false, lastContact:now },
    { icao24:'y6z7a8', callsign:'TU236', country:'Tunisia', lat:36.2, lon:10.1, heading:330, velocity:235, baroAlt:9754, geoAlt:9780, onGround:false, lastContact:now },
    { icao24:'b9c1d2', callsign:'AT503', country:'Morocco', lat:33.6, lon:-5.8, heading:15, velocity:229, baroAlt:9449, geoAlt:9480, onGround:false, lastContact:now },
    { icao24:'e3f4g5', callsign:'PC567', country:'Netherlands', lat:53.4, lon:5.1, heading:85, velocity:223, baroAlt:8839, geoAlt:8870, onGround:false, lastContact:now },
    { icao24:'h6i7j8', callsign:'TK199', country:'Turkey', lat:41.4, lon:29.2, heading:30, velocity:247, baroAlt:4572, geoAlt:4600, onGround:false, lastContact:now },
    { icao24:'k9l1m2', callsign:'BAW88Q', country:'United Kingdom', lat:51.5, lon:-1.2, heading:270, velocity:264, baroAlt:11582, geoAlt:11610, onGround:false, lastContact:now },
    { icao24:'n3o4p5', callsign:'CFG1452', country:'Germany', lat:50.1, lon:8.1, heading:190, velocity:233, baroAlt:9754, geoAlt:9780, onGround:false, lastContact:now },
  ];
}
