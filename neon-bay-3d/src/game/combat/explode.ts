import { game } from '../state/store';
import { vehicles } from '../vehicles/sim';
import { peds, hitPed, scare } from '../ai/peds';
import { damagePlayer, copSees, setWanted } from '../crime/crime';
import { floorAt, pointBlocked } from '../world/cityGen';
import { sfx, sfxAt } from '../audio';
import { flash } from './fx';

/** Fireballs (visual), live grenades, and the blast itself: damage, knockback, chain reactions. */
export const booms: { x: number; y: number; z: number; t: number; s: number }[] = [];
export const grenades: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; spin: number }[] = [];

export function explode(x: number, y: number, z: number, power = 1, byPlayer = false) {
  booms.push({ x, y, z, t: 1.4, s: power }); if (booms.length > 12) booms.shift();
  flash(x, y + 0.5, z, 9 * power); sfxAt('boom', x, z, Math.min(1, power) * 1.15, 420);
  const R = 8.5 * power, pl = game.player, me = vehicles.find((v) => v.id === game.inCar);
  const px = me ? me.x : pl.x, pz = me ? me.z : pl.z, dp = Math.hypot(px - x, pz - z);
  game.shake = Math.max(game.shake, Math.max(0, 1.6 - dp / 45));
  for (const p of peds) {
    const d = Math.hypot(p.x - x, p.z - z); if (d > R || p.state === 'dead') continue;
    const k = 1 - d / R, nx = (p.x - x) / (d || 1), nz = (p.z - z) / (d || 1);
    hitPed(p, 160 * k, nx * 12 * k, nz * 12 * k, byPlayer);
  }
  for (const v of vehicles) {
    const d = Math.hypot(v.x - x, v.z - z); if (d > R || Math.abs(v.y - y) > R) continue;
    const k = 1 - d / R, nx = (v.x - x) / (d || 1), nz = (v.z - z) / (d || 1);
    v.hp -= 110 * k * power; v.touched = true;
    if (v.hp <= 0 && !v.dead) { v.hp = 0; v.dead = true; v.burn = 0.6 + Math.random() * 1.2; } // chain reaction
    if (v.def.kind !== 'heli') { v.vx += nx * 11 * k; v.vz += nz * 11 * k; v.air = true; v.airT = 0; v.vy = Math.max(v.vy, 7 * k); v.yr += (Math.random() - 0.5) * 3 * k; }
  }
  if (game.where === 'out' && dp < R) { const k = 1 - dp / R; damagePlayer((me ? 45 : 120) * k * power); if (!me) game.blast = { x: (px - x) / (dp || 1) * 9 * k, z: (pz - z) / (dp || 1) * 9 * k }; }
  scare(x, z, 90);
  if (byPlayer && copSees(x, z, 90)) setWanted(Math.max(3, game.wanted), '爆発を目撃された');
}

export function throwGrenade(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) {
  const L = Math.hypot(dx, dz) || 1;
  grenades.push({ x: ox, y: oy, z: oz, vx: (dx / L) * 15, vy: 5 + dy * 10, vz: (dz / L) * 15, t: 2.2, spin: 0 });
  if (grenades.length > 10) grenades.shift();
  sfx('door', 0.4);
}

export function tickExplosives(dt: number) {
  for (let i = booms.length - 1; i >= 0; i--) if ((booms[i].t -= dt) <= 0) booms.splice(i, 1);
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i]; g.t -= dt; g.vy -= 9.81 * dt; g.spin += dt * 10;
    const ox = g.x, oz = g.z; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    if (pointBlocked(g.x, g.y, g.z)) { g.x = ox; g.z = oz; g.vx *= -0.4; g.vz *= -0.4; }
    const f = floorAt(g.x, g.z, g.y + 0.3); if (g.y < f + 0.06) { g.y = f + 0.06; if (g.vy < 0) g.vy *= -0.35; g.vx *= 0.65; g.vz *= 0.65; }
    if (g.t <= 0) { grenades.splice(i, 1); explode(g.x, g.y, g.z, 1, true); }
  }
}
