# WORM performance harness

Drives a real WORM free-play run in headless Chromium and reports per-frame CPU cost, draw calls, GPU uploads, shader compiles and React commits. Every number in `docs/worm-mode-performance-audit-2026-09-27.md` came from these scripts, so a fix can be checked against the same measurement.

Nothing here ships: `scripts/` is outside the bundle and ESLint's scope. This harness takes Playwright from `$PLAYWRIGHT` (below) so it can use a different version from the one `npm run e2e` pins; `@playwright/test` is a devDependency for the browser smoke tests in `e2e/`, not for this.

## Setup

```bash
# Playwright in a scratch directory (separate from the e2e devDependency)
mkdir -p /tmp/pw && (cd /tmp/pw && npm init -y >/dev/null && npm i playwright@1)
export PLAYWRIGHT=/tmp/pw/node_modules/playwright/index.mjs
export CHROMIUM=/opt/pw-browsers/chromium   # the container's browser; omit to use Playwright's own
```

Measure a **production** build for absolute numbers (development React is several times slower to reconcile):

```bash
npx vite build --config scripts/perf-worm/vite.perf.config.mjs     # → dist-perf/ (gitignored)
npx vite preview --config scripts/perf-worm/vite.perf.config.mjs --port 4173
```

That config is the deploy config, unminified (so profiles keep function names) with `window.__store` exposed. The dev server works too (`npm run dev`, default `--url`), and its component names are the easiest to read.

## Modes

```bash
node scripts/perf-worm/run.mjs --mode=frames    --url=http://localhost:4173/WORM-3/ --ms=45000
node scripts/perf-worm/run.mjs --mode=frames    --url=... --throttle=4          # mid-range-phone CPU proxy
node scripts/perf-worm/run.mjs --mode=frames    --url=... --profile             # + CPU self time by function
node scripts/perf-worm/run.mjs --mode=attribute --url=... --ms=20000            # draws/uploads/compiles by component
node scripts/perf-worm/run.mjs --mode=react     --url=... --ms=20000            # which components re-render
node scripts/perf-worm/run.mjs --mode=ab        --url=... --seq=base,A,B,AB     # price a fix on a frozen scene
node scripts/perf-worm/run.mjs --mode=batching  --url=... --size=6 --ms=3000 --shots=/tmp/batching6
```

Common flags: `--size=5` (board size in the wizard), `--mobile` (412×915 touch viewport), `--draw` (keep real draw calls), `--out=result.json`, `--screenshot=scene.png` (enables real draws after measurement).
`--freeze` pauses at the start of active play. `--seed=71` seeds `Math.random`;
wall-clock-dependent activity can still make separate launches differ. The runner
checks the actual launched board size, rather than only labelling the requested size.

| Mode | Output |
| --- | --- |
| `frames` | fps, script ms per frame (p50/p95/mean/max), draws, triangles, program switches, uniform calls, upload KB, shader links, React commit rate and the extra script time on frames that carry a commit, phase histogram, heap |
| `attribute` | render passes; draws and triangles per frame by owning component; uploads by attribute; materials that force three.js back through program selection every frame; every shader link attributed to the draw that triggered it |
| `react` | commit rates plus render counts per component (DOM root and R3F root) |
| `ab` | pauses the run so every window renders the same scene, then toggles in-page patches: **A** transparent double-sided materials in one pass, **B** instanced attributes upload only the live range, **C** hidden subtrees skip world-matrix updates, **D** inward-facing antipodal sticker backs hidden |
| `batching` | alternates individual tile meshes / three cage material groups with the production batches in one frozen scene; pins reduced FX and DPR 1; records draw ownership and optionally captures paired real-draw images |

`batching` uses `batching.js` to reconstruct individual tile meshes from the real
component props and split merged cages back into their three original colour/alpha
groups. It holds the camera and animation clock fixed. `--shots=directory` captures
overview, Explode, glass and interior pairs; `--poses=overview` restricts capture.
`--shot-dpr=0.5` lowers only capture resolution when software WebGL readback is slow.
These are draw-count and visual comparisons, **not historical CPU benchmarks**:
batch-maintenance callbacks keep running in the reference windows too. Shadow
quality must stay pinned; otherwise the adaptive tier adds/removes an entire shadow
pass between windows. Any WebGL shader compilation errors fail the run.

## What the numbers mean

- **Draw calls are suppressed by default.** In a container WebGL runs on SwiftShader, and rasterisation would gate every frame (about 2 fps, and 95% of the JS profile shows as native "(program)"). Suppression skips only the `draw*` calls. three.js still does all its CPU work per frame (culling, sorting, program selection, uniform and buffer uploads), and so do React and every `useFrame`. `script` is therefore the main thread's per-frame CPU cost. It is not GPU time. Pass `--draw` on a machine with a real GPU.
- `--throttle=4` is Chrome's CPU throttling, the usual stand-in for a mid-range phone. It says nothing about that phone's GPU or thermals.
- Shader links are counted on the main thread. On a real device the driver compile runs on top, so each link costs more than it does here.
- Runs retry automatically after a death. `phases` shows how many frames fell in each state (`gamePhase|wormPhase|turning|element|FX tier`), so a window that wandered into the death screen is visible.
- Tunnel rides are not exercised: the scripted worm never deliberately jumps onto a raised flipped tile.

## Corrections after review

- Desktop now uses 1280×800. The original 640×400 run activated the game's
  `isMobile` branch (width ≤768); its timings were not a desktop visual workload.
- WebGL2 `bufferSubData(..., srcOffset, 0)` copies the remaining source; the byte
  counter now implements that rule. The original patch B counted empty-pool
  uploads as zero while still transferring full buffers. Its reported 99% upload
  reduction is invalid and needs a fresh baseline. Patch B now skips dirtying
  empty buffers and uses the supported `updateRanges` API for active instances.
- Per-owner uploads now come from actual GL calls, not attribute-version changes.
- Patch C remains an experimental matrix flag only. In r159, a parent's forced
  update overrides it; it is not a demonstrated hidden-subtree optimization.
- Draw suppression isolates instrumented CPU submission work, not GPU time or
  physical-phone FPS. A and B are broad patches, not component-isolated fixes.

## Repeated effect lifecycle checks

```bash
node scripts/perf-worm/run.mjs --mode=events --size=3 --seed=71 --ms=1400 --cycles=6 --url=http://localhost:4173/WORM-3/ --out=/tmp/worm-effects.json
```

`events` pins reduced FX and DPR 1, pauses gameplay, installs a solved board with
one row of parity orbs, and repeats the same rendering transitions:

- A magnet pickup's `OrbPickupBurst`, using its production pending-effect bridge.
  This uses `pickup=false` so the burst can complete while gameplay stays paused.
- Three native paired flips of the centre front tile, including the raised Möbius
  ribbon and higher-flip decoration, then removal of the pair.
- Scrambling/active visibility transitions for the worm renderers. This isolates
  resource lifetimes; it does not simulate a complete death and restart.

Each event records actual shader link calls, rAF callback CPU timings and renderer
resource counts. Each cycle also collects garbage and records heap usage.
`--shots=directory` captures real-draw wormhole, pickup and Explode views after the
timing windows; `--program-keys` includes renderer cache keys for link diagnostics.
The JSON's `scene` describes entry state and `fixture` describes the controlled
event workload. Compare
separate production builds with the same fixture. Shader links are the primary
result: software WebGL, background work and initialization differences limit CPU
comparisons, and these measurements cannot establish physical-device FPS.
