import * as THREE from 'three';
import type { VDef, VKind } from './defs';
import type { CarModel } from './models';
import { shared, wheel } from './models';
import { addCabin } from './models2';
import { labelTexture } from '../world/textures';
import { REGION } from '../world/region';
import { Prof, Shape, makeShape, lowerBody, greenhouse, endPatch, sidePatch, windowPatch, topPatch, roofPatch, screenSpan, fuse } from './body';

/**
 * A road car put together from the shaped body (body.ts): paint, glass, black trim, chrome, lamps, number plates, a
 * driver's door that opens, wheel-arch liners, and the marks of damage. The geometry depends only on the model, so it
 * is built once per model and shared by every car of that kind; each car has its own paint and lamp materials.
 */
type G = THREE.BufferGeometry;
interface Parts {
  S: Shape; paint: G; glass: G; trim: G; chrome: G; head: G; tail: G; blinkL: G; blinkR: G; rev: G; seams: G; well: G; white?: G; dark?: G;
  plateF: G; plateR: G; door: { x: number; z: number; panel: G; win: G; handle: G }; soot: G; crack: G; hy: number; ty: number;
}
const CACHE = new Map<VKind, Parts>();
const keep = <T extends G>(g: T) => { g.userData.keep = true; return g; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export function carParts(def: VDef, P: Prof): Parts {
  const hit = CACHE.get(def.kind); if (hit) return hit;
  const S = makeShape(def, P), W = def.wid, hw = W / 2, k = def.kind, L = def.len / 2, low = k === 'super' || k === 'hyper' || k === 'sport';
  const tip = (dir: number) => P.lower.reduce((a, p) => (p[0] * dir > a[0] * dir ? p : a))[1];
  const hy = tip(1) + (low ? 0.045 : 0.06), ty = tip(-1) + (low ? 0.13 : 0.15), lh = low ? 0.035 : 0.05;
  const xf = Math.min(S.gx1 * 0.9, L - 0.9), dl = 1.25, four = k === 'sedan' || k === 'taxi' || k === 'police' || k === 'suv' || k === 'limo' || k === 'hatch';
  const bx = xf - dl + 0.02, gh = greenhouse(S, bx);
  const paint: G[] = [lowerBody(S), gh.paint], trim: G[] = [gh.black], chrome: G[] = [], seams: G[] = [], well: G[] = [];
  const both = (f: (s: 1 | -1) => G | G[]) => ([1, -1] as const).flatMap((s) => f(s));
  // ---- lamps ----
  const head = fuse(both((s) => endPatch(S, 1, hy - lh, hy + lh, s * hw * 0.44, s * hw * 0.93, 0.008, 7, 2)));
  const tailL: G[] = both((s) => endPatch(S, -1, ty - lh, ty + lh, s * hw * 0.38, s * hw * 0.93, 0.008, 7, 2));
  if (low) tailL.push(endPatch(S, -1, ty - 0.018, ty + 0.018, -hw * 0.38, hw * 0.38, 0.008, 6, 1));
  const blink = (s: 1 | -1) => fuse([endPatch(S, 1, hy - lh - 0.055, hy - lh - 0.012, s * hw * 0.62, s * hw * 0.93, 0.009, 4, 1), endPatch(S, -1, ty - lh - 0.055, ty - lh - 0.012, s * hw * 0.64, s * hw * 0.93, 0.009, 4, 1)]);
  const rev = fuse(both((s) => endPatch(S, -1, ty - lh - 0.055, ty - lh - 0.012, s * hw * 0.38, s * hw * 0.58, 0.009, 3, 1)));
  // ---- black trim: grille, air dam, diffuser, sills, scuttle ----
  if (!low) trim.push(endPatch(S, 1, hy - lh * 0.95, hy + lh * 0.95, -hw * 0.4, hw * 0.4, 0.006, 6, 2)); else trim.push(...both((s) => endPatch(S, 1, S.yb0 + 0.1, hy - lh - 0.03, s * hw * 0.3, s * hw * 0.8, 0.006, 4, 2)));
  trim.push(endPatch(S, 1, S.yb0 + 0.03, S.yb0 + (low ? 0.08 : 0.15), -hw * 0.82, hw * 0.82, 0.006, 8, 2), endPatch(S, -1, S.yb0 + 0.03, S.yb0 + 0.14, -hw * 0.78, hw * 0.78, 0.006, 8, 2));
  trim.push(...both((s) => sidePatch(S, s, -S.wx + S.R + 0.04, S.wx - S.R - 0.04, S.yb0 + 0.004, S.yb0 + 0.075, 0.006, 6, 1)));
  trim.push(topPatch(S, S.gx1 - 0.04, S.gx1 + 0.07, -hw * 0.8, hw * 0.8, 0.006, 1, 6));
  // ---- belt strip under the windows, door handles, exhausts ----
  const brightwork = k === 'sedan' || k === 'limo' || k === 'taxi' || k === 'muscle';
  (brightwork ? chrome : trim).push(...both((s) => sidePatch(S, s, S.gx0 + 0.04, S.gx1 - 0.06, S.belt - 0.035, S.belt - 0.008, 0.006, 8, 1)));
  const handle = (s: 1 | -1, x: number) => box(0.15, 0.028, 0.03, x, S.belt - 0.14, s * (S.zs(x, S.belt - 0.14) + 0.018));
  chrome.push(handle(-1, xf - dl * 0.82)); if (four) chrome.push(...both((s) => handle(s, xf - dl - 0.95)));
  for (const s of [-1, 1]) chrome.push(new THREE.CylinderGeometry(0.038, 0.038, 0.14, 10).rotateZ(Math.PI / 2).translate(S.tailX(S.yb0 + 0.08, s * hw * 0.5) + 0.02, S.yb0 + 0.07, s * hw * (low ? 0.3 : 0.5)));
  // ---- mirrors, arch lips ----
  for (const s of [1, -1] as const) { const x = S.gx1 - 0.3, y = S.belt + 0.075, z = s * (S.zs(x, S.belt) + 0.1); paint.push(new THREE.SphereGeometry(1, 8, 6).scale(0.055, 0.06, 0.095).translate(x, y, z)); trim.push(box(0.05, 0.03, 0.12, x + 0.01, y - 0.04, s * (S.zs(x, S.belt) + 0.03))); }
  for (const c of [S.wx, -S.wx]) for (const s of [1, -1]) {
    const z = s * (S.zs(c, S.cy + S.R * 0.8) + 0.004);
    (S.st.clad ? trim : paint).push(new THREE.TorusGeometry(S.R + 0.005, S.st.clad ? 0.035 : 0.02, 4, 12, Math.PI).translate(c, S.cy, z));
    // the liner: a dark half drum inside the arch, with its inner wall
    const zc = s * (S.zs(c, S.cy) - 0.16);
    well.push(new THREE.CylinderGeometry(S.R - 0.006, S.R - 0.006, 0.3, 14, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(c, S.cy, zc), new THREE.CircleGeometry(S.R - 0.006, 14, 0, Math.PI).translate(c, S.cy, zc - s * 0.148));
  }
  // ---- shut lines: doors, bonnet, boot ----
  const seam = (s: 1 | -1, x: number) => sidePatch(S, s, x - 0.006, x + 0.006, S.yb0 + 0.09, S.belt - 0.04, 0.004, 1, 3);
  for (const s of [1, -1] as const) { seams.push(seam(s, xf), seam(s, xf - dl)); if (four) seams.push(seam(s, Math.max(S.gx0 + 0.3, xf - dl - 1.05))); }
  for (const s of [1, -1]) seams.push(topPatch(S, S.gx1 + 0.1, S.x1 - 0.5, s * hw * 0.69, s * hw * 0.7, 0.004, 6, 1));
  seams.push(topPatch(S, S.x1 - 0.5, S.x1 - 0.488, -hw * 0.69, hw * 0.69, 0.004, 1, 6));
  if (S.gx0 - S.x0 > 0.5) seams.push(topPatch(S, S.x0 + 0.3, S.x0 + 0.312, -hw * 0.7, hw * 0.7, 0.004, 1, 6));
  // ---- per model ----
  let white: G | undefined, dark: G | undefined;
  const y5 = P.lower[5][1];
  if (k === 'super' || k === 'sport') (k === 'super' ? trim : paint).push(box(0.35, 0.04, W * 0.9, -L + 0.25, y5 + 0.3, 0), box(0.06, 0.28, 0.06, -L + 0.3, y5 + 0.15, W * 0.3), box(0.06, 0.28, 0.06, -L + 0.3, y5 + 0.15, -W * 0.3));
  if (k === 'hyper') { trim.push(box(0.45, 0.05, W * 0.98, -L + 0.2, 1.2, 0), box(0.08, 0.36, 0.08, -L + 0.3, 1.02, W * 0.32), box(0.08, 0.36, 0.08, -L + 0.3, 1.02, -W * 0.32)); trim.push(...both((s) => sidePatch(S, s, -1.05, -0.15, 0.44, 0.66, 0.006, 4, 2))); }
  if (k === 'muscle') { const sc = screenSpan(S); white = fuse([...[-1, 1].flatMap((s) => [topPatch(S, S.gx1 + 0.1, S.x1 - 0.2, s * 0.09, s * 0.27, 0.006, 8, 1), roofPatch(S, S.g0 + 0.45, sc.top - 0.05, s * 0.12, s * 0.36, 0.006, 6, 1), topPatch(S, S.x0 + 0.2, S.gx0 - 0.08, s * 0.09, s * 0.27, 0.006, 4, 1)])]); trim.push(box(0.7, 0.1, 0.5, 1.4, S.topY(1.4, 0) + 0.04, 0)); }
  if (k === 'pickup') dark = fuse([topPatch(S, S.x0 + 0.16, S.gx0 - 0.12, -hw * 0.84, hw * 0.84, 0.006, 6, 2)]);
  if (k === 'police') { white = fuse(both((s) => sidePatch(S, s, -1.25, 1.05, 0.46, S.belt - 0.045, 0.014, 8, 2))); trim.push(box(0.05, 0.05, W * 0.62, S.x1 + 0.13, 0.66, 0), box(0.05, 0.05, W * 0.62, S.x1 + 0.13, 0.42, 0)); for (const z of [-W * 0.28, W * 0.28]) trim.push(box(0.05, 0.34, 0.05, S.x1 + 0.13, 0.54, z), box(0.2, 0.05, 0.05, S.x1 + 0.03, 0.44, z)); }
  // ---- the driver's door (right side): its skin, its window, its handle, hinged at its front edge ----
  const zh = S.zs(xf, (S.yb0 + S.belt) / 2), mv = (g: G) => g.translate(-xf, 0, -zh);
  const door = { x: xf, z: zh, panel: keep(mv(sidePatch(S, 1, xf - dl, xf, S.yb0 + 0.09, S.belt - 0.04, 0.012, 6, 3))), win: keep(mv(windowPatch(S, 1, xf - dl + 0.07, xf - 0.02, S.beltG + 0.012, S.roofY - 0.1, 0.01, 6, 3))), handle: keep(mv(handle(1, xf - dl * 0.82))) };
  // ---- number plates ----
  const pf = S.yb0 + (low ? 0.13 : 0.2), pr = Math.min(ty - lh - 0.16, S.yb0 + 0.3);
  const plateF = keep(new THREE.PlaneGeometry(0.33, 0.165).rotateY(Math.PI / 2).translate(S.noseX(pf, 0) + 0.02, pf, 0)), plateR = keep(new THREE.PlaneGeometry(0.33, 0.165).rotateY(-Math.PI / 2).translate(S.tailX(pr, 0) - 0.02, pr, 0));
  trim.push(box(0.02, 0.185, 0.35, S.noseX(pf, 0) + 0.008, pf, 0), box(0.02, 0.185, 0.35, S.tailX(pr, 0) - 0.008, pr, 0));
  // ---- damage: soot over the nose, a cracked windscreen ----
  const sc = screenSpan(S);
  const soot = keep(fuse([endPatch(S, 1, S.yb0 + 0.05, hy + lh + 0.03, -hw * 0.9, hw * 0.9, 0.013, 10, 4), topPatch(S, S.x1 - 1.0, S.x1 - 0.1, -hw * 0.62, hw * 0.62, 0.013, 5, 4)]));
  const crack = keep(roofPatch(S, sc.top + 0.03, sc.base - 0.04, -0.94, 0.94, 0.012, 5, 6, true));
  const out: Parts = { S, paint: keep(fuse(paint)), glass: keep(gh.glass), trim: keep(fuse(trim)), chrome: keep(fuse(chrome)), head: keep(head), tail: keep(fuse(tailL)), blinkL: keep(blink(-1)), blinkR: keep(blink(1)), rev: keep(rev), seams: keep(fuse(seams)), well: keep(fuse(well)), white: white && keep(white), dark: dark && keep(dark), plateF, plateR, door, soot, crack, hy, ty };
  CACHE.set(def.kind, out); return out;
}

/* ------------------------------------------------------------------ shared looks */
const lazy = <T>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); };
const MATS = lazy(() => ({
  well: new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 1, side: THREE.DoubleSide }),
  seam: new THREE.MeshBasicMaterial({ color: '#07070a', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  white: new THREE.MeshStandardMaterial({ color: '#f2f2f4', metalness: 0.35, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -1 }),
  dark: new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.9 }),
  soot: new THREE.MeshStandardMaterial({ color: '#0d0c0b', roughness: 1, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  crack: new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
}));
function crackTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.strokeStyle = 'rgba(235,245,255,0.85)'; g.lineCap = 'round';
  for (const [cx, cy, n, len] of [[92, 150, 13, 120], [190, 80, 8, 60]]) {
    for (let k = 0; k < n; k++) { let a = (k / n) * Math.PI * 2 + rnd() * 0.4, x = cx, y = cy; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 7; s++) { a += (rnd() - 0.5) * 0.5; x += Math.cos(a) * len / 7; y += Math.sin(a) * len / 7; g.lineTo(x, y); } g.stroke(); }
    for (const r of [0.2, 0.42, 0.7]) { g.lineWidth = 1; g.beginPath(); for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2, q = len * r * (0.85 + rnd() * 0.3); k ? g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : g.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.stroke(); }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, len * 0.3); gr.addColorStop(0, 'rgba(235,245,255,0.6)'); gr.addColorStop(1, 'rgba(235,245,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Number plates: the city's office, a class number, a kana and four digits (made up). A handful are shared by all cars. */
const PLATE_OFFICE: Record<string, string> = { tokyo: '新宿', osaka: 'なにわ', nara: '奈良', fukuoka: '福岡', naha: '沖縄' };
const plates = lazy(() => ['さ 12-34', 'ね 58-06', 'ふ ・7-21', 'と 40-95', 'ま 86-13', 'れ ・・-88'].map((num, i) => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!, taxi = i === 5;
  g.fillStyle = taxi ? '#1f6b3a' : '#f4f3ec'; g.fillRect(0, 0, 256, 128); g.strokeStyle = taxi ? '#f4f3ec' : '#1f5a34'; g.lineWidth = 5; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = taxi ? '#f4f3ec' : '#1f5a34'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 30px "Hiragino Sans", "Noto Sans JP", sans-serif'; g.fillText(`${PLATE_OFFICE[REGION.id] || '新宿'} ${300 + i * 31}`, 128, 30);
  g.font = '800 62px "Hiragino Sans", "Noto Sans JP", sans-serif'; g.fillText(num, 128, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.1 });
}));
let plateN = 0;

