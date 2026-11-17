import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { peds, pickups, PED_MAX, Ped } from './peds';
import { vehicles } from '../vehicles/sim';
import { game } from '../state/store';
import * as A from '../anim/pose';
import { lookFromSeed, Appearance, HairStyle, SKINS, HAIR_COLORS, EYE_COLORS, CLOTH, HAIR_STYLES, faceAtlasTexture, faceIndexFor, irisTexture, skinMaterial, hairTexture, monogramCloth, monogramTexture, itemById, fashion, FACE_TILES } from '../player/appearance';
import * as AV from '../player/avatar';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fx } from '../combat/fx';
import { combat } from '../combat/weapons';
import { booms, grenades } from '../combat/explode';
import { getTextures } from '../world/textures';
import { spots, towels, rods } from './ambient';

const M = new THREE.Matrix4(), B = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const E = new THREE.Euler(), J = new THREE.Matrix4(), H = new THREE.Matrix4(), SP = new THREE.Matrix4(), HD = new THREE.Matrix4(), AT = new THREE.Matrix4(), LT = new THREE.Matrix4(), MID = new THREE.Matrix4(), ARM1 = new THREE.Matrix4();
const rot = (m: THREE.Matrix4, x: number, y: number, z: number) => m.makeRotationFromEuler(E.set(x, y, z));
const MAXD = 22; // drivers drawn inside AI cars
const SLOTS = PED_MAX + MAXD;
const C3 = (h: string) => new THREE.Color(h);
const SKIN_C = SKINS.map(C3), HAIR_C = HAIR_COLORS.map(C3), EYE_C = EYE_COLORS.map(C3), CLOTH_C = CLOTH.map(C3);
const GOLD = C3('#d4a53a'), STEEL = C3('#c8ccd2'), TIE_C = C3('#8a2a2a');

/** Everything needed to draw one person, worked out once per pedestrian / driver. */
interface Dressed { L: Appearance; face: number; skin: THREE.Color; torso: THREE.Color; pelvis: THREE.Color; uarm: THREE.Color; farm: THREE.Color; thigh: THREE.Color; shin: THREE.Color; foot: THREE.Color; hair: THREE.Color; top: THREE.Color; hat: THREE.Color; eye: THREE.Color; skirt: THREE.Color; watch: THREE.Color | null }
function dress(L: Appearance, seed: number): Dressed {
  const skin = SKIN_C[L.skin], top = CLOTH_C[L.topColor], bottom = CLOTH_C[L.bottomColor], dressT = L.top === 'dress', blazer = L.top === 'blazer';
  const long = L.top === 'shirt' || L.top === 'hoodie' || blazer, bare = L.top === 'tank' || dressT, skirt = L.bottom === 'skirt' || dressT;
  const W = L.watch ? itemById(L.watch) : null;
  return { L, face: faceIndexFor(L, seed), skin, top, torso: blazer ? CLOTH_C[0] : top, pelvis: dressT ? top : bottom, uarm: bare ? skin : top, farm: long ? top : skin, thigh: skirt ? skin : bottom, shin: skirt || L.bottom === 'shorts' ? skin : bottom, foot: CLOTH_C[L.shoeColor], hair: HAIR_C[L.hairColor], hat: CLOTH_C[L.hatColor], eye: EYE_C[L.eye], skirt: dressT ? top : bottom, watch: W ? (W.model.includes('gold') || W.model === 'dress_gold' ? GOLD : STEEL) : null };
}
const POLICE_LOOK = (seed: number): Appearance => ({ ...lookFromSeed(seed), top: 'shirt', topColor: 2, bottom: 'slacks', bottomColor: 2, hat: 'cap', hatColor: 2, glasses: 'none', bag: '', watch: '', beard: 'none' });

