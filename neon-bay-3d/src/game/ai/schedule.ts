import { game } from '../state/store';
import { blocks, N, HALF, PITCH } from '../world/cityGen';
import { clamp } from '../world/rng';

/**
 * The city's daily rhythm: how many people and cars are out depends on the hour, the district and the weather.
 * Rush hours fill the pavements with commuters, the shopping streets are busiest in the evening, housing
 * estates sleep at night, and rain keeps people indoors.
 */
const lerpCurve = (C: [number, number][], h: number) => {
  for (let k = 1; k < C.length; k++) if (h <= C[k][0]) { const [h0, v0] = C[k - 1], [h1, v1] = C[k]; return v0 + ((v1 - v0) * (h - h0)) / Math.max(1e-6, h1 - h0); }
  return C[C.length - 1][1];
};
const PEOPLE: [number, number][] = [[0, 0.32], [2, 0.2], [5, 0.2], [6.5, 0.6], [7.8, 1.25], [9.2, 1.0], [11.5, 1.15], [13.5, 0.95], [17, 1.3], [19.5, 1.1], [22, 0.7], [24, 0.32]];
const CARS: [number, number][] = [[0, 0.45], [4.5, 0.38], [6.5, 0.9], [8, 1.2], [10, 1.0], [16.5, 1.05], [18, 1.2], [20.5, 0.95], [23, 0.6], [24, 0.45]];
/** Zone of the block the player is in or next to. */
function zoneHere() {
  const p = game.where === 'out' ? game.player : game.outsidePos;
  if (Math.abs(p.x) > HALF || Math.abs(p.z) > HALF) return '';
  const i = clamp(Math.floor((p.x + HALF) / PITCH), 0, N - 1), j = clamp(Math.floor((p.z + HALF) / PITCH), 0, N - 1);
  return blocks[j * N + i]?.zone ?? '';
}
/** Multiplier on the pedestrian cap right now. */
export function pedFactor(): number {
  const h = game.hour, z = zoneHere(), night = h >= 21.5 || h < 5.5, evening = h >= 18 && h < 24;
  let k = lerpCurve(PEOPLE, h);
  if (z === 'residential' && night) k *= 0.55; // estates sleep
  if ((z === 'commercial' || z === 'canal') && evening) k *= 1.35; // the shopping and bar streets come alive
  if (z === 'downtown' && night) k *= 0.7; // offices are empty
  if ((z === 'park' || z === 'industrial') && night) k *= 0.5;
  return k * (1 - 0.35 * game.weather.rain);
}
/** Multiplier on the traffic cap right now. */
export const trafficFactor = () => lerpCurve(CARS, game.hour);
/** Share of new walkers who are commuters in office clothes. */
export function commuterShare(): number {
  const h = game.hour, z = zoneHere(), rush = (h >= 7 && h < 9.5) || (h >= 17 && h < 20), work = h >= 9.5 && h < 17;
  const k = rush ? 0.6 : work ? 0.3 : 0.08;
  return z === 'downtown' ? k : z === 'commercial' || z === 'station' ? k * 0.7 : k * 0.35;
}
/** Which doors people go into at this hour: offices in the morning, homes and shops in the evening, shops through the day. */
export function wantsDoor(kind: string): number {
  const h = game.hour;
  if (kind === 'shop') return h >= 6 && h < 23.5 ? 1 : 0.25;
  if (kind === 'office' || kind === 'lobby') return h >= 7 && h < 10.5 ? 1.2 : h >= 10.5 && h < 18 ? 0.4 : 0.05;
  if (kind === 'apartment' || kind === 'house') return h >= 17 || h < 1 ? 1 : 0.2;
  return 0;
}
/** ...and which doors they come out of. */
export function leavesDoor(kind: string): number {
  const h = game.hour;
  if (kind === 'shop') return h >= 6.5 && h < 24 ? 1 : 0.2;
  if (kind === 'office' || kind === 'lobby') return h >= 17 && h < 21 ? 1.2 : h >= 11.5 && h < 13.5 ? 0.8 : 0.15;
  if (kind === 'apartment' || kind === 'house') return h >= 6 && h < 9.5 ? 1.2 : h >= 9.5 && h < 20 ? 0.35 : 0.08;
  return 0;
}
