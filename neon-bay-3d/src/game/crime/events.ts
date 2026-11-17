import { game, toast, save, progress } from '../state/store';
import { peds, ejectPed, Ped } from '../ai/peds';
import { blocks, SIG, LANDMARK3D, pointBlocked, groundAt, HALF, STATION } from '../world/cityGen';
import { line } from '../line/line';
import { mission } from './story';
import { sfx, sfxAt } from '../audio';

/**
 * Things that happen in the street while you walk about, each with a decision to make:
 *  - a purse snatcher runs past: knock him down (a punch, a tackle, a car), then give the bag back or keep what is in it;
 *  - a wallet lies on the pavement: take it to the police box, or pocket the money;
 *  - a lost tourist asks the way to a landmark: point them the right way (or the wrong one).
 * What you choose moves your reputation in the city (shown on the phone); a good name gets you a discount in the shops,
 * and keeping other people's money in front of a witness gets you wanted.
 */
export type EventKind = '' | 'snatch' | 'wallet' | 'tourist';
export interface Choice { title: string; text: string; who: string; options: { label: string; sub?: string; pick: () => void }[] }
export const ev = {
  kind: '' as EventKind, stage: 0, t: 0, /** game clock time of the next event */ next: 75,
  ped: null as Ped | null, x: 0, z: 0, cash: 0, target: '', dir: 0,
  /** carrying a found wallet to the police box */ carrying: 0,
  /** the decision on screen (null: none) */ choice: null as Choice | null,
  /** where the mark over the event floats (null: none) */ mark: null as null | { x: number; y: number; z: number; icon: '!' | '?' | '$' },
};
export const rep = () => progress.stats.flags.rep || 0;
export const repName = () => { const r = rep(); return r >= 10 ? '街の人気者' : r >= 5 ? '頼れる人' : r >= 1 ? 'いい人' : r <= -10 ? '札付きの悪' : r <= -5 ? 'ならず者' : r <= -1 ? '怪しい人' : 'ふつう'; };
/** Shop prices: 10 % off for someone the neighbourhood trusts. */
export const discount = () => (rep() >= 5 ? 0.9 : 1);
function addRep(n: number, why: string) { progress.stats.flags.rep = Math.max(-20, Math.min(20, rep() + n)); if (n) toast(`${why}（評判 ${n > 0 ? '+' : ''}${n} → ${repName()}）`, 3); }
const pay = (n: number) => { game.money += n; progress.stats.earned += n; sfx('buy', 0.7); };
const done = (gap = 110) => { ev.kind = ''; ev.stage = 0; ev.ped = null; ev.mark = null; ev.choice = null; ev.next = game.clock + gap + Math.random() * 70; save(); };

/** A free spot on a pavement about d metres from the player (ahead of the camera when there is one), or null. */
function spotNear(d: number): { x: number; z: number } | null {
  const P = game.player, yaw = game.cam.yaw + Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw), IN = 2.6, out: { x: number; z: number; w: number }[] = [];
  for (const B of blocks) {
    if (B.zone === 'water' || B.zone === 'canal' || P.x < B.x0 - d * 1.5 || P.x > B.x1 + d * 1.5 || P.z < B.z0 - d * 1.5 || P.z > B.z1 + d * 1.5) continue;
    // walk the pavement ring of the block (IN metres inside its kerb), a point every 3 m
    const ring: [number, number][] = [];
    for (let x = B.x0 + IN; x <= B.x1 - IN; x += 3) ring.push([x, B.z0 + IN], [x, B.z1 - IN]);
    for (let z = B.z0 + IN + 3; z <= B.z1 - IN - 3; z += 3) ring.push([B.x0 + IN, z], [B.x1 - IN, z]);
    for (const [x, z] of ring) {
      const dx = x - P.x, dz = z - P.z, L = Math.hypot(dx, dz); if (L < d * 0.7 || L > d * 1.4 || Math.abs(x) > HALF - 10 || Math.abs(z) > HALF - 10) continue;
      if (pointBlocked(x, 0.9, z) || pointBlocked(x, 1.6, z)) continue;
      out.push({ x, z, w: 1 + Math.max(0, (dx * fx + dz * fz) / L) * 3 });
    }
  }
  if (!out.length) return null;
  let r = Math.random() * out.reduce((a, q) => a + q.w, 0); for (const q of out) { r -= q.w; if (r <= 0) return q; }
  return out[out.length - 1];
}
const idle = () => game.started && game.where === 'out' && !game.inCar && game.wanted === 0 && mission.id < 0 && !line.on && !game.phone && !game.ui && !game.paused;

