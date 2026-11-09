import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Geo } from './geo';
import { SHIN } from './cityGen';
import { REGION, REGIONS } from './region';
import { labelTexture } from './textures';
import { game } from '../state/store';
import { vehicles, SHIN_HEAD, SHIN_TAIL } from '../vehicles/sim';
import { buildCarModel } from '../vehicles/models';
import { VDEFS } from '../vehicles/defs';

/**
 * The bullet-train line: a high concrete viaduct with sound walls and slab track, the platform beside the main station,
 * the street entrance (where you take the driver's seat) and a timetable train that runs through when you are not driving one.
 */
const S = SHIN;
function viaduct() {
  const C = new Geo(), M = new Geo(), y = S.y, x = S.x, hw = S.half, CON = [0.78, 0.77, 0.75], SLAB = [0.5, 0.5, 0.5], RAILC = [0.55, 0.52, 0.5];
  C.box(x - hw, y - 1.3, S.z0, x + hw, y, S.z1, CON, 4, 4, C, 8);
  for (const s of [-1, 1]) C.box(x + s * hw - (s > 0 ? 0.35 : 0), y, S.z0, x + s * hw + (s < 0 ? 0.35 : 0), y + 2.0, S.z1, CON); // sound walls
  for (const s of [-1, 1]) { const tx = x + s * S.track; M.box(tx - 1.4, y, S.z0, tx + 1.4, y + 0.25, S.z1, SLAB, 4, 4, M, 2); for (const o of [-0.75, 0.75]) M.box(tx + o - 0.04, y + 0.25, S.z0, tx + o + 0.04, y + 0.42, S.z1, RAILC); }
  for (const z of S.piers) { C.box(x - 1, 0, z - 1.4, x + 1, y - 1.3, z + 1.4, CON); C.box(x - 3.6, y - 2.4, z - 1.5, x + 3.6, y - 1.3, z + 1.5, CON); }
  for (const z of [S.z0, S.z1]) C.box(x - hw, y, z - 0.5, x + hw, y + 2.6, z + 0.5, CON);
  for (let z = S.z0 + 20; z < S.z1; z += 50) { for (const s of [-1, 1]) M.box(x + s * (hw - 0.6) - 0.15, y, z - 0.15, x + s * (hw - 0.6) + 0.15, y + 7, z + 0.15, [0.4, 0.42, 0.45]); M.box(x - hw + 0.4, y + 6.6, z - 0.12, x + hw - 0.4, y + 6.85, z + 0.12, [0.4, 0.42, 0.45]); }
  // platform on the station side with a long canopy, and the street entrance
  const pz0 = S.stationZ - 80, pz1 = S.stationZ + 80, px0 = x - hw - 5.5, px1 = x - hw;
  C.box(px0, y - 1.3, pz0, px1, y + 0.2, pz1, [0.82, 0.8, 0.77], 4, 4, C, 4);
  M.box(px1 - 0.5, y + 0.2, pz0, px1, y + 0.23, pz1, [0.95, 0.8, 0.15], 4, 4, M, 4);
  for (let z = pz0 + 6; z < pz1; z += 12) M.box(px0 + 0.8, y + 0.2, z - 0.15, px0 + 1.1, y + 5, z + 0.15, [0.75, 0.77, 0.8]);
  M.box(px0 - 0.3, y + 5, pz0 + 2, x + 0.5, y + 5.3, pz1 - 2, [0.88, 0.89, 0.92]);
  for (let k = 0; k < 9; k++) C.box(px0 - 3, 0, S.gate.z - 6 - (k + 1) * 1.2, px0 - 0.2, (y * (k + 1)) / 9, S.gate.z - 6 - k * 1.2, [0.7, 0.7, 0.72]); // stairs up to the platform
  const g = S.gate; C.box(g.x - 1.6, 0.15, g.z - 3, g.x + 2.6, 3.4, g.z + 3, [0.92, 0.93, 0.95]); M.box(g.x - 1.9, 3.4, g.z - 3.4, g.x + 2.9, 3.7, g.z + 3.4, [0.2, 0.35, 0.7]);
  return { C: C.build(), M: M.build() };
}

/** Timetable train: comes in from one end, stops at the station, leaves at the other end, rests, then comes back. */
const V = 70, DWELL = 30, REST = 50, LEN = S.z1 - S.z0;
function timetable(t: number) {
  const run = (LEN - SHIN_TAIL) / V * 1.4, half = run + DWELL + REST, T = 2 * half; t = ((t % T) + T) % T;
  const dir = t < half ? 1 : -1, tt = t < half ? t : t - half;
  const a = dir > 0 ? S.z0 + SHIN_TAIL + 2 : S.z1 - SHIN_TAIL - 2, st = S.stationZ + dir * 90, b = dir > 0 ? S.z1 - SHIN_HEAD - 2 : S.z0 + SHIN_HEAD + 2;
  const p1 = Math.abs(st - a) / V * 1.4, p2 = Math.abs(b - st) / V * 1.4;
  const ease = (u: number) => u * u * (3 - 2 * u), easeOut = (u: number) => 1 - (1 - u) * (1 - u), easeIn = (u: number) => u * u;
  let z: number, vis = true;
  if (tt < p1) z = a + (st - a) * easeOut(tt / p1);
  else if (tt < p1 + DWELL) z = st;
  else if (tt < p1 + DWELL + p2) z = st + (b - st) * easeIn((tt - p1 - DWELL) / p2);
  else { z = b; vis = false; }
  void ease;
  return { z, dir, vis };
}

export default function ShinkansenLine() {
  const D = useMemo(() => {
    if (!S.has) return null;
    const v = viaduct();
    const conc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.5 });
    const train = buildCarModel(VDEFS.shinkansen, '#f4f5f7');
    const n = S.next.south ?? S.next.north!;
    const sign = new THREE.MeshBasicMaterial({ map: labelTexture('新幹線のりば  ' + REGIONS[n].name + '方面', '#ffffff', 768, 128), toneMapped: false, side: THREE.DoubleSide });
    const plat = new THREE.MeshBasicMaterial({ map: labelTexture((REGION.station || '駅') + '  新幹線', '#ffffff', 768, 128), toneMapped: false, side: THREE.DoubleSide });
    return { v, conc, metal, train, sign, plat };
  }, []);
  useFrame(() => {
    if (!D) return;
    const driving = vehicles.some((q) => q.def.kind === 'shinkansen');
    const T = timetable(game.clock), root = D.train.root;
    root.visible = !driving && T.vis;
    if (root.visible) { root.position.set(S.x + T.dir * S.track, S.y + 0.05, T.z); root.rotation.y = T.dir > 0 ? 0 : Math.PI; }
  });
  if (!D) return null;
  return (
    <group>
      <mesh geometry={D.v.C} material={D.conc} castShadow receiveShadow />
      <mesh geometry={D.v.M} material={D.metal} castShadow />
      <primitive object={D.train.root} />
      <mesh position={[S.gate.x - 1.65, 2.6, S.gate.z]} rotation-y={-Math.PI / 2} material={D.sign}><planeGeometry args={[5.6, 0.95]} /></mesh>
      <mesh position={[S.x - S.half - 2.8, S.y + 4.2, S.stationZ]} rotation-y={-Math.PI / 2} material={D.plat}><planeGeometry args={[8, 1.3]} /></mesh>
    </group>
  );
}
