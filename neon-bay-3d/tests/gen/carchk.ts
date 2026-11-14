import { VDEFS as VEHICLES } from '../../src/game/vehicles/defs';
import { PROF } from '../../src/game/vehicles/models';
import { carParts } from '../../src/game/vehicles/shaped';
// every shaped road car: its parts are built, hold no broken numbers, fit the car's size, and the wheels fit their arches
const out: Record<string, unknown> = {}; let bad = 0;
for (const k of Object.keys(PROF) as (keyof typeof PROF)[]) {
  const def = VEHICLES[k], t0 = performance.now(), Q = carParts(def, PROF[k]!), ms = performance.now() - t0, S = Q.S;
  let tris = 0, nan = 0; const empty: string[] = [];
  const box = { x0: 9, x1: -9, y0: 9, y1: -9, z0: 9, z1: -9 };
  for (const [name, g] of Object.entries({ paint: Q.paint, glass: Q.glass, trim: Q.trim, chrome: Q.chrome, head: Q.head, tail: Q.tail, blinkL: Q.blinkL, blinkR: Q.blinkR, rev: Q.rev, seams: Q.seams, well: Q.well, soot: Q.soot, crack: Q.crack, doorPanel: Q.door.panel, doorWin: Q.door.win })) {
    const p = g.getAttribute('position'); if (!p || !p.count) { empty.push(name); continue; }
    tris += p.count / 3;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (!isFinite(x + y + z)) nan++; else if (name === 'paint') { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); box.z0 = Math.min(box.z0, z); box.z1 = Math.max(box.z1, z); } }
    const n = g.getAttribute('normal'); if (n) for (let i = 0; i < n.count; i++) if (!isFinite(n.getX(i) + n.getY(i) + n.getZ(i))) nan++;
  }
  // the tyre against the arch: clear of the arch top, and its outer face inside the flank at the hub height
  const gap = S.R - def.wheelR, proud = Math.max(...[S.wx, -S.wx].map((c) => S.wz + S.tw / 2 - S.zs(c, S.cy)));
  const r = (v: number) => +v.toFixed(2);
  const ok = !nan && !empty.length && box.x1 - box.x0 > def.len * 0.9 && box.x1 - box.x0 < def.len * 1.06 && box.z1 - box.z0 > def.wid * 0.95 && box.z1 - box.z0 < def.wid + 0.45 && gap > 0.05 && proud < 0;
  if (!ok) bad++;
  out[k] = { ok, tris: Math.round(tris), ms: Math.round(ms), nan, empty, len: r(box.x1 - box.x0), wid: r(box.z1 - box.z0), top: r(box.y1), gap: r(gap), tyreProud: r(proud), lamps: [r(Q.hy), r(Q.ty)] };
}
console.log(JSON.stringify({ bad }));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
