// MP3-backed audio service — manages all real audio files
const BASE = '/sounds/';

const tracks = {};
let chimedOnce = false;

function getOrCreate(key, src, { loop = false, volume = 1 } = {}) {
  if (!tracks[key]) {
    const a = new Audio(BASE + src);
    a.preload = 'auto';
    a.loop = loop;
    a.volume = volume;
    tracks[key] = a;
  }
  return tracks[key];
}

export function preloadSounds() {
  getOrCreate('airport', 'airport-ambience.mp3', { loop: true, volume: 0 });
  getOrCreate('cabin', 'cabin-ambience.mp3', { loop: true, volume: 0 });
  getOrCreate('chime', 'chime.mp3', { volume: 0.7 });
}

// ── Boarding chime (short, play once) ───────────────────────────────
export function playChime() {
  try {
    const a = getOrCreate('chime', 'chime.mp3', { volume: 0.7 });
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

// ── Landing sound (play once on session complete) ───────────────────
export function playLanding() {
  try {
    const a = getOrCreate('landing', 'landing.mp3', { volume: 0.6 });
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

// ── Cabin ambience (loops during work) ─────────────────────────────
let cabinFadeTimer = null;
export function startCabinAmbience(volume = 0.12) {
  try {
    const a = getOrCreate('cabin', 'cabin-ambience.mp3', { loop: true, volume: 0 });
    a.play().catch(() => {});
    // Fade in
    clearInterval(cabinFadeTimer);
    let v = 0;
    cabinFadeTimer = setInterval(() => {
      v = Math.min(v + 0.01, volume);
      a.volume = v;
      if (v >= volume) clearInterval(cabinFadeTimer);
    }, 80);
  } catch {}
}

export function stopCabinAmbience() {
  try {
    const a = tracks['cabin'];
    if (!a) return;
    clearInterval(cabinFadeTimer);
    let v = a.volume;
    cabinFadeTimer = setInterval(() => {
      v = Math.max(v - 0.015, 0);
      a.volume = v;
      if (v <= 0) { a.pause(); clearInterval(cabinFadeTimer); }
    }, 80);
  } catch {}
}

// ── Airport ambience (loops during break) ──────────────────────────
let airportFadeTimer = null;
export function startAirportAmbience(volume = 0.18) {
  try {
    const a = getOrCreate('airport', 'airport-ambience.mp3', { loop: true, volume: 0 });
    const promise = a.play();
    clearInterval(airportFadeTimer);
    let v = 0;
    airportFadeTimer = setInterval(() => {
      v = Math.min(v + 0.012, volume);
      a.volume = v;
      if (v >= volume) clearInterval(airportFadeTimer);
    }, 80);
    return promise; // caller can .catch() if autoplay blocked
  } catch {
    return Promise.reject(new Error('audio unavailable'));
  }
}

export function stopAirportAmbience() {
  try {
    const a = tracks['airport'];
    if (!a) return;
    clearInterval(airportFadeTimer);
    let v = a.volume;
    airportFadeTimer = setInterval(() => {
      v = Math.max(v - 0.02, 0);
      a.volume = v;
      if (v <= 0) { a.pause(); clearInterval(airportFadeTimer); }
    }, 80);
  } catch {}
}

// ── ATC radio (toggle on demand) ────────────────────────────────────
let atcActive = false;
let atcFadeTimer = null;

export function isAtcPlaying() {
  return atcActive;
}

export function startAtcRadio(volume = 0.32) {
  try {
    const a = getOrCreate('atc', 'atc-radio.mp3', { loop: true, volume: 0 });
    a.play().catch(() => {});
    atcActive = true;
    clearInterval(atcFadeTimer);
    let v = 0;
    atcFadeTimer = setInterval(() => {
      v = Math.min(v + 0.02, volume);
      a.volume = v;
      if (v >= volume) clearInterval(atcFadeTimer);
    }, 60);
  } catch {}
}

export function stopAtcRadio() {
  try {
    const a = tracks['atc'];
    if (!a) return;
    atcActive = false;
    clearInterval(atcFadeTimer);
    let v = a.volume;
    atcFadeTimer = setInterval(() => {
      v = Math.max(v - 0.025, 0);
      a.volume = v;
      if (v <= 0) { a.pause(); clearInterval(atcFadeTimer); }
    }, 60);
  } catch {}
}

export function toggleAtcRadio() {
  if (atcActive) stopAtcRadio();
  else startAtcRadio();
  return !atcActive;
}

// ── Cockpit mode: cabin bg + ATC bursts ─────────────────────────────
let cockpitTimer = null;
let cockpitAtcEl = null;

function playCockpitAtcBurst(vol = 0.30) {
  try {
    if (!cockpitAtcEl) {
      cockpitAtcEl = new Audio(BASE + 'atc-radio.mp3');
      cockpitAtcEl.loop = false;
    }
    cockpitAtcEl.currentTime = 0;
    cockpitAtcEl.volume = vol;
    cockpitAtcEl.play().catch(() => {});
  } catch {}
}

export function startCockpitMode() {
  // Quiet cabin rumble underneath
  startCabinAmbience(0.07);

  // ATC burst immediately on start
  playCockpitAtcBurst(0.34);

  // Schedule intermittent bursts every 75–150 s
  const scheduleNext = () => {
    cockpitTimer = setTimeout(() => {
      playCockpitAtcBurst(0.24 + Math.random() * 0.12);
      scheduleNext();
    }, 75000 + Math.random() * 75000);
  };
  scheduleNext();
}

export function stopCockpitMode() {
  clearTimeout(cockpitTimer);
  cockpitTimer = null;
  stopCabinAmbience();
  if (cockpitAtcEl) {
    cockpitAtcEl.pause();
    cockpitAtcEl.currentTime = 0;
  }
}

export function isCockpitMode(seat) {
  return seat === 'KOKPIT';
}

// ── Global mute (silences without stopping — resumes on unmute) ─────
let globalMuted = false;
export function muteAll() {
  globalMuted = true;
  Object.values(tracks).forEach(a => { a.muted = true; });
  if (cockpitAtcEl) cockpitAtcEl.muted = true;
}
export function unmuteAll() {
  globalMuted = false;
  Object.values(tracks).forEach(a => { a.muted = false; });
  if (cockpitAtcEl) cockpitAtcEl.muted = false;
}
export function isGloballyMuted() { return globalMuted; }

// ── Stop all ────────────────────────────────────────────────────────
export function stopAll() {
  stopCabinAmbience();
  stopAirportAmbience();
  stopAtcRadio();
  stopCockpitMode();
  chimedOnce = false;
}
