import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VDef, VKind, Mods } from './defs';
import { getTextures } from '../world/textures';
import { buildBoat, buildJet, buildFormula, buildShinkansen } from './models2';
import { buildShaped } from './shaped';
import { isBoat } from './defs';
import { labelTexture } from '../world/textures';

/** Side profiles (x = forward, y = up). lower = painted body up to the belt line, glass = greenhouse. */
export const PROF: Partial<Record<VKind, { lower: number[][]; glass: number[][]; roofY: number }>> = {
  sedan: { lower: [[-2.35, 0.32], [2.35, 0.32], [2.38, 0.62], [2.2, 0.86], [1.15, 0.98], [-1.6, 0.98], [-2.3, 0.94], [-2.4, 0.6]], glass: [[-1.55, 0.97], [1.1, 0.97], [0.55, 1.4], [-1.05, 1.42]], roofY: 1.42 },
  sport: { lower: [[-2.22, 0.3], [2.25, 0.3], [2.3, 0.52], [2.1, 0.7], [1.0, 0.86], [-1.5, 0.88], [-2.2, 0.84], [-2.28, 0.55]], glass: [[-1.35, 0.87], [0.95, 0.86], [0.35, 1.22], [-0.8, 1.24]], roofY: 1.24 },
  super: { lower: [[-2.28, 0.28], [2.32, 0.28], [2.38, 0.45], [2.25, 0.56], [0.9, 0.82], [-1.7, 0.92], [-2.3, 0.9], [-2.33, 0.5]], glass: [[-1.1, 0.88], [0.85, 0.83], [0.15, 1.1], [-0.6, 1.12]], roofY: 1.12 },
  hyper: { lower: [[-2.35, 0.26], [2.42, 0.26], [2.5, 0.36], [2.3, 0.46], [0.75, 0.76], [-1.45, 0.88], [-2.35, 0.84], [-2.4, 0.42]], glass: [[-0.95, 0.82], [0.7, 0.75], [0.0, 1.03], [-0.6, 1.06]], roofY: 1.06 },
  muscle: { lower: [[-2.45, 0.34], [2.45, 0.34], [2.5, 0.66], [2.38, 0.86], [0.85, 0.92], [-1.4, 0.94], [-2.38, 0.9], [-2.5, 0.62]], glass: [[-1.35, 0.93], [0.8, 0.91], [0.2, 1.28], [-0.95, 1.3]], roofY: 1.3 },
  hatch: { lower: [[-1.85, 0.32], [1.9, 0.32], [1.95, 0.62], [1.75, 0.85], [0.85, 0.95], [-1.82, 1.0], [-1.9, 0.6]], glass: [[-1.75, 0.98], [0.8, 0.94], [0.2, 1.45], [-1.68, 1.47]], roofY: 1.47 },
  pickup: { lower: [[-2.62, 0.45], [2.62, 0.45], [2.64, 0.85], [2.48, 1.1], [1.3, 1.18], [-2.6, 1.12], [-2.64, 0.8]], glass: [[-0.35, 1.16], [1.25, 1.16], [0.8, 1.75], [-0.3, 1.77]], roofY: 1.77 },
  limo: { lower: [[-3.75, 0.32], [3.75, 0.32], [3.78, 0.62], [3.6, 0.86], [2.4, 0.98], [-3.0, 0.98], [-3.7, 0.94], [-3.8, 0.6]], glass: [[-2.95, 0.97], [2.35, 0.97], [1.8, 1.42], [-2.45, 1.44]], roofY: 1.44 },
  suv: { lower: [[-2.42, 0.45], [2.42, 0.45], [2.45, 0.85], [2.3, 1.1], [1.35, 1.2], [-2.35, 1.2], [-2.45, 0.85]], glass: [[-2.3, 1.18], [1.3, 1.18], [0.85, 1.78], [-2.25, 1.8]], roofY: 1.8 },
};