function start(kind: EventKind): boolean {
  const P = game.player;
  if (kind === 'snatch') {
    const s = spotNear(16); if (!s) return false;
    const th = ejectPed(s.x, s.z, P.x, P.z); th.callT = 0; th.outfit = 0; th.cash = 0; th.speed = 1.5; th.t = 60;
    ev.ped = th; ev.cash = 180 + Math.floor(Math.random() * 420); ev.kind = kind; ev.stage = 0; ev.t = 45;
    toast('🚨 ひったくりだ！ 逃げていく男を止めろ（殴る・体当たり・車で）', 3.6); sfxAt('crash', s.x, s.z, 0.6, 80);
    return true;
  }
  if (kind === 'wallet') {
    if (!SIG.koban.length) return false; const s = spotNear(22); if (!s) return false;
    ev.x = s.x; ev.z = s.z; ev.cash = 60 + Math.floor(Math.random() * 340); ev.kind = kind; ev.stage = 0; ev.t = 120;
    toast('👛 歩道に財布が落ちている', 2.6); return true;
  }
  if (kind === 'tourist') {
    const spots: [string, number, number][] = [[LANDMARK3D.label, LANDMARK3D.x, LANDMARK3D.z], ...SIG.shrines.slice(0, 3).map((q) => [q.name, q.x, q.z] as [string, number, number])];
    if (STATION) spots.push([STATION.label, STATION.x, STATION.z]);
    const far = spots.filter((q) => Math.hypot(q[1] - P.x, q[2] - P.z) > 180); if (!far.length) return false;
    const s = spotNear(12); if (!s) return false;
    const T = far[Math.floor(Math.random() * far.length)], tp = ejectPed(s.x, s.z, s.x, s.z); tp.state = 'idle'; tp.t = 90; tp.callT = 0; tp.flail = false;
    const a = Math.atan2(T[1] - s.x, -(T[2] - s.z)); // 0 = north (−z), clockwise
    ev.ped = tp; ev.x = s.x; ev.z = s.z; ev.target = T[0]; ev.dir = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4; ev.kind = kind; ev.stage = 0; ev.t = 80;
    toast('🙋 観光客が道に迷っているようだ', 2.6); return true;
  }
  return false;
}
/** Start an event now (tests, and the admin panel). */
export function forceEvent(kind: EventKind) { if (ev.kind) done(0); return start(kind); }

