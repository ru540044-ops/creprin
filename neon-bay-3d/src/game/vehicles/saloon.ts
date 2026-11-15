import * as THREE from 'three';
import type { VDef } from './defs';
import type { Parts } from './shaped';
import { Prof, makeShape, lowerBody, greenhouse, endPatch, sidePatch, windowPatch, topPatch, roofPatch, screenSpan, fuse, patch } from './body';

/**
 * The details of an ordinary road car (saloon, hatchback, off-roader, pickup, coupé, limousine): lamp units that wrap
 * round the corners with a dark housing, a bright main lamp and an amber indicator; a grille with bright bars; bumper
 * intakes; sills; a strip under the windows; door shut lines and handles that follow the belt; mirrors; wipers; an
 * aerial; red tail-lamp units with a reversing lamp; exhausts; number plates.
 */
type G = THREE.BufferGeometry;
const keep = <T extends G>(g: T) => { g.userData.keep = true; return g; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export function saloonParts(def: VDef, P: Prof): Parts {
  const S = makeShape(def, P), W = def.wid, hw = W / 2, k = def.kind;
  const both = (f: (s: 1 | -1) => G | G[]) => ([1, -1] as const).flatMap((s) => f(s));
  const four = k === 'sedan' || k === 'taxi' || k === 'police' || k === 'suv' || k === 'limo' || k === 'hatch', upright = k === 'suv' || k === 'hatch', bright = k === 'sedan' || k === 'limo' || k === 'taxi' || k === 'muscle';
  const hy = P.nose ?? 0.68, ty = P.tailY ?? 0.78, belt = (x: number) => S.yts(x), yr = P.lower[0][1] + 0.04; // yr: the bottom of the tail
  // the front door starts just behind the front wheel arch
  const xf = Math.min(S.cab1 - 0.12, S.wx - S.R - 0.04), dl = four ? Math.min(1.05, (xf + S.wx - S.R) / 2 + 0.1) : 1.25, bx = xf - dl + 0.02, gh = greenhouse(S, bx);
  const paint: G[] = [lowerBody(S), gh.paint], far: G[] = [lowerBody(S, true), gh.paint], trim: G[] = [gh.black], chrome: G[] = [], seams: G[] = [], well: G[] = [];
  const zt = (x: number) => S.zs(x, S.yts(x)) - S.rt;
  // ---- front: lamp units, grille, bumper intake ----
  const lh = k === 'muscle' ? 0.05 : 0.06;
  trim.push(...both((s) => endPatch(S, 1, hy - lh - 0.012, hy + lh + 0.012, s * hw * 0.4, s * hw * 0.92, 0.006, 8, 2)));
  const head = fuse(both((s) => endPatch(S, 1, hy - lh + 0.012, hy + lh - 0.008, s * hw * 0.44, s * hw * 0.78, 0.011, 6, 2)));
  trim.push(endPatch(S, 1, hy - lh - 0.012, hy + lh + 0.012, -hw * 0.4, hw * 0.4, 0.006, 6, 2)); // grille
  for (const dy of [-lh + 0.02, 0, lh - 0.02]) chrome.push(endPatch(S, 1, hy + dy - 0.006, hy + dy + 0.006, -hw * 0.37, hw * 0.37, 0.012, 6, 1));
  trim.push(endPatch(S, 1, S.yb0 + 0.09, Math.min(hy - lh - 0.1, S.yb0 + 0.25), -hw * 0.62, hw * 0.62, 0.006, 8, 2)); // intake in the bumper
  trim.push(...both((s) => endPatch(S, 1, S.yb0 + 0.11, S.yb0 + 0.19, s * hw * 0.7, s * hw * 0.88, 0.006, 3, 1)));
  // ---- back: lamp units, a strip between them, the bumper's lower edge, exhausts ----
  const th = 0.065, tail: G[] = both((s) => (k === 'pickup' ? endPatch(S, -1, ty - 0.15, ty + 0.1, s * hw * 0.77, s * hw * 0.9, 0.008, 2, 4) : endPatch(S, -1, ty - th, ty + th, s * hw * (upright ? 0.62 : 0.42), s * hw * 0.9, 0.008, 7, 2)));
  if (k === 'muscle') tail.push(endPatch(S, -1, ty - 0.03, ty + 0.03, -hw * 0.42, hw * 0.42, 0.008, 6, 1));
  if (bright && k !== 'muscle') chrome.push(endPatch(S, -1, ty + th - 0.02, ty + th + 0.008, -hw * 0.42, hw * 0.42, 0.009, 6, 1));
  trim.push(endPatch(S, -1, yr + 0.03, yr + 0.15, -hw * 0.7, hw * 0.7, 0.006, 8, 2));
  for (const s of k === 'muscle' || k === 'limo' ? [-1, 1] : [1]) chrome.push(new THREE.CylinderGeometry(0.036, 0.036, 0.13, 10).rotateZ(Math.PI / 2).translate(S.tailX(yr + 0.06, s * hw * 0.5) + 0.03, yr + 0.0, s * hw * 0.5));
  const blink = (s: 1 | -1) => fuse([endPatch(S, 1, hy - lh + 0.012, hy - 0.012, s * hw * 0.8, s * hw * 0.89, 0.011, 3, 1), k === 'pickup' ? endPatch(S, -1, ty - 0.13, ty - 0.08, s * hw * 0.8, s * hw * 0.88, 0.012, 2, 1) : endPatch(S, -1, ty - th + 0.012, ty - 0.012, s * hw * 0.78, s * hw * 0.87, 0.012, 3, 1)]);
  const rev = fuse(both((s) => (k === 'pickup' ? endPatch(S, -1, ty - 0.07, ty - 0.03, s * hw * 0.8, s * hw * 0.88, 0.012, 2, 1) : endPatch(S, -1, ty - th + 0.012, ty - 0.008, s * hw * (upright ? 0.64 : 0.45), s * hw * (upright ? 0.72 : 0.56), 0.012, 3, 1))));
  // ---- sides: sills, the strip under the windows, handles, mirrors ----
  trim.push(...both((s) => sidePatch(S, s, -S.wx + S.R + 0.04, S.wx - S.R - 0.04, S.yb0 + 0.004, S.yb0 + 0.08, 0.006, 8, 1)));
  (bright ? chrome : trim).push(...both((s) => patch(10, 1, (u, v) => { const x = S.cab0 + 0.05 + (S.cab1 - 0.1 - S.cab0) * u, y = belt(x) - 0.034 + 0.026 * v; return [x, y, s * (S.zs(x, y) + 0.006)]; })));
  const handle = (s: 1 | -1, x: number) => { const y = belt(x) - 0.13; return box(0.14, 0.026, 0.03, x, y, s * (S.zs(x, y) + 0.016)); };
  chrome.push(handle(-1, xf - dl * 0.84)); if (four) chrome.push(...both((s) => handle(s, xf - dl - dl * 0.8)));
  for (const s of [1, -1] as const) { const x = S.cab1 - 0.32, y = belt(x) + 0.085, z0 = S.zs(x, belt(x)); paint.push(new THREE.SphereGeometry(1, 8, 6).scale(0.05, 0.055, 0.1).translate(x, y, s * (z0 + 0.12))); trim.push(box(0.05, 0.025, 0.13, x + 0.01, y - 0.04, s * (z0 + 0.04))); }
  // ---- wheel arches: liners, and black cladding on off-roaders ----
  for (const c of [S.wx, -S.wx]) for (const s of [1, -1]) {
    if (S.st.clad) trim.push(new THREE.TorusGeometry(S.R + 0.01, 0.04, 4, 12, Math.PI).translate(c, S.cy, s * (S.zs(c, S.cy + S.R * 0.8) + 0.004)));
    const zc = s * (S.zs(c, S.cy) - 0.16);
    well.push(new THREE.CylinderGeometry(S.R - 0.006, S.R - 0.006, 0.3, 14, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(c, S.cy, zc), new THREE.CircleGeometry(S.R - 0.006, 14, 0, Math.PI).translate(c, S.cy, zc - s * 0.148));
  }
  // ---- top: scuttle and wipers, aerial ----
  trim.push(topPatch(S, S.cab1 - 0.04, S.cab1 + 0.07, -zt(S.cab1) * 0.9, zt(S.cab1) * 0.9, 0.006, 1, 6));
  for (const z of [-0.34, 0.22]) trim.push(new THREE.BoxGeometry(0.02, 0.014, 0.52).rotateY(0.1).translate(S.cab1 - 0.03, S.gtop(S.cab1 - 0.05, z * hw) + 0.035, z * hw));
  if (k !== 'pickup' && k !== 'muscle') { const x = S.g0 + (upright ? 0.5 : 0.95); trim.push(new THREE.ConeGeometry(0.03, 0.07, 6).scale(2.4, 0.8, 0.6).translate(x, S.gtop(x, 0) + 0.025, 0)); }
  // ---- shut lines: doors, bonnet, boot ----
  const seam = (s: 1 | -1, x: number) => sidePatch(S, s, x - 0.006, x + 0.006, S.yb0 + 0.09, belt(x) - 0.04, 0.004, 1, 3);
  for (const s of [1, -1] as const) { seams.push(seam(s, xf), seam(s, xf - dl)); if (four) seams.push(seam(s, Math.max(S.cab0 + 0.25, xf - 2 * dl))); }
  for (const s of [1, -1]) seams.push(patch(6, 1, (u, v) => { const x = S.cab1 + 0.1 + (S.x1 - 0.45 - S.cab1) * u, z = s * zt(x) * (0.8 + 0.012 * v); return [x, S.topY(x, z) + 0.004, z]; }));
  if (S.cab0 - S.x0 > 0.5 && !upright) seams.push(topPatch(S, S.x0 + 0.3, S.x0 + 0.312, -zt(S.x0 + 0.3) * 0.85, zt(S.x0 + 0.3) * 0.85, 0.004, 1, 6));
  // ---- per model ----
  let white: G | undefined, dark: G | undefined;
  if (k === 'muscle') { const sc = screenSpan(S); white = fuse([-1, 1].flatMap((s) => [topPatch(S, S.cab1 + 0.1, S.x1 - 0.2, s * 0.09, s * 0.27, 0.007, 8, 1), roofPatch(S, S.cab0 + 0.1, sc.top - 0.05, s * 0.14, s * 0.4, 0.007, 6, 1), topPatch(S, S.x0 + 0.2, S.g0 - 0.02, s * 0.09, s * 0.27, 0.007, 4, 1)])); { const sc2 = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.34, 0.075, 0.19).translate(S.cab1 + 0.7, S.topY(S.cab1 + 0.7, 0) - 0.005, 0); paint.push(sc2); far.push(sc2.clone()); } }
  if (k === 'pickup') dark = fuse([topPatch(S, S.x0 + 0.16, S.g0 - 0.1, -zt(S.x0 + 0.5) * 0.9, zt(S.x0 + 0.5) * 0.9, 0.006, 6, 2)]);
  if (k === 'suv') for (const s of [1, -1]) trim.push(box(S.g1 - S.g0 - 1.5, 0.03, 0.04, (S.g0 + S.g1) / 2 - 0.25, S.roofY + 0.045, s * S.gz(0, S.roofY) * 0.8));
  if (k === 'police') { white = fuse(both((s) => patch(8, 2, (u, v) => { const x = xf - 2 * dl + 0.04 + (2 * dl - 0.08) * u, y = S.yb0 + 0.14 + (belt(x) - 0.05 - S.yb0 - 0.14) * v; return [x, y, s * (S.zs(x, y) + 0.014)]; }))); trim.push(box(0.05, 0.05, W * 0.62, S.x1 + 0.13, hy + 0.02, 0), box(0.05, 0.05, W * 0.62, S.x1 + 0.13, hy - 0.26, 0)); for (const z of [-W * 0.28, W * 0.28]) trim.push(box(0.05, 0.34, 0.05, S.x1 + 0.13, hy - 0.12, z), box(0.2, 0.05, 0.05, S.x1 + 0.03, hy - 0.22, z)); }
  // ---- the driver's door (right side) ----
  const zh = S.zs(xf, (S.yb0 + S.belt) / 2), mv = (g: G) => g.translate(-xf, 0, -zh);
  const panel = patch(6, 3, (u, v) => { const x = xf - dl + dl * u, y = S.yb0 + 0.09 + (belt(x) - 0.04 - S.yb0 - 0.09) * v; return [x, y, S.zs(x, y) + 0.012]; });
  const door = { x: xf, z: zh, panel: keep(mv(panel)), win: keep(mv(windowPatch(S, 1, xf - dl + 0.07, xf - 0.02, S.beltG + 0.012, S.roofY - 0.1, 0.01, 6, 3))), handle: keep(mv(handle(1, xf - dl * 0.84))) };
  // ---- number plates ----
  const pf = Math.min(hy - lh - 0.14, S.yb0 + 0.34), pr = upright || k === 'pickup' ? yr + 0.3 : ty - 0.01;
  const plateF = keep(new THREE.PlaneGeometry(0.33, 0.165).rotateY(Math.PI / 2).translate(S.noseX(pf, 0) + 0.02, pf, 0)), plateR = keep(new THREE.PlaneGeometry(0.33, 0.165).rotateY(-Math.PI / 2).translate(S.tailX(pr, 0) - 0.02, pr, 0));
  trim.push(box(0.02, 0.185, 0.35, S.noseX(pf, 0) + 0.008, pf, 0), box(0.02, 0.185, 0.35, S.tailX(pr, 0) - 0.008, pr, 0));
  // ---- damage: soot over the nose, a cracked windscreen ----
  const sc = screenSpan(S);
  const soot = keep(fuse([endPatch(S, 1, S.yb0 + 0.05, hy + lh + 0.03, -hw * 0.9, hw * 0.9, 0.014, 10, 4), topPatch(S, S.x1 - 1.0, S.x1 - 0.1, -hw * 0.6, hw * 0.6, 0.014, 5, 4)]));
  const crack = keep(roofPatch(S, sc.top + 0.03, sc.base - 0.04, -0.94, 0.94, 0.012, 5, 6, true));
  return { S, paint: keep(fuse(paint)), paintFar: keep(fuse(far)), glass: keep(gh.glass), trim: keep(fuse(trim)), chrome: keep(fuse(chrome)), head: keep(head), tail: keep(fuse(tail)), blinkL: keep(blink(-1)), blinkR: keep(blink(1)), rev: keep(rev), seams: keep(fuse(seams)), well: keep(fuse(well)), white: white && keep(white), dark: dark && keep(dark), plateF, plateR, door, soot, crack, hy, ty };
}
