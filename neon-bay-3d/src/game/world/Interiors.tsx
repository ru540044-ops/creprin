import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeCharacter } from '../player/character';
import { game } from '../state/store';
import { rob, CLERK, BAG, recentlyRobbed } from '../crime/crime';
import * as THREE from 'three';
import { getTextures, labelTexture } from './textures';

/** Interiors live underground (y = FLOOR) so they never overlap the city. */
export const FLOOR = -50;
export interface Box2 { x0: number; z0: number; x1: number; z1: number; h: number }
export interface InteriorDef { id: string; name: string; ox: number; oz: number; w: number; d: number; h: number; wall: string; floor: string; furniture: (Box2 & { c: string; glow?: boolean })[]; exit: { x: number; z: number }; spawn: { x: number; z: number; yaw: number } }

const mk = (id: string, name: string, ox: number, w: number, d: number, wall: string, floor: string, f: InteriorDef['furniture']): InteriorDef => ({
  id, name, ox, oz: 0, w, d, h: 4.2, wall, floor, furniture: f,
  exit: { x: 0, z: d / 2 - 1.2 }, spawn: { x: 0, z: d / 2 - 2.6, yaw: Math.PI },
});
const store = (ox: number, name: string, accent: string) => mk(name === 'FUEL & SNACKS' ? 'gas' : 'store', name, ox, 16, 12, '#e9e6df', '#cfd4d8', [
  { x0: -7.5, z0: -5.6, x1: 7.5, z1: -4.6, h: 2, c: '#8a96a8', glow: false },
  { x0: -7.5, z0: -5.7, x1: 7.5, z1: -5.5, h: 2, c: accent, glow: true },
  { x0: -5, z0: -1.5, x1: -0.5, z1: -0.7, h: 1.6, c: '#c0c6cf' }, { x0: 0.5, z0: -1.5, x1: 5, z1: -0.7, h: 1.6, c: '#c0c6cf' },
  { x0: -5, z0: 1.5, x1: -0.5, z1: 2.3, h: 1.6, c: '#c0c6cf' }, { x0: 3, z0: 3, x1: 7, z1: 4, h: 1.05, c: '#6a4a36' },
]);

