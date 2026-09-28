# WORM transient-effect resource lifetime

Based on main `c910a3d`, following the tile/orb batching work.

## Implementation

- Pickup bursts borrow a private six-material set from a mode-owned pool. Finished
  sets are reused, with colours and opacity reset; simultaneous bursts never share
  mutable materials. At most eight idle sets are retained. A separate six-material
  warm set owns the plain, double-sided, back-sided and coloured-instance programs.
  Acquisition happens after React commits; deferred returns preserve ownership
  through StrictMode rehearsal and host detachment. The idle cap is 48 materials,
  plus six warm materials and six per active burst.
- Shader sources for tile portals, flip bursts and Möbius ribbons are shared with
  a compile-only warm-up. Their GLSL and live uniforms are unchanged. Private live
  materials can still be disposed when a tile/tunnel disappears while the warm-up
  retains the compiled program. Tally and raised-edge line variants are included.
  The line library changes a define during compilation, so every warmed scene
  variant retains both the fresh-mount and post-compile cache keys.
- Warm-up uses the actual scene lighting/environment, with coloured instancing
  represented correctly. It responds to environment, fog, quality and equipped-look
  changes, and keeps earlier compiled variants available for reuse. The temporary
  objects are never added to the live scene or rendered.
- The equipped worm body/face, elemental patch pools and signature marker pools
  remain mounted through scrambling. Visibility still follows the game phase.
  Retry resets the body/face presentation clocks and pickup state. Owned resources
  and retained warm-up materials are released when the mode exits.

This trades a bounded set of resident materials/programs and startup compilation
for fewer repeated allocations and shader links during play. It does not change
shell rendering, shader artwork, game timing or tunnel/camera trajectories.

## Verification

- `npm run ci`: 302 test files / 3,655 tests passed; lint has zero errors and the
  92 existing warnings; production build and bundle budgets passed.
- Added coverage for overlapping pickup colours, opacity reset, bounded reuse,
  overflow disposal, StrictMode lifecycle replay, retry presentation reset,
  scene-variant warm-up (including line cache keys), and mode-exit cleanup.
- All 25 extracted shader source strings exactly match main. Real-draw portal,
  pickup and Explode captures were inspected; the browser reported no shader
  compilation errors.

The `events` harness described in `scripts/perf-worm/README.md` measures a solved
3×3 board, three parity orbs, native paired flips and worm-renderer visibility
changes. Both builds use seed 71, reduced FX, DPR 1 and 1,400 ms event windows in
headless Chromium. Draw calls are suppressed during timing; visual captures run
afterward with real draws. Baseline is main `c910a3d` with the same harness.

| Event | Baseline shader links | Updated shader links |
| --- | ---: | ---: |
| First pickup | 2 | 0 |
| Repeated pickup | 1 | 0 |
| First paired wormhole spawn | 23 | 5 |
| Repeated paired wormhole spawn | 16 | 0 |
| Remove the paired wormhole | 1 | 0 |
| Show the worm after scrambling | 9 | 0 |

Baseline ran four cycles; updated code ran six. Every repeated event in the
updated run had zero links. The five remaining first-use links belong to resident
tile-surface, pad-energy and wormhole-ring variants.

Observed rAF callback CPU maxima:

| Event | Baseline | Updated |
| --- | ---: | ---: |
| First wormhole spawn | 66.3 ms | 37.2 ms |
| Repeated wormhole spawn, range across cycles | 23.2–29.0 ms | 8.8–24.1 ms |
| Show the worm after scrambling, repeated cycles | 20.6–22.6 ms | 5.5–12.8 ms |

The retained-program tradeoff is visible: after effects settle, the baseline
holds 160 programs and the updated build holds 219. Updated counts stay at 219
programs / 182 geometries / 46 textures at the end of all six cycles. Geometry
count rises to 218 while the paired wormhole is present and returns to 182 after
removal. Collected JS heap rises from 48.21 MB to 49.57 MB over six cycles; the
last two samples are 49.55 and 49.57 MB. This short run shows stable renderer
resource counts, not proof against every long-session leak.

Timing is supporting evidence only: software WebGL, background work and the
entry animation limit comparisons. These are CPU submission measurements, not
GPU timings or physical-device FPS. The fixture exercises renderer visibility
transitions rather than a full death/retry or tunnel ride; run-reset behavior is
covered separately by the regression tests. Warm-up moves compilation toward
mode entry and graphics changes; startup latency was not measured here.
