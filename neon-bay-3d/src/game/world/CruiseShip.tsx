import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CRUISE, PORT } from './cityGen';
import { labelTexture, getTextures } from './textures';
import { game } from '../state/store';

/** The NEON BAY PRINCESS: a 210 m cruise liner moored at the port. Its decks are solid (see cityGen) so you can walk them. */
const C = CRUISE, BOW = C.x1 + 12, MID = (C.z0 + C.z1) / 2, HW = (C.z1 - C.z0) / 2;
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Hull plan (top view) extruded vertically between y0 and y1, bow pointing +x. */
function hullSlab(y0: number, y1: number, inset = 0) {
  const sh = new THREE.Shape(); const z0 = -(C.z0 + inset), z1 = -(C.z1 - inset); // shape y = -world z
  sh.moveTo(C.x0 + inset, z0); sh.lineTo(C.x1 - 40, z0); sh.quadraticCurveTo(BOW - 6 - inset, z0, BOW - inset, -MID); sh.quadraticCurveTo(BOW - 6 - inset, z1, C.x1 - 40, z1); sh.lineTo(C.x0 + inset, z1); sh.lineTo(C.x0 + inset, z0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 10 }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  // planar UVs along the hull length so window textures wrap the sides
  const p = g.attributes.position as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - C.x0) / 12; uv[i * 2 + 1] = (p.getY(i) - y0) / (y1 - y0); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}

