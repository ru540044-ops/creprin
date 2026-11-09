/** Web Audio: engine tone from rpm/gear, tyre squeal from slip, one-shot crash / door / ui sounds. Starts on the first user tap. */
import { settings } from './settings';
let C: AudioContext | null = null, master: GainNode, mainG: GainNode, musicG: GainNode; // master = effects bus; music and effects both feed mainG
let sir: OscillatorNode, sirG: GainNode, rainG: GainNode, cityG: GainNode, waveG: GainNode, windG: GainNode, birdT = 0, bugT = 0;
let eng1: OscillatorNode, eng2: OscillatorNode, engG: GainNode, engF: BiquadFilterNode, tireG: GainNode, tireF: BiquadFilterNode, noise: AudioBuffer;
export const audio = { muted: false };
/** Title-screen music (NEON FM) plays once the player has touched the screen. */
export const music = { title: false };

export function initAudio() {
  if (C) { if (C.state !== 'running') C.resume(); return; }
  try {
    C = new (window.AudioContext || (window as any).webkitAudioContext)();
    mainG = C.createGain(); mainG.connect(C.destination); master = C.createGain(); master.connect(mainG); musicG = C.createGain(); musicG.connect(mainG); applyVolumes();
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

export const audioCtx = () => (C ? { C, master, noise, music: musicG } : null);
/** Apply the volume sliders from settings (master / music / effects). */
export function applyVolumes() { if (!C) return; const t = C.currentTime; mainG.gain.setTargetAtTime(settings.master, t, 0.05); musicG.gain.setTargetAtTime(settings.music, t, 0.05); master.gain.setTargetAtTime(settings.sfx, t, 0.05); }
/** Freeze all sound while the game is paused (and resume it after). */
export function pauseAudio(on: boolean) { if (!C) return; try { if (on) C.suspend(); else C.resume(); } catch { /* ignore */ } }

export function engine(on: boolean, rpm: number, gear: number, thr: number, slip: number, kind: string) {
  if (!C) return; const t = C.currentTime, m = audio.muted ? 0 : 1;
  const base = kind === 'jet' ? 70 : kind === 'yacht' ? 22 : kind === 'speedboat' ? 34 : kind === 'jetski' ? 62 : kind === 'formula' ? 80 : kind === 'heli' ? 18 : kind === 'truck' ? 28 : kind === 'bike' ? 70 : kind === 'super' || kind === 'hyper' ? 48 : kind === 'muscle' ? 30 : 38, span = kind === 'jet' ? 420 : kind === 'yacht' ? 30 : kind === 'formula' ? 330 : kind === 'jetski' ? 190 : kind === 'heli' ? 26 : kind === 'bike' ? 230 : kind === 'truck' ? 70 : kind === 'hyper' ? 190 : 150;
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

/* ---------- the bullet train: inverter whine, rolling rumble, wind, rail joints, the tunnel; chimes; trains passing by ---------- */
let TR: { inv: OscillatorNode; inv2: OscillatorNode; invF: BiquadFilterNode; invG: GainNode; rollF: BiquadFilterNode; rollG: GainNode; windF: BiquadFilterNode; windG: GainNode; byF: BiquadFilterNode; byG: GainNode; byO: OscillatorNode; byOG: GainNode; dist: number; tun: number } | null = null;
function trainNodes() {
  if (!C) return null; if (TR) return TR;
  const c = C, loop = (type: BiquadFilterType, f: number, q: number) => { const s = c.createBufferSource(); s.buffer = noise; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(0, Math.random() * 1.5); return [fl, g] as const; };
  const inv = c.createOscillator(), inv2 = c.createOscillator(), invF = c.createBiquadFilter(), invG = c.createGain(), g2 = c.createGain();
  inv.type = 'sawtooth'; inv2.type = 'square'; invF.type = 'bandpass'; invF.Q.value = 2.5; invF.frequency.value = 1200; invG.gain.value = 0; g2.gain.value = 0.35;
  inv.connect(invF); inv2.connect(g2); g2.connect(invF); invF.connect(invG); invG.connect(master); inv.start(); inv2.start();
  const [rollF, rollG] = loop('lowpass', 200, 0.8), [windF, windG] = loop('bandpass', 900, 0.6), [byF, byG] = loop('lowpass', 400, 0.7);
  const byO = c.createOscillator(), byOG = c.createGain(); byO.type = 'triangle'; byOG.gain.value = 0; byO.connect(byOG); byOG.connect(master); byO.start();
  TR = { inv, inv2, invF, invG, rollF, rollG, windF, windG, byF, byG, byO, byOG, dist: 0, tun: 0 };
  return TR;
}
/** One wheel over a rail joint: a short metallic click with a thump under it. */
function clack(at: number, vol: number) {
  if (!C) return; const s = C.createBufferSource(); s.buffer = noise; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.5; const g = C.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06); s.connect(f); f.connect(g); g.connect(master); s.start(at, Math.random() * 1.5); s.stop(at + 0.08);
  const o = C.createOscillator(), g2 = C.createGain(); o.frequency.setValueAtTime(95, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.07); g2.gain.setValueAtTime(vol * 0.9, at); g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.08); o.connect(g2); g2.connect(master); o.start(at); o.stop(at + 0.09);
}
/** Driving the bullet train, every frame: the VVVF inverter (an asynchronous whine pulling away, then a tone rising with the motors,
 *  loud while powering or braking on the motors), the rolling rumble and the wind growing with speed, the rail joints, and the
 *  roar and pressure thump of the tunnel. */
export function trainSound(on: boolean, kmh: number, thr: number, brake: number, tunnel: number, dt: number) {
  if (!C || (!on && !TR)) return; const R = trainNodes(); if (!R) return;
  const t = C.currentTime, m = audio.muted ? 0 : 1, v = Math.max(0, kmh), s = Math.min(1, v / 300), work = on ? Math.min(1, Math.max(thr, brake * 0.8)) : 0;
  const motor = 55 + v * 5.4, carrier = v < 22 ? 1050 + v * 6 : v < 75 ? 620 + (v - 22) * 14 : motor * 2;
  R.inv.frequency.setTargetAtTime(motor, t, 0.05); R.inv2.frequency.setTargetAtTime(carrier, t, 0.05); R.invF.frequency.setTargetAtTime(Math.min(4200, 600 + v * 10), t, 0.1);
  R.invG.gain.setTargetAtTime(on && v > 0.3 ? m * work * (0.03 + 0.03 * Math.min(1, v / 80)) * (1 - 0.45 * s) : 0, t, 0.12);
  R.rollF.frequency.setTargetAtTime(130 + v * 2.4 - tunnel * 30, t, 0.2);
  R.rollG.gain.setTargetAtTime(on ? m * Math.min(1, v / 50) * (0.045 + 0.07 * s) * (1 + 1.7 * tunnel) : 0, t, 0.15);
  R.windF.frequency.setTargetAtTime(450 + v * 5, t, 0.2);
  R.windG.gain.setTargetAtTime(on ? m * s * s * 0.1 * (1 + 1.3 * tunnel) : 0, t, 0.2);
  if (on && v > 3 && m) { R.dist += (v / 3.6) * dt; if (R.dist > 50) { R.dist -= 50; const sp = v / 3.6, vol = (0.035 + 0.06 * Math.min(1, v / 150)) * (1 + tunnel); for (const d of [0, 2.5, 17.5, 20]) clack(t + d / sp, vol); } }
  if (on && m && v > 40 && (tunnel > 0.5) !== (R.tun > 0.5)) { // the pressure wave going in or out of the bore
    const S = C.createBufferSource(); S.buffer = noise; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.9); const g = C.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * Math.min(1, v / 200), t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0); S.connect(f); f.connect(g); g.connect(master); S.start(t, Math.random()); S.stop(t + 1.05);
  }
  R.tun = tunnel;
}
/** A train near you on foot (on the viaduct, at the platform): rumble and motor tone, vol 0..1 by distance. */
export function trainBy(vol: number, kmh: number) {
  if (!C || (vol <= 0.001 && !TR)) return; const R = trainNodes(); if (!R) return;
  const t = C.currentTime, m = audio.muted ? 0 : 1;
  R.byF.frequency.setTargetAtTime(220 + kmh * 7, t, 0.2); R.byG.gain.setTargetAtTime(m * vol * (0.03 + Math.min(0.16, (kmh / 300) * 0.3)), t, 0.15);
  R.byO.frequency.setTargetAtTime(70 + kmh * 5.4, t, 0.1); R.byOG.gain.setTargetAtTime(m * vol * (kmh > 2 ? 0.018 : 0), t, 0.15);
}
/** Station and in-train chimes (original tunes): 'door' (two tones as the doors open), 'announce' (four rising notes before an
 *  announcement), 'depart' (the platform departure melody, then the door-closing beeps). */
