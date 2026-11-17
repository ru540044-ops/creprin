import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VDef, VKind, Mods } from './defs';
import { getTextures } from '../world/textures';
import { buildBoat, buildJet, buildFormula, buildShinkansen } from './models2';
import { buildShaped } from './shaped';
import type { Prof } from './body';
import { isBoat } from './defs';
import { labelTexture } from '../world/textures';

/** Side profiles (x = forward, y = up). lower = painted body up to the belt line, glass = greenhouse. */
export const PROF: Partial<Record<VKind, Prof>> = {
  // a three-box saloon: the bonnet falls to a low nose, the wings stand a little above it, the cabin leans in, a short high boot
  sedan: {
    lower: [[-2.3, 0.3], [-1.9, 0.19], [1.9, 0.19], [2.3, 0.26], [2.35, 0.42], [2.32, 0.62], [2.1, 0.74], [1.2, 0.9], [0.9, 0.93], [-1.4, 0.96], [-1.75, 0.97], [-2.25, 0.95], [-2.36, 0.86], [-2.37, 0.5]],
    glass: [[-1.75, 0.955], [1.25, 0.9], [0.45, 1.38], [-0.3, 1.44], [-1.0, 1.41]], roofY: 1.44,
    plan: [[-2.35, 0.9], [-1.4, 0.99], [0, 1.0], [1.4, 0.985], [2.0, 0.93], [2.35, 0.86]], corner: 0.38,
    shoulder: [[-2.35, 0.9], [-1.375, 0.99], [0.9, 0.955], [1.375, 0.93], [2.0, 0.8], [2.32, 0.64]],
    gw: [[-1.75, 0.86], [-0.5, 0.93], [0.6, 0.92], [1.25, 0.86]], tumble: 0.16, quarter: 0.32, tuck: 0.045, lean: 0.012, flare: 0.02, rt: 0.07, gap: 0.06, lip: 0.06, nose: 0.66, tailY: 0.78, tyres: [0.225, 0.225],
  },
  // a long-bonnet fastback coupé with square corners and wide hips
  muscle: {
    lower: [[-2.42, 0.32], [-2.0, 0.2], [2.0, 0.2], [2.42, 0.27], [2.48, 0.45], [2.47, 0.7], [2.3, 0.8], [0.9, 0.88], [0.6, 0.9], [-1.3, 0.92], [-2.2, 0.9], [-2.46, 0.82], [-2.5, 0.74], [-2.49, 0.48]],
    glass: [[-1.9, 0.905], [0.75, 0.89], [0.15, 1.26], [-0.4, 1.3], [-0.9, 1.27]], roofY: 1.3,
    plan: [[-2.47, 0.93], [-1.45, 1.0], [-0.3, 0.95], [0.6, 0.95], [1.45, 0.99], [2.1, 0.96], [2.47, 0.92]], corner: 0.25,
    shoulder: [[-2.47, 0.86], [-2.0, 0.95], [-1.45, 0.99], [-0.6, 0.93], [0.6, 0.91], [1.45, 0.93], [2.2, 0.86], [2.47, 0.72]],
    gw: [[-1.9, 0.74], [-0.9, 0.86], [0, 0.88], [0.75, 0.86]], tumble: 0.2, quarter: 0.6, cab: [-0.95, 0.75], tuck: 0.045, lean: 0.015, flare: 0.03, rt: 0.06, gap: 0.055, lip: 0.055, nose: 0.6, tailY: 0.72, tyres: [0.245, 0.29],
  },
  // a small upright hatchback
  hatch: {
    lower: [[-1.85, 0.32], [-1.55, 0.2], [1.55, 0.2], [1.86, 0.28], [1.91, 0.45], [1.88, 0.68], [1.7, 0.8], [1.0, 0.9], [0.85, 0.92], [-1.75, 0.95], [-1.9, 0.88], [-1.92, 0.5]],
    glass: [[-1.82, 0.94], [1.0, 0.9], [0.35, 1.42], [-0.2, 1.49], [-1.45, 1.47], [-1.78, 1.36]], roofY: 1.49,
    plan: [[-1.9, 0.92], [-1.2, 1.0], [0, 1.0], [1.2, 0.985], [1.6, 0.94], [1.9, 0.88]], corner: 0.32,
    shoulder: [[-1.9, 0.93], [-1.225, 0.99], [0, 0.95], [0.85, 0.94], [1.225, 0.95], [1.6, 0.86], [1.88, 0.7]],
    gw: [[-1.82, 0.88], [0, 0.93], [1.0, 0.87]], tumble: 0.14, quarter: 0.22, tuck: 0.045, lean: 0.012, flare: 0.02, rt: 0.07, gap: 0.06, lip: 0.06, nose: 0.7, tailY: 0.86, tyres: [0.2, 0.2],
  },
  // a pickup: a tall cab, a long covered bed
  pickup: {
    lower: [[-2.6, 0.48], [-2.2, 0.34], [2.2, 0.34], [2.58, 0.44], [2.65, 0.62], [2.63, 0.98], [2.45, 1.08], [1.45, 1.14], [1.2, 1.16], [-2.5, 1.14], [-2.64, 1.08], [-2.66, 0.62]],
    glass: [[-0.4, 1.15], [1.3, 1.13], [0.75, 1.7], [0.2, 1.77], [-0.2, 1.77], [-0.36, 1.68]], roofY: 1.77,
    plan: [[-2.65, 0.95], [-1.6, 1.0], [0, 1.0], [1.6, 0.99], [2.3, 0.95], [2.65, 0.9]], corner: 0.25,
    shoulder: [[-2.65, 1.14], [-1.6, 1.18], [0, 1.16], [1.2, 1.17], [1.6, 1.18], [2.3, 1.1], [2.63, 1.0]],
    gw: [[-0.4, 0.9], [0.5, 0.93], [1.3, 0.88]], tumble: 0.11, quarter: 0.1, clad: true, tuck: 0.04, lean: 0.01, flare: 0.03, rt: 0.08, gap: 0.1, nose: 0.95, tailY: 0.95, tyres: [0.28, 0.28],
  },
  // the saloon stretched
  limo: {
    lower: [[-3.75, 0.3], [-3.3, 0.19], [3.3, 0.19], [3.75, 0.26], [3.8, 0.42], [3.77, 0.62], [3.55, 0.75], [2.6, 0.9], [2.35, 0.93], [-2.85, 0.96], [-3.2, 0.97], [-3.7, 0.95], [-3.81, 0.86], [-3.82, 0.5]],
    glass: [[-3.2, 0.955], [2.65, 0.9], [1.85, 1.38], [1.1, 1.44], [-2.45, 1.43], [-2.75, 1.38]], roofY: 1.44,
    plan: [[-3.8, 0.9], [-2.6, 0.99], [0, 1.0], [2.6, 0.985], [3.4, 0.93], [3.8, 0.86]], corner: 0.38,
    shoulder: [[-3.8, 0.9], [-2.6, 0.99], [2.35, 0.955], [2.6, 0.94], [3.4, 0.8], [3.77, 0.64]],
    gw: [[-3.2, 0.86], [-1, 0.93], [2, 0.92], [2.65, 0.86]], tumble: 0.16, quarter: 0.5, tuck: 0.045, lean: 0.012, flare: 0.02, rt: 0.07, gap: 0.06, lip: 0.06, nose: 0.66, tailY: 0.78, tyres: [0.235, 0.235],
  },
  // a tall off-roader with an upright tail and black cladding round the arches
  suv: {
    lower: [[-2.4, 0.42], [-2.0, 0.3], [2.0, 0.3], [2.38, 0.4], [2.45, 0.6], [2.43, 0.92], [2.25, 1.02], [1.3, 1.1], [1.05, 1.12], [-2.3, 1.12], [-2.44, 1.05], [-2.46, 0.6]],
    glass: [[-2.36, 1.11], [1.35, 1.09], [0.7, 1.72], [0.1, 1.8], [-1.9, 1.79], [-2.3, 1.7]], roofY: 1.8,
    plan: [[-2.45, 0.93], [-1.45, 1.0], [0, 1.0], [1.45, 0.99], [2.1, 0.95], [2.45, 0.9]], corner: 0.3,
    shoulder: [[-2.45, 1.1], [-1.45, 1.16], [0, 1.13], [1.05, 1.14], [1.45, 1.15], [2.1, 1.06], [2.43, 0.94]],
    gw: [[-2.36, 0.9], [0, 0.94], [1.35, 0.9]], tumble: 0.13, quarter: 0.28, clad: true, tuck: 0.04, lean: 0.01, flare: 0.03, rt: 0.08, gap: 0.09, nose: 0.9, tailY: 1.0, tyres: [0.27, 0.27],
  },
  // a compact mid-engined coupe: the same idea as the supercar, shorter, taller and softer
  sport: {
    lower: [[-2.2, 0.36], [-1.75, 0.16], [1.8, 0.15], [2.2, 0.17], [2.24, 0.25], [2.2, 0.43], [1.9, 0.58], [1.3, 0.7], [0.75, 0.78], [0.1, 0.84], [-0.7, 0.9], [-1.3, 0.94], [-1.9, 0.92], [-2.22, 0.86], [-2.25, 0.78], [-2.24, 0.5]],
    glass: [[-1.6, 0.93], [0.8, 0.775], [0.1, 1.2], [-0.45, 1.24], [-0.9, 1.19]], roofY: 1.24,
    plan: [[-2.25, 0.92], [-1.3, 1.0], [-0.4, 0.96], [0.4, 0.95], [1.3, 0.985], [1.9, 0.9], [2.25, 0.8]],
    shoulder: [[-2.25, 0.86], [-1.8, 0.96], [-1.3, 1.0], [-0.6, 0.93], [0.1, 0.85], [0.75, 0.8], [1.3, 0.84], [1.85, 0.7], [2.2, 0.44]],
    gw: [[-1.6, 0.66], [-0.8, 0.8], [0, 0.84], [0.8, 0.82]], cab: [-0.75, 0.78], scoop: { x0: -0.8, x1: 0.3, y0: 0.36, y1: 0.8, depth: 0.05 },
    tuck: 0.05, lean: 0.02, flare: 0.028, rt: 0.065, gap: 0.05, lip: 0.05, corner: 0.3, tumble: 0.2, quarter: 0.8, tyres: [0.235, 0.275], kit: 'exotic', nose: 0.43, tailY: 0.68,
  },
  // the hypercar: lower and longer in the tail than the supercar, the cabin further forward, deeper channels, a wing
  hyper: {
    lower: [[-2.32, 0.36], [-1.85, 0.13], [1.9, 0.12], [2.32, 0.14], [2.35, 0.2], [2.32, 0.34], [1.95, 0.47], [1.37, 0.58], [0.9, 0.66], [0.2, 0.76], [-0.6, 0.84], [-1.37, 0.9], [-2.0, 0.88], [-2.33, 0.82], [-2.36, 0.74], [-2.35, 0.48]],
    glass: [[-1.75, 0.89], [0.95, 0.655], [0.1, 1.04], [-0.4, 1.08], [-0.9, 1.04]], roofY: 1.08,
    plan: [[-2.35, 0.9], [-1.37, 1.0], [-0.5, 0.94], [0.4, 0.9], [1.37, 0.97], [1.95, 0.88], [2.35, 0.78]],
    shoulder: [[-2.35, 0.82], [-1.9, 0.93], [-1.37, 0.97], [-0.7, 0.87], [0.2, 0.77], [0.9, 0.7], [1.37, 0.78], [1.9, 0.63], [2.32, 0.36]],
    gw: [[-1.75, 0.56], [-0.9, 0.72], [0, 0.76], [0.95, 0.74]], cab: [-0.65, 0.92], scoop: { x0: -0.85, x1: 0.45, y0: 0.28, y1: 0.76, depth: 0.09 },
    tuck: 0.05, lean: 0.02, flare: 0.032, rt: 0.055, gap: 0.045, lip: 0.05, corner: 0.3, tumble: 0.26, quarter: 0.95, tyres: [0.26, 0.33], kit: 'exotic', nose: 0.34, tailY: 0.62,
  },
  // a low mid-engined wedge: a short nose that drops to a splitter, wings standing above the bonnet, a narrow teardrop cabin set forward,
  // doors pressed in towards an intake ahead of wide rear haunches, an engine window between buttresses, a cut-off tail with a lip
  super: {
    lower: [[-2.27, 0.33], [-1.8, 0.14], [1.85, 0.13], [2.27, 0.15], [2.3, 0.22], [2.27, 0.39], [1.95, 0.53], [1.35, 0.63], [0.8, 0.7], [0.15, 0.78], [-0.6, 0.86], [-1.35, 0.92], [-1.95, 0.92], [-2.28, 0.87], [-2.31, 0.78], [-2.3, 0.45]],
    glass: [[-1.8, 0.915], [0.82, 0.7], [-0.05, 1.09], [-0.5, 1.12], [-0.95, 1.085]], roofY: 1.12,
    plan: [[-2.3, 0.93], [-1.35, 1.0], [-0.5, 0.955], [0.3, 0.93], [1.35, 0.98], [1.95, 0.9], [2.3, 0.8]],
    shoulder: [[-2.3, 0.86], [-1.9, 0.95], [-1.35, 0.99], [-0.7, 0.9], [0.15, 0.79], [0.8, 0.73], [1.35, 0.8], [1.85, 0.66], [2.27, 0.4]],
    gw: [[-1.8, 0.6], [-0.9, 0.76], [0, 0.8], [0.82, 0.78]], cab: [-0.72, 0.8], scoop: { x0: -0.85, x1: 0.35, y0: 0.3, y1: 0.78, depth: 0.075 },
    tuck: 0.05, lean: 0.02, flare: 0.03, rt: 0.06, gap: 0.045, lip: 0.05, corner: 0.3, tumble: 0.24, quarter: 1.0, tyres: [0.25, 0.31], kit: 'exotic', nose: 0.39, tailY: 0.66,
  },
};

