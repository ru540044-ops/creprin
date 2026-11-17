import { game, toast, save, progress } from '../state/store';
import { playerCar, vehicles, spawn, remove, Veh } from '../vehicles/sim';
import { RAMPS, Ramp, roadC, N, blocks } from '../world/cityGen';
import { peds, ejectPed, Ped } from '../ai/peds';
import { timeFx } from '../admin';
import { sfx } from '../audio';
import { clamp } from '../world/rng';

/* =============================== stunt jumps =============================== */
/** Launch off a stunt ramp: slow motion in the air, cash on landing (triple the first time). */
export const stunt = { ramp: null as Ramp | null, x0: 0, z0: 0, best: 0 };
const rampTop = (r: Ramp) => ({ x: r.x + Math.sin(r.yaw) * r.len, z: r.z + Math.cos(r.yaw) * r.len });
export function updateStunts(dt: number) {
  const me = playerCar();
  if (!me || me.def.kind === 'heli' || me.dead) { stunt.ramp = null; timeFx.slow = 1; return; }
  if (me.air && !stunt.ramp && me.airT < 0.25 && Math.hypot(me.vx, me.vz) > 10) {
    const r = RAMPS.find((q) => { const t = rampTop(q); return Math.hypot(me.x - t.x, me.z - t.z) < q.w + 5; });
    if (r) { stunt.ramp = r; stunt.x0 = me.x; stunt.z0 = me.z; toast('スタントジャンプ！', 1); }
  }
  if (stunt.ramp) {
    timeFx.slow += (0.4 - timeFx.slow) * Math.min(1, dt * 6);
    if (!me.air) {
      const r = stunt.ramp, dist = Math.round(Math.hypot(me.x - stunt.x0, me.z - stunt.z0)), ok = me.airT > 0.7 && !me.dead;
      stunt.ramp = null; timeFx.slow = 1;
      if (ok) {
        const first = !progress.stunts[r.id], pay = Math.round((300 + dist * 14) * (first ? 3 : 1) / 10) * 10;
        progress.stunts[r.id] = Math.max(progress.stunts[r.id] || 0, dist);
        game.money += pay; sfx('buy');
        toast(`${r.name} 成功！ ${dist}m・滞空${me.airT.toFixed(1)}秒 +$${pay.toLocaleString('en-US')}${first ? '（初成功ボーナス×3）' : ''}`, 3.4); save();
      }
    }
  } else timeFx.slow += (1 - timeFx.slow) * Math.min(1, dt * 4);
}

/* =============================== taxi job =============================== */
/** Drive a taxi: pick up a waiting fare, take them to their destination, get paid (tips for speed). */
export const taxi = { on: false, phase: '' as '' | 'pick' | 'ride', ped: null as Ped | null, px: 0, pz: 0, dx: 0, dz: 0, t: 0, par: 0, dist: 0, fares: 0 };
const curbPoint = (minD: number, maxD: number, x: number, z: number) => {
  for (let k = 0; k < 40; k++) {
    const B = blocks[Math.floor(Math.random() * blocks.length)], side = Math.floor(Math.random() * 4), t = 0.2 + Math.random() * 0.6;
    const px = side === 0 ? B.x0 + 1.2 : side === 1 ? B.x1 - 1.2 : B.x0 + (B.x1 - B.x0) * t, pz = side === 2 ? B.z0 + 1.2 : side === 3 ? B.z1 - 1.2 : B.z0 + (B.z1 - B.z0) * t;
    const d = Math.hypot(px - x, pz - z); if (d >= minD && d <= maxD) return { x: px, z: pz };
  }
  return { x: roadC(Math.floor(Math.random() * N)), z: roadC(Math.floor(Math.random() * N)) };
};
export function startTaxi() { const me = playerCar(); if (!me || me.def.kind !== 'taxi') return; taxi.on = true; taxi.fares = 0; nextFare(me); sfx('ui'); }
export function stopTaxi(msg = 'タクシー業務を終了') { if (!taxi.on) return; taxi.on = false; taxi.phase = ''; if (taxi.ped && peds.includes(taxi.ped)) { taxi.ped.state = 'walk'; } taxi.ped = null; game.waypoint = null; toast(msg, 1.8); }
function nextFare(me: Veh) {
  const p = curbPoint(60, 150, me.x, me.z), q = ejectPed(p.x, p.z, p.x, p.z);
  q.state = 'idle'; q.t = 9999; q.idleDur = 9999; q.idleV = 'look'; q.callT = 0; q.flail = false;
  taxi.ped = q; taxi.px = p.x; taxi.pz = p.z; taxi.phase = 'pick'; game.waypoint = { x: p.x, z: p.z };
  toast('客が待っている（目的地を設定）', 2);
}
export function updateTaxi(dt: number) {
  if (!taxi.on) return;
  const me = playerCar();
  if (!me || me.def.kind !== 'taxi' || me.dead) { stopTaxi(me && me.dead ? 'タクシーが壊れた' : 'タクシーを降りたので業務終了'); return; }
  const sp = Math.hypot(me.vx, me.vz);
  if (taxi.phase === 'pick') {
    const q = taxi.ped;
    if (!q || !peds.includes(q) || q.state === 'dead' || q.state === 'flee') { nextFare(me); return; }
    q.yaw = Math.atan2(me.x - q.x, me.z - q.z); if (Math.hypot(me.x - q.x, me.z - q.z) < 25) q.idleV = 'chat';
    if (Math.hypot(me.x - q.x, me.z - q.z) < 7 && sp < 2) {
      peds.splice(peds.indexOf(q), 1); taxi.ped = null; sfx('door');
      const d = curbPoint(350, 950, me.x, me.z); taxi.dx = d.x; taxi.dz = d.z; taxi.dist = Math.hypot(d.x - me.x, d.z - me.z); taxi.t = 0; taxi.par = taxi.dist / 11 + 15; taxi.phase = 'ride';
      game.waypoint = { x: d.x, z: d.z }; toast(`客が乗った。目的地まで ${Math.round(taxi.dist)}m・目標 ${Math.round(taxi.par)}秒`, 2.6);
    }
  } else if (taxi.phase === 'ride') {
    taxi.t += dt;
    if (Math.hypot(me.x - taxi.dx, me.z - taxi.dz) < 12 && sp < 3) {
      const fare = Math.round(40 + taxi.dist * 0.55), tip = taxi.t < taxi.par ? Math.round(fare * clamp((taxi.par - taxi.t) / taxi.par, 0.1, 0.6)) : 0;
      game.money += fare + tip; taxi.fares++; sfx('buy');
      const q = ejectPed(me.x + Math.cos(me.yaw) * 2.2, me.z - Math.sin(me.yaw) * 2.2, me.x, me.z); q.state = 'walk'; q.callT = 0; q.flail = false;
      toast(`運賃 +$${fare}${tip ? `・チップ +$${tip}` : ''}（今日 ${taxi.fares}人目）`, 2.6); save();
      nextFare(me);
    }
  }
}
/** Taxis also show up in traffic and at the airport rank. */
export const isTaxi = (v: Veh | null) => !!v && v.def.kind === 'taxi';
export { vehicles, spawn, remove };
