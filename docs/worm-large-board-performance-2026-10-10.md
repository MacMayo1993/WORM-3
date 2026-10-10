# WORM large-board performance and camera distance — 10 October 2026

Players on the 10×10 levels of chapter 5 (levels 44–49) reported stutter. This pass
measured those boards with the `scripts/perf-worm` harness, fixed what it found
without changing how anything looks, and added a player camera-distance setting.

## What was wrong

**Steady cost: the WORM cubie shells.** Every WORM body is a transparent,
double-sided rounded box, and each surface cubie had its own mesh and material.
three.js draws that combination in two passes and flags `material.needsUpdate`
before each, so every body went back through program selection twice a frame.
On a 10×10 (488 surface cubies) the bodies were 845 of 903 draws per frame, 1.09M
of 1.65M triangles, and 845 program re-selections, the frame's largest CPU cost.
Mega (15×15) never had this, because it replaces bodies with one chassis, so a
10×10 could run worse than Mega.

**Steady cost: the transform trackers.** The sticker, tile-accessory and (now)
body batches re-check every anchor's transform each frame. The comparison loop
re-read `object.position`, `quaternion`, `scale` and `matrixAutoUpdate` per
component. Those are megamorphic property loads on Object3D subclasses, and with
thousands of anchors this was the next-largest cost after the shells.

**Stutter: shader programs linked mid-run.** The large one-off frames during
active play each carried a burst of program links:

| Moment | Links | Cause |
| --- | ---: | --- |
| First flipped tile / tunnel of a run | 23 | The cube exterior patches every material with the portal bore (`exteriorPortals.js`), a different program. `WormEffectWarmup` warmed the *unpatched* versions. |
| First elemental orb | 9 + 7 | The arrival dissolve (`orbReveal.js`) patches the orb's materials; the warm-up compiled only the settled ones, and only once on mount, before fog and environment settled. |
| Every slice warning | 1 | The warning rim's material is disposed with each warning, so its program was released and relinked. |
| Caution fall | 7 | The fall dissolve patches every worm material at the moment of the fall and disposes them after. |
| First pad / wormhole ring / burrow | 1–3 each | Pooled instanced meshes create their colour buffer on first `setColorAt`, which switches program variant after the run-start compile. |

## What changed

- **Batched WORM shells** (`src/3d/cubieBodyBatches.js`, `CubieBodyBatches.jsx`):
  one `InstancedMesh` per body look, same geometry and material, so three.js
  still draws back faces then front faces. Instances are written far to near
  (the painter's order the meshes had) and frustum-culled per instance. The
  cubie keeps an invisible mesh of the same shape as the transform anchor and
  pointer target. Raised pieces (the 0.16 window) keep their own mesh.
- **Tracker**: reads each transform once into locals and caches per-frame
  visibility in the same map. The tile-accessory batch key is built once per
  entry instead of per tile per frame.
- **Warm-up compiles what is drawn**: portal-patched copies of the flip
  effects, borders, raised sticker and shell, sticker worms and health bar
  (`exteriorPortalWarmupMaterial`); orb arrival variants, returned to the reveal
  pool (`warmOrbReveal`); the caution-fall dissolve (`warmCautionDissolve`, kept
  resident); the slice-warning rim. The elemental skins join the keyed warm-up,
  so they recompile when fog or environment change. The live scene, hidden
  pools included, is compiled once per run while the board scrambles. Pooled
  meshes allocate their colour buffer up front (`ensureInstanceColor`).
- **Idle combat pools** (`CombatScene`) are memoised. They re-rendered ~40 idle
  rigs on every scene commit.

## Visual check

A same-frame A/B on a frozen 10×10 (batched shells against the original
per-cubie meshes, toggled in the page, real draws) differs only where render-only
animation moved between captures: orbs, the slice-warning sweep and background
stars. On an orb-free region the mean pixel difference was 0.1/255.

## Results

Measured with `scripts/perf-worm` on unminified production builds of `main`
(`dbcd50f`) and this change. Each pair was run back to back in the same session:
a frozen seeded scene (`--freeze --seed=71`), 1280×800, draws suppressed, so
these are CPU milliseconds per frame, not GPU time or device FPS. The container
CPU varies between sessions, so compare within a row, not across rows.

| Frozen scene | Draws / program switches per frame | Script p50 / p95 (ms) |
| --- | --- | --- |
| 10×10, main | 746 / 775 | 41.0 / 46.5 |
| 10×10, this change | 62 / 78 | **13.7 / 22.5** |
| 10×10, 4× CPU throttle (phone proxy), main | 820 / 849 | 231.6 / 304.8 |
| 10×10, 4× CPU throttle, this change | 63 / 78 | **95.0 / 127.2** |
| 15×15 Mega, main (two runs) | 42 / 70 | 51.9, 49.2 / 63.8, 68.8 |
| 15×15 Mega, this change (two runs) | 62–69 / 77 | **42.4, 37.4** / 70.2, 51.3 |
| 5×5, main | 237 / 265 | 14.4 / 24.2 |
| 5×5, this change | 62 / 78 | **8.6 / 15.9** |

Stutter, from 40 seconds of live 10×10 play (`--mode=attribute`, frames in
active play only), before and after the warm-up fixes:

| | Program links | Worst frame | Frames over 100 ms |
| --- | ---: | ---: | ---: |
| Before | 53 | 259 ms | 2 |
| After | 5 | 81 ms | 0 |

## Camera distance

`wormCameraZoom` (`src/worm/wormCameraZoom.js`) is a persisted multiple of the
chase framing (0.85–2×, default 1.2×, a fifth further back than before). It
scales the height, setback and portrait rake together, so the pitch is kept. It
is set from Pause → Controls, camera & sound, from Settings → Scene, and with
the mouse wheel while crawling. The camera reads it each frame and eases to it.

On desktop the chase used to re-aim at the cube's centre every frame. On boards
from about 7×7 that centre is far below the surface, so the lens pitched into the
face and the worm sat at the top edge with the path ahead under the HUD. Boards
from 6×6 now blend the aim toward the head (`desktopHeadFraming`), which is
centred from 8×8, as it already was on phones. Small cubes keep the whole-board
composition.

## Still open

- **Mega's scene graph.** 15×15 is now bound by object count (≈21k objects):
  three.js `updateMatrixWorld` and `projectObject` walk them all each frame, about
  37% of them in hidden subtrees (per-sticker effect meshes kept mounted so their
  programs stay compiled). Fewer objects per sticker, or skipping hidden effect
  subtrees, is the next lever.
- **Small first-use links**: a new parity-orb look's arrival variant (3) and the
  first non-elemental special orb of a kind (2) still link on first spawn.
- **GPU side** is not measured here (software WebGL). The shells are still about
  1M triangles on a 10×10; the batch culls per instance, as before.
