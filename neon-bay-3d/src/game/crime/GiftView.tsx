import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { game, progress } from '../state/store';
import { getTextures } from '../world/textures';
import { giftBoxes } from './gifts';

/** Hidden gift boxes: wrapped box with ribbon and bow, a soft glow and a faint light beam when you are close. */
export default function GiftView() {
  const boxes = useMemo(() => giftBoxes(), []);
  const parts = useMemo(() => {
    const glow = getTextures().glow;
    return {
      box: new THREE.BoxGeometry(0.72, 0.62, 0.72), lid: new THREE.BoxGeometry(0.8, 0.16, 0.8),
      rib: new THREE.BoxGeometry(0.76, 0.66, 0.12), rib2: new THREE.BoxGeometry(0.12, 0.66, 0.76), lidRib: new THREE.BoxGeometry(0.84, 0.18, 0.13), lidRib2: new THREE.BoxGeometry(0.13, 0.18, 0.84),
      bow: new THREE.TorusGeometry(0.13, 0.045, 8, 16), beam: new THREE.CylinderGeometry(0.32, 0.5, 26, 16, 1, true).translate(0, 13, 0), disc: new THREE.CircleGeometry(1.1, 24).rotateX(-Math.PI / 2),
      red: new THREE.MeshStandardMaterial({ color: '#d4102e', roughness: 0.35, metalness: 0.1, emissive: '#5a0010', emissiveIntensity: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: '#ffcf4a', roughness: 0.25, metalness: 0.85, emissive: '#6a4a00', emissiveIntensity: 0.5 }),
      beamM: new THREE.MeshBasicMaterial({ color: '#ffd86a', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
      glowM: new THREE.SpriteMaterial({ map: glow, color: '#ffcf6a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, toneMapped: false }),
      discM: new THREE.MeshBasicMaterial({ map: glow, color: '#ffcf6a', transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false }),
    };
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef<(THREE.Group | null)[]>([]);
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, p = game.player, out = game.where === 'out';
    boxes.forEach((b, i) => {
      const g = refs.current[i]; if (!g) return;
      const d = Math.hypot(b.x - p.x, b.z - p.z), vis = out && d < 230 && !progress.gift.boxes.includes(b.id);
      g.visible = vis; if (!vis) return;
      const s = spin.current[i]; if (s) { s.rotation.y = t * 1.3 + i; s.position.y = 0.55 + Math.sin(t * 2.2 + i) * 0.12; }
      const bm = beams.current[i]; if (bm) bm.visible = d < 110;
    });
  });
  return (
    <group>
      {boxes.map((b, i) => (
        <group key={b.id} position={[b.x, b.y, b.z]} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <group ref={(el) => { spin.current[i] = el; }}>
            <mesh geometry={parts.box} material={parts.red} castShadow />
            <mesh geometry={parts.rib} material={parts.gold} /><mesh geometry={parts.rib2} material={parts.gold} />
            <mesh geometry={parts.lid} material={parts.red} position-y={0.36} castShadow />
            <mesh geometry={parts.lidRib} material={parts.gold} position-y={0.36} /><mesh geometry={parts.lidRib2} material={parts.gold} position-y={0.36} />
            <mesh geometry={parts.bow} material={parts.gold} position={[-0.12, 0.54, 0]} rotation={[0, Math.PI / 2, 0.5]} />
            <mesh geometry={parts.bow} material={parts.gold} position={[0.12, 0.54, 0]} rotation={[0, Math.PI / 2, -0.5]} />
          </group>
          <sprite material={parts.glowM} position-y={0.7} scale={[2.6, 2.6, 1]} />
          <mesh geometry={parts.disc} material={parts.discM} position-y={0.04} />
          <mesh geometry={parts.beam} material={parts.beamM} ref={(el) => { beams.current[i] = el; }} />
        </group>
      ))}
    </group>
  );
}
