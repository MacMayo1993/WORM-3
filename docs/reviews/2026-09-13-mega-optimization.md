# Mega mode optimization review — 13 September 2026

## Result and limits

Restore the complete parity orb on Mega: the glass shell, energy core, inner glow, crossed parity halos, opposite poles and connecting axis, Möbius band, and orbital rings. Keep the existing reduced trail/hazard budgets and adaptive render resolution. Do not reduce orb population or visible orb detail to fund this change.

This is a source review plus reproducible CPU tests, not a mobile GPU profile. It covers cube/sticker rendering, parity orbs, the worm body and camera, simulation/rotation updates, trails, bombs, elemental patches, previews, material ownership and adaptive quality. Actual frame rate, GPU time, thermal behavior and transparency sorting still require device testing. Restoring eleven meshes per visible orb costs more than the previous single-gem fallback; the changes below do not prove that all of that cost is recovered.

## Changes included

- `src/worm/healerWorm/fxBudget.js`: Mega retains full orb detail. Correct the stale area-scaling explanation: current preset populations scale with edge length and are capped at 96.
- `src/worm/orbVisibility.js` and `ParityOrb.jsx`: compute one conservative bounding-sphere visibility check per orb. Placement still updates every frame, including live cubie rotations; fully off-screen orbs skip their decorative animation and render-list traversal. Visible orbs retain every part. Absolute-time animation resumes at the current phase. Parent transforms and camera changes are rechecked, with no delayed visibility cache. Main-camera culling is disabled when antipodal PiP is enabled, so the second camera keeps its orbs.
- `src/worm/orbMaterials.js`: retain shared, resident shader materials, but separate elevated/rainbow and Glow Worm states from normal materials. Previously, elevated orbs could write colors into materials also used by ordinary orbs. Use a common clock for shared uniforms while preserving individual mesh-motion phases. Do not animate the cached sticker material used on a patterned Möbius band. Make the plain Möbius band double-sided.

## Quantitative checks

A 15×15 cube has 1,350 surface stickers and 1,178 surface cubies. Current default Mega populations are Easy 60, Medium 50 and Hard 40. A complete non-target orb has eleven mesh parts, so those populations contain 660, 550 and 440 orb mesh parts respectively, before visibility checks. These are scene-graph counts, not captured GPU draw calls.

`node scripts/bench-orb-visibility.mjs` uses a deterministic distribution across six faces and a fixed portrait camera. It measures only visibility-check CPU work:

| Preset | Total orbs | Visible spheres | Decorative updates skipped | Sphere checks, ms/frame |
| --- | ---: | ---: | ---: | ---: |
| Easy | 60 | 26 | 34 | 0.0020 |
| Medium | 50 | 22 | 28 | 0.0024 |
| Hard | 40 | 17 | 23 | 0.0010 |

For Easy, that reduces the candidate orb-part traversal from 660 to 286. Three.js already culls individual meshes, so this is **not** a claim of 374 fewer GPU draws. It saves orb animation work and avoids descending into entirely off-screen orb groups. Savings vary with camera direction, orb distribution and PiP use; a broad overview may retain every orb.

The existing `node scripts/bench-worm-path.mjs` confirms that direct history reads already outperform copying a path first. At 1,200 segments this run measured 0.0446 ms for direct reads versus 0.0497 ms for copying. That isolated desktop CPU result does not measure body rendering or justify rewriting rotation/history logic.

## Prioritized remaining opportunities

