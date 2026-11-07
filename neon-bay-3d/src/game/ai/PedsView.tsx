import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { peds, pickups, PED_MAX, Ped } from './peds';
import { vehicles } from '../vehicles/sim';
import { game } from '../state/store';
import * as A from '../anim/pose';
import { fx } from '../combat/fx';
import { combat } from '../combat/weapons';
import { booms, grenades } from '../combat/explode';
import { getTextures } from '../world/textures';

const SHIRT = ['#e84a5f', '#2a9d8f', '#264653', '#f4a261', '#e9c46a', '#6c5ce7', '#dfe6e9', '#2d3436', '#00b894', '#fd79a8', '#0984e3', '#b2bec3'].map((c) => new THREE.Color(c));
const PANTS = ['#2d3436', '#34495e', '#5d4037', '#1e3799', '#636e72', '#2c2c54', '#c8b48a'].map((c) => new THREE.Color(c));
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0522d'].map((c) => new THREE.Color(c));
const SHOE = ['#f2f2f2', '#1b1b1f', '#6b4a2f', '#c0392b', '#2c3e50'].map((c) => new THREE.Color(c));
const HAIR = ['#1a1012', '#4a2c1a', '#8b5a2b', '#d4b06a', '#2b2b2b', '#777777'].map((c) => new THREE.Color(c));

const M = new THREE.Matrix4(), B = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const E = new THREE.Euler(), J = new THREE.Matrix4(), H = new THREE.Matrix4(), SP = new THREE.Matrix4(), HD = new THREE.Matrix4(), AT = new THREE.Matrix4(), LT = new THREE.Matrix4(), MID = new THREE.Matrix4();
const rot = (m: THREE.Matrix4, x: number, y: number, z: number) => m.makeRotationFromEuler(E.set(x, y, z));
const MAXD = 22; // drivers drawn inside AI cars
const SLOTS = PED_MAX + MAXD;
const POLICE = { shirt: new THREE.Color('#1d2c4d'), pants: new THREE.Color('#151a26') };
type Parts = Record<'pelvis' | 'torso' | 'head' | 'hair' | 'uarm' | 'farm' | 'thigh' | 'shin' | 'foot', THREE.InstancedMesh>;

/** Write one character's matrices from a pose (same skeleton as player/character.ts). */
function writeRig(P: Parts, i: number, root: THREE.Matrix4, pose: A.Pose) {
  J.copy(root).multiply(T.makeTranslation(0, pose.oy + 0.18 * pose.fall, pose.oz)).multiply(rot(R, pose.fall * (pose.fdir > 0 ? -Math.PI / 2 : Math.PI / 2), 0, pose.fall * pose.fside * 0.6));
  H.copy(J).multiply(T.makeTranslation(0, pose.hy, 0)).multiply(rot(R, pose.hx, pose.hr, pose.hz));
  M.copy(H).multiply(R.makeRotationZ(Math.PI / 2)).multiply(T.makeScale(1, 1.15, 0.8)); P.pelvis.setMatrixAt(i, M);
  SP.copy(H).multiply(T.makeTranslation(0, 0.1, 0)).multiply(rot(R, pose.sx, pose.sy, pose.sz));
  M.copy(SP).multiply(T.makeTranslation(0, 0.3, 0)).multiply(R.makeScale(1.15, 1, 0.75)); P.torso.setMatrixAt(i, M);
  HD.copy(SP).multiply(T.makeTranslation(0, 0.66, 0)).multiply(rot(R, pose.nx, pose.ny, 0));
  M.copy(HD).multiply(T.makeTranslation(0, 0.1, 0)).multiply(R.makeScale(0.95, 1.1, 1)); P.head.setMatrixAt(i, M);
  M.copy(HD).multiply(T.makeTranslation(0, 0.12, -0.01)); P.hair.setMatrixAt(i, M);
  for (let k = 0; k < 2; k++) {
    const sg = k ? 1 : -1, j = i * 2 + k;
    AT.copy(SP).multiply(T.makeTranslation(sg * 0.25, 0.53, 0)).multiply(rot(R, pose.ax[k], pose.ay[k], pose.az[k]));
    M.copy(AT).multiply(T.makeTranslation(0, -0.15, 0)); P.uarm.setMatrixAt(j, M);
    MID.copy(AT).multiply(T.makeTranslation(0, -0.3, 0)).multiply(R.makeRotationX(pose.ae[k]));
    M.copy(MID).multiply(T.makeTranslation(0, -0.14, 0)); P.farm.setMatrixAt(j, M);
    LT.copy(H).multiply(T.makeTranslation(sg * 0.11, -0.02, 0)).multiply(rot(R, pose.lx[k], 0, pose.lz[k]));
    M.copy(LT).multiply(T.makeTranslation(0, -0.23, 0)); P.thigh.setMatrixAt(j, M);
    MID.copy(LT).multiply(T.makeTranslation(0, -0.46, 0)).multiply(R.makeRotationX(pose.lk[k]));
    M.copy(MID).multiply(T.makeTranslation(0, -0.225, 0)); P.shin.setMatrixAt(j, M);
    M.copy(MID).multiply(T.makeTranslation(0, -0.45, 0.06)); P.foot.setMatrixAt(j, M);
  }
}
function hide(P: Parts, i: number) { for (const n of ['pelvis', 'torso', 'head', 'hair'] as const) P[n].setMatrixAt(i, ZERO); for (const n of ['uarm', 'farm', 'thigh', 'shin', 'foot'] as const) { P[n].setMatrixAt(i * 2, ZERO); P[n].setMatrixAt(i * 2 + 1, ZERO); } }