export function chime(kind: 'door' | 'announce' | 'depart') {
  if (!C || audio.muted) return; const c = C, t = c.currentTime;
  const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const note = (f: number, at: number, len: number, vol: number, type: OscillatorType = 'sine') => {
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(); o.type = type; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.005; g2.gain.value = 0.22;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.start(at); o2.start(at); o.stop(at + len + 0.05); o2.stop(at + len + 0.05);
  };
  if (kind === 'door') { note(N(84), t, 0.9, 0.11); note(N(79), t + 0.42, 1.2, 0.11); return; }
  if (kind === 'announce') { [76, 79, 84, 88].forEach((n, i) => note(N(n), t + i * 0.15, 0.9, 0.07)); return; }
  const mel: [number, number][] = [[79, 0], [84, 0.24], [88, 0.48], [86, 0.72], [84, 0.96], [81, 1.2], [83, 1.44], [79, 1.68], [81, 1.92], [84, 2.16], [88, 2.4], [91, 2.64], [89, 2.88], [88, 3.12], [86, 3.36], [84, 3.6]];
  for (const [n, d] of mel) note(N(n), t + d, 0.6, 0.065);
  for (let k = 0; k < 3; k++) note(N(81), t + 4.5 + k * 0.45, 0.22, 0.05, 'square');
}