| Priority | Area and evidence | Recommended next change | Verification needed |
| --- | --- | --- | --- |
| High | `WormPreviewRenderer.js` renders and synchronously reads back a 640×640 image for the character preview, targeting 60 Hz. Raw RGBA readback alone is about 93.75 MiB/s, before row copying, drawing to the 2D canvas and rendering cost. | Render the large preview directly through a viewport/scissor in the existing WebGL context, keeping thumbnail readbacks separate. Preserve sharpness rather than reducing its resolution again. Avoid creating a second mobile WebGL context. | Compare CPU stalls and p95 frame time while switching characters, skins and hats. Check DOM clipping, scroll alignment and renderer-state restoration. |
| High | Full parity orbs repeat eleven parts per pickup. Visibility checks cannot save work for genuinely visible orbs. | Batch compatible solid-color parts by geometry/material with instancing, or merge fixed parity-marker parts with vertex colors. Keep patterned bands and transparent shells separate until their sorting is verified. | Compare actual render calls/GPU time against this full-detail baseline; verify overlap, all six face colors, elevated orbs, patterns, PiP and tunnels. |
| High | `StickerInstances.jsx` scans registered stickers and calls `updateWorldMatrix(true, false)` per active sticker each frame. It already avoids unchanged GPU uploads, but repeated parent traversal remains on a 1,350-sticker board. | Introduce transform epochs/dirty ranges, or update shared ancestry once before reading leaf matrices. Preserve the existing frame ordering for rotations and flip effects. | Exercise multi-layer rotation, mid-turn crossings, squash/tremor, reactivation and recycled slots. A stale-matrix shortcut risks the rotation glitches already fixed. |
| Medium | `TilePreviewRenderer.js` budgets initial dirty thumbnails, but its animated-visible pass can still render many thumbnails; `TilePreviewHost` runs tile, cube and worm preview budgets independently. | Coordinate a frame budget across preview types and prioritize the focused hero over decorative thumbnails. Keep off-screen preview visibility tracking. | Measure opening a large style grid and rapid scrolling; verify thumbnails eventually refresh and the hero does not stutter. |
| Medium | `WormTrail.jsx` rebuilds up to 1,400 Mega daubs at 30 Hz, with every-frame updates while rotating. | Separate structural path edits, live-rotation transforms and color/opacity animation. Cache unchanged trail sections where possible. | Long-run path wrap, cuts, tunnel entry/exit and rotating layers; compare output with the existing trail. |
| Medium | Orb material variants are retained permanently. The tile-style LRU disposes entries without tracking whether a visible mesh still uses them. | Add ownership-aware cache retirement at safe lifecycle boundaries. Keep active materials pinned to avoid shader relinking while playing. | Repeated palette/character/style switches; record renderer memory/program counts and context-loss behavior. |
| Lower | `HealerBombs.jsx` maps IDs and searches the live bomb array on membership changes. `useWormCrawler.js` counts grass patches every tick. Both are bounded/smaller than the rendering costs above. | Consider keyed bomb lookup and a patch-membership counter only if profiling shows meaningful time here. | Bomb removal/explosion callbacks and grass-patch expiry/reset. Do not add bookkeeping without measured benefit. |

## Existing optimizations to preserve

- Mega omits individual rounded cubie bodies and uses a chassis that follows moving bands; fully interior cubies are not mounted.
- Simple stickers are instanced and only changed matrix/color buffers are uploaded.
- Orb React trees are memoized and animated through one frame callback.
- Worm body history uses direct cursor reads, distance LOD and capped glow halos.
- Bomb membership is epoch-driven; countdown textures update only when the displayed second changes. Elemental patches are instanced.
- Mega has reduced DPR immediately; mobile/reduced-FX paths suppress costly shadows and AO. These are independent of the restored full orb model.
- Simulation/HUD clocks largely use refs and plain bridges. Rotation commit/cut/transport logic should not be weakened for speculative CPU savings.

## Validation and device follow-up

106 targeted tests passed: orb bounds, camera/parent-transform changes, material-state isolation, full Mega orb budget, orb density, existing render optimizations and special pickups. Production build passed. Changed-file lint reported zero errors and one existing Fast Refresh export warning.

Before merging, visually inspect a 15×15 run on the target Android phone with each preset, solid and complex tile styles, ordinary and elevated orbs, a live slice rotation, rocket flight, a tunnel transition, and PiP on/off. Compare the old reduced-orb build with the full-detail build and collect frame-time percentiles, actual render calls, triangles, texture/program counts and a sustained-play trace. Attribute main scene, PiP, preview passes and postprocessing separately. Accept the full orb appearance as a requirement; use those measurements to choose the next optimization from the table.
