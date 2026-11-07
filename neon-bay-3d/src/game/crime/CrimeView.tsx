import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { labelTexture } from '../world/textures';
import { LANDMARKS, EXPORT_DOCK, TRIALS, Landmark, RAMPS, Ramp, HELIPADS, CUSTOMS } from '../world/cityGen';
import { game } from '../state/store';
import { trial, trialDef } from './crime';

function Sign({ x, z, y = 5, ang = 0, text, color, w = 5.2 }: { x: number; z: number; y?: number; ang?: number; text: string; color: string; w?: number }) {
  const t = useMemo(() => labelTexture(text, color), [text, color]);
  return (
    <group position={[x, y, z]} rotation-y={ang}>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[w, w / 4]} /><meshBasicMaterial map={t} toneMapped={false} /></mesh>
      <mesh position={[0, 0, -0.01]} rotation-y={Math.PI}><planeGeometry args={[w, w / 4]} /><meshBasicMaterial map={t} toneMapped={false} /></mesh>
    </group>
  );
}
function Ring({ x, z, r, color, pulse = true }: { x: number; z: number; r: number; color: string; pulse?: boolean }) {
  const m = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (m.current && pulse) { const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.06; m.current.scale.set(s, s, 1); } });
  return <mesh ref={m} position={[x, 0.2, z]} rotation-x={-Math.PI / 2}><ringGeometry args={[r * 0.86, r, 48]} /><meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} /></mesh>;
}
function LandmarkView({ L }: { L: Landmark }) {
  return <><Sign x={L.x} z={L.z - 0.1} y={6.5} ang={Math.PI} text={L.label} color={L.color} w={9} /><Ring x={L.spawn.x} z={L.spawn.z} r={1.4} color={L.color} pulse={false} /></>;
}

/** Big checkpoint gate for the active time trial. */
function Checkpoint() {
  const g = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const T = trialDef(), G = g.current; if (!G) return;
    G.visible = !!T && game.where === 'out'; if (!T) return;
    const cp = T.cps[trial.i]; if (!cp) return;
    G.position.set(cp.x, 0, cp.z); G.rotation.y = clock.elapsedTime * 0.6;
  });
  return (
    <group ref={g} visible={false}>
      <mesh position={[0, 4, 0]}><torusGeometry args={[6, 0.35, 8, 40]} /><meshBasicMaterial color="#ffd84a" toneMapped={false} /></mesh>
      <mesh position={[0, 0.2, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[9.5, 11, 48]} /><meshBasicMaterial color="#ffd84a" toneMapped={false} transparent opacity={0.6} /></mesh>
    </group>
  );
}

/** Hazard-striped stunt ramp wedge with a support wall and a sign. */
const stripes = (() => { let t: THREE.CanvasTexture | null = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#ffcc00'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#111'; for (let k = -128; k < 256; k += 40) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 20, 0); g.lineTo(k + 148, 128); g.lineTo(k + 128, 128); g.fill(); } t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }; })();
function RampView({ r }: { r: Ramp }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), w = r.w / 2, L = r.len, h = r.h;
    // prism: slope from (z=0,y=0) to (z=L,y=h), back wall at z=L
    const v = [-w, 0, 0, w, 0, 0, w, h, L, -w, h, L, -w, 0, L, w, 0, L];
    const idx = [0, 1, 2, 0, 2, 3, 4, 3, 2, 4, 2, 5, 0, 3, 4, 1, 5, 2];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w / 2, 0, w / 2, L / 2, 0, L / 2, 0, 0, w / 2, 0], 2)); g.computeVertexNormals(); return g;
  }, [r]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.6, side: THREE.DoubleSide }), []);
  return (
    <group position={[r.x, 0.02, r.z]} rotation-y={r.yaw}>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      <Sign x={0} z={-2} y={2.6} ang={0} text={'STUNT JUMP'} color="#ffcc00" w={4} />
    </group>
  );
}
function Helipad({ x, y, z }: { x: number; y: number; z: number }) {
  const t = useMemo(() => labelTexture('H', '#ffffff', 128, 128), []);
  return (
    <group position={[x, y + 0.04, z]}>
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[7, 40]} /><meshStandardMaterial color="#2a2d33" roughness={0.8} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}><ringGeometry args={[6.2, 6.6, 40]} /><meshBasicMaterial color="#ffd23a" toneMapped={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><planeGeometry args={[4.5, 4.5]} /><meshBasicMaterial map={t} transparent toneMapped={false} /></mesh>
    </group>
  );
}

export default function CrimeView() {
  return (
    <>
      {LANDMARKS.map((L) => <LandmarkView key={L.id} L={L} />)}
      <Ring x={EXPORT_DOCK.x} z={EXPORT_DOCK.z} r={9} color="#ff9a3a" />
      <Sign x={EXPORT_DOCK.x} z={EXPORT_DOCK.z + 11} y={5} ang={0} text="EXPORT DOCK" color="#ff9a3a" w={8} />
      {TRIALS.map((T) => <group key={T.id}><Ring x={T.start.x} z={T.start.z} r={7} color="#c07aff" /><Sign x={T.start.x + 8} z={T.start.z} y={4} ang={Math.PI / 2} text={'TIME TRIAL'} color="#c07aff" /></group>)}
      <Checkpoint />
      {RAMPS.map((r) => <RampView key={r.id} r={r} />)}
      {HELIPADS.map((h) => <Helipad key={h.name} x={h.x} y={h.y} z={h.z} />)}
      <LandmarkView L={CUSTOMS} />
      <Ring x={CUSTOMS.spawn.x} z={CUSTOMS.spawn.z} r={6} color="#ff9a3a" />
    </>
  );
}