export interface CarModel { cabin?: THREE.Object3D[]; small?: THREE.Object3D[]; root: THREE.Group; tilt: THREE.Group; body: THREE.Group; wheels: THREE.Group[]; paint: THREE.MeshStandardMaterial; glass?: THREE.MeshStandardMaterial; rim?: THREE.MeshStandardMaterial; neon?: THREE.Mesh; rotors?: { main: THREE.Group; tail: THREE.Group }; modKey?: string; eye?: THREE.Vector3; steering?: THREE.Object3D; burner?: THREE.Mesh[]; gear?: THREE.Group; lights: { head: THREE.MeshStandardMaterial; tail: THREE.MeshStandardMaterial; bar?: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]; blinkL?: THREE.MeshStandardMaterial; blinkR?: THREE.MeshStandardMaterial; rev?: THREE.MeshStandardMaterial }; door?: THREE.Group; /** the body leans and dives on its springs while the wheels stay on the road */ sprung?: boolean; /** the springs' state: roll, dive and heave of the body, and their rates */ sus?: { r: number; rv: number; q: number; qv: number; h: number; hv: number; y: number; gv: number }; /** shown as the car is wrecked */ damage?: { soot: THREE.Mesh; crack: THREE.Mesh } }

export const shared = (() => {
  let s: any = null;
  return () => (s ||= {
    glass: new THREE.MeshStandardMaterial({ color: '#0d141f', metalness: 0.9, roughness: 0.06, envMapIntensity: 2, transparent: true, opacity: 0.62 }),
    trim: new THREE.MeshStandardMaterial({ color: '#141418', metalness: 0.3, roughness: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d9dde4', metalness: 1, roughness: 0.15 }),
    tire: new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.92 }),
    brake: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.45 }),
  });
})();

export function box(w: number, h: number, d: number, x: number, y: number, z: number) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }

const WHEELS = new Map<string, { tire: THREE.BufferGeometry; rim: THREE.BufferGeometry; brake: THREE.BufferGeometry }>();
const tinted = (g: THREE.BufferGeometry, c: string) => { const q = g.index ? g.toNonIndexed() : g, col = new THREE.Color(c), n = q.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } q.setAttribute('color', new THREE.BufferAttribute(a, 3)); return q; };
/**
 * A wheel: a tyre with rounded shoulders, an alloy rim (a dished barrel, spokes, a hub), and behind the spokes a brake
 * disc with its caliper, which does not turn. side: 1 for the car's right, -1 for its left (the outer face is mirrored).
 * The returned group is turned to steer; its userData.spin is the part that rolls.
 */
export function wheel(r: number, w: number, rimMat?: THREE.Material, side = 1, sporty = false) {
  const g = new THREE.Group(), S = shared(); g.rotation.order = 'YXZ';
  const inner = new THREE.Group(); inner.scale.z = side < 0 ? -1 : 1; g.add(inner);
  const spin = new THREE.Group(); inner.add(spin); g.userData.spin = spin;
  const key = r + '|' + w + '|' + sporty; let G = WHEELS.get(key);
  if (!G) {
    const thin = w < 0.2, zf = thin ? 0 : w / 2 - 0.045, V = (a: number, b: number) => new THREE.Vector2(a * r, b * w);
    const tire = new THREE.LatheGeometry([V(0.64, -0.5), V(0.9, -0.5), V(0.975, -0.42), V(1, -0.26), V(1, 0.26), V(0.975, 0.42), V(0.9, 0.5), V(0.64, 0.5)], 16).rotateX(Math.PI / 2);
    const rim: THREE.BufferGeometry[] = [];
    rim.push(thin ? new THREE.CylinderGeometry(0.645 * r, 0.645 * r, w * 0.9, 16, 1, true).rotateX(Math.PI / 2) : new THREE.LatheGeometry([V(0.645, 0.5), V(0.61, 0.42), V(0.6, -0.1)], 16).rotateX(Math.PI / 2));
    rim.push(new THREE.TorusGeometry(0.645 * r, 0.011, 3, 16).translate(0, 0, w / 2 - 0.004));
    const n = sporty ? 10 : 5, sw = sporty ? 0.07 : 0.2;
    for (let k = 0; k < n; k++) rim.push(new THREE.BoxGeometry(0.5 * r, sw * r, 0.03).translate(0.37 * r, 0, 0).rotateZ((k / n) * Math.PI * 2 + (sporty && k % 2 ? 0.16 : 0)).translate(0, 0, zf));
    rim.push(new THREE.CylinderGeometry(0.17 * r, 0.2 * r, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0, zf + 0.012));
    if (thin) rim.push(new THREE.CylinderGeometry(0.17 * r, 0.2 * r, 0.05, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.012));
    const zb = thin ? 0.035 : w / 2 - 0.115, brake = [tinted(new THREE.CylinderGeometry(0.5 * r, 0.5 * r, 0.022, 14).rotateX(Math.PI / 2).translate(0, 0, zb), '#8b8f96'), tinted(new THREE.BoxGeometry(0.2 * r, 0.44 * r, 0.075).translate(0.42 * r, 0, zb).rotateZ(0.5), sporty ? '#d1121c' : '#3b3d42')];
    if (!thin) brake.push(tinted(new THREE.CircleGeometry(0.6 * r, 14).translate(0, 0, -w * 0.1 + 0.004), '#0c0c0e'));
    G = { tire, rim: mergeGeometries(rim.map((q) => (q.index ? q.toNonIndexed() : q)))!, brake: mergeGeometries(brake)! };
    for (const q of Object.values(G)) q.userData.keep = true;
    WHEELS.set(key, G);
  }
  const tire = new THREE.Mesh(G.tire, S.tire); tire.castShadow = true; spin.add(tire, new THREE.Mesh(G.rim, rimMat || S.chrome));
  const brake = new THREE.Mesh(G.brake, S.brake); brake.userData.small = true; inner.add(brake);
  return g;
}

