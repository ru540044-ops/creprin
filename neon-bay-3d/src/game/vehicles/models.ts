import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VDef, VKind } from './defs';
import { labelTexture } from '../world/textures';

/** Side profiles (x = forward, y = up). lower = painted body up to the belt line, glass = greenhouse. */
export const PROF: Partial<Record<VKind, { lower: number[][]; glass: number[][]; roofY: number }>> = {
  sedan: { lower: [[-2.35, 0.32], [2.35, 0.32], [2.38, 0.62], [2.2, 0.86], [1.15, 0.98], [-1.6, 0.98], [-2.3, 0.94], [-2.4, 0.6]], glass: [[-1.55, 0.97], [1.1, 0.97], [0.55, 1.4], [-1.05, 1.42]], roofY: 1.42 },
  sport: { lower: [[-2.22, 0.3], [2.25, 0.3], [2.3, 0.52], [2.1, 0.7], [1.0, 0.86], [-1.5, 0.88], [-2.2, 0.84], [-2.28, 0.55]], glass: [[-1.35, 0.87], [0.95, 0.86], [0.35, 1.22], [-0.8, 1.24]], roofY: 1.24 },
  super: { lower: [[-2.28, 0.28], [2.32, 0.28], [2.38, 0.45], [2.25, 0.56], [0.9, 0.82], [-1.7, 0.92], [-2.3, 0.9], [-2.33, 0.5]], glass: [[-1.1, 0.88], [0.85, 0.83], [0.15, 1.1], [-0.6, 1.12]], roofY: 1.12 },
  suv: { lower: [[-2.42, 0.45], [2.42, 0.45], [2.45, 0.85], [2.3, 1.1], [1.35, 1.2], [-2.35, 1.2], [-2.45, 0.85]], glass: [[-2.3, 1.18], [1.3, 1.18], [0.85, 1.78], [-2.25, 1.8]], roofY: 1.8 },
};

export interface CarModel { root: THREE.Group; tilt: THREE.Group; body: THREE.Group; wheels: THREE.Group[]; paint: THREE.MeshStandardMaterial; lights: { head: THREE.MeshStandardMaterial; tail: THREE.MeshStandardMaterial; bar?: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]; blinkL?: THREE.MeshStandardMaterial; blinkR?: THREE.MeshStandardMaterial; rev?: THREE.MeshStandardMaterial }; door?: THREE.Group }

const shared = (() => {
  let s: any = null;
  return () => (s ||= {
    glass: new THREE.MeshStandardMaterial({ color: '#0d141f', metalness: 0.9, roughness: 0.06, envMapIntensity: 2, transparent: true, opacity: 0.62 }),
    trim: new THREE.MeshStandardMaterial({ color: '#141418', metalness: 0.3, roughness: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d9dde4', metalness: 1, roughness: 0.15 }),
    tire: new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.92 }),
  });
})();

function extrude(poly: number[][], width: number, bevel = 0.06) {
  const sh = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2); return g;
}
function box(w: number, h: number, d: number, x: number, y: number, z: number) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }

function wheel(r: number, w: number) {
  const g = new THREE.Group(), S = shared(); g.rotation.order = 'YXZ';
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18).rotateX(Math.PI / 2), S.tire);
  const rim = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12).rotateX(Math.PI / 2), ...[0, 1, 2, 3, 4].map((k) => new THREE.BoxGeometry(r * 1.15, r * 0.14, w * 0.3).rotateZ((k / 5) * Math.PI).translate(0, 0, w * 0.4))])!, S.chrome);
  tire.castShadow = true; g.add(tire, rim); return g;
}

