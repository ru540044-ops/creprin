import { audioCtx, audio } from './audio';

/**
 * The score: an adaptive underscore played on the music bus whenever the car radio is not. Everything is made on the
 * Web Audio clock from a handful of voices (a bowed drone, plucked strings, a breathy flute, taiko-like drums, a low
 * pulse) laid over a Japanese pentatonic scale, and the mix follows what is happening: easy and open by day, thin and
 * low at night, edgy when the police are looking, driving when you are chased, still inside a shop.
 * Each city has its own scale and root, so a walk through Naha does not sound like a walk through Nara.
 */
export type Mood = 'off' | 'day' | 'night' | 'wary' | 'chase' | 'ride';
export interface ScoreIn { on: boolean; hour: number; wanted: number; chase: boolean; indoors: boolean; riding: boolean; radio: boolean; region: string; dt: number }

// semitones above the root
const SCALES: Record<string, number[]> = { yo: [0, 2, 5, 7, 9], miyako: [0, 1, 5, 7, 8], ryukyu: [0, 4, 5, 7, 11] };
const REGION: Record<string, { root: number; day: string; night: string; bell?: boolean }> = {
  tokyo: { root: 50, day: 'yo', night: 'miyako' }, osaka: { root: 52, day: 'yo', night: 'miyako' }, nara: { root: 48, day: 'miyako', night: 'miyako', bell: true },
  fukuoka: { root: 53, day: 'yo', night: 'miyako' }, naha: { root: 55, day: 'ryukyu', night: 'ryukyu' },
};
// what each layer does in each mood (0..1)
const MIX: Record<Mood, Record<string, number>> = {
  off: { pad: 0, pluck: 0, breath: 0, drum: 0, pulse: 0, tension: 0 },
  day: { pad: 0.55, pluck: 0.8, breath: 0.5, drum: 0, pulse: 0, tension: 0 },
  night: { pad: 0.7, pluck: 0.45, breath: 0.35, drum: 0, pulse: 0, tension: 0.12 },
  wary: { pad: 0.35, pluck: 0.25, breath: 0, drum: 0.3, pulse: 0.35, tension: 0.7 },
  chase: { pad: 0.2, pluck: 0, breath: 0, drum: 1, pulse: 1, tension: 0.55 },
  ride: { pad: 0.5, pluck: 0.45, breath: 0.4, drum: 0, pulse: 0, tension: 0 },
};
const BPM: Record<Mood, number> = { off: 60, day: 62, night: 50, wary: 88, chase: 136, ride: 56 };
const LEVEL = 0.9; // the whole score against the radio and effects

const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
let A: ReturnType<typeof audioCtx> = null;
let master: GainNode | null = null, ana: AnalyserNode | null = null;
const layer: Record<string, GainNode> = {};
let mood: Mood = 'off', want: Mood = 'off', hold = 0, nextT = 0, step = 0, rng = 1, walk = 2, last = '';
const notes = { scheduled: 0, perLayer: {} as Record<string, number> };
const rnd = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };

function ensure() {
  A = audioCtx(); if (!A || master) return !!A;
  master = A.C.createGain(); master.gain.value = 0; master.connect(A.music);
  ana = A.C.createAnalyser(); ana.fftSize = 512; master.connect(ana);
  for (const k of Object.keys(MIX.day)) { const g = A.C.createGain(); g.gain.value = 0; g.connect(master); layer[k] = g; }
  return true;
}
/** One note on a layer. */
function voice(l: string, type: OscillatorType, f: number, t: number, dur: number, vol: number, cut: number, attack = 0.01, o2?: { type: OscillatorType; ratio: number; vol: number }, vib = 0, bend = 0) {
  if (!A) return; const C = A.C;
  const o = C.createOscillator(), g = C.createGain(), fl = C.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f * (1 + bend), t); if (bend) o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  fl.type = 'lowpass'; fl.frequency.value = cut;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(layer[l]); o.start(t); o.stop(t + dur + 0.05);
  if (o2) { const q = C.createOscillator(), qg = C.createGain(); q.type = o2.type; q.frequency.value = f * o2.ratio; qg.gain.setValueAtTime(0.0001, t); qg.gain.exponentialRampToValueAtTime(vol * o2.vol, t + attack); qg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7); q.connect(qg); qg.connect(layer[l]); q.start(t); q.stop(t + dur + 0.05); }
  if (vib) { const v = C.createOscillator(), vg = C.createGain(); v.frequency.value = 5.2; vg.gain.value = vib; v.connect(vg); vg.connect(o.detune); v.start(t); v.stop(t + dur + 0.05); }
  notes.scheduled++; notes.perLayer[l] = (notes.perLayer[l] || 0) + 1;
}
function thump(l: string, t: number, v: number, low = 70) {
  if (!A) return; const C = A.C, o = C.createOscillator(), g = C.createGain();
  o.frequency.setValueAtTime(low * 1.9, t); o.frequency.exponentialRampToValueAtTime(low * 0.55, t + 0.22);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.8 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g); g.connect(layer[l]); o.start(t); o.stop(t + 0.5);
  const s = C.createBufferSource(); s.buffer = A.noise; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; const ng = C.createGain();
  ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.25 * v, t + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); s.connect(f); f.connect(ng); ng.connect(layer[l]); s.start(t, rnd()); s.stop(t + 0.15);
  notes.scheduled++; notes.perLayer[l] = (notes.perLayer[l] || 0) + 1;
}

