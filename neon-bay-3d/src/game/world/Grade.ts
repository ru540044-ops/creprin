import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Final display-referred pass: sun glare + lens ghosts, colour grade (lift/gamma/gain, split toning,
 * saturation, contrast), soft vignette, a touch of chromatic aberration at the edges and fine film grain.
 */
export function makeGradePass() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunVis: { value: 0 }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
      uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uWarm: { value: 0.5 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 }, uCA: { value: 0.0016 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uSunVis, uSat, uContrast, uWarm, uVig, uGrain, uCA; uniform vec2 uRes, uSun; uniform vec3 uSunCol;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 7.13) * 43758.5453); }
      vec3 ghost(vec2 uv, vec2 c, float r, vec3 col){ float d = length((uv - c) * vec2(uRes.x / uRes.y, 1.0)); return col * smoothstep(r, r * 0.55, d) * 0.22; }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        // chromatic aberration grows toward the corners
        vec2 off = d * uCA * (0.5 + r2 * 4.0);
        vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        // sun glare: soft halo, horizontal streak, ghosts mirrored through the centre
        if (uSunVis > 0.001) {
          vec2 asp = vec2(uRes.x / uRes.y, 1.0); vec2 sd = (vUv - uSun) * asp; float sl = length(sd);
          vec3 g = uSunCol * (exp(-sl * 22.0) * 0.35 + exp(-sl * 6.0) * 0.06);
          g += uSunCol * exp(-abs(sd.y) * 160.0) * exp(-abs(sd.x) * 4.0) * 0.1;
          vec2 axis = vec2(0.5) - uSun;
          g += ghost(vUv, uSun + axis * 0.7, 0.035, vec3(0.5, 0.8, 1.0)) + ghost(vUv, uSun + axis * 1.25, 0.06, vec3(1.0, 0.6, 0.4)) + ghost(vUv, uSun + axis * 1.6, 0.02, vec3(0.6, 1.0, 0.6)) + ghost(vUv, uSun + axis * 2.0, 0.09, vec3(0.5, 0.5, 1.0)) * 0.6;
          col += g * uSunVis;
        }
        // grade: slight S-curve, saturation, warm highlights / cool shadows
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, uSat);
        col = (col - 0.5) * uContrast + 0.5;
        vec3 warm = vec3(1.04, 1.0, 0.94), cool = vec3(0.95, 1.0, 1.05);
        col *= mix(cool, warm, smoothstep(0.15, 0.85, l) * uWarm + (1.0 - uWarm) * 0.5);
        // vignette + grain
        col *= 1.0 - uVig * smoothstep(0.12, 0.62, r2 * 1.6);
        col += (hash(vUv * uRes) - 0.5) * uGrain;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`,
  });
  return pass;
}
