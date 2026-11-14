import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VDef } from './defs';
import type { CarModel } from './models';
import { shared, box, wheel } from './models';
import { labelTexture } from '../world/textures';

/* Model space: x = forward, y = up, z = lateral (driver side is -z). Root is rotated into the world by buildCarModel. */
type Inner = Omit<CarModel, 'tilt'>;
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)))!;
const ds = (c: string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, side: THREE.DoubleSide });
const glowM = (c: string) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, side: THREE.DoubleSide });
function lights() {
  return { head: new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: 0.3 }), tail: new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: new THREE.Color('#ff1a1a'), emissiveIntensity: 0.4 }) };
}
function steeringWheel(r: number, x: number, y: number, z: number, tilt: number, parent: THREE.Object3D) {
  const col = new THREE.Group(); col.position.set(x, y, z); col.rotation.z = tilt; col.userData.cabin = true; parent.add(col);
  const wheelG = new THREE.Group(); col.add(wheelG);
  const S = shared();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.13, 8, 28).rotateY(Math.PI / 2), ds('#141416', 0.5)); wheelG.add(rim);
  const spokes = new THREE.Mesh(merge([new THREE.BoxGeometry(0.02, r * 1.9, 0.03), new THREE.BoxGeometry(0.02, 0.03, r * 1.9).translate(0, -r * 0.2, 0)]), ds('#2a2a2e', 0.4, 0.4)); wheelG.add(spokes);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, 0.06, 16).rotateZ(Math.PI / 2), S.chrome); wheelG.add(hub);
  return wheelG;
}