/** Per frame. */
export function updateEvents(dt: number) {
  if (!game.started) return;
  const P = game.player;
  if (!ev.kind) {
    if (game.clock > ev.next && idle() && Math.abs(P.x) < HALF - 60 && Math.abs(P.z) < HALF - 60) {
      const h = game.hour, order: EventKind[] = Math.random() < 0.4 ? ['snatch', 'wallet', 'tourist'] : h > 8 && h < 19 && Math.random() < 0.6 ? ['tourist', 'wallet', 'snatch'] : ['wallet', 'snatch', 'tourist'];
      if (!order.some((k) => start(k))) ev.next = game.clock + 20;
    }
    return;
  }
  ev.t -= dt;
  if (ev.choice) { ev.mark = null; return; }
  if (ev.kind === 'snatch') {
    const th = ev.ped!, gone = !peds.includes(th), d = Math.hypot(th.x - P.x, th.z - P.z);
    if (th.state === 'down' || th.state === 'dead' || th.state === 'getup') {
      ev.choice = { who: '持ち主の女性', title: 'ひったくりを止めた', text: `バッグが歩道に転がった。中には現金 $${ev.cash} と身分証。持ち主が息を切らして走ってくる。`, options: [
        { label: 'バッグを返す', sub: '謝礼 $120・評判 +2', pick: () => { pay(120); addRep(2, '「ありがとうございます！」バッグを返した'); progress.stats.flags.ev_snatch = 1; done(); } },
        { label: '中身をいただく', sub: `$${ev.cash}・評判 −3・目撃されるかも`, pick: () => { pay(ev.cash); addRep(-3, 'バッグの現金を抜き取った'); if (Math.random() < 0.5) game.wanted = Math.max(game.wanted, 1); done(); } },
      ] };
      sfx('ui'); return;
    }
    if (th.state !== 'flee') th.state = 'flee';
    th.t = 9; th.fx = P.x; th.fz = P.z; // keeps running from you
    ev.mark = { x: th.x, y: th.y + 2.3, z: th.z, icon: '!' };
    if (gone || d > 150 || ev.t <= 0) { toast('ひったくり犯に逃げられた…', 2.4); addRep(0, ''); done(60); }
  } else if (ev.kind === 'wallet') {
    if (ev.stage === 0) { ev.mark = { x: ev.x, y: groundAt(ev.x, ev.z) + 1.3, z: ev.z, icon: '$' }; if (ev.t <= 0 || Math.hypot(ev.x - P.x, ev.z - P.z) > 220) done(40); }
    else { const k = nearestKoban(); ev.mark = k ? { x: k.x, y: 5, z: k.z - 2.6, icon: '!' } : null; }
  } else if (ev.kind === 'tourist') {
    const tp = ev.ped!; if (!peds.includes(tp) || tp.state === 'flee' || tp.state === 'down' || tp.state === 'dead' || ev.t <= 0) { done(50); return; }
    tp.state = 'idle'; tp.t = 5; tp.vx = tp.vz = 0; tp.x = ev.x; tp.z = ev.z; tp.yaw = Math.atan2(P.x - tp.x, P.z - tp.z); // stands where they stopped you
    ev.mark = { x: tp.x, y: tp.y + 2.3, z: tp.z, icon: '?' };
  }
}
const nearestKoban = () => { const P = game.player; let b: { x: number; z: number } | null = null, bd = 1e9; for (const k of SIG.koban) { const d = Math.hypot(k.x - P.x, k.z - P.z); if (d < bd) { bd = d; b = k; } } return b; };
const DIRS = ['北', '東', '南', '西'], ARROWS = ['⬆️', '➡️', '⬇️', '⬅️'];
/** The prompt for an event next to you, if any. */
export function eventNear(): { kind: 'job'; id: string; label: string; btn: string } | null {
  if (!ev.kind || ev.choice || game.inCar || game.where !== 'out') return null;
  const P = game.player;
  if (ev.kind === 'wallet' && ev.stage === 0 && Math.hypot(ev.x - P.x, ev.z - P.z) < 2.2) return { kind: 'job', id: 'ev:wallet', label: '落ちている財布を拾う', btn: '拾う' };
  if (ev.kind === 'wallet' && ev.stage === 1) { const k = nearestKoban(); if (k && Math.hypot(k.x - P.x, k.z - 2.6 - P.z) < 2.6) return { kind: 'job', id: 'ev:koban', label: '交番に財布を届ける', btn: '届ける' }; }
  if (ev.kind === 'tourist' && ev.ped && Math.hypot(ev.ped.x - P.x, ev.ped.z - P.z) < 3.4) return { kind: 'job', id: 'ev:tourist', label: '観光客に話しかける', btn: '話す' };
  return null;
}
export function eventAction(id: string) {
  if (id === 'ev:wallet') {
    ev.choice = { who: '', title: '財布を拾った', text: `中には現金 $${ev.cash} とカードが数枚。持ち主は困っているはずだ。`, options: [
      { label: '交番に届ける', sub: '最寄りの交番へ案内・評判 +3', pick: () => { const k = nearestKoban(); ev.stage = 1; ev.carrying = ev.cash; ev.choice = null; ev.t = 9999; if (k) game.waypoint = { x: k.x, z: k.z - 2.6 }; toast('交番を目的地に設定した。財布を届けよう', 2.6); sfx('ui'); } },
      { label: '自分のものにする', sub: `$${ev.cash}・評判 −2`, pick: () => { pay(ev.cash); addRep(-2, '拾った財布をネコババした'); done(); } },
    ] }; sfx('ui');
  } else if (id === 'ev:koban') {
    const gift = Math.max(20, Math.round(ev.carrying * 0.15)); pay(gift); game.waypoint = null; ev.carrying = 0; progress.stats.flags.ev_wallet = 1;
    addRep(3, `🚓 「ご協力ありがとうございます」持ち主からの謝礼 $${gift}`); done();
  } else if (id === 'ev:tourist') {
    const right = ev.dir, opts = [0, 1, 2, 3].map((k) => ({ label: `${ARROWS[k]} ${DIRS[k]}のほうです`, pick: () => {
      if (k === right) { pay(20); progress.stats.flags.ev_tourist = 1; addRep(1, `「サンキュー！」お礼に $20 もらった`); } else addRep(-1, `観光客は${DIRS[k]}へ歩いていった…（${ev.target}は${DIRS[right]}だった）`);
      if (ev.ped) { ev.ped.state = 'flee'; ev.ped.t = 3; ev.ped.fx = ev.ped.x - [0, 1, 0, -1][k] * 5; ev.ped.fz = ev.ped.z - [-1, 0, 1, 0][k] * 5; ev.ped.flail = false; }
      done();
    } }));
    ev.choice = { who: '観光客', title: '道を聞かれた', text: `「すみません、${ev.target}はどっちですか？」（ミニマップは上が進行方向。マップで確かめてもいい）`, options: opts }; sfx('ui');
  }
}