export function buildCarModel(def: VDef, color: string): CarModel {
  const m = def.kind === 'heli' ? buildHeli(def, color) : isBoat(def.kind) ? buildBoat(def, color) : def.kind === 'jet' ? buildJet(def, color) : def.kind === 'formula' ? buildFormula(def, color) : def.kind === 'shinkansen' ? buildShinkansen(def, color) : buildInner(def, color), outer = new THREE.Group(), tilt = new THREE.Group();
  m.root.rotation.y = -Math.PI / 2; tilt.add(m.root); outer.add(tilt);
  // neon underglow: an additive glow card under the car, shown when the Bay Customs neon kit is fitted
  if (def.kind !== 'heli' && def.kind !== 'jet' && def.kind !== 'shinkansen' && !isBoat(def.kind)) {
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(def.len * 1.25, def.wid * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: getTextures().glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.95 }));
    neon.position.y = 0.06; neon.visible = false; m.root.add(neon); m.neon = neon;
  }
  // the interior (seats, dashboard, wheel) is only drawn close up: collect it so the view can switch it off at a distance
  const cabin: THREE.Object3D[] = [], small: THREE.Object3D[] = []; outer.traverse((o) => { if (o.userData.cabin) cabin.push(o); else if (o.userData.small) small.push(o); });
  return { ...m, root: outer, tilt, cabin, small };
}