/* ------------------------------------------------------------------ car cabins */
/** Seats, dashboard with glowing gauges, steering wheel, console, door cards and floor inside an extruded car body. */
export function addCabin(def: VDef, P: { lower: number[][]; glass: number[][]; roofY: number }, W: number, body: THREE.Group): { eye: THREE.Vector3; steering: THREE.Object3D } {
  const gx = P.glass.map((p) => p[0]), gx0 = Math.min(...gx), gx1 = Math.max(...gx), belt = Math.min(P.lower[4][1], P.lower[5][1]) - 0.02, floorY = 0.36;
  const sport = def.kind === 'super' || def.kind === 'hyper' || def.kind === 'sport' || def.kind === 'muscle';
  const leather = ds(def.kind === 'limo' || def.kind === 'sedan' ? '#c9b08a' : sport ? '#1c1c20' : def.kind === 'taxi' || def.kind === 'police' ? '#2a2c33' : '#3a3c44', 0.55);
  const stitch = ds(sport ? '#c0161c' : '#6a5a48', 0.5), dark = ds('#18191d', 0.7), trimM = ds('#2a2b30', 0.4, 0.3);
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.userData.cabin = true; body.add(mesh); return mesh; };
  const limo = def.kind === 'limo', sx = limo ? gx1 - 1.2 : Math.max(gx0 + 0.75, gx1 - 1.25), headTop = Math.min(belt + 0.36, P.roofY - 0.1);
  for (const z of [-W * 0.22, W * 0.22]) {
    add(box(0.56, 0.14, 0.5, sx, floorY + 0.22, z), leather);
    const back = new THREE.BoxGeometry(0.13, Math.max(0.3, headTop - floorY - 0.42), 0.5); back.translate(0, (headTop - floorY - 0.42) / 2, 0); back.rotateZ(0.2); back.translate(sx - 0.3, floorY + 0.3, z); add(back, leather);
    add(box(0.12, 0.18, 0.3, sx - 0.36 - (headTop - floorY) * 0.18, headTop - 0.08, z), leather);
    add(box(0.5, 0.02, 0.06, sx, floorY + 0.3, z), stitch);
  }
  if (!limo && gx0 < sx - 1.1) { add(box(0.5, 0.14, W * 0.74, gx0 + 0.5, floorY + 0.2, 0), leather); add(box(0.13, Math.max(0.3, headTop - floorY - 0.45), W * 0.74, gx0 + 0.22, floorY + 0.5, 0), leather); }
  if (limo) { // rear lounge: side bench, bar with glow strip, starry LED ceiling strip, partition
    add(box(gx1 - gx0 - 2.2, 0.16, 0.52, (gx0 + sx - 0.6) / 2, floorY + 0.2, W * 0.32), leather); add(box(gx1 - gx0 - 2.2, 0.42, 0.12, (gx0 + sx - 0.6) / 2, floorY + 0.5, W * 0.43), leather);
    add(box(0.55, 0.16, W * 0.7, gx0 + 0.45, floorY + 0.2, 0), leather);
    add(box(1.6, 0.55, 0.42, sx - 1.4, floorY + 0.28, -W * 0.3), ds('#3a2418', 0.3)); add(box(1.6, 0.03, 0.44, sx - 1.4, floorY + 0.56, -W * 0.3), glowM('#ff6ad5'));
    add(box(gx1 - gx0 - 1.6, 0.02, 0.06, (gx0 + sx) / 2 - 0.4, P.roofY - 0.06, 0), glowM('#7ab8ff'));
    add(box(0.06, belt - floorY + 0.25, W * 0.86, sx - 0.55, (belt + floorY) / 2 + 0.1, 0), dark);
  }
  add(box(0.44, 0.3, W * 0.86, gx1 - 0.25, belt - 0.07, 0), dark); // dashboard (it stops at the foot of the windscreen)
  add(box(0.2, 0.03, W * 0.6, gx1 - 0.38, belt + 0.075, 0), trimM); // dash trim
  const clu = new THREE.PlaneGeometry(0.34, 0.12).rotateY(-Math.PI / 2); clu.translate(gx1 - 0.43, belt + 0.03, W * 0.22); // right-hand drive add(clu, glowM(sport ? '#ff5a3a' : '#7ad8ff'));
  const scr = new THREE.PlaneGeometry(0.24, 0.15).rotateY(-Math.PI / 2); scr.translate(gx1 - 0.43, belt - 0.03, 0); add(scr, glowM('#9fd8ff'));
  add(box(1.0, 0.24, 0.24, sx + 0.12, floorY + 0.2, 0), dark); add(box(0.06, 0.12, 0.06, sx + 0.3, floorY + 0.38, 0), shared().chrome);
  for (const s of [-1, 1]) { add(box(gx1 - gx0 + 0.2, belt - floorY + 0.02, 0.05, (gx0 + gx1) / 2, (belt + floorY) / 2, s * (W / 2 - 0.12)), dark); add(box(gx1 - gx0, 0.05, 0.06, (gx0 + gx1) / 2, belt - 0.12, s * (W / 2 - 0.15)), leather); }
  add(box(gx1 - gx0 + 0.4, 0.04, W - 0.25, (gx0 + gx1) / 2, floorY, 0), dark);
  const steering = steeringWheel(0.18, gx1 - 0.58, belt + 0.0, W * 0.22, 0.42, body);
  return { eye: new THREE.Vector3(sx - 0.02, Math.min(belt + 0.27, P.roofY - 0.12), W * 0.22), steering };
}

