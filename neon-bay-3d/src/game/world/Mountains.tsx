import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { REGION } from './region';
import { game } from '../state/store';
import { sunState } from './Environment';
import { fbm } from './rng';

/**
 * Mountains on every horizon, so each city sits in a basin among the mountains: three ridgelines in a ring that keeps its
 * distance from the camera (just beyond the haze, inside the star sphere), lit by the sun or moon, forested with snow on
 * the highest peaks, hazed into the fog colour towards their feet. Lower across the bay, a tall snow cone west of Tokyo.
 */
const RAD = [1650, 1700, 1750], SEG = 360, FOOT = -420;
interface Look { base: number; amp: number; snow: number; bay: number; col: [number, number, number]; cone?: [number, number, number] }
/** azimuth: 0 = south (+z), PI/2 = east, PI = north, -PI/2 = west */
const LOOKS: Record<string, Look> = {
  tokyo: { base: 120, amp: 300, snow: 380, bay: Math.PI / 4, col: [0.24, 0.31, 0.24], cone: [-1.15, 600, 0.3] },
  osaka: { base: 130, amp: 290, snow: 400, bay: -Math.PI / 2, col: [0.23, 0.3, 0.22] },
  fukuoka: { base: 110, amp: 270, snow: 420, bay: Math.PI, col: [0.23, 0.31, 0.23] },
  naha: { base: 60, amp: 170, snow: 9999, bay: -Math.PI / 2, col: [0.24, 0.36, 0.22] },
  nara: { base: 110, amp: 200, snow: 9999, bay: -Math.PI / 2, col: [0.22, 0.32, 0.21] }, // soft green hills all round the old capital
};
const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };

function ridge(L: Look, a: number, layer: number) {
  const k = 2.2 + layer * 0.9, nx = Math.cos(a) * k + layer * 13.7, nz = Math.sin(a) * k - layer * 5.1;
  const r = 1 - Math.abs(2 * fbm(nx, nz, 5) - 1); // ridged noise: sharp crests
  let h = L.base * (0.75 + layer * 0.25) + L.amp * Math.pow(r, 1.7) * (0.7 + layer * 0.25) + L.amp * 0.25 * fbm(nx * 3.1, nz * 3.1, 3);
  h *= 1 - 0.55 * Math.exp(-Math.pow(angDiff(a, L.bay) / 0.65, 2)); // lower hills across the bay
  if (L.cone && layer === 2) { const d = angDiff(a, L.cone[0]) / L.cone[2]; if (d < 1) h = Math.max(h, L.cone[1] * (1 - Math.pow(d, 1.25)) + 40 * fbm(a * 40, 3)); }
  return h;
}

const VERT = `
attribute float aT; attribute float aL;
varying float vT; varying float vL; varying float vY; varying vec3 vN;
void main() { vT = aT; vL = aL; vY = position.y; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
uniform vec3 uFog; uniform vec3 uRock; uniform vec3 uSnow; uniform vec3 uSun; uniform float uLight; uniform float uAmb; uniform float uHaze; uniform float uSnowLine;
varying float vT; varying float vL; varying float vY; varying vec3 vN;
void main() {
  float dif = max(0.0, dot(normalize(vN), uSun));
  vec3 c = uRock * mix(0.65, 1.0, vT) * (uAmb + dif * uLight);
  float sn = smoothstep(uSnowLine - 18.0, uSnowLine + 18.0, vY);
  c = mix(c, uSnow * (uAmb * 1.4 + dif * uLight * 0.9), sn);
  float haze = clamp(uHaze + vL * 0.12 + pow(1.0 - vT, 1.6) * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFog, haze), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export default function Mountains() {
  const L = LOOKS[REGION.id] || LOOKS.tokyo;
  const mesh = useRef<THREE.Mesh>(null!);
  const { scene, camera } = useThree();
  const { geo, mat } = useMemo(() => {
    const pos: number[] = [], nor: number[] = [], aT: number[] = [], aL: number[] = [], idx: number[] = [];
    for (let layer = 2; layer >= 0; layer--) {
      const R = RAD[layer], hs: number[] = [];
      for (let i = 0; i <= SEG; i++) hs.push(ridge(L, (i / SEG) * Math.PI * 2, layer) * (R / 1750));
      const v0 = pos.length / 3;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a), h = hs[i], dh = (hs[(i + 1) % SEG] - hs[(i + SEG - 1) % SEG]) / ((2 * Math.PI * 2 * R) / SEG);
        // the face seen from inside the ring: facing the centre, tilted up, turned along the slope of the ridge
        const n = new THREE.Vector3(-s, 0.55, -c).add(new THREE.Vector3(c, 0, -s).multiplyScalar(-dh * 2.2)).normalize();
        for (const [y, t] of [[FOOT, 0], [h * 0.45, 0.45], [h, 1]] as const) { pos.push(s * R, y, c * R); nor.push(n.x, n.y, n.z); aT.push(t); aL.push(layer); }
      }
      for (let i = 0; i < SEG; i++) for (let r = 0; r < 2; r++) { const a = v0 + i * 3 + r, b = v0 + (i + 1) * 3 + r; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 1)); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: { uFog: { value: new THREE.Color() }, uRock: { value: new THREE.Color().setRGB(...L.col) }, uSnow: { value: new THREE.Color(0.92, 0.94, 0.98) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: 1 }, uAmb: { value: 0.5 }, uHaze: { value: 0.3 }, uSnowLine: { value: L.snow } },
    });
    return { geo: g, mat: m };
  }, [L]);
  useFrame(() => {
    const M = mesh.current; if (!M) return;
    M.visible = game.where === 'out' && game.tunnel < 0.95;
    const lift = Math.max(0, camera.position.y - 60) * 0.9;
    M.position.set(camera.position.x, lift, camera.position.z);
    const u = mat.uniforms, fog = scene.fog as THREE.Fog | null, W = game.weather, day = sunState.day;
    if (fog) u.uFog.value.copy(fog.color);
    u.uSun.value.copy(sunState.dir); u.uLight.value = (sunState.isSun ? 1.15 * day : 0.12) * (1 - 0.75 * W.cloud); u.uAmb.value = 0.1 + 0.42 * day;
    u.uHaze.value = Math.min(0.92, 0.22 + 0.5 * W.rain + 0.18 * W.cloud + sunState.dusk * 0.08);
  });
  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-1} />;
}
