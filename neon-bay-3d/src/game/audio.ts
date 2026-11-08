/** Web Audio: engine tone from rpm/gear, tyre squeal from slip, one-shot crash / door / ui sounds. Starts on the first user tap. */
let C: AudioContext | null = null, master: GainNode;
let sir: OscillatorNode, sirG: GainNode, rainG: GainNode, cityG: GainNode, waveG: GainNode, windG: GainNode, birdT = 0, bugT = 0;
let eng1: OscillatorNode, eng2: OscillatorNode, engG: GainNode, engF: BiquadFilterNode, tireG: GainNode, tireF: BiquadFilterNode, noise: AudioBuffer;
export const audio = { muted: false };

export function initAudio() {
  if (C) { if (C.state !== 'running') C.resume(); return; }
  try {
    C = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = C.createGain(); master.gain.value = 0.9; master.connect(C.destination);
    noise = C.createBuffer(1, C.sampleRate * 2, C.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engF = C.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 900; engG = C.createGain(); engG.gain.value = 0;
    eng1 = C.createOscillator(); eng1.type = 'sawtooth'; eng2 = C.createOscillator(); eng2.type = 'square';
    const g2 = C.createGain(); g2.gain.value = 0.35; eng1.connect(engF); eng2.connect(g2); g2.connect(engF); engF.connect(engG); engG.connect(master); eng1.start(); eng2.start();
    const src = C.createBufferSource(); src.buffer = noise; src.loop = true; tireF = C.createBiquadFilter(); tireF.type = 'bandpass'; tireF.frequency.value = 2200; tireF.Q.value = 4;
    tireG = C.createGain(); tireG.gain.value = 0; src.connect(tireF); tireF.connect(tireG); tireG.connect(master); src.start();
    sir = C.createOscillator(); sir.type = 'sawtooth'; const sf = C.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2400; sirG = C.createGain(); sirG.gain.value = 0;
    sir.connect(sf); sf.connect(sirG); sirG.connect(master); sir.start();
    // ambient beds: distant city rumble, surf, wind (all looped noise through filters)
    const bed = (type: BiquadFilterType, f: number, q = 0.7) => { const s = C!.createBufferSource(); s.buffer = noise; s.loop = true; const fl = C!.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = C!.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(0, Math.random() * 1.5); return g; };
    cityG = bed('lowpass', 260); waveG = bed('bandpass', 520, 0.5); windG = bed('bandpass', 900, 0.4);
    const rs = C.createBufferSource(); rs.buffer = noise; rs.loop = true; const rf = C.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1200; rainG = C.createGain(); rainG.gain.value = 0; rs.connect(rf); rf.connect(rainG); rainG.connect(master); rs.start();
  } catch { C = null; }
}

export const audioCtx = () => (C ? { C, master, noise } : null);

export function engine(on: boolean, rpm: number, gear: number, thr: number, slip: number, kind: string) {
  if (!C) return; const t = C.currentTime, m = audio.muted ? 0 : 1;
  const base = kind === 'heli' ? 18 : kind === 'truck' ? 28 : kind === 'bike' ? 70 : kind === 'super' || kind === 'hyper' ? 48 : kind === 'muscle' ? 30 : 38, span = kind === 'heli' ? 26 : kind === 'bike' ? 230 : kind === 'truck' ? 70 : kind === 'hyper' ? 190 : 150;
  const f = base + rpm * span + gear * 6;
  eng1.frequency.setTargetAtTime(f, t, 0.05); eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  engF.frequency.setTargetAtTime(500 + rpm * 1600 + thr * 600, t, 0.08);
  engG.gain.setTargetAtTime(on ? (0.05 + thr * 0.05 + rpm * 0.04) * m : 0, t, 0.08);
  tireG.gain.setTargetAtTime(on ? Math.min(0.16, Math.max(0, slip - 3) * 0.025) * m : 0, t, 0.06);
}

/** Police siren: a wailing tone whose volume follows the nearest pursuing car (0..1). */
export function siren(vol: number) {
  if (!C || !sir) return; const t = C.currentTime, w = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.42);
  sir.frequency.setTargetAtTime(640 + w * 520, t, 0.03);
  sirG.gain.setTargetAtTime(audio.muted ? 0 : vol * vol * 0.09, t, 0.1);
}