export interface CarModel { cabin?: THREE.Object3D[]; small?: THREE.Object3D[]; root: THREE.Group; tilt: THREE.Group; body: THREE.Group; wheels: THREE.Group[]; paint: THREE.MeshStandardMaterial; glass?: THREE.MeshStandardMaterial; rim?: THREE.MeshStandardMaterial; neon?: THREE.Mesh; rotors?: { main: THREE.Group; tail: THREE.Group }; modKey?: string; eye?: THREE.Vector3; steering?: THREE.Object3D; burner?: THREE.Mesh[]; gear?: THREE.Group; lights: { head: THREE.MeshStandardMaterial; tail: THREE.MeshStandardMaterial; bar?: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]; blinkL?: THREE.MeshStandardMaterial; blinkR?: THREE.MeshStandardMaterial; rev?: THREE.MeshStandardMaterial }; door?: THREE.Group; /** the body leans and dives on its springs while the wheels stay on the road */ sprung?: boolean; /** the springs' state: roll, dive and heave of the body, and their rates */ sus?: { r: number; rv: number; q: number; qv: number; h: number; hv: number; y: number; gv: number }; /** the painted body is swapped for a lighter one a long way off */ lod?: { mesh: THREE.Mesh; near: THREE.BufferGeometry; far: THREE.BufferGeometry; isFar: boolean }; /** shown as the car is wrecked */ damage?: { soot: THREE.Mesh; crack: THREE.Mesh } }

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
export function wheel(r: number, w: number, rimMat?: THREE.Material, side = 1, sporty = false, lowpro = false) {
  const g = new THREE.Group(), S = shared(); g.rotation.order = 'YXZ';
  const inner = new THREE.Group(); inner.scale.z = side < 0 ? -1 : 1; g.add(inner);
  const spin = new THREE.Group(); inner.add(spin); g.userData.spin = spin;
  const key = r + '|' + w + '|' + sporty + '|' + lowpro; let G = WHEELS.get(key);
  if (!G) {
    // rr: the rim's radius as a fraction of the wheel's (a low-profile tyre has a big rim and a thin sidewall)
    const thin = w < 0.2, rr = lowpro ? 0.77 : 0.645, zf = thin ? 0 : w / 2 - 0.045, V = (a: number, b: number) => new THREE.Vector2(a * r, b * w);
    const tire = new THREE.LatheGeometry([V(rr - 0.005, -0.5), V(Math.max(0.9, rr + 0.1), -0.5), V(0.975, -0.42), V(1, -0.26), V(1, 0.26), V(0.975, 0.42), V(Math.max(0.9, rr + 0.1), 0.5), V(rr - 0.005, 0.5)], 16).rotateX(Math.PI / 2);
    const rim: THREE.BufferGeometry[] = [];
    rim.push(thin ? new THREE.CylinderGeometry(rr * r, rr * r, w * 0.9, 16, 1, true).rotateX(Math.PI / 2) : new THREE.LatheGeometry([V(rr, 0.5), V(rr - 0.035, 0.42), V(rr - 0.045, -0.1)], 16).rotateX(Math.PI / 2));
    rim.push(new THREE.TorusGeometry(rr * r, 0.011, 3, 16).translate(0, 0, w / 2 - 0.004));
    const n = sporty ? 10 : 5, sw = sporty ? 0.065 : 0.2, sl = rr - 0.13;
    for (let k = 0; k < n; k++) rim.push(new THREE.BoxGeometry(sl * r, sw * r, 0.03).translate((0.12 + sl / 2) * r, 0, 0).rotateZ((k / n) * Math.PI * 2 + (sporty && k % 2 ? 0.2 : 0)).translate(0, 0, zf));
    rim.push(new THREE.CylinderGeometry(0.17 * r, 0.2 * r, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0, zf + 0.012));
    if (thin) rim.push(new THREE.CylinderGeometry(0.17 * r, 0.2 * r, 0.05, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.012));
    const zb = thin ? 0.035 : w / 2 - 0.115, dr = rr - 0.13, brake = [tinted(new THREE.CylinderGeometry(dr * r, dr * r, 0.022, 14).rotateX(Math.PI / 2).translate(0, 0, zb), '#8b8f96'), tinted(new THREE.BoxGeometry(0.2 * r, 0.44 * r, 0.075).translate((dr - 0.08) * r, 0, zb).rotateZ(0.5), sporty ? '#d1121c' : '#3b3d42')];
    if (!thin) brake.push(tinted(new THREE.CircleGeometry((rr - 0.045) * r, 14).translate(0, 0, -w * 0.1 + 0.004), '#0c0c0e'));
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
