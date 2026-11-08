import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { game, Quality } from '../state/store';
import { makeGradePass } from './Grade';
import { sunState } from './Environment';
import { pointBlocked } from './cityGen';

/**
 * Post-processing: HDR render -> (ambient occlusion on high) -> bloom -> filmic tone mapping (OutputPass).
 * Bloom makes neon, headlights, street lamps and the sun glow like a camera sees them.
 * Low quality skips the composer entirely (plain render, cheapest on phones).
 */
export default function Effects({ quality }: { quality: Quality }) {
  const { gl, scene, camera, size } = useThree(); const dpr = useThree((s) => s.viewport.dpr);
  const fx = useMemo(() => {
    if (quality === 'low') return null;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
    const composer = new EffectComposer(gl, rt);
    composer.addPass(new RenderPass(scene, camera));
    let ao: GTAOPass | null = null;
    if (quality === 'high') { ao = new GTAOPass(scene, camera, 1, 1); ao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.2, thickness: 2, scale: 1, samples: 12 }); ao.blendIntensity = 0.85; composer.addPass(ao); }
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = makeGradePass(); composer.addPass(grade);
    return { composer, bloom, ao, grade };
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    if (!fx) return;
    const pr = gl.getPixelRatio(); fx.composer.setPixelRatio(pr); fx.composer.setSize(size.width, size.height);
    fx.grade.uniforms.uRes.value.set(size.width * pr, size.height * pr);
    fx.bloom.resolution.set(size.width * pr * (quality === 'high' ? 0.5 : 0.35), size.height * pr * (quality === 'high' ? 0.5 : 0.35));
    return undefined;
  }, [fx, size, gl, quality, dpr]);
  useEffect(() => () => { fx?.composer.dispose(); }, [fx]);
  const tmp = useMemo(() => new THREE.Vector3(), []), sunVis = useMemo(() => ({ v: 0 }), []);
  useFrame((_, dt) => {
    if (!fx) return;
    // stronger glow at night (lamps, neon, headlights), subtle by day
    const night = game.hour > 18.8 || game.hour < 5.8 ? 1 : game.hour > 17.5 ? (game.hour - 17.5) / 1.3 : game.hour < 7 ? (7 - game.hour) / 1.2 : 0;
    fx.bloom.strength = 0.14 + night * 0.38 + game.weather.flash * 0.5; fx.bloom.threshold = 2.6 - night * 1.55; // by day only very hot highlights bloom
    // sun glare: project the sun, fade with clouds / indoors / buildings in the way
    const g = fx.grade.uniforms, cam = camera as THREE.PerspectiveCamera; g.uTime.value = (g.uTime.value + dt) % 100;
    let vis = 0;
    if (sunState.isSun && game.where === 'out') {
      tmp.copy(sunState.dir).multiplyScalar(1000).add(cam.position); tmp.project(cam);
      if (tmp.z < 1 && Math.abs(tmp.x) < 1.3 && Math.abs(tmp.y) < 1.3) {
        g.uSun.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
        let open = 1; for (let k = 1; k <= 10; k++) { const t = k * k * 2.2; if (pointBlocked(cam.position.x + sunState.dir.x * t, cam.position.y + sunState.dir.y * t, cam.position.z + sunState.dir.z * t)) { open = 0; break; } }
        vis = open * (1 - game.weather.cloud * 0.85) * Math.min(1, 1.3 - Math.max(Math.abs(tmp.x), Math.abs(tmp.y)) * 0.5) * (0.6 + sunState.day * 0.4);
      }
    }
    sunVis.v += (vis - sunVis.v) * Math.min(1, dt * 6); g.uSunVis.value = sunVis.v;
    fx.bloom.strength *= 1 - sunVis.v * 0.85; // the sky's own sun disc is huge in HDR: keep it from flooding the frame
    g.uSunCol.value.setRGB(1, 0.92 - sunState.dusk * 0.25, 0.82 - sunState.dusk * 0.4);
    const dark = 1 - sunState.day; g.uWarm.value = 0.55 + sunState.dusk * 0.3; g.uSat.value = 1.08 + dark * 0.06; g.uVig.value = 0.3 + dark * 0.12;
    fx.composer.render(dt);
  }, 1);
  return null;
}
