import * as THREE from 'three';
import { VDEFS, VKind } from '../../src/game/vehicles/defs';
import { buildCarModel, applyMods } from '../../src/game/vehicles/models';
import { drawEnv } from '../../src/game/world/envmap';

/**
 * Car viewer for design work: one model on tarmac in daylight (the game's lights, tone mapping and reflections),
 * drawn from six angles into one picture. Bundled with esbuild and opened by tests/viewer/shoot.cjs; not part of the game.
 * ?k=<kind>&c=<colour>&views=<list>
 */
const q = new URLSearchParams(location.search), kind = (q.get('k') || 'super') as VKind, colour = q.get('c') || VDEFS[kind].colors[0];
const TW = 800, TH = 450, views = (q.get('views') || 'fq,side,rq,front,rear,top').split(','), cols = Math.min(views.length, 2), rows = Math.ceil(views.length / cols);
const gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); gl.setSize(TW * cols, TH * rows); gl.setPixelRatio(1); document.body.style.margin = '0'; document.body.appendChild(gl.domElement);
gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMappingExposure = 1.05; gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9ab8dc');
{ const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d')!; drawEnv(c, 256, 128, '#2f6fd0', '#a9c4e2', '#5a554c', 1);
  const sg = c.createRadialGradient(170, 30, 0, 170, 30, 34); sg.addColorStop(0, 'rgba(255,250,235,1)'); sg.addColorStop(0.15, 'rgba(255,250,235,0.6)'); sg.addColorStop(1, 'rgba(255,250,235,0)'); c.fillStyle = sg; c.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.environment = new THREE.PMREMGenerator(gl).fromEquirectangular(t).texture; }
scene.add(new THREE.HemisphereLight('#d1d9f2', '#51473f', 0.85));
const sun = new THREE.DirectionalLight('#fff4e2', 3.2); sun.position.set(-6, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.bias = -0.0004; scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.92 })); ground.receiveShadow = true; scene.add(ground);
const m = buildCarModel(VDEFS[kind], colour); applyMods(m, undefined); m.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== m.neon) { /* everything shown, as close up */ } });
if (m.damage) { m.damage.soot.visible = q.get('dmg') === '1'; m.damage.crack.visible = q.get('dmg') === '1'; }
if (q.get('hide') === 'paint') m.paint.visible = false; // look behind the skin
scene.add(m.root); // the model's own root turns x-forward into the game's z-forward
const L = VDEFS[kind].len, d = Math.max(4.4, L * 0.98);
const CAM: Record<string, [number[], number[], number]> = {
  fq: [[-d * 0.62, 1.15, d * 0.78], [0.1, 0.5, 0.2], 34], side: [[-d * 1.25, 0.8, 0], [0, 0.55, 0], 34], rq: [[-d * 0.64, 1.3, -d * 0.76], [0.1, 0.5, -0.2], 34],
  front: [[0, 0.75, d * 1.15], [0, 0.5, 0], 30], rear: [[0, 0.85, -d * 1.15], [0, 0.5, 0], 30], top: [[-0.001, d * 1.75, 0], [0, 0, 0], 34],
  low: [[-d * 0.5, 0.35, d * 0.62], [0.1, 0.5, 0.2], 40], wheel: [[-1.9, 0.5, 2.2], [-0.7, 0.35, 1.2], 30], hi: [[-d * 0.5, 2.6, d * 0.7], [0, 0.4, 0], 34],
};
gl.setScissorTest(true);
views.forEach((v, i) => {
  const [p, t, fov] = CAM[v] || CAM.fq, cam = new THREE.PerspectiveCamera(fov, TW / TH, 0.1, 200); cam.position.set(p[0], p[1], p[2]); cam.lookAt(t[0], t[1], t[2]);
  const x = (i % cols) * TW, y = (rows - 1 - Math.floor(i / cols)) * TH; gl.setViewport(x, y, TW, TH); gl.setScissor(x, y, TW, TH); gl.render(scene, cam);
});
(window as unknown as { __done: boolean }).__done = true;
