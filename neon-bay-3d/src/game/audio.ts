/** Web Audio: engine tone from rpm/gear, tyre squeal from slip, one-shot crash / door / ui sounds. Starts on the first user tap. */
let C: AudioContext | null = null, master: GainNode;
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
  } catch { C = null; }
}

export function engine(on: boolean, rpm: number, gear: number, thr: number, slip: number, kind: string) {
  if (!C) return; const t = C.currentTime, m = audio.muted ? 0 : 1;
  const base = kind === 'truck' ? 28 : kind === 'bike' ? 70 : kind === 'super' ? 48 : 38, span = kind === 'bike' ? 230 : kind === 'truck' ? 70 : 150;
  const f = base + rpm * span + gear * 6;
  eng1.frequency.setTargetAtTime(f, t, 0.05); eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  engF.frequency.setTargetAtTime(500 + rpm * 1600 + thr * 600, t, 0.08);
  engG.gain.setTargetAtTime(on ? (0.05 + thr * 0.05 + rpm * 0.04) * m : 0, t, 0.08);
  tireG.gain.setTargetAtTime(on ? Math.min(0.16, Math.max(0, slip - 3) * 0.025) * m : 0, t, 0.06);
}

export function sfx(kind: 'crash' | 'door' | 'buy' | 'ui', vol = 1) {
  if (!C || audio.muted) return; const t = C.currentTime;
  if (kind === 'crash') { const s = C.createBufferSource(); s.buffer = noise; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const g = C.createGain(); g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.5);
    const o = C.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3); const g2 = C.createGain(); g2.gain.setValueAtTime(0.4 * vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.4); return; }
  const o = C.createOscillator(), g = C.createGain(); o.type = kind === 'door' ? 'square' : 'triangle';
  const f = kind === 'door' ? 180 : kind === 'buy' ? 880 : 620; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(kind === 'door' ? 90 : f * 1.5, t + 0.15);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
}