/** Packed instanced meshes: each frame the visible people are written to instances 0..n-1, so hidden ones cost nothing on the GPU. */
class Pack {
  n = 0; mesh: THREE.InstancedMesh; tint: boolean; uv: THREE.InstancedBufferAttribute | null = null;
  constructor(g: THREE.BufferGeometry, mat: THREE.Material, cap: number, shadow: boolean, tint = true, uvOff = false) {
    if (uvOff) { this.uv = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); this.uv.setUsage(THREE.DynamicDrawUsage); g.setAttribute('uvOff', this.uv); }
    this.mesh = new THREE.InstancedMesh(g, mat, cap); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = shadow; this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.tint = tint;
    if (tint) { this.mesh.setColorAt(0, new THREE.Color()); this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage); }
  }
  add(m: THREE.Matrix4, c?: THREE.Color) { if (this.n >= this.mesh.instanceMatrix.count) return -1; this.mesh.setMatrixAt(this.n, m); if (this.tint && c) this.mesh.setColorAt(this.n, c); return this.n++; }
  begin() { this.n = 0; }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; if (this.uv) this.uv.needsUpdate = true; }
}
const std = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...o });
function faceMaterial() {
  const m = skinMaterial('#ffffff', faceAtlasTexture(), 0.52), k = (1 / FACE_TILES).toFixed(4);
  m.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute vec2 uvOff;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv = vMapUv * ${k} + uvOff;`); };
  m.customProgramCacheKey = () => 'pedface'; return m;
}
function buildPacks() { return AV.withDetail(22, buildPacks2); }
function buildPacks2() {
  const N = SLOTS, N2 = SLOTS * 2, hairs: Partial<Record<HairStyle, Pack>> = {};
  const P = {
    pelvis: new Pack(new THREE.CapsuleGeometry(0.17, 0.12, 3, 10), std(), N, true), torso: new Pack(AV.torsoGeometry(false), std(), N, true), torsoF: new Pack(AV.torsoGeometry(true), std(), N, true),
    neck: new Pack(new THREE.CapsuleGeometry(0.048, 0.08, 2, 8), std({ roughness: 0.55 }), N, false), head: new Pack(AV.headGeometry(1, 28), faceMaterial(), N, true, true, true),
    ears: new Pack(mergeGeometries([AV.earGeometry(-1), AV.earGeometry(1)])!, std({ roughness: 0.55 }), N, false),
    sclera: new Pack(AV.eyeballGeometry(), std({ color: '#f2efe8', roughness: 0.18 }), N2, false, false), iris: new Pack(AV.irisGeometry(), std({ map: irisTexture(), roughness: 0.2 }), N2, false), lid: new Pack(AV.lidGeometry(), std({ roughness: 0.55 }), N2, false),
    uarm: new Pack(new THREE.CapsuleGeometry(0.055, 0.19, 3, 8), std(), N2, true), farm: new Pack(new THREE.CapsuleGeometry(0.047, 0.19, 3, 8), std(), N2, false), hand: new Pack(AV.handGeometry(), std({ roughness: 0.55 }), N2, false),
    thigh: new Pack(new THREE.CapsuleGeometry(0.075, 0.31, 3, 8), std(), N2, true), shin: new Pack(new THREE.CapsuleGeometry(0.064, 0.32, 3, 8), std(), N2, true), foot: new Pack(new THREE.BoxGeometry(0.11, 0.08, 0.26), std({ roughness: 0.55 }), N2, false),
    beardFull: new Pack(AV.beardGeometry('full')!, std({ roughness: 0.7 }), N, false), beardMus: new Pack(AV.beardGeometry('mustache')!, std({ roughness: 0.7 }), N, false),
    cap: new Pack(AV.hatGeometry('cap')!, std(), N, false), beanie: new Pack(AV.hatGeometry('beanie')!, std({ roughness: 0.95 }), N, false), fedora: new Pack(AV.hatGeometry('fedora')!, std(), N, true),
    shades: new Pack(AV.glassesGeometry('shades')!, std({ color: '#101014', roughness: 0.12, metalness: 0.4 }), N, false, false), round: new Pack(AV.glassesGeometry('round')!, std({ color: '#c9a25a', roughness: 0.3, metalness: 1 }), N, false, false),
    jacket: new Pack(AV.jacketGeometry(), std(), N, true), front: new Pack(AV.shirtFrontGeometry(), std({ color: '#f4f4f6' }), N, false, false), tie: new Pack(AV.tieGeometry(), std({ roughness: 0.5 }), N, false),
    hood: new Pack(AV.hoodGeometry(), std(), N, false), collar: new Pack(AV.collarGeometry(), std(), N, false),
    skirtS: new Pack(AV.skirtGeometry(false), std({ side: THREE.DoubleSide }), N, true), skirtL: new Pack(AV.skirtGeometry(true), std({ side: THREE.DoubleSide }), N, true),
    watch: new Pack(AV.watchGeometry(false, 1), std({ metalness: 1, roughness: 0.3 }), N, false), bag: new Pack(AV.bagGeometry('tote'), std({ map: monogramCloth(2, 2), roughness: 0.55 }), N, false, false),
  };
  for (const h of HAIR_STYLES) if (h !== 'bald') hairs[h] = new Pack(AV.hairGeometry(h), std({ roughness: 0.6, map: h === 'curly' ? null : hairTexture() }), N, true);
  return { P, hairs, all: [...Object.values(P), ...(Object.values(hairs) as Pack[])] };
}
type Packs = ReturnType<typeof buildPacks>;
const T0 = new THREE.Matrix4(), EYES = [-1, 1].map((s) => new THREE.Matrix4().makeTranslation(s * AV.EYE.x, AV.EYE.y, AV.EYE.z));

/** Write one character from a pose (same skeleton as player/character.ts). near: also draw eyes and small accessories. */
function writeRig(K: Packs, D: Dressed, root: THREE.Matrix4, pose: A.Pose, near: boolean) {
  const P = K.P, L = D.L;
  J.copy(root).multiply(T.makeTranslation(0, pose.oy + 0.18 * pose.fall, pose.oz)).multiply(rot(R, pose.fall * (pose.fdir > 0 ? -Math.PI / 2 : Math.PI / 2), 0, pose.fall * pose.fside * 0.6));
  H.copy(J).multiply(T.makeTranslation(0, pose.hy, 0)).multiply(rot(R, pose.hx, pose.hr, pose.hz));
  M.copy(H).multiply(R.makeRotationZ(Math.PI / 2)).multiply(T.makeScale(1, L.fem ? 1.22 : 1.12, 0.8)); P.pelvis.add(M, D.pelvis);
  if (L.top === 'dress') P.skirtL.add(H, D.skirt); else if (L.bottom === 'skirt') P.skirtS.add(H, D.skirt);
  SP.copy(H).multiply(T.makeTranslation(0, 0.1, 0)).multiply(rot(R, pose.sx, pose.sy, pose.sz));
  if (L.fem) { M.copy(SP).multiply(R.makeScale(0.92, 1, 1)); P.torsoF.add(M, D.torso); } else P.torso.add(SP, D.torso);
  if (L.top === 'blazer') { P.jacket.add(SP, D.top); P.front.add(SP); if (!L.fem) P.tie.add(SP, TIE_C); }
  else if (L.top === 'hoodie') P.hood.add(SP, D.top); else if (L.top === 'shirt') P.collar.add(SP, D.top);
  HD.copy(SP).multiply(T.makeTranslation(0, 0.66, 0)).multiply(rot(R, pose.nx, pose.ny, 0));
  M.copy(HD).multiply(T.makeTranslation(0, -0.04, 0)); P.neck.add(M, D.skin);
  const hi = P.head.add(HD, D.skin); if (hi >= 0) P.head.uv!.setXY(hi, (D.face % FACE_TILES) / FACE_TILES, 1 - (Math.floor(D.face / FACE_TILES) + 1) / FACE_TILES);
  const hp = K.hairs[L.hair]; if (hp && !(L.hat === 'fedora' && (L.hair === 'buzz' || L.hair === 'short'))) hp.add(HD, D.hair);
  if (L.hat === 'cap') P.cap.add(HD, D.hat); else if (L.hat === 'beanie') P.beanie.add(HD, D.hat); else if (L.hat === 'fedora') P.fedora.add(HD, D.hat);
  if (L.beard === 'full') P.beardFull.add(HD, D.hair); else if (L.beard === 'mustache') P.beardMus.add(HD, D.hair);
  if (near) {
    P.ears.add(HD, D.skin);
    for (const e of EYES) { M.copy(HD).multiply(e); P.sclera.add(M); P.iris.add(M, D.eye); P.lid.add(M, D.skin); }
    if (L.glasses === 'shades') P.shades.add(HD); else if (L.glasses === 'round') P.round.add(HD);
  }
  for (let k = 0; k < 2; k++) {
    const sg = k ? 1 : -1;
    AT.copy(SP).multiply(T.makeTranslation(sg * (L.fem ? 0.23 : 0.25), 0.53, 0)).multiply(rot(R, pose.ax[k], pose.ay[k], pose.az[k]));
    M.copy(AT).multiply(T.makeTranslation(0, -0.15, 0)); P.uarm.add(M, D.uarm);
    MID.copy(AT).multiply(T.makeTranslation(0, -0.3, 0)).multiply(R.makeRotationX(pose.ae[k]));
    M.copy(MID).multiply(T.makeTranslation(0, -0.14, 0)); P.farm.add(M, D.farm);
    M.copy(MID).multiply(T.makeTranslation(0, -0.28, 0)); P.hand.add(M, D.skin);
    if (k === 1) ARM1.copy(MID);
    LT.copy(H).multiply(T.makeTranslation(sg * (L.fem ? 0.115 : 0.11), -0.02, 0)).multiply(rot(R, pose.lx[k], 0, pose.lz[k]));
    M.copy(LT).multiply(T.makeTranslation(0, -0.23, 0)); P.thigh.add(M, D.thigh);
    MID.copy(LT).multiply(T.makeTranslation(0, -0.46, 0)).multiply(R.makeRotationX(pose.lk[k]));
    M.copy(MID).multiply(T.makeTranslation(0, -0.225, 0)); P.shin.add(M, D.shin);
    M.copy(MID).multiply(T.makeTranslation(0, -0.45, 0.06)); P.foot.add(M, D.foot);
  }
  if (near && D.watch) P.watch.add(ARM1, D.watch);
  if (L.bag) P.bag.add(ARM1);
}
void T0;

/** Pose for a pedestrian this frame. */
function pedPose(p: Ped, out: A.Pose, tmp: A.Pose, t: number) {
  const sp = Math.hypot(p.vx, p.vz), tt = t + (p.look % 100);
  switch (p.state) {
    case 'dead': A.lying(out, p.fdir, p.fside, p.look % 97); out.fall = p.fall; break;
    case 'down': A.lying(out, p.fdir, p.fside * 0.5, p.look % 89); out.fall = p.fall; break;
    case 'getup': A.getUp(out, p.fdir, 1 - Math.max(0, p.t)); break;
    case 'cower': A.cower(out, tt); break;
    case 'sit': A.benchSit(out, tt, p.look % 4); break;
    case 'lie': A.sunbathe(out, tt, p.look % 3); break;
    case 'chat': A.idle(out, tt, (['chat', 'chat', 'crossed', 'hips', 'phone'] as const)[p.look % 5], 1, p.gait); break;
    case 'watch': A.idle(out, tt, (['crossed', 'watch', 'look', 'hips', 'breathe'] as const)[p.look % 5], 1, p.gait); break;
    case 'work': A.idle(out, tt, (['hips', 'look', 'watch', 'crossed'] as const)[p.look % 4], 1, p.gait); break;
    case 'fish': A.fishing(out, tt); break;
    case 'dance': A.dance(out, tt, p.look % 3); break;
    case 'hands': case 'handsup': A.idle(out, tt, 'breathe', 0, p.gait); A.handsUp(out, tt); break;
    case 'idle': case 'wait': {
      const k = p.state === 'idle' ? A.env(1 - Math.max(0, p.t) / Math.max(1, p.idleDur), 0.15, 0.2) : 0.8;
      A.idle(out, tt, p.state === 'wait' ? (p.look % 2 ? 'look' : 'tap') : p.idleV, k, p.gait); break;
    }
    default: {
      A.locomotion(out, p.phase, sp, p.gait);
      if (p.callT > 0) { A.copyPose(tmp, out); A.phoneCall(tmp); A.blendUpper(out, tmp, 1); } // calling the police
      else if (p.state === 'flee' && p.flail) { A.copyPose(tmp, out); A.flail(tmp, tt); A.blendUpper(out, tmp, 0.85); }
      else if (p.gait.kind === 'texting' && p.state !== 'flee') { A.copyPose(tmp, out); A.texting(tmp); A.blendUpper(out, tmp, 1); }
      else if (p.gait.kind === 'caller' && p.state !== 'flee') { A.copyPose(tmp, out); A.phoneCall(tmp); A.blendUpper(out, tmp, 1); }
    }
  }
  if (p.fall > 0 && p.state !== 'dead' && p.state !== 'down' && p.state !== 'getup') out.fall = Math.max(out.fall, p.fall);
  out.ny += p.head;
}

/** All pedestrians and AI drivers: packed instanced meshes for every body part, face, hairstyle, outfit piece and accessory. */
export function PedsView() {
  const K = useMemo(buildPacks, []);
  const looks = useRef(new Map<number, Dressed>()), ver = useRef(fashion.ver);
  const pose = useMemo(() => A.newPose(), []), tmp = useMemo(() => A.newPose(), []);
  const dressedFor = (key: number, make: () => Dressed) => { let d = looks.current.get(key); if (!d) { d = make(); looks.current.set(key, d); } return d; };
  useFrame(({ camera }) => {
    const t = performance.now() / 1000, cx = camera.position.x, cz = camera.position.z;
    if (ver.current !== fashion.ver) { ver.current = fashion.ver; looks.current.clear(); }
    if (looks.current.size > 400) looks.current.clear(); // people come and go: rebuild the cache now and then
    for (const p of K.all) p.begin();
    for (let i = 0; i < peds.length && i < PED_MAX; i++) {
      const p = peds[i], dx = p.x - cx, dz = p.z - cz;
      if (Math.abs(dx) > 160 || Math.abs(dz) > 160) continue;
      const D = dressedFor(p.id, () => dress(lookFromSeed(p.look, p.outfit), p.look));
      Q.setFromAxisAngle(UP, p.yaw); V.set(p.x, p.y, p.z); S.setScalar(p.scale * D.L.height); B.compose(V, Q, S);
      pedPose(p, pose, tmp, t); writeRig(K, D, B, pose, dx * dx + dz * dz < 3600);
    }
    // drivers behind the wheel of AI traffic, police and the cash truck
    let d = 0;
    for (const v of vehicles) {
      if (d >= MAXD) break;
      if (!v.ai || v.dead || v.def.kind === 'bike' || v.id === game.inCar) continue;
      const dx = v.x - cx, dz = v.z - cz; if (Math.abs(dx) > 110 || Math.abs(dz) > 110) continue;
      d++;
      const seat = A.seatFor(v.def.kind), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      const D = dressedFor(-v.id, () => dress(v.role === 'police' ? POLICE_LOOK(v.id) : lookFromSeed(v.id * 7919 + 13), v.id));
      Q.setFromEuler(E.set(-v.pitch - v.squat, v.yaw, v.roll, 'YXZ')); V.set(v.x + lx * v.def.wid * seat.side + fx * seat.fwd, v.y + seat.y, v.z + lz * v.def.wid * seat.side + fz * seat.fwd); S.setScalar(1); B.compose(V, Q, S); E.order = 'XYZ';
      A.seated(pose, -v.steer / Math.max(0.2, v.def.steer), seat.recline, t + v.id); writeRig(K, D, B, pose, dx * dx + dz * dz < 900);
    }
    for (const p of K.all) p.end();
  });
  return <>{K.all.map((p, i) => <primitive key={i} object={p.mesh} />)}</>;
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

/** Beach towels under the sunbathers and fishing rods over the pier rail. */
export function AmbientProps() {
  const built = useMemo(() => {
    spots(); // fills towels / rods
    const TC = ['#ff3f6e', '#2be4ff', '#ffd23a', '#3dffb0', '#ffffff', '#c07aff'].map((c) => new THREE.Color(c));
    const tw = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.95, 1.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.95 }), Math.max(1, towels.length));
    towels.forEach((t, i) => { Q.setFromAxisAngle(UP, t.yaw); V.set(t.x, t.y, t.z); S.setScalar(1); M.compose(V, Q, S); tw.setMatrixAt(i, M); tw.setColorAt(i, TC[t.c % TC.length]); });
    tw.count = towels.length; tw.receiveShadow = true;
    const rd = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.022, 3.4, 5), new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.4, metalness: 0.5 }), Math.max(1, rods.length));
    const dir = new THREE.Vector3(), from = new THREE.Vector3(0, 1, 0);
    rods.forEach((r, i) => { const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw); dir.set(fx * 0.82, 0.57, fz * 0.82).normalize(); Q.setFromUnitVectors(from, dir); V.set(r.x + fx * (0.35 + 1.4), r.y + 0.95 + 0.97, r.z + fz * (0.35 + 1.4)); S.setScalar(1); M.compose(V, Q, S); rd.setMatrixAt(i, M); });
    rd.count = rods.length;
    return { tw, rd };
  }, []);
  return <><primitive object={built.tw} /><primitive object={built.rd} /></>;
}
