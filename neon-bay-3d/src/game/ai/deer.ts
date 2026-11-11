import { game, toast, save, progress } from '../state/store';
import { blocks, inNaraPark, pointBlocked, groundAt, SIG } from '../world/cityGen';
import { REGION } from '../world/region';
import { vehicles } from '../vehicles/sim';
import { sfx } from '../audio';

/**
 * Nara's deer: they wander the park, graze, lie down at night, run from fast cars, and come over to anyone holding
 * deer crackers (bought at the park stalls). Hand one over (button or pocket item) and the deer bows first, then eats.
 * They keep to the park (its blocks and the streets between them) and step round anything solid.
 */
export type DeerState = 'graze' | 'walk' | 'beg' | 'bow' | 'eat' | 'flee' | 'rest';
export interface Deer { id: number; x: number; z: number; y: number; yaw: number; s: number; buck: boolean; state: DeerState; t: number; tx: number; tz: number; head: number; phase: number; spd: number; /** this bow is for a cracker just given */ fed?: boolean }
export const deer: Deer[] = [];
/** The park's extent (deer stay inside it). */
export const DEER_AREA = { x0: 0, z0: 0, x1: 0, z1: 0, on: false };

let seed = 991;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
if (REGION.id === 'nara') {
  const park = blocks.filter((b) => b.zone === 'park' && inNaraPark(b.i, b.j));
  if (park.length) {
    const A = DEER_AREA; A.on = true; A.x0 = Math.min(...park.map((b) => b.x0)); A.x1 = Math.max(...park.map((b) => b.x1)); A.z0 = Math.min(...park.map((b) => b.z0)); A.z1 = Math.max(...park.map((b) => b.z1));
    // most of the herd hangs about where the visitors (and the cracker stalls) are: round the pagoda, the station end, the great hall's approach
    const busy = park.filter((b) => SIG.yatai.some((y) => y.senbei && Math.abs(y.x - (b.x0 + b.x1) / 2) < 160 && Math.abs(y.z - (b.z0 + b.z1) / 2) < 160));
    for (let n = 0; n < 110; n++) {
      const b = n % 3 && busy.length ? busy[Math.floor(rnd() * busy.length)] : park[Math.floor(rnd() * park.length)];
      for (let k = 0; k < 12; k++) {
        const x = b.x0 + 6 + rnd() * (b.x1 - b.x0 - 12), z = b.z0 + 6 + rnd() * (b.z1 - b.z0 - 12);
        if (pointBlocked(x, 0.6, z)) continue;
        deer.push({ id: n, x, z, y: groundAt(x, z), yaw: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.25, buck: rnd() < 0.3, state: 'graze', t: rnd() * 8, tx: x, tz: z, head: 1, phase: rnd() * 6, spd: 0 });
        break;
      }
    }
  }
}

const near = (d: Deer) => Math.hypot(d.x - game.player.x, d.z - game.player.z);
/** The deer closest to the player on foot within r metres. */
export function deerNear(r = 2.8): Deer | null {
  if (!deer.length || game.inCar || game.where !== 'out') return null;
  let best: Deer | null = null, bd = r;
  for (const d of deer) { const q = near(d); if (q < bd && d.state !== 'rest' && d.state !== 'flee') { bd = q; best = d; } }
  return best;
}
const holding = () => game.items.senbei > 0 && !game.inCar && game.where === 'out';

