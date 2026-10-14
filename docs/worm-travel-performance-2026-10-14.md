# In-cube WORM travel — 14 October 2026

## What was expensive

The interior drew every wall tile separately: `6 × size²` meshes/material
bindings (54 on 3×3, 600 on 10×10, 1,350 on 15×15). All were explicitly exempt
from frustum culling. The anticube mirror probe also rendered six views of the
whole scene, updating the same scene transforms and shadow maps for each view.
Desktop captured every frame, so a high-refresh display multiplied that work.

Story runs skip scrambling. The full-scene shader warm-up only ran during
scrambling, leaving hidden interior materials to compile on first use.

## Changes

- Interior tiles now use one instanced draw per appearance (six for an ordinary
  board). Per-instance transforms and physical sticker identities preserve the
  equipped patterns, gloss, colour, orientation and portal cutouts. Batches
  update only on board/layout/style changes, upload their live ranges and own
  valid bounds. Missing stickers no longer get accidentally revealed.
- Mirror captures update the scene once for all six faces and reuse the main
  view's shadow maps. They retain both ping-pong targets and publish a complete
  cube together, at up to 30 captures/second (20 in reduced FX). Resolution is
  unchanged. Renderer flags, render target and pending main-view shadow updates
  are restored, even if capture fails.
- The story ready screen now performs the same full-scene shader preparation as
  free-play scrambling. Interior materials are prepared while hidden.
- Camera cutaways use a stable geometric contour instead of the noisy
  screen-space pixel dissolve. Depth arches and guide rails are brighter, with
  a quieter moving spiral. The tube also respects the in-game reduced-motion
  setting, alongside OS reduced motion.

No active connections are removed or hidden for this optimization. The portal
mouths, live mirrors, full worm animation, camera route and 10-second timing
(4 seconds in / 2 in the centre / 4 out) remain intact.

## Verification

The focused tests cover instancing and physical tile identity on 3×3, 10×10 and
15×15, recolouring/healing/dead/missing tiles, resource disposal, portal openings,
long worm traversal, mirror cadence on a 120 Hz clock, capture failure recovery,
story warm-up and exact traversal pacing. Real WebGL screenshots check entry,
centre and exit; the harness fails on shader compilation errors.

The new `scripts/perf-worm/travel.mjs` exercises actual portal entry and the full
simulation ride. The older surface benchmark never deliberately entered a tunnel.

## Before/after measurements

Unminified production builds of `643b728` and this change, Chromium/SwiftShader,
1280×800, seed 71, one raised pair on a solved board, real simulation movement.
Runs were sequential, with **full effects pinned and verified on every sampled
frame**. Draw calls were suppressed to measure CPU rendering/submission work;
these numbers are not GPU time or physical-device FPS. Early runs that allowed
adaptive FX to change tiers were discarded.

| Board / phase | CPU p50 before → after (ms) | CPU p95 before → after (ms) | Draws p50 before → after |
| --- | ---: | ---: | ---: |
| 3×3 / entering | 16.6 → 11.3 | 35.9 → 32.0 | 540 → 203 |
| 3×3 / tunnel | 13.4 → 8.6 | 22.2 → 17.1 | 558 → 222 |
| 3×3 / exiting | 15.2 → 9.1 | 48.3 → 17.4 | 558 → 179 |
| 10×10 / entering | 52.6 → 14.8 | 145.1 → 40.6 | 4,361 → 203 |
| 10×10 / tunnel | 51.5 → 16.1 | 72.3 → 25.8 | 4,380 → 222 |
| 10×10 / exiting | 56.2 → 14.8 | 137.8 → 30.8 | 4,380 → 205 |

On the 10×10 tunnel section that is **69% less median CPU work and 95% fewer
submitted draws**. On 3×3 it is **36% less median CPU work and 60% fewer draws**.
The mirror cadence change is part of these results, alongside batching and
removing repeated transform/shadow work. Captures stay at their existing
resolution; main-view animation still runs every frame.

## Remaining costs

Cold first-entry shader variants still link around the surface/interior
transition; this does not eliminate
all first-use hitches. The full-effects 10×10 scene still submits millions of
triangles when a mirror capture runs. Hardware GPU/phone frame rates need a
real-device measurement; software WebGL cannot establish those gains.
