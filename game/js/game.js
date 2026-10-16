'use strict';
// ===== データ定義 =====
const CAR_TYPES = {
  compact: { name: 'ピコ', len: 34, wid: 17, accel: 300, brake: 540, max: 430, turn: 3.0, hp: 80, colors: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#ecf0f1', '#e67e22', '#9b59b6', '#ff8fab'] },
  sedan: { name: 'クルーザー', len: 40, wid: 19, accel: 320, brake: 540, max: 480, turn: 2.7, hp: 100, colors: ['#2c3e50', '#7f8c8d', '#c0392b', '#16a085', '#bdc3c7', '#8e44ad', '#d35400', '#f5f5f0', '#1f4e79'] },
  sports: { name: 'ヴォルテックスGT', len: 42, wid: 19, accel: 480, brake: 660, max: 690, turn: 3.1, hp: 90, colors: ['#ff2d55', '#ffcc00', '#00e0ff', '#ff6a00', '#7cff4f', '#ffffff', '#b14bff'] },
  taxi: { name: 'タクシー', len: 40, wid: 19, accel: 320, brake: 540, max: 470, turn: 2.7, hp: 100, colors: ['#f4c20d'] },
  van: { name: 'ベイバン', len: 50, wid: 22, accel: 230, brake: 460, max: 380, turn: 2.2, hp: 160, colors: ['#ecf0f1', '#95a5a6', '#2980b9', '#27ae60', '#f39c12'] },
  police: { name: 'ポリスクルーザー', len: 42, wid: 19, accel: 440, brake: 640, max: 630, turn: 3.0, hp: 170, colors: ['#15171c'] },
};
const TRAFFIC_MIX = ['compact', 'compact', 'sedan', 'sedan', 'sedan', 'taxi', 'van', 'sports'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#5c3a21'];
const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#1abc9c', '#ecf0f1', '#e67e22', '#9b59b6', '#ff6fae', '#34495e', '#2ecc71', '#ffffff', '#ff9f43', '#4fd1ff'];
const PANTS = ['#2c3e50', '#34495e', '#1b2631', '#5d4037', '#3e5c76', '#7f8c8d', '#c2b280', '#f5f5f5'];
const HAIRS = ['#2b1d0e', '#111111', '#6b4423', '#d4a017', '#a52a2a', '#888888'];
const WEAPONS = {
  fist: { name: '素手', rate: 0.38, dmg: 14, melee: true, sound: 'punch' },
  pistol: { name: 'ピストル', rate: 0.26, dmg: 28, spread: 0.035, speed: 1500, sound: 'pistol' },
  smg: { name: 'SMG', rate: 0.085, dmg: 15, spread: 0.08, speed: 1500, sound: 'smg' },
  shotgun: { name: 'ショットガン', rate: 0.85, dmg: 17, spread: 0.2, pellets: 7, speed: 1300, sound: 'shotgun' },
  rocket: { name: 'ロケラン', rate: 1.3, dmg: 0, speed: 640, rocket: true, sound: 'rocket' },
};
const WEAPON_ORDER = ['fist', 'pistol', 'smg', 'shotgun', 'rocket'];

const SAVE = (() => { try { return JSON.parse(localStorage.getItem('neonbay-save') || '{}'); } catch (e) { return {}; } })();
function saveGame() {
  try { localStorage.setItem('neonbay-save', JSON.stringify({ money: G.money, completed: G.completed, levels: Missions.contacts.map((c) => c.level) })); } catch (e) { /* ignore */ }
}

// ===== ゲーム状態 =====
const G = {
  state: 'title', paused: false, showMap: false, t: 0, clock: 9 * 60, money: 0, completed: 0,
  heat: 0, lostT: 0, bustT: 0, starFlash: 0, hurtT: 0, deadT: 0, shake: 0,
  cars: [], peds: [], projectiles: [], particles: [], decals: [], skids: [], pickups: [], flashes: [],
  heli: null, heliT: 0, copSpawnT: 0, player: null, district: '', districtT: 0, sprayCd: 0,
  get wanted() { return Math.min(5, Math.floor(this.heat)); },
};

function addHeat(amt, minLvl = 0) {
  const before = G.wanted;
  G.heat = Math.min(5.99, Math.max(G.heat + amt, minLvl));
  G.lostT = 0;
  if (G.wanted > before) { Sound.wanted(); G.starFlash = 2; if (before === 0) G.copSpawnT = 3; }
}

function soundAt(fn, x, y, v = 1, arg) {
  const vol = v * clamp(1 - dist(x, y, cam.x, cam.y) / 1100, 0, 1);
  if (vol < 0.03) return;
  if (arg !== undefined) Sound[fn](arg, vol); else Sound[fn](vol);
}

// ===== パーティクル・エフェクト =====
function spawnParticle(o) {
  if (G.particles.length > 1100) return;
  const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, size: 3, grow: 0, color: '#fff', add: false, drag: 3 }, o);
  p.max = p.life; G.particles.push(p);
}
function puff(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(o.smin ?? 20, o.smax ?? 80);
    spawnParticle({
      x: x + rand(-(o.spread || 0), o.spread || 0), y: y + rand(-(o.spread || 0), o.spread || 0),
      vx: Math.cos(a) * s + (o.vx || 0), vy: Math.sin(a) * s + (o.vy || 0),
      life: rand(o.lmin ?? 0.3, o.lmax ?? 0.8), size: rand(o.zmin ?? 2, o.zmax ?? 4),
      color: Array.isArray(o.color) ? pick(o.color) : o.color, grow: o.grow || 0, add: !!o.add, drag: o.drag ?? 3,
    });
  }
}
const sparks = (x, y, n = 6) => puff(x, y, n, { color: ['#ffe28a', '#ffb347', '#fff'], smin: 80, smax: 260, lmin: 0.1, lmax: 0.3, zmin: 1, zmax: 2, add: true, drag: 5 });
const blood = (x, y, n = 8) => puff(x, y, n, { color: ['#a3121b', '#7d0d14', '#c2182b'], smin: 30, smax: 140, lmin: 0.2, lmax: 0.5, zmin: 1.5, zmax: 3, drag: 6 });

function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles[i] = G.particles[G.particles.length - 1]; G.particles.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f;
    p.size += p.grow * dt;
  }
  for (let i = G.flashes.length - 1; i >= 0; i--) { G.flashes[i].t -= dt; if (G.flashes[i].t <= 0) G.flashes.splice(i, 1); }
}

function addDecal(d) { G.decals.push(d); if (G.decals.length > 220) G.decals.shift(); }

