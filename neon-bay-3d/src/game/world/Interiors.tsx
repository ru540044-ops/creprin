import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeCharacter, Look } from '../player/character';
import { game } from '../state/store';
import { rob, CLERK, BAG, recentlyRobbed } from '../crime/crime';
import * as THREE from 'three';
import { getTextures, labelTexture } from './textures';
import { HOME_DEFS } from './homes';
import { SHIP_DEFS } from './shipInteriors';

/** Interiors live underground (y = FLOOR) so they never overlap the city. */
export const FLOOR = -50;
export interface Box2 { x0: number; z0: number; x1: number; z1: number; h: number }
export type Furn = Box2 & { c: string; glow?: boolean; y0?: number; rough?: number; metal?: number; walk?: boolean };
export interface View { wall: 'n' | 'e' | 'w'; a0: number; a1: number; y0: number; y1: number; style: 'danchi' | 'suburb' | 'city-high' | 'sea' }
export interface InteriorDef {
  id: string; name: string; ox: number; oz: number; w: number; d: number; h: number; wall: string; floor: string; furniture: Furn[]; exit: { x: number; z: number }; spawn: { x: number; z: number; yaw: number };
  floorTex?: 'tiles' | 'concrete' | 'wood' | 'marble' | 'tatami'; ceil?: string; lights?: { x: number; y: number; z: number; c: string; i: number; d: number }[]; views?: View[];
  home?: boolean; flicker?: boolean; bed?: { x: number; z: number }; buy?: { x: number; z: number };
  npcs?: { x: number; z: number; yaw: number; look: Look }[]; roofSpot?: { x: number; z: number }; roof?: { x: number; z: number; y: number }; noSign?: boolean; ownLights?: boolean;
  roofLabel?: string; links?: { x: number; z: number; to: string; label: string }[];
}

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
  ...Object.fromEntries(HOME_DEFS.map((d) => [d.id, d])),
  ...Object.fromEntries(SHIP_DEFS.map((d) => [d.id, d])),
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

INTERIORS.home.bed = { x: 3.8, z: -2.9 }; // the starter safehouse bed

