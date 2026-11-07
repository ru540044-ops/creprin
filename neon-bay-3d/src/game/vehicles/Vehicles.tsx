import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vehicles, stream, drive, collisions, Veh, playerCar, remove } from './sim';
import { buildCarModel, CarModel } from './models';
import { game, toast } from '../state/store';
import { input } from '../input';
import { engine } from '../audio';
import { getTextures, labelTexture } from '../world/textures';
import { GARAGE } from '../world/cityGen';

const models = new Map<number, CarModel>();

/** Driving controls: keyboard WASD/arrows + Space, or the touch pedal/steer buttons, or the stick x-axis. */
export function driveInput() {
  const k = input.keys, [jx] = input.joyActive ? [input.joyX] : [0];
  const thr = Math.max(k.has('w') || k.has('arrowup') || input.gas ? 1 : 0, 0);
  const brake = k.has('s') || k.has('arrowdown') || input.brake ? 1 : 0;
  let steer = (k.has('d') || k.has('arrowright') || input.right ? 1 : 0) - (k.has('a') || k.has('arrowleft') || input.left ? 1 : 0);
  if (input.joyActive) steer = jx;
  return { thr, brake, steer, hb: k.has(' ') || input.hb };
}

function Smoke() {
  const N = 90, ref = useRef<THREE.InstancedMesh>(null!);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: getTextures().glow, color: '#555560', transparent: true, depthWrite: false, opacity: 0.55 }), []);
  const fire = useMemo(() => new THREE.MeshBasicMaterial({ map: getTextures().glow, color: '#ff7a22', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const parts = useMemo(() => Array.from({ length: N }, () => ({ x: 0, y: -999, z: 0, s: 1, life: 0, max: 1, f: false })), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const fref = useRef<THREE.InstancedMesh>(null!);
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), sc = useMemo(() => new THREE.Vector3(), []), pos = useMemo(() => new THREE.Vector3(), []);
  let cur = 0;
  useFrame(({ camera }, dt) => {
    for (const v of vehicles) {
      const dmg = 1 - v.hp / v.def.hp; if (dmg < 0.6 && !v.dead) continue;
      if (Math.random() < dt * (v.dead ? 22 : 8)) { const p = parts[cur]; cur = (cur + 1) % N; const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); p.x = v.x + fx * v.def.len * 0.35; p.z = v.z + fz * v.def.len * 0.35; p.y = v.y + 1; p.life = p.max = 1.6; p.s = 1; p.f = v.dead && Math.random() < 0.6; }
    }
    q.copy(camera.quaternion);
    for (let i = 0; i < N; i++) {
      const p = parts[i]; if (p.life > 0) { p.life -= dt; p.y += dt * (p.f ? 2.5 : 1.6); p.s += dt * 1.6; }
      const k = Math.max(0, p.life / p.max); sc.setScalar(p.life > 0 ? p.s * (p.f ? 1 - k * 0.3 : 1) : 0.0001); pos.set(p.x, p.y, p.z); m4.compose(pos, q, sc);
      (p.f ? fref.current : ref.current).setMatrixAt(i, m4); (p.f ? ref.current : fref.current).setMatrixAt(i, m4.makeScale(0, 0, 0));
    }
    ref.current.instanceMatrix.needsUpdate = true; fref.current.instanceMatrix.needsUpdate = true;
  });
  return <><instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} /><instancedMesh ref={fref} args={[geo, fire, N]} frustumCulled={false} /></>;
}

/** The garage: entrance ring + sign at the street, big sign on the building, painted bays. */
function GarageSign() {
  const t = useMemo(() => labelTexture('GARAGE', '#3dffb0'), []);
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (ring.current) { const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.06; ring.current.scale.set(s, s, 1); } });
  const front = GARAGE.block.z1 - 34;
  return (
    <group>
      <group position={[GARAGE.x, 0.17, GARAGE.z + 3]}>
        <mesh ref={ring} rotation-x={-Math.PI / 2}><ringGeometry args={[2.2, 2.6, 40]} /><meshBasicMaterial color="#3dffb0" toneMapped={false} transparent opacity={0.85} /></mesh>
        <mesh position={[7, 5, -0.01]} rotation-y={Math.PI}><planeGeometry args={[5.2, 1.3]} /><meshBasicMaterial map={t} toneMapped={false} /></mesh>
        <mesh position={[7, 5, 0.01]}><planeGeometry args={[5.2, 1.3]} /><meshBasicMaterial map={t} toneMapped={false} /></mesh>
        <mesh position={[7, 2.2, 0.02]}><boxGeometry args={[0.18, 4.4, 0.18]} /><meshStandardMaterial color="#2a2f3a" metalness={0.6} roughness={0.35} /></mesh>
      </group>
      <mesh position={[GARAGE.x, 7.2, front - 0.06]} rotation-y={Math.PI}><planeGeometry args={[14, 3.5]} /><meshBasicMaterial map={t} toneMapped={false} /></mesh>
      {GARAGE.slots.map((sl, i) => (
        <mesh key={i} position={[sl.x, 0.17, sl.z]} rotation-x={-Math.PI / 2} scale={[0.62, 1.25, 1]}><ringGeometry args={[2.9, 3.05, 4, 1, Math.PI / 4]} /><meshBasicMaterial color="#e8e8f0" transparent opacity={0.55} /></mesh>
      ))}
    </group>
  );
}

