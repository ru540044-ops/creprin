import { japanNear, japanAction, shinNear } from './japan';
import { hoursText } from '../world/hours';
import { eventNear, eventAction } from './events';
import { parkNear, parkAction } from './parking';
import { game, toast, save, progress } from '../state/store';
import { vehicles, spawn, remove, playerCar, hooks, Veh } from '../vehicles/sim';
import { VDEFS, VKind } from '../vehicles/defs';
import { newAI, steer, clearLine, nodeIdx } from '../ai/driver';
import { nodeOpen, CUSTOMS, roadC, N, POLICE_HQ, HOSPITAL, EXPORT_DOCK, TRIALS, Trial, HALF, groundAt } from '../world/cityGen';
import { INTERIORS, viewMode } from '../world/Interiors';
import { releaseDrive } from '../input';
import { sfx, siren } from '../audio';
import { cruise, panic } from '../ai/traffic';
import { flash } from '../combat/fx';
import { clamp } from '../world/rng';
import { admin } from '../admin';
import { PROPERTIES } from '../world/homes';
import { updateStunts, updateTaxi, taxi, stunt } from './stunts';
import { RACES, race, raceDef, startRace, updateRace, position, fmtT, PRIZES } from './race';
import { storyNear, storyStatus, updateStory, startMission } from './story';
import { updateGifts } from './gifts';
import { eatMeal, meal } from './shops';

/* =====================================================================
   Wanted level + police
   ===================================================================== */
/** Where the rooftop elevator exit is while you are up on a roof (so you can ride back down). */
export const roofTrip = { on: false, x: 0, z: 0, y: 0, from: '' };
export const law = {
  lastSeen: { x: 0, z: 0 }, unseen: 0, seen: false, seeT: 0, bust: 0, spawnT: 0, hitT: 0, hurtT: 99,
  over: null as null | { kind: 'busted' | 'wasted'; t: number; fine: number },
};
export const ppos = () => (game.where === 'out' ? game.player : game.outsidePos);
export const searchRadius = () => 70 + game.wanted * 35;

export function setWanted(n: number, why?: string) {
  if (admin.is && admin.noWanted) return;
  n = Math.min(5, n); const p = ppos();
  if (n > 0) { law.lastSeen = { x: p.x, z: p.z }; law.unseen = 0; }
  if (n <= game.wanted) return;
  game.wanted = n; law.spawnT = Math.min(law.spawnT, 2.5);
  if (why) toast(why + '　手配度 ' + '★'.repeat(n), 2.6);
}

/** Is a police car (patrolling or chasing) close enough with a clear view of (x,z)? */
export function copSees(x: number, z: number, r: number): boolean {
  for (const c of vehicles) if (c.role === 'police' && c.ai && !c.dead && Math.hypot(c.x - x, c.z - z) < r && clearLine(c.x, c.z, x, z, 1.5)) return true;
  return false;
}
/** Damage to the player: body armour soaks it up first. */
export function damagePlayer(dmg: number) {
  if (admin.is && admin.god) return;
  if (law.over) return; const A = game.arms, a = Math.min(A.armor, dmg * 0.8); A.armor -= a; game.health = Math.max(0, game.health - (dmg - a)); law.hurtT = 0;
}

function spawnCop(px: number, pz: number) {
  const pi = nodeIdx(px), pj = nodeIdx(pz), bx = Math.sin(game.cam.yaw), bz = Math.cos(game.cam.yaw);
  let pick: [number, number] | null = null, fallback: [number, number] | null = null;
  for (let k = 0; k < 24; k++) {
    const i = clamp(pi + Math.round((Math.random() - 0.5) * 5), 0, N), j = clamp(pj + Math.round((Math.random() - 0.5) * 5), 0, N);
    const x = roadC(i), z = roadC(j), d = Math.hypot(x - px, z - pz);
    if (d < 110 || d > 260 || !nodeOpen(i, j)) continue;
    if (vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 9)) continue;
    fallback = fallback || [i, j];
    if ((x - px) * bx + (z - pz) * bz > 0) { pick = [i, j]; break; } // behind the camera: not seen popping in
  }
  const n = pick || fallback; if (!n) return;
  const x = roadC(n[0]), z = roadC(n[1]), yaw = Math.atan2(px - x, pz - z);
  const v = spawn('police', x, z, Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2), '#15171c');
  v.role = 'police'; v.touched = true; v.ai = newAI(x, z, { mode: 'chase', sp: null });
}

