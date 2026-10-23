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

That config is the deploy config, unminified (so profiles keep function names) with `window.__store` exposed, and GSAP and the live rotation (`window.__gsap`, `window.__liveRotation`) so a probe can freeze a slice turn. It also exposes `window.__tunnelState`, the live worm sim and its context (`window.__wormSimRef`, `window.__wormCtxRef`) and `window.__beginTunnelTransition`, so a probe can start a real tunnel ride and film it, plus the live cubie meshes (`window.__liveCubies`) and the flip a tap makes (`window.__flipSticker(pos, dirKey)`), so a probe can find a tile on screen and flip it on a frozen clock. The dev server works too (`npm run dev`, default `--url`), and its component names are the easiest to read.

## Modes

### Tunnel ride camera trace

```bash
CHROMIUM=/path/to/chrome node scripts/perf-worm/ride-camera.mjs --size=5 [--attrib] [--mobile] [--raw=frames.json] \
  [--shots=dir --shot-list=windout:0.02,windout:0.6] [--profile=4000] [--longtasks]
```

Starts a real raised-pad ride once the run is live (so the scramble's own warm-up is not counted) and records every frame
of it: sim phase and progress, the lens pose, the head, the frame's CPU cost and shader links. Per phase it prints the
largest per-frame lens move and turn, how far the head strays from the view axis, the worst frame and the links;
`--attrib` names each link's owner and logs every `renderer.compile` over 5 ms with its caller; `--shots` freezes the ride
at each `phase:progress` and films it with real draws (slow: the clock keeps running while SwiftShader renders, so a
shot of a short phase can land later than its label); `--profile` takes a CPU profile of the crawl after the ride.

### Tunnel camera clearance regression

```bash
CHROMIUM=/path/to/chrome node scripts/perf-worm/camera-clearance.mjs
```

Runs the production clearance GLSL in WebGL without loading the game. Its 448
pixel checks cover every direction around the lens, four camera rolls, the
forward corridor, distant track and adjacent routes, inactive rides, and mirror
captures. Both opaque bands and the transparent veil are checked. The former
below-camera exemption fails this regression; nearby floor fragments must clear
even when the camera banks differently from the ribbon. This is a visibility
test, not a GPU performance measurement.

### Performance modes

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
`--style=eyeball` wears one tile style on every face, `--style=eyeball,marble,…` one
per face (1–6, cycled); it is applied after the wizard and before Mobi's skip, so the
run's own warm-up sees it. The runner starts from the main menu with `?unlockall=1`
and the mode gate set (as `e2e/helpers.js` does), since a fresh save goes straight
into Story level 1 and a production build locks the larger boards.

Every run prints the warm-up's `renderer.compile` calls from the scramble (time
and links each), which happen before any measurement window. `frames` and
`attribute` print the slowest frames with the program links and React
commits they carried. `attribute` also names every `renderer.compile` call that
linked programs during the window (warm-ups that ran mid-play), with its caller.

| Mode | Output |
| --- | --- |
| `frames` | fps, script ms per frame (p50/p95/mean/max), draws, triangles, program switches, uniform calls, upload KB, shader links, React commit rate and the extra script time on frames that carry a commit, phase histogram, heap |
| `attribute` | render passes; draws and triangles per frame by owning component; uploads by attribute; materials that force three.js back through program selection every frame; every shader link attributed to the draw that triggered it |
| `react` | commit rates plus render counts per component (DOM root and R3F root) |
| `ab` | pauses the run so every window renders the same scene, then toggles in-page patches: **A** transparent double-sided materials in one pass, **B** instanced attributes upload only the live range, **C** hidden subtrees skip world-matrix updates, **D** inward-facing antipodal sticker backs hidden |
| `batching` | alternates individual tile meshes / three cage material groups with the production batches in one frozen scene; pins reduced FX and DPR 1; records draw ownership and optionally captures paired real-draw images |
| `census` | the scene graph three.js walks every frame: objects, objects under a visible chain, meshes and visible meshes, per owning component; also the scene's materials against its distinct shader sources |
| `tiletree` | the subtree of the first `--tiles=2` tiles StickerPlane mounted, object by object (type, name, hidden, owner); on a resting WORM board there are none |
| `restcheck` | runs the `events` fixture's flip and clear `--cycles` times and counts the objects StickerPlane owns 0.25 s and `--settle` ms after each, plus page errors: a flipped pair mounts its subtree and a cleared pair goes back to rest |
| `rewarm` | reruns the run's warm-up (`--cycles=5`) on a frozen board whose programs are all linked, the cost a retry pays; `--profile` adds CPU self time; use with `--freeze` |
| `turnshots` | films a slice turn frozen part-way (`--angle=0.6` rad) with real draws, from the player's camera and a fixed overview, into `--shots=dir`. `--turn=face` turns the face under the worm's head, `--turn=head:col` (`row`, `depth`) the layer through it, `--turn=col:0` (`:dir`) any layer; without it, it waits for a hazard turn |
| `swaps` | applies each whole-cube view power (`--views=view-glass,…`, default all) and restores it, twice each, and prints the worst frame of every change with its links and R3F commits; use with `--freeze` |

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
- The `run.mjs` surface workload does not deliberately enter tunnels; use `travel.mjs` below for in-cube traversal.

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

