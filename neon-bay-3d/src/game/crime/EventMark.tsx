import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ev } from './events';
import { game } from '../state/store';

/** The mark floating over a street event: "!" (stop him / take it here), "?" (someone wants to ask you something), "$" (something on the ground). */
export default function EventMark() {
  const ref = useRef<THREE.Mesh>(null!);
  const mats = useMemo(() => { const mk = (ch: string, col: string) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d')!; c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 8; c.beginPath(); c.arc(64, 58, 46, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(50, 98); c.lineTo(64, 124); c.lineTo(78, 98); c.fill(); c.fillStyle = '#fff'; c.font = '900 70px "Arial Black",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 64, 62); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }); }; return { '!': mk('!', '#e0202a'), '?': mk('?', '#2b6bff'), '$': mk('$', '#1c9a5a') }; }, []);
  useFrame(({ camera, clock }) => {
    const m = ref.current, k = ev.mark; if (!m) return; m.visible = !!k && game.where === 'out'; if (!k) return;
    m.material = mats[k.icon]; const d = camera.position.distanceTo(m.position), s = Math.max(0.9, Math.min(5, d * 0.035));
    m.position.set(k.x, k.y + Math.sin(clock.elapsedTime * 4) * 0.12 + s * 0.4, k.z); m.quaternion.copy(camera.quaternion); m.scale.setScalar(s);
  });
  return <mesh ref={ref} renderOrder={7} frustumCulled={false}><planeGeometry args={[1, 1]} /></mesh>;
}