// ===== 車 =====
class Car {
  constructor(x, y, angle, type, color) {
    const ct = CAR_TYPES[type];
    this.id = ++UID; this.x = x; this.y = y; this.angle = angle; this.type = type; this.ct = ct;
    this.len = ct.len; this.wid = ct.wid; this.vx = 0; this.vy = 0;
    this.hp = ct.hp; this.maxHp = ct.hp; this.color = color || pick(ct.colors);
    this.driver = null; this.ai = null; this.throttle = 0; this.steer = 0; this.handbrake = false;
    this.burnT = -1; this.wrecked = false; this.siren = false; this.copsIn = 0; this.persist = false;
    this.waitT = 0; this.pushT = 0; this.honkT = 0; this.skidding = false; this.wheels = null; this.lastHit = null; this.obstacle = null;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  get fwd() { return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle); }
  get dead() { return this.wrecked || this.burnT >= 0; }
  circles() {
    const c = Math.cos(this.angle), s = Math.sin(this.angle), off = this.len / 2 - this.wid / 2, r = this.wid / 2;
    return [{ x: this.x + c * off, y: this.y + s * off, r }, { x: this.x, y: this.y, r }, { x: this.x - c * off, y: this.y - s * off, r }];
  }
  update(dt) {
    const ct = this.ct, ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    let vf = this.vx * ca + this.vy * sa, vr = -this.vx * sa + this.vy * ca;
    const dead = this.dead;
    const th = dead ? 0 : this.throttle, steer = dead ? 0 : this.steer;
    const perf = this.hp < this.maxHp * 0.3 ? 0.65 : 1;
    if (th > 0) {
      if (vf < -10) vf += ct.brake * th * dt;
      else if (vf < ct.max * perf) vf += ct.accel * th * dt * (1 - Math.max(0, vf) / (ct.max * perf) * 0.7);
    } else if (th < 0) {
      if (vf > 10) vf -= ct.brake * -th * dt;
      else if (vf > -ct.max * 0.3) vf += ct.accel * 0.7 * th * dt;
    } else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 70 * dt);
    if (this.handbrake || dead) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (dead ? 150 : 250) * dt);
    vf *= 1 - 0.12 * dt;
    const grip = this.handbrake ? 1.3 : 7.5;
    vr -= vr * Math.min(1, grip * dt);
    this.skidding = (Math.abs(vr) > 75 || (this.handbrake && Math.abs(vf) > 110)) && !this.wrecked;
    this.vx = ca * vf - sa * vr; this.vy = sa * vf + ca * vr;
    const turnF = clamp(vf / 120, -1, 1) * (1 - clamp(Math.abs(vf) / ct.max, 0, 1) * 0.35);
    this.angle += steer * ct.turn * turnF * (this.handbrake ? 1.4 : 1) * dt;

    const n = this.speed * dt > 9 ? 3 : 1;
    for (let k = 0; k < n; k++) { this.x += this.vx * dt / n; this.y += this.vy * dt / n; this.collideWorld(); }

    // スキッド痕
    const rearX = this.x - Math.cos(this.angle) * this.len * 0.32, rearY = this.y - Math.sin(this.angle) * this.len * 0.32;
    const px = -Math.sin(this.angle) * this.wid * 0.38, py = Math.cos(this.angle) * this.wid * 0.38;
    const w = [rearX + px, rearY + py, rearX - px, rearY - py];
    if (this.skidding && this.wheels) {
      G.skids.push([this.wheels[0], this.wheels[1], w[0], w[1]], [this.wheels[2], this.wheels[3], w[2], w[3]]);
      if (G.skids.length > 900) G.skids.splice(0, 2);
      if (Math.random() < 0.3) puff(rearX, rearY, 1, { color: 'rgba(220,220,220,0.5)', smin: 5, smax: 20, lmin: 0.4, lmax: 0.8, zmin: 4, zmax: 7, grow: 14 });
    }
    this.wheels = w;

    if (this.burnT >= 0) {
      this.burnT -= dt;
      if (Math.random() < 0.7) puff(this.x, this.y, 1, { color: ['#ff9a1f', '#ffcf3d', '#ff5a1f'], smin: 10, smax: 40, lmin: 0.3, lmax: 0.6, zmin: 4, zmax: 8, grow: 10, add: true, spread: 8 });
      if (this.burnT < 0 && !this.wrecked) explodeCar(this);
    } else if (!this.wrecked && this.hp < this.maxHp * 0.35 && Math.random() < 0.25) {
      puff(this.x + Math.cos(this.angle) * this.len * 0.35, this.y + Math.sin(this.angle) * this.len * 0.35, 1,
        { color: this.hp < this.maxHp * 0.15 ? 'rgba(40,40,40,0.55)' : 'rgba(200,200,200,0.45)', smin: 5, smax: 25, lmin: 0.6, lmax: 1.2, zmin: 4, zmax: 6, grow: 16, drag: 1 });
    }
    if (this.wrecked && Math.random() < 0.08) puff(this.x, this.y, 1, { color: 'rgba(30,30,30,0.5)', smin: 5, smax: 20, lmin: 1, lmax: 2, zmin: 5, zmax: 8, grow: 12, drag: 1 });
    if (this.honkT > 0) this.honkT -= dt;
  }
  collideWorld() {
    for (let it = 0; it < 2; it++) {
      let any = false;
      for (const c of this.circles()) {
        const r = collideCircle(c.x, c.y, c.r);
        if (r.hit) { this.x += r.x - c.x; this.y += r.y - c.y; any = true; this.wallHit(r.nx, r.ny); }
      }
      if (!any) break;
    }
  }
  wallHit(nx, ny) {
    const vn = this.vx * nx + this.vy * ny;
    if (vn >= 0) return;
    this.vx -= 1.3 * vn * nx; this.vy -= 1.3 * vn * ny;
    this.vx *= 0.88; this.vy *= 0.88;
    const imp = -vn;
    if (imp > 110) {
      damageCar(this, (imp - 110) * 0.09, null);
      if (imp > 150) {
        soundAt('crash', this.x, this.y, Math.min(1, imp / 400));
        sparks(this.x - nx * this.wid / 2, this.y - ny * this.wid / 2, 8);
        if (this.driver === 'player') G.shake = Math.max(G.shake, Math.min(12, imp / 45));
      }
    }
  }
}

function damageCar(c, dmg, src) {
  if (c.wrecked || dmg <= 0) return;
  c.hp -= dmg; c.lastHit = src || c.lastHit;
  if (src === G.player && c.type === 'police' && (c.driver === 'cop' || c.copsIn > 0)) addHeat(0, 1);
  if (src === G.player && c.ai && c.ai.mode === 'traffic') c.ai.scared = 8;
  if (c.hp <= 0 && c.burnT < 0) c.burnT = dmg > 60 ? rand(0.25, 0.9) : rand(3, 4.5);
}

function explodeCar(c) {
  c.wrecked = true; c.burnT = -1; c.hp = 0; c.vx *= 0.3; c.vy *= 0.3; c.siren = false;
  if (c.driver === 'ai' || c.driver === 'cop') { c.driver = null; c.ai = null; }
  explosion(c.x, c.y, c.lastHit, 1);
  if (G.player.inCar === c) { exitCar(true); killPlayer('爆発に巻き込まれた'); }
}

function explosion(x, y, src, power = 1) {
  const dc = dist(x, y, cam.x, cam.y);
  G.shake = Math.max(G.shake, 16 * power * clamp(1 - dc / 900, 0, 1));
  soundAt('boom', x, y, power);
  puff(x, y, 34, { color: ['#ffdb4d', '#ff9a1f', '#ff5a1f', '#fff1a8'], smin: 40, smax: 260, lmin: 0.3, lmax: 0.8, zmin: 6, zmax: 14, grow: 20, add: true, drag: 4 });
  puff(x, y, 22, { color: ['rgba(40,40,40,0.6)', 'rgba(70,70,70,0.5)'], smin: 20, smax: 120, lmin: 1, lmax: 2.2, zmin: 8, zmax: 14, grow: 22, drag: 2 });
  puff(x, y, 12, { color: '#2a2a2a', smin: 120, smax: 380, lmin: 0.4, lmax: 0.9, zmin: 2, zmax: 3, drag: 3 });
  addDecal({ kind: 'scorch', x, y, r: 46 * power, a: rand(0, TAU) });
  G.flashes.push({ x, y, r: 320 * power, t: 0.7, max: 0.7, color: '#ff9a3c' });
  for (const p of G.peds) {
    if (p.dead || p.inCar) continue;
    const d = dist(x, y, p.x, p.y);
    if (d < 110 * power) damagePed(p, 130 * (1 - d / (120 * power)), src, true);
  }
  for (const c of G.cars) {
    if (c.wrecked) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < 130 * power && d > 1) {
      damageCar(c, 170 * (1 - d / (140 * power)), src);
      const f = 260 * (1 - d / (130 * power));
      c.vx += (c.x - x) / d * f; c.vy += (c.y - y) / d * f;
      if (c === G.player.inCar) damagePed(G.player, 30 * (1 - d / (130 * power)), src);
    }
  }
  if (G.heli && dist(x, y, G.heli.x, G.heli.y) < 80) G.heli.hp -= 200;
  scare(x, y, 600, 8);
}

function collideCars(a, b) {
  if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) return;
  const ca = a.circles(), cb = b.circles();
  for (const p of ca) for (const q of cb) {
    const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, rr = p.r + q.r;
    if (d2 >= rr * rr || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d;
    const ma = a.len * a.wid * (a.wrecked ? 1.5 : 1), mb = b.len * b.wid * (b.wrecked ? 1.5 : 1), tot = ma + mb;
    a.x -= nx * pen * mb / tot; a.y -= ny * pen * mb / tot;
    b.x += nx * pen * ma / tot; b.y += ny * pen * ma / tot;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const j = -1.25 * rv / (1 / ma + 1 / mb);
      a.vx -= j / ma * nx; a.vy -= j / ma * ny; b.vx += j / mb * nx; b.vy += j / mb * ny;
      const imp = -rv;
      if (imp > 70) {
        const sa = a.driver === 'player' ? G.player : null, sb = b.driver === 'player' ? G.player : null;
        damageCar(a, (imp - 70) * 0.07, sb); damageCar(b, (imp - 70) * 0.07, sa);
        if (imp > 110) {
          soundAt('crash', (a.x + b.x) / 2, (a.y + b.y) / 2, Math.min(1, imp / 380));
          sparks(p.x + nx * p.r, p.y + ny * p.r, 6);
          if (a.driver === 'player' || b.driver === 'player') G.shake = Math.max(G.shake, Math.min(10, imp / 50));
        }
      }
    }
    return;
  }
}

