# Resting WORM tiles mount nothing (2026-10-23)

Step 1 of taking the 15×15 board off the scene graph. Follows
`worm-large-board-styles-performance-2026-10-21.md`, whose "Still open" list
named the cause: about 17,000 objects, 12 per tile, walked by three.js every
frame (`updateMatrixWorld`, `projectObject`) even though almost every tile was
already drawn by a batch.

## What changed

A frozen 15×15 board, one tile at rest (`run.mjs --mode=tiletree`), before:

```
Group                      FlipPadOffset (pad offset, identity at rest)
  Group                    tile group (position, rotation)
    Group "sticker-antipodal-back"   batch anchor
    Group "sticker-front"            batch anchor
    Group (hidden)                   footprint group
      Mesh                           footprint
    Group "FlippedTileDecor"         empty
    Mesh (hidden)                    heal seal
    Mesh (hidden)                    heal sparks
```

Nine objects a tile, of which only the anchors' world matrices were ever used.

Now, in WORM, a tile whose every part is batched and that shows nothing else
**mounts nothing** (`StickerPlane` returns `null`):

- Its anchors are detached frames (`src/3d/tileFrames.js`): plain `Object3D`s
  whose `parent` is the cubie's content group but which are in nobody's
  `children`. three.js never walks them. The batch trackers walk up from them
  through `parent`, so they follow every writer: slice turns, raised pieces,
  the press, the artwork angle. `StickerPlane`'s `groupRef`, `innerGroupRef` and
  `backOrientationRef` point at the frames while it rests, so the frame-loop
  code that writes those groups is unchanged.
- `Cubie` hands each tile its content group through `frameHost`. A child's
  layout effect runs before the ancestor's ref attaches, so frames wait in
  `pending` until the ref callback adopts them.
- The worm's footprint is one transparent decal draw for the whole cube
  (`footprintDecalMaterial` in `src/3d/tileFootprint.js`). The press goes per
  instance (`aInstanceData.x`), and the colour, which is the worm's, goes on the
  shared material. This is a second, transparent pool on `TileSurfaceProvider`
  (`pool.decals`). Footprints never overlap, so one sorted draw gives the same
  picture as one draw per tile.
- A tile mounts its real subtree while it needs one: flip history or a pending
  flip, death, a closing portal, a volume style, a label, a texture, hollow,
  glass or biome. It also keeps it while a flip, shake, heal seal or sparks
  still play. When its tick goes idle it asks to rest through `queueTileRender`,
  a zero-delay timer outside the frame, never a state write inside it. A heal
  cue that reaches a resting tile promotes it first.
- A batch's mesh is now made when its first entry registers, not on its first
  visible frame. The run's warm-up compiles hidden objects, so the footprint
  decal links during the scramble. Batches with per-instance colour allocate
  the colour buffer with the mesh, so the program is not switched later. The
  heal seal and sparks are warmed explicitly (`healEffectMaterials.js`),
  because resting tiles no longer carry them hidden.

## Results

Container Chromium, software WebGL, draws suppressed, production perf build
(`scripts/perf-worm`). The numbers are main-thread CPU per frame. Base is
`main` at 6ed7ce92, measured in the same session on the same machine.

### Scene graph (`--mode=census`, frozen)

| 15×15 | Objects | Under a visible chain | Meshes | Visible meshes |
| --- | ---: | ---: | ---: | ---: |
| Eyeball, base | 17,258 | 10,545 | 5,149 | 122 |
| Eyeball, new | **5,110** | **3,803** | **1,100** | 122 |
| Solid, base | 17,241 | 10,529 | 5,132 | — |
| Solid, new | **5,093** | **3,758** | — | — |

`StickerPlane` and `HealParticles` no longer appear in the census at all. The
largest remaining owner is `Cubie`, with 3,534 objects (three groups per
surface cubie).

### Frame cost

| Run | p50 | p95 | mean | Frames over 16.7 ms |
| --- | ---: | ---: | ---: | ---: |
| 15×15 Eyeball frozen, base | 16.1 | 24.1 | 17.6 | 44% |
| 15×15 Eyeball frozen, new | **10.9** | **16.3** | **12.1** | **4%** |
| 15×15 Eyeball live 40 s, base | 15.3 | 25.1 | 16.7 | 34% |
| 15×15 Eyeball live 40 s, new | **10.7** | **18.2** | **12.0** | **6%** |
| 10×10 Eyeball frozen, base | 9.5 | 14.3 | 10.4 | 2% |
| 10×10 Eyeball frozen, new | **6.9** | 12.8 | **8.0** | 2% |
| 15×15 frozen, CPU ×4 (two runs), base | 101.5, 94.0 | 147.4, 125.2 | 107.9, 99.7 | 100% |
| 15×15 frozen, CPU ×4 (two runs), new | **74.3, 63.9** | **136.1, 102.1** | **86.0, 69.2** | 100% |

Frozen 15×15 profile, CPU self time over 12 s:

| | Base | New |
| --- | ---: | ---: |
| `updateMatrixWorld` | 3,147 | 1,450 |
| `projectObject` | 1,452 | 559 |
| `multiplyMatrices` | 568 | 287 |
| Batch upkeep (`update` + `refresh` + `track`) | 2,622 | 2,684 |

