import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VDef, VKind } from './defs';

/**
 * Shaped car bodies. A car used to be its side profile pushed straight across its width (slab sides, a glass block for
 * the cabin, wheels half buried in the flanks). Here the same profiles are lofted: cross-sections are placed along the
 * length and joined, so the nose and tail narrow in plan, the corners are round, the cabin leans in towards the roof,
 * the wings rise over the wheels, and the wheels sit in arches cut into the flanks. Everything that sits on the body
 * (lamps, grille, door, seams, strips) is cut from the same surface functions, so it follows the curves.
 *
 * Model space: x forward, y up, z to the right of the car (the driver sits at +z... see addCabin: right-hand drive).
 */
export type Prof = { lower: number[][]; glass: number[][]; roofY: number };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Corner cutting on a closed polygon; corners for which keep() holds stay sharp. */
function chaikin(poly: number[][], n: number, keep?: (p: number[]) => boolean) {
  for (let it = 0; it < n; it++) {
    const out: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], ka = !!keep?.(A), kb = !!keep?.(B);
      out.push(ka ? A : [A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25]);
      if (!kb) out.push([A[0] * 0.25 + B[0] * 0.75, A[1] * 0.25 + B[1] * 0.75]);
    }
    poly = out;
  }
  return poly;
}
/** The lowest and highest point of a polygon on the vertical line at x. */
function span(poly: number[][], x: number): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    if ((x - A[0]) * (x - B[0]) > 0) continue;
    if (Math.abs(A[0] - B[0]) < 1e-9) { lo = Math.min(lo, A[1], B[1]); hi = Math.max(hi, A[1], B[1]); continue; }
    const y = A[1] + ((x - A[0]) / (B[0] - A[0])) * (B[1] - A[1]); lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return [lo, hi];
}

interface Style { /** how much the nose and tail narrow */ taper: number; /** how much the cabin leans in at the roof */ tumble: number; /** thickness of the rear pillar (m) */ quarter: number; /** black arch lips (off-roaders) */ clad: boolean }
const STYLE: Partial<Record<VKind, Partial<Style>>> = {
  sport: { taper: 0.13, tumble: 0.2, quarter: 0.34 }, super: { taper: 0.14, tumble: 0.26, quarter: 0.4 }, hyper: { taper: 0.15, tumble: 0.28, quarter: 0.4 },
  muscle: { taper: 0.09, tumble: 0.18, quarter: 0.4 }, hatch: { taper: 0.1, tumble: 0.13, quarter: 0.2 }, suv: { taper: 0.07, tumble: 0.1, quarter: 0.24, clad: true },
  pickup: { taper: 0.07, tumble: 0.1, quarter: 0.12, clad: true }, limo: { taper: 0.09, tumble: 0.14, quarter: 0.5 },
};

/** The surfaces of one car: where its skin is. */
export interface Shape {
  def: VDef; P: Prof; st: Style; W: number; x0: number; x1: number; yb0: number; belt: number; gx0: number; gx1: number; roofY: number; R: number; cy: number; wx: number; wz: number; tw: number;
  /** half width of the lower body at x, y */ zs(x: number, y: number): number;
  /** underside at the centre / under the flank (raised over the wheels) */ ybc(x: number): number; ybs(x: number): number;
  /** top at the centre line / at the shoulder (raised over the wheels) */ ytc(x: number): number; yts(x: number): number;
  /** height of the top surface (bonnet, boot) at x, z */ topY(x: number, z: number): number;
  /** cabin: half width at x, y; top at x; height of roof / screens at x, z */ gz(x: number, y: number): number; gyt(x: number): number; gtop(x: number, z: number): number; beltG: number; g0: number; g1: number;
  /** the foremost / rearmost x of the skin at height y, offset z */ noseX(y: number, z: number): number; tailX(y: number, z: number): number;
}
const RB = 0.07, RT = 0.09, CROWN = 0.022, WELL = 0.3;