// ===== 人 =====
class Ped {
  constructor(x, y, kind = 'civ') {
    this.id = ++UID; this.x = x; this.y = y; this.kind = kind; this.side = kind === 'cop' ? 'police' : kind;
    this.r = 7; this.angle = rand(0, TAU);
    this.hp = kind === 'cop' ? 60 : kind === 'gang' ? 55 : kind === 'player' ? 100 : 25; this.maxHp = this.hp;
    this.armor = 0; this.dead = false; this.deadT = 0; this.walkT = rand(0, 10); this.moving = 0;
    this.skin = pick(SKINS); this.shirt = pick(SHIRTS); this.pants = pick(PANTS); this.hair = pick(HAIRS);
    this.weapon = null; this.hat = false;
    if (kind === 'cop') { this.shirt = '#2348a6'; this.pants = '#14213d'; this.hair = '#0d1730'; this.weapon = 'pistol'; this.hat = true; }
    this.panic = 0; this.fx = 0; this.fy = 0; this.path = null; this.target = null; this.speedMul = rand(0.85, 1.2);
    this.fireCd = rand(0.6, 1.4); this.burst = 0; this.inCar = null; this.persist = false;
    this.stuckT = 0; this.lx = x; this.ly = y; this.hostile = false; this.group = 0; this.isTarget = false;
  }
}

function scare(x, y, r, dur) {
  for (const p of G.peds) {
    if (p.kind !== 'civ' || p.dead) continue;
    if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r && dist(p.x, p.y, x, y) < r) { p.panic = Math.max(p.panic, dur * rand(0.7, 1.2)); p.fx = x; p.fy = y; }
  }
  for (const c of G.cars) if (c.ai && c.ai.mode === 'traffic' && dist(c.x, c.y, x, y) < r * 0.8) c.ai.scared = dur;
}

function damagePed(p, dmg, src, explosive) {
  if (p.dead || dmg <= 0) return;
  if (p.kind === 'player') {
    if (G.state !== 'play') return;
    if (p.armor > 0) { const a = Math.min(p.armor, dmg * 0.7); p.armor -= a; dmg -= a; }
    p.hp -= dmg; G.hurtT = 0.45;
    if (!p.inCar) blood(p.x, p.y, 4);
    if (p.hp <= 0) killPlayer('撃たれた');
    return;
  }
  p.hp -= dmg;
  blood(p.x, p.y, explosive ? 12 : 6);
  if (p.kind === 'gang') alertGang(p);
  if (p.kind === 'civ') { p.panic = 8; p.fx = src ? src.x : p.x + rand(-1, 1); p.fy = src ? src.y : p.y + rand(-1, 1); }
  if (p.hp <= 0) killPed(p, src);
}

function killPed(p, src) {
  if (p.dead) return;
  p.dead = true; p.deadT = 0; p.moving = 0;
  addDecal({ kind: 'blood', x: p.x + rand(-3, 3), y: p.y + rand(-3, 3), r: rand(9, 15), a: rand(0, TAU) });
  if (src === G.player) {
    if (p.kind === 'cop') addHeat(1.0, 2);
    else if (p.kind === 'civ') addHeat(0.55, 1);
  }
  if (p.kind === 'civ' && Math.random() < 0.65) G.pickups.push({ x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), type: 'cash', amount: randi(5, 60), once: true, life: 30, respawn: 0 });
  if ((p.kind === 'cop' || p.kind === 'gang') && Math.random() < 0.8) G.pickups.push({ x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), type: p.weapon || 'pistol', amount: p.weapon === 'smg' ? 45 : 12, once: true, life: 30, respawn: 0 });
  scare(p.x, p.y, 280, 7);
}

function pedMove(p, ang, spd, dt) {
  p.angle = ang;
  p.x += Math.cos(ang) * spd * dt; p.y += Math.sin(ang) * spd * dt;
  const r = collideCircle(p.x, p.y, p.r); p.x = r.x; p.y = r.y;
  p.moving = spd; p.walkT += dt * spd * 0.13;
}

const CROSS = [[[-1, 0, 1], [0, -1, 3]], [[1, 0, 0], [0, -1, 2]], [[1, 0, 3], [0, 1, 1]], [[-1, 0, 2], [0, 1, 0]]];
function setPathTarget(p) { const c = cornerPos(p.path.bi, p.path.bj, p.path.c); p.target = { x: c.x + rand(-6, 6), y: c.y + rand(-6, 6) }; }
function advancePath(p) {
  const pa = p.path;
  if (Math.random() < 0.25) {
    const opts = CROSS[pa.c].map(([di, dj, nc]) => [pa.bi + di, pa.bj + dj, nc]).filter(([bi, bj]) => bi >= 0 && bj >= 0 && bi < NB && bj < NB);
    if (opts.length) { const o = pick(opts); pa.bi = o[0]; pa.bj = o[1]; pa.c = o[2]; setPathTarget(p); return; }
  }
  pa.c = (pa.c + pa.dir + 4) % 4; setPathTarget(p);
}
function walkPath(p, dt, spd) {
  if (!p.path) { p.path = nearestPath(p.x, p.y); p.target = null; }
  if (!p.target) setPathTarget(p);
  if (dist(p.x, p.y, p.target.x, p.target.y) < 6) { advancePath(p); return; }
  pedMove(p, Math.atan2(p.target.y - p.y, p.target.x - p.x), spd, dt);
  p.stuckT += dt;
  if (p.stuckT > 1.5) {
    if (dist(p.x, p.y, p.lx, p.ly) < 8) { p.path.dir *= -1; advancePath(p); }
    p.stuckT = 0; p.lx = p.x; p.ly = p.y;
  }
}

function civAI(p, dt) {
  if (p.panic > 0) {
    p.panic -= dt;
    const a = Math.atan2(p.y - p.fy, p.x - p.fx) + Math.sin(G.t * 2 + p.id) * 0.5;
    pedMove(p, a, 135 * p.speedMul, dt);
    if (p.panic <= 0) { p.path = null; p.target = null; }
    return;
  }
  walkPath(p, dt, 42 * p.speedMul);
}

function npcShoot(p, ang, acc) {
  fireWeapon(p, p.weapon, ang + rand(-acc, acc));
  if (p.weapon === 'smg') { p.burst++; p.fireCd = p.burst > 5 ? (p.burst = 0, rand(1, 1.6)) : 0.11; }
  else p.fireCd = rand(0.6, 1.2);
}

function copAI(p, dt) {
  const pl = G.player;
  if (G.wanted === 0 || pl.dead || G.state !== 'play') { walkPath(p, dt, 45); return; }
  const d = dist(p.x, p.y, pl.x, pl.y), ang = Math.atan2(pl.y - p.y, pl.x - p.x);
  const los = d < 430 && lineOfSight(p.x, p.y, pl.x, pl.y);
  if (los && G.wanted >= 2 && d < 360) {
    if (d > 120) pedMove(p, ang, 95, dt); else { p.angle = ang; p.moving = 0; }
    if (p.fireCd <= 0) npcShoot(p, ang, 0.13);
  } else pedMove(p, ang, 140, dt);
}

function alertGang(p) { for (const q of G.peds) if (q.kind === 'gang' && q.group === p.group) q.hostile = true; }
function gangAI(p, dt) {
  const pl = G.player, d = dist(p.x, p.y, pl.x, pl.y), ang = Math.atan2(pl.y - p.y, pl.x - p.x);
  if (!p.hostile) {
    if (d < 230 && !pl.dead && lineOfSight(p.x, p.y, pl.x, pl.y)) alertGang(p);
    else { p.moving = 0; p.angle += Math.sin(G.t * 0.7 + p.id) * dt * 0.8; return; }
  }
  if (pl.dead || G.state !== 'play') { p.moving = 0; return; }
  const los = d < 460 && lineOfSight(p.x, p.y, pl.x, pl.y);
  if (p.isTarget) {
    pedMove(p, Math.atan2(p.y - pl.y, p.x - pl.x) + Math.sin(G.t * 1.3 + p.id) * 0.6, 118, dt);
    if (los && d < 260 && p.fireCd <= 0) { p.angle = ang; npcShoot(p, ang, 0.2); }
    return;
  }
  if (los && d < 380) {
    if (d > 150) pedMove(p, ang, 90, dt);
    else pedMove(p, ang + (p.id % 2 ? 1.4 : -1.4), 45, dt);
    p.angle = ang;
    if (p.fireCd <= 0) npcShoot(p, ang, 0.16);
  } else pedMove(p, ang, 120, dt);
}

function updatePed(p, dt) {
  if (p.dead) { p.deadT += dt; return; }
  p.fireCd -= dt;
  if (p.kind === 'civ') civAI(p, dt);
  else if (p.kind === 'cop') copAI(p, dt);
  else if (p.kind === 'gang') gangAI(p, dt);
}

function carPedCollisions() {
  for (const c of G.cars) {
    for (const p of G.peds) {
      if (p.dead || p.inCar) continue;
      if (Math.abs(p.x - c.x) > 40 || Math.abs(p.y - c.y) > 40) continue;
      for (const q of c.circles()) {
        const dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy, rr = q.r + p.r;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
        const vn = c.vx * nx + c.vy * ny;
        p.x += nx * (rr - d + 0.5); p.y += ny * (rr - d + 0.5);
        if (vn > 150) {
          const src = c.driver === 'player' ? G.player : null;
          soundAt('thud', p.x, p.y, Math.min(1, vn / 300));
          blood(p.x, p.y, 10);
          if (p.kind === 'player') { damagePed(p, (vn - 150) * 0.12 + 6, src); p.x += nx * 10; p.y += ny * 10; }
          else { p.x += nx * 14; p.y += ny * 14; damagePed(p, 999, src); }
          c.vx *= 0.96; c.vy *= 0.96;
        } else if (vn > 60 && p.kind === 'civ') { p.panic = Math.max(p.panic, 4); p.fx = c.x; p.fy = c.y; }
        break;
      }
    }
  }
}

