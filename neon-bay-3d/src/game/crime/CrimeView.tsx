import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { labelTexture } from '../world/textures';
import { LANDMARKS, EXPORT_DOCK, TRIALS, Landmark } from '../world/cityGen';
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

export default function CrimeView() {
  return (
    <>
      {LANDMARKS.map((L) => <LandmarkView key={L.id} L={L} />)}
      <Ring x={EXPORT_DOCK.x} z={EXPORT_DOCK.z} r={9} color="#ff9a3a" />
      <Sign x={EXPORT_DOCK.x} z={EXPORT_DOCK.z + 11} y={5} ang={0} text="EXPORT DOCK" color="#ff9a3a" w={8} />
      {TRIALS.map((T) => <group key={T.id}><Ring x={T.start.x} z={T.start.z} r={7} color="#c07aff" /><Sign x={T.start.x + 8} z={T.start.z} y={4} ang={Math.PI / 2} text={'TIME TRIAL'} color="#c07aff" /></group>)}
      <Checkpoint />
    </>
  );
}
