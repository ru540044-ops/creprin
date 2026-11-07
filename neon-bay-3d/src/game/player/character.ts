import * as THREE from 'three';

/** Character built from primitives with jointed limbs; animated procedurally from speed / airborne / crouch. */
export interface Look { skin: string; shirt: string; pants: string; shoe: string; hair: string; pony?: boolean }
export const NOVA: Look = { skin: '#c98f66', shirt: '#ff3f93', pants: '#27324f', shoe: '#f2f2f2', hair: '#1a1012', pony: true };
export type Character = ReturnType<typeof makeCharacter>;
/** Face painted on a sphere's UVs (front = +z at u = 0.25): brows, eyes, nose shade, mouth. White base so a skin tint multiplies it. */
const faces = new Map<string, THREE.CanvasTexture>();
export function faceTexture(eyes: boolean) {
  const key = eyes ? 'e' : 'n'; const hit = faces.get(key); if (hit) return hit;
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d')!;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  const fx = W * 0.25, ex = W * 0.038;
  if (eyes) for (const s of [-1, 1]) { c.fillStyle = '#f6f6f6'; c.beginPath(); c.ellipse(fx + s * ex, H * 0.45, 9, 6, 0, 0, 7); c.fill(); c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(fx + s * ex, H * 0.45, 4.5, 0, 7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(fx + s * ex, H * 0.45, 2, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(40,24,18,.85)'; c.lineWidth = 3.5; c.lineCap = 'round';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(fx + s * ex - 9, H * 0.385 + (s > 0 ? 1 : 0)); c.quadraticCurveTo(fx + s * ex, H * 0.365, fx + s * ex + 9, H * 0.39); c.stroke(); }
  c.fillStyle = 'rgba(150,90,70,.22)'; c.beginPath(); c.ellipse(fx, H * 0.53, 5, 9, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(140,60,60,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(fx - 9, H * 0.615); c.quadraticCurveTo(fx, H * 0.635, fx + 9, H * 0.615); c.stroke();
  for (const s of [-1, 1]) { c.fillStyle = 'rgba(230,120,110,.12)'; c.beginPath(); c.arc(fx + s * ex * 1.6, H * 0.56, 10, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; faces.set(key, t); return t;
}
export function makeCharacter(L: Look = NOVA) {
  {
    const skin = new THREE.MeshStandardMaterial({ color: L.skin, roughness: 0.65 });
    const shirt = new THREE.MeshStandardMaterial({ color: L.shirt, roughness: 0.75 });
    const pants = new THREE.MeshStandardMaterial({ color: L.pants, roughness: 0.85 });
    const shoe = new THREE.MeshStandardMaterial({ color: L.shoe, roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: L.hair, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: '#141417', roughness: 0.5 });
    const cap = (r: number, l: number, m: THREE.Material) => { const g = new THREE.CapsuleGeometry(r, l, 4, 10); const mm = new THREE.Mesh(g, m); mm.castShadow = true; return mm; };
    const root = new THREE.Group(), hips = new THREE.Group(), spine = new THREE.Group(), head = new THREE.Group();
    root.add(hips); hips.position.y = 0.95;
    const pelvis = cap(0.17, 0.12, pants); pelvis.rotation.z = Math.PI / 2; pelvis.scale.set(1, 1.15, 0.8); hips.add(pelvis);
    hips.add(spine); spine.position.y = 0.1;
    const torso = cap(0.2, 0.32, shirt); torso.position.y = 0.3; torso.scale.set(1.15, 1, 0.75); spine.add(torso);
    spine.add(head); head.position.y = 0.66;
    const neck = cap(0.06, 0.06, skin); neck.position.y = -0.06; head.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshStandardMaterial({ color: L.skin, roughness: 0.6, map: faceTexture(false) })); skull.position.y = 0.1; skull.scale.set(0.95, 1.1, 1); skull.castShadow = true; head.add(skull);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.138, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hair); hairM.position.y = 0.12; hairM.position.z = -0.01; head.add(hairM);
    const pony = cap(0.045, 0.16, hair); pony.position.set(0, 0.04, -0.15); pony.rotation.x = 0.4; if (L.pony) head.add(pony);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), dark); e.position.set(s * 0.045, 0.12, 0.118); head.add(e); }
    const mkLimb = (upperLen: number, lowerLen: number, r: number, mU: THREE.Material, mL: THREE.Material, end: THREE.Mesh) => {
      const top = new THREE.Group(), mid = new THREE.Group();
      const u = cap(r, upperLen - r * 2, mU); u.position.y = -upperLen / 2; top.add(u);
      top.add(mid); mid.position.y = -upperLen;
      const l = cap(r * 0.85, lowerLen - r * 2, mL); l.position.y = -lowerLen / 2; mid.add(l);
      end.position.y = -lowerLen; mid.add(end); return { top, mid };
    };
    const arms = [-1, 1].map((s) => { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); const a = mkLimb(0.3, 0.28, 0.055, shirt, skin, hand); a.top.position.set(s * 0.25, 0.53, 0); spine.add(a.top); return a; });
    const legs = [-1, 1].map((s) => { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), shoe); foot.position.z = 0.06; foot.castShadow = true; const l = mkLimb(0.46, 0.45, 0.075, pants, pants, foot); l.top.position.set(s * 0.11, -0.02, 0); hips.add(l.top); return l; });
    return { root, hips, spine, head, arms, legs };
  }
}