// ===== 武器・弾 =====
function copSees(x, y, r) {
  for (const p of G.peds) if (p.kind === 'cop' && !p.dead && dist(p.x, p.y, x, y) < r && lineOfSight(p.x, p.y, x, y)) return true;
  for (const c of G.cars) if (c.type === 'police' && c.driver === 'cop' && dist(c.x, c.y, x, y) < r && lineOfSight(c.x, c.y, x, y)) return true;
  return false;
}

function fireWeapon(sh, wName, ang, opt = {}) {
  const W = WEAPONS[wName], isP = sh === G.player;
  if (W.melee) {
    soundAt('shot', sh.x, sh.y, 0.6, 'punch');
    for (const p of G.peds) {
      if (p === sh || p.dead || p.inCar) continue;
      const d = dist(sh.x, sh.y, p.x, p.y);
      if (d < 26 && Math.abs(angDiff(ang, Math.atan2(p.y - sh.y, p.x - sh.x))) < 1) {
        damagePed(p, W.dmg, sh);
        p.x += Math.cos(ang) * 6; p.y += Math.sin(ang) * 6;
        if (isP && G.wanted === 0 && p.kind === 'cop') addHeat(0, 1);
        else if (isP && G.wanted === 0 && copSees(sh.x, sh.y, 350)) addHeat(0, 1);
        break;
      }
    }
    return;
  }
  const off = opt.off ?? 13;
  const ox = sh.x + Math.cos(ang) * off, oy = sh.y + Math.sin(ang) * off;
  const mul = isP ? 1 : 0.5;
  if (W.rocket) {
    G.projectiles.push({ x: ox, y: oy, vx: Math.cos(ang) * W.speed, vy: Math.sin(ang) * W.speed, life: 2.2, owner: sh, ownerCar: opt.car || null, side: sh.side, rocket: true, air: !!opt.air });
  } else {
    for (let k = 0; k < (W.pellets || 1); k++) {
      const a = ang + rand(-W.spread, W.spread) * (isP ? 1 : 1.4), sp = W.speed * rand(0.92, 1.05);
      G.projectiles.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, owner: sh, ownerCar: opt.car || null, side: sh.side, dmg: W.dmg * mul, air: !!opt.air });
    }
  }
  spawnParticle({ x: ox, y: oy, life: 0.06, size: W.pellets ? 9 : 6, color: '#fff3b0', add: true });
  G.flashes.push({ x: ox, y: oy, r: 110, t: 0.07, max: 0.07, color: '#ffd27a' });
  soundAt('shot', ox, oy, 1, W.sound);
  scare(ox, oy, 380, 6);
  if (isP && G.wanted === 0 && copSees(sh.x, sh.y, 520)) addHeat(0, 1);
}

function updateProjectiles(dt) {
  const pl = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const b = G.projectiles[i];
    b.life -= dt;
    if (b.rocket) puff(b.x, b.y, 1, { color: 'rgba(210,210,210,0.6)', smin: 5, smax: 20, lmin: 0.4, lmax: 0.8, zmin: 3, zmax: 5, grow: 12, drag: 2 });
    const sp = Math.hypot(b.vx, b.vy), steps = Math.max(1, Math.ceil(sp * dt / 8));
    let done = b.life <= 0;
    const boom = () => { if (b.rocket) explosion(b.x, b.y, b.owner, 1); };
    for (let s = 0; s < steps && !done; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (!b.air && tileAtPx(b.x, b.y) === TL.BUILD) {
        if (b.rocket) { b.x -= b.vx * 0.01; b.y -= b.vy * 0.01; boom(); }
        else { sparks(b.x - b.vx * 0.006, b.y - b.vy * 0.006, 3); if (Math.random() < 0.3) soundAt('ping', b.x, b.y, 0.6); }
        done = true; break;
      }
      for (const p of G.peds) {
        if (p.dead || p.inCar || p === b.owner) continue;
        if (b.side !== 'civ' && p.side === b.side) continue;
        if (Math.abs(p.x - b.x) > 11 || Math.abs(p.y - b.y) > 11) continue;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (p.r + 2) ** 2) {
          if (b.rocket) boom(); else { damagePed(p, b.dmg, b.owner); soundAt('hit', b.x, b.y, 1); }
          done = true; break;
        }
      }
      if (done) break;
      for (const c of G.cars) {
        if (c === b.ownerCar || Math.abs(c.x - b.x) > 30 || Math.abs(c.y - b.y) > 30) continue;
        let hit = false;
        for (const q of c.circles()) if ((q.x - b.x) ** 2 + (q.y - b.y) ** 2 < q.r * q.r) { hit = true; break; }
        if (!hit) continue;
        if (b.rocket) boom();
        else {
          damageCar(c, b.dmg * 0.3, b.owner); sparks(b.x, b.y, 3);
          if (c === pl.inCar && b.owner !== pl) damagePed(pl, b.dmg * 0.35, b.owner);
          if (c.driver === 'ai' && c.ai) c.ai.scared = 8;
        }
        done = true; break;
      }
      if (done) break;
      if (G.heli && b.owner !== G.heli && dist(b.x, b.y, G.heli.x, G.heli.y) < 24) {
        if (b.rocket) boom(); else { G.heli.hp -= b.dmg; sparks(b.x, b.y, 3); }
        done = true;
      }
    }
    if (done) G.projectiles.splice(i, 1);
  }
}