/* ------------------------------------------------------------------ boats */
/** Lofted planing hull: flat transom, flared topsides, V bottom, raked bow. Returns topsides, bottom and deck geometries. */
function hull(L: number, W: number, H: number) {
  const n = 18, top: number[] = [], bot: number[] = [], deck: number[] = [];
  const st = (k: number) => { const x = -L / 2 + (k / n) * L, t = (x + L / 2) / L, bow = Math.max(0, (t - 0.55) / 0.45), hw = (W / 2) * Math.sqrt(Math.max(0, 1 - bow * bow)) * (0.92 + 0.08 * (1 - t)); const keel = Math.pow(bow, 1.6) * H * 0.75, sheer = H + bow * H * 0.25; return { x, hw, keel, sheer, chine: Math.max(keel, H * 0.3) }; };
  const tri = (a: number[], b: number[], c: number[], out: number[]) => out.push(...a, ...b, ...c);
  for (let k = 0; k < n; k++) {
    const A = st(k), B = st(k + 1);
    for (const s of [-1, 1]) {
      const a1 = [A.x, A.sheer, s * A.hw], a2 = [A.x, A.chine, s * A.hw * 0.86], a3 = [A.x, A.keel, 0], b1 = [B.x, B.sheer, s * B.hw], b2 = [B.x, B.chine, s * B.hw * 0.86], b3 = [B.x, B.keel, 0];
      if (s > 0) { tri(a1, a2, b2, top); tri(a1, b2, b1, top); tri(a2, a3, b3, bot); tri(a2, b3, b2, bot); tri(a1, b1, [B.x, B.sheer, 0], deck); tri(a1, [B.x, B.sheer, 0], [A.x, A.sheer, 0], deck); }
      else { tri(a1, b2, a2, top); tri(a1, b1, b2, top); tri(a2, b3, a3, bot); tri(a2, b2, b3, bot); tri(a1, [B.x, B.sheer, 0], b1, deck); tri(a1, [A.x, A.sheer, 0], [B.x, B.sheer, 0], deck); }
    }
  }
  const T = st(0); // transom
  for (const s of [-1, 1]) { const p = [[T.x, T.sheer, s * T.hw], [T.x, T.chine, s * T.hw * 0.86], [T.x, T.keel, 0], [T.x, T.sheer, 0]]; if (s > 0) { tri(p[0], p[3], p[1], top); tri(p[1], p[3], p[2], top); } else { tri(p[0], p[1], p[3], top); tri(p[1], p[2], p[3], top); } }
  const g = (a: number[]) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); geo.computeVertexNormals(); return geo; };
  return { top: g(top), bottom: g(bot), deck: g(deck) };
}
const teak = () => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d')!; c.fillStyle = '#a8784a'; c.fillRect(0, 0, 64, 256); for (let x = 0; x < 64; x += 8) { c.fillStyle = `rgb(${150 + Math.random() * 30},${100 + Math.random() * 20},${60})`; c.fillRect(x, 0, 7, 256); c.fillStyle = '#2a1a10'; c.fillRect(x + 7, 0, 1, 256); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 6); return t; };
let teakTex: THREE.Texture | null = null;