function updatePolice(dt: number) {
  const p = ppos(), me = playerCar(), out = game.where === 'out';
  const cops = vehicles.filter((v) => v.role === 'police' && v.id !== game.inCar);
  law.hitT = Math.max(0, law.hitT - dt);
  if (game.wanted > 0) {
    law.seeT -= dt;
    if (law.seeT <= 0) {
      law.seeT = 0.25; law.seen = false;
      if (out) for (const c of cops) { if (c.dead || !c.ai) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < 14 || (d < 90 && clearLine(c.x, c.z, p.x, p.z, 1.6))) { law.seen = true; break; } }
    }
    if (law.seen) { law.lastSeen = { x: p.x, z: p.z }; law.unseen = 0; } else law.unseen += dt;
    const away = Math.hypot(p.x - law.lastSeen.x, p.z - law.lastSeen.z) > searchRadius();
    if ((law.unseen > 5 + game.wanted * 2 && away) || law.unseen > 50) { game.wanted = 0; law.bust = 0; toast('警察を振り切った！', 2.4); sfx('ui'); }
  } else law.seen = false;

  const need = game.wanted, active = cops.filter((c) => !c.dead && c.ai && c.ai.mode === 'chase');
  law.spawnT -= dt;
  if (active.length < need && law.spawnT <= 0 && game.started) { spawnCop(p.x, p.z); law.spawnT = 3.5; }
  let nearest = 1e9, busting = false;
  for (const c of cops) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (!c.ai) { if (d > 380) remove(c); continue; } // a police car the player abandoned
    if (c.dead) { c.ai.ctl = null; if (d > 160) remove(c); continue; }
    if (c.ai.mode === 'patrol') { if (game.wanted > 0) { c.ai.mode = 'chase'; c.ai.direct = 0; } else { c.ai.ctl = cruise(c, dt, 12); if (d > 300) remove(c); continue; } }
    if (game.wanted === 0 && c.ai.mode === 'chase') { c.ai.mode = 'leave'; c.ai.t = 0; }
    if (c.ai.mode === 'leave') { c.ai.ctl = steer(c, null, dt, { speed: 13, lane: 3.2 }); if (d > 140 || c.ai.t > 40) remove(c); continue; }
    if (d > 420) { remove(c); continue; }
    nearest = Math.min(nearest, d);
    let tgt: { x: number; z: number } = p;
    if (!law.seen && law.unseen > 2.5) { // search the area around the last sighting
      if (!c.ai.sp || Math.hypot(c.x - c.ai.sp.x, c.z - c.ai.sp.z) < 16) { const a = Math.random() * Math.PI * 2, r = Math.random() * searchRadius() * 0.8; c.ai.sp = { x: roadC(nodeIdx(law.lastSeen.x + Math.sin(a) * r)), z: roadC(nodeIdx(law.lastSeen.z + Math.cos(a) * r)) }; }
      tgt = c.ai.sp;
    } else if (me) tgt = { x: me.x + me.vx * 0.5, z: me.z + me.vz * 0.5 };
    c.ai.ctl = steer(c, out ? tgt : game.outsidePos, dt, { speed: 36, stopAt: !out ? 12 : me ? 0 : 7, ram: !!me && law.seen });
    if (out && law.seen && d < (me ? 8 : 9) && Math.hypot(c.vx, c.vz) < 5) busting = true;
    // from two stars up, officers shoot from slow or stopped cars
    if (out && law.seen && game.wanted >= 2 && d < 40 && Math.hypot(c.vx, c.vz) < 7) {
      c.ai.shootT = (c.ai.shootT ?? 0.8) - dt;
      if (c.ai.shootT <= 0 && clearLine(c.x, c.z, p.x, p.z, 1.4)) {
        c.ai.shootT = 1.25 - game.wanted * 0.1 + Math.random() * 0.5;
        const side = Math.cos(c.yaw), sz = -Math.sin(c.yaw); flash(c.x + side * 1.1, c.y + 1.3, c.z + sz * 1.1, 0.8); sfx('shot', clamp(1 - d / 60, 0.15, 0.7));
        const fast = me ? Math.hypot(me.vx, me.vz) > 12 : game.player.speed > 4;
        if (Math.random() < 0.6 - d / 100 - (fast ? 0.25 : 0) + game.wanted * 0.03) { if (me) { me.hp -= 2.5; if (Math.random() < 0.45) damagePlayer(4 + game.wanted); } else damagePlayer(5 + game.wanted * 1.5); }
      }
    }
  }
  // busted: stopped next to a police car while it can see you
  const slow = me ? Math.hypot(me.vx, me.vz) < 2 : game.player.speed < 3.2;
  if (busting && game.wanted > 0 && game.wanted <= 3) law.bust += dt * (slow ? 1 : 0.35); else law.bust = Math.max(0, law.bust - dt * 0.6);
  if (law.bust > 2.6 && !law.over) over('busted');
  siren(game.wanted > 0 && nearest < 1e9 ? clamp(1 - nearest / 170, 0, 1) : 0);
}

