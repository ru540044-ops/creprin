import { game, toast, save } from '../state/store';
import { vehicles, spawn, remove, playerCar, Veh, Drive } from '../vehicles/sim';
import { VKind, VDEFS } from '../vehicles/defs';
import { TRIALS, Trial } from '../world/cityGen';
import { newAI, steer } from '../ai/driver';
import { sfx } from '../audio';

/** Street races: three AI rivals on the time-trial routes, rolling countdown, live positions, prize money. */
export const RACES = TRIALS.map((T) => {
  const bx = -Math.sin(T.start.yaw), bz = -Math.cos(T.start.yaw);
  return { id: T.id, name: T.name.replace('・', ' ') + ' レース', trial: T, x: T.start.x + bx * 34, z: T.start.z + bz * 34, yaw: T.start.yaw };
});
export const PRIZES = [8000, 3000, 1000, 0];
export const race = { id: '', count: 0, i: 0, t: 0, finished: [] as number[], racers: [] as Veh[], done: false, endT: 0, place: 0 };
export const raceDef = () => RACES.find((r) => r.id === race.id);

const RIVALS: { kind: VKind; color: string; skill: number }[] = [{ kind: 'super', color: '#9dff3a', skill: 0.97 }, { kind: 'sport', color: '#2be4ff', skill: 0.95 }, { kind: 'muscle', color: '#ff8a00', skill: 0.92 }];

export function startRace(id: string) {
  const R = RACES.find((q) => q.id === id), me = playerCar(); if (!R || !me) return;
  race.id = id; race.count = 3.5; race.i = 0; race.t = 0; race.finished = []; race.done = false; race.place = 0;
  const fx = Math.sin(R.yaw), fz = Math.cos(R.yaw), lx = Math.cos(R.yaw), lz = -Math.sin(R.yaw);
  me.x = R.x; me.z = R.z; me.yaw = R.yaw; me.vx = me.vz = 0; me.air = false;
  for (const v of [...vehicles]) if (v !== me && v.role === 'traffic' && Math.hypot(v.x - R.x, v.z - R.z) < 40) remove(v);
  race.racers = RIVALS.map((r, k) => {
    const row = Math.floor((k + 1) / 2), side = (k + 1) % 2 ? 1 : -1;
    const v = spawn(r.kind, R.x + lx * side * 3.4 - fx * row * 7, R.z + lz * side * 3.4 - fz * row * 7, R.yaw, r.color);
    v.role = 'racer' as Veh['role']; v.touched = true; v.ai = newAI(v.x, v.z, { mode: 'race', cp: 0, skill: r.skill, fin: false }); v.mods.nitro = true;
    return v;
  });
  game.waypoint = { ...R.trial.cps[0] }; sfx('ui');
}
function endRace(msg: string) { toast(msg, 3.6); race.done = true; race.endT = 8; game.waypoint = null; }
export function cancelRace(msg: string) { if (!race.id) return; for (const v of race.racers) if (vehicles.includes(v)) remove(v); race.racers = []; race.id = ''; race.done = false; game.waypoint = null; toast(msg, 2); }

/** Corner-aware racing line: brake for turns between checkpoints, full speed on straights. */
function aiCtl(v: Veh, T: Trial, dt: number, lead: number): Drive {
  const ai = v.ai!, cp = T.cps[Math.min(ai.cp, T.cps.length - 1)], nx = T.cps[ai.cp + 1], prev = ai.cp ? T.cps[ai.cp - 1] : T.start;
  let turn = false;
  if (nx) { const a1 = Math.atan2(cp.x - prev.x, cp.z - prev.z), a2 = Math.atan2(nx.x - cp.x, nx.z - cp.z); let d = Math.abs(a2 - a1) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d; turn = d > 0.6; }
  const dist = Math.hypot(cp.x - v.x, cp.z - v.z), rubber = lead > 1 ? 1.08 : lead < -1 ? 0.94 : 1;
  const want = (turn ? Math.min(60, 11 + Math.max(0, dist - 8) * 0.55) : 60) * ai.skill * rubber;
  const c = steer(v, cp, dt, { speed: want, ram: true });
  c.nitro = !turn && dist > 80 && lead > 0;
  return c;
}

export function updateRace(dt: number) {
  const R = raceDef(); if (!R) return;
  const T = R.trial, me = playerCar();
  if (race.done) { race.endT -= dt; for (const v of race.racers) if (v.ai) v.ai.ctl = { thr: 0, brake: 1, steer: 0, hb: false }; if (race.endT <= 0) cancelRace('レース会場を片付けた'); return; }
  if (!me || me.dead) { cancelRace('レース失格（車を降りた／壊れた）'); return; }
  if (race.count > 0) {
    const before = Math.ceil(race.count - 0.5); race.count -= dt; const after = Math.ceil(race.count - 0.5);
    if (after !== before) sfx(after > 0 ? 'ui' : 'buy');
    for (const v of race.racers) if (v.ai) v.ai.ctl = { thr: 0, brake: 1, steer: 0, hb: false };
    me.vx *= 0.8; me.vz *= 0.8; return;
  }
  race.t += dt;
  // player checkpoints
  const cp = T.cps[race.i];
  if (cp && Math.hypot(me.x - cp.x, me.z - cp.z) < 12) {
    race.i++; sfx('ui');
    if (race.i >= T.cps.length) {
      race.place = race.finished.length + 1; const pay = PRIZES[race.place - 1] || 0; game.money += pay; save();
      endRace(race.place === 1 ? `🏆 優勝！ ${fmtT(race.t)} +$${pay.toLocaleString('en-US')}` : `${race.place}位でゴール ${fmtT(race.t)}${pay ? ' +$' + pay.toLocaleString('en-US') : ''}`);
      return;
    }
    game.waypoint = { ...T.cps[race.i] };
  }
  // rivals
  for (const v of race.racers) {
    if (!v.ai || !vehicles.includes(v)) continue;
    if (v.ai.fin || v.dead) { v.ai.ctl = { thr: 0, brake: 1, steer: 0, hb: false }; continue; }
    const c2 = T.cps[v.ai.cp];
    if (Math.hypot(v.x - c2.x, v.z - c2.z) < 12) { v.ai.cp++; if (v.ai.cp >= T.cps.length) { v.ai.fin = true; race.finished.push(v.id); if (race.finished.length === RIVALS.length) { race.place = 4; endRace('4位… 全員に負けた'); return; } continue; } }
    v.ai.ctl = aiCtl(v, T, dt, race.i - v.ai.cp);
  }
}
export const fmtT = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
/** Current position: 1 + rivals ahead (more checkpoints, or same checkpoint and closer to it). */
export function position(): number {
  const R = raceDef(), me = playerCar(); if (!R || !me) return 0;
  const T = R.trial, cp = T.cps[Math.min(race.i, T.cps.length - 1)], md = Math.hypot(me.x - cp.x, me.z - cp.z);
  let pos = 1;
  for (const v of race.racers) { if (!v.ai) continue; if (v.ai.fin || v.ai.cp > race.i) pos++; else if (v.ai.cp === race.i) { const c = T.cps[Math.min(v.ai.cp, T.cps.length - 1)]; if (Math.hypot(v.x - c.x, v.z - c.z) < md) pos++; } }
  return pos;
}
export { VDEFS };
