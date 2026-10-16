'use strict';
// ===== ミッション =====
const Missions = {
  contacts: [], active: null, cooldown: 0,
  init() {
    const names = ['ヴィニー', 'マリア', 'ディエゴ'], colors = ['#ffd23f', '#ff5fa2', '#4fd1ff'];
    const cycles = [['delivery', 'race', 'hit', 'steal'], ['steal', 'hit', 'delivery', 'race'], ['race', 'delivery', 'steal', 'hit']];
    const lv = SAVE.levels || [];
    this.contacts = World.contactSpots.map((p, i) => ({ x: p.x, y: p.y, name: names[i], color: colors[i], cycle: cycles[i], level: lv[i] || 0, armed: true }));
  },
  update(dt) {
    this.cooldown -= dt;
    const pl = G.player;
    for (const c of this.contacts) if (dist(pl.x, pl.y, c.x, c.y) > 70) c.armed = true;
    if (this.active) { if (G.state === 'play') this.active.update(dt); return; }
    if (G.state !== 'play' || this.cooldown > 0) return;
    for (const c of this.contacts) if (c.armed && dist(pl.x, pl.y, c.x, c.y) < 28) { this.start(c); break; }
  },
  start(c) {
    const type = c.cycle[c.level % c.cycle.length];
    const m = MISSION_TYPES[type](c.level);
    if (!m) return;
    m.contact = c; m.ents = m.ents || [];
    this.active = m; c.armed = false;
    Hud.bigMsg(m.title, `${c.name}「${m.intro}」`, c.color, 4.5);
    Sound.checkpoint();
  },
  pass(reward) {
    const m = this.active; if (!m) return;
    reward = Math.round(reward);
    G.money += reward; G.completed++; m.contact.level++;
    this.cleanup();
    Hud.bigMsg('ミッション成功！', `+$${reward}`, '#ffd23f', 4);
    Sound.jingle(true); Sound.cash(); Mobile.vib([40, 40, 40, 40, 120]);
    saveGame(); this.cooldown = 3;
  },
  fail(reason, quiet) {
    const m = this.active; if (!m) return;
    this.cleanup();
    if (quiet) Hud.flash('ミッション失敗：' + reason, 3);
    else { Hud.bigMsg('ミッション失敗', reason, '#ff4d4d', 3.5); Sound.jingle(false); }
    this.cooldown = 3;
  },
  cleanup() {
    const m = this.active;
    if (m) for (const e of m.ents) e.persist = false;
    this.active = null;
  },
  get markers() { return this.active ? this.active.markers : []; },
  get objective() { return this.active ? this.active.objective : ''; },
  get timer() { return this.active && this.active.timer != null && this.active.stage > 0 ? this.active.timer : null; },
};

function farLanePoint(x, y, minD, maxD) {
  return lanePointNear(x, y, minD, maxD, 120) || randomLanePoint();
}