/** Pose for a pedestrian this frame. */
function pedPose(p: Ped, out: A.Pose, tmp: A.Pose, t: number) {
  const sp = Math.hypot(p.vx, p.vz), tt = t + (p.look % 100);
  switch (p.state) {
    case 'dead': A.lying(out, p.fdir, p.fside, p.look % 97); out.fall = p.fall; break;
    case 'down': A.lying(out, p.fdir, p.fside * 0.5, p.look % 89); out.fall = p.fall; break;
    case 'getup': A.getUp(out, p.fdir, 1 - Math.max(0, p.t)); break;
    case 'cower': A.cower(out, tt); break;
    case 'hands': case 'handsup': A.idle(out, tt, 'breathe', 0, p.gait); A.handsUp(out, tt); break;
    case 'idle': case 'wait': {
      const k = p.state === 'idle' ? A.env(1 - Math.max(0, p.t) / Math.max(1, p.idleDur), 0.15, 0.2) : 0.8;
      A.idle(out, tt, p.state === 'wait' ? (p.look % 2 ? 'look' : 'tap') : p.idleV, k, p.gait); break;
    }
    default: {
      A.locomotion(out, p.phase, sp, p.gait);
      if (p.state === 'flee' && p.flail) { A.copyPose(tmp, out); A.flail(tmp, tt); A.blendUpper(out, tmp, 0.85); }
      else if (p.gait.kind === 'texting' && p.state !== 'flee') { A.copyPose(tmp, out); A.texting(tmp); A.blendUpper(out, tmp, 1); }
      else if (p.gait.kind === 'caller' && p.state !== 'flee') { A.copyPose(tmp, out); A.phoneCall(tmp); A.blendUpper(out, tmp, 1); }
    }
  }
  if (p.fall > 0 && p.state !== 'dead' && p.state !== 'down' && p.state !== 'getup') out.fall = Math.max(out.fall, p.fall);
  out.ny += p.head;
}