export function makeShape(def: VDef, P: Prof): Shape {
  const st: Style = { taper: 0.1, tumble: 0.15, quarter: 0.28, clad: false, ...(STYLE[def.kind] || {}) };
  const W = def.wid, LP = chaikin(P.lower, 2), xs = LP.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), yb0 = Math.min(...LP.map((p) => p[1]));
  const beltG = Math.min(...P.glass.map((p) => p[1])), GP = chaikin(P.glass, 2, (p) => p[1] < beltG + 0.06), g0 = Math.min(...GP.map((p) => p[0])), g1 = Math.max(...GP.map((p) => p[0]));
  const gx0 = Math.min(...P.glass.map((p) => p[0])), gx1 = Math.max(...P.glass.map((p) => p[0])), belt = span(LP, (gx0 + gx1) / 2)[1];
  const R = def.wheelR + (st.clad ? 0.1 : 0.07), cy = def.wheelR, wx = def.wheelbase / 2, tw = 0.24, wz = W / 2 - 0.165;
  const tF = Math.max(0.58 * x1, gx1 + 0.05), tR = Math.max(0.58 * -x0, -gx0 + 0.05);
  const plan = (x: number) => {
    const e = x > 0 ? x1 : -x0, t0 = Math.min(x > 0 ? tF : tR, e - 0.5), ax = Math.abs(x); let k = 1;
    if (ax > t0) { const s = (ax - t0) / (e - t0); k *= 1 - st.taper * s * s; }
    if (ax > e - 0.42) { const q = clamp((ax - (e - 0.42)) / 0.42, 0, 1); k *= Math.sqrt(1 - 0.5 * q * q); }
    return k;
  };
  const zs = (x: number, y: number) => { const u = clamp((y - yb0) / (belt - yb0), 0, 1); return (W / 2) * plan(x) * (1 - 0.035 * (1 - u) * (1 - u)); };
  const arch = (x: number) => { let a = -1; for (const c of [wx, -wx]) { const d = Math.abs(x - c); if (d < R) a = Math.max(a, cy + Math.sqrt(R * R - d * d)); } return a; };
  const cx = (x: number) => clamp(x, x0 + 1e-4, x1 - 1e-4);
  const ybc = (x: number) => span(LP, cx(x))[0], ytc = (x: number) => span(LP, cx(x))[1];
  const ybs = (x: number) => Math.max(ybc(x), Math.min(arch(x), ytc(x) + 0.2));
  const yts = (x: number) => Math.max(ytc(x), arch(x) + 0.075);
  const topY = (x: number, z: number) => {
    const c = ytc(x), s = yts(x), zt = Math.max(0.05, zs(x, s) - RT), f = clamp(Math.abs(z) / zt, 0, 1);
    // flat and slightly crowned in the middle, rising to the wing tops over the wheels at the edges
    const rise = f < 0.4 ? 0.04 * (f / 0.4) : f < 0.72 ? 0.04 + 0.31 * ((f - 0.4) / 0.32) : 0.35 + 0.65 * ((f - 0.72) / 0.28);
    return c + (s - c) * rise + CROWN * (1 - f * f);
  };
  const gc = (g0 + g1) / 2, gh = (g1 - g0) / 2;
  const gz = (x: number, y: number) => zs(x, belt) * 0.955 * (1 - 0.05 * ((x - gc) / gh) ** 2) * (1 - st.tumble * clamp((y - beltG) / (P.roofY - beltG), 0, 1));
  const gyt = (x: number) => Math.max(beltG, span(GP, clamp(x, g0 + 1e-4, g1 - 1e-4))[1]);
  const gtop = (x: number, z: number) => { const t = gyt(x), zt = Math.max(0.05, gz(x, t) - 0.06); return t + 0.02 * (1 - clamp(Math.abs(z) / zt, 0, 1) ** 2); };
  const inside = (x: number, y: number, z: number) => x > x0 && x < x1 && y >= ybs(x) - 0.01 && y <= yts(x) + 0.01 && zs(x, y) >= Math.abs(z);
  const edge = (from: number, dir: number, y: number, z: number) => {
    let x = from; for (let k = 0; k < 36 && !inside(x, y, z); k++) x -= dir * 0.04;
    let out = x + dir * 0.04, inn = x; for (let k = 0; k < 6; k++) { const mid = (out + inn) / 2; if (inside(mid, y, z)) inn = mid; else out = mid; }
    return inn;
  };
  const noseX = (y: number, z: number) => edge(x1 - 0.002, 1, y, z), tailX = (y: number, z: number) => edge(x0 + 0.002, -1, y, z);
  return { def, P, st, W, x0, x1, yb0, belt, gx0, gx1, roofY: P.roofY, R, cy, wx, wz, tw, zs, ybc, ybs, ytc, yts, topY, gz, gyt, gtop, beltG, g0, g1, noseX, tailX };
}

