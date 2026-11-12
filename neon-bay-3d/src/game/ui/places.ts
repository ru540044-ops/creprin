import { game, toast, save } from '../state/store';
import { SIG, RAIL, STATION, SHIN, NARA_ST, doors, groundAt, floorAt, pointBlocked, isWater } from '../world/cityGen';
import { BDOORS, shopKey } from '../world/bldgInteriors';
import { REGION } from '../world/region';
import { sfx } from '../audio';
import { blocker } from './TravelApp';

/**
 * Places worth finding on the map, by kind: deer-cracker stalls, street-food stalls, shrines and temples, stations,
 * ramen shops, convenience stores. Each has where its marker goes and where you stand when you get there
 * (in front of the counter / the door / the prayer spot / the gate). "Skip" takes you straight there.
 */
export type PlaceCat = 'senbei' | 'yatai' | 'shrine' | 'station' | 'ramen' | 'konbini';
export const CATS: { id: PlaceCat; icon: string; name: string; color: string }[] = [
  { id: 'senbei', icon: '🍘', name: '鹿せんべい', color: '#c98a3a' },
  { id: 'yatai', icon: '🏮', name: '屋台', color: '#e2432a' },
  { id: 'shrine', icon: '⛩️', name: '神社・寺', color: '#b8322a' },
  { id: 'station', icon: '🚃', name: '駅・電車', color: '#2b6bff' },
  { id: 'ramen', icon: '🍜', name: 'ラーメン', color: '#ff8a2a' },
  { id: 'konbini', icon: '🏪', name: 'コンビニ', color: '#2bb37a' },
];
export interface Place { cat: PlaceCat; name: string; icon: string; x: number; z: number; tx: number; tz: number }

let cache: Place[] | null = null;
export function places(): Place[] {
  if (cache) return cache;
  const out: Place[] = [], add = (cat: PlaceCat, name: string, x: number, z: number, tx: number, tz: number, icon?: string) => out.push({ cat, name, icon: icon ?? CATS.find((c) => c.id === cat)!.icon, x, z, tx, tz });
  for (const y of SIG.yatai) { const fx = Math.sin(y.a), fz = Math.cos(y.a); add(y.senbei ? 'senbei' : 'yatai', y.senbei ? '鹿せんべいの屋台' : y.food + 'の屋台', y.x, y.z, y.x + fx * 2.2, y.z + fz * 2.2); }
  for (const s of SIG.shrines) add('shrine', s.name, s.x, s.z, s.x, s.z + (s.big ? 10.5 : 6), /寺|堂|殿/.test(s.name) ? '🛕' : '⛩️');
  RAIL.stations.forEach((_, i) => { const g = SIG.gates.find((q) => q.st === i); if (g) add('station', `${g.name}（${RAIL.name}）`, g.x, g.z, g.x - 2.2, g.z); });
  if (NARA_ST.on) add('station', `${REGION.station} やまと線のりば（大阪行き）`, (NARA_ST.px0 + NARA_ST.px1) / 2, NARA_ST.gateZ, (NARA_ST.px0 + NARA_ST.px1) / 2, NARA_ST.z1 + 3);
  else if (STATION) add('station', REGION.id === 'osaka' ? `${STATION.label}（やまと線 奈良行きもここ）` : STATION.label, STATION.x, STATION.z, STATION.x - 2, STATION.z);
  if (SHIN.has) add('station', '新幹線のりば', SHIN.gate.x, SHIN.gate.z, SHIN.gate.x - 2, SHIN.gate.z, '🚄');
  for (const d of BDOORS) {
    if (d.kind !== 'shop') continue; const k = shopKey(d); if (k !== 'ramen' && k !== 'konbini') continue;
    add(k, d.label, d.x, d.z, d.x + Math.sin(d.ang) * 1.2, d.z + Math.cos(d.ang) * 1.2);
  }
  for (const d of doors) if (d.id.startsWith('store')) add('konbini', d.label, d.x, d.z, d.x + Math.sin(d.ang) * 1.6, d.z + Math.cos(d.ang) * 1.6);
  cache = out; return out;
}
/** The n nearest places of a kind to (x, z). */
export function nearest(cat: PlaceCat | 'all', x: number, z: number, n: number): (Place & { d: number })[] {
  return places().filter((p) => cat === 'all' || p.cat === cat).map((p) => ({ ...p, d: Math.hypot(p.x - x, p.z - z) })).sort((a, b) => a.d - b.d).slice(0, n);
}
/** Where you are standing (outside). */
export const here = () => (game.where !== 'out' ? game.outsidePos : game.player);
/** Why you cannot skip right now ('' = you can). */
export function cantSkip(): string { return blocker(); }
/** Go straight to a place: the clock moves on by the time the trip would take (about a bus ride), no charge. */
export function skipTo(p: Place): boolean {
  const why = cantSkip(); if (why) { toast(why, 2); sfx('ui'); return false; }
  const P = game.player, d = Math.hypot(p.tx - P.x, p.tz - P.z);
  if (d < 12) { toast('もう着いている', 1.4); return false; }
  let x = p.tx, z = p.tz; // never into a wall or the water: step back towards the marker's front if needed
  for (let k = 0; k < 8 && (pointBlocked(x, groundAt(x, z) + 1, z) || isWater(x, z)); k++) { x += (p.tx - p.x) * 0.25; z += (p.tz - p.z) * 0.25; }
  P.x = x; P.z = z; P.y = floorAt(x, z, groundAt(x, z) + 1) + 0.05; P.vy = 0; P.yaw = Math.atan2(p.x - x, p.z - z); game.cam.yaw = P.yaw + Math.PI;
  const mins = Math.max(1, Math.round(d / 8 / 60)); game.hour = (game.hour + mins / 60) % 24; game.fadeT = 1.2; game.waypoint = null;
  sfx('door'); toast(`⏭ ${p.name}へ（約${mins}分）`, 2.2); save();
  return true;
}