const MISSION_TYPES = {
  delivery(lvl) {
    const pl = G.player;
    const A = farLanePoint(pl.x, pl.y, 450, 1200), Bp = farLanePoint(A.x, A.y, 1300, 2600);
    return {
      title: '運び屋', intro: '荷物を拾って時間内に届けてくれ。サツには気をつけな。',
      stage: 0, timer: null, markers: [{ x: A.x, y: A.y, r: 30, color: '#3dff7a' }], objective: '',
      update(dt) {
        const pl = G.player;
        if (this.stage === 0) {
          this.objective = pl.inCar ? '<g>緑のマーカー</g>で荷物を受け取れ' : 'まず<y>車</y>を手に入れろ（F キーで乗車）';
          if (pl.inCar && dist(pl.x, pl.y, A.x, A.y) < 42) {
            this.stage = 1; this.timer = Math.round(dist(A.x, A.y, Bp.x, Bp.y) / 250 + 20 - Math.min(lvl, 4) * 2);
            this.markers = [{ x: Bp.x, y: Bp.y, r: 30, color: '#ffd23f' }];
            Hud.flash('荷物を積んだ！ 急げ！'); Sound.checkpoint();
          }
        } else {
          this.timer -= dt;
          this.objective = pl.inCar ? '<y>目的地</y>へ荷物を届けろ' : '<r>車に戻れ！</r>';
          if (this.timer <= 0) return Missions.fail('時間切れ');
          if (pl.inCar && dist(pl.x, pl.y, Bp.x, Bp.y) < 42) Missions.pass(700 + lvl * 250 + this.timer * 10);
        }
      },
    };
  },
  race(lvl) {
    const pl = G.player;
    let i = clamp(Math.round(pl.x / T / B), 0, NB), j = clamp(Math.round(pl.y / T / B), 0, NB), pd = -1;
    const cps = []; let total = 0, px = pl.x, py = pl.y;
    for (let k = 0; k < 7; k++) {
      const steps = randi(2, 3);
      for (let s = 0; s < steps; s++) {
        const opts = [0, 1, 2, 3].filter((d) => d !== (pd + 2) % 4 && i + DX[d] >= 0 && j + DY[d] >= 0 && i + DX[d] <= NB && j + DY[d] <= NB);
        const d = pick(opts); i += DX[d]; j += DY[d]; pd = d;
      }
      const cp = { x: (i * B + 1) * T, y: (j * B + 1) * T };
      total += dist(px, py, cp.x, cp.y); px = cp.x; py = cp.y;
      cps.push(cp);
    }
    return {
      title: 'ストリートレース', intro: 'チェックポイントを全部回れ。遅れたら賞金はナシだ。',
      stage: 0, idx: 0, timer: null, markers: [], objective: '',
      update(dt) {
        const pl = G.player;
        if (this.stage === 0) {
          this.objective = '<y>車</y>に乗ればスタート';
          this.markers = [{ x: cps[0].x, y: cps[0].y, r: 40, color: '#4fd1ff' }];
          if (pl.inCar) { this.stage = 1; this.timer = Math.round(total / 300 + 16 - Math.min(lvl, 5) * 2); Hud.bigMsg('GO!', '', '#3dff7a', 1.2); Sound.checkpoint(); }
          return;
        }
        this.timer -= dt;
        const cp = cps[this.idx];
        this.markers = [{ x: cp.x, y: cp.y, r: 40, color: '#4fd1ff', label: `${this.idx + 1}/${cps.length}` }];
        if (cps[this.idx + 1]) this.markers.push({ x: cps[this.idx + 1].x, y: cps[this.idx + 1].y, r: 30, color: 'rgba(79,209,255,0.35)', faint: true });
        this.objective = pl.inCar ? `チェックポイント <b>${this.idx + 1} / ${cps.length}</b>` : '<r>車に戻れ！</r>';
        if (this.timer <= 0) return Missions.fail('時間切れ');
        if (pl.inCar && dist(pl.x, pl.y, cp.x, cp.y) < 56) {
          this.idx++; Sound.checkpoint(); this.timer += 2;
          if (this.idx >= cps.length) Missions.pass(900 + lvl * 300 + this.timer * 15);
        }
      },
    };
  },
  hit(lvl) {
    const pl = G.player;
    let s = null;
    for (let k = 0; k < 80 && !s; k++) { const q = randomSidewalkPoint(); if (dist(q.x, q.y, pl.x, pl.y) > 900) s = q; }
    s = s || randomSidewalkPoint();
    const group = ++UID, ents = [];
    const target = new Ped(s.x, s.y, 'gang');
    Object.assign(target, { isTarget: true, hp: 70, shirt: '#ffffff', pants: '#c0392b', hair: '#d4a017', weapon: 'pistol', group, persist: true });
    ents.push(target); G.peds.push(target);
    const n = Math.min(2 + lvl, 6);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const g = new Ped(s.x + Math.cos(a) * 30, s.y + Math.sin(a) * 30, 'gang');
      const r = collideCircle(g.x, g.y, g.r); g.x = r.x; g.y = r.y;
      Object.assign(g, { shirt: '#7b2cbf', pants: '#111', weapon: k % 3 === 2 ? 'smg' : 'pistol', group, persist: true, angle: a });
      ents.push(g); G.peds.push(g);
    }
    return {
      title: '始末屋', intro: 'ある男を消してほしい。用心棒がいるから気をつけろ。',
      stage: 1, timer: null, ents, markers: [], objective: '',
      update() {
        this.markers = target.dead ? [] : [{ x: target.x, y: target.y, r: 14, color: '#ff3b5c', follow: true }];
        this.objective = '<r>標的</r>を始末しろ';
        if (target.dead) Missions.pass(1000 + lvl * 350);
      },
    };
  },
  steal(lvl) {
    const pl = G.player;
    let spot = null;
    const spots = World.spots.filter((s) => s.type === 'civ' && dist(s.x, s.y, pl.x, pl.y) > 800);
    if (spots.length) spot = pick(spots);
    let car;
    if (spot) {
      for (let i = G.cars.length - 1; i >= 0; i--) { const c = G.cars[i]; if (!c.driver && Math.abs(c.x - spot.x) < 30 && Math.abs(c.y - spot.y) < 30) G.cars.splice(i, 1); }
      car = new Car(spot.x, spot.y, spot.a, 'sports');
    } else {
      const p = farLanePoint(pl.x, pl.y, 800, 1600);
      car = new Car(p.x, p.y, DIR_ANG[p.dir], 'sports');
    }
    car.persist = true; car.color = pick(['#ff2d55', '#ffcc00', '#00e0ff', '#b14bff']);
    G.cars.push(car);
    const gar = farLanePoint(car.x, car.y, 1200, 2400);
    return {
      title: '車泥棒', intro: 'ヴォルテックスGTが欲しい客がいる。キズ物にするなよ。',
      stage: 0, timer: null, ents: [car], markers: [], objective: '', alarm: false,
      update() {
        const pl = G.player;
        if (car.dead) return Missions.fail('車が壊れた');
        if (pl.inCar !== car) {
          this.markers = [{ x: car.x, y: car.y, r: 30, color: '#ffd23f', follow: true }];
          this.objective = this.stage === 0 ? '<y>ヴォルテックスGT</y>を盗め' : '<y>ヴォルテックスGT</y>に戻れ';
          return;
        }
        if (!this.alarm) { this.alarm = true; this.stage = 1; addHeat(0, 2); Hud.flash('盗難アラームが鳴った！'); }
        this.markers = [{ x: gar.x, y: gar.y, r: 32, color: '#3dff7a' }];
        const hpPct = Math.round(car.hp / car.maxHp * 100);
        this.objective = G.wanted > 0 ? `<b>警察を撒いて</b>から<g>ガレージ</g>へ（車体 ${hpPct}%）` : `<g>ガレージ</g>へ運べ（車体 ${hpPct}%）`;
        if (dist(pl.x, pl.y, gar.x, gar.y) < 44) {
          if (G.wanted > 0) { this.objective = '<r>手配中は納車できない！ 警察を撒け</r>'; return; }
          const reward = (1300 + lvl * 400) * Math.max(0.3, car.hp / car.maxHp);
          exitCar(true);
          const i = G.cars.indexOf(car); if (i >= 0) G.cars.splice(i, 1);
          Missions.pass(reward);
        }
      },
    };
  },
};