// ===== AI運転 =====
function entryPt(i, j, d) {
  switch (d) {
    case 0: return { x: i * B * T - 6, y: laneY(j, 0) };
    case 2: return { x: (i * B + 2) * T + 6, y: laneY(j, 2) };
    case 1: return { x: laneX(i, 1), y: j * B * T - 6 };
    default: return { x: laneX(i, 3), y: (j * B + 2) * T + 6 };
  }
}
function exitPt(i, j, d) {
  switch (d) {
    case 0: return { x: (i * B + 2) * T + 10, y: laneY(j, 0) };
    case 2: return { x: i * B * T - 10, y: laneY(j, 2) };
    case 1: return { x: laneX(i, 1), y: (j * B + 2) * T + 10 };
    default: return { x: laneX(i, 3), y: j * B * T - 10 };
  }
}
const midPt = (i, j, din, dout) => (din % 2 === 0 ? { x: laneX(i, dout), y: laneY(j, din) } : { x: laneX(i, din), y: laneY(j, dout) });
function validDirs(i, j, from) {
  const o = [];
  for (let d = 0; d < 4; d++) {
    if (d === (from + 2) % 4) continue;
    const ni = i + DX[d], nj = j + DY[d];
    if (ni < 0 || nj < 0 || ni > NB || nj > NB) continue;
    o.push(d);
  }
  if (!o.length) o.push((from + 2) % 4);
  return o;
}
function chooseDir(c, a) {
  const opts = validDirs(a.i, a.j, a.dir);
  if (a.mode === 'police') {
    const pl = G.player; let best = opts[0], bs = -1e9;
    for (const d of opts) { const s = DX[d] * (pl.x - c.x) + DY[d] * (pl.y - c.y) + Math.random() * 40; if (s > bs) { bs = s; best = d; } }
    return best;
  }
  if (opts.includes(a.dir) && Math.random() < 0.55) return a.dir;
  return pick(opts);
}
function makeAI(mode, p, c) {
  const a = { mode, i: p.i, j: p.j, dir: p.dir, wps: [], nd: null, cruise: rand(140, 185), scared: 0, stuckT: 0, revT: 0, revSteer: 1, lost: false };
  a.nd = mode === 'police' ? null : chooseDir(c, a);
  const e = entryPt(a.i, a.j, a.dir); e.decide = true; e.slow = a.nd !== null && a.nd !== a.dir; a.wps.push(e);
  return a;
}
function aiPlan(c, a) {
  const nd = a.nd ?? chooseDir(c, a);
  const i = a.i, j = a.j, din = a.dir;
  a.wps.length = 0;
  if (nd === (din + 3) % 4) a.wps.push({ ...midPt(i, j, din, nd), turn: true });
  a.wps.push({ ...exitPt(i, j, nd), turn: nd !== din });
  a.i = i + DX[nd]; a.j = j + DY[nd]; a.dir = nd;
  a.nd = a.mode === 'police' ? null : chooseDir(c, a);
  const e = entryPt(a.i, a.j, nd); e.decide = true; e.slow = a.nd !== null && a.nd !== nd;
  a.wps.push(e);
}
function steerTo(c, tx, ty, spd) {
  const da = angDiff(c.angle, Math.atan2(ty - c.y, tx - c.x));
  c.steer = clamp(da * 3, -1, 1);
  const want = spd * clamp(1 - Math.abs(da) / 1.6, 0.25, 1), f = c.fwd;
  c.throttle = f < want - 8 ? 1 : f > want + 25 ? -0.7 : 0.15;
  c.handbrake = false;
}
function followRoute(c, a, cruise) {
  if (!a.wps.length) { const e = entryPt(a.i, a.j, a.dir); e.decide = true; a.wps.push(e); }
  let wp = a.wps[0];
  let dx = wp.x - c.x, dy = wp.y - c.y, d = Math.hypot(dx, dy);
  const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
  if (d < 22 || (d < 70 && ahead < 0)) {
    a.wps.shift(); if (wp.decide) aiPlan(c, a);
    wp = a.wps[0]; d = dist(c.x, c.y, wp.x, wp.y);
  }
  let spd = cruise;
  if (wp.turn) spd = Math.min(spd, 100);
  else if (wp.slow && d < 140) spd = Math.min(spd, 90 + d * 0.5);
  steerTo(c, wp.x, wp.y, spd);
}
function obstacleAhead(c, look) {
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
  let best = null, who = null;
  const test = (x, y, r, o) => {
    const dx = x - c.x, dy = y - c.y, f = dx * ca + dy * sa;
    if (f <= 0 || f > look + c.len / 2) return;
    if (Math.abs(-dx * sa + dy * ca) > c.wid / 2 + r + 2) return;
    if (best === null || f < best) { best = f; who = o; }
  };
  const R = look + 60;
  for (const o of G.cars) {
    if (o === c || Math.abs(o.x - c.x) > R || Math.abs(o.y - c.y) > R) continue;
    for (const q of o.circles()) test(q.x, q.y, q.r, o);
  }
  for (const p of G.peds) {
    if (p.dead || p.inCar || Math.abs(p.x - c.x) > R || Math.abs(p.y - c.y) > R) continue;
    test(p.x, p.y, p.r, p);
  }
  c.obstacle = who;
  return best;
}
function trafficAI(c, a, dt) {
  if (a.scared > 0) a.scared -= dt;
  followRoute(c, a, a.scared > 0 ? 300 : a.cruise);
  if (c.pushT > 0) { c.pushT -= dt; return; }
  const ob = obstacleAhead(c, 30 + Math.max(0, c.fwd) * 0.5);
  if (ob !== null) {
    const safe = Math.max(0, ob - c.len / 2 - 12);
    if (c.fwd > safe * 2.4) c.throttle = -1; else c.throttle = Math.min(c.throttle, 0);
    if (Math.abs(c.fwd) < 15) {
      c.waitT += dt;
      const pl = G.player;
      if (c.waitT > 1.5 && c.honkT <= 0 && (c.obstacle === pl || c.obstacle === pl.inCar)) { c.honkT = 3.5; soundAt('horn', c.x, c.y, 0.8); }
      if (c.waitT > 5) { c.waitT = 0; c.pushT = 1.3; }
    }
  } else c.waitT = 0;
}
function replan(c, a) {
  const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T), ca = Math.cos(c.angle), sa = Math.sin(c.angle);
  const onH = isRoadRow(ty), onV = isRoadCol(tx);
  let dir;
  if (onH && (!onV || Math.abs(ca) >= Math.abs(sa))) dir = ca >= 0 ? 0 : 2;
  else if (onV) dir = sa >= 0 ? 1 : 3;
  else return false;
  const gi = Math.floor(tx / B), gj = Math.floor(ty / B);
  let i, j;
  if (dir === 0) { i = gi + 1; j = gj; } else if (dir === 2) { i = tx % B < 2 ? gi - 1 : gi; j = gj; }
  else if (dir === 1) { i = gi; j = gj + 1; } else { i = gi; j = ty % B < 2 ? gj - 1 : gj; }
  if (i < 0 || j < 0 || i > NB || j > NB) return false;
  a.i = i; a.j = j; a.dir = dir; a.wps.length = 0;
  const e = entryPt(i, j, dir); e.decide = true; a.wps.push(e);
  if (a.mode !== 'police') a.nd = chooseDir(c, a);
  return true;
}
function policeAI(c, a, dt) {
  const pl = G.player;
  if (G.wanted === 0 || pl.dead || G.state !== 'play') {
    a.mode = 'traffic'; c.siren = false; a.cruise = 170;
    if (!replan(c, a)) a.lost = true;
    return;
  }
  c.siren = true;
  if (a.revT > 0) { a.revT -= dt; c.throttle = -1; c.steer = -a.revSteer; c.handbrake = false; return; }
  if (Math.abs(c.fwd) < 25 && c.throttle > 0.5) a.stuckT += dt; else a.stuckT = Math.max(0, a.stuckT - dt * 0.5);
  if (a.stuckT > 1.0) { a.stuckT = 0; a.revT = 0.8; a.revSteer = c.steer >= 0 ? 1 : -1; a.lost = true; return; }
  const d = dist(c.x, c.y, pl.x, pl.y);
  const los = d < 430 && lineOfSight(c.x, c.y, pl.x, pl.y);
  if (los) {
    a.lost = true;
    if (!pl.inCar && d < 130) {
      steerTo(c, pl.x, pl.y, 0); c.throttle = c.fwd > 15 ? -1 : 0;
      if (c.speed < 45 && c.copsIn > 0) deployCops(c);
      return;
    }
    const pv = pl.inCar, lead = pv ? clamp(d / 600, 0, 0.6) : 0;
    steerTo(c, pl.x + (pv ? pv.vx * lead : 0), pl.y + (pv ? pv.vy * lead : 0), 620);
    return;
  }
  if (a.lost) a.lost = !replan(c, a);
  if (a.lost) { steerTo(c, pl.x, pl.y, 300); return; }
  followRoute(c, a, 430);
  const ob = obstacleAhead(c, 40 + Math.max(0, c.fwd) * 0.3);
  if (ob !== null && c.obstacle !== pl.inCar && c.obstacle !== pl && c.fwd > 140) c.throttle = -0.6;
}
function updateCarAI(c, dt) {
  const a = c.ai;
  if (a.mode === 'police') policeAI(c, a, dt); else trafficAI(c, a, dt);
  if (a.mode === 'traffic' && c.type === 'police' && G.wanted > 0 && c.driver === 'cop' && dist(c.x, c.y, G.player.x, G.player.y) < 700) { a.mode = 'police'; a.lost = true; }
}

function ejectPos(c) {
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle), off = c.wid / 2 + 10;
  for (const s of [-1, 1]) {
    const x = c.x - sa * off * s, y = c.y + ca * off * s;
    if (!collideCircle(x, y, 7).hit) return { x, y };
  }
  return { x: c.x - ca * (c.len / 2 + 10), y: c.y - sa * (c.len / 2 + 10) };
}
function deployCops(c) {
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle), off = c.wid / 2 + 10;
  for (let k = 0; k < c.copsIn; k++) {
    const s = k % 2 ? 1 : -1;
    const p = new Ped(c.x - sa * off * s, c.y + ca * off * s, 'cop');
    if (G.wanted >= 3) p.weapon = 'smg';
    const r = collideCircle(p.x, p.y, p.r); p.x = r.x; p.y = r.y;
    G.peds.push(p);
  }
  c.copsIn = 0; c.driver = null; c.ai = null; c.handbrake = true;
  Sound.door();
}

// ===== 警察・指名手配 =====
function spawnPoliceCar() {
  const pl = G.player;
  for (let k = 0; k < 10; k++) {
    const p = lanePointNear(pl.x, pl.y, 750, 1250);
    if (!p || onScreen(p.x, p.y, 80)) continue;
    const c = new Car(p.x, p.y, DIR_ANG[p.dir], 'police');
    c.driver = 'cop'; c.copsIn = 2; c.siren = true;
    c.ai = makeAI('police', p, c);
    c.vx = Math.cos(c.angle) * 250; c.vy = Math.sin(c.angle) * 250;
    G.cars.push(c);
    return;
  }
}
function spawnHeli() {
  const pl = G.player, a = rand(0, TAU);
  G.heli = { x: pl.x + Math.cos(a) * 1000, y: pl.y + Math.sin(a) * 1000, vx: 0, vy: 0, angle: 0, hp: 280, rot: 0, fireCd: 3, burst: 0, side: 'police', kind: 'heli', leaving: false };
}
function updateHeli(dt) {
  if (G.heliT > 0) G.heliT -= dt;
  const h = G.heli; if (!h) return;
  const pl = G.player;
  h.rot += dt * 32;
  h.leaving = G.wanted < 4 || pl.dead;
  let tx, ty;
  if (h.leaving) { tx = h.x + (h.x - pl.x); ty = h.y + (h.y - pl.y) - 200; }
  else { const a = G.t * 0.45; tx = pl.x + Math.cos(a) * 180; ty = pl.y + Math.sin(a) * 130; }
  h.vx += ((tx - h.x) * 1.1 - h.vx * 1.3) * dt; h.vy += ((ty - h.y) * 1.1 - h.vy * 1.3) * dt;
  const sp = Math.hypot(h.vx, h.vy); if (sp > 420) { h.vx *= 420 / sp; h.vy *= 420 / sp; }
  h.x += h.vx * dt; h.y += h.vy * dt;
  const d = dist(h.x, h.y, pl.x, pl.y);
  h.angle += angDiff(h.angle, Math.atan2(pl.y - h.y, pl.x - h.x)) * Math.min(1, dt * 2);
  if (h.leaving && d > 1700) { G.heli = null; return; }
  h.fireCd -= dt;
  if (!h.leaving && h.fireCd <= 0 && d < 520 && G.state === 'play') {
    fireWeapon(h, 'smg', Math.atan2(pl.y - h.y, pl.x - h.x), { air: true, off: 0 });
    h.burst++; h.fireCd = h.burst >= 7 ? (h.burst = 0, 2.4) : 0.1;
  }
  if (h.hp <= 0) {
    explosion(h.x, h.y, G.player, 1.4);
    G.heli = null; G.heliT = 30; addHeat(0.4);
    Hud.flash('ヘリを撃墜した！');
  }
}

