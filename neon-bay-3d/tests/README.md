# Neon Bay 3D — tests

Two kinds of checks. Neither needs a GPU, and neither is wired into `npm run build`.

## 1. Generator checks (fast, Node only)

They import the city generator and check the generated data for each city: collisions, doors, lanes, bridges,
the Shinkansen tunnel, the skyline. The region comes from the `RG` environment variable.

```sh
cd neon-bay-3d
npx esbuild tests/gen/lanechk.ts --bundle --platform=node --outfile=/tmp/lanechk.cjs \
  "--banner:js=globalThis.localStorage={getItem:k=>k==='neonbay3d.region'?process.env.RG:null,setItem(){},removeItem(){}};"
for r in tokyo osaka fukuoka naha nara; do RG=$r node /tmp/lanechk.cjs; done
```

| file | what must hold |
|---|---|
| `gen/lanechk.ts` | `blockedLanes: 0`, `badBridge: 0`, `doorBlocked` 0–1, `spawnBlocked: false` |
| `gen/skychk.ts` | towers on podiums sit inside them (`floating` and `doorsUp: 2` only count the two warehouses on the raised port quay) |
| `gen/tunchk.ts` | `minCover` > 5 m over the tunnel crown, `maxCut` ≤ 12.4 (ground under the viaduct deck) |
| `gen/placechk.ts` | places on the map by kind (deer crackers, stalls, shrines/temples, stations, ramen, convenience stores); `landingBlocked: 0` (where "skip" puts you is free ground) |
| `gen/routechk.ts` (no RG) | lines between the cities: Tokyo–Shin-Osaka 515.4 km, Shin-Osaka–Hakata 553.7 km, Osaka–Nara 32.8 km; the reversed trip has the same station gaps (`mirror: true`) |
| `gen/narachk.ts` (RG=nara) | zone map; the walk from the cloister gate into the great hall is clear (`walkInBlocked: no`), the prayer spot is free, deer spawn on free ground (`deerBlocked: 0`), cracker stalls reachable |

## 2. Browser scenarios (slow, Playwright + software WebGL)

Build the single-file page first (`SINGLE=1 npx vite build`), then pass the HTML path. Screenshots go to `./jp/`
(create it). Under SwiftShader the game runs at 1–2 fps and simulation steps are capped at 0.05 s per frame,
so anything that walks or drives in real time is slow; the scripts step the simulation directly where they can.
Run them one at a time: in parallel, taps time out.

| script | covers |
|---|---|
| `spd.cjs` | admin speed multipliers (guest refused, UI, car top speed / braking / no wall tunnelling, train ATC, persistence) |
| `shop.cjs` | opening hours (ramen shut at 3:00 with its shutter down, the convenience store open), eating scenes, convenience store, ramen ticket + seat, cafe / bar / pharmacy / boutique counters, pocket items, save |
| `life3.cjs` | pedestrians entering / leaving doors, station rotary taxi + airport bus, footbridge walk, diner / store counters |
| `tun.cjs` | Shinkansen: board, tunnel, trip to the next city, arrival, stop judging |
| `tun3.cjs` | tunnel camera stays in the bore, train sound levels, mountain views |
| `sky.cjs` | skyline screenshots (station twin towers, spiral tower, aerial day / night, shopping street) |
| `nara.cjs` | Nara: buy deer crackers, deer come over and bow, feeding; walk into the great hall and pray; pagoda / Naramachi shots; the commuter train to Osaka (ride, fast-forward, arrival) |
| `places.cjs` | map: kind chips, the nearest list, skip to each kind (the right prompt is there on arrival), guide, skip to the destination, refused while wanted |
| `events.cjs` | street events: purse snatcher (runs, knocked down, give back / keep), lost wallet (police box / keep), lost tourist (right / wrong direction), reputation, shop discount, saved reputation, an event starting by itself |
| `parking.cjs` | coin parking (pay in a bay, the car survives going 700 m away while an abandoned one is cleared, leaving the bay ends it, refused when broke), road-sign counts and screenshots |
| `line.cjs` | the real-distance line: travel-app ride Tokyo → Osaka (515 km; Fuji, tunnel, Lake Hamana, Nagoya views), clock, fast-forward, arrival; driving the bullet train out of the tunnel onto the line to Fukuoka (ATC, brakes) and arriving in the cab |

```sh
node tests/shop.cjs "$PWD/dist/index.html" tokyo
```

Every script prints `errors [...]` at the end: it must be `[]`.