export const INTERIORS: Record<string, InteriorDef> = {
  store: store(-3000, 'QWIK 24', '#3dffb0'),
  gas: store(-3060, 'FUEL & SNACKS', '#ffc03a'),
  diner: mk('diner', 'BAY DINER', -3120, 18, 12, '#f3e0d6', '#e0c8b8', [
    { x0: -8.5, z0: -5.4, x1: 8.5, z1: -4.2, h: 1.1, c: '#c2273a' }, { x0: -8.5, z0: -5.8, x1: 8.5, z1: -5.6, h: 3, c: '#ff6a9a', glow: true },
    ...[-6, -2, 2, 6].map((x) => ({ x0: x - 1, z0: -0.5, x1: x + 1, z1: 0.9, h: 0.78, c: '#ece7df' })),
    ...[-6, -2, 2, 6].map((x) => ({ x0: x - 1.1, z0: 1.4, x1: x + 1.1, z1: 2.1, h: 0.5, c: '#c2273a' })),
  ]),
  clothes: mk('clothes', 'THREADS', -3180, 16, 12, '#efe9f6', '#d8d2e0', [
    { x0: -7.5, z0: -5.6, x1: -2, z1: -4.8, h: 2.2, c: '#3a2f4a' }, { x0: 2, z0: -5.6, x1: 7.5, z1: -4.8, h: 2.2, c: '#3a2f4a' },
    { x0: -7.5, z0: -5.8, x1: 7.5, z1: -5.65, h: 3.2, c: '#c07aff', glow: true },
    { x0: -4, z0: -0.4, x1: -2.5, z1: 0.4, h: 1.4, c: '#ff3f93' }, { x0: 2.5, z0: -0.4, x1: 4, z1: 0.4, h: 1.4, c: '#2be4ff' },
  ]),
  arms: mk('arms', 'BAY ARMS', -3300, 16, 12, '#2b2d33', '#4a4d55', [
    { x0: -5.5, z0: -2.6, x1: 5.5, z1: -1.8, h: 1.05, c: '#20232a' }, { x0: -5.5, z0: -1.85, x1: 5.5, z1: -1.75, h: 1.1, c: '#ff5a36', glow: true },
    { x0: -7.5, z0: -5.9, x1: 7.5, z1: -5.6, h: 3.4, c: '#3a2420' }, { x0: -7, z0: -5.62, x1: 7, z1: -5.55, h: 2.6, c: '#ff5a36', glow: true },
    { x0: -7.6, z0: -1, x1: -6.2, z1: 3.5, h: 1.0, c: '#30333b' }, { x0: 6.2, z0: -1, x1: 7.6, z1: 3.5, h: 1.0, c: '#30333b' },
  ]),
  home: mk('home', 'SAFEHOUSE', -3240, 14, 12, '#d9d3c7', '#8b6a4f', [
    { x0: -6, z0: -5.4, x1: -1.5, z1: -3.8, h: 0.8, c: '#3d4a66' }, { x0: 1.5, z0: -5.6, x1: 6.2, z1: -3.4, h: 0.6, c: '#e8e2d8' },
    { x0: -6.4, z0: 1, x1: -5.4, z1: 4, h: 2, c: '#5a4030' }, { x0: 3, z0: 1, x1: 5, z1: 2.4, h: 0.75, c: '#6a4a36' },
    { x0: -2, z0: -5.95, x1: 2, z1: -5.85, h: 2.2, c: '#2be4ff', glow: true },
  ]),
};

/** Shop clerk behind the till: idle sway, hands up while being robbed, cowering afterwards. */
function Clerk({ x = CLERK.x, z = CLERK.z, yaw = Math.PI, shop = true }: { x?: number; z?: number; yaw?: number; shop?: boolean }) {
  const C = useMemo(() => makeCharacter({ skin: '#8d5a3b', shirt: '#2b8f5a', pants: '#24262c', shoe: '#30323a', hair: '#141012' }), []);
  const bag = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, here = shop && rob.door === game.lastDoor, scared = shop && ((here && rob.phase !== '') || recentlyRobbed(game.lastDoor));
    C.hips.position.y = scared && rob.phase !== 'fill' ? 0.78 : 0.95; C.spine.rotation.x = scared ? 0.15 : 0.04; C.head.rotation.y = scared ? 0 : Math.sin(t * 0.4) * 0.4;
    C.legs.forEach((l) => { l.top.rotation.x = scared && rob.phase !== 'fill' ? -0.6 : 0; l.mid.rotation.x = scared && rob.phase !== 'fill' ? 1.0 : 0; });
    C.arms.forEach((a, i) => {
      const sg = i ? 1 : -1;
      if (here && rob.phase === 'fill') { a.top.rotation.x = -1.1 + Math.sin(t * 9 + i * 2) * 0.35; a.top.rotation.z = sg * 0.2; a.mid.rotation.x = -0.9; } // stuffing the bag
      else if (scared) { a.top.rotation.x = -2.9; a.top.rotation.z = sg * 0.35; a.mid.rotation.x = -0.4; }
      else { a.top.rotation.x = 0.05 + Math.sin(t * 1.3) * 0.03; a.top.rotation.z = sg * 0.08; a.mid.rotation.x = -0.15; }
    });
    if (bag.current) { bag.current.visible = here && (rob.phase === 'bag' || rob.phase === 'fill'); const k = rob.phase === 'fill' ? 0.4 + 0.6 * (rob.t / rob.dur) : 1; bag.current.scale.setScalar(k); }
  });
  return (
    <>
      <group position={[x, 0, z]} rotation-y={yaw}><primitive object={C.root} /></group>
      <mesh ref={bag} visible={false} position={[BAG.x, 1.25, BAG.z]} castShadow><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#d9c9a0" roughness={0.9} /></mesh>
    </>
  );
}