function updatePolice(dt) {
  const w = G.wanted, pl = G.player;
  if (G.starFlash > 0) G.starFlash -= dt;
  if (w > 0 && G.state === 'play') {
    let seen = false;
    for (const c of G.cars) if (c.ai && c.ai.mode === 'police' && dist(c.x, c.y, pl.x, pl.y) < 460 && lineOfSight(c.x, c.y, pl.x, pl.y)) { seen = true; break; }
    if (!seen) for (const p of G.peds) if (p.kind === 'cop' && !p.dead && dist(p.x, p.y, pl.x, pl.y) < 430 && lineOfSight(p.x, p.y, pl.x, pl.y)) { seen = true; break; }
    if (!seen && G.heli && !G.heli.leaving && dist(G.heli.x, G.heli.y, pl.x, pl.y) < 520) seen = true;
    G.seen = seen;
    if (seen) G.lostT = 0;
    else {
      G.lostT += dt;
      if (G.lostT > 7 + w * 2.5) {
        G.heat = w - 1; G.lostT = 0;
        if (G.wanted === 0) Hud.flash('警察を撒いた！');
      }
    }
    let units = 0;
    for (const c of G.cars) if (c.ai && c.ai.mode === 'police') units++;
    for (const p of G.peds) if (p.kind === 'cop' && !p.dead) units += 0.5;
    const want = [0, 1, 2, 3, 4, 6][w];
    G.copSpawnT -= dt;
    if (units < want && G.copSpawnT <= 0) { spawnPoliceCar(); G.copSpawnT = w >= 4 ? 1.5 : 3; }
    if (w >= 4 && !G.heli && G.heliT <= 0) spawnHeli();
  }
  // 逮捕判定
  if (G.state === 'play' && w > 0) {
    let near = false;
    if (!pl.inCar) {
      for (const p of G.peds) if (p.kind === 'cop' && !p.dead && dist(p.x, p.y, pl.x, pl.y) < 24) { near = true; break; }
      if (near && w >= 3 && pl.moving > 60) near = false;
    } else if (pl.inCar.speed < 25 && w <= 3) {
      for (const c of G.cars) if (c.type === 'police' && c.driver === 'cop' && dist(c.x, c.y, pl.x, pl.y) < 55) { near = true; break; }
      if (!near) for (const p of G.peds) if (p.kind === 'cop' && !p.dead && dist(p.x, p.y, pl.x, pl.y) < 34) { near = true; break; }
    }
    G.bustT = near ? G.bustT + dt : Math.max(0, G.bustT - dt * 2);
    if (G.bustT > (pl.inCar ? 2.5 : 1.6)) bustPlayer();
  } else G.bustT = 0;
  if (w === 0) for (const c of G.cars) if (c.type === 'police' && !c.ai && c.driver !== 'player') c.siren = false;
}

// ===== プレイヤー =====
function createPlayer() {
  const p = new Ped(0, 0, 'player');
  p.side = 'player'; p.shirt = '#ff4fa3'; p.pants = '#22314d'; p.skin = '#d9a066'; p.hair = '#1a1208';
  p.weapon = 'pistol'; p.ammo = { fist: Infinity, pistol: 48, smg: 0, shotgun: 0, rocket: 0 };
  p.fireCd = 0; p.hp = 100; p.maxHp = 100;
  return p;
}
function nextWeapon(dir) {
  const p = G.player;
  let i = WEAPON_ORDER.indexOf(p.weapon);
  for (let k = 0; k < WEAPON_ORDER.length; k++) {
    i = (i + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length;
    if (p.ammo[WEAPON_ORDER[i]] > 0) { p.weapon = WEAPON_ORDER[i]; return; }
  }
}
function toggleCar() {
  const p = G.player;
  if (p.inCar) { exitCar(false); return; }
  let best = null, bd = 1e9;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(p.x, p.y, c.x, c.y);
    if (d < c.len / 2 + 26 && d < bd) { bd = d; best = c; }
  }
  if (best) enterCar(best);
}
function enterCar(c) {
  const p = G.player;
  if (c.driver === 'ai' || c.driver === 'cop') {
    const pos = ejectPos(c), kind = c.driver === 'cop' ? 'cop' : 'civ';
    const d = new Ped(pos.x, pos.y, kind);
    if (kind === 'civ') { d.panic = 8; d.fx = p.x; d.fy = p.y; }
    G.peds.push(d);
    if (kind === 'cop') { for (let k = 1; k < c.copsIn; k++) G.peds.push(new Ped(pos.x + rand(-8, 8), pos.y + rand(-8, 8), 'cop')); addHeat(0.5, 2); }
    else if (copSees(p.x, p.y, 420)) addHeat(0, 1);
    Hud.flash('カージャック！');
  } else if (c.type === 'police') addHeat(0, 1);
  c.copsIn = 0; c.driver = 'player'; c.ai = null; c.handbrake = false; c.persistKeep = c.persist;
  p.inCar = c; p.x = c.x; p.y = c.y;
  Sound.door(); Sound.setRadio(true);
  Hud.showVeh(c.ct.name);
  const st = Sound.station; Hud.showRadio(st.name, st.sub);
}
function exitCar(force) {
  const p = G.player, c = p.inCar;
  if (!c) return;
  const pos = ejectPos(c);
  p.x = pos.x; p.y = pos.y; p.inCar = null;
  c.driver = null; c.throttle = 0; c.steer = 0;
  if (!force && c.speed > 230) { damagePed(p, 10, null); p.x += c.vx * 0.05; p.y += c.vy * 0.05; }
  Sound.door(); Sound.setRadio(false);
}
function killPlayer(reason) {
  if (G.state !== 'play') return;
  const p = G.player;
  p.hp = 0;
  if (p.inCar) exitCar(true);
  p.dead = true; G.state = 'wasted'; G.deadT = 0;
  addDecal({ kind: 'blood', x: p.x, y: p.y, r: 14, a: 0 });
  Missions.fail(reason, true);
  Hud.bigMsg('WASTED', reason, '#e0403a', 4.5, true);
  Sound.wasted();
}
function bustPlayer() {
  if (G.state !== 'play') return;
  const p = G.player;
  if (p.inCar) exitCar(true);
  G.state = 'busted'; G.deadT = 0; p.moving = 0;
  Missions.fail('逮捕された', true);
  Hud.bigMsg('BUSTED', '逮捕された', '#3b8bff', 4.5, true);
  Sound.wasted();
}
function respawn(kind) {
  const p = G.player, sp = kind === 'busted' ? World.policeHQ : World.hospital;
  p.x = sp.x; p.y = sp.y; p.angle = Math.PI / 2; p.hp = 100; p.dead = false; p.inCar = null; p.armor = 0;
  const fee = Math.min(G.money, kind === 'busted' ? 250 : 150);
  G.money -= fee;
  if (kind === 'busted') { p.ammo = { fist: Infinity, pistol: 0, smg: 0, shotgun: 0, rocket: 0 }; p.weapon = 'fist'; }
  G.heat = 0; G.lostT = 0; G.bustT = 0; G.heli = null; G.heliT = 0;
  G.peds = G.peds.filter((q) => q === p || (q.kind !== 'cop' && !q.dead) || q.persist);
  G.cars = G.cars.filter((c) => !(c.type === 'police' && c.ai) && !c.wrecked);
  G.projectiles.length = 0;
  G.clock = (G.clock + 240) % 1440;
  G.state = 'play';
  Hud.flash(kind === 'busted' ? `保釈金 -$${fee}　武器を没収された` : `治療費 -$${fee}`);
  cam.x = p.x; cam.y = p.y;
  saveGame();
}

