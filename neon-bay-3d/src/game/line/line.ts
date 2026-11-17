import { game, toast } from '../state/store';
import { REGION, REGIONS, RegionId } from '../world/region';
import { travelTo } from '../ui/travel';
import { chime, sfx } from '../audio';
import { admin } from '../admin';
import { lineLegs, Leg, Zone } from './routes';

/**
 * A trip on the line between two cities, at the real distance. The cities stay separate page loads; between them the
 * train runs along a scenery strip generated from the route data (LineView), and the trip ends by loading the
 * destination (arriving at its station, or in the cab coming out of the tunnel when you drive a bullet train).
 *  - drive: you drive (power / brake, the automatic train control keeps you under the line speed); 'auto' drives for you.
 *  - seat: a passenger seat (a ticket from the travel app): the train drives itself.
 * Fast-forward jumps to just before the next station or the terminus; the clock moves on by the time the train would
 * have taken. While the train runs, the clock runs at real time.
 */
export interface Stop { name: string; s: number; leg: number }
export const line = {
  on: false, mode: 'seat' as 'drive' | 'seat', from: '' as RegionId | '', to: '' as RegionId | '',
  legs: [] as Leg[], off: [] as number[], L: 0, stops: [] as Stop[],
  /** distance run (m), speed (m/s), automatic driving, view (0 cab, 1 right window, 2 left window, 3 outside) */
  s: 0, v: 0, auto: true, view: 0, tunnel: 0, done: false,
  /** where you were standing (saved instead of the ride's position) */
  hold: { x: 0, z: 0, yaw: 0 },
  /** last announced stop, and the leg we are on */
  announced: -1, legNow: 0, ffT: 0,
};
/** Where the ride is drawn (far from every city: the world is hidden while you ride). */
export const ANCHOR = { x: 0, z: -40000 };
const A_SERVICE = 0.75, A_BRAKE = 1.2, A_ATC = 1.6; // m/s2 (the multiplier from the admin panel scales them for a train you drive)

