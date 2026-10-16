'use strict';
// ===== サウンド（WebAudio で全部合成。音声ファイルなし） =====
const Sound = (() => {
  let ctx = null, master, sfx, music, noiseBuf;
  let engOsc, engOsc2, engFilter, engGain, sirenOsc, sirenGain;
  const STATIONS = [
    { name: 'NEON FM 88.3', sub: 'シンセウェイヴ', bpm: 100, kind: 'synth' },
    { name: 'BAY BEAT 101.7', sub: 'ハウス', bpm: 122, kind: 'house' },
    { name: 'RADIO OFF', sub: 'ラジオを切った', kind: 'off' },
  ];
  let station = 0, radioActive = false, nextTime = 0, step = 0;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0.3; music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth';
    engOsc2 = ctx.createOscillator(); engOsc2.type = 'square';
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 400;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilter); engOsc2.connect(engFilter); engFilter.connect(engGain); engGain.connect(sfx);
    engOsc.start(); engOsc2.start();

    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(sfx); sirenOsc.start();
    setInterval(schedule, 25);
  }

  function noise(t, dur, o = {}) {
    const { type = 'lowpass', freq = 1000, q = 0.7, gain = 0.5, attack = 0.002, dest = sfx, endFreq } = o;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
  }

  function tone(t, freq, dur, o = {}) {
    const { type = 'sine', gain = 0.3, endFreq, dest = sfx, attack = 0.005, lp } = o;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      osc.connect(f); f.connect(g);
    } else osc.connect(g);
    g.connect(dest); osc.start(t); osc.stop(t + dur + 0.05);
  }

  const now = () => ctx.currentTime;
  const S = {
    init,
    get ready() { return !!ctx; },
    shot(kind, vol = 1) {
      if (!ctx || vol < 0.02) return; const t = now();
      if (kind === 'shotgun') { noise(t, 0.4, { freq: 2400, gain: 0.9 * vol, endFreq: 250 }); tone(t, 120, 0.22, { type: 'triangle', gain: 0.5 * vol, endFreq: 40 }); }
      else if (kind === 'smg') noise(t, 0.09, { freq: 3800, gain: 0.45 * vol, endFreq: 700 });
      else if (kind === 'rocket') noise(t, 0.7, { type: 'bandpass', freq: 900, gain: 0.6 * vol, endFreq: 180 });
      else if (kind === 'punch') noise(t, 0.08, { freq: 500, gain: 0.6 * vol });
      else { noise(t, 0.18, { freq: 3200, gain: 0.7 * vol, endFreq: 450 }); tone(t, 190, 0.08, { type: 'square', gain: 0.12 * vol, endFreq: 60 }); }
    },
    boom(vol = 1) { if (!ctx) return; const t = now(); noise(t, 1.6, { freq: 1200, gain: 1.0 * vol, endFreq: 50 }); tone(t, 95, 0.9, { gain: 0.8 * vol, endFreq: 28 }); },
    crash(vol = 1) { if (!ctx) return; const t = now(); noise(t, 0.3, { type: 'bandpass', freq: 650, gain: 0.7 * vol, q: 1.2 }); tone(t, 75, 0.2, { type: 'triangle', gain: 0.4 * vol, endFreq: 40 }); },
    thud(vol = 1) { if (!ctx) return; const t = now(); noise(t, 0.15, { freq: 400, gain: 0.7 * vol }); tone(t, 90, 0.15, { gain: 0.5 * vol, endFreq: 50 }); },
    hit(vol = 1) { if (!ctx) return; const t = now(); tone(t, 320, 0.06, { type: 'square', gain: 0.08 * vol, endFreq: 140 }); },
    ping(vol = 1) { if (!ctx) return; const t = now(); tone(t, 2400 + Math.random() * 800, 0.08, { type: 'triangle', gain: 0.05 * vol, endFreq: 1200 }); },
    pickup() { if (!ctx) return; const t = now(); tone(t, 880, 0.12, { type: 'triangle', gain: 0.25 }); tone(t + 0.08, 1320, 0.2, { type: 'triangle', gain: 0.25 }); },
    cash() { if (!ctx) return; const t = now(); [1046, 1318, 1568, 2093].forEach((f, i) => tone(t + i * 0.05, f, 0.15, { type: 'square', gain: 0.06 })); },
    door() { if (!ctx) return; const t = now(); noise(t, 0.12, { type: 'bandpass', freq: 380, gain: 0.5, q: 2 }); tone(t + 0.05, 140, 0.06, { type: 'square', gain: 0.08 }); },
    horn(vol = 1) { if (!ctx || vol < 0.03) return; const t = now(); tone(t, 392, 0.4, { type: 'square', gain: 0.08 * vol, lp: 1800 }); tone(t, 494, 0.4, { type: 'square', gain: 0.07 * vol, lp: 1800 }); },
    checkpoint() { if (!ctx) return; const t = now(); tone(t, 660, 0.1, { type: 'square', gain: 0.1 }); tone(t + 0.1, 990, 0.25, { type: 'square', gain: 0.1 }); },
    wanted() { if (!ctx) return; const t = now(); tone(t, 520, 0.12, { type: 'sawtooth', gain: 0.08, lp: 2000 }); tone(t + 0.15, 520, 0.12, { type: 'sawtooth', gain: 0.08, lp: 2000 }); },
    jingle(good) {
      if (!ctx) return; const t = now();
      const notes = good ? [72, 76, 79, 84, 88] : [67, 63, 60, 55];
      notes.forEach((m, i) => tone(t + i * 0.13, mtof(m), 0.35, { type: 'square', gain: 0.09, lp: 3000 }));
      if (good) tone(t + 0.65, mtof(72), 0.9, { type: 'triangle', gain: 0.12 });
    },
    wasted() { if (!ctx) return; const t = now(); tone(t, 220, 2.2, { type: 'sawtooth', gain: 0.12, endFreq: 55, lp: 900 }); noise(t, 1.8, { freq: 300, gain: 0.3 }); },
    setEngine(on, sp, thr) {
      if (!ctx) return; const t = now();
      const f = 34 + sp * 115 + thr * 12;
      engOsc.frequency.setTargetAtTime(f, t, 0.06);
      engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      engFilter.frequency.setTargetAtTime(260 + sp * 1300 + thr * 300, t, 0.06);
      engGain.gain.setTargetAtTime(on ? 0.06 + thr * 0.05 : 0, t, 0.1);
    },
    setSiren(vol, time) {
      if (!ctx) return; const t = now();
      sirenOsc.frequency.setTargetAtTime(760 + 330 * Math.sin(time * 4.2), t, 0.02);
      sirenGain.gain.setTargetAtTime(vol * 0.05, t, 0.1);
    },
    setRadio(on) { radioActive = on; },
    nextStation() { station = (station + 1) % STATIONS.length; return STATIONS[station]; },
    get station() { return STATIONS[station]; },
    setMaster(v) { if (master) master.gain.value = v; },
  };

  // ===== カーラジオ（簡易シーケンサー） =====
  const PROG_SYN = [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']];
  const PROG_HOUSE = [[50, 'm'], [46, 'M'], [53, 'M'], [48, 'M']];
  const chord = (root, q) => (q === 'm' ? [root, root + 3, root + 7] : [root, root + 4, root + 7]);
  const kick = (t) => tone(t, 150, 0.3, { gain: 0.7, endFreq: 40, dest: music });
  const snare = (t) => { noise(t, 0.18, { type: 'highpass', freq: 1300, gain: 0.28, dest: music }); tone(t, 210, 0.1, { type: 'triangle', gain: 0.14, dest: music, endFreq: 120 }); };
  const hat = (t, dur, open) => noise(t, dur, { type: 'highpass', freq: 7500, gain: open ? 0.12 : 0.07, dest: music });
  const clap = (t) => noise(t, 0.16, { type: 'bandpass', freq: 1500, gain: 0.3, q: 0.8, dest: music });

  function playStep(st, s, t, sp) {
    const bar = Math.floor(s / 16) % 4, b = s % 16;
    if (st.kind === 'synth') {
      const [root, q] = PROG_SYN[bar]; const ch = chord(root, q);
      if (b % 8 === 0) kick(t);
      if (b === 4 || b === 12) snare(t);
      if (b % 2 === 0) hat(t, 0.05);
      if (b % 2 === 0) tone(t, mtof(root - 24 + (b % 4 === 2 ? 12 : 0)), sp * 1.8, { type: 'sawtooth', gain: 0.2, dest: music, lp: 700 });
      tone(t, mtof(ch[s % 3] + 12 + (b >= 8 ? 12 : 0)), sp * 0.9, { type: 'square', gain: 0.035, dest: music, lp: 2500 });
      if (b === 0) ch.forEach((m) => tone(t, mtof(m), sp * 15, { type: 'triangle', gain: 0.05, dest: music, attack: 0.3 }));
    } else if (st.kind === 'house') {
      const [root, q] = PROG_HOUSE[bar]; const ch = chord(root, q);
      if (b % 4 === 0) kick(t);
      if (b % 4 === 2) hat(t, 0.12, true); else if (b % 2 === 1) hat(t, 0.03);
      if (b === 4 || b === 12) clap(t);
      if (b % 4 === 2) tone(t, mtof(root - 12), sp * 1.5, { type: 'sawtooth', gain: 0.2, dest: music, lp: 600 });
      if (b === 3 || b === 6 || b === 10 || b === 14) ch.forEach((m) => tone(t, mtof(m + 12), sp * 1.2, { type: 'sawtooth', gain: 0.03, dest: music, lp: 2200 }));
    }
  }

  function schedule() {
    if (!ctx) return;
    const st = STATIONS[station];
    if (!radioActive || st.kind === 'off') { nextTime = ctx.currentTime + 0.05; return; }
    const sp = 60 / st.bpm / 4;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.02;
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(st, step, nextTime, sp);
      nextTime += sp; step = (step + 1) % 64;
    }
  }

  return S;
})();