## In-cube travel

`travel.mjs` starts its own preview server (useful in isolated shell/network
sessions), stages a solved story board with a raised pair at the worm's head,
then calls the real portal-entry transition and records the complete ride.
Build with `vite.perf.config.mjs` first. It uses local `playwright-core`, or
`$PLAYWRIGHT`, and `$CHROMIUM` if supplied.

```bash
node scripts/perf-worm/travel.mjs --out=/tmp/travel.json
node scripts/perf-worm/travel.mjs --size=10 --out=/tmp/travel10.json
node scripts/perf-worm/travel.mjs --pairs=5 --patterns --shots=/tmp/travel-shots
node scripts/perf-worm/travel.mjs --size=6 --pairs=5 --patterns --mobile --shots=/tmp/travel-phone
```

The default is a seeded 3×3 board, one pair, full FX and a 1280×800 viewport.
`--mobile` uses a 412×915 touch viewport to inspect the portrait ride framing.
`--size=10` stages the same controlled fixture on a 10×10 board; `--pairs` adds other live connections.
The script asserts entry, every travel phase, survival and shader compilation.
Per-phase output includes CPU p50/p95, submitted draws/triangles and shader
links; raw instrumented frames are retained in the JSON. Draw suppression is
on by default; `--draw` measures real rendering on a GPU-equipped machine.
`--shots` pauses at three ride poses and enables real draws for screenshots;
those runs are explicitly marked and must not be used for timing comparisons.
`--shot-dpr=0.5` lowers only screenshot resolution for software WebGL.
Run before/after builds sequentially, without other benchmarks or builds running.

## Elemental ability smoke check

```bash
npx vite build --config scripts/perf-worm/vite.perf.config.mjs
CHROMIUM=/path/to/chrome node scripts/perf-worm/elements.mjs
```

Stages each of the six elements on an enemy-free 5×5 board using the production
simulation and pickup callbacks. It freezes each resulting pose, checks that its
bounded feedback batches draw, captures screenshots in `/tmp/worm-elements`
(override with `SHOTS`), and fails on JavaScript or shader errors. The fixed
camera is test-only. Software WebGL captures are visibility checks, not FPS data.
Use `ELEMENTS=air,fire` to capture only selected elements while iterating on effects.

### Core framing and sightline regressions

`node scripts/perf-worm/ride-framing.mjs` samples straight, bent and same-face
routes at 60 Hz. It reports projected head height during the middle half of the
core crossing, maximum aim/rotation step and head framing. These are geometry
measurements, not rendered screenshots or frame-rate measurements.

`CHROMIUM=/path/to/chrome node scripts/perf-worm/core-sightline.mjs` checks the
production shell and mirror cutout shaders in WebGL. It checks the sight corridor,
its bounded ends, adjacent intact walls and deactivation. It requires a host that
permits Chromium's local sockets.

The occupied lane now has a 0.12 world-unit minimum core width. The simulation's
recorded gauge, body-contact distance, tail-occupied ribbon and core aperture all
use that width; the unoccupied network still docks at individual tile width.
The close-up targets an 8% tall head with a 30-degree minimum FOV. Same-face routes
use a lateral camera offset and stable horizon, shared by entry and ride rails.
The offset stays inside the outer shell. A bounded camera-to-head cutaway prevents
the core wall from hiding the crossing head.

Path builders reuse arc tables only when all mouth positions, normals, docks and
core-center inputs match by value. Transported frames track the path version.
A local 20,000-call static 15x15 route microbenchmark took 94.5 ms rebuilding versus
1.7 ms cached; this does not predict whole-game FPS. This optimization is independent
of the unavailable external `mobius-ride-fixes.patch`, which has not been applied.