export function buildBoat(def: VDef, color: string): Inner {
  const S = shared(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#f6f6f4', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const anti = new THREE.MeshStandardMaterial({ color: '#1c2430', roughness: 0.6 });
  const deckM = new THREE.MeshStandardMaterial({ map: (teakTex ||= teak()), roughness: 0.7 });
  const glass = S.glass.clone(), cream = ds('#efe6d2', 0.7), rail = new THREE.MeshStandardMaterial({ color: '#d9dde4', metalness: 1, roughness: 0.15 });
  const L = def.len, W = def.wid, { head, tail } = lights();
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; body.add(mesh); return mesh; };
  const railLine = (x0: number, x1: number, z: number, y: number) => { add(new THREE.CylinderGeometry(0.025, 0.025, x1 - x0, 6).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z), rail, false); for (let x = x0; x <= x1 + 0.01; x += 1.4) add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6).translate(x, y - 0.3, z), rail, false); };
  let eye = new THREE.Vector3(0, 1.6, 0), steering: THREE.Object3D | undefined;
  if (def.kind === 'jetski') {
    const H = 0.55, h = hull(L, W, H); add(h.top, paint); add(h.bottom, anti); add(h.deck, white);
    add(box(1.15, 0.22, 0.44, -0.35, H + 0.12, 0), ds('#141416', 0.6)); add(box(0.7, 0.3, 0.7, 0.75, H + 0.12, 0), paint);
    add(box(0.1, 0.45, 0.1, 0.45, H + 0.45, 0), ds('#141416')); add(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 8).rotateX(Math.PI / 2).translate(0.42, H + 0.68, 0), rail);
    add(box(0.06, 0.25, 0.5, 0.95, H + 0.42, 0), glass, false); add(box(0.6, 0.08, 0.2, -0.3, H + 0.02, 0.45), anti); add(box(0.6, 0.08, 0.2, -0.3, H + 0.02, -0.45), anti);
    add(box(0.1, 0.06, 0.2, L / 2 - 0.25, H + 0.2, 0), head, false); add(box(0.05, 0.06, 0.2, -L / 2, H - 0.05, 0), tail, false);
    eye = new THREE.Vector3(-0.2, 1.75, 0);
  } else if (def.kind === 'speedboat') {
    const H = 1.35, h = hull(L, W, H); add(h.top, paint); add(h.bottom, anti); add(h.deck, deckM);
    add(box(L * 0.92, 0.12, 0.08, -0.1, H - 0.25, W / 2 - 0.02), white); add(box(L * 0.92, 0.12, 0.08, -0.1, H - 0.25, -W / 2 + 0.02), white); // rub rails
    add(box(0.9, 0.85, W * 0.62, 1.1, H + 0.42, 0), white); // console + windscreen base
    const ws = new THREE.BoxGeometry(0.05, 0.55, W * 0.78); ws.rotateZ(-0.6); ws.translate(1.5, H + 1.05, 0); add(ws, glass, false);
    add(box(0.3, 0.04, 0.5, 0.75, H + 0.86, -0.55), glowM('#7ad8ff')); add(box(0.3, 0.04, 0.4, 0.75, H + 0.86, 0.3), glowM('#9fffb0'));
    steering = steeringWheel(0.2, 0.62, H + 0.95, -0.55, 0.6, body);
    for (const z of [-0.55, 0.55]) { add(box(0.6, 0.3, 0.55, -0.1, H + 0.2, z), cream); add(box(0.15, 0.7, 0.55, -0.42, H + 0.5, z), cream); }
    add(box(0.6, 0.35, W * 0.8, -3.6, H + 0.15, 0), cream); add(box(2.4, 0.35, 0.5, -2.4, H + 0.15, W * 0.36), cream); add(box(2.4, 0.35, 0.5, -2.4, H + 0.15, -W * 0.36), cream); add(box(0.9, 0.06, 0.9, -2.3, H + 0.55, 0), ds('#5a3a24', 0.3)); add(box(0.08, 0.5, 0.08, -2.3, H + 0.27, 0), rail);
    add(box(2.2, 0.18, W * 0.55, 3.3, H + 0.18, 0), cream); // bow sun pad
    for (const z of [-0.55, 0.55]) { add(box(0.7, 1.3, 0.55, -L / 2 - 0.35, H - 0.2, z), ds('#141416', 0.35, 0.3)); add(box(0.25, 0.6, 0.2, -L / 2 - 0.55, H - 1.0, z), ds('#2a2a2e')); }
    add(box(0.9, 0.08, W * 0.8, -L / 2 - 0.1, 0.35, 0), deckM); // swim platform
    railLine(1.8, L / 2 - 0.6, W / 2 - 0.2, H + 0.6); railLine(1.8, L / 2 - 0.6, -W / 2 + 0.2, H + 0.6);
    add(box(0.12, 0.08, 0.3, L / 2 - 0.5, H + 0.1, 0), head, false); add(box(0.06, 0.08, 0.3, -L / 2, H - 0.1, 0), tail, false);
    eye = new THREE.Vector3(0.0, H + 1.25, -0.55);
  } else { // yacht
    const H = 2.6, h = hull(L, W, H), wht = white;
    add(h.top, wht); add(h.bottom, anti); add(h.deck, deckM);
    add(box(L * 0.82, 0.35, 0.06, -0.8, 1.1, W / 2 - 0.05), paint); add(box(L * 0.82, 0.35, 0.06, -0.8, 1.1, -W / 2 + 0.05), paint); // hull stripe
    const tint = S.glass.clone(); tint.opacity = 0.9; tint.color.set('#05080d');
    // main deck saloon
    add(box(14, 2.3, W - 1.4, 0.5, H + 1.15, 0), wht); add(box(12.6, 1.2, W - 1.3, 0.3, H + 1.3, 0), tint, false);
    // upper deck
    add(box(9, 2.1, W - 2.4, -0.5, H + 3.35, 0), wht); add(box(7.6, 1.0, W - 2.3, -0.5, H + 3.45, 0), tint, false);
    const wsU = new THREE.BoxGeometry(0.06, 1.3, W - 2.6); wsU.rotateZ(-0.5); wsU.translate(4.2, H + 3.5, 0); add(wsU, tint, false);
    // flybridge: helm, seats, radar arch, radome
    add(box(8, 0.12, W - 2.2, -0.8, H + 4.5, 0), deckM);
    add(box(1.0, 1.0, 1.6, 2.4, H + 5.0, -0.6), wht); add(box(0.4, 0.05, 1.2, 2.0, H + 5.52, -0.6), glowM('#7ad8ff'));
    steering = steeringWheel(0.24, 1.8, H + 5.35, -0.6, 0.55, body);
    for (const z of [-0.6, 0.6]) { add(box(0.6, 0.45, 0.6, 1.3, H + 4.8, z), cream); add(box(0.15, 0.7, 0.6, 1.0, H + 5.1, z), cream); }
    add(box(2.4, 0.45, 2.6, -3.0, H + 4.8, 0), cream); add(box(1.0, 0.06, 1.0, -1.6, H + 5.15, 0), ds('#5a3a24', 0.3));
    const arch = merge([box(0.35, 2.0, 0.35, -0.4, H + 5.6, W / 2 - 1.4), box(0.35, 2.0, 0.35, -0.4, H + 5.6, -W / 2 + 1.4), box(0.6, 0.3, W - 2.5, -0.4, H + 6.6, 0)]); add(arch, wht);
    add(new THREE.SphereGeometry(0.45, 16, 10).translate(-0.4, H + 7.05, 0), wht); add(box(1.6, 0.08, 0.14, -0.4, H + 6.95, 0), ds('#2a2a2e'));
    // aft deck lounge + table, bow sun pads, swim platform, railings, stern name, deck lights
    add(box(1.2, 0.45, W - 2.2, -9.0, H + 0.25, 0), cream); add(box(0.25, 0.8, W - 2.2, -9.5, H + 0.5, 0), cream); add(box(1.6, 0.06, 1.8, -7.4, H + 0.75, 0), ds('#5a3a24', 0.3)); add(box(0.12, 0.7, 0.12, -7.4, H + 0.38, 0), rail);
    add(box(3.5, 0.25, 3.2, 9.6, H + 0.3, 0), cream);
    add(box(1.6, 0.12, W * 0.85, -L / 2 - 0.5, 0.9, 0), deckM);
    railLine(-L / 2 + 0.8, L / 2 - 2.5, W / 2 - 0.25, H + 1.0); railLine(-L / 2 + 0.8, L / 2 - 2.5, -W / 2 + 0.25, H + 1.0); railLine(-4.4, 3.2, W / 2 - 1.15, H + 5.4); railLine(-4.4, 3.2, -W / 2 + 1.15, H + 5.4);
    const nm = new THREE.MeshBasicMaterial({ map: labelTexture('ORCA 88', '#c9a24a'), transparent: true, toneMapped: false, side: THREE.DoubleSide });
    add(new THREE.PlaneGeometry(3.2, 0.8).rotateY(-Math.PI / 2).translate(-L / 2 - 0.01, 2.0, 0), nm, false);
    add(box(18, 0.04, 0.04, -1, H + 0.02, W / 2 - 0.45), glowM('#7ab8ff'), false); add(box(18, 0.04, 0.04, -1, H + 0.02, -W / 2 + 0.45), glowM('#7ab8ff'), false);
    add(box(0.12, 0.1, 0.5, L / 2 - 1.5, H + 0.4, 0), head, false); add(box(0.06, 0.1, 0.5, -L / 2, H, 0), tail, false);
    eye = new THREE.Vector3(1.3, H + 5.75, -0.6);
  }
  return { root, body, wheels: [], paint, glass, lights: { head, tail }, eye, steering };
}