export default function CruiseShip() {
  const S = useMemo(() => {
    const hullTex = canvasTex(256, 128, (c) => { c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#1d2c4d'; c.fillRect(0, 0, 256, 6); for (const y of [34, 70, 104]) for (let x = 10; x < 256; x += 22) { c.fillStyle = '#25384f'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.strokeStyle = '#b8bcc4'; c.lineWidth = 2; c.stroke(); } });
    const hullEm = canvasTex(256, 128, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 256, 128); for (const y of [34, 70, 104]) for (let x = 10; x < 256; x += 22) if (Math.random() < 0.55) { c.fillStyle = '#ffd9a0'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); } });
    const cabinTex = canvasTex(256, 128, (c) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 256, 128); for (let row = 0; row < 3; row++) { const y = 8 + row * 40; for (let x = 0; x < 256; x += 32) { c.fillStyle = '#2a4a6a'; c.fillRect(x + 3, y, 26, 26); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 3, y, 9, 26); c.fillStyle = '#d0d4da'; c.fillRect(x, y + 27, 32, 3); c.fillStyle = '#9aa0a8'; c.fillRect(x, y + 30, 32, 2); } } });
    const cabinEm = canvasTex(256, 128, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 256, 128); for (let row = 0; row < 3; row++) for (let x = 0; x < 256; x += 32) if (Math.random() < 0.6) { c.fillStyle = Math.random() < 0.8 ? '#ffd29a' : '#9fd8ff'; c.fillRect(x + 3, 8 + row * 40, 26, 26); } });
    const white = new THREE.MeshStandardMaterial({ map: hullTex, emissiveMap: hullEm, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.35, metalness: 0.1 });
    const navy = new THREE.MeshStandardMaterial({ color: '#16233c', roughness: 0.5 }), red = new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.45 });
    const cabins = new THREE.MeshStandardMaterial({ map: cabinTex, emissiveMap: cabinEm, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.3, metalness: 0.1 });
    const plain = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4 }), deck = new THREE.MeshStandardMaterial({ color: '#b08a5e', roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: '#0b1220', roughness: 0.1, metalness: 0.8 }), metal = new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.9, roughness: 0.25 });
    const orange = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.5 }), pool = new THREE.MeshBasicMaterial({ color: '#2bc4ff', toneMapped: false });
    const geo: [THREE.BufferGeometry, THREE.Material][] = [];
    const bx = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
    // hull: navy below the waterline band, red boot-top, white topsides with portholes, teak promenade deck
    geo.push([hullSlab(-6, 1.2), navy], [hullSlab(1.2, 2.4), red], [hullSlab(2.4, C.deck), white], [hullSlab(C.deck - 0.02, C.deck + 0.05, 0.4), deck]);
    // superstructure tiers with balcony cabins; the bridge and its wings at the front
    const tiers = [[14, 20, 14, 36, 3], [20, 26, 20, 40, 4.5], [26, 30, 30, 48, 6]];
    for (const [y0, y1, a, b, inz] of tiers) { const g = bx(C.x0 + a, y0, C.z0 + inz, C.x1 - b, y1, C.z1 - inz); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (C.x1 - b - C.x0 - a) / 8); geo.push([g, cabins]); geo.push([bx(C.x0 + a - 0.2, y1, C.z0 + inz - 0.2, C.x1 - b + 0.2, y1 + 0.3, C.z1 - inz + 0.2), plain]); }
    geo.push([bx(C.x1 - 36, 20, C.z0 + 1, C.x1 - 30, 28, C.z1 - 1), plain], [bx(C.x1 - 30.2, 24, C.z0 + 1.5, C.x1 - 29.8, 27, C.z1 - 1.5), dark]);
    // sun deck: pool, hot tubs, loungers, bar, water slide tower; funnel with company stripe; radar mast
    geo.push([bx(380, C.sun + 0.3, MID - 5, 402, C.sun + 0.36, MID + 5), pool], [bx(379, C.sun + 0.3, MID - 6, 403, C.sun + 0.9, MID - 5), plain], [bx(379, C.sun + 0.3, MID + 5, 403, C.sun + 0.9, MID + 6), plain]);
    for (const x of [366, 371]) geo.push([new THREE.CylinderGeometry(1.8, 1.8, 0.8, 16).translate(x, C.sun + 0.7, MID), plain], [new THREE.CylinderGeometry(1.55, 1.55, 0.1, 16).translate(x, C.sun + 1.1, MID), pool]);
    for (let x = 352; x < 432; x += 4) for (const z of [MID - 8, MID + 8]) if (x < 377 || x > 405) geo.push([bx(x, C.sun + 0.3, z - 0.5, x + 2.2, C.sun + 0.75, z + 0.5), plain]);
    geo.push([bx(410, C.sun + 0.3, MID - 3, 416, C.sun + 1.4, MID + 3), dark]);
    const slide = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, k) => { const a = k * 0.55, r = 4.5; return new THREE.Vector3(425 + Math.cos(a) * r, C.sun + 13 - k * 0.52, MID + Math.sin(a) * r); })), 120, 0.9, 10, false);
    geo.push([slide, new THREE.MeshStandardMaterial({ color: '#ffd23a', roughness: 0.3, side: THREE.DoubleSide })], [bx(424, C.sun, MID - 1, 426, C.sun + 13.5, MID + 1), metal]);
    geo.push([new THREE.CylinderGeometry(7, 8, 14, 20).scale(1.3, 1, 0.75).translate(C.x0 + 43, C.sun + 7, MID), red], [new THREE.CylinderGeometry(7.05, 7.05, 2, 20).scale(1.3, 1, 0.75).translate(C.x0 + 43, C.sun + 13.2, MID), new THREE.MeshStandardMaterial({ color: '#141414' })], [new THREE.CylinderGeometry(7.08, 7.08, 1.2, 20).scale(1.3, 1, 0.75).translate(C.x0 + 43, C.sun + 6, MID), plain]);
    geo.push([bx(C.x1 - 40, C.sun, MID - 0.5, C.x1 - 39, C.sun + 12, MID + 0.5), metal], [bx(C.x1 - 43, C.sun + 10, MID - 0.3, C.x1 - 36, C.sun + 10.4, MID + 0.3), metal]);
    // lifeboats on davits along both sides, deck railings, gangway to the quay, mooring lines
    for (let x = C.x0 + 30; x < C.x1 - 50; x += 15) for (const s of [-1, 1]) { const z = MID + s * (HW + 0.6); geo.push([new THREE.CapsuleGeometry(1.4, 6, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.75, 1).translate(x, 16.5, z), orange], [bx(x - 0.15, 15.5, z - s * 1.4 - 0.15, x + 0.15, 19, z - s * 1.4 + 0.15), metal]); }
    for (const s of [-1, 1]) { geo.push([bx(C.x0 + 1, C.deck + 1.05, MID + s * (HW - 0.3) - 0.05, C.x1 - 20, C.deck + 1.12, MID + s * (HW - 0.3) + 0.05), metal]); geo.push([bx(C.x0 + 14, C.sun + 1.05, MID + s * 8.9 - 0.05, C.x1 - 48, C.sun + 1.12, MID + s * 8.9 + 0.05), metal]); }
    const gw = bx(-0.8, -0.1, 0, 0.8, 0.1, Math.hypot(C.z0 - PORT.z1, 8 - 1.2)); gw.translate(0, 0, 0); gw.rotateX(-Math.atan2(8 - 1.2, C.z0 - PORT.z1)); gw.translate((C.x0 + C.x1) / 2, 1.3, PORT.z1 - 0.5); geo.push([gw, metal]);
    const rope = new THREE.MeshStandardMaterial({ color: '#d8c8a0', roughness: 0.9 });
    for (const x of [C.x0 + 8, C.x0 + 60, C.x1 - 60, C.x1 - 30]) { const a = new THREE.Vector3(x, C.deck, C.z0), b = new THREE.Vector3(x - 6, 1.6, PORT.z1 - 2), len = a.distanceTo(b); const g = new THREE.CylinderGeometry(0.08, 0.08, len, 6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); geo.push([g, rope]); }
    // group by material into merged meshes
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const [g, m] of geo) { const list = byMat.get(m) || []; list.push(g.index ? g.toNonIndexed() : g); byMat.set(m, list); }
    const group = new THREE.Group();
    for (const [m, list] of byMat) { const keepUv = list.every((g) => g.attributes.uv); const merged = mergeGeometries(keepUv ? list : list.map((g) => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }))!; const mesh = new THREE.Mesh(merged, m); mesh.castShadow = m !== pool; mesh.receiveShadow = true; group.add(mesh); }
    // names on the bow, string lights over the sun deck
    const name = new THREE.MeshBasicMaterial({ map: labelTexture('NEON BAY PRINCESS', '#c9a24a', 1024, 128), transparent: true, toneMapped: false });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.2), name); p.position.set(C.x1 - 26, 10, MID + s * (HW + 0.05)); p.rotation.y = s > 0 ? 0 : Math.PI; group.add(p); }
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false }), 80);
    for (let k = 0; k < 80; k++) { const x = 352 + (k % 40) * 2.2, z = k < 40 ? MID - 4 : MID + 4; bulbs.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, C.sun + 5 + Math.sin((k % 40) * 0.6) * 0.4, z)); }
    group.add(bulbs);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(30, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: getTextures().glow, color: '#2bc4ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); glow.position.set(391, C.sun + 0.5, MID); group.add(glow);
    return { group, white, cabins, bulbs };
  }, []);
  useFrame(() => {
    const night = game.hour > 18.4 || game.hour < 6.2 ? 1 : game.hour > 17.4 ? (game.hour - 17.4) : 0;
    S.white.emissiveIntensity = night * 1.4; S.cabins.emissiveIntensity = night * 1.6;
    (S.bulbs.material as THREE.MeshBasicMaterial).color.set('#ffe0a0').multiplyScalar(0.4 + night * 1.8);
  });
  return <primitive object={S.group} />;
}