Single worst frames are noise in this environment. None of the outliers in
either build carries a shader link or a React commit. Across repeated runs the
largest frame went both ways:

- Live: base 124 ms, new 218 ms.
- Throttled ×4: base 188 / 192 / 398 ms, new 268 / 231 / 221 ms.

GC time in the throttled profile was lower in the new build: 202 ms against
388 ms over 12 s.

### Behaviour checks

- **Flip lifecycle** (`--mode=restcheck`, 3×3, events fixture, 2 cycles). Base
  keeps 440 `StickerPlane` objects mounted throughout. The new build mounts 20
  for the flipped pair and goes back to 0 once the clear's heal has played.
  No page errors.
- **Shader links per event** (`--mode=events`, 6 cycles). The links match base:
  pickup 0, wormhole 3 then 2, clear 0, show-worm 3. The first cycle's
  hide-worm links 4 instead of 2.
- **Draws** (`--mode=attribute`, 3×3). The two lit footprints were two draws;
  they are now one decal draw with two instances.
- **Slice turn frozen part-way** (`--mode=turnshots`, 15×15 Eyeball). The
  turning layer's tiles ride the turn and keep their style, with no black or
  missing layer.
- **Tests.** `restingTiles.test.jsx` covers:
  - a resting tile mounts nothing and is drawn where its cubie is, through a
    turn;
  - a styled tile rests;
  - the footprint lights one decal instance and sinks the sticker;
  - a flip mounts the subtree, and the heal returns it to rest;
  - a heal cue promotes a resting tile.

## Trade-offs

- **View powers that cannot rest** (glass, Sudokube numbers, grid labels)
  mount every tile's subtree on the swap. That is the same work every tile did
  at mount before this change. Swaps to looks that stay batched (classic,
  chrome, neon) no longer mount anything.
- **Heal seal and spark programs** are no longer in the live scene at the
  scramble. They are warmed explicitly instead.

## Step 2: batch upkeep (2026-10-24)

After step 1 the largest cost on a resting 15×15 was keeping the batches
current: both trackers compared every anchor's transform every frame, and
1,178 cubies each ran a frame callback that almost always returned at once.

- **Frame versions** (`frameWorldVersion` in `tileFrames.js`). A tile's frames
  carry a `version` that every writer bumps: its tick, its layout effects and
  `poseTileFrames`. The tile-surface batches and `StickerInstances` recompose a
  resting anchor only when that version or its cubie's tracker version changed.
  Mounted tiles still go through the tracker.
- **One frustum test per resting tile.** The test runs against a 0.8-radius
  sphere that holds all of the tile's parts (`tileInView`), instead of one per
  entry. An entry also keeps its batch until its draw order changes or the pool
  is disposed (React StrictMode reuses disposed pools).
- **One cubie callback** (`src/3d/cubieTicks.js`). `CubeAssembly` runs every
  cubie's lift, kick and pop offsets from one frame callback at -0.41 (WORM)
  or -0.75. That is after live expansion, and before tunnel anchors and pad
  stalks. The callback visits only the cubies that are moving. A raised piece
  wakes itself from its own render. Any kick, pop or burrow on the board ticks
  every cubie that frame, as before. A `Cubie` mounted without the provider
  (previews, tests) keeps a callback of its own.
- **Hidden combat rigs.** `CombatScene`'s pooled rigs, about 600 objects, skip
  matrix updates while hidden (`skipMatrixWhileHidden`).

Same session, same machine. Base is `main` with step 1 (91eca879). CPU ms per
frame:

| Run | Base p50 / p95 / over 16.7 ms | New p50 / p95 / over 16.7 ms |
| --- | --- | --- |
| 15×15 Eyeball frozen | 11.9 / 17.9 / 10% | **7.9 / 11.7 / 2%** |
| 15×15 Eyeball live 40 s | 12.0 / 18.2 / 8% | **11.4 / 16.7 / 5%** |
| 15×15 Eyeball frozen, CPU ×4 | 64.2 / 100.5 | **55.5 / 87.3** |
| 10×10 Solid frozen | 7.1 / 12.3 / 2% | 7.0 / 12.0 / 1% |

Frozen 15×15 profile, CPU self time over 12 s:

| | Base | New |
| --- | ---: | ---: |
| Tracker `refresh` | 1,157 | 388 |
| `track` | 475 | out of the top |
| `updateMatrixWorld` | 1,551 | 933 |
| Cubie frame callbacks | 393 | gone |

The live run gains less: turns, the worm and its effects dominate it. The
following all match step 1:
- the flip lifecycle (`restcheck`): 20 objects for a flipped pair, 0 after
  the heal;
- shader links per event;
- a mid-turn 15×15 shot;
- live 3×3 and 5×5 play with no page errors.

## Still open

- **The batch loop still visits every entry each frame**, about 1.5 ms on a
  resting 15×15. It rebuilds each batch densely so culled tiles leave no gaps.
  Stable slots with zero-scale culled instances would let still frames skip
  the loop body.
- **`Cubie` keeps three groups per surface cubie**: 3,534 objects on a 15×15
  that three.js composes every frame.
- **The GPU is still unmeasured.**
