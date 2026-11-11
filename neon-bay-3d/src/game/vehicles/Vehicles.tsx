import { music } from '../audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { vehicles, stream, drive, collisions, Veh, playerCar, remove } from './sim';
import { buildCarModel, CarModel, applyMods, disposeCarModel } from './models';
import { isBoat } from './defs';
import { explode, tickExplosives } from '../combat/explode';
import { game, toast } from '../state/store';
import { input } from '../input';
import { engine, trainSound } from '../audio';
import { line, limitAt } from '../line/line';
import { getTextures, labelTexture } from '../world/textures';
import { GARAGE } from '../world/cityGen';
import { updateCrime, law } from '../crime/crime';
import { updateTraffic } from '../ai/traffic';
import { updatePeds } from '../ai/peds';
import { tickFx } from '../combat/fx';
import { radioTick } from '../radio';
import { tickWeapons } from '../combat/weapons';
import { flash } from '../combat/fx';
import { sfx } from '../audio';
import { tdt, admin } from '../admin';
import { race } from '../crime/race';

export const models = new Map<number, CarModel>();

/** Driving controls: keyboard WASD/arrows + Space, or the touch pedal/steer buttons, or the stick x-axis. */
export function driveInput(kind = '') {
  const k = input.keys, [jx] = input.joyActive ? [input.joyX] : [0];
  const thr = Math.max(k.has('w') || k.has('arrowup') || input.gas ? 1 : 0, 0);
  const brake = k.has('s') || k.has('arrowdown') || input.brake ? 1 : 0;
  let steer = (k.has('d') || k.has('arrowright') || input.right ? 1 : 0) - (k.has('a') || k.has('arrowleft') || input.left ? 1 : 0);
  if (input.joyActive) steer = jx;
  const heli = kind === 'heli', lift = (k.has(' ') || input.up ? 1 : 0) - ((heli && k.has('shift')) || k.has('control') || k.has('c') || input.down ? 1 : 0);
  return { thr, brake, steer, hb: kind === 'jet' ? false : k.has(' ') || input.hb, lift, nitro: (!heli && k.has('shift')) || input.nitro };
}

/** Tyre smoke and skid marks from sliding / hard-braking / burnouts. */
function TireFX() {
  const NS = 70, NK = 800, glow = getTextures().glow;
  const smoke = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, color: '#d8d8dc', transparent: true, depthWrite: false, opacity: 0.5 }), NS); m.frustumCulled = false; return m; }, [glow]);
  const marks = useMemo(() => { const g = new THREE.PlaneGeometry(0.26, 0.5).rotateX(-Math.PI / 2); const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#0b0b0d', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), NK); m.frustumCulled = false; const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < NK; i++) m.setMatrixAt(i, z); return m; }, []);
  const S = useMemo(() => ({ puffs: Array.from({ length: NS }, () => ({ x: 0, y: -99, z: 0, t: 0, s: 1 })), ps: 0, mk: 0, last: new Map<number, [number, number][]>(), age: new Float32Array(NK) }), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), p3 = useMemo(() => new THREE.Vector3(), []), s3 = useMemo(() => new THREE.Vector3(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ camera }, dt) => {
    let markDirty = false;
    for (const v of vehicles) {
      const sp = Math.hypot(v.vx, v.vz); if (sp < 2.5 || v.def.kind === 'bike' || v.def.kind === 'heli' || v.air) { S.last.delete(v.id); continue; }
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), hard = v.braking && sp > 12 && !v.reversing;
      const skid = v.slip > 4 || hard || (v.id === game.inCar && v.rpm > 0.85 && sp < 7 && v.gear === 0);
      if (!skid) { S.last.delete(v.id); continue; }
      const rx = -v.def.wheelbase / 2, wz = v.def.wid / 2 - 0.16, prev = S.last.get(v.id) || [];
      const now: [number, number][] = [];
      [-1, 1].forEach((sd, k) => {
        const x = v.x + fx * rx + lx * sd * wz, z = v.z + fz * rx + lz * sd * wz; now.push([x, z]);
        const pv = prev[k];
        if (!pv || Math.hypot(x - pv[0], z - pv[1]) > 0.42) {
          const i = S.mk; S.mk = (S.mk + 1) % NK; S.age[i] = 25;
          q.setFromAxisAngle(up, pv ? Math.atan2(x - pv[0], z - pv[1]) : v.yaw); p3.set(x, v.y + 0.03, z); s3.set(1, 1, 1); m4.compose(p3, q, s3); marks.setMatrixAt(i, m4); markDirty = true;
          if (Math.random() < (v.slip > 4 ? 0.7 : 0.35)) { const P = S.puffs[S.ps]; S.ps = (S.ps + 1) % NS; P.x = x; P.y = v.y + 0.3; P.z = z; P.t = 1.4; P.s = 0.6; }
        } else now[k] = pv;
      });
      S.last.set(v.id, now);
    }
    for (let i = 0; i < NK; i++) if (S.age[i] > 0 && (S.age[i] -= dt) <= 0) { marks.setMatrixAt(i, m4.makeScale(0, 0, 0)); markDirty = true; }
    if (markDirty) marks.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NS; i++) { const P = S.puffs[i]; if (P.t > 0) { P.t -= dt; P.y += dt * 0.9; P.s += dt * 2.2; } p3.set(P.x, P.y, P.z); s3.setScalar(P.t > 0 ? P.s : 0.0001); m4.compose(p3, camera.quaternion, s3); smoke.setMatrixAt(i, m4); }
    smoke.instanceMatrix.needsUpdate = true;
  });
  return <><primitive object={marks} /><primitive object={smoke} /></>;
}