/* ------------------------------------------------------------------ mesh helpers */
class MB {
  p: number[] = []; tris: number[][] = [];
  v(x: number, y: number, z: number) { this.p.push(x, y, z); return this.p.length / 3 - 1; }
  quad(a: number, b: number, c: number, d: number, tag = 0) { (this.tris[tag] ||= []).push(a, b, c, a, c, d); }
  tri(a: number, b: number, c: number, tag = 0) { (this.tris[tag] ||= []).push(a, b, c); }
  /** Mirror everything built so far across z = 0 (points on the centre line are shared, so the surface stays smooth there). */
  mirror() {
    const n = this.p.length / 3, map: number[] = [];
    for (let i = 0; i < n; i++) map[i] = Math.abs(this.p[i * 3 + 2]) < 1e-6 ? i : this.v(this.p[i * 3], this.p[i * 3 + 1], -this.p[i * 3 + 2]);
    for (const t of this.tris) { if (!t) continue; const m = t.length; for (let k = 0; k < m; k += 3) t.push(map[t[k]], map[t[k + 2]], map[t[k + 1]]); }
  }
  /** One geometry per tag, with smooth normals worked out over the whole surface and faces turned outwards. */
  build(): THREE.BufferGeometry[] {
    const all = new THREE.BufferGeometry(); all.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    let idx: number[] = []; for (const t of this.tris) if (t) idx = idx.concat(t);
    all.setIndex(idx); all.computeVertexNormals();
    const flip = !outward(all);
    if (flip) { for (const t of this.tris) if (t) for (let k = 0; k < t.length; k += 3) { const q = t[k + 1]; t[k + 1] = t[k + 2]; t[k + 2] = q; } const nn = all.getAttribute('normal') as THREE.BufferAttribute; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i)); }
    return this.tris.map((t) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', all.getAttribute('position')); g.setAttribute('normal', all.getAttribute('normal')); g.setIndex(t || []); return g.toNonIndexed(); });
  }
}
/** Do the normals point away from the car's spine (the line along its length at seat height)? */
function outward(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'); let s = 0;
  for (let i = 0; i < p.count; i++) s += n.getX(i) * p.getX(i) * 0.15 + n.getY(i) * (p.getY(i) - 0.7) + n.getZ(i) * p.getZ(i);
  return s >= 0;
}
/** A grid of points f(u, v), u and v in 0..1, as a surface with smooth normals facing outwards (and uv for textures). */
export function patch(nu: number, nv: number, f: (u: number, v: number) => number[], uv = false) {
  const pos: number[] = [], idx: number[] = [], uvs: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...f(i / nu, j / nv)); uvs.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1; idx.push(a, b, c, a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (!outward(g)) { for (let k = 0; k < idx.length; k += 3) { const q = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = q; } g.setIndex(idx); g.computeVertexNormals(); }
  return g.toNonIndexed();
}
/** Merge geometries of any kind into one (positions and normals only). */
export function fuse(list: THREE.BufferGeometry[]) {
  const gs = list.filter((g) => g && g.getAttribute('position') && g.getAttribute('position').count > 0).map((g) => { const q = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); return q; });
  return gs.length ? mergeGeometries(gs)! : new THREE.BufferGeometry();
}

/** Stations along the length: even steps, closer together at the ends and through the wheel arches, and exactly at the listed places. */
function stations(a: number, b: number, step: number, exact: number[], dense: [number, number][]) {
  const fixed = [a, b, ...exact.filter((x) => x > a + 0.02 && x < b - 0.02)], xs: number[] = [...fixed];
  for (const d of [0.03, 0.08, 0.16, 0.28]) xs.push(a + d, b - d);
  for (let x = a + 0.45; x < b - 0.45; x += step) xs.push(x);
  for (const [d0, d1] of dense) for (let k = 0; k <= 8; k++) { const x = d0 + ((d1 - d0) * k) / 8; if (x > a && x < b) xs.push(x); }
  // the fixed ones always stay; the others only where they are not crowding a neighbour
  const free = xs.filter((x) => !fixed.includes(x) && fixed.every((f) => Math.abs(f - x) > 0.025)).sort((p, q) => p - q), out: number[] = [...fixed];
  let last = -1e9; for (const x of free) if (x - last > 0.025) { out.push(x); last = x; }
  return out.sort((p, q) => p - q);
}