/* ------------------------------------------------------------------ fighter jet */
export function buildJet(def: VDef, color: string): Inner {
  const S = shared(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.45 }), darkM = new THREE.MeshStandardMaterial({ color: '#2a2e34', metalness: 0.6, roughness: 0.4 });
  const glass = S.glass.clone(); glass.color.set('#8a7a40'); glass.opacity = 0.55; glass.metalness = 1;
  const { head, tail } = lights(), Y = 2.0;
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; body.add(mesh); return mesh; };
  add(new THREE.CylinderGeometry(0.85, 0.75, 10, 18).rotateZ(Math.PI / 2).translate(-0.6, Y, 0), paint);
  add(new THREE.ConeGeometry(0.85, 3.6, 18).rotateZ(-Math.PI / 2).translate(6.2, Y, 0), paint);
  add(new THREE.ConeGeometry(0.16, 0.9, 10).rotateZ(-Math.PI / 2).translate(8.3, Y, 0), darkM);
  add(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(2.2, 0.62, 0.62).translate(3.2, Y + 0.55, 0), glass, false);
  const wing = (s: number) => { const sh = new THREE.Shape([new THREE.Vector2(1.6, 0.7), new THREE.Vector2(-3.4, 5.0), new THREE.Vector2(-4.6, 5.0), new THREE.Vector2(-4.9, 0.7)].map((p) => new THREE.Vector2(p.x, s * p.y))); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, Y - 0.1, 0); return g; };
  add(wing(1), paint); add(wing(-1), paint);
  for (const s of [-1, 1]) {
    const fin = new THREE.Shape([new THREE.Vector2(-3.6, 0), new THREE.Vector2(-6.2, 2.6), new THREE.Vector2(-7.0, 2.6), new THREE.Vector2(-6.6, 0)]); const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false }); fg.rotateX(-s * 0.32); fg.translate(0, Y + 0.4, s * 1.1); add(fg, paint);
    const st = new THREE.Shape([new THREE.Vector2(-5.2, 0.8), new THREE.Vector2(-6.6, 2.6), new THREE.Vector2(-7.2, 2.6), new THREE.Vector2(-7.2, 0.8)].map((p) => new THREE.Vector2(p.x, s * p.y))); const sg = new THREE.ExtrudeGeometry(st, { depth: 0.08, bevelEnabled: false }); sg.rotateX(Math.PI / 2); sg.translate(0, Y - 0.2, 0); add(sg, paint);
    add(box(2.6, 0.7, 0.55, 1.4, Y - 0.25, s * 1.05), darkM); // intakes
    add(new THREE.CylinderGeometry(0.5, 0.55, 1.2, 14).rotateZ(Math.PI / 2).translate(-6.2, Y, s * 0.42), darkM); // nozzles
    add(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8).rotateZ(Math.PI / 2).translate(-1.6, Y - 0.35, s * 3.4), new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.5 })); // missiles
    add(new THREE.ConeGeometry(0.09, 0.4, 8).rotateZ(-Math.PI / 2).translate(-0.1, Y - 0.35, s * 3.4), new THREE.MeshStandardMaterial({ color: '#c0392b' }));
  }
  const burner: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.2, 14, 1, true).rotateZ(Math.PI / 2).translate(-8.4, Y, s * 0.42), new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); body.add(b); burner.push(b); }
  // cockpit: ejection seat, instrument panel with two MFDs, HUD combiner glass
  add(box(0.6, 0.15, 0.55, 2.6, Y + 0.25, 0), ds('#2a2a2e')); add(box(0.15, 0.95, 0.55, 2.25, Y + 0.65, 0), ds('#2a2a2e')); add(box(0.6, 0.35, 1.0, 4.0, Y + 0.45, 0), ds('#141416'));
  for (const z of [-0.25, 0.25]) { const p = new THREE.PlaneGeometry(0.28, 0.24).rotateY(-Math.PI / 2); p.translate(3.68, Y + 0.5, z); add(p, glowM('#3dffb0'), false); }
  const hud = new THREE.PlaneGeometry(0.3, 0.26).rotateY(-Math.PI / 2); hud.rotateZ(0.2); hud.translate(3.85, Y + 0.85, 0); add(hud, new THREE.MeshBasicMaterial({ color: '#3dffb0', transparent: true, opacity: 0.25, toneMapped: false, side: THREE.DoubleSide }), false);
  // landing gear (shown on the ground)
  const gear = new THREE.Group(); root.add(gear); const wheels: THREE.Group[] = [];
  for (const [x, z] of [[5.0, 0], [-1.6, 1.4], [-1.6, -1.4]]) { const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, Y - 0.4, 8).translate(x, (Y - 0.4) / 2 + 0.3, z), rootMat()); gear.add(strut); const wg = wheel(0.38, 0.22); wg.position.set(x, 0.38, z); gear.add(wg); wheels.push(wg); }
  add(box(0.1, 0.08, 0.1, 0.0, Y - 0.15, 5.0), new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false }), false); add(box(0.1, 0.08, 0.1, 0.0, Y - 0.15, -5.0), new THREE.MeshBasicMaterial({ color: '#2aff6a', toneMapped: false }), false);
  add(box(0.1, 0.1, 0.2, 7.0, Y - 0.6, 0), head, false); add(box(0.1, 0.1, 0.2, -7.0, Y + 2.9, 0), tail, false);
  return { root, body, wheels, paint, glass, lights: { head, tail }, eye: new THREE.Vector3(2.8, Y + 1.0, 0), burner, gear };
}
const rootMat = () => new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.8, roughness: 0.3 });

