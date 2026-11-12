import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { game } from '../state/store';

/**
 * The view from a penthouse on the 58th floor: the city about 200 m below, built in 3D so it moves as you walk to the
 * glass and out onto the balcony. Several hundred towers (lit windows at night), the street grid, avenues with car
 * lights streaming at night, the bay with a suspension bridge, mountains on the horizon; the real sky above.
 * Drawn unlit and coloured by the time of day (the room's own lights must not light the city).
 */
const EYE = 200; // metres above the street
let seed = 4711; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function facade(night: boolean, cols: number, rows: number) {
  const W = 64, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d')!;
  c.fillStyle = night ? '#0d1220' : '#8d98a8'; c.fillRect(0, 0, W, H);
  const cw = W / cols, rh = H / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const lit = night ? rnd() < 0.55 : false;
    c.fillStyle = night ? (lit ? (rnd() < 0.7 ? '#ffd9a0' : '#cfe6ff') : '#151b2a') : (rnd() < 0.5 ? '#5f7894' : '#6f88a2');
    c.fillRect(k * cw + 1, r * rh + 1.5, cw - 2, rh - 3);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
}
function streets(night: boolean) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d')!;
  c.fillStyle = night ? '#07090f' : '#4a4d52'; c.fillRect(0, 0, S, S);
  c.fillStyle = night ? '#3a3020' : '#2d2f34'; for (let k = 0; k < S; k += 64) { c.fillRect(k, 0, 9, S); c.fillRect(0, k, S, 9); }
  if (night) { c.fillStyle = '#ffcf7a'; for (let k = 0; k < S; k += 64) for (let j = 0; j < S; j += 16) { c.fillRect(k + 1, j, 2, 2); c.fillRect(j, k + 1, 2, 2); } }
  else { c.fillStyle = '#3f6a3a'; for (let n = 0; n < 18; n++) c.fillRect(Math.floor(rnd() * 8) * 64 + 12, Math.floor(rnd() * 8) * 64 + 12, 50, 50); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); return t;
}