/** All pedestrians and AI drivers in nine instanced draws, animated with the shared pose library. */
export function PedsView() {
  const parts = useMemo(() => {
    const mk = (g: THREE.BufferGeometry, n: number, shadow = true) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.75 }), n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = shadow; m.frustumCulled = false; for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, new THREE.Color(1, 1, 1)); } return m; };
    return {
      pelvis: mk(new THREE.CapsuleGeometry(0.17, 0.12, 3, 8), SLOTS), torso: mk(new THREE.CapsuleGeometry(0.2, 0.32, 4, 10), SLOTS),
      head: mk(new THREE.SphereGeometry(0.13, 12, 10), SLOTS), hair: mk(new THREE.SphereGeometry(0.138, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), SLOTS, false),
      uarm: mk(new THREE.CapsuleGeometry(0.055, 0.19, 3, 8), SLOTS * 2), farm: mk(new THREE.CapsuleGeometry(0.047, 0.19, 3, 8), SLOTS * 2, false),
      thigh: mk(new THREE.CapsuleGeometry(0.075, 0.31, 3, 8), SLOTS * 2), shin: mk(new THREE.CapsuleGeometry(0.064, 0.32, 3, 8), SLOTS * 2),
      foot: mk(new THREE.BoxGeometry(0.11, 0.08, 0.26), SLOTS * 2, false),
    } as Parts;
  }, []);
  const colored = useRef(new Map<number, number>());
  const pose = useMemo(() => A.newPose(), []), tmp = useMemo(() => A.newPose(), []);
  const paint = (i: number, h: number, police: boolean) => {
    const P = parts, shirt = police ? POLICE.shirt : SHIRT[h % SHIRT.length], pants = police ? POLICE.pants : PANTS[(h >> 12) % PANTS.length], skin = SKIN[(h >> 4) % SKIN.length];
    P.torso.setColorAt(i, shirt); P.pelvis.setColorAt(i, pants); P.head.setColorAt(i, skin); P.hair.setColorAt(i, HAIR[(h >> 8) % HAIR.length]);
    for (const k of [0, 1]) { const j = i * 2 + k; P.uarm.setColorAt(j, shirt); P.farm.setColorAt(j, (h >> 3) % 3 ? skin : shirt); P.thigh.setColorAt(j, pants); P.shin.setColorAt(j, pants); P.foot.setColorAt(j, SHOE[(h >> 6) % SHOE.length]); }
    for (const m of Object.values(P)) m.instanceColor!.needsUpdate = true;
  };
  useFrame(({ camera }) => {
    const P = parts, t = performance.now() / 1000;
    for (let i = 0; i < PED_MAX; i++) {
      const p = peds[i];
      if (!p || Math.abs(p.x - camera.position.x) > 160 || Math.abs(p.z - camera.position.z) > 160) { hide(P, i); continue; }
      if (colored.current.get(i) !== p.id) { colored.current.set(i, p.id); paint(i, p.look, false); }
      Q.setFromAxisAngle(UP, p.yaw); V.set(p.x, p.y, p.z); S.setScalar(p.scale); B.compose(V, Q, S);
      pedPose(p, pose, tmp, t); writeRig(P, i, B, pose);
    }
    // drivers behind the wheel of AI traffic, police and the cash truck
    let d = 0;
    for (const v of vehicles) {
      if (d >= MAXD) break;
      if (!v.ai || v.dead || v.def.kind === 'bike' || v.id === game.inCar) continue;
      if (Math.abs(v.x - camera.position.x) > 110 || Math.abs(v.z - camera.position.z) > 110) continue;
      const i = PED_MAX + d++, seat = A.seatFor(v.def.kind), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      if (colored.current.get(i) !== v.id) { colored.current.set(i, v.id); paint(i, v.id * 7919 + 13, v.role === 'police'); }
      Q.setFromEuler(E.set(-v.pitch - v.squat, v.yaw, v.roll, 'YXZ')); V.set(v.x + lx * v.def.wid * seat.side + fx * seat.fwd, v.y + seat.y, v.z + lz * v.def.wid * seat.side + fz * seat.fwd); S.setScalar(1); B.compose(V, Q, S); E.order = 'XYZ';
      A.seated(pose, -v.steer / Math.max(0.2, v.def.steer), seat.recline, t + v.id); writeRig(P, i, B, pose);
    }
    for (let i = PED_MAX + d; i < SLOTS; i++) hide(P, i);
    for (const m of Object.values(P)) m.instanceMatrix.needsUpdate = true;
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
  const fire = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 36); m.frustumCulled = false; for (let i = 0; i < 36; i++) m.setColorAt(i, new THREE.Color(1, 1, 1)); return m; }, [glow]);
  const smokeB = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, color: '#2a2724', transparent: true, depthWrite: false, opacity: 0.8 }), 24); m.frustumCulled = false; return m; }, [glow]);
  const nades = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 1.25, 1), new THREE.MeshStandardMaterial({ color: '#3a4a2a', roughness: 0.6 }), 10); m.frustumCulled = false; return m; }, []);
  const fcol = useMemo(() => [new THREE.Color(3, 1.6, 0.4), new THREE.Color(2.4, 0.7, 0.15), new THREE.Color(3, 2.6, 1.4)], []);
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
    // explosions: three fire puffs + two smoke puffs per blast
    let fi = 0, si = 0;
    for (const b of booms) {
      const age = 1.4 - b.t, k = Math.min(1, age / 0.25);
      for (let j = 0; j < 3 && fi < 36; j++, fi++) { const a = j * 2.1 + b.x; V.set(b.x + Math.cos(a) * 1.2 * k, b.y + 0.6 + j * 0.7 * k + age * 1.5, b.z + Math.sin(a) * 1.2 * k); S.setScalar(b.t > 0.9 ? (3 + j) * b.s * (0.5 + k) : 0.0001); M.compose(V, q, S); fire.setMatrixAt(fi, M); fire.setColorAt(fi, fcol[j]); }
      for (let j = 0; j < 2 && si < 24; j++, si++) { V.set(b.x + (j - 0.5) * 2, b.y + 2 + age * 3.5 + j, b.z); S.setScalar((4 + age * 5) * b.s); M.compose(V, q, S); smokeB.setMatrixAt(si, M); }
    }
    for (; fi < 36; fi++) fire.setMatrixAt(fi, ZERO); for (; si < 24; si++) smokeB.setMatrixAt(si, ZERO);
    fire.instanceMatrix.needsUpdate = true; if (fire.instanceColor) fire.instanceColor.needsUpdate = true; smokeB.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 10; i++) { const g = grenades[i]; if (g) { Q.setFromAxisAngle(UP, g.spin); V.set(g.x, g.y, g.z); S.setScalar(1); M.compose(V, Q, S); nades.setMatrixAt(i, M); } else nades.setMatrixAt(i, ZERO); }
    nades.instanceMatrix.needsUpdate = true;
    const L = combat.lock, m = lock.current;
    if (m) { m.visible = !!L; if (L) { const p = 'ped' in L ? { x: L.ped.x, y: L.ped.y + 2.2, z: L.ped.z } : { x: L.veh.x, y: L.veh.y + L.veh.def.hgt + 0.7, z: L.veh.z }; m.position.set(p.x, p.y, p.z); m.quaternion.copy(q); } }
  });
  return (
    <>
      <primitive object={smokeB} /><primitive object={fire} /><primitive object={nades} />
      <primitive object={flashes} /><primitive object={hits} /><primitive object={cash} /><primitive object={lines} />
      <mesh ref={lock} visible={false}><ringGeometry args={[0.22, 0.3, 24]} /><meshBasicMaterial color="#ff3a4a" toneMapped={false} depthTest={false} transparent /></mesh>
    </>
  );
}
