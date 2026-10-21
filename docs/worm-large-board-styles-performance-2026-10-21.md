# WORM on large boards with intricate tile styles — 21 October 2026

This pass measured WORM free play on 10×10 and 15×15 boards wearing the
intricate tile styles (Eyeball, Marble, Bowler Rain, Amoeba Mosaic, Hopf Fibers,
Endless Stairs), found where the frame goes, and fixed the largest costs.
Nothing looks different: the same shaders draw the same tiles.

## Method

`scripts/perf-worm` drives a real Free Play run in headless Chromium. Every run
below is an unminified production build (`vite.perf.config.mjs`), 1280×800,
`--seed=71`. "Frozen" runs pause at the start of active play so every window
renders the same scene. Live runs play the run for 40 s, with slice turns,
pickups, deaths and retries. Base and new builds were served side by side and
run alternately in one session, so compare within a row, not across rows: the
container CPU drifts between sessions.

WebGL is SwiftShader here, so draw calls are suppressed and **every number is
main-thread CPU per frame, not GPU time or device FPS**. The draw-call counts are
exact. A real phone pays a driver cost per draw on top of what is shown here, so
the draw reductions matter more on a device than the CPU columns suggest.

The harness gained what this needed (README updated):

- `--style=` wears a tile style on every face, or one per face.
- The menu navigation follows the current first-launch flow (`?unlockall=1`).
  The old flow had stopped working since new saves started going straight into
  Story.
- `--mode=census` counts the scene graph three.js walks each frame, per owner.
- `--mode=swaps` times whole-cube look changes (view powers).
- `frames`/`attribute` print the slowest frames with their links and commits,
  and `attribute` names any `renderer.compile` that linked mid-play.

## What was wrong

**1. Every styled tile was its own draw, twice.** Solid tiles were already one
instanced draw for the whole cube, and solid antipodal backs another. A tile
wearing any other style drew its front through its own mesh, and its inward-facing
antipodal back through another. The style's shared material needs the tile's
identity (`tileHome`, `tileFace`) bound per draw. Draws per frame, frozen scene:

| Board | Solid | Eyeball |
| --- | ---: | ---: |
| 10×10 | 64 | 492 |
| 15×15 | 66 | 1,058 |

Uniform calls went from about 340 to 2,400 (10×10) and 5,200 (15×15). The backs
face into the cube, so the GPU culls every one of them; the CPU still paid a
full draw for each.

**2. The scene graph three.js walks every frame.** On a frozen 15×15 the scene
held 21,242 objects, 13,500 of them from `StickerPlane` (10 per tile), and 31%
of them under hidden branches. three.js recomposes every object's matrices
every frame, hidden or not. A parent's forced update overrides
`matrixWorldAutoUpdate`, so the flag can't opt an object out. Profiled on that
scene, `updateMatrixWorld` was 27% of the frame and `projectObject` 13–15%. The
per-tile objects were:

- the always-mounted, always-hidden effects (footprint group and mesh, heal
  seal, heal sparks);
- one anchor group each for the tile border and, for solid tiles, the
  antipodal back.

Each heal-sparks mesh also had its own frame callback: 1,350 idle subscriptions
a frame on a 15×15.

**3. The tile-surface batches' own upkeep.** Each batch entry asked the
transform tracker two separate questions (is it visible, has it moved). Each
question walked the entry's ancestors through a WeakMap, and the ancestors are
per tile as well. Each entry also:

- re-ran the frustum test's sphere transform every frame, though the tile had
  not moved;
- re-parsed its colour from a hex string with a regex every frame.

On a solid 15×15 that came to about 6–10 ms a frame, profiled.

## What changed