function VehicleView({ v }: { v: Veh }) {
  const m = useMemo(() => { const mm = buildCarModel(v.def, v.color); models.set(v.id, mm); return mm; }, [v]);
  useFrame(() => {
    m.root.position.set(v.x, v.y, v.z); m.root.rotation.y = v.yaw;
    m.tilt.rotation.x = -v.pitch; m.tilt.rotation.z = v.def.kind === 'bike' ? v.lean : v.roll;
    if (m.paint.color.getHexString() !== v.color.slice(1)) m.paint.color.set(v.color);
    const dmg = 1 - v.hp / v.def.hp; m.paint.roughness = 0.28 + dmg * 0.5; m.paint.metalness = 0.55 - dmg * 0.35;
    m.body.position.y = v.dead ? -0.08 : 0; m.body.rotation.z = v.dead ? 0.03 : 0;
    const nightK = game.hour > 18.6 || game.hour < 6.2 ? 1 : 0, mine = v.id === game.inCar;
    m.lights.head.emissiveIntensity = v.dead ? 0 : mine ? 0.6 + nightK * 2.2 : 0.15;
    m.lights.tail.emissiveIntensity = v.dead ? 0 : v.braking ? 3 : mine ? 0.6 + nightK * 0.9 : 0.25;
    m.wheels.forEach((w, i) => { w.rotation.z = -v.spin; const front = v.def.kind === 'bike' ? i === 0 : w.position.x > 0; w.rotation.y = front ? v.steer : 0; });
  });
  return <primitive object={m.root} />;
}

export default function Vehicles() {
  const list = useRef<number[]>([]);
  const ver = useRef(0);
  const force = useRef<() => void>(() => {});
  const headSpot = useRef<THREE.SpotLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  const [, setTick] = useMemoState();
  force.current = setTick;
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt), p = game.player, me = playerCar();
    const fx = me ? me.x : game.where === 'out' ? p.x : game.outsidePos.x, fz = me ? me.z : game.where === 'out' ? p.z : game.outsidePos.z;
    stream(fx, fz, dt);
    // physics: player car is driven, others coast and settle
    const sub = 2, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const v of vehicles) {
        if (v === me) drive(v, game.started ? driveInput() : null, h);
        else if (Math.abs(v.vx) + Math.abs(v.vz) > 0.02) drive(v, null, h);
      }
      const hit = collisions(h);
      if (hit > 4 && me) { game.shake = Math.min(1.2, hit / 18); }
    }
    for (const v of vehicles) if (v.dead && v.burn > 0) v.burn -= dt;
    // burnt-out owned cars are towed back to the garage (repaired) once you walk away
    for (const v of [...vehicles]) if (v.dead && v.burn <= 0 && v.owned >= 0 && v.id !== game.inCar && Math.hypot(v.x - fx, v.z - fz) > 45) { remove(v); toast(v.def.name + 'はガレージで修理された', 2.4); }
    if (me) { const c = driveInput(); engine(game.started, me.rpm, me.gear, c.thr, me.slip, me.def.kind); game.speed = Math.hypot(me.vx, me.vz); }
    else engine(false, 0, 0, 0, 0, '');
    // headlight cone for the player's car at night
    const L = headSpot.current;
    if (L) { const night = game.hour > 18.6 || game.hour < 6.2; L.intensity = me && night && !me.dead ? 900 : 0; if (me) { const fxx = Math.sin(me.yaw), fzz = Math.cos(me.yaw); L.position.set(me.x + fxx * me.def.len * 0.5, me.y + 0.8, me.z + fzz * me.def.len * 0.5); target.position.set(me.x + fxx * 25, me.y, me.z + fzz * 25); target.updateMatrixWorld(); } }
    // re-render the list when vehicles spawn or despawn
    const ids = vehicles.map((v) => v.id); if (ids.length !== list.current.length || ids.some((id, i) => id !== list.current[i])) { list.current = ids; for (const id of [...models.keys()]) if (!ids.includes(id)) models.delete(id); ver.current++; force.current(); }
  });
  return (
    <>
      {vehicles.map((v) => <VehicleView key={v.id} v={v} />)}
      <Smoke />
      <GarageSign />
      <primitive object={target} />
      <spotLight ref={headSpot} target={target} angle={0.55} penumbra={0.6} distance={75} decay={1.5} color="#fff1d0" intensity={0} />
    </>
  );
}

function useMemoState(): [number, () => void] { const [n, setN] = useState(0); return [n, () => setN((x) => x + 1)]; }
