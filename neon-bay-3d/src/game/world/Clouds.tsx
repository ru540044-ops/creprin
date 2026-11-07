import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { game } from '../state/store';
import { smooth } from './rng';

/** A drifting fbm cloud deck high above the city: coverage follows the weather, colour follows the sun. */
export default function Clouds() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCover: { value: 0.35 }, uLit: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#9aa4b4') }, uCam: { value: new THREE.Vector2() }, uAlpha: { value: 1 } },
    vertexShader: `varying vec2 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec2 vW; uniform vec2 uCam; uniform float uTime, uCover, uAlpha; uniform vec3 uLit, uShade;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ s += a * n(p); p = p * 2.03 + vec2(13.1, 7.7); a *= 0.5; } return s; }
      void main(){
        vec2 p = vW * 0.0011 + vec2(uTime * 0.006, uTime * 0.0025);
        float d = fbm(p), d2 = fbm(p * 2.7 + 3.1);
        float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.28, d * 0.75 + d2 * 0.35);
        float lit = smoothstep(0.25, 0.9, fbm(p * 1.6 + vec2(0.07, 0.05)) - d * 0.35 + 0.35);
        vec3 col = mix(uShade, uLit, lit);
        float fade = 1.0 - smoothstep(2200.0, 3800.0, length(vW - uCam));
        gl_FragColor = vec4(col, c * fade * uAlpha);
        #include <colorspace_fragment>
      }`,
  }), []);
  useFrame(({ camera }, dt) => {
    const u = mat.uniforms, h = game.hour, W = game.weather;
    u.uTime.value += dt * (1 + W.rain * 2);
    u.uCam.value.set(camera.position.x, camera.position.z);
    u.uCover.value = 0.3 + W.cloud * 0.62;
    const ang = ((h - 6) / 12) * Math.PI, elev = Math.sin(ang), day = smooth(-0.08, 0.25, elev), dusk = 1 - Math.abs(smooth(-0.15, 0.45, elev) * 2 - 1);
    const lit = new THREE.Color('#1a2033').lerp(new THREE.Color('#ffffff'), day).lerp(new THREE.Color('#ffb070'), dusk * 0.75);
    const shade = new THREE.Color('#0b0e18').lerp(new THREE.Color('#a4aebd'), day).lerp(new THREE.Color('#7a5a7a'), dusk * 0.5);
    const storm = W.cloud * 0.55; lit.lerp(new THREE.Color('#5a6070').multiplyScalar(0.3 + day * 0.7), storm); shade.lerp(new THREE.Color('#2a2e38').multiplyScalar(0.3 + day * 0.7), storm);
    if (W.flash > 0) { lit.lerp(new THREE.Color('#e8eeff'), W.flash); shade.lerp(new THREE.Color('#9aa8d0'), W.flash); }
    u.uLit.value.copy(lit); u.uShade.value.copy(shade); u.uAlpha.value = game.where === 'out' ? 0.92 : 0;
  });
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, 650, 0]} frustumCulled={false} renderOrder={2}>
      <planeGeometry args={[9000, 9000]} />
    </mesh>
  );
}