- **Styled tiles join the batches** (`src/3d/styles/instancedTileStyle.js`).
  - `instancedTileStyleMaterial(source)` is a style's *instanced twin*: the same
    shader, rewritten to place by `instanceMatrix` and to read the tile's
    identity from `aInstanceData`. It shares the source's uniform objects, so it
    animates, recolours and reacts to spin and gaze with the source.
  - In WORM, a styled tile at rest draws its front through the tile-surface
    batches, and every antipodal back does the same. A tile that has flipped,
    or is about to, keeps its own mesh, because the flip swaps that mesh's
    material frame by frame.
  - The rewrite is the one the in-cube room already used, now shared
    (`interiorTileBatches.js` calls the same helper).
  - A 15×15 in Eyeball is 82 draws a frame, down from 1,058.
- **No anchor objects per tile.** `StickerPlane` registers its own groups as
  batch anchors:
  - the inner group for the front;
  - the orientation wrapper for the back;
  - the tile group for the border, whose 0.012 lift is now baked into the
    shared border geometry.

  It does this from its own layout effects, because a child's effect runs
  before an ancestor's ref attaches.
- **Hidden effects skip matrix work** (`src/3d/hiddenMatrices.js`).
  `skipMatrixWhileHidden` replaces an object's `updateMatrixWorld` with one
  that does nothing while the object is hidden. The renderer's update runs
  before the draw, so an effect is current in the frame it is shown. The
  footprint, heal seal and heal sparks use it.
- **Heal sparks have no frame callback.** `HealParticles` exposes `step(delta)`
  and `active()`. The sticker's existing tick drives them and stays awake while
  they burn.
- **Leaner batch upkeep.**
  - `tracker.track(object)` answers both questions in one walk with one cache
    lookup, and skips matrix work on hidden branches.
  - Each entry caches its world bounding sphere until it moves.
  - A colour given as a string is parsed only when it changes.
  - The cubie-body batches use the same tracker path and sphere cache.
- **View-power swaps keep their materials.** See the swap results below.
- **Warm-up for what batching removed from the scene.** The scramble warm-up
  used to find every styled tile's own mesh in the live scene. Those meshes are
  now batched, so `WormEffectWarmup` compiles each equipped style, and its
  portal-bored copy, explicitly (`styleWarmup`). The first flip of each style
  therefore still links nothing.

## Results

### Frozen scene (same scene every window), CPU ms per frame

Two alternating rounds per row, base then new; p50 / p95 for each round.

| Board, style | Base p50 / p95 | New p50 / p95 | Draws, base → new | Frames over 33 ms, base → new |
| --- | --- | --- | --- | --- |
| 15×15, Eyeball | 36.4 / 52.6, 41.7 / 56.8 | **26.0 / 40.2, 25.4 / 41.5** | 1,125 → 82 | 80–98% → 15% |
| 15×15, Solid | 36.7 / 56.0, 38.4 / 56.6 | **25.1 / 39.7, 27.2 / 41.0** | 66 → 66 | 74–87% → 16–18% |
| 10×10, Eyeball | 19.4 / 31.3, 21.3 / 31.6 | **16.5 / 25.6, 14.9 / 22.8** | 535–579 → 79 | 2–3% → 2% |
| 10×10, six intricate styles | 23.1 / 32.7, 20.0 / 30.7 | **18.1 / 24.7, 15.3 / 25.8** | 483–527 → 80–86 | 2–4% → 0–3% |
| 10×10, Solid | 18.7 / 30.3, 18.3 / 28.7 | **16.3 / 26.1, 16.5 / 23.8** | 63–70 → 64–70 | 1–2% → 0–1% |
| 5×5, Lava | 12.4 / 20.1, 12.1 / 18.6 | **9.0 / 17.6, 8.7 / 16.2** | 367 → 73–79 | 1–2% → 1% |
| 5×5, Eyeball | 9.7 / 17.4, 9.7 / 14.4 | **8.6 / 11.4, 9.2 / 14.0** | 367 → 79 | 0–1% → 0% |

Uniform calls a frame on the 15×15 Eyeball scene went from 4,850–5,491 to 344.

The six intricate styles are Eyeball, Marble, Bowler Rain, Amoeba Mosaic, Hopf
Fibers and Endless Stairs, one per face. Solid boards gain from the object and
upkeep work alone; they had no styled draws to remove. On 5×5 the adaptive tier
was in reduced FX, which drops the 3D volume meshes (lava, ice and the rest), so
the Lava row measures the flat Lava style.