function autoAim(p, range) {
  let best = null, bs = 1e9;
  for (const q of G.peds) {
    if (q === p || q.dead || q.inCar) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d > range) continue;
    const pri = q.kind === 'cop' ? (G.wanted > 0 ? 0 : 400) : q.kind === 'gang' ? 0 : 200;
    if (d + pri < bs && lineOfSight(p.x, p.y, q.x, q.y)) { bs = d + pri; best = q; }
  }
  if (G.heli && dist(p.x, p.y, G.heli.x, G.heli.y) < range) return Math.atan2(G.heli.y - p.y, G.heli.x - p.x);
  return best ? Math.atan2(best.y - p.y, best.x - p.x) : null;
}

function controlPlayer(dt) {
  const p = G.player;
  p.fireCd -= dt;
  if (kp('KeyF') || kp('KeyE')) toggleCar();
  if (kp('KeyQ') || Input.wheel > 0) nextWeapon(1);
  if (Input.wheel < 0) nextWeapon(-1);
  for (let k = 1; k <= 5; k++) if (kp('Digit' + k)) { const w = WEAPON_ORDER[k - 1]; if (p.ammo[w] > 0) p.weapon = w; }
  if (kp('KeyR') && p.inCar) { const st = Sound.nextStation(); Hud.showRadio(st.name, st.sub); }
  if (kp('KeyH') && p.inCar) { Sound.horn(1); scare(p.x + Math.cos(p.inCar.angle) * 60, p.y + Math.sin(p.inCar.angle) * 60, 90, 2); }

  const tj = Input.touch, mouseAim = !tj.on || performance.now() - Input.mouse.last < 4000;
  const mw = { x: (Input.mouse.x - W / 2) / cam.zoom + cam.x, y: (Input.mouse.y - H / 2) / cam.zoom + cam.y };

  if (p.inCar) {
    const c = p.inCar;
    let th = 0, st = 0;
    if (kd('KeyW') || kd('ArrowUp')) th += 1;
    if (kd('KeyS') || kd('ArrowDown')) th -= 1;
    if (kd('KeyA') || kd('ArrowLeft')) st -= 1;
    if (kd('KeyD') || kd('ArrowRight')) st += 1;
    const jm = Math.hypot(tj.jx, tj.jy);
    if (jm > 0.25) {
      const da = angDiff(c.angle, Math.atan2(tj.jy, tj.jx));
      if (Math.abs(da) > 2.3 && c.fwd < 60) { th = -jm; st = clamp(-da * 2, -1, 1); }
      else { th = jm; st = clamp(da * 2.2, -1, 1); }
    }
    c.throttle = th; c.steer = st; c.handbrake = kd('Space') || tj.brake;
    p.x = c.x; p.y = c.y; p.angle = c.angle;
  } else {
    let mx = 0, my = 0;
    if (kd('KeyW') || kd('ArrowUp')) my -= 1;
    if (kd('KeyS') || kd('ArrowDown')) my += 1;
    if (kd('KeyA') || kd('ArrowLeft')) mx -= 1;
    if (kd('KeyD') || kd('ArrowRight')) mx += 1;
    if (Math.hypot(tj.jx, tj.jy) > 0.15) { mx = tj.jx; my = tj.jy; }
    const m = Math.hypot(mx, my);
    if (m > 0.1) {
      const spd = (kd('ShiftLeft') || kd('ShiftRight') || m > 0.9 && tj.on ? 185 : 125) * Math.min(1, m);
      pedMove(p, Math.atan2(my, mx), spd, dt);
    } else p.moving = 0;
    if (mouseAim && !tj.on) p.angle = Math.atan2(mw.y - p.y, mw.x - p.x);
  }

  const wantFire = Input.mouse.down || tj.fire;
  if (wantFire && p.fireCd <= 0) {
    let w = p.weapon;
    if (p.inCar && WEAPONS[w].melee) { w = WEAPON_ORDER.find((k) => k !== 'fist' && p.ammo[k] > 0); }
    if (w) {
      let ang;
      if (tj.on && !(Input.mouse.down)) ang = autoAim(p, 330) ?? p.angle;
      else ang = Math.atan2(mw.y - p.y, mw.x - p.x);
      if (!p.inCar) p.angle = ang;
      fireWeapon(p, w, ang, p.inCar ? { car: p.inCar, off: 4 } : {});
      if (w !== 'fist') { p.ammo[w]--; if (p.ammo[w] <= 0 && p.weapon === w) nextWeapon(-1); }
      p.fireCd = WEAPONS[w].rate;
    }
  }
  if (G.hurtT > 0) G.hurtT -= dt;
}

// ===== ピックアップ =====
const PICKUP_INFO = {
  health: { label: '回復', color: '#ff4d6d' }, armor: { label: 'アーマー', color: '#4dabff' },
  pistol: { label: 'ピストル', color: '#ffd23f', ammo: 24 }, smg: { label: 'SMG', color: '#ffd23f', ammo: 90 },
  shotgun: { label: 'ショットガン', color: '#ffd23f', ammo: 16 }, rocket: { label: 'ロケラン', color: '#ff7a1a', ammo: 4 },
  cash: { label: '現金', color: '#4dff88' },
};
function placePickups() {
  const plan = { health: 7, armor: 4, pistol: 4, smg: 3, shotgun: 3, rocket: 1, cash: 6 };
  for (const [type, n] of Object.entries(plan)) for (let k = 0; k < n; k++) {
    const s = randomSidewalkPoint();
    G.pickups.push({ x: s.x, y: s.y, type, amount: type === 'cash' ? randi(100, 400) : (PICKUP_INFO[type].ammo || 0), once: false, respawn: 0 });
  }
}
function updatePickups(dt) {
  const pl = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    if (k.respawn > 0) { k.respawn -= dt; continue; }
    if (k.once) { k.life -= dt; if (k.life <= 0) { G.pickups.splice(i, 1); continue; } }
    if (G.state !== 'play' || dist(pl.x, pl.y, k.x, k.y) > (pl.inCar ? 26 : 18)) continue;
    let ok = true, msg = '';
    if (k.type === 'health') { if (pl.hp >= 100) ok = false; else { pl.hp = Math.min(100, pl.hp + 50); msg = '体力回復'; } }
    else if (k.type === 'armor') { if (pl.armor >= 100) ok = false; else { pl.armor = 100; msg = 'ボディアーマー'; } }
    else if (k.type === 'cash') { G.money += k.amount; msg = `+$${k.amount}`; Sound.cash(); }
    else { pl.ammo[k.type] = (pl.ammo[k.type] || 0) + k.amount; if (pl.weapon === 'fist') pl.weapon = k.type; msg = `${WEAPONS[k.type].name} +${k.amount}`; }
    if (!ok) continue;
    if (k.type !== 'cash') Sound.pickup();
    Hud.flash(msg, 1.6);
    if (k.once) G.pickups.splice(i, 1); else k.respawn = 50;
  }
}

// ===== スポーン管理 =====
function onScreen(x, y, m = 0) {
  return Math.abs(x - cam.x) < W / 2 / cam.zoom + m && Math.abs(y - cam.y) < H / 2 / cam.zoom + m;
}
function spawnTraffic(near) {
  const pl = G.player;
  const p = lanePointNear(pl.x, pl.y, near ? 150 : 520, 1150);
  if (!p || (!near && onScreen(p.x, p.y, 60))) return;
  for (const c of G.cars) if (Math.abs(c.x - p.x) < 60 && Math.abs(c.y - p.y) < 60) return;
  const c = new Car(p.x, p.y, DIR_ANG[p.dir], pick(TRAFFIC_MIX));
  c.driver = 'ai'; c.ai = makeAI('traffic', p, c);
  c.vx = Math.cos(c.angle) * 110; c.vy = Math.sin(c.angle) * 110;
  G.cars.push(c);
}
function spawnPed(near) {
  const pl = G.player;
  const s = sidewalkPointNear(pl.x, pl.y, near ? 120 : 480, 1000);
  if (!s || (!near && onScreen(s.x, s.y, 40))) return;
  const p = new Ped(s.x, s.y, 'civ');
  p.path = { bi: s.bi, bj: s.bj, c: s.c, dir: 1 };
  if (Math.random() < 0.5) { p.path.dir = -1; p.path.c = (s.c + 3) % 4; }
  G.peds.push(p);
}
function manageSpawns(dt, initial) {
  const pl = G.player;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const c = G.cars[i];
    if (c === pl.inCar || c.persist) continue;
    const d = dist(c.x, c.y, pl.x, pl.y);
    if (d > (c.driver ? 1500 : 2300) && !onScreen(c.x, c.y, 100)) G.cars.splice(i, 1);
  }
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const p = G.peds[i];
    if (p === pl || p.persist) continue;
    const d = dist(p.x, p.y, pl.x, pl.y);
    if ((d > 1350 && !onScreen(p.x, p.y, 60)) || (p.dead && p.deadT > 45)) G.peds.splice(i, 1);
  }
  const night = G.clock < 5 * 60 || G.clock > 22 * 60;
  let traffic = 0, civs = 0;
  for (const c of G.cars) if (c.ai && c.ai.mode === 'traffic') traffic++;
  for (const p of G.peds) if (p.kind === 'civ' && !p.dead) civs++;
  const tc = night ? 16 : 24, pc = night ? 22 : 42;
  for (let k = 0; k < (initial ? 60 : 2) && traffic < tc; k++) { const n = G.cars.length; spawnTraffic(initial); if (G.cars.length > n) traffic++; }
  for (let k = 0; k < (initial ? 80 : 2) && civs < pc; k++) { const n = G.peds.length; spawnPed(initial); if (G.peds.length > n) civs++; }
  // 駐車場
  for (const s of World.spots) {
    if (s.next > G.t) continue;
    const d = dist(s.x, s.y, pl.x, pl.y);
    if (d > 1300 || (!initial && (d < 500 || onScreen(s.x, s.y, 40)))) continue;
    s.next = G.t + 90;
    if (Math.random() > (s.type === 'police' ? 0.6 : 0.45)) continue;
    if (G.cars.some((c) => Math.abs(c.x - s.x) < 24 && Math.abs(c.y - s.y) < 30)) continue;
    const type = s.type === 'police' ? 'police' : pick(['compact', 'sedan', 'sedan', 'sports', 'van', 'taxi']);
    G.cars.push(new Car(s.x, s.y, s.a + (Math.random() < 0.5 ? Math.PI : 0), type));
  }
}