/** Rain hiss volume (0..1). */
export function rainSound(v: number) { if (!C || !rainG) return; rainG.gain.setTargetAtTime(audio.muted ? 0 : v * 0.12, C.currentTime, 0.5); }

/** Ambient soundscape, called every frame. city: 0..1 how urban, sea: 0..1 how close to the surf. */
export function ambience(o: { out: boolean; inCar: boolean; day: number; city: number; sea: number; height: number; dt: number }) {
  if (!C || !cityG) return; const t = C.currentTime, m = audio.muted ? 0 : 1, damp = o.out ? (o.inCar ? 0.45 : 1) : 0.15;
  cityG.gain.setTargetAtTime(m * damp * (0.05 + 0.07 * o.city) * (0.75 + 0.25 * o.day), t, 0.4);
  waveG.gain.setTargetAtTime(m * damp * o.sea * (0.07 + 0.06 * Math.max(0, Math.sin(t * 0.9))) , t, 0.3);
  windG.gain.setTargetAtTime(m * damp * Math.min(0.08, 0.012 + o.height * 0.0006), t, 0.5);
  if (!o.out || o.inCar || audio.muted) return;
  birdT -= o.dt; bugT -= o.dt;
  if (o.day > 0.5 && birdT <= 0) { birdT = 1.5 + Math.random() * 4; chirp(2600 + Math.random() * 1600, 0.025 * (1 - o.city * 0.6)); }
  if (o.day < 0.3 && bugT <= 0) { bugT = 0.9 + Math.random() * 1.6; for (let k = 0; k < 4; k++) chirp(4300 + Math.random() * 300, 0.008, t + k * 0.07, 0.04); }
}
function chirp(f: number, vol: number, at?: number, len = 0.09) {
  if (!C) return; const t = at ?? C.currentTime, o = C.createOscillator(), g = C.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.15 + Math.random() * 0.3), t + len * 0.6); o.frequency.exponentialRampToValueAtTime(f * 0.9, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.02);
}

export function sfx(kind: 'crash' | 'door' | 'buy' | 'ui' | 'shot' | 'boom' | 'thunder' | 'step', vol = 1) {
  if (!C || audio.muted) return; const t = C.currentTime;
  if (kind === 'step') { const s = C.createBufferSource(); s.buffer = noise; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 1.2; const g = C.createGain(); g.gain.setValueAtTime(0.11 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + 0.08); return; }
  if (kind === 'boom' || kind === 'thunder') { // deep blast / rolling thunder
    const len = kind === 'boom' ? 1.6 : 3.2, s = C.createBufferSource(); s.buffer = noise; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(kind === 'boom' ? 1400 : 500, t); f.frequency.exponentialRampToValueAtTime(90, t + len); const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * vol, t + (kind === 'boom' ? 0.01 : 0.3)); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + len);
    if (kind === 'boom') { const o = C.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(25, t + 0.6); const g2 = C.createGain(); g2.gain.setValueAtTime(0.8 * vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.75); } return; }
  if (kind === 'shot') { // sharp crack + body thump
    const s = C.createBufferSource(); s.buffer = noise; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; const g = C.createGain(); g.gain.setValueAtTime(0.55 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 0.2);
    const o = C.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); const g2 = C.createGain(); g2.gain.setValueAtTime(0.5 * vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.15); return; }
  if (kind === 'crash') { const s = C.createBufferSource(); s.buffer = noise; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const g = C.createGain(); g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.5);
    const o = C.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3); const g2 = C.createGain(); g2.gain.setValueAtTime(0.4 * vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.4); return; }
  const o = C.createOscillator(), g = C.createGain(); o.type = kind === 'door' ? 'square' : 'triangle';
  const f = kind === 'door' ? 180 : kind === 'buy' ? 880 : 620; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(kind === 'door' ? 90 : f * 1.5, t + 0.15);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
}