function Room({ def }: { def: InteriorDef }) {
  const T = getTextures();
  const floorTex = useMemo(() => { const t = (def.id === 'home' ? T.concrete : T.tiles).clone(); t.needsUpdate = true; t.repeat.set(def.w / 2, def.d / 2); return t; }, [def, T]);
  const sign = useMemo(() => labelTexture(def.name, def.furniture.find((f) => f.glow)?.c || '#ffffff'), [def]);
  const { w, d, h, ox } = def;
  return (
    <group position={[ox, FLOOR, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial map={floorTex} color={def.floor} roughness={0.5} /></mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, h, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color="#f4f4f2" roughness={0.9} /></mesh>
      {[[0, -d / 2, 0], [0, d / 2, Math.PI], [-w / 2, 0, Math.PI / 2], [w / 2, 0, -Math.PI / 2]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, h / 2, z]} rotation-y={r} receiveShadow><planeGeometry args={[i < 2 ? w : d, h]} /><meshStandardMaterial color={def.wall} roughness={0.85} /></mesh>
      ))}
      {def.furniture.map((f, i) => (
        <mesh key={i} position={[(f.x0 + f.x1) / 2, f.h / 2, (f.z0 + f.z1) / 2]} castShadow receiveShadow>
          <boxGeometry args={[f.x1 - f.x0, f.h, f.z1 - f.z0]} />
          {f.glow ? <meshBasicMaterial color={f.c} toneMapped={false} /> : <meshStandardMaterial color={f.c} roughness={0.6} />}
        </mesh>
      ))}
      <mesh position={[0, 3.3, -d / 2 + 0.05]}><planeGeometry args={[5, 1.25]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
      {[-w / 4, w / 4].map((x) => <mesh key={x} position={[x, h - 0.05, 0]} rotation-x={Math.PI / 2}><planeGeometry args={[2.4, 0.5]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>)}
      {(def.id === 'store' || def.id === 'gas') && <Clerk />}
      {def.id === 'arms' && <Clerk x={0} z={-3.6} yaw={0} shop={false} />}
      <pointLight position={[0, h - 0.4, 0]} intensity={26} distance={22} decay={1.6} color="#fff1dc" />
      <mesh position={[0, 1.2, d / 2 - 0.06]}><boxGeometry args={[1.8, 2.4, 0.1]} /><meshStandardMaterial color="#2a2f3a" metalness={0.5} roughness={0.3} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, d / 2 - 1.2]}><ringGeometry args={[0.6, 0.8, 32]} /><meshBasicMaterial color="#2be4ff" toneMapped={false} /></mesh>
    </group>
  );
}

export default function Interiors({ where }: { where: string }) {
  const def = INTERIORS[where];
  if (!def) return null;
  return <Room def={def} />;
}

/** Keep a point inside the room and out of furniture. */
export function interiorCollide(def: InteriorDef, p: { x: number; z: number }, r: number) {
  const lx = p.x - def.ox, lz = p.z - def.oz;
  let x = Math.min(def.w / 2 - r, Math.max(-def.w / 2 + r, lx)), z = Math.min(def.d / 2 - r, Math.max(-def.d / 2 + r, lz));
  for (const f of def.furniture) {
    const cx = Math.min(f.x1, Math.max(f.x0, x)), cz = Math.min(f.z1, Math.max(f.z0, z)), ex = x - cx, ez = z - cz, d2 = ex * ex + ez * ez;
    if (d2 < r * r) { if (d2 < 1e-8) { z = f.z1 + r; } else { const dd = Math.sqrt(d2); x = cx + (ex / dd) * r; z = cz + (ez / dd) * r; } }
  }
  p.x = x + def.ox; p.z = z + def.oz;
}
