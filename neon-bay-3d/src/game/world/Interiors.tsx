import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeCharacter, Look } from '../player/character';
import { game } from '../state/store';
import { rob, CLERK, BAG, recentlyRobbed } from '../crime/crime';
import * as THREE from 'three';
import { getTextures, labelTexture } from './textures';
import HighView from './HighView';
import { HOME_DEFS } from './homes';
import { SHIP_DEFS } from './shipInteriors';
import { KONBINI, konbiniFurn, konbiniLights } from './shopFurn';

/** Interiors live underground (y = FLOOR) so they never overlap the city. */
export const FLOOR = -50;
export interface Box2 { x0: number; z0: number; x1: number; z1: number; h: number }
export type Furn = Box2 & { c: string; glow?: boolean; y0?: number; rough?: number; metal?: number; walk?: boolean; /** a pane of glass */ glass?: boolean; /** round: a cylinder or a ball filling the box */ shape?: 'cyl' | 'ball'; /** painted goods on the long faces */ tex?: FurnTex; /** paint only the faces across this axis */ texFaces?: 'x' | 'z' };
/** Something to do at a spot in the room (a counter, a machine, a seat): shows a prompt within r metres. */
export interface Act { x: number; z: number; r?: number; id: string; label: string; btn: string }
export interface View { wall: 'n' | 'e' | 'w'; a0: number; a1: number; y0: number; y1: number; style: 'danchi' | 'suburb' | 'city-high' | 'sea' }
export interface InteriorDef {
  id: string; name: string; ox: number; oz: number; w: number; d: number; h: number; wall: string; floor: string; furniture: Furn[]; exit: { x: number; z: number }; spawn: { x: number; z: number; yaw: number };
  floorTex?: 'tiles' | 'concrete' | 'wood' | 'marble' | 'tatami'; ceil?: string; lights?: { x: number; y: number; z: number; c: string; i: number; d: number }[]; views?: View[];
  home?: boolean; flicker?: boolean; bed?: { x: number; z: number }; buy?: { x: number; z: number };
  npcs?: { x: number; z: number; yaw: number; look: Look }[]; roofSpot?: { x: number; z: number }; roof?: { x: number; z: number; y: number }; noSign?: boolean; ownLights?: boolean;
  roofLabel?: string; links?: { x: number; z: number; to: string; label: string }[];
  acts?: Act[]; /** a convenience store: the till can be held up (clerk, counter and bag at the fixed spots) */ rob?: boolean;
  /** a balcony outside the north wall (which is then glass, with a door at x door[0]..door[1]): x a0..a1, depth metres out */
  balcony?: { a0: number; a1: number; depth: number; door: [number, number] };
  /** the real view down onto the city from a tower (3D, see HighView) */ pano?: 'city';
}

const mk = (id: string, name: string, ox: number, w: number, d: number, wall: string, floor: string, f: InteriorDef['furniture']): InteriorDef => ({
  id, name, ox, oz: 0, w, d, h: 4.2, wall, floor, furniture: f,
  exit: { x: 0, z: d / 2 - 1.2 }, spawn: { x: 0, z: d / 2 - 2.6, yaw: Math.PI },
});
const CUSTOMER = { skin: '#e0ac69', shirt: '#5a6f8f', pants: '#2a2c33', shoe: '#2a2a2e', hair: '#1a1012' };
const store = (ox: number, name: string, accent: string, second: string): InteriorDef => ({
  ...mk(name === 'FUEL & SNACKS' ? 'gas' : 'store', name, ox, KONBINI.w, KONBINI.d, '#f2f3f5', '#e6eaee', konbiniFurn(accent, second)),
  lights: konbiniLights(), ownLights: true, rob: true, npcs: [{ x: -5, z: 4.55, yaw: 0, look: CUSTOMER }], // someone reading at the magazine rack
});

