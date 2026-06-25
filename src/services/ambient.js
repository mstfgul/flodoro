let ctx = null;
let master = null;
let nodes = [];

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function whiteNoise(audioCtx, durationSec = 4) {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * durationSec, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

export function startEngine(volume = 0.18) {
  if (master) return; // already running
  const audioCtx = getCtx();
  master = audioCtx.createGain();
  master.gain.setValueAtTime(0, audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 4);
  master.connect(audioCtx.destination);

  // ── Deep engine rumble ──
  const rumble = audioCtx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 58;
  const rumbleLp = audioCtx.createBiquadFilter();
  rumbleLp.type = 'lowpass';
  rumbleLp.frequency.value = 120;
  const rumbleGain = audioCtx.createGain();
  rumbleGain.gain.value = 0.25;
  rumble.connect(rumbleLp).connect(rumbleGain).connect(master);
  rumble.start();

  // ── Turbofan hum ──
  const hum = audioCtx.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 180;
  const humGain = audioCtx.createGain();
  humGain.gain.value = 0.08;
  hum.connect(humGain).connect(master);
  hum.start();

  // ── Cabin broadband noise ──
  const cabin = whiteNoise(audioCtx, 5);
  const cabinBp = audioCtx.createBiquadFilter();
  cabinBp.type = 'bandpass';
  cabinBp.frequency.value = 320;
  cabinBp.Q.value = 0.6;
  const cabinGain = audioCtx.createGain();
  cabinGain.gain.value = 0.55;
  cabin.connect(cabinBp).connect(cabinGain).connect(master);
  cabin.start();

  // ── Air rush (high-frequency) ──
  const air = whiteNoise(audioCtx, 3);
  const airHp = audioCtx.createBiquadFilter();
  airHp.type = 'highpass';
  airHp.frequency.value = 1800;
  const airGain = audioCtx.createGain();
  airGain.gain.value = 0.07;
  air.connect(airHp).connect(airGain).connect(master);
  air.start();

  // Slow LFO modulation on cabin to feel more alive
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain).connect(cabinGain.gain);
  lfo.start();

  nodes = [rumble, hum, cabin, air, lfo];
}

export function stopEngine() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.linearRampToValueAtTime(0, now + 2.5);
  setTimeout(() => {
    nodes.forEach(n => { try { n.stop(); } catch {} });
    try { master.disconnect(); } catch {}
    nodes = [];
    master = null;
  }, 3000);
}

export function setEngineVolume(vol) {
  if (master && ctx) {
    master.gain.linearRampToValueAtTime(Math.max(0, vol), ctx.currentTime + 0.5);
  }
}

// Short ascending chime — play when boarding
export function playBoardingChime() {
  const audioCtx = getCtx();
  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    const t = audioCtx.currentTime + i * 0.13;
    osc.frequency.value = f;
    osc.type = 'sine';
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.15, t + 0.06);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(env).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.8);
  });
}

// Two-tone "fasten seatbelt" ding — play on landing
export function playLandingDing() {
  const audioCtx = getCtx();
  const chimes = [[880, 0], [1108, 0.18], [880, 0.36]];
  chimes.forEach(([f, delay]) => {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    const t = audioCtx.currentTime + delay;
    osc.frequency.value = f;
    osc.type = 'sine';
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(env).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.9);
  });
}

// Break-end alert — ascending two-note
export function playBreakEndChime() {
  const audioCtx = getCtx();
  [[523, 0], [784, 0.15]].forEach(([f, d]) => {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    const t = audioCtx.currentTime + d;
    osc.frequency.value = f;
    osc.type = 'sine';
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(env).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
}
