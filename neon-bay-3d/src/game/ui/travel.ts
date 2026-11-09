import { game, toast, save } from '../state/store';
import { REGION, RegionId, setRegion, ARRIVE_KEY, TravelMode } from '../world/region';
import { sfx } from '../audio';

export const TRAVEL_KEY = 'neonbay3d.travelling';
/** Leave for another city: pay, move the clock on, save, remember how we arrive, and reload into the destination. */
export function travelTo(to: RegionId, mode: TravelMode, fare: number, hours: number, msg: string) {
  game.money -= fare; game.hour = (game.hour + hours) % 24; game.waypoint = null;
  sfx('buy'); toast(msg, 3);
  save();
  try { localStorage.setItem(ARRIVE_KEY, mode); localStorage.setItem(TRAVEL_KEY, JSON.stringify({ from: REGION.id, to, mode })); } catch { /* ignore */ }
  setRegion(to);
  setTimeout(() => location.reload(), 900);
}