function over(kind: 'busted' | 'wasted') {
  if (admin.is && admin.god) { law.bust = 0; if (kind === 'wasted') game.health = 100; return; }
  const fine = Math.min(game.money, kind === 'busted' ? 1000 : 1500);
  law.over = { kind, t: 3.4, fine }; releaseDrive(); sfx('crash', 0.6);
}
function respawn(kind: 'busted' | 'wasted', fine: number) {
  const L = kind === 'busted' ? POLICE_HQ : HOSPITAL, p = game.player;
  game.money -= fine; game.inCar = 0; if (kind === 'wasted') game.arms.armor = 0; game.ui = ''; game.where = 'out'; game.wanted = 0; law.bust = 0; law.unseen = 0; game.health = 100;
  for (const v of [...vehicles]) if (v.role === 'police' && v.ai) remove(v);
  rob.phase = ''; armored.pry = 0; if (trial.id) { trial.id = ''; game.waypoint = null; }
  p.x = L.spawn.x; p.z = L.spawn.z; p.y = groundAt(p.x, p.z); p.vy = 0; p.yaw = L.spawn.yaw; game.cam.yaw = p.yaw + Math.PI;
  toast((kind === 'busted' ? '逮捕された。罰金 ' : '病院で治療を受けた。治療費 ') + '-$' + fine.toLocaleString('en-US'), 3.2); save();
}

/* =====================================================================
   Store robbery (QWIK 24 / gas-station shops)
   ===================================================================== */
export const ROB_SPOT = { x: 6.2, z: 2.5 }, CLERK = { x: 5, z: 4.75 }, BAG = { x: 5, z: 3.5 };
export const rob = { door: '', phase: '' as '' | 'fill' | 'bag', t: 0, dur: 7, cash: 0 };
const robbedAt: Record<string, number> = {};
export function resetRobberies() { for (const k of Object.keys(robbedAt)) delete robbedAt[k]; }
export const ROB_COOLDOWN = 480;
export const robCooldown = (door: string) => (robbedAt[door] === undefined ? 0 : Math.max(0, robbedAt[door] + ROB_COOLDOWN - game.clock));
export const robbable = () => !!INTERIORS[game.where]?.rob;
export const recentlyRobbed = (door: string) => robCooldown(door) > 0;
const local = () => { const I = INTERIORS[game.where]; return I ? { x: game.player.x - I.ox, z: game.player.z - I.oz } : { x: 1e9, z: 1e9 }; };

function updateRob(dt: number) {
  if (!rob.phase) return;
  if (!robbable() || game.lastDoor !== rob.door) {
    toast(rob.phase === 'bag' ? 'お金を置いて店を出てしまった' : '強盗失敗：店を出た', 2.4); rob.phase = ''; return;
  }
  if (rob.phase === 'fill') {
    const l = local();
    if (Math.hypot(l.x - BAG.x, l.z - BAG.z) > 4.5) { toast('強盗失敗：レジから離れた', 2.4); rob.phase = ''; robbedAt[rob.door] = game.clock; return; }
    rob.t += dt; if (rob.t >= rob.dur) { rob.phase = 'bag'; sfx('buy'); toast('袋にお金が詰められた。拾え！', 2.2); }
  }
}

/* =====================================================================
   Armored cash truck
   ===================================================================== */