export default function HighView() {
  const R = useMemo(() => {
    seed = 4711;
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    // three height classes, each with its own window repeat so the windows keep about the same size
    const classes = [{ max: 60, cols: 3, rows: 5 }, { max: 140, cols: 4, rows: 12 }, { max: 999, cols: 5, rows: 24 }];
    const day = classes.map((k) => facade(false, k.cols, k.rows)), night = classes.map((k) => facade(true, k.cols, k.rows));
    const roof = new THREE.MeshBasicMaterial({ color: '#5a5e66' });
    const mats = classes.map((_, i) => new THREE.MeshBasicMaterial({ map: day[i] }));
    const lists: THREE.Matrix4[][] = [[], [], []]; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
    for (let n = 0; n < 520; n++) {
      const th = (rnd() * 2 - 1) * 1.9, r = 45 + Math.pow(rnd(), 1.5) * 1500, x = Math.sin(th) * r, z = -Math.cos(th) * r;
      if (th < -0.62 && r > 420) continue; // the bay
      if (Math.abs(x) < 9 || Math.abs(x - z * 0.35) < 8) continue; // two avenues running away from the tower
      const tall = rnd() < 0.06 && r > 160, h = tall ? 170 + rnd() * 110 : r < 300 ? 25 + rnd() * 120 : 15 + Math.pow(rnd(), 2) * 120, w = 14 + rnd() * 26, d = 14 + rnd() * 26;
      Q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, (rnd() - 0.5) * 0.3); M.compose(V.set(x, -EYE, z), Q, S.set(w, h, d));
      lists[h < 60 ? 0 : h < 140 ? 1 : 2].push(M.clone());
    }
    const meshes = lists.map((L, i) => { const m = new THREE.InstancedMesh(box, [mats[i], mats[i], roof, roof, mats[i], mats[i]], Math.max(1, L.length)); L.forEach((q, k) => m.setMatrixAt(k, q)); m.count = L.length; m.frustumCulled = false; return m; });
    // street grid, the bay, mountains
    const sDay = streets(false), sNight = streets(true), ground = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200).rotateX(-Math.PI / 2).translate(0, -EYE - 0.5, -800), new THREE.MeshBasicMaterial({ map: sDay }));
    const bayShape = new THREE.Shape(); bayShape.moveTo(0, 0); for (let a = -1.9; a <= -0.62; a += 0.05) bayShape.lineTo(Math.sin(a) * 2600, -Math.cos(a) * 2600); bayShape.lineTo(Math.sin(-0.62) * 420, -Math.cos(-0.62) * 420); for (let a = -0.62; a >= -1.9; a -= 0.05) bayShape.lineTo(Math.sin(a) * 420, -Math.cos(a) * 420);
    const bay = new THREE.Mesh(new THREE.ShapeGeometry(bayShape).rotateX(Math.PI / 2).translate(0, -EYE + 0.3, 0), new THREE.MeshBasicMaterial({ color: '#2a5a7a', side: THREE.DoubleSide }));
    const mtnG: THREE.BufferGeometry[] = []; for (let k = 0; k < 26; k++) { const a = -1.6 + k * 0.13, r = 2300 + rnd() * 200, h = 160 + rnd() * 260, g = new THREE.ConeGeometry(260 + rnd() * 240, h, 5); g.translate(Math.sin(a) * r, -EYE + h / 2, -Math.cos(a) * r); mtnG.push(g); }
    const mtnMat = new THREE.MeshBasicMaterial({ color: '#5d7488' });
    const mtns = mtnG.map((g) => new THREE.Mesh(g, mtnMat));
    // a suspension bridge across the bay: deck, two towers, cables; its lights come on at night
    const bridge = new THREE.Group(), bx = Math.sin(-1.05) * 1000, bz = -Math.cos(-1.05) * 1000, steel = new THREE.MeshBasicMaterial({ color: '#d8dce2' }), lamp = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    bridge.position.set(bx, -EYE, bz); bridge.rotation.y = 0.5;
    bridge.add(new THREE.Mesh(new THREE.BoxGeometry(900, 4, 16).translate(0, 30, 0), steel));
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(10, 120, 12).translate(s * 220, 60, 0), steel); bridge.add(t); }
    const cablePts: number[] = []; for (const zz of [-7, 7]) for (let k = 0; k < 60; k++) { const u0 = -450 + k * 15, u1 = u0 + 15, y = (u: number) => { const a = Math.abs(u); return a < 220 ? 34 + ((220 - a) / 220) ** 2 * 0 + (a / 220) ** 2 * 84 : 34 + 84 - ((a - 220) / 230) * 84; }; cablePts.push(u0, y(u0), zz, u1, y(u1), zz); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3)); bridge.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: '#e8eaee' })));
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 6, 4), lamp, 40); for (let k = 0; k < 40; k++) bulbs.setMatrixAt(k, M.compose(V.set(-430 + k * 22, 33, k % 2 ? 7 : -7), Q.identity(), S.set(1, 1, 1))); bridge.add(bulbs);
    // car lights on the two avenues: white going away, red coming back
    const carN = 140, cars = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.8, 3.2), new THREE.MeshBasicMaterial({ toneMapped: false }), carN); cars.frustumCulled = false;
    const carCol = new THREE.Color(); for (let k = 0; k < carN; k++) cars.setColorAt(k, k % 2 ? carCol.set('#ff3a2a') : carCol.set('#fff4d8'));
    return { meshes, mats, day, night, ground, sDay, sNight, bay, mtns, mtnMat, bridge, bulbs, cars, roof, steel };
  }, []);
  const M = useMemo(() => new THREE.Matrix4(), []), V = useMemo(() => new THREE.Vector3(), []), Q = useMemo(() => new THREE.Quaternion(), []), S = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame(({ clock }) => {
    const h = game.hour, night = h > 18.6 || h < 5.6, dusk = !night && (h > 16.8 || h < 7.2), k = night ? 0.55 : dusk ? 0.8 : 1;
    R.mats.forEach((m, i) => { const t = night ? R.night[i] : R.day[i]; if (m.map !== t) { m.map = t; m.needsUpdate = true; } m.color.setRGB(k * (dusk ? 1.08 : 1), k, k * (dusk ? 0.9 : 1)); });
    const gm = R.ground.material as THREE.MeshBasicMaterial, gt = night ? R.sNight : R.sDay; if (gm.map !== gt) { gm.map = gt; gm.needsUpdate = true; }
    (R.bay.material as THREE.MeshBasicMaterial).color.set(night ? '#0a1626' : dusk ? '#4a5a7a' : '#2a6a92');
    R.mtnMat.color.set(night ? '#0e1420' : dusk ? '#6a6a86' : '#6f8aa0'); R.roof.color.setScalar(night ? 0.12 : 0.36 * k);
    R.steel.color.set(night ? '#2a2e36' : '#d8dce2'); R.bulbs.visible = night || dusk;
    R.cars.visible = night || dusk;
    if (R.cars.visible) { const t = clock.elapsedTime; for (let n = 0; n < 140; n++) { const lane = n % 4, ave = n < 70 ? 0 : 1, u = ((n * 37.3 + t * (lane < 2 ? 14 : -14)) % 1400 + 1400) % 1400 + 40, x = (lane % 2 ? 1.8 : -1.8) + (ave ? -u * 0.35 : 0), z = -u; M.compose(V.set(x, -EYE + 0.6, z), Q, S); R.cars.setMatrixAt(n, M); } R.cars.instanceMatrix.needsUpdate = true; }
  });
  return (
    <group>
      {R.meshes.map((m, i) => <primitive key={i} object={m} />)}
      <primitive object={R.ground} /><primitive object={R.bay} />
      {R.mtns.map((m, i) => <primitive key={'m' + i} object={m} />)}
      <primitive object={R.bridge} /><primitive object={R.cars} />
    </group>
  );
}
