import * as THREE from 'three';
import type { VDef } from './defs';
import type { Parts } from './shaped';
import { Prof, makeShape, lowerBody, greenhouse, endPatch, sidePatch, windowPatch, topPatch, roofPatch, screenSpan, fuse, patch } from './body';

/**
 * The details of a low mid-engined exotic (the supercar and the hypercar): slim lamps along the tops of the front
 * wings, a wide mouth with a splitter, a channel in the doors feeding an intake ahead of the rear wheels, flying
 * buttresses beside an engine window, round tail lamps in a black panel, a finned diffuser and four exhausts.
 * An original design: it is not a copy of any real car.
 */
type G = THREE.BufferGeometry;
const keep = <T extends G>(g: T) => { g.userData.keep = true; return g; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export function exoticParts(def: VDef, P: Prof): Parts {
  const S = makeShape(def, P), W = def.wid, hw = W / 2, hyper = def.kind === 'hyper';
  const both = (f: (s: 1 | -1) => G | G[]) => ([1, -1] as const).flatMap((s) => f(s));
  const xf = S.cab1 - 0.1, dl = 1.2, bx = xf - dl + 0.02, gh = greenhouse(S, bx, true);
  const paint: G[] = [lowerBody(S), gh.paint], far: G[] = [lowerBody(S, true), gh.paint], trim: G[] = [gh.black], chrome: G[] = [], seams: G[] = [], well: G[] = [];
  const zt = (x: number) => S.zs(x, S.yts(x)) - S.rt; // half width of the top surface
  const tipY = P.nose ?? 0.36, ty = P.tailY ?? 0.66;
  // ---- lamps: a slim blade along each front wing, two round lamps each side at the back ----
  // a dark teardrop housing let into the wing, with a bright blade along its outer edge
  const lampAt = (s: 1 | -1, u: number, w: number, off: number) => { const x = S.x1 - 0.17 - 0.56 * u, f = 0.56 + 0.17 * u + (0.33 - 0.2 * u) * w, z = s * f * zt(x); return [x, S.topY(x, z) + off, z]; };
  trim.push(...both((s) => patch(7, 3, (u, v) => lampAt(s, u, v, 0.006))));
  const head = fuse(both((s) => patch(7, 1, (u, v) => lampAt(s, 0.04 + u * 0.9, 0.52 + 0.36 * v, 0.011))));
  const disc = (zc: number, r: number, off = 0.012) => patch(12, 2, (u, v) => { const a = u * Math.PI * 2, rr = r * (0.02 + 0.98 * v), y = ty + rr * Math.sin(a), z = zc + rr * Math.cos(a); return [S.tailX(y, z) - off, y, z]; });
  const tail = fuse(both((s) => [disc(s * hw * 0.37, 0.078), disc(s * hw * 0.6, 0.078)]));
  const blink = (s: 1 | -1) => fuse([endPatch(S, 1, tipY + 0.015, tipY + 0.05, s * hw * 0.66, s * hw * 0.9, 0.009, 4, 1), endPatch(S, -1, ty - 0.06, ty + 0.06, s * hw * 0.695, s * hw * 0.73, 0.012, 1, 2)]);
  const rev = fuse([endPatch(S, -1, ty - 0.13, ty - 0.1, -hw * 0.12, hw * 0.12, 0.013, 3, 1)]);
  // ---- black: the mouth and its splitter, the sills, the side intakes, the tail panel, the diffuser ----
  trim.push(endPatch(S, 1, S.yb0 + 0.045, tipY - 0.05, -hw * 0.3, hw * 0.3, 0.006, 5, 2), ...both((s) => endPatch(S, 1, S.yb0 + 0.045, tipY - 0.025, s * hw * 0.38, s * hw * 0.86, 0.006, 5, 2)));
  trim.push(box(0.13, 0.02, W * 0.8, S.x1 - 0.07, S.yb0 + 0.012, 0));
  trim.push(...both((s) => sidePatch(S, s, -S.wx + S.R + 0.03, S.wx - S.R - 0.03, S.yb0 + 0.004, S.yb0 + 0.085, 0.006, 8, 1)));
  if (P.scoop) { const c = P.scoop, h = c.y1 - c.y0; trim.push(...both((s) => patch(4, 4, (u, v) => { const y = c.y0 + h * (0.2 + 0.62 * v), x = c.x0 + 0.02 + (0.2 + 0.22 * v) * u; return [x, y, s * (S.zs(x, y) + 0.007)]; }))); } // the intake at the end of the channel in the door
  trim.push(endPatch(S, -1, ty - 0.14, ty + 0.13, -hw * 0.74, hw * 0.74, 0.006, 10, 3)); // tail panel
  trim.push(endPatch(S, -1, S.ybc(S.x0 + 0.05) + 0.02, ty - 0.165, -hw * 0.72, hw * 0.72, 0.006, 8, 2)); // the lower half of the tail: diffuser and exhausts
  for (const z of [-0.5, -0.25, 0, 0.25, 0.5]) trim.push(box(0.3, 0.07, 0.014, S.x0 + 0.17, S.ybc(S.x0 + 0.17) - 0.025, z * hw));
  trim.push(topPatch(S, S.cab1 - 0.03, S.cab1 + 0.06, -zt(S.cab1) * 0.85, zt(S.cab1) * 0.85, 0.006, 1, 6)); // scuttle
  // outlets in the bonnet, and slatted vents in the deck either side of the engine window
  trim.push(...both((s) => patch(4, 1, (u, v) => { const x = S.cab1 + 0.36 + 0.4 * u + 0.1 * v, z = s * zt(S.cab1 + 0.5) * (0.17 + 0.2 * v); return [x, S.topY(x, z) + 0.014, z]; })));
  for (let i = 0; i < 3; i++) trim.push(...both((s) => patch(1, 3, (u, v) => { const x = S.x0 + 0.42 + i * 0.11 + 0.05 * u, z = s * zt(x) * (0.62 + 0.3 * v); return [x, S.topY(x, z) + 0.006, z]; })));
  // the engine under its window: dark slats across the deck
  for (let i = 0; i < 5; i++) { const x = S.cab0 - 0.28 - i * 0.17; if (x < S.g0 + 0.25) break; trim.push(box(0.07, 0.035, S.gz(x, S.beltG) * 1.5, x, S.ytc(x) + 0.03, 0)); }
  if (hyper) trim.push(box(0.36, 0.035, W * 0.94, S.x0 + 0.22, S.yts(S.x0 + 0.3) + 0.26, 0), box(0.2, 0.26, 0.03, S.x0 + 0.3, S.yts(S.x0 + 0.3) + 0.13, hw * 0.55), box(0.2, 0.26, 0.03, S.x0 + 0.3, S.yts(S.x0 + 0.3) + 0.13, -hw * 0.55));
  // ---- mirrors on stalks, four exhausts ----
  for (const s of [1, -1] as const) { const x = S.cab1 - 0.38, y = S.yts(x) + 0.1, z0 = S.gz(x, y) + 0.02; paint.push(new THREE.SphereGeometry(1, 8, 6).scale(0.045, 0.045, 0.095).translate(x, y + 0.01, s * (z0 + 0.2))); trim.push(box(0.035, 0.02, 0.2, x + 0.01, y - 0.02, s * (z0 + 0.1))); }
  for (const z of [-0.33, -0.19, 0.19, 0.33]) chrome.push(new THREE.CylinderGeometry(0.047, 0.047, 0.12, 12).rotateZ(Math.PI / 2).translate(S.tailX(ty - 0.26, z * hw) + 0.0, ty - 0.26, z * hw));
  // ---- wheel-arch liners ----
  for (const c of [S.wx, -S.wx]) for (const s of [1, -1]) { const zc = s * (S.zs(c, S.cy) - 0.16); well.push(new THREE.CylinderGeometry(S.R - 0.006, S.R - 0.006, 0.3, 14, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(c, S.cy, zc), new THREE.CircleGeometry(S.R - 0.006, 14, 0, Math.PI).translate(c, S.cy, zc - s * 0.148)); }
  // ---- shut lines ----
  const seam = (s: 1 | -1, x: number) => sidePatch(S, s, x - 0.006, x + 0.006, S.yb0 + 0.1, S.yts(x) - 0.03, 0.004, 1, 4);
  for (const s of [1, -1] as const) seams.push(seam(s, xf), seam(s, xf - dl));
  for (const s of [1, -1]) seams.push(patch(6, 1, (u, v) => { const x = S.cab1 + 0.12 + (S.x1 - 0.95 - S.cab1) * u, z = s * zt(x) * (0.5 + 0.012 * v); return [x, S.topY(x, z) + 0.004, z]; }));
  // ---- the driver's door: its skin follows the rising belt ----
  const zh = S.zs(xf, 0.45), mv = (g: G) => g.translate(-xf, 0, -zh);
  const panel = patch(7, 4, (u, v) => { const x = xf - dl + dl * u, y = S.yb0 + 0.1 + (S.yts(x) - 0.03 - S.yb0 - 0.1) * v; return [x, y, S.zs(x, y) + 0.012]; });
  const door = { x: xf, z: zh, panel: keep(mv(panel)), win: keep(mv(windowPatch(S, 1, xf - dl + 0.07, xf - 0.03, S.beltG + 0.012, S.roofY - 0.08, 0.01, 6, 3))), handle: keep(mv(box(0.12, 0.02, 0.02, xf - dl * 0.8, S.yts(xf - dl * 0.8) - 0.09, S.zs(xf - dl * 0.8, S.yts(xf - dl * 0.8) - 0.09) + 0.016))) };
  // ---- number plates ----
  const pf = S.yb0 + 0.14, pr = ty - 0.0;
  const plateF = keep(new THREE.PlaneGeometry(0.33, 0.165).rotateY(Math.PI / 2).translate(S.noseX(pf, 0) + 0.025, pf, 0)), plateR = keep(new THREE.PlaneGeometry(0.33, 0.165).rotateY(-Math.PI / 2).translate(S.tailX(pr, 0) - 0.03, pr, 0));
  // ---- damage ----
  const sc = screenSpan(S);
  const soot = keep(fuse([endPatch(S, 1, S.yb0 + 0.05, tipY + 0.02, -hw * 0.88, hw * 0.88, 0.014, 10, 3), topPatch(S, S.x1 - 1.0, S.x1 - 0.1, -hw * 0.5, hw * 0.5, 0.014, 5, 4)]));
  const crack = keep(roofPatch(S, sc.top + 0.03, sc.base - 0.04, -0.94, 0.94, 0.012, 5, 6, true));
  return { S, paint: keep(fuse(paint)), paintFar: keep(fuse(far)), glass: keep(gh.glass), trim: keep(fuse(trim)), chrome: keep(fuse(chrome)), head: keep(head), tail: keep(tail), blinkL: keep(blink(-1)), blinkR: keep(blink(1)), rev: keep(rev), seams: keep(fuse(seams)), well: keep(fuse(well)), plateF, plateR, door, soot, crack, hy: tipY, ty };
}
