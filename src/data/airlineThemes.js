export const airlineThemes = {
  TK:  { name: 'Turkish Airlines',   color: '#E81932', accent: '#D4AF37', flag: '🇹🇷' },
  LH:  { name: 'Lufthansa',          color: '#05164d', accent: '#f5a623', flag: '🇩🇪' },
  BA:  { name: 'British Airways',    color: '#075AAA', accent: '#EB2226', flag: '🇬🇧' },
  FR:  { name: 'Ryanair',            color: '#073590', accent: '#F7C52B', flag: '🇮🇪' },
  RYR: { name: 'Ryanair',            color: '#073590', accent: '#F7C52B', flag: '🇮🇪' },
  AF:  { name: 'Air France',         color: '#002157', accent: '#cc0000', flag: '🇫🇷' },
  EK:  { name: 'Emirates',           color: '#D71921', accent: '#C9A028', flag: '🇦🇪' },
  QR:  { name: 'Qatar Airways',      color: '#5C0632', accent: '#C9A94F', flag: '🇶🇦' },
  EZY: { name: 'easyJet',            color: '#FF6600', accent: '#000000', flag: '🟠' },
  KL:  { name: 'KLM',               color: '#009DE0', accent: '#003065', flag: '🇳🇱' },
  SK:  { name: 'SAS',                color: '#000099', accent: '#C8C8C8', flag: '🇸🇪' },
  AY:  { name: 'Finnair',            color: '#003580', accent: '#E8192C', flag: '🇫🇮' },
  OS:  { name: 'Austrian Airlines',  color: '#ED1C24', accent: '#000000', flag: '🇦🇹' },
  IB:  { name: 'Iberia',             color: '#CC0000', accent: '#FFD700', flag: '🇪🇸' },
  VY:  { name: 'Vueling',            color: '#FFD700', accent: '#333333', flag: '🇪🇸' },
  U2:  { name: 'easyJet',            color: '#FF6600', accent: '#000000', flag: '🟠' },
  SU:  { name: 'Aeroflot',           color: '#003087', accent: '#CC0000', flag: '🇷🇺' },
  AZ:  { name: 'ITA Airways',        color: '#009246', accent: '#CE2B37', flag: '🇮🇹' },
  TP:  { name: 'TAP Air Portugal',   color: '#006400', accent: '#CC0000', flag: '🇵🇹' },
  MS:  { name: 'EgyptAir',           color: '#006233', accent: '#CE1126', flag: '🇪🇬' },
  AT:  { name: 'Royal Air Maroc',    color: '#CC0000', accent: '#006233', flag: '🇲🇦' },
  GF:  { name: 'Gulf Air',           color: '#BB0000', accent: '#D4AF37', flag: '🇧🇭' },
  SV:  { name: 'Saudia',             color: '#006233', accent: '#FFFFFF', flag: '🇸🇦' },
  LX:  { name: 'Swiss',              color: '#CC0000', accent: '#FFFFFF', flag: '🇨🇭' },
  DL:  { name: 'Delta Air Lines',    color: '#003366', accent: '#CC0000', flag: '🇺🇸' },
  UA:  { name: 'United Airlines',    color: '#003087', accent: '#6CACE4', flag: '🇺🇸' },
  PC:  { name: 'Pegasus Airlines',   color: '#F26B21', accent: '#003087', flag: '🇹🇷' },
  W6:  { name: 'Wizz Air',           color: '#C6007E', accent: '#F9C000', flag: '🇭🇺' },
  SN:  { name: 'Brussels Airlines',  color: '#1C3D72', accent: '#CC0000', flag: '🇧🇪' },
  A3:  { name: 'Aegean Airlines',    color: '#003087', accent: '#5CA0D3', flag: '🇬🇷' },
};

const DEFAULT = { name: 'Flodoro Air', color: '#00b4d8', accent: '#f4a261', flag: '✈' };

export function getAirlineFromCallsign(callsign) {
  if (!callsign) return DEFAULT;
  // Try 3-letter prefix first, then 2-letter
  const c = callsign.toUpperCase().replace(/\d.*$/, '').trim();
  return airlineThemes[c.slice(0, 3)] ?? airlineThemes[c.slice(0, 2)] ?? DEFAULT;
}