/** The painted lower body: closed over the bonnet and boot, an open tub (walls, floor, sills) where the cabin is. */
export function lowerBody(S: Shape) {
  const m = new MB(), xs = stations(S.x0 + 0.004, S.x1 - 0.004, 0.3, [S.gx0, S.gx1], [[S.wx - S.R, S.wx + S.R], [-S.wx - S.R, -S.wx + S.R]]);
  const C: number[][] = [], U: (number[] | null)[] = [], O: (number[] | null)[] = [];
  const open = (a: number, b: number) => (a + b) / 2 > S.gx0 && (a + b) / 2 < S.gx1;
  xs.forEach((x, i) => {
    const bc = S.ybc(x), bs = S.ybs(x), tc = S.ytc(x), ts = S.yts(x), h = Math.max(0.004, ts - bs), k = Math.min(1, h / (RB + RT + 0.03)), rb = RB * k, rt = RT * k;
    const zb = S.zs(x, bs + rb), zw = Math.max(0.02, zb - WELL), c: number[] = [];
    c.push(m.v(x, bc, 0), m.v(x, bc, zw * 0.6), m.v(x, bc, zw - 0.004), m.v(x, Math.max(bc, bs), zw), m.v(x, bs, Math.max(zw, zb - rb)));
    for (const a of [Math.PI / 4, Math.PI / 2]) c.push(m.v(x, bs + rb * (1 - Math.cos(a)), zb - rb + rb * Math.sin(a)));
    for (const f of [0.5, 1]) { const y = bs + rb + (ts - rt - bs - rb) * f; c.push(m.v(x, y, S.zs(x, y))); }
    C.push(c);
    const last = c[c.length - 1], zt = S.zs(x, ts - rt), isO = (i > 0 && open(xs[i - 1], x)) || (i < xs.length - 1 && open(x, xs[i + 1])), isC = (i > 0 && !open(xs[i - 1], x)) || (i < xs.length - 1 && !open(x, xs[i + 1]));
    if (isC) { const u = [last]; u.push(m.v(x, ts - rt + rt * Math.sin(Math.PI / 4), zt - rt + rt * Math.cos(Math.PI / 4))); for (const f of [1, 0.72, 0.4, 0]) { const z = (zt - rt) * f; u.push(m.v(x, S.topY(x, z), z)); } void tc; U.push(u); } else U.push(null);
    if (isO) O.push([last, m.v(x, ts, S.zs(x, ts)), m.v(x, ts, S.zs(x, ts) - 0.055)]); else O.push(null);
  });
  for (let i = 0; i < xs.length - 1; i++) {
    const strip = (A: number[], B: number[]) => { for (let j = 0; j < A.length - 1; j++) m.quad(A[j], B[j], B[j + 1], A[j + 1]); };
    strip(C[i], C[i + 1]);
    if (open(xs[i], xs[i + 1])) strip(O[i]!, O[i + 1]!); else strip(U[i]!, U[i + 1]!);
  }
  m.mirror();
  const parts = m.build();
  // the ends, and the walls between the bonnet / boot and the cabin
  for (const [i, kind] of [[0, 'cap'], [xs.length - 1, 'cap'], [xs.indexOf(S.gx0), 'wall'], [xs.indexOf(S.gx1), 'wall']] as const) {
    if (i < 0) continue; const x = xs[i], ring = [...C[i], ...(U[i] || []).slice(1)], pts: number[][] = ring.map((q) => [m.p[q * 3], m.p[q * 3 + 1], m.p[q * 3 + 2]]);
    const mid = (S.ybc(x) + S.ytc(x)) / 2, tri: number[] = [];
    for (let j = 0; j < pts.length - 1; j++) for (const s of [1, -1]) { const a = pts[j], b = pts[j + 1]; if (kind === 'wall' && (a[1] > S.belt + 0.02 || b[1] > S.belt + 0.02)) continue; tri.push(x, mid, 0, a[0], a[1], a[2] * s, b[0], b[1], b[2] * s); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); parts.push(g);
  }
  return fuse(parts);
}