// ===== 塗装屋（手配度クリア） =====
function updateSpray(dt) {
  G.sprayCd -= dt;
  const pl = G.player, s = World.spray;
  if (!pl.inCar || G.sprayCd > 0 || dist(pl.x, pl.y, s.x, s.y) > 34) return;
  if (G.wanted === 0) { G.sprayCd = 3; Hud.flash('塗装屋：手配されていない時は用はないぜ', 2); return; }
  if (G.money < 300) { G.sprayCd = 3; Hud.flash('塗装屋：$300 必要だ', 2); return; }
  G.money -= 300; G.heat = 0; G.lostT = 0;
  const c = pl.inCar; c.hp = c.maxHp; c.color = c.type === 'police' ? c.color : pick(c.ct.colors.length > 1 ? c.ct.colors : CAR_TYPES.sedan.colors);
  G.sprayCd = 8; Sound.cash();
  Hud.bigMsg('リペイント完了', '手配度クリア  -$300', '#ff9f43', 2.5);
  saveGame();
}

// ===== メインループ =====
function updateCamera(dt) {
  const p = G.player;
  const base = clamp(Math.min(W, H) / 820, 0.46, 1.25);
  let tx = p.x, ty = p.y, tz = base * 1.05;
  if (G.state === 'title') {
    const a = G.t * 0.05;
    tx = CITY * T * 0.5 + Math.cos(a) * 900; ty = MH * T * 0.5 + Math.sin(a * 1.3) * 700; tz = base * 0.75;
  } else if (p.inCar) {
    const c = p.inCar;
    tx += c.vx * 0.42; ty += c.vy * 0.42;
    tz = base * (0.9 - clamp(c.speed / 650, 0, 1) * 0.28);
  }
  const k = 1 - Math.exp(-dt * (G.state === 'title' ? 0.6 : 4.5));
  cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
  cam.zoom = lerp(cam.zoom, G.showMap ? tz : tz, 1 - Math.exp(-dt * 1.6));
  G.shake = Math.max(0, G.shake - dt * 28);
}

function updateAudio() {
  const p = G.player;
  const inCar = G.state === 'play' && p.inCar;
  Sound.setEngine(!!inCar, inCar ? clamp(Math.abs(p.inCar.fwd) / 500, 0, 1.3) : 0, inCar ? Math.abs(p.inCar.throttle) : 0);
  let near = 1e9;
  for (const c of G.cars) if (c.siren) near = Math.min(near, dist(c.x, c.y, cam.x, cam.y));
  Sound.setSiren(G.state === 'title' ? 0 : clamp(1 - near / 950, 0, 1), G.t);
}

function update(dt) {
  G.t += dt;
  G.clock = (G.clock + dt) % 1440;
  const pl = G.player;
  if (G.state === 'play') controlPlayer(dt);
  for (const c of G.cars) {
    if (c.ai && !c.dead) updateCarAI(c, dt);
    else if (c !== pl.inCar) { c.throttle = 0; c.steer = 0; c.handbrake = true; }
  }
  for (const c of G.cars) c.update(dt);
  for (let i = 0; i < G.cars.length; i++) for (let j = i + 1; j < G.cars.length; j++) collideCars(G.cars[i], G.cars[j]);
  if (pl.inCar) { pl.x = pl.inCar.x; pl.y = pl.inCar.y; }
  for (const p of G.peds) if (p !== pl) updatePed(p, dt);
  carPedCollisions();
  updateProjectiles(dt);
  updateParticles(dt);
  updateHeli(dt);
  updatePolice(dt);
  updatePickups(dt);
  if (G.state !== 'title') { Missions.update(dt); updateSpray(dt); }
  manageSpawns(dt, false);
  G.districtT -= dt;
  if (G.districtT <= 0 && G.state === 'play') {
    G.districtT = 0.5;
    const d = districtAt(pl.x, pl.y);
    if (d !== G.district) { G.district = d; Hud.showArea(d); }
  }
  Hud.update(dt);
  updateCamera(dt);
  updateAudio();
}

let lastT = performance.now(), perfAcc = 0, perfN = 0;
function frame(now) {
  const rawDt = (now - lastT) / 1000, dt = Math.min(0.05, rawDt); lastT = now;
  // 重い端末では解像度を落とす
  if (G.state !== 'title' && !G.paused && rawDt < 0.5) {
    perfAcc += rawDt; perfN++;
    if (perfN >= 120) { if (perfAcc / perfN > 1 / 38 && MAX_DPR > 1) { MAX_DPR = 1; resize(); } perfAcc = 0; perfN = 0; }
  }
  if (kp('Escape') || kp('KeyP')) { if (G.state !== 'title') togglePause(); }
  if (kp('KeyM') && G.state !== 'title' && !G.paused) G.showMap = !G.showMap;
  if (G.state === 'title') update(dt);
  else if (!G.paused && !G.showMap) {
    const dead = G.state === 'wasted' || G.state === 'busted';
    update(dead ? dt * 0.35 : dt);
    if (dead) { G.deadT += dt; if (G.deadT > 4.2) respawn(G.state); }
  }
  render();
  endInputFrame();
  requestAnimationFrame(frame);
}

function togglePause(force) {
  G.paused = force ?? !G.paused;
  document.getElementById('pause').classList.toggle('hidden', !G.paused);
  Sound.setMaster(G.paused ? 0 : 0.55);
}

function startGame() {
  if (G.state !== 'title') return;
  Sound.init();
  document.getElementById('title').classList.add('hidden');
  if (Input.touch.on) document.getElementById('touch').style.display = 'block';
  const p = G.player, c = Missions.contacts[0];
  p.x = c.x + 40; p.y = c.y + 10;
  cam.x = p.x; cam.y = p.y;
  G.cars = G.cars.filter((k) => dist(k.x, k.y, p.x, p.y) > 60);
  G.state = 'play'; G.clock = 9 * 60;
  Missions.contacts[0].armed = false;
  manageSpawns(0, true);
  Hud.bigMsg('NEON BAY', 'ようこそ、ネオン・ベイへ', '#ff4fa3', 3.5);
  Hud.help(IS_TOUCH
    ? '左スティック：移動／運転　FIRE：射撃（自動照準）　CAR：乗り降り　黄色い Ⓜ マーカーでミッション'
    : 'WASD：移動／運転　マウス：照準＆射撃　F：車に乗る／降りる　Space：ハンドブレーキ　Q：武器切替　R：ラジオ　M：地図　黄色い Ⓜ マーカーでミッション', 14);
}

function init() {
  resize();
  buildSprites();
  genWorld(1985);
  G.player = createPlayer();
  G.peds.push(G.player);
  G.money = SAVE.money ?? 500;
  G.completed = SAVE.completed || 0;
  Missions.init();
  placePickups();
  G.player.x = CITY * T * 0.5; G.player.y = MH * T * 0.5;
  cam.x = G.player.x; cam.y = G.player.y; cam.zoom = 0.6;
  manageSpawns(0, true);
  bindMouse(cv);
  bindTouch();
  const title = document.getElementById('title');
  title.addEventListener('click', startGame);
  title.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });
  addEventListener('keydown', (e) => { if (G.state === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame(); });
  document.getElementById('resume').addEventListener('click', () => togglePause(false));
  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('セーブデータを消去して最初からやり直しますか？')) return;
    try { localStorage.removeItem('neonbay-save'); } catch (e) { /* ignore */ }
    location.reload();
  });
  requestAnimationFrame(frame);
  window.G = G;
}
window.addEventListener('load', init);