/** Give a cracker to the nearest deer (it bows, then eats). */
export function feedDeer() {
  const d = deerNear(3.2);
  if (!d) { toast(REGION.id === 'nara' ? '近くに鹿がいない（公園で鹿に近づこう）' : '鹿は奈良公園にいる', 1.8); sfx('ui'); return; }
  if (game.items.senbei <= 0) { toast('鹿せんべいを持っていない（公園の屋台で買える）', 1.8); return; }
  game.items.senbei--; d.state = 'bow'; d.t = 1.6; d.fed = true; face(d, game.player.x, game.player.z); sfx('buy', 0.4);
  progress.stats.flags.deer = 1;
  toast(`🦌 鹿がおじぎをして、せんべいを食べた（残り${game.items.senbei}枚）`, 2.2); save();
}
/** Bow to a deer without crackers: it bows back (and hopes for one). */
export function bowToDeer() {
  const d = deerNear(3.2); if (!d) return;
  d.state = 'bow'; d.t = 1.6; face(d, game.player.x, game.player.z); toast('🦌 鹿がおじぎを返した（せんべいがほしいらしい）', 1.8);
}
const face = (d: Deer, x: number, z: number) => { d.yaw = Math.atan2(x - d.x, z - d.z); };
function pickTarget(d: Deer) {
  const A = DEER_AREA;
  for (let k = 0; k < 6; k++) {
    const a = rnd() * Math.PI * 2, r = 8 + rnd() * 30, x = d.x + Math.sin(a) * r, z = d.z + Math.cos(a) * r;
    if (x < A.x0 + 3 || x > A.x1 - 3 || z < A.z0 + 3 || z > A.z1 - 3 || pointBlocked(x, 0.6, z)) continue;
    d.tx = x; d.tz = z; return true;
  }
  return false;
}
/** Move towards (tx, tz); false when the way is blocked. */
function step(d: Deer, tx: number, tz: number, v: number, dt: number) {
  const dx = tx - d.x, dz = tz - d.z, L = Math.hypot(dx, dz); if (L < 0.05) return true;
  const want = Math.atan2(dx, dz); let da = want - d.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); d.yaw += Math.max(-dt * 4, Math.min(dt * 4, da));
  const m = Math.min(L, v * dt), nx = d.x + Math.sin(d.yaw) * m, nz = d.z + Math.cos(d.yaw) * m, A = DEER_AREA;
  if (pointBlocked(nx, 0.6, nz) || nx < A.x0 || nx > A.x1 || nz < A.z0 || nz > A.z1) return false;
  d.x = nx; d.z = nz; d.spd = m / Math.max(dt, 1e-3); d.phase += m * 3.2; return true;
}
let acc = 0;
/** Per frame (only near the park). */
export function updateDeer(dt: number) {
  if (!deer.length || !game.started) return;
  const P = game.player, A = DEER_AREA;
  if (P.x < A.x0 - 400 || P.x > A.x1 + 400 || P.z < A.z0 - 400 || P.z > A.z1 + 400) return;
  acc += dt; const slow = acc > 0.25; if (slow) acc = 0;
  const h = game.hour, night = h > 21.5 || h < 5, hold = holding();
  let beggars = 0;
  for (const d of deer) {
    d.t -= dt; d.spd = 0;
    // fast cars nearby: run off
    if (slow && d.state !== 'flee') for (const v of vehicles) { const sp = Math.hypot(v.vx, v.vz); if (sp > 5 && Math.abs(v.x - d.x) < 10 && Math.abs(v.z - d.z) < 10) { d.state = 'flee'; d.t = 2.5; d.tx = d.x + (d.x - v.x) * 3; d.tz = d.z + (d.z - v.z) * 3; break; } }
    const dp = near(d);
    switch (d.state) {
      case 'flee': if (!step(d, d.tx, d.tz, 6.5, dt) || d.t <= 0) { d.state = 'graze'; d.t = 2 + rnd() * 3; } d.head = Math.max(0, d.head - dt * 4); break;
      case 'bow': { const k = 1.6 - d.t; d.head = -Math.max(0, Math.sin(Math.min(1, k / 1.0) * Math.PI)) * 1.0; if (d.t <= 0) { d.state = d.fed ? 'eat' : hold ? 'beg' : 'graze'; d.fed = false; d.t = d.state === 'beg' ? 4 + rnd() * 3 : 2.4; d.head = 0; } break; }
      case 'eat': d.head = 0.35 + Math.sin(d.t * 9) * 0.08; if (d.t <= 0) { d.state = 'graze'; d.t = 3 + rnd() * 5; } break;
      case 'beg':
        if (!hold || dp > 22) { d.state = 'graze'; d.t = 2; break; }
        beggars++; d.head = -0.15;
        if (dp > 1.9) step(d, P.x, P.z, 1.8, dt); else { face(d, P.x, P.z); if (d.t <= 0) { d.state = 'bow'; d.t = 1.6; } }
        break;
      case 'walk': d.head = Math.max(0, d.head - dt * 3); if (!step(d, d.tx, d.tz, 1.15, dt) || Math.hypot(d.tx - d.x, d.tz - d.z) < 0.4) { d.state = 'graze'; d.t = 4 + rnd() * 8; } break;
      case 'rest': d.head = 0.2; if (!night && d.t <= 0) { d.state = 'graze'; d.t = 2; } break;
      default: // graze
        d.head = Math.min(1, d.head + dt * 2);
        if (d.t <= 0) { if (night && rnd() < 0.7) { d.state = 'rest'; d.t = 20 + rnd() * 40; } else if (pickTarget(d)) d.state = 'walk'; d.t = 4 + rnd() * 6; }
    }
    // someone holding crackers draws the nearest few over
    if (hold && slow && dp < 18 && beggars < 4 && (d.state === 'graze' || d.state === 'walk')) { d.state = 'beg'; d.t = 2.5 + rnd() * 2; beggars++; }
    if (d.state === 'beg' && d.t <= 0 && dp <= 1.9) { d.state = 'bow'; d.t = 1.6; }
    d.y = groundAt(d.x, d.z);
  }
}
/** Where the stalls selling crackers are (for the map / tests). */
export const senbeiStalls = () => SIG.yatai.filter((y) => y.senbei);