export function canRide(from: RegionId, to: RegionId) { return !!lineLegs(from, to); }
/** Start the trip (drive: you are in the cab; seat: passenger). */
export function startLine(to: RegionId, mode: 'drive' | 'seat', v0 = 0) {
  const legs = lineLegs(REGION.id, to); if (!legs) return false;
  const L = line; L.on = true; L.mode = mode; L.from = REGION.id; L.to = to; L.legs = legs; L.off = []; L.stops = [];
  let o = 0; legs.forEach((g, i) => { L.off.push(o); for (const st of g.stations) { if (i > 0 && st.s === 0) continue; L.stops.push({ name: st.name, s: o + st.s, leg: i }); } o += g.len; });
  L.L = o; L.s = mode === 'drive' ? 1200 : 0; L.v = v0; L.auto = mode === 'seat'; L.view = 0; L.done = false; L.announced = 0; L.legNow = 0; L.tunnel = 0;
  L.hold = { x: game.player.x, z: game.player.z, yaw: game.player.yaw }; game.rideHold = L.hold;
  game.player.x = ANCHOR.x; game.player.z = ANCHOR.z; game.fadeT = 1.4; game.waypoint = null; game.near = null;
  chime('announce');
  toast(`🔔 ${legs[0].name} ${REGIONS[to].name}行き。${(o / 1000).toFixed(1)}km（実際の距離）${mode === 'drive' ? '。W／アクセルで加速、S／ブレーキ。「自動運転」で任せることもできる' : '。車窓をお楽しみください'}`, 4.5);
  return true;
}
export const legAt = (s: number) => { let i = 0; while (i + 1 < line.legs.length && s >= line.off[i + 1]) i++; return i; };
export function zoneAt(s: number): Zone { const i = legAt(s), g = line.legs[i], q = s - line.off[i]; let z: Zone = g.zones[0].z; for (const p of g.zones) if (p.s <= q) z = p.z; else break; return z; }
export function tunnelAt(s: number) { const i = legAt(s), g = line.legs[i], q = s - line.off[i]; for (const t of g.tunnels) if (q >= t.a && q <= t.b) return t; return null; }
/** The next stop ahead (its index in line.stops). */
export const nextStop = () => { for (let i = 0; i < line.stops.length; i++) if (line.stops[i].s > line.s + 30) return i; return line.stops.length - 1; };
/** Speed limit here (m/s): the line speed, a braking curve onto a slower line ahead, and the approach to the terminus. */
export function limitAt(s: number) {
  const i = legAt(s), mul = line.mode === 'drive' && admin.is ? admin.trainSpeed : 1, a = A_SERVICE * mul;
  let lim = (line.legs[i].vmax * mul) / 3.6;
  for (let k = i + 1; k < line.legs.length; k++) { const v2 = (line.legs[k].vmax * mul) / 3.6, d = line.off[k] - s; if (v2 < lim) lim = Math.min(lim, Math.sqrt(v2 * v2 + 2 * a * Math.max(0, d))); }
  const vEnd = 120 / 3.6, dEnd = line.L - END_GAP - s; lim = Math.min(lim, Math.sqrt(vEnd * vEnd + 2 * a * Math.max(0, dEnd)));
  return lim;
}
/** The trip ends this far before the terminus: the rest is the arrival in the destination city. */
export const END_GAP = 1500;
/** Speed (m/s) for this frame from the controls (thr, brake 0..1); used by the cab and by the seat. */
export function stepLine(thr: number, brake: number, dt: number) {
  const L = line; if (!L.on || L.done) return;
  const mul = L.mode === 'drive' && admin.is ? admin.trainSpeed : 1, lim = limitAt(L.s);
  if (L.auto) { const want = lim - 1.2; if (L.v < want - 0.5) { thr = 1; brake = 0; } else if (L.v > want + 0.8) { thr = 0; brake = 0.6; } else { thr = 0; brake = 0; } }
  if (thr > 0.05) L.v += A_SERVICE * mul * thr * (1.3 - 0.8 * L.v / Math.max(1, lim)) * dt;
  if (brake > 0.05) L.v = Math.max(0, L.v - A_BRAKE * mul * brake * dt);
  L.v *= 1 - 0.002 * dt;
  if (L.v > lim + 0.4) L.v = Math.max(lim, L.v - A_ATC * mul * dt); // ATC brake
  L.s = Math.min(L.L, L.s + L.v * dt);
  if (!admin.freezeTime) game.hour = (game.hour + dt / 3600) % 24; // real time while riding
  const t = tunnelAt(L.s); L.tunnel += ((t ? 1 : 0) - L.tunnel) * Math.min(1, dt * 3);
  // announcements: entering a new leg, the next station
  const li = legAt(L.s); if (li !== L.legNow) { L.legNow = li; chime('announce'); toast(`🔁 ${L.legs[li].name}に乗り換え（${L.stops.find((q) => q.leg === li)?.name ?? ''}）`, 3); }
  const ni = nextStop(), st = L.stops[ni];
  if (st && ni !== L.announced && st.s - L.s < 6000) { L.announced = ni; chime('announce'); toast(ni === L.stops.length - 1 ? `🔔 まもなく終点 ${st.name} です` : `🔔 まもなく ${st.name}（通過します）`, 2.6); }
  if (L.s >= L.L - END_GAP) finishLine();
}
/** Jump ahead: to just before the next station, or to just before the terminus. The clock moves on by the time the run takes at line speed. */
export function fastForward(toEnd: boolean) {
  const L = line; if (!L.on || L.done) return;
  let ni = nextStop(); if (!toEnd && L.stops[ni].s - 2500 - L.s < 5000 && ni + 1 < L.stops.length) ni++; // the next station is just ahead: on to the one after
  const st = L.stops[ni], target = toEnd ? L.L - END_GAP - 4000 : Math.min(L.L - END_GAP - 4000, st.s - 2500);
  if (target <= L.s + 100) { toast('もうすぐ着きます', 1.4); return; }
  let hours = 0; for (let s = L.s; s < target; s += 1000) hours += Math.min(1000, target - s) / Math.max(15, limitAt(s) * 0.92) / 3600;
  game.hour = (game.hour + hours) % 24; L.s = target; L.v = Math.min(Math.max(L.v, L.legs[legAt(target)].vmax / 3.6 * 0.8), limitAt(target)); game.fadeT = 1; L.ffT = 1.2; sfx('ui');
  const mins = Math.round(hours * 60); toast(`⏩ ${mins >= 60 ? Math.floor(mins / 60) + '時間' : ''}${mins % 60}分ほど先へ（${(target / 1000).toFixed(0)}km地点）`, 2.2);
}
/** Remaining hours to the terminus at line speed (for the display). */
export function etaHours() { let h = 0; for (let s = line.s; s < line.L - END_GAP; s += 2000) h += Math.min(2000, line.L - END_GAP - s) / Math.max(15, limitAt(s) * 0.92) / 3600; return h; }
function finishLine() {
  const L = line; L.done = true; const to = L.to as RegionId;
  const driveIn = L.mode === 'drive' && !!REGIONS[to].shinkansen && L.legs[L.legs.length - 1].train === 'shin';
  game.player.x = L.hold.x; game.player.z = L.hold.z; game.rideHold = null; game.fadeT = 1.6;
  travelTo(to, driveIn ? 'drive' : 'train', 0, 0, `🚄 ${L.stops[L.stops.length - 1].name}に到着（${(L.L / 1000).toFixed(1)}km）`);
}
export const viewNames = ['運転台', '右の車窓', '左の車窓', '外から'];