/** Shop clerk behind the till: idle sway, hands up while being robbed, cowering afterwards. */
function Clerk({ x = CLERK.x, z = CLERK.z, yaw = Math.PI, shop = true, look }: { x?: number; z?: number; yaw?: number; shop?: boolean; look?: Look }) {
  const C = useMemo(() => makeCharacter(look || { skin: '#8d5a3b', shirt: '#2b8f5a', pants: '#24262c', shoe: '#30323a', hair: '#141012' }), [look]);
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

/* ---------- procedural interior textures (cached) ---------- */
const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = true) {
  let t = texCache.get(key); if (t) return t;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; texCache.set(key, t); return t;
}
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function floorTexture(kind: string) {
  if (kind === 'wood') return canvasTex('wood', 512, 512, (c) => { for (let y = 0; y < 512; y += 32) for (let x = -(y % 96); x < 512; x += 192) { const l = 150 + rnd() * 50; c.fillStyle = `rgb(${l},${l * 0.72},${l * 0.48})`; c.fillRect(x, y, 190, 31); for (let k = 0; k < 6; k++) { c.strokeStyle = `rgba(80,50,25,${0.08 + rnd() * 0.1})`; c.beginPath(); const yy = y + 4 + rnd() * 24; c.moveTo(x, yy); c.bezierCurveTo(x + 60, yy + rnd() * 6 - 3, x + 120, yy + rnd() * 6 - 3, x + 190, yy); c.stroke(); } c.fillStyle = 'rgba(40,25,10,.35)'; c.fillRect(x, y + 31, 190, 1); c.fillRect(x + 190, y, 2, 32); } });
  if (kind === 'marble') return canvasTex('marble', 512, 512, (c) => { c.fillStyle = '#efece6'; c.fillRect(0, 0, 512, 512); for (let k = 0; k < 40; k++) { c.strokeStyle = `rgba(120,115,110,${0.05 + rnd() * 0.12})`; c.lineWidth = 0.5 + rnd() * 1.5; c.beginPath(); let x = rnd() * 512, y = rnd() * 512; c.moveTo(x, y); for (let j = 0; j < 8; j++) { x += rnd() * 80 - 30; y += rnd() * 60 - 30; c.lineTo(x, y); } c.stroke(); } c.strokeStyle = 'rgba(160,155,150,.35)'; for (let g = 0; g <= 512; g += 256) { c.beginPath(); c.moveTo(g, 0); c.lineTo(g, 512); c.moveTo(0, g); c.lineTo(512, g); c.stroke(); } });
  if (kind === 'tatami') return canvasTex('tatami', 256, 512, (c) => { c.fillStyle = '#c8b97a'; c.fillRect(0, 0, 256, 512); for (let y = 0; y < 512; y += 3) { c.fillStyle = `rgba(110,95,40,${0.08 + rnd() * 0.08})`; c.fillRect(0, y, 256, 1); } c.fillStyle = '#3a3f2a'; c.fillRect(0, 0, 256, 10); c.fillRect(0, 502, 256, 10); });
  return null;
}
/** Painted window views, day and night variants. */
function viewTexture(style: View['style'], night: boolean) {
  return canvasTex('view-' + style + (night ? '-n' : '-d'), 1024, 384, (c) => {
    const W = 1024, H = 384, hor = style === 'city-high' ? 0.62 : style === 'sea' ? 0.5 : 0.7;
    const g = c.createLinearGradient(0, 0, 0, H * hor); g.addColorStop(0, night ? '#04070f' : '#4a86d8'); g.addColorStop(1, night ? '#1b2238' : '#cfe3f4'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (night) for (let k = 0; k < 120; k++) { c.fillStyle = `rgba(255,255,255,${rnd() * 0.7})`; c.fillRect(rnd() * W, rnd() * H * hor * 0.8, 1.2, 1.2); }
    const win = (x: number, y: number, w: number, h: number, lit: number) => { for (let yy = y + 6; yy < y + h - 4; yy += 9) for (let xx = x + 4; xx < x + w - 4; xx += 8) { const on = rnd() < lit; c.fillStyle = night ? (on ? `rgba(255,${200 + rnd() * 40 | 0},${120 + rnd() * 60 | 0},.9)` : 'rgba(20,24,34,.9)') : (on ? 'rgba(160,190,220,.8)' : 'rgba(90,110,130,.6)'); c.fillRect(xx, yy, 4, 5); } };
    if (style === 'city-high') {
      c.fillStyle = night ? '#0c1a2a' : '#7fa6c4'; c.fillRect(0, H * hor, W, H); // sea far away
      for (let k = 0; k < 70; k++) { const w = 18 + rnd() * 40, h = 20 + rnd() * 110, x = rnd() * W, y = H * hor + 30 - h * 0.35; c.fillStyle = night ? '#121622' : `rgb(${120 + rnd() * 40},${135 + rnd() * 40},${155 + rnd() * 40})`; c.fillRect(x, y, w, h + 200); win(x, y, w, h, night ? 0.45 : 0.3); }
      if (night) { c.fillStyle = 'rgba(255,140,80,.15)'; c.fillRect(0, H * hor - 20, W, 40); }
    } else if (style === 'sea') {
      const sg = c.createLinearGradient(0, H * hor, 0, H); sg.addColorStop(0, night ? '#0a1626' : '#2a7fb8'); sg.addColorStop(1, night ? '#050a12' : '#1a5a8a'); c.fillStyle = sg; c.fillRect(0, H * hor, W, H * (1 - hor));
      for (let k = 0; k < 160; k++) { c.fillStyle = night ? 'rgba(200,210,255,.25)' : 'rgba(255,255,255,.35)'; c.fillRect(rnd() * W, H * hor + rnd() * H * 0.3, 10 + rnd() * 30, 1.5); }
      if (night) { c.fillStyle = 'rgba(230,235,255,.95)'; c.beginPath(); c.arc(W * 0.7, H * 0.18, 14, 0, 7); c.fill(); c.fillStyle = 'rgba(220,230,255,.25)'; c.fillRect(W * 0.7 - 8, H * hor, 16, H * 0.5); }
      else { const sun = c.createRadialGradient(W * 0.3, H * 0.15, 0, W * 0.3, H * 0.15, 60); sun.addColorStop(0, 'rgba(255,250,230,1)'); sun.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = sun; c.fillRect(0, 0, W, H); }
      c.fillStyle = night ? '#1a1712' : '#e8d6a8'; c.fillRect(0, H * 0.86, W, H * 0.14); // sand
      for (const px of [90, 860, 960]) { c.strokeStyle = '#2a2a20'; c.lineWidth = 6; c.beginPath(); c.moveTo(px, H); c.quadraticCurveTo(px + 10, H * 0.6, px + 20, H * 0.35); c.stroke(); c.fillStyle = night ? '#0d1410' : '#2f5a32'; for (let a = 0; a < 6; a++) { c.beginPath(); c.ellipse(px + 20 + Math.cos(a) * 30, H * 0.35 + Math.sin(a) * 8, 34, 7, a, 0, 7); c.fill(); } }
    } else if (style === 'danchi') {
      for (let k = 0; k < 4; k++) { const x = -40 + k * 280, y = H * 0.18 + (k % 2) * 30, w = 240, h = H; c.fillStyle = night ? '#1a1c22' : '#b8b4aa'; c.fillRect(x, y, w, h); for (let yy = y + 10; yy < H; yy += 34) { c.fillStyle = night ? '#24262c' : '#a29d92'; c.fillRect(x, yy + 22, w, 6); for (let xx = x + 8; xx < x + w - 20; xx += 40) { const on = rnd() < (night ? 0.5 : 0.2); c.fillStyle = night ? (on ? 'rgba(255,220,150,.9)' : '#0d0e12') : (on ? '#8a96a4' : '#6f7884'); c.fillRect(xx, yy, 26, 18); if (!night && rnd() < 0.3) { c.fillStyle = ['#f4f4f4', '#e88', '#8ae', '#ee8'][k % 4]; c.fillRect(xx + 4, yy + 18, 6, 8); } } } }
    } else { // suburb
      c.fillStyle = night ? '#0c120e' : '#7aa86a'; c.fillRect(0, H * hor, W, H);
      for (let k = 0; k < 9; k++) { const x = k * 120 + rnd() * 30, y = H * hor - 40; c.fillStyle = night ? '#16181e' : ['#e8dcc6', '#c9d6e0', '#f0e2c8'][k % 3]; c.fillRect(x, y, 90, 70); c.fillStyle = night ? '#101116' : '#8a3a2a'; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + 45, y - 34); c.lineTo(x + 98, y); c.fill(); c.fillStyle = night ? 'rgba(255,210,140,.9)' : '#6a8aa8'; c.fillRect(x + 14, y + 20, 18, 16); c.fillRect(x + 56, y + 20, 18, 16); }
      for (let k = 0; k < 14; k++) { c.fillStyle = night ? '#0a100c' : '#3f6e3a'; c.beginPath(); c.arc(rnd() * W, H * hor + 10, 24 + rnd() * 20, 0, 7); c.fill(); }
    }
  }, false);
}
function ViewPlane({ v, def }: { v: View; def: InteriorDef }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useFrame(() => { const night = game.hour > 18.6 || game.hour < 6.2, t = viewTexture(v.style, night); if (mat.map !== t) { mat.map = t; mat.needsUpdate = true; } mat.color.setScalar(night ? 0.9 : 1.15); });
  const len = v.a1 - v.a0, mid = (v.a0 + v.a1) / 2, hh = v.y1 - v.y0, y = (v.y0 + v.y1) / 2;
  const pos: [number, number, number] = v.wall === 'n' ? [mid, y, -def.d / 2 + 0.02] : v.wall === 'e' ? [def.w / 2 - 0.02, y, mid] : [-def.w / 2 + 0.02, y, mid];
  const rot = v.wall === 'n' ? 0 : v.wall === 'e' ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group position={pos} rotation-y={rot}>
      <mesh material={mat}><planeGeometry args={[len, hh]} /></mesh>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[len, hh]} /><meshStandardMaterial color="#a8c4dc" transparent opacity={0.1} metalness={0.9} roughness={0.05} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * len / 2, 0, 0.02]}><boxGeometry args={[0.08, hh, 0.06]} /><meshStandardMaterial color="#2a2c30" /></mesh>)}
      <mesh position={[0, -hh / 2, 0.03]}><boxGeometry args={[len, 0.06, 0.08]} /><meshStandardMaterial color="#2a2c30" /></mesh>
    </group>
  );
}
function FlickerLight({ l }: { l: NonNullable<InteriorDef['lights']>[number] }) {
  const ref = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => { if (ref.current) { const t = clock.elapsedTime; ref.current.intensity = l.i * (Math.sin(t * 23) > 0.97 || (t % 7 > 6.85) ? 0.35 : 1); } });
  return <pointLight ref={ref} position={[l.x, l.y, l.z]} intensity={l.i} distance={l.d} decay={1.6} color={l.c} />;
}

