import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { blocks, BEACH_X, PORT, HALF, groundAt } from './cityGen';
import { game } from '../state/store';
import { vehicles } from '../vehicles/sim';
import { tdt } from '../admin';

/** Seagull flocks circling the coast (glide + flap) and park pigeons that peck, hop and scatter when you come close. */
const GULLS = 24, PIGEONS = 30, N = GULLS + PIGEONS;
interface Bird { gull: boolean; cx: number; cz: number; h: number; r: number; w: number; a: number; x: number; y: number; z: number; yaw: number; vx: number; vy: number; vz: number; state: 'ground' | 'fly' | 'circle'; t: number; hx: number; hz: number; flap: number; peck: number }

export default function Birds() {
  const birds = useMemo<Bird[]>(() => {
    const out: Bird[] = [], r = (a: number, b: number) => a + Math.random() * (b - a);
    const flocks = [[BEACH_X + 40, -200], [BEACH_X + 30, 250], [(PORT.x0 + PORT.x1) / 2, PORT.z0 + 60]];
    for (let i = 0; i < GULLS; i++) { const f = flocks[i % 3]; out.push({ gull: true, cx: f[0] + r(-20, 20), cz: f[1] + r(-20, 20), h: r(14, 32), r: r(18, 45), w: r(0.25, 0.45) * (Math.random() < 0.5 ? 1 : -1), a: r(0, 6.28), x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0, state: 'circle', t: 0, hx: 0, hz: 0, flap: r(0, 6), peck: 0 }); }
    const parks = blocks.filter((b) => b.zone === 'park');
    for (let i = 0; i < PIGEONS; i++) { const b = parks[Math.floor(i / 10) % parks.length], hx = (b.x0 + b.x1) / 2 + r(-12, 12), hz = b.z0 + 8 + r(-2, 2) + (i % 10) * 0.7; out.push({ gull: false, cx: 0, cz: 0, h: 0, r: 0, w: 0, a: 0, x: hx, y: groundAt(hx, hz), z: hz, yaw: r(0, 6.28), vx: 0, vy: 0, vz: 0, state: 'ground', t: r(0, 3), hx, hz, flap: 0, peck: r(0, 6) }); }
    return out;
  }, []);
  const mesh = useMemo(() => {
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6).scale(0.8, 0.7, 1.8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
    const wing = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.02, 0.22).translate(0.27, 0, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), N * 2);
    for (const m of [body, wing]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    birds.forEach((b, i) => { const c = new THREE.Color(b.gull ? '#f2f2f0' : '#8a8f9a'); body.setColorAt(i, c); wing.setColorAt(i * 2, b.gull ? new THREE.Color('#d9dbe0') : c); wing.setColorAt(i * 2 + 1, b.gull ? new THREE.Color('#d9dbe0') : c); });
    return { body, wing };
  }, [birds]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), r: new THREE.Matrix4() }), []);
  useFrame(({ camera }, rawDt) => {
    const dt = tdt(Math.min(rawDt, 0.05)), t = performance.now() / 1000, pl = game.player, out = game.where === 'out';
    birds.forEach((b, i) => {
      let flapAmp = 0.9, pitch = 0, roll = 0, scale = b.gull ? 1.6 : 1;
      if (b.gull) {
        b.a += b.w * dt * 0.6; const glide = Math.sin(t * 0.3 + i) > 0.1;
        b.x = b.cx + Math.cos(b.a) * b.r; b.z = b.cz + Math.sin(b.a) * b.r; b.y = b.h + Math.sin(t * 0.5 + i) * 2;
        b.yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w)); roll = -Math.sign(b.w) * 0.35;
        b.flap += dt * (glide ? 0.8 : 7); flapAmp = glide ? 0.12 : 0.75;
      } else {
        // pigeons: scatter when the player or a car comes close, circle, land back home
        const thr = Math.hypot(pl.x - b.x, pl.z - b.z) < 6.5 && out ? pl : vehicles.find((v) => Math.hypot(v.x - b.x, v.z - b.z) < 9 && Math.hypot(v.vx, v.vz) > 3);
        if (b.state === 'ground') {
          b.t -= dt; b.peck += dt * 5; flapAmp = 0; pitch = Math.max(0, Math.sin(b.peck)) * 0.6;
          if (b.t <= 0) { b.t = 1 + Math.random() * 3; if (Math.random() < 0.5) { b.yaw += (Math.random() - 0.5) * 2; b.x += Math.sin(b.yaw) * 0.25; b.z += Math.cos(b.yaw) * 0.25; } }
          if (thr) { b.state = 'fly'; b.t = 6 + Math.random() * 6; const a = Math.atan2(b.x - thr.x, b.z - thr.z) + (Math.random() - 0.5); b.vx = Math.sin(a) * 6; b.vz = Math.cos(a) * 6; b.vy = 5 + Math.random() * 2; }
          b.y = groundAt(b.x, b.z);
        } else {
          b.t -= dt; b.flap += dt * 16;
          if (b.t > 2) { b.vy = Math.max(0, b.vy - dt * 1.5); b.vx += (Math.random() - 0.5) * dt * 4; b.vz += (Math.random() - 0.5) * dt * 4; }
          else { const dx = b.hx - b.x, dz = b.hz - b.z, d = Math.hypot(dx, dz) || 1; b.vx += (dx / d * 5 - b.vx) * dt * 2; b.vz += (dz / d * 5 - b.vz) * dt * 2; b.vy = (groundAt(b.x, b.z) + 0.1 - b.y) * 1.2; if (d < 1 && b.y < groundAt(b.x, b.z) + 0.3) { b.state = 'ground'; b.t = 2; } if (b.t < -8) { b.x = b.hx; b.z = b.hz; b.state = 'ground'; } }
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.yaw = Math.atan2(b.vx, b.vz); pitch = -0.2;
        }
      }
      const far = Math.abs(b.x - camera.position.x) > 260 || Math.abs(b.z - camera.position.z) > 260 || Math.abs(b.x) > HALF * 3;
      tmp.e.set(pitch, b.yaw, roll, 'YXZ'); tmp.q.setFromEuler(tmp.e); tmp.p.set(b.x, b.y + (b.gull ? 0 : 0.12), b.z); tmp.s.setScalar(far ? 0 : scale);
      tmp.m.compose(tmp.p, tmp.q, tmp.s); mesh.body.setMatrixAt(i, tmp.m);
      const f = Math.sin(b.flap) * flapAmp;
      for (const k of [0, 1]) { const sg = k ? 1 : -1; tmp.r.makeRotationY(k ? 0 : Math.PI).multiply(tmp.w.makeRotationZ(sg * f * (k ? 1 : -1))); tmp.w.copy(tmp.m).multiply(tmp.r); if (!b.gull && b.state === 'ground') tmp.w.multiply(tmp.r.makeScale(0.35, 1, 1)); mesh.wing.setMatrixAt(i * 2 + k, tmp.w); }
    });
    mesh.body.instanceMatrix.needsUpdate = true; mesh.wing.instanceMatrix.needsUpdate = true;
  });
  return <><primitive object={mesh.body} /><primitive object={mesh.wing} /></>;
}
