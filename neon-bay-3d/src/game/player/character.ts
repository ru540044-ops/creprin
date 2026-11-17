import * as THREE from 'three';
import { Appearance, DEFAULT_LOOK, lookFromColors, SKINS, HAIR_COLORS, EYE_COLORS, CLOTH, itemById, playerFaceTexture, irisTexture, monogramTexture, skinMaterial, skinNormalTexture, hairTexture, monogramCloth } from './appearance';
import * as AV from './avatar';

/** Character with jointed limbs, a sculpted head with real eyes, hair, clothes and accessories; animated by anim/pose.ts. */
export interface Look { skin: string; shirt: string; pants: string; shoe: string; hair: string; pony?: boolean }
export type Character = ReturnType<typeof makeCharacter>;

/** Old flat face texture kept for anything that still asks for it. */
export { faceAtlasTexture as faceTexture } from './appearance';

const isLook = (o: Appearance | Look): o is Look => typeof (o as Look).shirt === 'string';
export function watchMaterials(model: string) {
  const metal = model.includes('gold') || model === 'dress_gold' ? '#d4a53a' : model === 'dress_ice' ? '#eef3f8' : model === 'tonneau_carbon' ? '#1c1c20' : '#c8ccd2';
  const strap = model === 'tonneau_red' ? '#c0161c' : model === 'tonneau_carbon' ? '#18181b' : metal;
  return { case: new THREE.MeshStandardMaterial({ color: metal, metalness: model === 'tonneau_carbon' ? 0.3 : 1, roughness: model === 'dress_ice' ? 0.08 : 0.28 }), strap: new THREE.MeshStandardMaterial({ color: strap, metalness: strap === metal && model !== 'tonneau_carbon' ? 1 : 0.1, roughness: 0.35 }) };
}

