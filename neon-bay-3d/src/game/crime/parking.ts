import { game, toast, save } from '../state/store';
import { blockAt } from '../world/cityGen';
import { Veh, vehicles } from '../vehicles/sim';
import { sfx } from '../audio';

/**
 * Coin parking: stop in a bay of a pay lot and pay once; the car then stays there for as long as you like
 * (cars you simply leave in the street are cleared away once you are far off). Driving it out ends the stay.
 * Parked cars show on the map.
 */
export const PARK_FEE = 3;
/** Is (x, z) in one of the two rows of bays of a coin-parking lot? */
export function inCoinBay(x: number, z: number): boolean {
  const b = blockAt(x, z); if (!b || b.zone !== 'parking') return false;
  return x > b.x0 + 8 && x < b.x1 - 20 && ((z > b.z0 + 9 && z < b.z0 + 16.5) || (z > b.z1 - 16.5 && z < b.z1 - 9));
}
export function parkNear(me: Veh): { kind: 'job'; id: string; label: string; btn: string } | null {
  if (me.parked || Math.hypot(me.vx, me.vz) > 0.8 || !inCoinBay(me.x, me.z)) return null;
  if (me.def.kind === 'heli' || me.def.kind === 'jet') return null;
  return { kind: 'job', id: 'coin:park', label: 'コインパーキングに駐車する（$' + PARK_FEE + '・離れても車が残る）', btn: '駐車' };
}
export function parkAction(me: Veh) {
  if (game.wanted > 0) { toast('手配中は駐車している場合じゃない', 1.8); return; }
  if (game.money < PARK_FEE) { toast('お金が足りない', 1.6); sfx('ui'); return; }
  game.money -= PARK_FEE; me.parked = true; me.px = me.x; me.pz = me.z; me.vx = me.vz = 0; sfx('buy', 0.6);
  toast('🅿 駐車した（$' + PARK_FEE + '）。降りて離れてもこの車は残る。マップに表示', 3); save();
}
/** Per frame: a parked car that has been driven (or pushed) out of its bay is no longer parked. */
export function updateParking() {
  for (const v of vehicles) if (v.parked && Math.hypot(v.x - (v.px ?? v.x), v.z - (v.pz ?? v.z)) > 4) { v.parked = false; if (v.id === game.inCar) toast('🅿 出庫した', 1.6); }
}
export const parkedCars = () => vehicles.filter((v) => v.parked);
