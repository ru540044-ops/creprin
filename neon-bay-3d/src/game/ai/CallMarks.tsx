import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { peds } from './peds';
import { game } from '../state/store';

/** A red "110" badge over everyone who is on the phone to the police (so you can see who to stop). */
const MAX = 8;
export default function CallMarks() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const mat = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const c = cv.getContext('2d')!;
    c.fillStyle = '#e0202a'; c.beginPath(); c.moveTo(18, 6); c.lineTo(110, 6); c.quadraticCurveTo(122, 6, 122, 18); c.lineTo(122, 56); c.quadraticCurveTo(122, 68, 110, 68); c.lineTo(74, 68); c.lineTo(64, 90); c.lineTo(54, 68); c.lineTo(18, 68); c.quadraticCurveTo(6, 68, 6, 56); c.lineTo(6, 18); c.quadraticCurveTo(6, 6, 18, 6); c.fill();
    c.fillStyle = '#ffffff'; c.font = '900 46px "Arial Black",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('110', 64, 39);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame(({ camera, clock }) => {
    const im = ref.current; if (!im) return; let n = 0;
    if (game.where === 'out') for (const p of peds) {
      if (p.callT <= 0 || p.state === 'dead' || n >= MAX) continue;
      const k = 0.62 + Math.sin(clock.elapsedTime * 9 + p.id) * 0.06;
      tmp.p.set(p.x, p.y + 2.25 * p.scale, p.z); tmp.s.set(k, k * 0.75, k); tmp.m.compose(tmp.p, camera.quaternion, tmp.s); im.setMatrixAt(n++, tmp.m);
    }
    im.count = n; im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, mat, MAX]} frustumCulled={false} renderOrder={6}><planeGeometry args={[1, 1]} /></instancedMesh>;
}
