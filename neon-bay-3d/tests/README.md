# Neon Bay 3D — tests

Two kinds of checks. Neither needs a GPU, and neither is wired into `npm run build`.

## 1. Generator checks (fast, Node only)

They import the city generator and check the generated data for each city: collisions, doors, lanes, bridges,
the Shinkansen tunnel, the skyline. The region comes from the `RG` environment variable.

```sh
cd neon-bay-3d
npx esbuild tests/gen/lanechk.ts --bundle --platform=node --outfile=/tmp/lanechk.cjs \
  "--banner:js=globalThis.localStorage={getItem:k=>k==='neonbay3d.region'?process.env.RG:null,setItem(){},removeItem(){}};"
for r in tokyo osaka fukuoka naha; do RG=$r node /tmp/lanechk.cjs; done
```

| file | what must hold |
|---|---|
| `gen/lanechk.ts` | `blockedLanes: 0`, `badBridge: 0`, `doorBlocked` 0–1, `spawnBlocked: false` |
| `gen/skychk.ts` | towers on podiums sit inside them (`floating` only counts the raised port warehouses), `doorsUp: 0` |
| `gen/tunchk.ts` | `minCover` > 5 m over the tunnel crown, `maxCut` ≤ 12.4 (ground under the viaduct deck) |

## 2. Browser scenarios (slow, Playwright + software WebGL)

Build the single-file page first (`SINGLE=1 npx vite build`), then pass the HTML path. Screenshots go to `./jp/`
(create it). Under SwiftShader the game runs at 1–2 fps and simulation steps are capped at 0.05 s per frame,
so anything that walks or drives in real time is slow; the scripts step the simulation directly where they can.
Run them one at a time: in parallel, taps time out.

| script | covers |
|---|---|
| `spd.cjs` | admin speed multipliers (guest refused, UI, car top speed / braking / no wall tunnelling, train ATC, persistence) |
| `shop.cjs` | convenience store, ramen ticket + seat, cafe / bar / pharmacy / boutique counters, pocket items, save |
| `life3.cjs` | pedestrians entering / leaving doors, station rotary taxi + airport bus, footbridge walk, diner / store counters |
| `tun.cjs` | Shinkansen: board, tunnel, trip to the next city, arrival, stop judging |
| `tun3.cjs` | tunnel camera stays in the bore, train sound levels, mountain views |
| `sky.cjs` | skyline screenshots (station twin towers, spiral tower, aerial day / night, shopping street) |

```sh
node tests/shop.cjs "$PWD/dist/index.html" tokyo
```

Every script prints `errors [...]` at the end: it must be `[]`.