/** Apply Bay Customs visuals: paint finish, neon colour, wheel colour, window tint. */
export function applyMods(m: CarModel, mods: Mods | undefined) {
  const f = mods?.finish || 'gloss', P = m.paint;
  const base = f === 'matte' ? [0.1, 0.82, 0.4] : f === 'chrome' ? [1, 0.05, 2.0] : f === 'pearl' ? [0.7, 0.22, 1.5] : [0.5, 0.32, 1.2];
  P.userData.metal = base[0]; P.userData.rough = base[1]; P.envMapIntensity = base[2];
  if ((P as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) (P as THREE.MeshPhysicalMaterial).clearcoat = f === 'matte' || f === 'chrome' ? 0 : 1;
  P.emissive.set(f === 'pearl' ? P.color : '#000000'); P.emissiveIntensity = f === 'pearl' ? 0.08 : 0;
  if (m.neon) { m.neon.visible = !!mods?.neon; if (mods?.neon) (m.neon.material as THREE.MeshBasicMaterial).color.set(mods.neon).multiplyScalar(2.4); }
  if (m.rim) m.rim.color.set(mods?.wheel || '#d9dde4');
  if (m.glass) { m.glass.opacity = mods?.tint ? 0.95 : m.sprung ? 0.8 : 0.62; m.glass.color.set(mods?.tint ? '#030406' : m.sprung ? '#16202c' : '#0d141f'); }
}
function buildHeli(def: VDef, color: string): Omit<CarModel, 'tilt'> {
  const S = shared(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.3, envMapIntensity: 1.2, clearcoat: 1, clearcoatRoughness: 0.06 }), glass = S.glass.clone();
  const head = new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: new THREE.Color('#ff1a1a'), emissiveIntensity: 0.4 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = shadow; body.add(mesh); return mesh; };
  add(new THREE.SphereGeometry(1, 18, 12).scale(2.1, 1.1, 1.1).translate(0.3, 1.45, 0), paint);
  add(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.35, 0.95, 1.0).rotateZ(-0.5).translate(1.25, 1.55, 0), glass);
  add(new THREE.CylinderGeometry(0.2, 0.42, 5.4, 10).rotateZ(Math.PI / 2).translate(-3.3, 1.75, 0), paint);
  add(box(0.95, 1.25, 0.08, -5.75, 2.35, 0), paint); add(box(0.55, 0.06, 1.7, -5.4, 1.8, 0), paint);
  for (const z of [-0.85, 0.85]) { add(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8).rotateZ(Math.PI / 2).translate(0.3, 0.1, z), S.trim); for (const x of [-0.6, 1.1]) add(box(0.08, 0.55, 0.08, x, 0.38, z * 0.92), S.trim); }
  add(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8).translate(0.35, 2.7, 0), S.trim);
  add(box(0.18, 0.1, 0.3, 2.2, 1.0, 0), head, false); add(box(0.12, 0.12, 0.12, -6.15, 2.95, 0), tail, false);
  const main = new THREE.Group(); main.position.set(0.35, 2.98, 0); root.add(main);
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.04, 0.3).rotateY(r), S.trim); b.castShadow = true; main.add(b); }
  const tailR = new THREE.Group(); tailR.position.set(-5.85, 2.35, 0.14); root.add(tailR);
  for (const r of [0, Math.PI / 2]) tailR.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.04).rotateZ(r), S.trim));
  return { root, body, wheels: [], paint, glass, lights: { head, tail }, rotors: { main, tail: tailR } };
}

