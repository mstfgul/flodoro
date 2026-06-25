// Procedural ATC radio chatter via Web Speech API + Web Audio squelch noise

let audioCtx = null;
let atcTimeout = null;
let active = false;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Short radio squelch burst (static pop)
function playSquelch(pre = true) {
  const ctx = getCtx();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 1.2;

  const gain = ctx.createGain();
  const t = ctx.currentTime;
  if (pre) {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);
  } else {
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.09);
  }

  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.15);
}

// NATO phonetic alphabet for callsign expansion
const NATO = {
  A:'Alpha', B:'Bravo', C:'Charlie', D:'Delta', E:'Echo', F:'Foxtrot',
  G:'Golf',  H:'Hotel', I:'India',  J:'Juliet',K:'Kilo', L:'Lima',
  M:'Mike',  N:'November',O:'Oscar',P:'Papa',  Q:'Quebec',R:'Romeo',
  S:'Sierra',T:'Tango', U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',
  Y:'Yankee',Z:'Zulu',
};

function spellCallsign(cs) {
  return cs
    .toUpperCase()
    .split('')
    .map(c => NATO[c] ?? c)
    .join(' ');
}

function flightLevel(altM) {
  if (!altM || altM < 100) return '80'; // default cruise
  return String(Math.round(altM / 30.48 / 100) * 10).padStart(3, '0');
}

function buildPhrase(callsign, destCode, altM, phaseIdx) {
  const cs = callsign ? spellCallsign(callsign.slice(0, 6)) : 'November One';
  const fl = flightLevel(altM);
  const dest = destCode || 'destination';

  const phrases = [
    // Departure / climb
    `${cs}, climb and maintain flight level ${fl}, direct ${dest}.`,
    `${cs}, contact departure on one one niner decimal one. Good day.`,
    `${cs}, cleared direct ${dest}, flight level ${fl}.`,
    // Cruise
    `${cs}, traffic twelve o'clock, five miles, same altitude. Report in sight.`,
    `${cs}, maintain flight level ${fl}. Wind at cruise altitude, two seven zero at forty.`,
    `${cs}, all looks good on radar. Expect smooth ride ahead.`,
    `${cs}, ${dest} is reporting visual conditions. Expect a visual approach.`,
    `${cs}, reduce speed to two five zero knots, traffic sequence.`,
    // Approach
    `${cs}, descend and maintain one zero thousand, expect ILS approach.`,
    `${cs}, contact ${dest} approach on one two five decimal seven.`,
    `${cs}, you are cleared for the approach. Runway in use is two eight left.`,
    // Generic
    `${cs}, radar contact. Squawk four two seven three.`,
    `${cs}, roger. Continue as filed.`,
    `${cs}, no traffic in your area. Proceed as planned.`,
  ];

  // Weight towards cruise phrases
  const pool = phaseIdx === 0
    ? phrases.slice(0, 3)
    : phaseIdx >= 2
    ? phrases.slice(8, 11)
    : phrases.slice(3, 14);

  return pool[Math.floor(Math.random() * pool.length)];
}

function speak(text, onEnd) {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);

  // Pick a male English voice
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v =>
    v.lang.startsWith('en') && (v.name.toLowerCase().includes('male') || v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('David'))
  ) ?? voices.find(v => v.lang.startsWith('en')) ?? null;
  if (enVoice) utt.voice = enVoice;

  utt.rate  = 0.88;
  utt.pitch = 0.80;
  utt.volume = 0.9;
  utt.onend = onEnd;
  window.speechSynthesis.speak(utt);
}

export function startAtcChatter({ callsign, destCode, altM, soundEnabled }) {
  if (!soundEnabled) return;
  active = true;
  let phaseIdx = 0;

  function schedule() {
    if (!active) return;
    const delay = (120 + Math.random() * 180) * 1000; // every 2-5 min
    atcTimeout = setTimeout(() => {
      if (!active) return;
      const phrase = buildPhrase(callsign, destCode, altM, phaseIdx++);
      playSquelch(true);
      setTimeout(() => {
        speak(phrase, () => {
          setTimeout(() => playSquelch(false), 100);
        });
      }, 200);
      schedule();
    }, delay);
  }

  // First call after 30-90 seconds (not immediately)
  atcTimeout = setTimeout(() => {
    if (!active) return;
    const phrase = buildPhrase(callsign, destCode, altM, phaseIdx++);
    playSquelch(true);
    setTimeout(() => speak(phrase, () => setTimeout(() => playSquelch(false), 100)), 200);
    schedule();
  }, (30 + Math.random() * 60) * 1000);
}

export function stopAtcChatter() {
  active = false;
  clearTimeout(atcTimeout);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