/* ------------------------------------------------------------------ formula car */
export function buildFormula(def: VDef, color: string): Inner {
  const S = shared(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.4, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }), carbon = new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.35, metalness: 0.3 });
  const { head, tail } = lights(), L = def.len / 2;
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; body.add(mesh); return mesh; };
  const nose = new THREE.Shape([new THREE.Vector2(-1.6, 0.12), new THREE.Vector2(L, 0.12), new THREE.Vector2(L, 0.28), new THREE.Vector2(0.6, 0.62), new THREE.Vector2(-0.2, 0.7), new THREE.Vector2(-1.6, 0.78)]);
  const ng = new THREE.ExtrudeGeometry(nose, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }); ng.translate(0, 0, -0.25); add(ng, paint);
  add(box(2.2, 0.45, 1.5, -1.0, 0.4, 0), paint); add(box(1.4, 0.55, 0.45, -1.2, 0.95, 0), paint); // sidepods + airbox
  add(box(0.5, 0.05, 1.9, L - 0.2, 0.12, 0), carbon); add(box(0.6, 0.25, 0.04, L - 0.2, 0.22, 0.95), carbon); add(box(0.6, 0.25, 0.04, L - 0.2, 0.22, -0.95), carbon); // front wing
  add(box(0.5, 0.05, 1.05, -L + 0.25, 0.98, 0), carbon); add(box(0.45, 0.04, 1.05, -L + 0.3, 0.86, 0), paint); add(box(0.5, 0.65, 0.04, -L + 0.25, 0.68, 0.53), carbon); add(box(0.5, 0.65, 0.04, -L + 0.25, 0.68, -0.53), carbon);
  add(new THREE.TorusGeometry(0.32, 0.035, 8, 20, Math.PI).rotateY(Math.PI / 2).translate(-0.1, 0.78, 0), S.chrome); // halo
  add(box(0.8, 0.1, 0.4, -0.35, 0.52, 0), ds('#0b0b0d')); // cockpit
  const steering = steeringWheel(0.12, 0.08, 0.72, 0, 0.9, body);
  const wheels: THREE.Group[] = [];
  for (const x of [def.wheelbase / 2, -def.wheelbase / 2]) for (const s of [-1, 1]) { const wg = wheel(def.wheelR, 0.38, undefined, s, true); wg.position.set(x, def.wheelR, s * 0.85); root.add(wg); wheels.push(wg); add(box(0.6, 0.04, 0.06, x, def.wheelR, s * 0.45), carbon); }
  add(box(0.06, 0.08, 0.3, -L - 0.02, 0.5, 0), tail, false); add(box(0.04, 0.04, 0.2, L, 0.25, 0), head, false);
  return { root, body, wheels, paint, lights: { head, tail }, eye: new THREE.Vector3(-0.2, 1.0, 0), steering };
}