export function buildShaped(def: VDef, color: string, P: Prof): Omit<CarModel, 'tilt'> {
  const Sh = shared(), X = MATS(), Q = carParts(def, P), S = Q.S, W = def.wid, k = def.kind;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const glass = Sh.glass.clone(), rim = Sh.chrome.clone();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.32, envMapIntensity: 1.2, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const head = new THREE.MeshStandardMaterial({ color: '#b9bec4', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.5 });
  const tail = new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: new THREE.Color('#ff1a1a'), emissiveIntensity: 0.4, roughness: 0.3 });
  const amber = () => new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: new THREE.Color('#ffa21a'), emissiveIntensity: 0 });
  const blinkL = amber(), blinkR = amber(), rev = new THREE.MeshStandardMaterial({ color: '#cfcfcf', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = false, small = false, parent: THREE.Object3D = body) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = shadow; if (small) mesh.userData.small = true; parent.add(mesh); return mesh; };
  add(Q.paint, paint, true); add(Q.glass, glass); add(Q.trim, Sh.trim); add(Q.chrome, Sh.chrome); add(Q.well, X.well);
  add(Q.head, head); add(Q.tail, tail); add(Q.blinkL, blinkL, false, true); add(Q.blinkR, blinkR, false, true); add(Q.rev, rev, false, true); add(Q.seams, X.seam, false, true);
  if (Q.white) add(Q.white, X.white); if (Q.dark) add(Q.dark, X.dark);
  const plate = k === 'taxi' ? plates()[5] : plates()[plateN++ % 5]; add(Q.plateF, plate, false, true); add(Q.plateR, plate, false, true);
  const soot = add(Q.soot, X.soot), crack = add(Q.crack, X.crack); soot.visible = crack.visible = false;
  // per-car extras that carry their own materials
  let bar: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | undefined;
  if (k === 'police') {
    const lab = new THREE.MeshBasicMaterial({ map: labelTexture('POLICE', '#2b6bff'), toneMapped: false, transparent: true });
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(1.5, 0.36).rotateY(s > 0 ? 0 : Math.PI).translate(-0.1, 0.68, s * (S.zs(-0.1, 0.68) + 0.02)), lab);
    const red = new THREE.MeshStandardMaterial({ color: '#550000', emissive: new THREE.Color('#ff1530'), emissiveIntensity: 0 }), blue = new THREE.MeshStandardMaterial({ color: '#000855', emissive: new THREE.Color('#1a4dff'), emissiveIntensity: 0 });
    const ry = S.gtop(-0.3, 0);
    add(new THREE.BoxGeometry(0.3, 0.1, W * 0.6).translate(-0.3, ry + 0.05, 0), Sh.trim); add(new THREE.BoxGeometry(0.26, 0.12, W * 0.26).translate(-0.3, ry + 0.14, W * 0.15), red); add(new THREE.BoxGeometry(0.26, 0.12, W * 0.26).translate(-0.3, ry + 0.14, -W * 0.15), blue);
    bar = [red, blue];
  }
  if (k === 'taxi') {
    const lab = new THREE.MeshBasicMaterial({ map: labelTexture('TAXI', '#ffcc00'), toneMapped: false }), ry = S.gtop(-0.25, 0);
    add(new THREE.BoxGeometry(0.32, 0.2, 0.9).translate(-0.25, ry + 0.11, 0), new THREE.MeshStandardMaterial({ color: '#ffe680', emissive: new THREE.Color('#ffcc00'), emissiveIntensity: 0.6 }));
    for (const sz of [-1, 1]) add(new THREE.PlaneGeometry(0.8, 0.18).rotateY(sz > 0 ? 0 : Math.PI).translate(-0.25, ry + 0.11, sz * 0.46), lab);
    const chk: THREE.BufferGeometry[] = []; for (let n = 0; n < 8; n++) for (const sz of [-1, 1]) { const x = -1.6 + n * 0.42, y = 0.76 + (n % 2) * 0.09; chk.push(new THREE.BoxGeometry(0.22, 0.09, 0.02).translate(x, y, sz * (S.zs(x, y) + 0.016))); }
    add(fuse(chk), X.dark, false, true);
  }
  // the driver's door
  const door = new THREE.Group(); door.position.set(Q.door.x, 0, Q.door.z);
  add(Q.door.panel, paint, true, false, door); add(Q.door.win, glass, false, false, door); add(Q.door.handle, Sh.chrome, false, false, door); door.userData.small = true; body.add(door);
  const cab = addCabin(def, P, W, body);
  const wheels: THREE.Group[] = [];
  for (const x of [S.wx, -S.wx]) for (const s of [-1, 1]) { const wg = wheel(def.wheelR, S.tw, rim, s, k === 'super' || k === 'hyper' || k === 'sport' || k === 'muscle'); wg.position.set(x, def.wheelR, s * S.wz); root.add(wg); wheels.push(wg); }
  return { root, body, wheels, paint, glass, rim, lights: { head, tail, bar, blinkL, blinkR, rev }, door, eye: cab.eye, steering: cab.steering, sprung: true, damage: { soot, crack } };
}