export const armored = { v: null as Veh | null, state: '' as '' | 'drive' | 'alert' | 'stopped' | 'looted', dmg: 0, pry: 0, nextT: 70, cash: 0, hitT: 0 };
export const ARMOR_STOP = 30, PRY_TIME = 3.5;
function spawnArmored(px: number, pz: number) {
  const pi = nodeIdx(px), pj = nodeIdx(pz);
  for (let k = 0; k < 30; k++) {
    const i = clamp(pi + Math.round((Math.random() - 0.5) * 6), 0, N), j = clamp(pj + Math.round((Math.random() - 0.5) * 6), 0, N);
    const x = roadC(i), z = roadC(j), d = Math.hypot(x - px, z - pz);
    if (d < 130 || d > 260 || !nodeOpen(i, j) || vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 10)) continue;
    const v = spawn('armored', x, z, (Math.floor(Math.random() * 4) * Math.PI) / 2, '#3e4650');
    v.role = 'armored'; v.touched = true; v.ai = newAI(x, z); armored.v = v; armored.state = 'drive'; armored.dmg = 0; armored.pry = 0; armored.cash = 2500 + Math.round(Math.random() * 35) * 100;
    toast('現金輸送車が近くを走っている！体当たりして止めろ（マップの $）', 3.6); return;
  }
}
function updateArmored(dt: number) {
  const A = armored, p = ppos();
  if (A.v && !vehicles.includes(A.v)) { A.v = null; A.state = ''; }
  if (!A.v) {
    A.nextT -= dt;
    const inCity = Math.abs(p.x) < HALF && Math.abs(p.z) < HALF;
    if (A.nextT <= 0 && game.where === 'out' && game.wanted === 0 && inCity && !trial.id) { spawnArmored(p.x, p.z); A.nextT = 150 + Math.random() * 90; }
    return;
  }
  const v = A.v, d = Math.hypot(v.x - p.x, v.z - p.z); A.hitT -= dt;
  if (d > 430 || (A.state === 'drive' && v.ai!.t > 300) || (A.state === 'looted' && d > 160)) { remove(v); A.v = null; A.state = ''; return; }
  if ((A.state === 'drive' || A.state === 'alert') && A.dmg >= ARMOR_STOP) { A.state = 'stopped'; toast('輸送車が止まった！後ろのドアをこじ開けろ', 3); }
  if (A.state === 'drive') v.ai!.ctl = steer(v, null, dt, { speed: 12, lane: 3.3 });
  else if (A.state === 'alert') v.ai!.ctl = steer(v, null, dt, { speed: 22, lane: 3.3 });
  else v.ai!.ctl = { thr: 0, brake: Math.hypot(v.vx, v.vz) > 0.6 ? 1 : 0, steer: 0, hb: false };
  if (A.pry > 0) {
    if (!nearArmoredRear() || playerCar()) { A.pry = 0; toast('こじ開けを中断した', 1.6); }
    else { A.pry += dt; if (A.pry >= PRY_TIME) { A.pry = 0; A.state = 'looted'; game.money += A.cash; sfx('buy'); toast('現金を奪った！ +$' + A.cash.toLocaleString('en-US'), 3); setWanted(3, '現金輸送車を強奪'); save(); } }
  }
}
export function nearArmoredRear(): boolean {
  const v = armored.v; if (!v || game.where !== 'out' || game.inCar) return false;
  const p = game.player, dx = p.x - v.x, dz = p.z - v.z, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lf = dx * fx + dz * fz, ls = dx * fz - dz * fx;
  return lf < -v.def.len / 2 + 0.4 && lf > -v.def.len / 2 - 2.6 && Math.abs(ls) < 1.8;
}

/* =====================================================================
   Vehicle export: steal the requested model and drop it at the docks
   ===================================================================== */
export const EXPORT_PAY: Partial<Record<VKind, number>> = { sedan: 1500, suv: 2200, truck: 2000, bike: 2800, sport: 5500, super: 12000 };
const EXPORT_POOL: VKind[] = ['sedan', 'sedan', 'suv', 'suv', 'truck', 'bike', 'sport', 'sport', 'super'];
export const exportJob = { kind: 'sport' as VKind | null, cool: 0, reroll: 0 };
export function newExport() { let k: VKind; do k = EXPORT_POOL[Math.floor(Math.random() * EXPORT_POOL.length)]; while (k === exportJob.kind); exportJob.kind = k; }
export const exportValue = (v: Veh) => Math.round((EXPORT_PAY[v.def.kind] || 0) * (0.35 + 0.65 * clamp(v.hp / v.def.hp, 0, 1)) / 10) * 10;
export const atDock = (v: Veh) => Math.hypot(v.x - EXPORT_DOCK.x, v.z - EXPORT_DOCK.z) < 10;

/* =====================================================================
   Time trials
   ===================================================================== */
export const trial = { id: '', i: 0, t: 0 };
export const trialDef = (): Trial | undefined => TRIALS.find((q) => q.id === trial.id);
function updateTrial(dt: number) {
  const T = trialDef(); if (!T) return;
  const me = playerCar();
  if (!me || me.dead || game.wanted > 0) { trial.id = ''; game.waypoint = null; toast('タイムトライアル失敗', 2.2); return; }
  trial.t += dt;
  const cp = T.cps[trial.i];
  if (Math.hypot(me.x - cp.x, me.z - cp.z) < 11) {
    trial.i++; sfx('ui');
    if (trial.i >= T.cps.length) {
      const t = trial.t, best = progress.trialBest[T.id], beat = t <= T.par;
      let msg = `${T.name} ゴール ${fmt(t)}（目標 ${fmt(T.par)}）`;
      if (beat) { const first = !(best !== undefined && best <= T.par), pay = first ? T.reward : Math.round(T.reward * 0.25); game.money += pay; msg += `　目標クリア +$${pay.toLocaleString('en-US')}`; sfx('buy'); }
      else msg += '　目標タイムに届かず';
      if (best === undefined || t < best) progress.trialBest[T.id] = t;
      trial.id = ''; game.waypoint = null; toast(msg, 4); save(); return;
    }
    game.waypoint = { ...T.cps[trial.i] };
  }
}
export const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/* =====================================================================
   Interaction prompts and actions (called by the player controller)
   ===================================================================== */
