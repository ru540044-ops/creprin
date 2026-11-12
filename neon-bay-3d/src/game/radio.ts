import { audioCtx, audio } from './audio';

/** Car radio: three procedurally sequenced stations (drums, bass, chords, lead) scheduled ahead on the Web Audio clock. */
export const STATIONS = [
  { name: 'NEON FM', genre: 'シンセウェーブ', bpm: 100, swing: 0 },
  { name: 'BAY LO-FI', genre: 'ローファイ・ヒップホップ', bpm: 80, swing: 0.16 },
  { name: 'PULSE 128', genre: 'テクノ', bpm: 128, swing: 0 },
];
const PROGS = [
  [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], // i VI III VII
  [[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 11, 14]], // i iv VI V
  [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [8, 12, 15, 19]], // minor 7ths
];
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let bus: GainNode | null = null, station = -1, nextT = 0, step = 0, prog = PROGS[0], root = 45, lead: number[] = [];

function voice(type: OscillatorType, f: number, t: number, dur: number, vol: number, cut: number, attack = 0.005, detune = 0) {
  const A = audioCtx()!; const o = A.C.createOscillator(), g = A.C.createGain(), fl = A.C.createBiquadFilter();
  o.type = type; o.frequency.value = f; o.detune.value = detune; fl.type = 'lowpass'; fl.frequency.value = cut;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(bus!); o.start(t); o.stop(t + dur + 0.05);
}
function kick(t: number, v = 1) { const A = audioCtx()!; const o = A.C.createOscillator(), g = A.C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.connect(g); g.connect(bus!); o.start(t); o.stop(t + 0.35); }
function noise(t: number, dur: number, vol: number, type: BiquadFilterType, f: number) { const A = audioCtx()!; const s = A.C.createBufferSource(); s.buffer = A.noise; const fl = A.C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = A.C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(bus!); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02); }
const snare = (t: number, v = 1) => { noise(t, 0.18, 0.35 * v, 'bandpass', 1900); voice('triangle', 190, t, 0.1, 0.25 * v, 2000); };
const hat = (t: number, v = 1, open = false) => noise(t, open ? 0.2 : 0.05, 0.11 * v, 'highpass', 7500);

function newSong() {
  prog = PROGS[Math.floor(Math.random() * PROGS.length)]; root = 43 + Math.floor(Math.random() * 6);
  lead = Array.from({ length: 16 }, () => (Math.random() < 0.35 ? -1 : Math.floor(Math.random() * 4)));
}

/** Schedule one 16th-note step for the current station. */
function play(s: number, t: number) {
  const bar = Math.floor(s / 16), k = s % 16, ch = prog[bar % prog.length], beat = k % 4 === 0;
  const r = root + ch[0];
  if (station === 0) { // synthwave
    if (k % 4 === 0) kick(t); if (k === 4 || k === 12) snare(t); if (k % 2 === 0) hat(t, 0.8);
    if (k % 2 === 0) voice('sawtooth', hz(r - 12), t, 0.22, 0.16, 700);
    if (k === 0) for (const n of ch) { voice('sawtooth', hz(root + 12 + n), t, 2.2, 0.035, 1600, 0.25, -8); voice('sawtooth', hz(root + 12 + n), t, 2.2, 0.035, 1600, 0.25, 8); }
    const l = lead[k]; if (l >= 0 && bar % 4 >= 2) voice('square', hz(root + 24 + ch[l % ch.length]), t, 0.18, 0.04, 2600);
  } else if (station === 1) { // lo-fi
    if (k === 0 || k === 7 || k === 10) kick(t, 0.8); if (k === 4 || k === 12) snare(t, 0.7); if (k % 2 === 0) hat(t, 0.6 + (k % 4 ? 0 : 0.2));
    if (k === 0 || k === 8) for (const n of ch) { voice('triangle', hz(root + 12 + n), t, 1.4, 0.05, 1400, 0.02); voice('sine', hz(root + 24 + n), t, 1.0, 0.02, 3000, 0.02); }
    if (k === 0 || k === 6 || k === 10) voice('sine', hz(r - 12), t, 0.5, 0.22, 400);
    const l = lead[k]; if (l >= 0 && k % 2 === 0 && bar % 2) voice('triangle', hz(root + 24 + ch[l % ch.length]), t, 0.35, 0.035, 1800);
  } else { // techno
    if (beat) kick(t); if (k % 4 === 2) hat(t, 1, k === 6 || k === 14); if (k % 4 === 2 || k % 4 === 3) hat(t, 0.4);
    if (k === 4 || k === 12) noise(t, 0.12, 0.18, 'bandpass', 1200);
    if (!beat) voice('sawtooth', hz(r - 12), t, 0.12, 0.13, 500 + (bar % 4) * 250);
    if (k === 3 || k === 11) for (const n of ch) voice('square', hz(root + 12 + n), t, 0.12, 0.03, 2200);
  }
}

/** Called every frame: on = the player is in a car with the radio on. */
export function radioTick(on: boolean, st: number) {
  const A = audioCtx(); if (!A) return;
  if (!bus) { bus = A.C.createGain(); bus.gain.value = 0; bus.connect(A.music); }
  const want = on && st > 0 && !audio.muted;
  bus.gain.setTargetAtTime(want ? 0.5 : 0, A.C.currentTime, 0.15);
  if (!want) { station = -1; return; }
  if (station !== st - 1) { station = st - 1; nextT = A.C.currentTime + 0.1; step = 0; newSong(); }
  const S = STATIONS[station], dur = 60 / S.bpm / 4;
  while (nextT < A.C.currentTime + 0.25) {
    const sw = step % 2 ? S.swing * dur : 0; play(step, nextT + sw); nextT += dur; step++;
    if (step % (16 * 16) === 0) newSong(); // a new song every 16 bars
  }
}