/** The cabin above the belt line: [glass, paint (pillars, roof rails, roof, rear quarters), black (centre pillar)]. */
export function greenhouse(S: Shape, bx: number) {
  const m = new MB(), cq = S.g0 + S.st.quarter, xs = stations(S.g0, S.g1, 0.16, [bx - 0.05, bx + 0.05, cq], []), yb = S.beltG;
  const rows = xs.map((x) => {
    const yt = S.gyt(x), rt = Math.min(0.065, (yt - yb) * 0.45), zt = S.gz(x, yt - rt), r: number[] = [];
    for (const f of [0, 1 / 3, 2 / 3, 1]) { const y = yb + (yt - rt - yb) * f; r.push(m.v(x, y, S.gz(x, y))); }
    r.push(m.v(x, yt - rt + rt * Math.sin(Math.PI / 4), zt - rt + rt * Math.cos(Math.PI / 4)), m.v(x, S.gtop(x, zt - rt), zt - rt), m.v(x, S.gtop(x, (zt - rt) * 0.5), (zt - rt) * 0.5), m.v(x, S.gtop(x, 0), 0));
    return r;
  });
  const GLASS = 0, PAINT = 1, BLACK = 2, roof = (x: number) => S.gyt(x) > S.roofY - 0.035;
  for (let i = 0; i < xs.length - 1; i++) {
    const A = rows[i], B = rows[i + 1], xm = (xs[i] + xs[i + 1]) / 2, side = Math.abs(xm - bx) < 0.05 ? BLACK : xm < cq ? PAINT : GLASS, top = roof(xs[i]) && roof(xs[i + 1]) ? PAINT : GLASS;
    for (let j = 0; j < 7; j++) m.quad(A[j], B[j], B[j + 1], A[j + 1], j < 3 ? side : j < 5 ? PAINT : top);
  }
  // an upright tail (hatchbacks, off-roaders, pickup cabs) is closed with a rear window
  const back: THREE.BufferGeometry[] = [];
  if (S.gyt(S.g0 + 0.01) - yb > 0.15) { const x = xs[0], r = rows[0], pts = r.map((q) => [m.p[q * 3], m.p[q * 3 + 1], m.p[q * 3 + 2]]), tri: number[] = []; for (let j = 0; j < pts.length - 1; j++) for (const s of [1, -1]) { const a = pts[s > 0 ? j : j + 1], b = pts[s > 0 ? j + 1 : j]; tri.push(x, yb, 0, a[0], a[1], a[2] * s * 0.97, b[0], b[1], b[2] * s * 0.97); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); if (!outward(g)) { g.scale(1, 1, -1); g.computeVertexNormals(); } back.push(g); }
  m.mirror();
  const [glass, paint, black] = m.build();
  return { glass: fuse([glass, ...back]), paint: paint || new THREE.BufferGeometry(), black: black || new THREE.BufferGeometry() };
}

/* ------------------------------------------------------------------ pieces cut from the skin */
/** A piece of the nose (dir 1) or tail (dir -1) between two heights and two offsets from the centre line. */
export const endPatch = (S: Shape, dir: 1 | -1, y0: number, y1: number, z0: number, z1: number, off = 0.008, nz = 6, ny = 3, uv = false) =>
  patch(nz, ny, (u, v) => { const y = y0 + (y1 - y0) * v, z = z0 + (z1 - z0) * u; return [(dir > 0 ? S.noseX(y, z) : S.tailX(y, z)) + dir * off, y, z]; }, uv);
/** A piece of the flank. side: 1 right, -1 left. */
export const sidePatch = (S: Shape, side: 1 | -1, xa: number, xb: number, y0: number, y1: number, off = 0.008, nx = 6, ny = 3) =>
  patch(nx, ny, (u, v) => { const x = xa + (xb - xa) * u, y = y0 + (y1 - y0) * v; return [x, y, side * (S.zs(x, y) + off)]; });
/** A piece of a side window (clipped to the glass). */
export const windowPatch = (S: Shape, side: 1 | -1, xa: number, xb: number, y0: number, y1: number, off = 0.008, nx = 5, ny = 3) =>
  patch(nx, ny, (u, v) => { const x = xa + (xb - xa) * u, yt = S.gyt(x) - 0.07, y = Math.min(y0 + (y1 - y0) * v, Math.max(y0, yt)); return [x, y, side * (S.gz(x, y) + off)]; });
/** A piece of the bonnet / boot top. */
export const topPatch = (S: Shape, xa: number, xb: number, z0: number, z1: number, off = 0.008, nx = 6, nz = 3) =>
  patch(nx, nz, (u, v) => { const x = xa + (xb - xa) * u, z = z0 + (z1 - z0) * v; return [x, S.topY(x, z) + off, z]; });
/** A piece of the roof and screens (fz0..fz1: fraction of the width at that point). */
export const roofPatch = (S: Shape, xa: number, xb: number, fz0: number, fz1: number, off = 0.008, nx = 8, nz = 4, uv = false) =>
  patch(nx, nz, (u, v) => { const x = xa + (xb - xa) * u, zt = S.gz(x, S.gyt(x)) - 0.06, z = zt * (fz0 + (fz1 - fz0) * v); return [x, S.gtop(x, z) + off, z]; }, uv);
/** Where the windscreen starts and where the roof starts (x), going back from the scuttle. */
export function screenSpan(S: Shape) { let xr = S.g1; for (let x = S.g1; x > S.g0; x -= 0.02) { xr = x; if (S.gyt(x) > S.roofY - 0.035) break; } return { base: S.g1 - 0.02, top: xr }; }
export function rearScreenSpan(S: Shape) { let xr = S.g0; for (let x = S.g0; x < S.g1; x += 0.02) { xr = x; if (S.gyt(x) > S.roofY - 0.035) break; } return { base: S.g0 + 0.02, top: xr }; }
