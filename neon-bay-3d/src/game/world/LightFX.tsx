import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vehicles } from '../vehicles/sim';
import { peds } from '../ai/peds';
import { game } from '../state/store';
import { getTextures } from './textures';
import { smooth } from './rng';

/**
 * Cheap realism layers, each a single instanced draw:
 *  - soft contact shadows under every car and pedestrian (grounds them even beyond the shadow map),
 *  - head/tail light glows (camera-facing) that bloom at night, brighter when braking,
 *  - headlight beams painted on the road ahead at night.
 */
const MAXV = 70, MAXP = 40;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export default function LightFX() {
  const glow = getTextures().glow;
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, colors = false) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO); if (colors) m.setColorAt(i, new THREE.Color(1, 1, 1)); } return m; };
  const L = useMemo(() => {
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), quad = new THREE.PlaneGeometry(1, 1);
    const add = (c: string) => new THREE.MeshBasicMaterial({ map: glow, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    return {
      shadow: mk(flat, new THREE.MeshBasicMaterial({ map: glow, color: '#000000', transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3 }), MAXV + MAXP),
      head: mk(quad, add('#fff1d2'), MAXV * 2),
      tail: mk(quad, add('#ff2a1a'), MAXV * 2, true),
      beam: mk(flat.clone().translate(0, 0, 0.5), add('#ffe7b8'), MAXV),
    };
  }, [glow]);
  const red = useMemo(() => ({ dim: new THREE.Color(0.9, 0.12, 0.08), brake: new THREE.Color(3, 0.35, 0.2) }), []);
  useFrame(({ camera }) => {
    const h = game.hour, night = 1 - smooth(5.6, 7.2, h) + smooth(17.6, 19.2, h), nk = Math.min(1, Math.max(0, night)) * (game.where === 'out' ? 1 : 0);
    const dusk = Math.max(nk, game.weather.cloud * 0.6), q = camera.quaternion;
    (L.beam.material as THREE.MeshBasicMaterial).opacity = 0.32 * nk; (L.head.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.75 * dusk;
    let si = 0, hi = 0, ti = 0, bi = 0;
    for (const v of vehicles) {
      if (Math.abs(v.x - camera.position.x) > 180 || Math.abs(v.z - camera.position.z) > 180) continue;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), L2 = v.def.len / 2, W = v.def.wid;
      // contact shadow (stays on the ground when the car jumps, fading with height)
      if (si < MAXV + MAXP) { const gy = v.air ? v.y - Math.max(0, v.vy) * 0 : v.y, lift = v.def.kind === 'heli' ? Math.max(0, v.y - 0.2) : 0; Q.setFromAxisAngle(UP, v.yaw); V.set(v.x, gy - lift + 0.04, v.z); const k = 1 / (1 + lift * 0.08); S.set(W * 1.7 * k, 1, v.def.len * 1.25 * k); M.compose(V, Q, S); L.shadow.setMatrixAt(si++, M); }
      if (v.dead || v.def.kind === 'heli') continue;
      const hy = v.y + (v.def.kind === 'truck' || v.def.kind === 'armored' ? 1.0 : v.def.kind === 'suv' || v.def.kind === 'pickup' ? 0.9 : v.def.kind === 'bike' ? 0.9 : 0.62);
      const on = v.id === game.inCar || !!v.ai || v.touched;
      for (const sd of v.def.kind === 'bike' ? [0] : [-1, 1]) {
        if (on && hi < MAXV * 2) { V.set(v.x + fx * (L2 + 0.05) + lx * sd * W * 0.33, hy, v.z + fz * (L2 + 0.05) + lz * sd * W * 0.33); S.setScalar((0.55 + 0.9 * dusk) * (v.def.kind === 'bike' ? 0.8 : 1)); M.compose(V, q, S); L.head.setMatrixAt(hi++, M); }
        if (ti < MAXV * 2) { const br = v.braking; V.set(v.x - fx * (L2 + 0.05) + lx * sd * W * 0.32, hy + 0.05, v.z - fz * (L2 + 0.05) + lz * sd * W * 0.32); S.setScalar(br ? 0.95 : 0.35 + 0.35 * dusk); M.compose(V, q, S); L.tail.setMatrixAt(ti, M); L.tail.setColorAt(ti++, br ? red.brake : red.dim); }
      }
      if (nk > 0.05 && on && bi < MAXV) { Q.setFromAxisAngle(UP, v.yaw); V.set(v.x + fx * L2, v.y + 0.06, v.z + fz * L2); S.set(W * 2.6, 1, 16); M.compose(V, Q, S); L.beam.setMatrixAt(bi++, M); }
    }
    for (const p of peds) { if (si >= MAXV + MAXP) break; if (Math.abs(p.x - camera.position.x) > 90 || Math.abs(p.z - camera.position.z) > 90) continue; V.set(p.x, p.y + 0.04, p.z); Q.identity(); S.set(p.fall > 0.5 ? 1.9 : 1.1, 1, p.fall > 0.5 ? 2.2 : 1.1); M.compose(V, Q, S); L.shadow.setMatrixAt(si++, M); }
    if (game.where === 'out' && si < MAXV + MAXP) { const pl = game.player; V.set(pl.x, pl.y + 0.04, pl.z); Q.identity(); S.set(1.1, 1, 1.1); M.compose(V, Q, S); if (!game.inCar) L.shadow.setMatrixAt(si++, M); }
    for (let i = si; i < MAXV + MAXP; i++) L.shadow.setMatrixAt(i, ZERO);
    for (let i = hi; i < MAXV * 2; i++) L.head.setMatrixAt(i, ZERO);
    for (let i = ti; i < MAXV * 2; i++) L.tail.setMatrixAt(i, ZERO);
    for (let i = bi; i < MAXV; i++) L.beam.setMatrixAt(i, ZERO);
    for (const m of [L.shadow, L.head, L.tail, L.beam]) m.instanceMatrix.needsUpdate = true;
    if (L.tail.instanceColor) L.tail.instanceColor.needsUpdate = true;
  });
  return <><primitive object={L.shadow} /><primitive object={L.beam} /><primitive object={L.head} /><primitive object={L.tail} /></>;
}