function buildInner(def: VDef, color: string): Omit<CarModel, 'tilt'> {
  const S = shared(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const glass = S.glass.clone(), rim = S.chrome.clone();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.32, envMapIntensity: 1.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const head = new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: new THREE.Color('#ff1a1a'), emissiveIntensity: 0.4 });
  const L = def.len / 2, W = def.wid, wheels: THREE.Group[] = [];
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = shadow; mesh.receiveShadow = true; body.add(mesh); return mesh; };
  if (def.kind === 'bike') {
    add(mergeGeometries([box(0.9, 0.35, 0.32, 0.15, 0.62, 0), box(0.55, 0.25, 0.28, -0.35, 0.8, 0), box(0.5, 0.12, 0.3, -0.25, 0.95, 0)].map((g) => g.toNonIndexed()))!, paint);
    add(mergeGeometries([box(0.08, 0.6, 0.06, 0.62, 0.7, 0.08), box(0.08, 0.6, 0.06, 0.62, 0.7, -0.08), box(0.08, 0.06, 0.7, 0.55, 1.02, 0), box(0.7, 0.08, 0.06, -0.4, 0.45, 0.1)].map((g) => g.toNonIndexed()))!, S.chrome);
    add(box(0.16, 0.12, 0.2, 0.78, 0.9, 0), head, false); add(box(0.06, 0.08, 0.16, -0.75, 0.82, 0), tail, false);
    for (const x of [0.71, -0.71]) { const wg = wheel(def.wheelR, 0.16, rim); wg.position.set(x, def.wheelR, 0); root.add(wg); wheels.push(wg); }
    return { root, body, wheels, paint, glass, rim, lights: { head, tail } };
  }
  if (def.kind === 'truck' || def.kind === 'armored') {
    const cabL = 1.9, cx = L - cabL / 2, arm = def.kind === 'armored';
    add(mergeGeometries([box(cabL, 1.5, W, cx, 1.35, 0), box(cabL * 0.9, 0.9, W * 0.96, cx - 0.05, 2.45, 0)].map((g) => g.toNonIndexed()))!, paint);
    add(box(0.05, 0.75, W * 0.86, L + 0.01, 2.4, 0), glass, false);
    for (const s of [-1, 1]) add(box(1.0, 0.65, 0.04, cx - 0.1, 2.42, s * W * 0.485), glass, false);
    add(box(def.len - cabL - 0.15, 2.6, W * 1.02, -cabL / 2 - 0.05, 1.95, 0), arm ? paint : new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.7 }));
    if (arm) { // armored cash truck: livery panels on both sides + rear doors
      const lab = new THREE.MeshBasicMaterial({ map: labelTexture('BAY CASH $', '#3dffb0'), toneMapped: false });
      for (const s of [-1, 1]) { const m = add(new THREE.PlaneGeometry(3.2, 0.8).rotateY(s > 0 ? 0 : Math.PI).translate(-cabL / 2 - 0.05, 2.3, s * (W * 0.51 + 0.01)), lab, false); m.receiveShadow = false; }
      add(box(0.06, 2.2, W * 0.46, -L + 0.06, 1.85, W * 0.24), S.trim); add(box(0.06, 2.2, W * 0.46, -L + 0.06, 1.85, -W * 0.24), S.trim);
      add(box(0.1, 0.12, W * 0.9, -L + 0.04, 1.85, 0), S.chrome, false);
    }
    add(box(def.len, 0.35, W * 0.9, 0, 0.6, 0), S.trim);
    add(box(0.12, 0.3, 0.4, L + 0.02, 1.0, W * 0.32), head, false); add(box(0.12, 0.3, 0.4, L + 0.02, 1.0, -W * 0.32), head, false);
    add(box(0.06, 0.25, 0.3, -L - 0.02, 0.9, W * 0.38), tail, false); add(box(0.06, 0.25, 0.3, -L - 0.02, 0.9, -W * 0.38), tail, false);
    for (const x of [L - 1.0, -L + 1.3, -L + 2.3]) for (const s of [-1, 1]) { const wg = wheel(def.wheelR, 0.36, rim, s); wg.position.set(x, def.wheelR, s * (W / 2 - 0.12)); root.add(wg); wheels.push(wg); }
    return { root, body, wheels, paint, glass, rim, lights: { head, tail } };
  }
  return buildShaped(def, color, PROF[def.kind === 'police' || def.kind === 'taxi' ? 'sedan' : def.kind]!);
}

/** Vehicle-local point (model space: x forward, y up, z right-of-driver) -> world, matching VehicleView's transforms. */
const _o = new THREE.Object3D(), _t = new THREE.Object3D(), _i = new THREE.Object3D(); _o.add(_t); _t.add(_i); _i.rotation.y = -Math.PI / 2;
export function vehicleToWorld(v: { x: number; y: number; z: number; yaw: number; pitch: number; squat: number; roll: number; lean: number; def: VDef }, local: THREE.Vector3, out: THREE.Vector3, fwd?: THREE.Vector3, up?: THREE.Vector3) {
  _o.position.set(v.x, v.y, v.z); _o.rotation.set(0, v.yaw, 0); _t.rotation.set(-v.pitch - v.squat, 0, v.def.kind === 'bike' ? v.lean : v.roll); _o.updateMatrixWorld(true);
  out.copy(local); _i.localToWorld(out);
  if (fwd) fwd.set(1, 0, 0).transformDirection(_i.matrixWorld);
  if (up) up.set(0, 1, 0).transformDirection(_i.matrixWorld);
}

/** Free a car model's own geometries and materials (the shared glass / trim / chrome / tyre materials and textures stay). */
export function disposeCarModel(m: CarModel) {
  const keep = new Set<THREE.Material>(Object.values(shared()) as THREE.Material[]);
  m.root.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    if (!mesh.geometry?.userData.keep) mesh.geometry?.dispose(); // model geometry is shared by every car of that kind
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (mat && !keep.has(mat)) mat.dispose();
  });
}