/** Schedule one 16th-note step. */
function play(s: number, t: number, dur: number) {
  const R = REGION[last] || REGION.tokyo, sc = SCALES[mood === 'night' || mood === 'wary' || mood === 'chase' ? R.night : R.day], root = R.root, bar = Math.floor(s / 16), k = s % 16;
  const deg = (d: number, oct = 0) => root + 12 * (oct + Math.floor(d / sc.length)) + sc[((d % sc.length) + sc.length) % sc.length];
  // pad: a bowed fifth held for two bars
  if (k === 0 && bar % 2 === 0) { const L = dur * 32; for (const n of [root - 12, root - 5, root + 7]) { voice('pad', 'triangle', hz(n), t, L, 0.07, 700, L * 0.4, { type: 'sine', ratio: 2.003, vol: 0.5 }); voice('pad', 'sawtooth', hz(n), t, L, 0.012, 500, L * 0.45); } }
  // tension: a low minor second that grates
  if (k === 0 && bar % 2 === 0) { voice('tension', 'sawtooth', hz(root - 24), t, dur * 32, 0.05, 260, dur * 6); voice('tension', 'sawtooth', hz(root - 23), t, dur * 32, 0.035, 240, dur * 8); }
  // pluck: a stringed instrument, sparse, wandering up and down the scale
  if (k % 2 === 0 && rnd() < (mood === 'night' ? 0.16 : 0.24) && bar % 4 !== 3) {
    walk = Math.max(-1, Math.min(9, walk + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.25 ? 2 : 1)));
    voice('pluck', 'triangle', hz(deg(walk, 1)), t, 1.3, 0.2, 2600, 0.004, { type: 'sine', ratio: 2, vol: 0.35 }, 0, 0.012);
    if (R.bell && rnd() < 0.3) voice('pluck', 'sine', hz(deg(walk, 2) + 0.2), t + 0.02, 2.6, 0.05, 5000, 0.003, { type: 'sine', ratio: 2.76, vol: 0.5 });
  }
  // breath: a flute-like line, a long note every few bars, falling away
  if (k === 0 && bar % 3 === 1 && rnd() < 0.8) {
    const d = [2, 3, 4][Math.floor(rnd() * 3)], f = hz(deg(d, 1)), L = dur * 12;
    voice('breath', 'sine', f, t, L, 0.11, 3200, 0.22, { type: 'triangle', ratio: 1.0, vol: 0.15 }, 14, -0.02);
    if (A) { const C = A.C, s2 = C.createBufferSource(); s2.buffer = A.noise; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + L); s2.connect(bp); bp.connect(g); g.connect(layer.breath); s2.start(t, rnd()); s2.stop(t + L + 0.05); }
  }
  // drums: a big drum on the beat; faster and doubled when chased
  if (mood === 'chase') { if (k % 4 === 0) thump('drum', t, 1, 62); else if (k % 4 === 2 && (bar % 2 || k === 10)) thump('drum', t, 0.55, 90); else if (k === 7 || k === 15) thump('drum', t, 0.4, 110); }
  else if (mood === 'wary') { if (k === 0 || (k === 8 && bar % 2)) thump('drum', t, 0.8, 66); }
  // pulse: a low repeated note
  if (mood === 'chase' && k % 2 === 0) voice('pulse', 'sawtooth', hz(root - 12 + (bar % 4 === 3 && k >= 8 ? sc[1] : 0)), t, dur * 1.6, 0.16, 360, 0.004);
  else if (mood === 'wary' && k % 4 === 0) voice('pulse', 'sawtooth', hz(root - 12), t, dur * 3, 0.1, 300, 0.01);
}