export const INTERIORS: Record<string, InteriorDef> = {
  ...Object.fromEntries(HOME_DEFS.map((d) => [d.id, d])),
  ...Object.fromEntries(SHIP_DEFS.map((d) => [d.id, d])),
  store: store(-3000, 'QWIK 24', '#3dffb0', '#12324a'),
  gas: store(-3060, 'FUEL & SNACKS', '#ffc03a', '#c1121f'),
  diner: mk('diner', 'BAY DINER', -3120, 18, 12, '#f3e0d6', '#e0c8b8', [
    { x0: -8.5, z0: -5.4, x1: 8.5, z1: -4.2, h: 1.1, c: '#c2273a' }, { x0: -8.5, z0: -5.8, x1: 8.5, z1: -5.6, h: 3, c: '#ff6a9a', glow: true },
    ...[-6, -2, 2, 6].map((x) => ({ x0: x - 1, z0: -0.5, x1: x + 1, z1: 0.9, h: 0.78, c: '#ece7df' })),
    ...[-6, -2, 2, 6].map((x) => ({ x0: x - 1.1, z0: 1.4, x1: x + 1.1, z1: 2.1, h: 0.5, c: '#c2273a' })),
  ]),
  clothes: mk('clothes', 'THREADS', -3180, 16, 12, '#efe9f6', '#d8d2e0', [
    { x0: -7.5, z0: -5.6, x1: -2, z1: -4.8, h: 2.2, c: '#3a2f4a' }, { x0: 2, z0: -5.6, x1: 7.5, z1: -4.8, h: 2.2, c: '#3a2f4a' },
    { x0: -7.5, z0: -5.8, x1: 7.5, z1: -5.65, h: 3.2, c: '#c07aff', glow: true },
    { x0: -4, z0: -0.4, x1: -2.5, z1: 0.4, h: 1.4, c: '#ff3f93' }, { x0: 2.5, z0: -0.4, x1: 4, z1: 0.4, h: 1.4, c: '#2be4ff' },
    { x0: 7.35, z0: 1.6, x1: 7.55, z1: 3.6, h: 2.4, c: '#dff0ff', glow: true }, { x0: 7.2, z0: 1.5, x1: 7.6, z1: 1.6, h: 2.5, c: '#c9a25a' }, { x0: 7.2, z0: 3.6, x1: 7.6, z1: 3.7, h: 2.5, c: '#c9a25a' },
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
INTERIORS.diner.acts = [{ x: 0, z: -3.3, r: 2.4, id: 'shop:diner', label: 'カウンターで注文する', btn: '注文' }];

/** Shop clerk behind the till: idle sway, hands up while being robbed, cowering afterwards. */
function Clerk({ x = CLERK.x, z = CLERK.z, yaw = Math.PI, shop = true, look }: { x?: number; z?: number; yaw?: number; shop?: boolean; look?: Look }) {
  const C = useMemo(() => makeCharacter(look || { skin: '#8d5a3b', shirt: '#2b8f5a', pants: '#24262c', shoe: '#30323a', hair: '#141012' }, Math.abs(Math.round(x * 31 + z * 17 + (look ? look.shirt.charCodeAt(2) : 0))) + 1), [look, x, z]);
  useEffect(() => () => C.dispose(), [C]);
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
/* ---------- shop fittings: painted product shelves, coolers, racks (cached canvases) ---------- */
export type FurnTex = 'goods' | 'drinks' | 'chilled' | 'mags' | 'cigs' | 'ticket' | 'noren' | 'menu';
/** Metres of shelf one repeat of the texture covers, and whether it is drawn unlit (a lit case / screen). */
const FURN_TEX: Record<FurnTex, { unit: number; lit: boolean }> = { goods: { unit: 2.4, lit: false }, drinks: { unit: 2, lit: true }, chilled: { unit: 2.4, lit: true }, mags: { unit: 2.4, lit: false }, cigs: { unit: 1.4, lit: false }, ticket: { unit: 1, lit: true }, noren: { unit: 1, lit: false }, menu: { unit: 5, lit: false } };
const VIVID = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d', '#8ecae6', '#ffb703', '#d62828', '#6a994e', '#f28482', '#9b5de5', '#00bbf9', '#ff6392', '#3a86ff', '#fb8500', '#b5e48c'];
function furnTexture(kind: FurnTex) {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { if (typeof c.roundRect !== 'function') { c.fillRect(x, y, w, h); return; } c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
  if (kind === 'goods') return canvasTex('f-goods', 512, 256, (c) => {
    c.fillStyle = '#e4e7eb'; c.fillRect(0, 0, 512, 256);
    for (let s = 0; s < 4; s++) {
      const y = s * 64; let x = 4;
      while (x < 500) { // runs of the same product (facings)
        const w = 14 + Math.floor(rnd() * 20), h = 30 + Math.floor(rnd() * 18), col = pick(VIVID), n = 2 + Math.floor(rnd() * 3), bag = rnd() < 0.35;
        for (let k = 0; k < n && x + w < 508; k++) { c.fillStyle = col; if (bag) rr(c, x, y + 54 - h, w, h, 4); else c.fillRect(x, y + 54 - h, w, h); c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x + 2, y + 54 - h * 0.62, w - 4, h * 0.22); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 4, y + 54 - h * 0.56, w - 8, 2); x += w + 2; }
        x += 3;
      }
      c.fillStyle = '#f7f8fa'; c.fillRect(0, y + 54, 512, 10); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y + 63, 512, 1);
      for (let px = 6; px < 500; px += 30 + Math.floor(rnd() * 14)) { c.fillStyle = rnd() < 0.25 ? '#ffe14a' : '#ffffff'; c.fillRect(px, y + 55, 18, 7); c.fillStyle = '#c1121f'; c.fillRect(px + 2, y + 57, 9, 3); }
    }
  });
  if (kind === 'drinks') return canvasTex('f-drinks', 512, 256, (c) => {
    c.fillStyle = '#10151c'; c.fillRect(0, 0, 512, 256);
    const kinds: [string, string, number][] = [['#3f8f4a', '#e8f5d0', 36], ['#5a1f14', '#e63946', 36], ['#bfe3ff', '#ffffff', 36], ['#f4a020', '#fff3c4', 34], ['#1b1b1f', '#c9a24a', 24], ['#7a4a2a', '#f1e3c8', 24], ['#e9e3d0', '#3a86ff', 34], ['#c1121f', '#ffffff', 24]];
    for (let d = 0; d < 2; d++) {
      const x0 = d * 256 + 8, w = 240;
      const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#f4fbff'); g.addColorStop(1, '#cfe6f5'); c.fillStyle = g; c.fillRect(x0, 8, w, 240);
      for (let s = 0; s < 5; s++) {
        const y = 12 + s * 47; let x = x0 + 6;
        while (x < x0 + w - 16) { const k = pick(kinds), n = 2 + Math.floor(rnd() * 3); for (let q = 0; q < n && x < x0 + w - 16; q++) { c.fillStyle = k[0]; rr(c, x, y + 40 - k[2], 13, k[2], 3); c.fillStyle = k[1]; c.fillRect(x + 1, y + 40 - k[2] * 0.6, 11, k[2] * 0.3); if (k[2] > 30) { c.fillStyle = '#f4f4f4'; c.fillRect(x + 4, y + 40 - k[2] - 3, 5, 4); } x += 15; } x += 2; }
        c.fillStyle = '#9aa7b4'; c.fillRect(x0, y + 40, w, 4);
      }
      c.strokeStyle = '#4a535c'; c.lineWidth = 8; c.strokeRect(x0 - 4, 4, w + 8, 248); c.fillStyle = '#c9d2da'; c.fillRect(x0 + w - 12, 96, 5, 64);
      c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(x0 + 30, 8); c.lineTo(x0 + 90, 8); c.lineTo(x0 + 40, 248); c.lineTo(x0, 248); c.closePath(); c.fill(); // glass sheen
    }
  });
  if (kind === 'chilled') return canvasTex('f-chilled', 512, 256, (c) => {
    c.fillStyle = '#f4f7f9'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 512, 10);
    for (let s = 0; s < 4; s++) {
      const y = 12 + s * 61; let x = 6;
      while (x < 490) {
        const t = s === 0 ? 0 : s === 1 ? 1 : s === 2 ? 2 : 3;
        if (t === 0) { c.fillStyle = '#1c1f1c'; c.beginPath(); c.moveTo(x, y + 44); c.lineTo(x + 13, y + 16); c.lineTo(x + 26, y + 44); c.closePath(); c.fill(); c.fillStyle = '#f6f6f2'; c.beginPath(); c.moveTo(x + 6, y + 31); c.lineTo(x + 13, y + 16); c.lineTo(x + 20, y + 31); c.closePath(); c.fill(); c.fillStyle = pick(['#e63946', '#2a9d8f', '#f4a261', '#457b9d']); c.fillRect(x + 8, y + 35, 10, 6); x += 30; }
        else if (t === 1) { c.fillStyle = '#fbfbf6'; c.beginPath(); c.moveTo(x, y + 44); c.lineTo(x + 30, y + 44); c.lineTo(x + 30, y + 14); c.closePath(); c.fill(); c.fillStyle = pick(['#6a994e', '#e9c46a', '#f28482']); c.fillRect(x + 8, y + 36, 20, 4); c.fillStyle = '#8a5a3a'; c.fillRect(x + 4, y + 41, 26, 2); x += 36; }
        else if (t === 2) { c.fillStyle = '#1e1e22'; rr(c, x, y + 14, 46, 30, 4); c.fillStyle = '#fafaf5'; c.fillRect(x + 4, y + 18, 20, 22); c.fillStyle = pick(VIVID); c.fillRect(x + 27, y + 18, 15, 10); c.fillStyle = pick(VIVID); c.fillRect(x + 27, y + 30, 15, 10); c.fillStyle = '#c1121f'; c.beginPath(); c.arc(x + 14, y + 29, 3, 0, 7); c.fill(); x += 52; }
        else { c.fillStyle = pick(['#fff1c9', '#ffd6e0', '#e8d5b5', '#d8f3dc']); rr(c, x, y + 22, 22, 22, 5); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x, y + 20, 22, 4); x += 28; }
      }
      c.fillStyle = '#d8dee4'; c.fillRect(0, y + 45, 512, 3); c.fillStyle = '#e63946'; c.fillRect(0, y + 48, 512, 5); c.fillStyle = '#ffffff'; for (let px = 8; px < 500; px += 40) c.fillRect(px, y + 49, 16, 3);
    }
  });
  if (kind === 'mags') return canvasTex('f-mags', 512, 256, (c) => {
    c.fillStyle = '#2c3038'; c.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 2; row++) for (let x = 6; x < 500; x += 46) {
      const y = 8 + row * 124, a = pick(VIVID), b = pick(VIVID);
      const g = c.createLinearGradient(x, y, x + 40, y + 108); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x, y, 40, 108);
      c.fillStyle = rnd() < 0.5 ? '#ffffff' : '#111111'; c.fillRect(x + 3, y + 5, 34, 13);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x + 20, y + 52, 13, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 0; k < 3; k++) c.fillRect(x + 4, y + 78 + k * 8, 20 + rnd() * 12, 3);
      c.fillStyle = '#ffe14a'; c.fillRect(x + 26, y + 92, 12, 12);
    }
    c.fillStyle = '#4a5058'; c.fillRect(0, 118, 512, 6); c.fillRect(0, 242, 512, 14);
  });
  if (kind === 'cigs') return canvasTex('f-cigs', 256, 128, (c) => {
    c.fillStyle = '#30343c'; c.fillRect(0, 0, 256, 128);
    const cols = ['#f4f4f4', '#c1121f', '#1d3557', '#2a9d8f', '#c9a24a', '#111111', '#e9e3d0', '#457b9d'];
    for (let y = 4; y < 120; y += 24) for (let x = 4; x < 250; x += 17) { c.fillStyle = pick(cols); c.fillRect(x, y, 14, 18); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x + 2, y + 3, 10, 4); c.fillStyle = '#ffe14a'; c.fillRect(x + 3, y + 19, 8, 3); }
  });
  if (kind === 'ticket') return canvasTex('f-ticket', 256, 448, (c) => {
    c.fillStyle = '#b3261e'; c.fillRect(0, 0, 256, 448); c.fillStyle = '#fff6e6'; c.fillRect(14, 12, 228, 58);
    c.fillStyle = '#b3261e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 34px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillText('食券', 128, 42);
    c.font = '700 13px "Hiragino Sans","Noto Sans JP",sans-serif';
    const names = ['とんこつ', '特製', '餃子', '替玉', '味玉', 'ねぎ', 'ライス', 'ビール', 'チャーシュー', 'のり', 'キムチ', '大盛'];
    for (let r2 = 0; r2 < 4; r2++) for (let q = 0; q < 3; q++) { const x = 18 + q * 76, y = 84 + r2 * 56, hot = r2 === 0; c.fillStyle = hot ? '#ffe14a' : '#ffffff'; rr(c, x, y, 68, 46, 6); c.fillStyle = hot ? '#b3261e' : '#222'; c.fillText(names[r2 * 3 + q], x + 34, y + 18); c.fillStyle = '#c1121f'; c.fillRect(x + 20, y + 32, 28, 5); }
    c.fillStyle = '#16181c'; rr(c, 26, 318, 90, 26, 4); rr(c, 140, 318, 90, 14, 3); c.fillStyle = '#3dff7a'; c.fillRect(34, 326, 40, 10);
    c.fillStyle = '#16181c'; rr(c, 60, 372, 136, 40, 6); c.fillStyle = '#2a2d33'; c.fillRect(70, 384, 116, 18);
  }, false);
  if (kind === 'noren') return canvasTex('f-noren', 128, 64, (c) => {
    c.fillStyle = '#a3241c'; c.fillRect(0, 0, 128, 64); c.fillStyle = 'rgba(0,0,0,.35)'; for (const x of [32, 64, 96]) c.fillRect(x - 1, 14, 2, 50);
    c.fillStyle = '#fff6e6'; c.beginPath(); c.arc(64, 30, 13, 0, 7); c.fill(); c.fillStyle = '#a3241c'; c.font = '900 16px "Hiragino Sans","Noto Sans JP",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('麺', 64, 31);
  });
  return canvasTex('f-menu', 512, 76, (c) => {
    c.fillStyle = '#5a3d28'; c.fillRect(0, 0, 512, 76);
    const items = ['とんこつラーメン', '特製ラーメン', '餃子セット', '替玉', '味付玉子', 'チャーシュー', '青ねぎ', 'ライス', '生ビール', 'キムチ', 'のり', '大盛'];
    c.textAlign = 'center'; c.textBaseline = 'middle';
    items.forEach((t, k) => { const x = 8 + k * 42; c.fillStyle = k < 2 ? '#fff0c2' : '#f6efe0'; c.fillRect(x, 5, 36, 66); c.fillStyle = k < 2 ? '#b3261e' : '#1c1c1c'; const fs = Math.min(13, 58 / t.length); c.font = `700 ${fs}px "Hiragino Sans","Noto Sans JP",sans-serif`; [...t].forEach((ch, q) => c.fillText(ch, x + 18, 9 + fs * (q + 0.6))); });
  });
}
/** A shelf / case / machine with painted goods on its long faces (plain on top). */
function TexturedFurn({ f }: { f: Furn }) {
  const mats = useMemo(() => {
    const K = FURN_TEX[f.tex!], base = furnTexture(f.tex!), lx = f.x1 - f.x0, lz = f.z1 - f.z0;
    const plain = new THREE.MeshStandardMaterial({ color: f.c, roughness: 0.6 });
    const face = (len: number, on: boolean) => {
      if (!on || len < 0.5) return plain;
      const t = base.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.max(0.2, len / K.unit), 1); t.needsUpdate = true;
      return K.lit ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
    };
    const long = lx >= lz ? 'z' : 'x', mx = face(lz, f.texFaces ? f.texFaces === 'x' : long === 'x' || lz > 1.2), mz = face(lx, f.texFaces ? f.texFaces === 'z' : long === 'z' || lx > 1.2);
    return [mx, mx, plain, plain, mz, mz]; // +x -x +y -y +z -z
  }, [f]);
  useEffect(() => () => { for (const m of new Set(mats)) { const mp = (m as THREE.MeshStandardMaterial).map; if (mp) mp.dispose(); m.dispose(); } }, [mats]);
  return <mesh position={[(f.x0 + f.x1) / 2, (f.y0 || 0) + f.h / 2, (f.z0 + f.z1) / 2]} material={mats} receiveShadow><boxGeometry args={[f.x1 - f.x0, f.h, f.z1 - f.z0]} /></mesh>;
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
/** The balcony outside the glass wall: a wooden deck, the slab edge, a glass balustrade with a steel handrail, side screens. */
function Balcony({ def }: { def: InteriorDef }) {
  const B = def.balcony!, z0 = -def.d / 2, z1 = z0 - B.depth, w = B.a1 - B.a0, cx = (B.a0 + B.a1) / 2, zc = (z0 + z1) / 2;
  const deck = useMemo(() => { const t = floorTexture('wood')!.clone(); t.needsUpdate = true; t.repeat.set(w / 2, B.depth / 2); return t; }, [w, B.depth]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.005, zc]} receiveShadow><planeGeometry args={[w, B.depth]} /><meshStandardMaterial map={deck} color="#c8a47a" roughness={0.8} /></mesh>
      <mesh position={[cx, -0.35, z1 + 0.1]}><boxGeometry args={[w + 0.4, 0.7, 0.3]} /><meshStandardMaterial color="#d8d6d0" roughness={0.7} /></mesh>
      <mesh position={[cx, 0.55, z1 + 0.06]}><boxGeometry args={[w, 1.1, 0.04]} /><meshStandardMaterial color="#cfe4f2" transparent opacity={0.22} metalness={0.8} roughness={0.05} depthWrite={false} /></mesh>
      <mesh position={[cx, 1.12, z1 + 0.06]}><boxGeometry args={[w, 0.06, 0.1]} /><meshStandardMaterial color="#b8bcc4" metalness={0.9} roughness={0.25} /></mesh>
      {[B.a0, B.a1].map((x) => <mesh key={x} position={[x, 1.2, zc]}><boxGeometry args={[0.08, 2.4, B.depth]} /><meshStandardMaterial color="#e8e6e2" roughness={0.6} /></mesh>)}
      {Array.from({ length: Math.floor(w / 1.5) + 1 }, (_, k) => <mesh key={k} position={[B.a0 + k * 1.5, 0.55, z1 + 0.06]}><boxGeometry args={[0.05, 1.1, 0.08]} /><meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.3} /></mesh>)}
    </group>
  );
}
/** "Take in the view": the camera drifts slowly along the balcony rail, looking out over the city. Any action ends it. */
export const viewMode = { on: false, t0: 0 };
function ViewCam({ def }: { def: InteriorDef }) {
  useFrame(({ camera }) => {
    if (!viewMode.on || !def.balcony) return;
    const t = (performance.now() - viewMode.t0) / 1000, B = def.balcony, z1 = -def.d / 2 - B.depth, u = (Math.sin(t * 0.12) + 1) / 2, x = def.ox + B.a0 + 1 + u * (B.a1 - B.a0 - 2);
    camera.position.set(x, FLOOR + 1.7, z1 + 0.9); camera.lookAt(x - 60 + Math.sin(t * 0.07) * 120, FLOOR - 70, z1 - 400);
    if (t > 40 || game.where !== def.id) viewMode.on = false;
  }, 1);
  return null;
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
      {def.balcony && <Balcony def={def} />}
      {def.pano === 'city' && <HighView />}
      {[[0, -d / 2, 0], [0, d / 2, Math.PI], [-w / 2, 0, Math.PI / 2], [w / 2, 0, -Math.PI / 2]].filter((_, i) => !(i === 0 && def.balcony)).map(([x, z, r], i) => (
        <mesh key={i} position={[x, h / 2, z]} rotation-y={r} receiveShadow><planeGeometry args={[i < 2 ? w : d, h]} /><meshStandardMaterial color={def.wall} roughness={0.85} /></mesh>
      ))}
      {def.furniture.map((f, i) => f.tex ? <TexturedFurn key={def.name + i} f={f} /> : (
        <mesh key={i} position={[(f.x0 + f.x1) / 2, (f.y0 || 0) + f.h / 2, (f.z0 + f.z1) / 2]} scale={f.shape === 'ball' ? [f.x1 - f.x0, f.h, f.z1 - f.z0] : 1} castShadow={!f.walk && !f.glow && !f.glass} receiveShadow={!f.glass}>
          {f.shape === 'cyl' ? <cylinderGeometry args={[Math.min(f.x1 - f.x0, f.z1 - f.z0) / 2, Math.min(f.x1 - f.x0, f.z1 - f.z0) / 2, f.h, 20]} /> : f.shape === 'ball' ? <sphereGeometry args={[0.5, 18, 12]} /> : <boxGeometry args={[f.x1 - f.x0, f.h, f.z1 - f.z0]} />}
          {f.glass ? <meshStandardMaterial color="#b8d4ea" transparent opacity={0.14} metalness={0.9} roughness={0.04} depthWrite={false} /> : f.glow ? <meshBasicMaterial color={f.c} toneMapped={false} /> : <meshStandardMaterial color={f.c} roughness={f.rough ?? 0.6} metalness={f.metal ?? 0} />}
        </mesh>
      ))}
      {!def.home && !def.noSign && <mesh position={[0, Math.min(3.3, h - 0.75), -d / 2 + 0.05]}><planeGeometry args={[5, 1.25]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>}
      {def.views?.map((v, i) => <ViewPlane key={i} v={v} def={def} />)}
      {def.balcony && <ViewCam def={def} />}
      {def.lights?.map((l, i) => def.flicker && i === 0 ? <FlickerLight key={i} l={l} /> : <pointLight key={i} position={[l.x, l.y, l.z]} intensity={l.i} distance={l.d} decay={1.6} color={l.c} />)}
      {def.npcs?.map((n, i) => <Clerk key={def.name + i} x={n.x} z={n.z} yaw={n.yaw} shop={false} look={n.look} />)}
      {def.links?.map((l, i) => <mesh key={'lk' + i} rotation-x={-Math.PI / 2} position={[l.x, 0.02, l.z]}><ringGeometry args={[0.55, 0.75, 32]} /><meshBasicMaterial color="#2be4ff" toneMapped={false} /></mesh>)}
      {def.roofSpot && <mesh rotation-x={-Math.PI / 2} position={[def.roofSpot.x, 0.02, def.roofSpot.z]}><ringGeometry args={[0.55, 0.75, 32]} /><meshBasicMaterial color="#ffd23a" toneMapped={false} /></mesh>}
      {!def.home && !def.ownLights && [-w / 4, w / 4].map((x) => <mesh key={x} position={[x, h - 0.05, 0]} rotation-x={Math.PI / 2}><planeGeometry args={[2.4, 0.5]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>)}
      {def.rob && <Clerk />}
      {def.acts?.filter((a) => a.id !== 'ramen:eat').map((a, i) => <mesh key={'ac' + i} rotation-x={-Math.PI / 2} position={[a.x, 0.02, a.z]}><ringGeometry args={[0.5, 0.68, 32]} /><meshBasicMaterial color="#ffd23a" toneMapped={false} /></mesh>)}
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
  const lx = p.x - def.ox, lz = p.z - def.oz, B = def.balcony;
  // out on the balcony the room reaches further north, between its side screens
  const onB = !!B && lz < -def.d / 2 + r && lx > B.a0 + r - 0.3 && lx < B.a1 - r + 0.3;
  let x = onB ? Math.min(B!.a1 - r, Math.max(B!.a0 + r, lx)) : Math.min(def.w / 2 - r, Math.max(-def.w / 2 + r, lx));
  let z = Math.min(def.d / 2 - r, Math.max((onB ? -def.d / 2 - B!.depth : -def.d / 2) + r, lz));
  for (const f of def.furniture) {
    if (f.walk) continue;
    const cx = Math.min(f.x1, Math.max(f.x0, x)), cz = Math.min(f.z1, Math.max(f.z0, z)), ex = x - cx, ez = z - cz, d2 = ex * ex + ez * ez;
    if (d2 < r * r) { if (d2 < 1e-8) { z = f.z1 + r; } else { const dd = Math.sqrt(d2); x = cx + (ex / dd) * r; z = cz + (ez / dd) * r; } }
  }
  p.x = x + def.ox; p.z = z + def.oz;
}
