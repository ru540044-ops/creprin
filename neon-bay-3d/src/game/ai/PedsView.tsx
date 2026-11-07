import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { peds, pickups, PED_MAX } from './peds';
import { fx } from '../combat/fx';
import { combat } from '../combat/weapons';
import { getTextures } from '../world/textures';

const SHIRT = ['#e84a5f', '#2a9d8f', '#264653', '#f4a261', '#e9c46a', '#6c5ce7', '#dfe6e9', '#2d3436', '#00b894', '#fd79a8', '#0984e3', '#b2bec3'].map((c) => new THREE.Color(c));
const PANTS = ['#2d3436', '#34495e', '#5d4037', '#1e3799', '#636e72', '#2c2c54', '#c8b48a'].map((c) => new THREE.Color(c));
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0522d'].map((c) => new THREE.Color(c));
const HAIR = ['#1a1012', '#4a2c1a', '#8b5a2b', '#d4b06a', '#2b2b2b', '#777777'].map((c) => new THREE.Color(c));

const M = new THREE.Matrix4(), B = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** All pedestrians in five instanced draws: torso, head, hair, legs, arms. */
export function PedsView() {
  const parts = useMemo(() => {
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.75 });
    const mk = (g: THREE.BufferGeometry, n: number) => { const m = new THREE.InstancedMesh(g, mat(), n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = true; m.frustumCulled = false; for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, new THREE.Color(1, 1, 1)); } return m; };
    return {
      torso: mk(new THREE.CapsuleGeometry(0.2, 0.36, 4, 10), PED_MAX),
      head: mk(new THREE.SphereGeometry(0.125, 12, 10), PED_MAX),
      hair: mk(new THREE.SphereGeometry(0.133, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), PED_MAX),
      leg: mk(new THREE.CapsuleGeometry(0.075, 0.74, 4, 8), PED_MAX * 2),
      arm: mk(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), PED_MAX * 2),
    };
  }, []);
  const colored = useRef(new Map<number, number>());
  useFrame(() => {
    const P = parts;
    for (let i = 0; i < PED_MAX; i++) {
      const p = peds[i];
      if (!p) { P.torso.setMatrixAt(i, ZERO); P.head.setMatrixAt(i, ZERO); P.hair.setMatrixAt(i, ZERO); for (const k of [0, 1]) { P.leg.setMatrixAt(i * 2 + k, ZERO); P.arm.setMatrixAt(i * 2 + k, ZERO); } continue; }
      if (colored.current.get(i) !== p.id) { // assign this slot's colours once per ped
        colored.current.set(i, p.id); const h = p.look;
        P.torso.setColorAt(i, SHIRT[h % SHIRT.length]); P.head.setColorAt(i, SKIN[(h >> 4) % SKIN.length]); P.hair.setColorAt(i, HAIR[(h >> 8) % HAIR.length]);
        for (const k of [0, 1]) { P.leg.setColorAt(i * 2 + k, PANTS[(h >> 12) % PANTS.length]); P.arm.setColorAt(i * 2 + k, SHIRT[h % SHIRT.length]); }
        for (const m of [P.torso, P.head, P.hair, P.leg, P.arm]) m.instanceColor!.needsUpdate = true;
      }
      Q.setFromAxisAngle(UP, p.yaw); V.set(p.x, p.y, p.z); S.setScalar(p.scale); B.compose(V, Q, S);
      if (p.fall > 0) B.multiply(T.makeTranslation(0, 0.18 * p.fall, 0)).multiply(R.makeRotationX(-Math.PI / 2 * p.fall));
      const moving = p.state === 'walk' || p.state === 'cross' || p.state === 'flee', amp = p.state === 'flee' ? 0.95 : moving ? 0.5 : 0, sw = Math.sin(p.phase) * amp;
      M.copy(B).multiply(T.makeTranslation(0, 1.22, 0)).multiply(R.makeScale(1.1, 1, 0.72)); P.torso.setMatrixAt(i, M);
      M.copy(B).multiply(T.makeTranslation(0, 1.66, 0)); P.head.setMatrixAt(i, M);
      M.copy(B).multiply(T.makeTranslation(0, 1.685, -0.01)); P.hair.setMatrixAt(i, M);
      for (const k of [0, 1]) {
        const sg = k ? 1 : -1;
        M.copy(B).multiply(T.makeTranslation(sg * 0.1, 0.92, 0)).multiply(R.makeRotationX(sg * sw)).multiply(T.makeTranslation(0, -0.45, 0)); P.leg.setMatrixAt(i * 2 + k, M);
        const up = p.state === 'hands', ax = up ? -2.9 : -sg * sw * 0.9, az = up ? sg * 0.25 : sg * 0.1;
        M.copy(B).multiply(T.makeTranslation(sg * 0.27, 1.46, 0)).multiply(R.makeRotationZ(az)).multiply(T.makeRotationX(ax)).multiply(R.makeTranslation(0, -0.3, 0)); P.arm.setMatrixAt(i * 2 + k, M);
      }
    }
    for (const m of [P.torso, P.head, P.hair, P.leg, P.arm]) m.instanceMatrix.needsUpdate = true;
  });
  return <>{Object.values(parts).map((m, i) => <primitive key={i} object={m} />)}</>;
}