Scene graph on the frozen 15×15 Eyeball scene (`--mode=census`):

| | Base | New |
| --- | ---: | ---: |
| Objects walked by `updateMatrixWorld` | 21,242 | 17,204 (about 4,000 of them now skip it while hidden) |
| Objects under a visible chain (`projectObject`) | 14,577 | 10,527 |
| Visible meshes | 2,808 | 120 |

### Live play, 40 s (slice turns, pickups, deaths and retries)

| Run | CPU p50 / p95 / max (ms) | Frames over 33 ms | Draws | Uniform calls | Links mid-play |
| --- | --- | --- | ---: | ---: | --- |
| 10×10, six intricate styles, base | 36.0 / 52.5 / 123 | 67% | 656 | 2,787 | 14, two of them on styled stickers |
| 10×10, six intricate styles, new | **25.4 / 37.6 / 100** | **12%** | **127** | **665** | 13, none on stickers |
| 15×15, Eyeball, base | 79.6 / 120.1 / 503 | 100% | 2,749 | 13,900 | 6 |
| 15×15, Eyeball, new | **39.8 / 63.1 / 407** | **90%** | **77** | **282** | 11 |

Live runs are not identical scenes: the worm plays, dies and retries. The worst
frame of both 15×15 runs is the scramble's own planned warm-up compile (below),
not active play.

### View-power swaps (15×15 Eyeball, frozen)

A view power changes the whole cube's look for 20 seconds, then restores it. On
`main` both the change and the restore relinked 2–4 programs every time, on
every pickup and every expiry:

- the antipodal core rebuilt its materials for each look and disposed the old
  ones, and its stickers' material too, which never depends on the look;
- the 15×15 Mega chassis made a new JSX material per look.

A disposed material releases its program, so returning to a look linked it
again. Both now keep one material per look for their lifetime (`VoidCore.jsx`,
`megaViewMaterial` in `CubeAssembly.jsx`). As a side effect, the core's
instanced meshes are no longer rebuilt on a swap.

Every view power was applied and restored, twice over (36 changes):

| | Links, first cycle | Links, second cycle | Median worst frame | Worst frame |
| --- | ---: | ---: | ---: | ---: |
| Base | 56 | 54 | 105 ms | 399 ms (LEGO) |
| New | 10 | 4 | 77 ms | 270 ms (LEGO) |

The links left in the second cycle come from per-cubie materials that `Cubie.jsx`
builds for the LEGO and glass looks (see Still open).

## Still open

Updated after the follow-up below.

