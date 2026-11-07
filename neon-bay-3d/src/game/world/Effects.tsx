import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { game, Quality } from '../state/store';

/**
 * Post-processing: HDR render -> (ambient occlusion on high) -> bloom -> filmic tone mapping (OutputPass).
 * Bloom makes neon, headlights, street lamps and the sun glow like a camera sees them.
 * Low quality skips the composer entirely (plain render, cheapest on phones).
 */
export default function Effects({ quality }: { quality: Quality }) {
  const { gl, scene, camera, size } = useThree();
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
    return { composer, bloom, ao };
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    if (!fx) return;
    const pr = gl.getPixelRatio(); fx.composer.setPixelRatio(pr); fx.composer.setSize(size.width, size.height);
    fx.bloom.resolution.set(size.width * pr * (quality === 'high' ? 0.5 : 0.35), size.height * pr * (quality === 'high' ? 0.5 : 0.35));
    return undefined;
  }, [fx, size, gl, quality]);
  useEffect(() => () => { fx?.composer.dispose(); }, [fx]);
  useFrame((_, dt) => {
    if (!fx) return;
    // stronger glow at night (lamps, neon, headlights), subtle by day
    const night = game.hour > 18.8 || game.hour < 5.8 ? 1 : game.hour > 17.5 ? (game.hour - 17.5) / 1.3 : game.hour < 7 ? (7 - game.hour) / 1.2 : 0;
    fx.bloom.strength = 0.14 + night * 0.38 + game.weather.flash * 0.5; fx.bloom.threshold = 2.6 - night * 1.55; // by day only very hot highlights bloom
    fx.composer.render(dt);
  }, 1);
  return null;
}
