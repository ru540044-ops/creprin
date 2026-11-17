import * as THREE from 'three';
import type { VDef, VKind } from './defs';
import type { CarModel } from './models';
import { shared, wheel } from './models';
import { addCabin } from './models2';
import { labelTexture } from '../world/textures';
import { REGION } from '../world/region';
import { exoticParts } from './exotic';
import { saloonParts } from './saloon';
import { Prof, Shape, makeShape, lowerBody, greenhouse, endPatch, sidePatch, windowPatch, topPatch, roofPatch, screenSpan, fuse } from './body';

/**
 * A road car put together from the shaped body (body.ts): paint, glass, black trim, chrome, lamps, number plates, a
 * driver's door that opens, wheel-arch liners, and the marks of damage. The geometry depends only on the model, so it
 * is built once per model and shared by every car of that kind; each car has its own paint and lamp materials.
 */
type G = THREE.BufferGeometry;
export interface Parts {
  S: Shape; paint: G; /** the painted body with fewer faces, for cars a long way off */ paintFar: G; glass: G; trim: G; chrome: G; head: G; tail: G; blinkL: G; blinkR: G; rev: G; seams: G; well: G; white?: G; dark?: G;
  plateF: G; plateR: G; door: { x: number; z: number; panel: G; win: G; handle: G }; soot: G; crack: G; hy: number; ty: number;
}
const CACHE = new Map<VKind, Parts>();
const keep = <T extends G>(g: T) => { g.userData.keep = true; return g; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export function carParts(def: VDef, P: Prof): Parts {
  const hit = CACHE.get(def.kind); if (hit) return hit;
  const q = P.kit === 'exotic' ? exoticParts(def, P) : saloonParts(def, P); CACHE.set(def.kind, q); return q;
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
  const head = new THREE.MeshStandardMaterial({ color: '#dfe6ec', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: 0.3, roughness: 0.12, metalness: 0.25 });
  const tail = new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: new THREE.Color('#ff1a1a'), emissiveIntensity: 0.4, roughness: 0.3 });
  const amber = () => new THREE.MeshStandardMaterial({ color: '#7a4a00', emissive: new THREE.Color('#ffa21a'), emissiveIntensity: 0 });
  const blinkL = amber(), blinkR = amber(), rev = new THREE.MeshStandardMaterial({ color: '#cfcfcf', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = false, small = false, parent: THREE.Object3D = body) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = shadow; if (small) mesh.userData.small = true; parent.add(mesh); return mesh; };
  const skin = add(Q.paint, paint, true); add(Q.glass, glass); add(Q.trim, Sh.trim); add(Q.chrome, Sh.chrome); add(Q.well, X.well);
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
    const chk: THREE.BufferGeometry[] = []; for (let n = 0; n < 7; n++) for (const sz of [-1, 1]) { const x = -0.9 + n * 0.28, y = S.belt - 0.2 + (n % 2) * 0.07; chk.push(new THREE.BoxGeometry(0.14, 0.07, 0.012).translate(x, y, sz * (S.zs(x, y) + 0.008))); } // a chequered band along the doors
    add(fuse(chk), X.dark, false, true);
  }
  // the driver's door
  const door = new THREE.Group(); door.position.set(Q.door.x, 0, Q.door.z);
  add(Q.door.panel, paint, true, false, door); add(Q.door.win, glass, false, false, door); add(Q.door.handle, Sh.chrome, false, false, door); door.userData.small = true; body.add(door);
  // the seats and dashboard go in the open tub: on a waisted or mid-engined car that is narrower and shorter than the body
  const c0 = Math.max(S.cab0, S.x0 + 0.45), zmin = Math.min(...[0, 0.25, 0.5, 0.75, 1].map((t) => S.zs(c0 + (S.cab1 - c0) * t, S.yb0 + 0.3))), bs = P.kit ? S.ytc(S.cab1 - 0.25) - 0.09 : S.belt;
  const CP: Prof = { lower: Array(6).fill([0, bs]), glass: [[c0, bs], [S.cab1, bs], [S.cab1 - 0.5, P.roofY], [c0 + 0.3, P.roofY]], roofY: P.roofY };
  const cab = addCabin(def, CP, Math.min(W, zmin * 2 - 0.02), body);
  const wheels: THREE.Group[] = [];
  const tyres = P.tyres || [S.tw, S.tw];
  for (const [x, tw] of [[S.wx, tyres[0]], [-S.wx, tyres[1]]]) for (const s of [-1, 1]) { const wg = wheel(def.wheelR, tw, rim, s, k === 'super' || k === 'hyper' || k === 'sport' || k === 'muscle', !!P.kit); wg.position.set(x, def.wheelR, s * (S.zs(x, S.cy + S.R * 0.9) - tw / 2 - 0.035)); root.add(wg); wheels.push(wg); }
  return { root, body, wheels, paint, glass, rim, lights: { head, tail, bar, blinkL, blinkR, rev }, door, eye: cab.eye, steering: cab.steering, sprung: true, damage: { soot, crack }, lod: { mesh: skin, near: Q.paint, far: Q.paintFar, isFar: false } };
}