- **Small mid-play links remain.** Each tunnel band links its mirror-capture
  variants when it forms (`warmMirrorPrograms`, 2–6 links, 2–4 ms here), and a
  severed tail and the first special orb of a kind link one each. The first use of
  some view looks still links 1–2 programs (the classic chassis, the grid
  instanced quad, the core's wireframe body); later swaps do not.
- **A view-power swap re-renders every sticker**, 50–150 ms on 15×15. Reading
  the view mode in the frame loop instead of through props would remove that.
- **15×15 is still bound by the scene graph.** About 17,000 objects, 12 per tile.
  The rest are structural groups the flip and pad animations write to, plus
  3,534 cubie objects. `updateMatrixWorld` and `projectObject` remain the
  largest costs, then 1,178 per-cubie frame callbacks (about 1 ms) and the
  surface-batch upkeep.
- **The first scramble still links ~225 programs** before play, spread over 16
  compile calls (the longest now ~60 ms here). On real GPUs the link itself
  happens off the main thread, but the first draw of each program can wait for it.
- **Volume styles below 6×6.** Lava, ice, water, galaxy, neural, circuit, wood
  and grass add 1–3 meshes per tile in full FX on boards up to 5×5 (up to 450
  draws on 5×5). They are already dropped on 6×6 and up, and under reduced FX.
- **The GPU is unmeasured.** Every number here is main-thread CPU on software
  WebGL. The draw reductions will matter more on a phone than the CPU columns
  show. The intricate styles are long fragment shaders (Eyeball is about 22,000
  characters and ray-traces its socket), so a full-screen view of one on a
  mid-range phone may be fill-bound regardless of draw count. Check on a device
  with `--draw` and `scripts/perf-worm/run.mjs --style=eyeball`.

## Verification

- Unit tests:
  - `instancedTileStyle.test.js`: every one of the 171 styles reads its
    identity per instance.
  - `styledStickerBatch.test.jsx`: a styled tile is batched at rest, moves to its
    own mesh for a flip and back after healing, and is never drawn twice.
  - `viewSwapMaterials.test.jsx`: a look's core materials survive swaps and are
    released on unmount. It fails against the old `VoidCore`.
  - `wormEffectWarmup.test.jsx`: the style warm-up.
  - Updated: `tileSurfaceRender`, `scrambleTileContinuity` (8×8 and 15×15 turns
    through commit), `wormFlipPortalRender`.
- Real WebGL: all 171 styles compiled and linked as source, instanced twin and
  portal-bored instanced twin (513 programs), with no shader errors.
- Full suite: 432 files pass. Lint has no errors. `npm run build` and
  `bundle:check` pass.
- Screenshots of a 6×6 board in the six styles, from both builds, show every
  style drawn with its per-tile variation. The two runs drew different palettes,
  so they are a visual check, not a pixel diff.

## Follow-up: Mega face turns, the warm-up, and view swaps

Same day, measured against `main` at `fb5b888` (this pass's first part merged),
with the same harness and method. Two new probes:

- `--mode=turnshots` films a slice turn frozen part-way with real draws. It
  pauses GSAP, which the perf build now exposes, with the live rotation.
- `--mode=rewarm` reruns the run's warm-up on a board whose programs are
  already linked, which is what a retry pays.

Every run also prints the warm-up's compile calls from the scramble.

### Black tiles on Mega face turns

During a turn, the 15×15 chassis is split into static slabs and a band box that
spins with the turning layer. Along the turn axis the band spanned the whole
layer (`idx − k ± 0.5`). For a face layer, that put the band's outer face at
±7.5, past the resting chassis face at ±7.46:

- A flat sticker's front (7.51) sat only 0.01 in front of it, in z-fighting
  range at grazing angles.
- A sticker the worm presses sinks to about 7.478, behind the band.

So on every face turn under the worm, its tiles drew black. Filmed mid-turn,
they were black on `main` and on the batching build alike; 10×10, which has
no chassis, never showed it. The layout is now `megaChassisLayout`
(`src/3d/megaChassis.js`): every piece is cut to the resting box's extent.
`megaChassis.test.js` holds that, along with the press margin and exact tiling
of the box. It fails on the old layout. Filmed again, the worm's tiles on the
turning face keep their style.

### The warm-up walked ~4,600 materials

The run's warm-up compiles the whole scene, plus the off-screen variant on
desktop, while the board scrambles. On 15×15 the scene held 4,610 materials,
but only ~540 distinct programs. The footprint, heal seal and heal sparks each
built a `ShaderMaterial` per tile. Every one of those is a program-key
computation for `renderer.compile`, and an entry in three.js's bookkeeping.

Changes:

- **One material per effect** for every tile (`src/3d/sharedEffectMaterials.js`).
  Each tile keeps its own uniform values and copies them in from its mesh's
  `onBeforeRender`, just before its own draw. A hidden effect is never drawn,
  so only the few tiles showing one pay for the copy.
- **The warm-up compiles one stand-in per material and object variant**
  (`compileDistinct`, `src/3d/compileDistinct.js`): instancing, instance colour,
  geometry attributes and the other inputs three.js r159 reads from an object.
  Each stand-in is a shallow copy of its object, with no children, so the compile
  never re-walks a subtree. On its own this changed nothing, because nearly
  every material was per tile. With shared materials it keeps the walk small.

| 15×15 Eyeball | `main` | This change |
| --- | ---: | ---: |
| Materials in the scene | 4,610 | **557** |
| First scramble: warm-up compile time, all calls (two runs) | 504, 716 ms | **232, 264 ms** |
| First scramble: longest single compile | 212, 402 ms | **64, 65 ms** |
| Retry: scene pass, programs already linked (8 retries) | 84–156 ms | **13–41 ms** |
| Retry: off-screen pass | 89–152 ms | **17–59 ms** |
| Live 40 s: worst frame (a retry's warm-up on `main`) | 358 ms | **118 ms** |

The number of links is unchanged (~225 before play), and mid-play links did not
rise (8 on `main`, 6 here, in matched 40 s runs).

### View swaps

- **LEGO studs are batched** (`src/3d/legoStud.js`, `LegoStud` in `Cubie.jsx`).
  Every stud was three meshes with their own geometry and material: on 15×15,
  ~4,000 of each, built on each swap to LEGO, freed on its restore, and drawn
  one by one. The studs now draw through three tile-surface batches (shared
  geometry, shared white material, instance colour per face). The batches carry
  the anchor's `castShadow`, so studs still cast shadows in full FX.
  `legoStudBatch.test.jsx` holds this.
- **The Glass and LEGO programs are held by the run's warm-up.** That covers the
  sticker's bare and portal-bored glass, and the bored stud batches. Glass
  clones are freed on every restore, and used to release their programs.

| 15×15 Eyeball, every view applied and restored twice (36 changes) | `main` | This change |
| --- | ---: | ---: |
| Links, first / second cycle | 10 / 4 | 6 / 1 |
| LEGO swap, worst frame | 239–365 ms, 1 link each | **55–79 ms, none** |
| Worst swap frame | 365 ms | **148 ms** |

### Steady state, and a regression the stand-ins caused

The first steady-state A/B showed 10×10 Eyeball about 3 ms a frame slower than
`main` (p50 18.6, 18.8 ms against 15.3, 16.1). The two scenes were identical:
8,628 objects, the same owners, the same visible counts. Only the material count
had changed (2,839 → 1,042). A profile showed every scene walk about twice as
slow per frame: `updateMatrixWorld`, `projectObject` and the batch trackers alike.

The cause was the stand-ins. Each was built with `Object.create(liveMesh)`, and
V8 gives any object that becomes a prototype a map of its own, for good. A few
hundred meshes with unique maps turned every loop over the scene megamorphic for
the rest of the run. In isolation, with 300 of 5,800 meshes used as prototypes,
an `updateMatrixWorld` plus `traverseVisible` walk went from 1.2 to 3.9 ms.

A stand-in is now a shallow copy on its object's class prototype, so no live
object is ever a prototype. Emptying the live objects' `children` during the
compile would also avoid the walk, but it is wrong: `compile` collects lights by
walking the live target scene, and would miss any light under an emptied mesh.

Re-measured in alternating order (new, base, base, new, new, base), frozen,
seed 71, 8 s each, CPU ms per frame:

| p50 (three runs each) | `main` | This change |
| --- | ---: | ---: |
| 10×10 Eyeball | 13.6, 13.1, 13.9 | 13.6, 14.1, 13.3 |
| 15×15 Eyeball | 23.9, 24.0, 24.8 | 21.6, 22.0, 25.5 |

Steady-state cost is at parity on 10×10 and slightly lower on 15×15. Draws are
unchanged (79 and 81–82). The earlier, sequential A/B always ran `main` first.
This one alternates, which is why its absolute numbers differ from the first.

### Verification

- **New tests:**
  - `megaChassis.test.js` (fails on the old layout).
  - `sharedEffectMaterials.test.jsx`: one material per effect across tiles, each
    tile drawing its own values.
  - `compileDistinct.test.js`: one stand-in per variant, each a copy on its
    object's class prototype, and the live scene untouched.
  - `legoStudBatch.test.jsx`.
- **Updated tests:** `wormEffectWarmup.test.jsx` covers stand-ins, plus held
  Glass and LEGO programs that are released on exit.
- **Real draws:** a frozen 15×15 face turn under the worm, filmed with real
  draws before and after the fix.