export type Near = { kind: 'job'; id: string; label: string; btn: string };
export function jobNear(): Near | null {
  if (law.over) return null;
  { const s = storyNear(); if (s) return s; }
  const me = playerCar();
  if (robbable() && !me) {
    const l = local();
    if (rob.phase === 'bag' && rob.door === game.lastDoor && Math.hypot(l.x - BAG.x, l.z - BAG.z) < 2.4) return { kind: 'job', id: 'bag', label: 'お金を拾う（$' + rob.cash.toLocaleString('en-US') + '）', btn: '拾う' };
    if (!rob.phase && Math.hypot(l.x - ROB_SPOT.x, l.z - ROB_SPOT.z) < 1.9) {
      const cd = robCooldown(game.lastDoor);
      // with a gun in your hand the till is a hold-up; otherwise you are a customer
      if (game.arms.cur !== 'fist') return cd > 0 ? { kind: 'job', id: 'robcd', label: `レジは空っぽ（あと${Math.ceil(cd / 60)}分）`, btn: '強盗' } : { kind: 'job', id: 'rob', label: 'レジを強盗する', btn: '強盗' };
      return cd > 0 ? { kind: 'job', id: 'shopclosed', label: '店員が怯えていて買い物できない（強盗の直後）', btn: '買う' } : { kind: 'job', id: 'shop:konbini', label: 'レジで買い物する（銃を構えると強盗）', btn: '買う' };
    }
    return null;
  }
  { const I = INTERIORS[game.where]; if (I && I.acts && !me) { const l = local(); for (const a of I.acts) if (Math.hypot(l.x - a.x, l.z - a.z) < (a.r ?? 1.5)) return { kind: 'job', id: a.id, label: a.id === 'ramen:eat' ? (meal.ticket ? `席に座って「${meal.ticket.name}」を食べる` : '先に入口の券売機で食券を買おう') : a.label, btn: a.btn }; } }
  { const I = INTERIORS[game.where]; if (I && I.home && !me) {
    const l = local(), owned = game.where === 'home' || game.homes.includes(game.where), P = PROPERTIES.find((q) => q.id === game.where);
    if (owned && I.bed && Math.hypot(l.x - I.bed.x, l.z - I.bed.z) < 2.4) return { kind: 'job', id: 'sleep', label: '寝る（時間を進めて体力回復・セーブ）', btn: '寝る' };
    if (!owned && P && I.buy && Math.hypot(l.x - I.buy.x, l.z - I.buy.z) < 2.2) return { kind: 'job', id: 'buyhome:' + P.id, label: `この物件を買う $${P.price.toLocaleString('en-US')}${game.money < P.price ? '（資金不足）' : ''}`, btn: '購入' };
  } }
  { const I = INTERIORS[game.where]; if (I && I.roofSpot && I.roof && !me) { const l = local(); if (Math.hypot(l.x - I.roofSpot.x, l.z - I.roofSpot.z) < 1.6) return { kind: 'job', id: 'roofup', label: I.roofLabel || `エレベーターで屋上へ（${Math.round(I.roof.y)}m）`, btn: I.roofLabel ? '移動' : '屋上' }; } }
  { const I = INTERIORS[game.where]; if (I && I.links && !me) { const l = local(); for (const k of I.links) if (Math.hypot(l.x - k.x, l.z - k.z) < 1.5) return { kind: 'job', id: 'link:' + k.to, label: k.label, btn: '移動' }; } }
  if (game.where === 'out' && !me && roofTrip.on) { const p = game.player; if (Math.hypot(p.x - roofTrip.x, p.z - roofTrip.z) < 2.6 && Math.abs(p.y - roofTrip.y) < 2) return { kind: 'job', id: 'roofdown', label: roofTrip.from.startsWith('ship_') ? 'エレベーターで船内（アトリウム）へ' : 'エレベーターで1階へ', btn: '下へ' }; }
  if (game.where === 'clothes' && !me) { const l = local(); if (Math.hypot(l.x - 6.4, l.z - 2.6) < 1.6) return { kind: 'job', id: 'style', label: '試着室で着替える・ブティック', btn: '着替え' }; }
  if (game.where === 'arms' && !me) { const l = local(); return Math.hypot(l.x, l.z + 1.1) < 2.2 ? { kind: 'job', id: 'gunshop', label: 'BAY ARMS で買い物', btn: '買う' } : null; }
  if (game.where !== 'out') return null;
  if (!me) {
    if (armored.v && (armored.state === 'stopped') && nearArmoredRear()) return { kind: 'job', id: 'pry', label: armored.pry > 0 ? 'こじ開け中…' : '後部ドアをこじ開ける', btn: 'こじ開け' };
    { const e = eventNear(); if (e) return e; }
    return japanNear();
  }
  // in a car
  if (me.def.kind === 'shinkansen') return shinNear(me);
  { const pk = parkNear(me); if (pk) return pk; }
  if (me.def.kind === 'yacht' && !me.dead && Math.hypot(me.vx, me.vz) < 1.5) return { kind: 'job', id: 'cabin', label: 'メインサロン（キャビン）に入る', btn: 'キャビン' };
  if (atDock(me) && Math.hypot(me.vx, me.vz) < 4) {
    if (me.owned >= 0 || me.role) return { kind: 'job', id: 'exportno', label: 'この車は輸出できない', btn: '輸出' };
    if (exportJob.kind && me.def.kind === exportJob.kind) return { kind: 'job', id: 'export', label: `${me.def.name}を引き渡す（$${exportValue(me).toLocaleString('en-US')}）`, btn: '引き渡す' };
    return { kind: 'job', id: 'exportno', label: exportJob.kind ? `依頼の車は ${VDEFS[exportJob.kind].name}` : '次の依頼を準備中', btn: '輸出' };
  }
  if (me.def.kind !== 'heli' && Math.hypot(me.x - CUSTOMS.spawn.x, me.z - CUSTOMS.spawn.z) < 8 && Math.hypot(me.vx, me.vz) < 4) return { kind: 'job', id: 'customs', label: 'BAY CUSTOMS で改造する', btn: '改造' };
  if (!race.id && !trial.id && game.wanted === 0 && me.def.kind !== 'heli' && Math.hypot(me.vx, me.vz) < 7) for (const R of RACES) if (Math.hypot(me.x - R.x, me.z - R.z) < 8) return { kind: 'job', id: 'race:' + R.id, label: `${R.name}に出る（1位 $${PRIZES[0].toLocaleString('en-US')}）`, btn: 'レース' };
  if (!race.id && !trial.id && game.wanted === 0 && Math.hypot(me.vx, me.vz) < 7) for (const T of TRIALS) if (Math.hypot(me.x - T.start.x, me.z - T.start.z) < 8) return { kind: 'job', id: 'trial:' + T.id, label: `${T.name} を開始（目標 ${fmt(T.par)}）`, btn: '開始' };
  return null;
}