/** Muzzle flashes, tracers, impacts, the aim-lock marker and dropped cash. */
export function FXView() {
  const glow = getTextures().glow;
  const flashes = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 24); m.frustumCulled = false; return m; }, [glow]);
  const hits = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, toneMapped: false }), 32); m.frustumCulled = false; for (let i = 0; i < 32; i++) m.setColorAt(i, new THREE.Color(1, 1, 1)); return m; }, [glow]);
  const cash = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: '#3dffb0', emissive: new THREE.Color('#1a8f5a'), emissiveIntensity: 0.8 }), 24); m.frustumCulled = false; return m; }, []);
  const lines = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.85, toneMapped: false })); l.frustumCulled = false; return l; }, []);
  const lock = useRef<THREE.Mesh>(null!);
  const red = useMemo(() => new THREE.Color(2, 0.25, 0.2), []), spark = useMemo(() => new THREE.Color(2, 1.6, 0.6), []);
  useFrame(({ camera, clock }) => {
    const q = camera.quaternion;
    for (let i = 0; i < 24; i++) { const f = fx.flashes[i]; if (f) { V.set(f.x, f.y, f.z); S.setScalar(0.55 * f.s * (0.7 + Math.random() * 0.6)); M.compose(V, q, S); flashes.setMatrixAt(i, M); } else flashes.setMatrixAt(i, ZERO); }
    flashes.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 32; i++) { const h = fx.hits[i]; if (h) { V.set(h.x, h.y, h.z); S.setScalar((h.blood ? 0.5 : 0.35) * (1 - h.t * 1.5 + 0.6)); M.compose(V, q, S); hits.setMatrixAt(i, M); hits.setColorAt(i, h.blood ? red : spark); } else hits.setMatrixAt(i, ZERO); }
    hits.instanceMatrix.needsUpdate = true; if (hits.instanceColor) hits.instanceColor.needsUpdate = true;
    const a = lines.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 32; i++) { const t = fx.tracers[i]; if (t) { a.setXYZ(i * 2, t.ax, t.ay, t.az); a.setXYZ(i * 2 + 1, t.bx, t.by, t.bz); } else { a.setXYZ(i * 2, 0, -999, 0); a.setXYZ(i * 2 + 1, 0, -999, 0); } }
    a.needsUpdate = true;
    for (let i = 0; i < 24; i++) { const c = pickups[i]; if (c) { Q.setFromAxisAngle(UP, clock.elapsedTime * 2 + i); V.set(c.x, c.y + 0.35 + Math.sin(clock.elapsedTime * 3 + i) * 0.08, c.z); S.setScalar(1); M.compose(V, Q, S); cash.setMatrixAt(i, M); } else cash.setMatrixAt(i, ZERO); }
    cash.instanceMatrix.needsUpdate = true;
    const L = combat.lock, m = lock.current;
    if (m) { m.visible = !!L; if (L) { const p = 'ped' in L ? { x: L.ped.x, y: L.ped.y + 2.2, z: L.ped.z } : { x: L.veh.x, y: L.veh.y + L.veh.def.hgt + 0.7, z: L.veh.z }; m.position.set(p.x, p.y, p.z); m.quaternion.copy(q); } }
  });
  return (
    <>
      <primitive object={flashes} /><primitive object={hits} /><primitive object={cash} /><primitive object={lines} />
      <mesh ref={lock} visible={false}><ringGeometry args={[0.22, 0.3, 24]} /><meshBasicMaterial color="#ff3a4a" toneMapped={false} depthTest={false} transparent /></mesh>
    </>
  );
}
