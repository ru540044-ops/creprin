import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { game, toast, save } from '../state/store';
import { input, moveVector, releaseDrive } from '../input';
import { vehicles, playerCar, Veh } from '../vehicles/sim';
import { sfx } from '../audio';
import { jobNear, jobAction, onEnterCar, law } from '../crime/crime';
import { hooks } from '../vehicles/sim';
import { collide, groundAt, doors, pointBlocked, districtAt, isWater } from '../world/cityGen';
import { INTERIORS, FLOOR, interiorCollide } from '../world/Interiors';
import { clamp, lerp } from '../world/rng';
import { makeCharacter } from './character';
import { combat, fire, findLock, cycleWeapon, armed } from '../combat/weapons';
import { peds, nearestPed, mug, ejectPed, scare } from '../ai/peds';
import { copSees, setWanted } from '../crime/crime';
import { STATIONS } from '../radio';

const R = 0.38, H = 1.8, WALK = 2.3, RUN = 5.2, SPRINT = 8.2, CROUCH = 1.6, GRAV = 22, JUMP = 6.4;
const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

let hitCD = 0; const knock = { x: 0, z: 0 };
/** Keep the walking player out of car bodies (oriented box test against nearby vehicles). */
function pushOutOfCars(p: { x: number; y: number; z: number }) {
  for (const v of vehicles) {
    const dx = p.x - v.x, dz = p.z - v.z; if (Math.abs(dx) > 6 || Math.abs(dz) > 6 || p.y > v.y + v.def.hgt) continue;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lf = dx * fx + dz * fz, ls = dx * fz - dz * fx, hl = v.def.len / 2 + R * 0.8, hw = v.def.wid / 2 + R * 0.8;
    if (Math.abs(lf) >= hl || Math.abs(ls) >= hw) continue;
    const vs = Math.hypot(v.vx, v.vz);
    if (vs > 5.5 && hitCD <= 0) { hitCD = 0.8; hooks.hurtPlayer(Math.min(100, (vs - 4.5) * 7)); sfx('crash', Math.min(1, vs / 20)); knock.x += v.vx * 0.7; knock.z += v.vz * 0.7; }
    const pf = hl - Math.abs(lf), ps = hw - Math.abs(ls);
    if (pf < ps) { const s = Math.sign(lf) || 1; p.x += fx * s * pf; p.z += fz * s * pf; } else { const s = Math.sign(ls) || 1; p.x += fz * s * ps; p.z += -fx * s * ps; }
  }
}

const inside2a = () => game.where !== 'out';