export function jobAction(id: string) {
  const me = playerCar();
  if (id === 'rob' && game.arms.cur === 'fist') { toast(game.arms.owned.pistol || game.arms.owned.smg ? '銃を構えろ（武器ボタンで切替）' : '強盗には銃が必要（BAY ARMSで購入）', 2.2); return; }
  if (id === 'rob') {
    rob.door = game.lastDoor; rob.phase = 'fill'; rob.t = 0; rob.dur = 6; rob.cash = (game.where === 'gas' ? 600 : 800) + Math.round(Math.random() * 14) * 100;
    sfx('crash', 0.25); toast('「金を出せ！」 店員がレジを開けた', 2.2); setWanted(1, '店員が通報した');
  } else if (id.startsWith('link:')) {
    const to = INTERIORS[id.slice(5)], from = game.where, p = game.player;
    if (to) { const back = to.links?.find((k) => k.to === from); game.where = to.id; p.x = to.ox + (back ? back.x : to.spawn.x); p.z = to.oz + (back ? back.z + (back.z > 0 ? -1.4 : 1.4) : to.spawn.z); p.y = -50; p.vy = 0; game.fadeT = 0.6; sfx('door'); toast(to.name, 1.6); }
  } else if (id === 'cabin' && me && me.def.kind === 'yacht') {
    const C = INTERIORS.yacht, p = game.player;
    me.vx = me.vz = 0; game.yachtId = me.id; game.inCar = 0; releaseDrive(); game.where = 'yacht';
    game.outsidePos = { x: me.x + Math.cos(me.yaw) * 4, z: me.z - Math.sin(me.yaw) * 4, yaw: me.yaw };
    p.x = C.ox + C.spawn.x; p.z = C.oz + C.spawn.z; p.y = -50; p.vy = 0; game.fadeT = 0.6; sfx('door'); toast(C.name + '（出口で操舵席に戻る）', 2);
  } else if (id.startsWith('shop:')) { game.ui = id; sfx('ui');
  } else if (id === 'ramen:eat') { eatMeal();
  } else if (id === 'home:view') { viewMode.on = !viewMode.on; viewMode.t0 = performance.now(); sfx('ui'); toast(viewMode.on ? '🔭 街を眺めている（もう一度押すと戻る）' : 'いつもの視点に戻った', viewMode.on ? 2.4 : 1.4);
  } else if (id === 'coin:park') { const me2 = playerCar(); if (me2) parkAction(me2);
  } else if (id.startsWith('ev:')) { eventAction(id);
  } else if (id.startsWith('shut:')) { toast(`シャッターが下りている。営業時間は ${hoursText(id.slice(5))}`, 2.2); sfx('ui');
  } else if (id === 'shopclosed') { toast('強盗の直後で店員が怯えている。時間をおこう', 2);
  } else if (id.startsWith('jp:') || id.startsWith('nara:')) { japanAction(id);
  } else if (id === 'style') { game.openStyle = true;
  } else if (id === 'story') { startMission();
  } else if (id === 'roofup') {
    const I = INTERIORS[game.where], p = game.player;
    if (I && I.roof) { roofTrip.on = true; roofTrip.from = game.where; roofTrip.x = I.roof.x; roofTrip.z = I.roof.z; roofTrip.y = I.roof.y; game.where = 'out'; p.x = I.roof.x; p.z = I.roof.z; p.y = I.roof.y + 0.05; p.vy = 0; game.fadeT = 0.8; sfx('door'); toast(`屋上に出た（高さ ${Math.round(I.roof.y)}m）`, 2.2); }
  } else if (id === 'roofdown') {
    const o = game.outsidePos, p = game.player, I = INTERIORS[roofTrip.from]; roofTrip.on = false;
    if (I && roofTrip.from.startsWith('ship_') && I.roofSpot) { game.where = I.id; p.x = I.ox + I.roofSpot.x - 1.6; p.z = I.oz + I.roofSpot.z; p.y = -50; p.vy = 0; game.fadeT = 0.8; sfx('door'); toast(I.name, 1.4); return; }
    p.x = o.x; p.z = o.z; p.y = groundAt(o.x, o.z); p.vy = 0; p.yaw = o.yaw; game.cam.yaw = o.yaw + Math.PI; game.fadeT = 0.8; sfx('door');
  } else if (id.startsWith('buyhome:')) {
    const P = PROPERTIES.find((q) => 'buyhome:' + q.id === id);
    if (P && !game.homes.includes(P.id)) { if (game.money < P.price) toast('お金が足りない（$' + P.price.toLocaleString('en-US') + '）', 2); else { game.money -= P.price; game.homes.push(P.id); sfx('buy'); toast(`${P.kind}を購入！ ベッドで寝るとセーブ＆時間を進められる`, 3.2); save(); } }
  } else if (id === 'sleep') {
    game.fadeT = 2.2; game.hour = game.hour >= 6 && game.hour < 18 ? 20.5 : 8; game.health = 100; game.stamina = 100; game.weather.next = Math.min(game.weather.next, 5);
    sfx('ui'); setTimeout(() => toast(game.hour > 12 ? 'よく寝た。夜になった（セーブしました）' : 'おはよう。朝になった（セーブしました）', 2.4), 900); save();
  } else if (id.startsWith('race:')) { startRace(id.slice(5)); } else if (id === 'gunshop') { game.ui = 'arms'; sfx('ui'); } else if (id === 'customs') { game.ui = 'customs'; sfx('ui'); } else if (id === 'robcd') toast('このレジはさっき強盗された。時間をおこう', 2);
  else if (id === 'bag') { game.money += rob.cash; robbedAt[rob.door] = game.clock; sfx('buy'); toast('+$' + rob.cash.toLocaleString('en-US') + '　店を出て警察から逃げろ！', 2.8); rob.phase = ''; setWanted(2, '強盗成功'); save(); }
  else if (id === 'pry') { if (armored.pry <= 0) { armored.pry = 0.001; toast('ドアをこじ開けている…離れるな', 1.8); } }
  else if (id === 'export' && me) {
    const pay = exportValue(me); game.money += pay; exportJob.kind = null; exportJob.cool = 60;
    game.inCar = 0; releaseDrive(); const p = game.player; p.x = EXPORT_DOCK.x - 6; p.z = EXPORT_DOCK.z; p.y = groundAt(p.x, p.z); p.yaw = -Math.PI / 2;
    remove(me); sfx('buy'); toast(`輸出完了！ +$${pay.toLocaleString('en-US')}（次の依頼は約1分後）`, 3.2); save();
  } else if (id === 'exportno') toast(exportJob.kind ? `今の依頼は ${VDEFS[exportJob.kind].name}（盗んだ車のみ）` : '次の依頼を準備中', 2);
  else if (id.startsWith('trial:')) { const T = TRIALS.find((q) => 'trial:' + q.id === id)!; trial.id = T.id; trial.i = 0; trial.t = 0; game.waypoint = { ...T.cps[0] }; toast(`${T.name} スタート！ 目標 ${fmt(T.par)}`, 2.2); sfx('ui'); }
}