export function makeCharacter(input: Appearance | Look = DEFAULT_LOOK, seed = 1) {
  const L: Appearance = isLook(input) ? lookFromColors(input, seed) : input;
  const skinC = SKINS[L.skin], col = (i: number) => CLOTH[i];
  const std = (color: string, rough = 0.75, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const skin = skinMaterial(skinC, null, 0.55);
  const mono = monogramTexture();
  const lux = (on: boolean, color: string, rx = 6, ry = 4) => (on ? std('#ffffff', 0.6, { map: monogramCloth(rx, ry) }) : std(color));
  const blazer = L.top === 'blazer';
  const topM = lux(L.luxTop && blazer, col(L.topColor));
  const torsoM = blazer ? std(col(0), 0.7) : topM; // shirt under the jacket
  const bottomM = std(L.top === 'dress' ? col(L.topColor) : col(L.bottomColor), L.bottom === 'jeans' ? 0.9 : 0.8);
  const shoeM = L.luxShoes ? std('#efe9df', 0.45) : std(col(L.shoeColor), 0.55);
  const hairM = new THREE.MeshPhysicalMaterial({ color: HAIR_COLORS[L.hairColor], map: L.hair === 'curly' ? null : hairTexture(), roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(HAIR_COLORS[L.hairColor]).lerp(new THREE.Color('#ffffff'), 0.35), sheenRoughness: 0.35 });
  const cap = (r: number, l: number, m: THREE.Material) => { const mm = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 12), m); mm.castShadow = true; return mm; };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mm = new THREE.Mesh(g, m); mm.castShadow = shadow; mm.receiveShadow = true; return mm; };

  const root = new THREE.Group(), hips = new THREE.Group(), spine = new THREE.Group(), head = new THREE.Group();
  root.add(hips); hips.position.y = 0.95; root.scale.setScalar(L.height);
  const pelvis = cap(0.17, 0.12, L.top === 'dress' ? topM : bottomM); pelvis.rotation.z = Math.PI / 2; pelvis.scale.set(1, L.fem ? 1.22 : 1.12, 0.8); hips.add(pelvis);
  if (L.bottom === 'skirt' || L.top === 'dress') hips.add(mesh(AV.skirtGeometry(L.top === 'dress'), L.top === 'dress' ? topM : bottomM));
  hips.add(spine); spine.position.y = 0.1;
  const torso = mesh(AV.torsoGeometry(L.fem), torsoM); torso.scale.x = L.fem ? 0.92 : 1; spine.add(torso);
  if (blazer) { spine.add(mesh(AV.jacketGeometry(), topM)); spine.add(mesh(AV.shirtFrontGeometry(), std(col(0), 0.7), false)); if (!L.fem) spine.add(mesh(AV.tieGeometry(), std(col(L.topColor === 4 ? 1 : 4), 0.5), false)); }
  if (L.top === 'hoodie') spine.add(mesh(AV.hoodGeometry(), topM));
  if (L.top === 'shirt') spine.add(mesh(AV.collarGeometry(), topM, false));
  spine.add(head); head.position.y = 0.66;
  const neck = cap(0.048, 0.08, skin); neck.position.y = -0.04; head.add(neck);
  // head: sculpted skull with the painted face, real eyeballs, eyelids, ears
  const faceM = skinMaterial(skinC, playerFaceTexture(L), 0.5);
  head.add(mesh(AV.headGeometry(L.face, 56), faceM));
  const sclera = new THREE.MeshPhysicalMaterial({ color: '#f3f0ea', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  const iris = new THREE.MeshStandardMaterial({ color: EYE_COLORS[L.eye], map: irisTexture(), roughness: 0.2 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * AV.EYE.x, AV.EYE.y, AV.EYE.z); head.add(eye);
    eye.add(mesh(AV.eyeballGeometry(), sclera, false), mesh(AV.irisGeometry(), iris, false), mesh(AV.lidGeometry(), skin, false));
    head.add(mesh(AV.earGeometry(s), skin));
  }
  head.add(mesh(AV.hairGeometry(L.hair), hairM));
  const beard = AV.beardGeometry(L.beard); if (beard) head.add(mesh(beard, hairM));
  const hat = AV.hatGeometry(L.hat); if (hat) head.add(mesh(hat, lux(L.luxHat && L.hat === 'cap', col(L.hatColor), 5, 2)));
  const gl = AV.glassesGeometry(L.glasses); if (gl) head.add(mesh(gl, L.glasses === 'shades' ? new THREE.MeshPhysicalMaterial({ color: '#101014', roughness: 0.1, metalness: 0.4, clearcoat: 1 }) : std('#c9a25a', 0.3, { metalness: 1 }), false));
  // limbs
  const sleeveLong = L.top === 'shirt' || L.top === 'hoodie' || blazer, bare = L.top === 'tank' || L.top === 'dress';
  const legBareThigh = L.bottom === 'skirt' || L.top === 'dress', legBareShin = legBareThigh || L.bottom === 'shorts';
  const mkLimb = (upperLen: number, lowerLen: number, r: number, mU: THREE.Material, mL: THREE.Material, end: THREE.Object3D) => {
    const top = new THREE.Group(), mid = new THREE.Group();
    const u = cap(r, upperLen - r * 2, mU); u.position.y = -upperLen / 2; top.add(u);
    top.add(mid); mid.position.y = -upperLen;
    const l = cap(r * 0.85, lowerLen - r * 2, mL); l.position.y = -lowerLen / 2; mid.add(l);
    end.position.y = -lowerLen; mid.add(end); return { top, mid };
  };
  const arms = [-1, 1].map((s) => {
    const hand = mesh(AV.handGeometry(), skin);
    const a = mkLimb(0.3, 0.28, 0.055, bare ? skin : topM, sleeveLong ? topM : skin, hand); a.top.position.set(s * (L.fem ? 0.23 : 0.25), 0.53, 0); spine.add(a.top); return a;
  });
  const W = L.watch ? itemById(L.watch) : null;
  if (W) { const m = watchMaterials(W.model), p = AV.watchParts(W.model.startsWith('tonneau'), 1); arms[1].mid.add(mesh(p.band, m.strap, false), mesh(p.face, m.case, false)); }
  const B = L.bag ? itemById(L.bag) : null;
  if (B) arms[1].mid.add(mesh(AV.bagGeometry(B.model), std('#ffffff', 0.55, { map: monogramCloth(2, 2) })));
  const legs = [-1, 1].map((s) => { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), shoeM); foot.position.z = 0.06; foot.castShadow = true; const l = mkLimb(0.46, 0.45, 0.075, legBareThigh ? skin : bottomM, legBareShin ? skin : bottomM, foot); l.top.position.set(s * (L.fem ? 0.115 : 0.11), -0.02, 0); hips.add(l.top); return l; });
  const dispose = () => root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const x of mats) { const sm = x as THREE.MeshStandardMaterial; if (sm.map && sm.map !== mono && sm.map !== irisTexture() && sm.map !== hairTexture() && !sm.map.userData.shared) sm.map.dispose(); if (sm.normalMap && sm.normalMap !== skinNormalTexture()) sm.normalMap.dispose(); x.dispose(); } } });
  return { root, hips, spine, head, arms, legs, dispose };
}