/** White water: foam trails and bow spray behind moving boats. */
function Wakes() {
  const N = 140, glow = getTextures().glow;
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glow, color: '#eef6ff', transparent: true, depthWrite: false, opacity: 0.75 }), N); m.frustumCulled = false; return m; }, [glow]);
  const S = useMemo(() => ({ p: Array.from({ length: N }, () => ({ x: 0, z: 0, y: -99, t: 0, s: 1, g: 1 })), i: 0, acc: 0 }), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), p3 = useMemo(() => new THREE.Vector3(), []), s3 = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    S.acc += dt;
    if (S.acc > 0.06) { S.acc = 0; for (const v of vehicles) { if (!isBoat(v.def.kind)) continue; const sp = Math.hypot(v.vx, v.vz); if (sp < 2) continue; const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); for (const side of [-1, 1]) { const P = S.p[S.i]; S.i = (S.i + 1) % N; P.x = v.x - fx * v.def.len * 0.48 + fz * side * v.def.wid * 0.3; P.z = v.z - fz * v.def.len * 0.48 - fx * side * v.def.wid * 0.3; P.y = v.y + 0.12; P.t = 2.6; P.s = v.def.wid * 0.6; P.g = 0.6 + sp * 0.12; } } }
    for (let i = 0; i < N; i++) { const P = S.p[i]; if (P.t > 0) { P.t -= dt; P.s += dt * P.g; } p3.set(P.x, P.y, P.z); s3.set(P.t > 0 ? P.s : 0.0001, 1, P.t > 0 ? P.s * 1.6 : 0.0001); m4.compose(p3, q, s3); mesh.setMatrixAt(i, m4); }
    mesh.instanceMatrix.needsUpdate = true; (mesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
  });
  return <primitive object={mesh} />;
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
  useEffect(() => () => disposeCarModel(m), [m]); // free the car's GPU memory when it leaves the world
  useFrame(({ camera }) => {
    m.root.visible = Math.abs(v.x - camera.position.x) < 220 && Math.abs(v.z - camera.position.z) < 220;
    if (!m.root.visible) return;
    { const dx = v.x - camera.position.x, dz = v.z - camera.position.z, d2 = dx * dx + dz * dz, mine = v.id === game.inCar; // interior and small parts only close up
      if (m.cabin && m.cabin.length) { const show = d2 < 1225 || mine; if (m.cabin[0].visible !== show) for (const c of m.cabin) c.visible = show; }
      if (m.small && m.small.length) { const show = d2 < 4900 || mine; if (m.small[0].visible !== show) for (const c of m.small) c.visible = show; } }
    m.root.position.set(v.x, v.y, v.z); m.root.rotation.y = v.yaw;
    m.tilt.rotation.x = -v.pitch - v.squat; m.tilt.rotation.z = v.def.kind === 'bike' ? v.lean : v.roll;
    const key = v.color + JSON.stringify(v.mods) + v.exploded;
    if (m.modKey !== key) { m.modKey = key; m.paint.color.set(v.exploded ? '#141210' : v.color); applyMods(m, v.mods); if (v.exploded && m.neon) m.neon.visible = false; }
    const dmg = 1 - v.hp / v.def.hp, bm = m.paint.userData.metal ?? 0.55, br = m.paint.userData.rough ?? 0.28; m.paint.roughness = v.exploded ? 0.95 : br + dmg * 0.45; m.paint.metalness = v.exploded ? 0.2 : bm * (1 - dmg * 0.6);
    if (m.rotors) { m.rotors.main.rotation.y = v.spin; m.rotors.tail.rotation.z = v.spin * 1.7; }
    if (m.neon && m.neon.visible) (m.neon.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(performance.now() / 300) * 0.1;
    m.body.position.y = v.dead ? -0.08 : 0; m.body.rotation.z = v.dead ? 0.03 : 0;
    const nightK = game.hour > 18.6 || game.hour < 6.2 ? 1 : 0, mine = v.id === game.inCar;
    m.lights.head.emissiveIntensity = v.dead ? 0 : mine ? 0.6 + nightK * 2.2 : 0.15;
    m.lights.tail.emissiveIntensity = v.dead ? 0 : v.braking ? 3 : mine ? 0.6 + nightK * 0.9 : 0.25;
    if (m.lights.bar) { const on = !v.dead && !!v.ai && v.ai.mode === 'chase' && game.wanted > 0, ph = Math.floor(performance.now() / 160) % 2; m.lights.bar[0].emissiveIntensity = on ? (ph ? 5 : 0.3) : 0.15; m.lights.bar[1].emissiveIntensity = on ? (ph ? 0.3 : 5) : 0.15; }
    if (m.door) m.door.rotation.y = 1.15 * v.door; // right-hand door swings out to the right
    if (m.steering) m.steering.rotation.x = -v.steer * 4.5;
    if (m.burner) for (const b of m.burner) { const mm = b.material as THREE.MeshBasicMaterial; mm.opacity = v.dead ? 0 : v.nitroOn ? 0.95 : v.rotor * 0.35; b.scale.set(v.nitroOn ? 1.4 + Math.random() * 0.3 : 0.6 + v.rotor * 0.5, 1, 1); }
    if (m.gear) m.gear.visible = !v.air;
    const blinkOn = Math.floor(performance.now() / 360) % 2 === 0;
    if (m.lights.blinkL) { m.lights.blinkL.emissiveIntensity = (v.blink === 1 || v.blink === 2) && blinkOn ? 3.5 : 0; m.lights.blinkR!.emissiveIntensity = (v.blink === -1 || v.blink === 2) && blinkOn ? 3.5 : 0; m.lights.rev!.emissiveIntensity = v.reversing && !v.dead ? 2.5 : 0; }
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
    const dt = tdt(Math.min(0.05, rawDt)), p = game.player, me = playerCar();
    const fx = me ? me.x : game.where === 'out' ? p.x : game.outsidePos.x, fz = me ? me.z : game.where === 'out' ? p.z : game.outsidePos.z;
    stream(fx, fz, dt);
    updateCrime(dt); // wanted level, police + cash-truck AI decide their controls here
    updateTraffic(dt);
    // physics: player car is driven, others coast and settle
    // normally two steps a frame; a sped-up admin car gets enough steps to move at most ~1.5 m in each
    const fast = !!me && admin.is && admin.carSpeed > 1 && me.def.kind !== 'shinkansen';
    const sub = fast ? Math.min(12, Math.max(2, Math.ceil((Math.hypot(me!.vx, me!.vz) * dt) / 1.5))) : 2, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const v of vehicles) {
        if (v === me) drive(v, game.started && !law.over && !game.carAnim && !(race.id && race.count > 0) ? driveInput(v.def.kind) : null, h);
        else if (v.ai) drive(v, v.ai.ctl, h);
        else if (Math.abs(v.vx) + Math.abs(v.vz) > 0.02) drive(v, null, h);
      }
      const hit = collisions(h);
      if (hit > 4 && me) { game.shake = Math.min(1.2, hit / 18); }
    }
    tickWeapons(dt);
    for (const v of vehicles) {
      // turn signals for AI drivers, hazards on a stopped cash truck
      if (v.ai && v.ai.ctl) { const s = v.ai.ctl.steer, sp = Math.hypot(v.vx, v.vz); if (Math.abs(s) > 0.35 && sp < 11) { v.blink = s > 0 ? -1 : 1; v.blinkT = 0.9; } else if ((v.blinkT -= dt) <= 0) v.blink = 0; }
      if (v.role === 'armored' && v.ai && !v.ai.ctl?.thr && Math.hypot(v.vx, v.vz) < 0.5) v.blink = 2;
      // exhaust backfire on hard upshifts (sports cars)
      if (v.gear > v.gearPrev && v.id === game.inCar && (v.def.kind === 'super' || v.def.kind === 'sport') && v.rpm > 0.6) { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); flash(v.x - fx * (v.def.len / 2 + 0.15), v.y + 0.38, v.z - fz * (v.def.len / 2 + 0.15), 0.9); sfx('shot', 0.18); }
      v.gearPrev = v.gear;
    }
    updatePeds(dt); tickFx(dt); radioTick((!!me && game.started) || (!game.started && music.title), game.started ? game.radio : 1);
    for (const v of vehicles) if (v.dead && v.burn > 0) v.burn -= dt;
    // burning wrecks explode (chain reactions come from explode() setting short fuses on neighbours)
    for (const v of [...vehicles]) if (v.dead && v.burn <= 0 && !v.exploded) { v.exploded = true; explode(v.x, v.y + 0.8, v.z, v.def.kind === 'truck' || v.def.kind === 'armored' || v.def.kind === 'heli' ? 1.3 : 1, false); }
    tickExplosives(dt);
    for (const v of vehicles) if (v.nitroOn) { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); flash(v.x - fx * (v.def.len / 2 + 0.3), v.y + 0.38, v.z - fz * (v.def.len / 2 + 0.3), 0.7 + Math.random() * 0.4); }
    // burnt-out owned cars are towed back to the garage (repaired) once you walk away
    for (const v of [...vehicles]) if (v.dead && v.burn <= 0 && v.exploded && v.owned >= 0 && v.id !== game.inCar && Math.hypot(v.x - fx, v.z - fz) > 45) { remove(v); toast(v.def.name + 'はガレージで修理された', 2.4); }
    const train = !!me && me.def.kind === 'shinkansen';
    if (me) { const c = driveInput(me.def.kind); engine(game.started && !train, me.rpm, me.gear, c.thr, me.slip, me.def.kind); trainSound(game.started && train, Math.abs(me.vz) * 3.6, c.thr, c.brake, game.tunnel, dt); game.speed = Math.hypot(me.vx, me.vz); }
    else if (line.on) { engine(false, 0, 0, 0, 0, ''); trainSound(game.started, line.v * 3.6, line.v < limitAt(line.s) - 2 ? 0.7 : 0, 0, game.tunnel, dt); } // a passenger seat on the line between cities
    else { engine(false, 0, 0, 0, 0, ''); trainSound(false, 0, 0, 0, 0, dt); }
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
      <TireFX />
      <Wakes />
      <GarageSign />
      <primitive object={target} />
      <spotLight ref={headSpot} target={target} angle={0.55} penumbra={0.6} distance={75} decay={1.5} color="#fff1d0" intensity={0} />
    </>
  );
}

function useMemoState(): [number, () => void] { const [n, setN] = useState(0); return [n, () => setN((x) => x + 1)]; }
