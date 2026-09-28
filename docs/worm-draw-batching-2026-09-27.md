# WORM tile and orb draw batching

This follow-up implements the tile/orb draw-call work from the performance audit.
It is rebased onto main `17e1908`, including the latest tunnel movement and
Antiverse panel updates. Full CI and measurements below predate this final rebase;
the targeted integration checks were rerun afterward.

## Changes

- Tile borders share an ordinary and a flipped instanced batch. Solid-colour
  WORM antipodal backs share one standard material with per-instance colours.
  Glass and patterned backs keep their existing materials and sorting.
- Batches read the actual tile anchors after rotation, raised-pad and expansion
  updates. They retain individual frustum culling, compact hidden slots, skip
  unchanged uploads, and keep all tiles available for PiP/live portal cameras.
  Cutaway captures hide the batches with the exterior. Tunnel exterior visibility
  now updates after the chase camera and before the batch reads it.
- Each orb's two additive cage rings and connecting axis use one merged geometry
  and one draw. RGBA vertex colours retain each piece's linear RGB and separate
  alpha. Normal/target sizes, cage animation, the inner halo and glass shell remain
  unchanged. A prototype that instanced glows across the whole scene was rejected:
  it changed their sorting against the glass shells in the paired images.

## Matched draw-count checks

`scripts/perf-worm/run.mjs --mode=batching` compares individual reference meshes
with batching within one paused Free Play scene. It holds the animation clock and
overview camera fixed, pins reduced FX and DPR 1, and alternates two pairs of
three-second windows at 1280×800. The reference reconstructs tile meshes from the
real component props and renders the cage geometry's three original material groups.

| Board | Parity orbs | Reference draws/frame | Batched draws/frame | Reduction | Triangles/frame, both |
| --- | ---: | ---: | ---: | ---: | ---: |
| 6×6 | 30 | 1,029 | 539 | 47.6% | 755,866 |
| 10×10 | 50 | 2,627 | 1,329 | 49.4% | 1,991,160 |

Both alternating pairs returned the same draw/triangle counts, with zero shader
links in the measured windows. Steady buffer uploads also matched: 12.9 KiB/frame
on 6×6 and 17.4 KiB/frame on 10×10. The two tile layers contribute `12n²` individual
draws on these unflipped boards; two instance batches replace them. Cage merging
saves two draws per orb. That accounts for all 490 / 1,298 removed draws.

These are instrumented submission counts with draws suppressed, not physical-device
FPS results. Reference windows still run the batch-maintenance callbacks, so their
CPU timings are not a comparison with historical source. The 6×6 fixture ran before
the mirror-orbit rebase; 10×10 and the full CI check ran after it.

## Validation

- Full `npm run ci`: 301 files / 3,650 tests passed, zero lint errors, production
  build and bundle budgets passed on main `0ce16ad`.
- After rebasing onto `17e1908`, all 136 tests in seven batching, cage, inspection,
  core-opening, tunnel-body and worm-simulation suites passed.
- Transform tests cover 6×6/10×10 counts, rotating and raised anchors, transformed
  parents, hidden/restored tiles, palette updates, and frustum/PiP behavior.
- Real R3F tests cover flips, glass and patterned fallback/restoration. Existing
  live expansion, tunnel/camera, mirror-room and cutaway regressions also pass.
- Geometry tests compare every merged cage vertex, colour and opacity with the
  three original pieces, for both ordinary and target orbs.
- Real-draw 6×6 image pairs were checked in overview, Explode, glass and inside
  views. Their mean channel differences were below 0.0001 on a 0–255 scale;
  only one overview pixel differed by more than 8. No shader errors were reported.
- A 10×10 overview pair also passed visual inspection at capture DPR 0.5 after
  full-resolution software-WebGL readback timed out. The mean channel difference
  was 0.0017, with 92 of 1,024,000 pixels differing by more than 8. Its performance
  measurements above still used DPR 1; only the screenshot resolution was reduced.

Reproduce the comparison with the unminified performance build:

```bash
node scripts/perf-worm/run.mjs --mode=batching --size=6 --seed=71 --ms=3000 --url=http://localhost:4173/WORM-3/ --shots=/tmp/batching6
node scripts/perf-worm/run.mjs --mode=batching --size=10 --seed=71 --ms=3000 --url=http://localhost:4173/WORM-3/ --shots=/tmp/batching10 --poses=overview
```