/** A short musical phrase for something that just happened: 'win' rises, 'fail' falls, 'start' is a drum and a falling flute. */
export function scoreSting(kind: 'win' | 'fail' | 'start') {
  if (audio.muted || !ensure() || !A) return;
  const C = A.C, t = C.currentTime + 0.05, R = REGION[last] || REGION.tokyo, sc = SCALES[kind === 'fail' ? R.night : R.day], root = R.root;
  if (!layer.sting) { const g = C.createGain(); g.gain.value = 1; g.connect(master!); layer.sting = g; }
  const bump = master!.gain.value; master!.gain.cancelScheduledValues(t); master!.gain.setValueAtTime(Math.max(bump, 0.5 * LEVEL), t); master!.gain.setTargetAtTime(bump, t + 3, 0.8); // lift the whole mix for the length of the phrase
  if (kind === 'win') { [0, 1, 2, 3, 4, 5].forEach((i) => { const n = root + 12 + sc[i % 5] + 12 * Math.floor(i / 5); voice('sting', 'triangle', hz(n), t + i * 0.13, 1.8, 0.22, 3000, 0.004, { type: 'sine', ratio: 2, vol: 0.4 }); }); voice('sting', 'sine', hz(root + 24), t + 0.8, 3.2, 0.08, 4000, 0.01, { type: 'sine', ratio: 2.76, vol: 0.5 }); thump('sting', t, 0.9, 64); }
  else if (kind === 'fail') { [4, 3, 1, 0].forEach((i, j) => voice('sting', 'sawtooth', hz(root + sc[i]), t + j * 0.28, 1.4, 0.1, 700, 0.03)); thump('sting', t + 0.9, 1, 48); }
  else { thump('sting', t, 1, 60); voice('sting', 'sine', hz(root + 24 + sc[4]), t + 0.15, 2.4, 0.12, 3000, 0.12, undefined, 10, 0.04); }
}

/** Called every frame. */
export function scoreTick(i: ScoreIn) {
  if (audio.muted || !ensure() || !A || !master) return;
  const C = A.C;
  if (i.region) last = i.region;
  // what is going on
  let m: Mood = !i.on || i.radio ? 'off' : i.indoors ? 'off' : i.riding ? 'ride' : i.chase || i.wanted >= 2 ? 'chase' : i.wanted === 1 ? 'wary' : i.hour > 19 || i.hour < 5.5 ? 'night' : 'day';
  // a scare lingers: do not drop out of the chase the instant the stars go
  if (m === 'chase') hold = 7; else if (hold > 0 && (m === 'wary' || m === 'day' || m === 'night')) { hold -= i.dt; if (hold > 0) m = 'chase'; }
  want = m;
  if (want !== mood) { if (want === 'off' || mood === 'off') { nextT = C.currentTime + 0.2; step = 0; } mood = want; }
  const mix = MIX[mood], t = C.currentTime;
  master.gain.setTargetAtTime(mood === 'off' ? 0 : LEVEL, t, mood === 'off' ? 0.6 : 1.5);
  for (const k of Object.keys(mix)) layer[k].gain.setTargetAtTime(mix[k], t, mood === 'chase' ? 0.4 : 1.8);
  if (mood === 'off') return;
  const dur = 60 / BPM[mood] / 4;
  // notes are scheduled up to a second ahead, so a slow frame (a busy phone) does not leave gaps; after a real stall (a background tab) carry on from now rather than playing the backlog at once
  if (nextT < t - 1.5) nextT = t + 0.1;
  for (let n = 0; nextT < t + 1.0 && n < 24; n++) { play(step, nextT, dur); nextT += dur; step++; }
}

let peak = 0;
/** Read the output level now and keep the loudest reading since the last call to scoreState() (a single read only sees ~10 ms). */
export function scoreSample() { if (!ana) return 0; const b = new Float32Array(ana.fftSize); ana.getFloatTimeDomainData(b); let r = 0; for (const v of b) r += v * v; r = Math.sqrt(r / b.length); if (r > peak) peak = r; return r; }
/** What the score is doing (tests / debugging). */
export function scoreState() {
  const gains: Record<string, number> = {}; for (const k of Object.keys(layer)) gains[k] = +layer[k].gain.value.toFixed(3);
  scoreSample(); const rms = peak; peak = 0;
  return { time: A ? +A.C.currentTime.toFixed(2) : 0, mood, want, master: master ? +master.gain.value.toFixed(3) : 0, gains, rms: +rms.toFixed(5), notes: notes.scheduled, perLayer: { ...notes.perLayer }, region: last, ctx: A ? A.C.state : 'none' };
}