/** Taking a police car is a crime. */
export function onEnterCar(v: Veh) { if (v.role === 'police') { v.ai = null; setWanted(2, 'パトカーを盗んだ'); } }

/* =====================================================================
   Per-frame update (called from the vehicle loop before physics)
   ===================================================================== */
// installed once every module has loaded (the vehicle module may still be initialising when this one runs: import cycle)
queueMicrotask(() => {
hooks.carHit = (a, b, imp) => {
  const me = a.id === game.inCar ? a : b.id === game.inCar ? b : null; if (!me) return;
  const o = me === a ? b : a;
  if (o.role === 'traffic' && imp > 3) panic(o);
  if (o.role === 'police' && imp > 4 && game.wanted === 0 && law.hitT <= 0) { law.hitT = 3; setWanted(1, 'パトカーに衝突'); }
  if (o.role === 'armored' && o === armored.v && imp > 2.5 && (armored.state === 'drive' || armored.state === 'alert')) {
    if (armored.hitT <= 0) { armored.dmg += Math.min(imp, 20); armored.hitT = 0.4; }
    if (armored.state === 'drive') { armored.state = 'alert'; setWanted(1, '現金輸送車を襲撃'); }
  }
};
hooks.hurtPlayer = (dmg) => damagePlayer(dmg);
});