/** Bullet train: eight cars, a long duck-bill nose at both ends, white body with a blue stripe, a dark window band, pantographs.
 *  Model x is forward; the lead car is centred on the origin and the rest of the train trails behind it (-x). */
export const SHIN_CARS = 8, SHIN_CAR = 25.6;
export function buildShinkansen(_def: VDef, _color: string): Inner {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const white = new THREE.MeshPhysicalMaterial({ color: '#f5f6f8', metalness: 0.25, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const blue = ds('#1e4fae', 0.35, 0.2), dark = ds('#1a2230', 0.15, 0.4), grey = ds('#8a9098', 0.6, 0.3), under = ds('#3a3e44', 0.8, 0.2);
  const { head, tail } = lights();
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; body.add(mesh); return mesh; };
  const W = 3.36, H = 3.6, Lc = 25;
  const sides: THREE.BufferGeometry[] = [], blues: THREE.BufferGeometry[] = [], wins: THREE.BufferGeometry[] = [], unders: THREE.BufferGeometry[] = [], greys: THREE.BufferGeometry[] = [];
  for (let k = 0; k < SHIN_CARS; k++) {
    const cx = -k * SHIN_CAR, first = k === 0, last = k === SHIN_CARS - 1;
    const x0 = cx - Lc / 2 + (last ? 6 : 0), x1 = cx + Lc / 2 - (first ? 6 : 0);
    const b = new THREE.BoxGeometry(x1 - x0, H - 0.75, W); b.translate((x0 + x1) / 2, 0.75 + (H - 0.75) / 2, 0); sides.push(b);
    const rf = new THREE.CylinderGeometry(W / 2, W / 2, x1 - x0, 14, 1, false, 0, Math.PI); rf.rotateZ(Math.PI / 2); rf.rotateX(-Math.PI / 2); rf.scale(1, 0.32, 1); rf.translate((x0 + x1) / 2, H, 0); sides.push(rf);
    for (const s of [-1, 1]) { const st = new THREE.BoxGeometry(x1 - x0, 0.32, 0.04); st.translate((x0 + x1) / 2, 1.55, s * (W / 2 + 0.01)); blues.push(st); const wn = new THREE.BoxGeometry(x1 - x0 - 1.4, 0.62, 0.04); wn.translate((x0 + x1) / 2, 2.35, s * (W / 2 + 0.012)); wins.push(wn); }
    const sk = new THREE.BoxGeometry(x1 - x0, 0.75, W - 0.4); sk.translate((x0 + x1) / 2, 0.37, 0); unders.push(sk);
    if (k === 2 || k === 5) { const pg = new THREE.BoxGeometry(2.2, 0.5, 0.9); pg.translate(cx, H + 0.75, 0); greys.push(pg); const arm = new THREE.BoxGeometry(0.1, 0.1, 2.2); arm.translate(cx, H + 1.2, 0); greys.push(arm); }
    if (!last) { const gw = new THREE.BoxGeometry(0.6, H - 0.9, W - 0.6); gw.translate(cx - SHIN_CAR / 2, 0.9 + (H - 0.9) / 2, 0); unders.push(gw); }
  }
  // the noses: half ellipsoids stretched along the track (lead car forward, tail car backward)
  for (const [x, dir] of [[Lc / 2 - 6, 1], [-(SHIN_CARS - 1) * SHIN_CAR - Lc / 2 + 6, -1]] as [number, number][]) {
    const n = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); n.rotateZ(-Math.PI / 2 * dir); n.scale(9.5, 1.55, 1.7); n.translate(x, 2.0, 0); sides.push(n);
    const sk = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2); sk.rotateZ(-Math.PI / 2 * dir); sk.scale(8, 0.75, 1.62); sk.translate(x, 0.75, 0); unders.push(sk);
    const cw = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); cw.scale(2.6, 0.7, 1.15); cw.translate(x + dir * 1.6, 3.05, 0); wins.push(cw);
    for (const s of [-1, 1]) { const st = new THREE.BoxGeometry(5.5, 0.28, 0.04); st.rotateY(-dir * s * 0.17); st.translate(x + dir * 2.6, 1.55, s * 1.42); blues.push(st); }
    const hl = new THREE.BoxGeometry(0.5, 0.18, 2.1); hl.translate(x + dir * 6.9, 1.4, 0); add(hl, dir > 0 ? head : tail, false);
  }
  add(merge(sides), white); add(merge(blues), blue, false); add(merge(wins), dark, false); add(merge(unders), under); if (greys.length) add(merge(greys), grey);
  const steering = new THREE.Object3D(); steering.position.set(Lc / 2 - 4, 2.2, 0.6); body.add(steering);
  return { root, body, wheels: [], paint: white, lights: { head, tail }, eye: new THREE.Vector3(Lc / 2 - 2.8, 3.2, 0.5), steering };
}