export function buildCarModel(def: VDef, color: string): CarModel {
  const m = buildInner(def, color), outer = new THREE.Group(), tilt = new THREE.Group();
  m.root.rotation.y = -Math.PI / 2; tilt.add(m.root); outer.add(tilt);
  return { ...m, root: outer, tilt };
}
function buildInner(def: VDef, color: string): Omit<CarModel, 'tilt'> {
  const S = shared(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.28, envMapIntensity: 1.4 });
  const head = new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: new THREE.Color('#ff1a1a'), emissiveIntensity: 0.4 });
  const L = def.len / 2, W = def.wid, wheels: THREE.Group[] = [];
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = shadow; mesh.receiveShadow = true; body.add(mesh); return mesh; };
  if (def.kind === 'bike') {
    add(mergeGeometries([box(0.9, 0.35, 0.32, 0.15, 0.62, 0), box(0.55, 0.25, 0.28, -0.35, 0.8, 0), box(0.5, 0.12, 0.3, -0.25, 0.95, 0)].map((g) => g.toNonIndexed()))!, paint);
    add(mergeGeometries([box(0.08, 0.6, 0.06, 0.62, 0.7, 0.08), box(0.08, 0.6, 0.06, 0.62, 0.7, -0.08), box(0.08, 0.06, 0.7, 0.55, 1.02, 0), box(0.7, 0.08, 0.06, -0.4, 0.45, 0.1)].map((g) => g.toNonIndexed()))!, S.chrome);
    add(box(0.16, 0.12, 0.2, 0.78, 0.9, 0), head, false); add(box(0.06, 0.08, 0.16, -0.75, 0.82, 0), tail, false);
    for (const x of [0.71, -0.71]) { const wg = wheel(def.wheelR, 0.16); wg.position.set(x, def.wheelR, 0); root.add(wg); wheels.push(wg); }
    return { root, body, wheels, paint, lights: { head, tail } };
  }
  if (def.kind === 'truck' || def.kind === 'armored') {
    const cabL = 1.9, cx = L - cabL / 2, arm = def.kind === 'armored';
    add(mergeGeometries([box(cabL, 1.5, W, cx, 1.35, 0), box(cabL * 0.9, 0.9, W * 0.96, cx - 0.05, 2.45, 0)].map((g) => g.toNonIndexed()))!, paint);
    add(box(0.05, 0.75, W * 0.86, L + 0.01, 2.4, 0), S.glass, false);
    for (const s of [-1, 1]) add(box(1.0, 0.65, 0.04, cx - 0.1, 2.42, s * W * 0.485), S.glass, false);
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
    for (const x of [L - 1.0, -L + 1.3, -L + 2.3]) for (const s of [-1, 1]) { const wg = wheel(def.wheelR, 0.36); wg.position.set(x, def.wheelR, s * (W / 2 - 0.12)); root.add(wg); wheels.push(wg); }
    return { root, body, wheels, paint, lights: { head, tail } };
  }
  const P = PROF[def.kind === 'police' ? 'sedan' : def.kind]!;
  add(extrude(P.lower, W), paint);
  add(extrude(P.glass, W * 0.9, 0.04), S.glass);
  const gx0 = Math.min(...P.glass.map((p) => p[0])), gx1 = Math.max(...P.glass.map((p) => p[0]));
  const roofPts = P.glass.filter((p) => p[1] > P.roofY - 0.05).map((p) => p[0]); const r0 = Math.min(...roofPts), r1 = Math.max(...roofPts);
  add(box(r1 - r0 + 0.08, 0.05, W * 0.88, (r0 + r1) / 2, P.roofY + 0.02, 0), paint);
  // trim: bumpers, skirts, grille, mirrors, plates
  add(mergeGeometries([box(0.18, 0.22, W * 0.96, L - 0.02, 0.4, 0), box(0.18, 0.22, W * 0.96, -L + 0.02, 0.4, 0), box(def.len * 0.6, 0.1, 0.04, 0, 0.36, W / 2 + 0.005), box(def.len * 0.6, 0.1, 0.04, 0, 0.36, -W / 2 - 0.005), box(0.04, 0.16, W * 0.45, L + 0.06, 0.55, 0)].map((g) => g.toNonIndexed()))!, S.trim);
  for (const s of [-1, 1]) add(box(0.2, 0.12, 0.16, gx1 - 0.15, P.lower[4][1] + 0.1, s * (W / 2 + 0.06)), paint);
  
  // lights sit on the actual nose / tail of the extruded profile (plus its bevel) so they are never buried in the body
  const xs = P.lower.map((p) => p[0]), nose = Math.max(...xs) + 0.06, rear = Math.min(...xs) - 0.06;
  const hy = def.kind === 'suv' ? 0.95 : def.kind === 'super' ? 0.42 : def.kind === 'sport' ? 0.5 : 0.7, ty = def.kind === 'super' ? 0.62 : def.kind === 'sport' ? 0.62 : hy + 0.05;
  for (const s of [-1, 1]) {
    add(box(0.06, def.kind === 'super' ? 0.07 : 0.13, W * 0.24, nose + 0.005, hy, s * W * 0.33), head, false);
    add(box(0.06, def.kind === 'super' || def.kind === 'sport' ? 0.08 : 0.14, W * 0.3, rear - 0.005, ty, s * W * 0.3), tail, false);
    add(box(0.12, 0.07, 0.07, rear - 0.02, 0.36, s * W * 0.22), S.chrome, false); // exhaust tips
  }
  if (def.kind === 'super' || def.kind === 'sport') add(box(0.05, 0.04, W * 0.36, rear - 0.005, ty, 0), tail, false); // light bar
  add(box(0.03, 0.12, 0.42, rear - 0.01, 0.48, 0), new THREE.MeshStandardMaterial({ color: '#f2f0e6' }), false); // rear plate
  add(box(0.06, 0.12, W * 0.7, rear + 0.02, 0.3, 0), S.trim, false); // diffuser
  if (def.kind === 'super' || def.kind === 'sport') add(mergeGeometries([box(0.35, 0.04, W * 0.92, -L + 0.25, P.lower[5][1] + 0.3, 0), box(0.06, 0.28, 0.06, -L + 0.3, P.lower[5][1] + 0.15, W * 0.3), box(0.06, 0.28, 0.06, -L + 0.3, P.lower[5][1] + 0.15, -W * 0.3)].map((g) => g.toNonIndexed()))!, def.kind === 'super' ? S.trim : paint);
  let bar: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | undefined;
  if (def.kind === 'police') { // white doors over the black body, roof light bar, push bar
    const white = new THREE.MeshStandardMaterial({ color: '#f2f2f4', metalness: 0.4, roughness: 0.35 });
    for (const s of [-1, 1]) add(box(2.3, 0.42, 0.03, -0.1, 0.68, s * (W / 2 + 0.065)), white, false);
    const lab = new THREE.MeshBasicMaterial({ map: labelTexture('POLICE', '#2b6bff'), toneMapped: false, transparent: true });
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(1.5, 0.36).rotateY(s > 0 ? 0 : Math.PI).translate(-0.1, 0.68, s * (W / 2 + 0.085)), lab, false);
    const red = new THREE.MeshStandardMaterial({ color: '#550000', emissive: new THREE.Color('#ff1530'), emissiveIntensity: 0 });
    const blue = new THREE.MeshStandardMaterial({ color: '#000855', emissive: new THREE.Color('#1a4dff'), emissiveIntensity: 0 });
    add(box(0.3, 0.1, W * 0.7, -0.3, P.roofY + 0.09, 0), S.trim, false);
    add(box(0.26, 0.12, W * 0.3, -0.3, P.roofY + 0.17, W * 0.17), red, false); add(box(0.26, 0.12, W * 0.3, -0.3, P.roofY + 0.17, -W * 0.17), blue, false);
    add(box(0.12, 0.35, W * 0.7, L + 0.2, 0.5, 0), S.trim);
    bar = [red, blue];
  }
  const wx = def.wheelbase / 2, wz = W / 2 - 0.16;
  for (const x of [wx, -wx]) for (const s of [-1, 1]) { const wg = wheel(def.wheelR, 0.28); wg.position.set(x, def.wheelR, s * wz); root.add(wg); wheels.push(wg); }
  void gx0;
  // turn signals (inner -z = the car's left), reverse lights, and a driver's door hinged at its front edge
  const amber = () => new THREE.MeshStandardMaterial({ color: '#5a3a00', emissive: new THREE.Color('#ffa21a'), emissiveIntensity: 0 });
  const blinkL = amber(), blinkR = amber(), rev = new THREE.MeshStandardMaterial({ color: '#cfcfcf', emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
  for (const [sz, m] of [[-1, blinkL], [1, blinkR]] as const) { add(box(0.07, 0.07, 0.14, nose + 0.01, hy, sz * W * 0.46), m, false); add(box(0.07, 0.07, 0.12, rear - 0.01, ty - 0.1, sz * W * 0.45), m, false); }
  for (const sz of [-1, 1]) add(box(0.05, 0.06, 0.12, rear - 0.008, ty - 0.12, sz * W * 0.16), rev, false);
  const door = new THREE.Group(), xf = Math.min(gx1 * 0.9, L - 0.9), dl = 1.25, belt = P.lower[4][1] - 0.02;
  door.position.set(xf, 0, -W / 2 - 0.012);
  const panel = new THREE.Mesh(box(dl, belt - 0.36, 0.045, -dl / 2, (belt + 0.36) / 2, 0), paint); panel.castShadow = true; door.add(panel);
  const win = new THREE.Mesh(box(dl * 0.78, Math.min(0.36, P.roofY - belt - 0.12), 0.03, -dl * 0.45, belt + Math.min(0.36, P.roofY - belt - 0.12) / 2 + 0.02, 0.005), S.glass); door.add(win);
  const handle = new THREE.Mesh(box(0.14, 0.03, 0.03, -dl * 0.82, belt - 0.12, -0.03), S.chrome); door.add(handle);
  root.add(door);
  return { root, body, wheels, paint, lights: { head, tail, bar, blinkL, blinkR, rev }, door };
}