export function updateCrime(dt: number) {
  updateGifts(dt);
  if (!game.started) return;
  if (admin.is && admin.noWanted && game.wanted) { game.wanted = 0; law.bust = 0; }
  if (law.over) { law.over.t -= dt; siren(0); if (law.over.t <= 0) { const o = law.over; law.over = null; respawn(o.kind, o.fine); } return; }
  if (game.health <= 0) { over('wasted'); return; }
  law.hurtT += dt; if (law.hurtT > 6 && game.health < 100) game.health = Math.min(100, game.health + dt * 4);
  updatePolice(dt); updateRob(dt); updateArmored(dt); updateTrial(dt); updateStunts(dt); updateTaxi(dt); updateRace(dt); updateStory(dt);
  if (!exportJob.kind) { exportJob.cool -= dt; if (exportJob.cool <= 0) { newExport(); toast(`輸出の新しい依頼：${VDEFS[exportJob.kind!].name}（スマホの「仕事」）`, 2.6); } }
  exportJob.reroll = Math.max(0, exportJob.reroll - dt);
}

/** One-line status for the HUD mission card. */
export function jobStatus(): { title: string; text: string; prog?: number } | null {
  { const s = storyStatus(); if (s) return s; }
  { const R = raceDef(); if (R) return { title: R.name, text: race.done ? (race.place ? `${race.place}位でゴール` : 'レース終了') : race.count > 0 ? 'スタート待ち…' : `${position()}位 / 4　CP ${race.i}/${R.trial.cps.length}　${fmtT(race.t)}`, prog: race.done ? undefined : race.i / R.trial.cps.length }; }
  if (taxi.on) return { title: 'タクシー', text: taxi.phase === 'pick' ? '待っている客を迎えに行け（目的地マーク）' : `目的地へ急げ ${Math.floor(taxi.t)}秒 / 目標 ${Math.round(taxi.par)}秒（停車で到着）`, prog: taxi.phase === 'ride' ? Math.min(1, taxi.t / taxi.par) : undefined };
  if (stunt.ramp) return { title: 'スタントジャンプ', text: '着地を決めろ！' };
  if (rob.phase === 'fill') return { title: 'コンビニ強盗', text: '店員がレジの金を袋に詰めている…レジから離れるな', prog: rob.t / rob.dur };
  if (rob.phase === 'bag') return { title: 'コンビニ強盗', text: `カウンターの袋を拾え（$${rob.cash.toLocaleString('en-US')}）` };
  const T = trialDef(); if (T) return { title: T.name, text: `${fmt(trial.t)} / 目標 ${fmt(T.par)}　CP ${trial.i}/${T.cps.length}` };
  if (armored.pry > 0) return { title: '現金輸送車強盗', text: 'ドアをこじ開け中…', prog: armored.pry / PRY_TIME };
  if (game.wanted > 0) return { title: '手配中 ' + '★'.repeat(game.wanted), text: law.seen ? '警察に追われている！視界から消えろ' : '捜索範囲（地図の円）の外へ逃げて隠れろ' };
  if (armored.v && armored.state === 'stopped') return { title: '現金輸送車強盗', text: '止まった！車を降りて後ろのドアをこじ開けろ' };
  if (armored.v && (armored.state === 'drive' || armored.state === 'alert')) return { title: '現金輸送車', text: armored.state === 'alert' ? '体当たりを続けて止めろ' : '近くを走行中（地図の $）。車でぶつけて止めろ', prog: armored.dmg / ARMOR_STOP };
  const me = playerCar(); if (me && exportJob.kind && me.def.kind === exportJob.kind && me.owned < 0 && !me.role) return { title: '車の輸出', text: `この${me.def.name}を港の輸出ドックへ（約$${exportValue(me).toLocaleString('en-US')}）` };
  return null;
}