function Room({ def }: { def: InteriorDef }) {
  const T = getTextures();
  const floorTex = useMemo(() => { const base = def.floorTex && def.floorTex !== 'tiles' && def.floorTex !== 'concrete' ? floorTexture(def.floorTex) : def.floorTex === 'concrete' || def.id === 'home' ? T.concrete : T.tiles; const t = base!.clone(); t.needsUpdate = true; const k = def.floorTex === 'wood' ? 4 : def.floorTex === 'marble' ? 4 : def.floorTex === 'tatami' ? 1.8 : 2; t.repeat.set(def.w / k, def.d / (def.floorTex === 'tatami' ? 3.6 : k)); return t; }, [def, T]);
  const sign = useMemo(() => labelTexture(def.name, def.furniture.find((f) => f.glow)?.c || '#ffffff'), [def]);
  const { w, d, h, ox } = def;
  return (
    <group position={[ox, FLOOR, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial map={floorTex} color={def.floorTex === 'wood' || def.floorTex === 'marble' || def.floorTex === 'tatami' ? '#ffffff' : def.floor} roughness={def.floorTex === 'marble' ? 0.12 : def.floorTex === 'wood' ? 0.45 : 0.6} metalness={def.floorTex === 'marble' ? 0.05 : 0} envMapIntensity={def.floorTex === 'marble' ? 0.3 : 0.6} /></mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, h, 0]}><planeGeometry args={[w, d]} /><meshStandardMaterial color={def.ceil || '#f4f4f2'} roughness={0.9} /></mesh>
      {[[0, -d / 2, 0], [0, d / 2, Math.PI], [-w / 2, 0, Math.PI / 2], [w / 2, 0, -Math.PI / 2]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, h / 2, z]} rotation-y={r} receiveShadow><planeGeometry args={[i < 2 ? w : d, h]} /><meshStandardMaterial color={def.wall} roughness={0.85} /></mesh>
      ))}
      {def.furniture.map((f, i) => (
        <mesh key={i} position={[(f.x0 + f.x1) / 2, (f.y0 || 0) + f.h / 2, (f.z0 + f.z1) / 2]} castShadow={!f.walk && !f.glow} receiveShadow>
          <boxGeometry args={[f.x1 - f.x0, f.h, f.z1 - f.z0]} />
          {f.glow ? <meshBasicMaterial color={f.c} toneMapped={false} /> : <meshStandardMaterial color={f.c} roughness={f.rough ?? 0.6} metalness={f.metal ?? 0} />}
        </mesh>
      ))}
      {!def.home && !def.noSign && <mesh position={[0, Math.min(3.3, h - 0.75), -d / 2 + 0.05]}><planeGeometry args={[5, 1.25]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>}
      {def.views?.map((v, i) => <ViewPlane key={i} v={v} def={def} />)}
      {def.lights?.map((l, i) => def.flicker && i === 0 ? <FlickerLight key={i} l={l} /> : <pointLight key={i} position={[l.x, l.y, l.z]} intensity={l.i} distance={l.d} decay={1.6} color={l.c} />)}
      {def.npcs?.map((n, i) => <Clerk key={def.name + i} x={n.x} z={n.z} yaw={n.yaw} shop={false} look={n.look} />)}
      {def.links?.map((l, i) => <mesh key={'lk' + i} rotation-x={-Math.PI / 2} position={[l.x, 0.02, l.z]}><ringGeometry args={[0.55, 0.75, 32]} /><meshBasicMaterial color="#2be4ff" toneMapped={false} /></mesh>)}
      {def.roofSpot && <mesh rotation-x={-Math.PI / 2} position={[def.roofSpot.x, 0.02, def.roofSpot.z]}><ringGeometry args={[0.55, 0.75, 32]} /><meshBasicMaterial color="#ffd23a" toneMapped={false} /></mesh>}
      {!def.home && !def.ownLights && [-w / 4, w / 4].map((x) => <mesh key={x} position={[x, h - 0.05, 0]} rotation-x={Math.PI / 2}><planeGeometry args={[2.4, 0.5]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>)}
      {(def.id === 'store' || def.id === 'gas') && <Clerk />}
      {def.id === 'arms' && <Clerk x={0} z={-3.6} yaw={0} shop={false} />}
      {!def.home && !def.ownLights && <pointLight position={[0, h - 0.4, 0]} intensity={26} distance={22} decay={1.6} color="#fff1dc" />}
      <hemisphereLight args={[def.home ? '#fff4e6' : '#ffffff', '#6a5a4a', def.home ? 0.22 : 0.2]} />
      <mesh position={[0, Math.min(1.2, h / 2 - 0.05), d / 2 - 0.06]}><boxGeometry args={[1.0, Math.min(2.4, h - 0.1), 0.1]} /><meshStandardMaterial color="#2a2f3a" metalness={0.5} roughness={0.3} /></mesh>
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
    if (f.walk) continue;
    const cx = Math.min(f.x1, Math.max(f.x0, x)), cz = Math.min(f.z1, Math.max(f.z0, z)), ex = x - cx, ez = z - cz, d2 = ex * ex + ez * ez;
    if (d2 < r * r) { if (d2 < 1e-8) { z = f.z1 + r; } else { const dd = Math.sqrt(d2); x = cx + (ex / dd) * r; z = cz + (ez / dd) * r; } }
  }
  p.x = x + def.ox; p.z = z + def.oz;
}