export default function Player() {
  const C = useMemo(() => makeCharacter(), []);
  const guns = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#1b1c20', metalness: 0.7, roughness: 0.35 });
    const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.11), m); pistol.position.set(0, -0.36, 0.03);
    const smg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.13), m); smg.position.set(0, -0.4, 0.03);
    C.arms[0].mid.add(pistol, smg); return { pistol, smg };
  }, [C]);
  const grp = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const st = useMemo(() => ({ phase: 0, vx: 0, vz: 0, lean: 0, saveT: 0, crouchK: 0, landT: 0, carYaw: 0, look: 0, lookP: 0, lookT: 0, fov: 62, aimK: 0 }), []);
  const camPos = useMemo(() => new THREE.Vector3(), []), camTgt = useMemo(() => new THREE.Vector3(), []), want = useMemo(() => new THREE.Vector3(), []);

  const exitCar = (me: Veh) => {
    const p = game.player, sp = Math.hypot(me.vx, me.vz);
    if (sp > 9) { toast('スピードを落とすと降りられる', 1.4); return; }
    const lx = Math.cos(me.yaw), lz = -Math.sin(me.yaw), fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), off = me.def.wid / 2 + 0.6;
    const spots = [[lx * off, lz * off], [-lx * off, -lz * off], [-fx * (me.def.len / 2 + 0.8), -fz * (me.def.len / 2 + 0.8)], [fx * (me.def.len / 2 + 0.8), fz * (me.def.len / 2 + 0.8)]];
    let ok: number[] | null = null;
    for (const [dx, dz] of spots) {
      const q = { x: me.x + dx, z: me.z + dz }, q0x = q.x, q0z = q.z;
      if (isWater(q.x, q.z)) continue;
      if (collide(q, R, groundAt(q.x, q.z), H) && Math.hypot(q.x - q0x, q.z - q0z) > 0.05) continue;
      if (vehicles.some((v) => v !== me && Math.hypot(v.x - q.x, v.z - q.z) < v.def.len / 2 + 0.4)) continue;
      ok = [q.x, q.z]; break;
    }
    if (!ok) { toast('ここでは降りられない', 1.4); return; }
    game.cam.yaw = st.carYaw + Math.PI + st.look; game.cam.pitch = 0.28;
    game.inCar = 0; releaseDrive(); sfx('door');
    p.x = ok[0]; p.z = ok[1]; p.y = groundAt(p.x, p.z); p.vy = 0; p.yaw = me.yaw; st.vx = st.vz = 0; camPos.set(p.x + Math.sin(game.cam.yaw) * 4, p.y + 2.5, p.z + Math.cos(game.cam.yaw) * 4);
    save();
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05), p = game.player, inside = game.where !== 'out', def = INTERIORS[game.where];
    const me = playerCar();
    if (game.inCar && !me) game.inCar = 0;
    if (!game.started) { st.phase += dt; }
    else if (me) {
      // ----- driving: the car sim moves the car, the player rides along -----
      if (input.lookDX || input.lookDY) st.lookT = 1.4;
      st.look -= input.lookDX * 0.0055; st.lookP = clamp(st.lookP + input.lookDY * 0.004, -0.15, 0.9); input.lookDX = 0; input.lookDY = 0;
      st.lookT -= dt; if (st.lookT <= 0 && game.speed > 3) { st.look *= 1 - Math.min(1, dt * 2.5); st.lookP *= 1 - Math.min(1, dt * 2.5); }
      if (input.camCycle) { input.camCycle = false; game.cam.carMode = (game.cam.carMode + 1) % 3; toast(['追従カメラ', '遠景カメラ', 'ボンネットカメラ'][game.cam.carMode], 1.2); }
      input.jump = false; input.crouchToggle = false; input.fire = false; input.wcycle = false; combat.lock = null;
      if (input.radio) { input.radio = false; game.radio = (game.radio + 1) % (STATIONS.length + 1); toast(game.radio ? '📻 ' + STATIONS[game.radio - 1].name + '（' + STATIONS[game.radio - 1].genre + '）' : '📻 ラジオ オフ', 1.6); }
      p.x = me.x; p.z = me.z; p.y = me.y; p.yaw = me.yaw; p.speed = 0; p.vy = 0; p.grounded = true; p.crouch = false; st.vx = st.vz = 0;
      game.stamina = clamp(game.stamina + 12 * dt, 0, 100);
      game.near = jobNear();
      if (law.over) input.action = false;
      if (input.action) { input.action = false; const n = game.near; if (n && n.kind === 'job') jobAction(n.id); else exitCar(me); }
      game.district = districtAt(p.x, p.z);
      if (game.waypoint && Math.hypot(p.x - game.waypoint.x, p.z - game.waypoint.z) < 14) { game.waypoint = null; toast('目的地に到着'); }
      st.saveT += dt; if (st.saveT > 5) { st.saveT = 0; save(); }
    }
    else {
      // ----- look -----
      game.cam.yaw -= input.lookDX * 0.0055; game.cam.pitch = clamp(game.cam.pitch + input.lookDY * 0.004, -0.35, 1.1);
      input.lookDX = 0; input.lookDY = 0;
      if (input.camCycle) { input.camCycle = false; game.cam.mode = (game.cam.mode + 1) % 3; toast(['標準カメラ', '遠景カメラ', '一人称カメラ'][game.cam.mode], 1.2); }
      if (input.crouchToggle) { input.crouchToggle = false; p.crouch = !p.crouch; }
      if (input.wcycle) { input.wcycle = false; cycleWeapon(); }
      input.radio = false;
      const aiming = !inside && !law.over && (input.aim || input.aimHold) && armed();
      if (aiming) game.cam.pitch = clamp(game.cam.pitch, -0.55, 0.85);
      // ----- move (camera-relative, PC style: the camera never auto-swings) -----
      const [mx, my] = law.over ? [0, 0] : moveVector(), mag = Math.min(1, Math.hypot(mx, my));
      if (law.over) { input.action = false; input.jump = false; }
      const yaw = game.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      let dx = fx * my + rx * mx, dz = fz * my + rz * mx; const dl = Math.hypot(dx, dz); if (dl > 1e-3) { dx /= dl; dz /= dl; }
      const wantSprint = input.dash && mag > 0.3 && !p.crouch && game.stamina > 1;
      const top = p.crouch ? CROUCH : wantSprint ? SPRINT : mag > 0.65 || game.isTouch === false ? RUN * (input.joyActive ? mag : 1) : WALK + (RUN - WALK) * mag;
      const sp = Math.min(aiming ? WALK * 1.15 : 99, top * (input.joyActive ? Math.max(mag, 0.35) : mag > 0 ? 1 : 0) * (inside ? 0.6 : 1));
      const acc = p.grounded ? 14 : 3;
      st.vx = lerp(st.vx, dx * sp, Math.min(1, acc * dt)); st.vz = lerp(st.vz, dz * sp, Math.min(1, acc * dt));
      p.sprinting = wantSprint && Math.hypot(st.vx, st.vz) > RUN;
      game.stamina = clamp(game.stamina + (p.sprinting ? -18 : 12) * dt, 0, 100);
      const ox = p.x, oz = p.z;
      p.x += st.vx * dt; p.z += st.vz * dt;
      // vertical
      if (input.jump) { input.jump = false; if (p.grounded && !p.crouch) { p.vy = JUMP; p.grounded = false; } else if (p.crouch) p.crouch = false; }
      p.vy -= GRAV * dt; p.y += p.vy * dt;
      // collisions
      if (inside && def) { interiorCollide(def, p, R); const g = FLOOR; if (p.y <= g) { if (!p.grounded && p.vy < -8) st.landT = 0.25; p.y = g; p.vy = 0; p.grounded = true; } }
      else {
        collide(p, R, p.y, H);
        if (isWater(p.x, p.z)) { p.x = ox; p.z = oz; } // no swimming yet: the shoreline blocks you
        hitCD -= dt; pushOutOfCars(p); if (knock.x || knock.z) { st.vx += knock.x; st.vz += knock.z; p.vy = Math.max(p.vy, 3); p.grounded = false; knock.x = knock.z = 0; }
        const g = groundAt(p.x, p.z);
        if (p.y <= g + 0.02 || (p.grounded && p.y - g < 0.45 && p.vy <= 0)) { if (!p.grounded && p.vy < -8) st.landT = 0.25; p.y = g; p.vy = 0; p.grounded = true; } else p.grounded = false;
      }
      p.speed = Math.hypot(st.vx, st.vz);
      if (aiming) p.yaw += angDiff(p.yaw, game.cam.yaw + Math.PI) * Math.min(1, dt * 20);
      else if (p.speed > 0.2) p.yaw += angDiff(p.yaw, Math.atan2(st.vx, st.vz)) * Math.min(1, dt * 12);
      // ----- combat -----
      combat.cool -= dt; combat.punchT -= dt; combat.recoil = Math.max(0, combat.recoil - dt * 8);
      {
        const cy = game.cam.yaw, cp = game.cam.pitch - 0.12, rx = Math.cos(cy), rz = -Math.sin(cy);
        const hx = p.x + Math.sin(p.yaw) * 0.45 - Math.cos(p.yaw) * 0.25, hy = p.y + 1.42, hz = p.z + Math.cos(p.yaw) * 0.45 + Math.sin(p.yaw) * 0.25;
        let dx2 = -Math.sin(cy) * Math.cos(cp), dy2 = -Math.sin(cp), dz2 = -Math.cos(cy) * Math.cos(cp);
        void rx; void rz;
        if (aiming) combat.lock = findLock(hx, hy, hz, dx2, dy2, dz2, 55);
        else combat.lock = null;
        if (input.fire && !inside && !law.over) {
          if (!aiming) { // hip fire / punch along the facing direction, auto-aimed at the nearest target in front
            dx2 = Math.sin(p.yaw); dy2 = 0; dz2 = Math.cos(p.yaw);
            if (armed()) { const L = findLock(hx, hy, hz, dx2, -0.05, dz2, 32); if (L) { combat.lock = L; const t = 'ped' in L ? L.ped : L.veh; p.yaw = Math.atan2(t.x - p.x, t.z - p.z); dx2 = Math.sin(p.yaw); dz2 = Math.cos(p.yaw); } }
          }
          fire(hx, hy, hz, dx2, dy2, dz2, p.speed > 0.5);
          if (!aiming && game.arms.cur === 'fist') { /* punch handled in fire() */ }
        }
      }
      // ----- interaction -----
      game.near = null;
      if (inside && def) { if (Math.hypot(p.x - def.ox - def.exit.x, p.z - def.oz - def.exit.z) < 1.6) game.near = { kind: 'exit', label: '外へ出る', id: def.id }; }
      else for (const d of doors) if (Math.hypot(p.x - d.x, p.z - d.z) < 1.8) { game.near = { kind: 'door', label: d.label + 'に入る', id: d.id }; break; }
      { const j = jobNear(); if (j && (!game.near || game.near.kind !== 'door')) game.near = j; }
      if (!inside && !game.near && armed()) { const q = nearestPed(p.x, p.z, 2.4); if (q && q.state !== 'hands' && q.state !== 'flee') game.near = { kind: 'job', id: 'mug:' + q.id, label: 'カツアゲする（銃で脅す）', btn: '脅す' }; }
      if (!inside && !game.near) {
        let best: Veh | null = null, bd = 1e9;
        for (const v of vehicles) { if (v.dead || v.role === 'armored') continue; const dx = p.x - v.x, dz = p.z - v.z; if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue; const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), d = Math.hypot(Math.max(0, Math.abs(dx * fx + dz * fz) - v.def.len / 2), Math.max(0, Math.abs(dx * fz - dz * fx) - v.def.wid / 2)); if (d < 1.7 && d < bd) { bd = d; best = v; } }
        if (best) game.near = { kind: 'car', label: best.def.name + (best.owned >= 0 ? '（自分の車）' : best.role === 'traffic' && best.ai ? 'を奪う' : '') + (best.role === 'traffic' && best.ai ? '' : 'に乗る'), id: String(best.id), btn: best.role === 'traffic' && best.ai ? '奪う' : '乗る' };
      }
      if (input.action) {
        input.action = false;
        const n = game.near;
        if (n && n.kind === 'job' && n.id.startsWith('mug:')) {
          const q = peds.find((o) => 'mug:' + o.id === n.id); if (q) { mug(q); scare(q.x, q.z, 12); sfx('ui'); if (copSees(q.x, q.z, 60)) setWanted(1, 'カツアゲを見られた'); }
        } else if (n && n.kind === 'job') jobAction(n.id);
        else if (n && n.kind === 'door') {
          const d = doors.find((q) => q.id === n.id)!, I = INTERIORS[d.interior]; game.lastDoor = d.id;
          game.outsidePos = { x: d.x + Math.sin(d.ang) * 2.2, z: d.z + Math.cos(d.ang) * 2.2, yaw: d.ang };
          game.where = I.id; p.x = I.ox + I.spawn.x; p.z = I.oz + I.spawn.z; p.y = FLOOR; p.vy = 0; p.yaw = I.spawn.yaw; game.cam.yaw = I.spawn.yaw + Math.PI; st.vx = st.vz = 0;
          toast(I.name, 1.6); save();
        } else if (n && n.kind === 'car') {
          const v = vehicles.find((q) => String(q.id) === n.id);
          if (v && !v.dead) {
            if (v.role === 'traffic' && v.ai) { // carjack: the driver is thrown out and runs
              const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw); ejectPed(v.x + lx * (v.def.wid / 2 + 0.9), v.z + lz * (v.def.wid / 2 + 0.9), p.x, p.z);
              v.role = ''; v.ai = null; v.vx *= 0.2; v.vz *= 0.2; sfx('crash', 0.25);
              if (copSees(v.x, v.z, 60)) setWanted(1, '車を強奪');
            }
            game.inCar = v.id; v.touched = true; releaseDrive(); sfx('door'); onEnterCar(v);
            st.carYaw = v.yaw; st.look = 0; st.lookP = 0; st.lookT = 0; game.near = null;
            toast(v.def.name + (v.owned < 0 ? '' : ''), 1.2);
          }
        } else if (n && n.kind === 'exit') {
          const o = game.outsidePos; game.where = 'out'; p.x = o.x; p.z = o.z; p.y = groundAt(o.x, o.z); p.vy = 0; p.yaw = o.yaw; game.cam.yaw = o.yaw + Math.PI; st.vx = st.vz = 0; save();
        }
      }
      game.district = inside && def ? def.name : districtAt(p.x, p.z);
      if (game.waypoint && Math.hypot(p.x - game.waypoint.x, p.z - game.waypoint.z) < 12 && !inside) { game.waypoint = null; toast('目的地に到着'); }
      st.saveT += dt; if (st.saveT > 5) { st.saveT = 0; save(); }
    }
    // ----- animation -----
    const spd = game.player.speed, gnd = game.player.grounded, run = clamp(spd / RUN, 0, 1.5);
    st.crouchK = lerp(st.crouchK, game.player.crouch ? 1 : 0, Math.min(1, dt * 10));
    st.landT = Math.max(0, st.landT - dt);
    st.phase += dt * (spd > 0.15 ? 2.2 + spd * 1.35 : 0);
    const s = Math.sin(st.phase), c = Math.cos(st.phase), amp = clamp(spd / 3, 0, 1) * (game.player.crouch ? 0.55 : 1);
    const ck = st.crouchK, land = st.landT * 2.4;
    C.hips.position.y = 0.95 - ck * 0.32 - land * 0.12 + (gnd ? Math.abs(s) * 0.05 * amp : 0);
    C.spine.rotation.x = 0.08 * run + ck * 0.35 + land * 0.3;
    C.spine.rotation.y = s * 0.12 * amp;
    C.head.rotation.x = -C.spine.rotation.x * 0.6;
    const breathe = Math.sin(performance.now() / 700) * 0.02;
    C.legs.forEach((l, i) => {
      const sg = i ? 1 : -1;
      if (!gnd) { l.top.rotation.x = sg > 0 ? -0.7 : 0.25; l.mid.rotation.x = sg > 0 ? 1.1 : 0.4; return; }
      l.top.rotation.x = -sg * s * 0.7 * amp - ck * 1.05;
      l.mid.rotation.x = Math.max(0, sg * c) * 1.15 * amp + ck * 1.75 + land * 0.8;
    });
    C.arms.forEach((a, i) => {
      const sg = i ? 1 : -1;
      if (!gnd) { a.top.rotation.x = -2.4; a.top.rotation.z = sg * 0.3; a.mid.rotation.x = -0.4; return; }
      a.top.rotation.x = sg * s * 0.65 * amp * (0.8 + run * 0.4) + breathe;
      a.top.rotation.z = sg * (0.08 + run * 0.06);
      a.mid.rotation.x = -(0.25 + amp * (0.35 + run * 0.6));
    });
    const aimNow = !me && game.started && !inside2a() && (input.aim || input.aimHold) && armed() && !law.over;
    st.aimK = lerp(st.aimK, aimNow ? 1 : 0, Math.min(1, dt * 10));
    guns.pistol.visible = !me && game.arms.cur === 'pistol'; guns.smg.visible = !me && game.arms.cur === 'smg';
    if (!me && (aimNow || (armed() && performance.now() - combat.lastShot < 600))) {
      const pa = clamp(game.cam.pitch - 0.12, -0.6, 0.9), kick = combat.recoil * 0.25;
      C.arms[0].top.rotation.set(-1.52 + pa * 0.9 - kick, 0, -0.05); C.arms[0].mid.rotation.x = 0;
      C.arms[1].top.rotation.set(-1.35 + pa * 0.9 - kick, 0, -0.5); C.arms[1].mid.rotation.x = -0.35;
      C.spine.rotation.y = 0.15;
    } else if (!me && combat.punchT > 0) { C.arms[0].top.rotation.x = -1.6; C.arms[0].mid.rotation.x = -0.1; C.spine.rotation.y = -0.3; }
    else if (!me && armed()) C.arms[0].mid.rotation.x = -0.7;
    C.root.rotation.z = 0; C.root.position.set(0, 0, 0);
    if (me && me.def.kind === 'bike') { // seated rider, leaning with the bike
      C.hips.position.y = 1.0; C.spine.rotation.x = 0.55; C.spine.rotation.y = 0; C.head.rotation.x = -0.45;
      C.legs.forEach((l) => { l.top.rotation.x = -1.25; l.mid.rotation.x = 1.55; });
      C.arms.forEach((a, i) => { a.top.rotation.x = -1.15; a.top.rotation.z = (i ? 1 : -1) * 0.12; a.mid.rotation.x = -0.35; });
      C.root.position.z = -0.32; C.root.rotation.z = 0;
    }
    if (grp.current) {
      grp.current.position.set(game.player.x, game.player.y, game.player.z); grp.current.rotation.set(0, game.player.yaw, 0);
      if (me && me.def.kind === 'bike') { grp.current.rotateX(-me.pitch); grp.current.rotateZ(me.lean); }
      grp.current.visible = me ? me.def.kind === 'bike' && game.cam.carMode !== 2 : game.cam.mode !== 2 || !game.started;
    }

    // ----- camera -----
    const P = game.player, mode = game.cam.mode, inside2 = game.where !== 'out';
    const dist = lerp([4.6, 8.5, 0][mode] * (inside2 ? 0.7 : 1), 2.8, mode === 2 ? 0 : st.aimK), height = (P.crouch ? 1.05 : 1.55);
    const yaw = game.cam.yaw, pitch = game.cam.pitch;
    camTgt.set(P.x + Math.cos(yaw) * 0.85 * st.aimK, P.y + height + 0.1 * st.aimK, P.z - Math.sin(yaw) * 0.85 * st.aimK);
    if (!game.started) { // attract orbit over the city
      const t = performance.now() / 12000; camera.position.set(P.x + Math.sin(t) * 60, 45, P.z + Math.cos(t) * 60); camera.lookAt(P.x, 10, P.z); return;
    }
    const cam = camera as THREE.PerspectiveCamera;
    const wantFov = me ? 60 + Math.min(16, game.speed * 0.22) : 62 - st.aimK * 12;
    if (Math.abs(st.fov - wantFov) > 0.05) { st.fov += (wantFov - st.fov) * Math.min(1, dt * (st.aimK > 0.05 ? 10 : 3)); cam.fov = st.fov; cam.updateProjectionMatrix(); }
    game.shake = Math.max(0, game.shake - dt * 2.2);
    if (me) {
      st.carYaw += angDiff(st.carYaw, me.yaw) * Math.min(1, dt * (3.5 + game.speed * 0.06));
      const cyaw = st.carYaw + Math.PI + st.look, cm = game.cam.carMode; game.cam.yaw = cyaw;
      const sh = game.shake * 0.25, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
      if (cm === 2) { // hood camera
        const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), hy = me.def.kind === 'bike' ? 1.55 : me.def.kind === 'truck' ? 2.7 : me.def.hgt * 0.82;
        camera.position.set(me.x + fx * (me.def.kind === 'bike' ? -0.1 : me.def.len * 0.12) + jx, me.y + hy + jy, me.z + fz * (me.def.kind === 'bike' ? -0.1 : me.def.len * 0.12));
        const ly = me.yaw + st.look; want.set(camera.position.x + Math.sin(ly) * 10, camera.position.y - 0.6 - st.lookP * 6 - me.pitch * 10, camera.position.z + Math.cos(ly) * 10);
        camera.lookAt(want); return;
      }
      const L = me.def.len, dist2 = cm === 0 ? 3.6 + L * 0.75 : 7 + L * 1.1, ht = me.def.hgt * 0.9 + (cm === 0 ? 0.55 : 1.3), pitch2 = (cm === 0 ? 0.1 : 0.18) + st.lookP;
      camTgt.set(me.x, me.y + ht, me.z);
      const cx = Math.sin(cyaw) * Math.cos(pitch2), cz = Math.cos(cyaw) * Math.cos(pitch2), cy = Math.sin(pitch2);
      let d2 = dist2;
      for (let k = 1; k <= 12; k++) { const t = (k / 12) * dist2, x = camTgt.x + cx * t, y = camTgt.y + cy * t, z = camTgt.z + cz * t; if (pointBlocked(x, y, z) || y < groundAt(x, z) + 0.3) { d2 = Math.max(1.2, t - dist2 / 12); break; } }
      want.set(camTgt.x + cx * d2 + jx, camTgt.y + cy * d2 + jy, camTgt.z + cz * d2);
      camPos.lerp(want, Math.min(1, dt * 12)); if (camPos.distanceTo(want) > 12) camPos.copy(want);
      camera.position.copy(camPos); camera.lookAt(camTgt.x, camTgt.y - 0.15, camTgt.z); return;
    }
    if (mode === 2) {
      camera.position.set(P.x - Math.sin(yaw) * 0.15, P.y + (P.crouch ? 1.0 : 1.66), P.z - Math.cos(yaw) * 0.15);
      want.set(camera.position.x - Math.sin(yaw) * Math.cos(pitch - 0.25), camera.position.y - Math.sin(pitch - 0.25), camera.position.z - Math.cos(yaw) * Math.cos(pitch - 0.25));
      camera.lookAt(want); return;
    }
    const cx = Math.sin(yaw) * Math.cos(pitch), cz = Math.cos(yaw) * Math.cos(pitch), cy = Math.sin(pitch);
    let d = dist;
    // pull the camera in when a wall is between it and the player
    for (let k = 1; k <= 12; k++) {
      const t = (k / 12) * dist, x = camTgt.x + cx * t, y = camTgt.y + cy * t, z = camTgt.z + cz * t;
      const blocked = inside2 ? (() => { const I = INTERIORS[game.where]; return !I || Math.abs(x - I.ox) > I.w / 2 - 0.25 || Math.abs(z - I.oz) > I.d / 2 - 0.25 || y > FLOOR + I.h - 0.2; })() : pointBlocked(x, y, z) || y < groundAt(x, z) + 0.3;
      if (blocked) { d = Math.max(0.6, t - dist / 12); break; }
    }
    want.set(camTgt.x + cx * d, camTgt.y + cy * d, camTgt.z + cz * d);
    camPos.lerp(want, Math.min(1, dt * 14)); if (camPos.distanceTo(want) > 6) camPos.copy(want);
    camera.position.copy(camPos); camera.lookAt(camTgt.x - cx * 0.0, camTgt.y + 0.1, camTgt.z);
  });

  return <group ref={grp}><primitive object={C.root} /></group>;
}
