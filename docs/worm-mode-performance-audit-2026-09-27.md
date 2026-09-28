# WORM mode performance audit — 27 September 2026

Measured against `main` at `b57429c` (interior portal openings). Earlier reviews of WORM (`worm-levels-11-40-performance-review-2026-09-24.md`, `reviews/2026-09-13-mega-optimization.md`, `worm-medium-optimizations.md`) were source reviews plus CPU microbenchmarks: every one of them lists "no browser measurements" as its main gap. This audit is the browser measurement. A real WORM free-play run is driven in Chromium. Every WebGL call, animation frame, React commit and shader link is counted and attributed to the React component that owns it. Candidate fixes are priced by patching the live page and A/B-ing them on a frozen scene. The harness is committed in `scripts/perf-worm/`, so every number below can be re-run after a fix.

No game code changed in this pass. This is the audit only; the fixes are listed in priority order below.

## Measurement corrections from implementation review

The tables below preserve the original run, but three qualifications supersede
its conclusions: the original 640×400 viewport selected the game's **mobile**
visual branch; patch B's **99% upload reduction is invalid** because a zero-length
WebGL2 update uploads the remaining buffer, while the counter recorded zero;
and patch C does **not reliably skip hidden matrix updates** in three.js r159.
The committed runner and upload instrumentation now correct the first two.
See `scripts/perf-worm/README.md`. These CPU-only timings do not establish a
physical-device FPS improvement.

## Headline

On an ordinary 3×3 free-play run, the frame does far more work than the scene needs. In production mode, per frame, with draws suppressed so only CPU work counts:

| Per frame (3×3, desktop viewport, production build, 45 s live play) | Measured |
| --- | ---: |
| Main-thread script (all rAF callbacks: R3F render + every `useFrame`), p50 / p95 | 7.9 / 11.9 ms |
| Same, 4× CPU throttle (mid-range phone proxy), p50 / p95 | 45.2 / 75.9 ms |
| Draw calls / triangles | 337 / 232k |
| `useProgram` switches / uniform uploads | 184 / 815 |
| GPU buffer uploads | 1,129 KB |
| Shader program links during 45 s of play | 127 |
| Worst frames | 215 ms (1×); 373–538 ms (4×) |

Under the 4× throttle, 99% of frames exceed 16.7 ms and 90% exceed 33 ms before any GPU work is counted. Game logic is not the problem: the WORM frame callback, crawler tick and `stepWormSim` included, is about 2–3% of JavaScript time. The cost is in how the scene is submitted to three.js. Most of it comes from six specific causes, all measured:

| # | Cause | Evidence | Fix size |
| --- | --- | --- | --- |
| 1 | Lights mount and unmount with orbs and elemental washes, so **every lit shader recompiles** for each new light combination | 15–18 program links and a 208–256 ms frame on the frame after a light-count change | Small |
| 2 | WORM's transparent **double-sided cubie shells** take three.js's two-pass path, which flags `material.needsUpdate` twice per body per frame | 47 draws and 61k triangles on a 3×3; 55 program re-selections per frame; single-pass saves 1.1 ms/frame (−15%) | Small, needs a visual check |
| 3 | The **Explode transition writes `explosionT` to the store every frame** | R3F commits jump from 1–2/s to 41–47/s through each 1.2 s transition; fps halves under throttle | Small |
| 4 | **Instanced buffers re-upload their whole capacity** (256–2,048 slots) every frame | 1.0–1.1 MB/frame live; 851–899 → 6.6–6.8 KB/frame with live ranges on the frozen scene (−99%) | Small |
| 5 | **Transient effect materials are disposed**, so their programs are released and relinked on the next spawn | A link every 1–3 s, 9 at every run start, 10–23 per wormhole spawn | Medium |
| 6 | **Per-object draws that could be instanced**: two extra draws per sticker, ~8 per parity orb, one per cubie body | 2 × 6n² sticker draws (300 on 5×5), ~100 orb draws | Medium–large |

Fixes 2 and 4 together cut the frozen-scene CPU frame by 24% on desktop (8.3 → 6.3 ms) and by 20% under the 4× throttle (37.1 → 29.7 ms). Those two alone do not reach budget on a phone-class CPU; the draw-count work in 6 is what gets there.

## Method and limits

- **Harness:** `scripts/perf-worm/` (see its README). Playwright drives the real UI: skip intro → Play → Play WORM → Free Play → wizard defaults (Classic worm, Black Hole scene, Classic colours, Solid style, 3×3, Medium) → Mobi's Skip. Portal enemies are on, as by default. Deaths are retried automatically.
- **Production numbers** come from an unminified production build (`scripts/perf-worm/vite.perf.config.mjs`: React in production mode, names kept for profiles). Component-level attribution was also taken on the dev server.
- **Draw calls are suppressed.** The container renders WebGL with SwiftShader. With real draws the frame is gated by software rasterisation (~2.4 fps) and 94% of the JS profile is native "(program)". Suppressing only the `draw*` calls leaves every piece of CPU work in place: three.js culling, sorting, program selection, uniform and buffer uploads, plus React and every `useFrame`. So `script` below is CPU cost per frame, **not GPU time**. GPU-side items (fill rate, overdraw, vertex load) are flagged, not measured.
- **4× CPU throttle** is Chrome's DevTools throttling, the usual mid-range-phone proxy. It models neither mobile GPUs nor thermals. Shader links are measured on the main thread only; a real driver compiles on top of that.
- **Frozen A/B:** the run is paused (`wormPaused`), which keeps rendering and every frame loop running on an unchanging scene. Patches are then the only variable. Each A/B row below is the mean of 2–4 alternating windows of 4–6 s. Run-to-run noise is about ±0.4 ms at 1× and about ±2.5 ms at 4×.
- **Not covered:** tunnel rides (the scripted worm never jumps onto a raised flipped tile), combat mode, story levels, Mega. The same harness runs them once a driver for the inputs exists.

## Findings

### P0-1 — Light-count changes recompile every lit material

three.js builds the number of point, hemisphere and directional lights into every lit program's cache key. When that count changes, every `MeshStandardMaterial`/`MeshPhysicalMaterial` in the scene has to switch programs. Each material caches the programs it has used, so returning to a combination already seen is free: the run shows p1→p0→p1 with no links. But every combination not yet seen compiles a full set. With four independent sources, one of them per-orb, a run keeps meeting new combinations. Materials that are remounted (P1-5) lose their cache and pay again.

Lights that mount and unmount during WORM play:

| Source | Mounted while |
| --- | --- |
| `ElementalAtmosphere.jsx:176` `<hemisphereLight>` | an elemental wash is active (the component returns `null` otherwise, `:167`) |
| `healerWorm/orbSystems.jsx:279` `<pointLight>` | each special orb exists |
| `healerWorm/ElementalOrb.jsx:417` `<pointLight>` | each elemental orb exists (desktop) |
| `ParityOrb.jsx:235` `<pointLight>` | an orb is the target |

Correlating the scene's visible light count with program links, frame by frame over 2 minutes:

| Frame | Light change | Next frame |
| --- | --- | --- |
| 2168 | ice wash starts (+1 hemisphere) | 17 links, 231 ms |
| 2863 | special orb spawns (+1 point) | 18 links, 256 ms |
| 2976 | ice wash ends (−1 hemisphere) | 15 links, 208 ms |
| 4216 | lightning wash starts | 18 links over 3 frames |

The largest frames of every run carried 15–19 program links: 208–256 ms at 1× and 373–538 ms at 4× (the next-largest 4× frames, 156–218 ms, had 0–11). In the light-tracked run each of the three largest followed a light-count change; the other big bursts are P1-5's.

`warmUpElementalSkins` compiles the skins ahead of time, but it cannot pre-warm the rest of the scene for a light rig that does not exist yet. That is why the claim hitch it was written to remove is still there.

**Fix:**

- Keep the light count constant. Mount the elemental hemisphere light permanently at intensity 0 (three.js counts a light regardless of intensity, so program keys stay fixed).
- Replace the per-orb point lights with a small fixed pool assigned to the nearest orbs each frame, or drop them. Non-target parity orbs already glow with emissive plus additive blending and no light.
- Then extend the warm-up to compile against the final rig.

**Verify:** `run.mjs --mode=attribute` shows zero links on claim, spawn and expiry. The `frames` max falls to the ordinary frame range.

### P0-2 — Transparent double-sided cubie shells: two passes and program churn every frame

In WORM, `Cubie.jsx:187-197` makes every body `transparent` (opacity 0.8) and `side: DoubleSide`. For that combination three.js's `renderObject` renders a BackSide pass then a FrontSide pass, setting `material.needsUpdate = true` before each. Each needsUpdate bumps the material version, and three.js responds by rebuilding the program parameters and cache key and switching programs.

Each cubie creates its own body material (27 distinct materials on a 3×3), so every body pays this separately. `SignatureEffects.jsx:13-21` uses the same pattern for its four ring/page instanced meshes, which render with `count = 0` most of the time and still go through program selection.

Measured per frame (3×3):

- 47 body draws and 61k triangles, where 24 draws and ~30k triangles would do.
- ~47 body program re-selections, each a program switch, plus 8 from SignatureEffects.
- In the production CPU profile, `getParameters` and `getProgram`, which only run when a program is re-selected, are 9.9% of JavaScript time. With `setProgram` and the `needsUpdate` setter the total is 13.4%.

Forcing single-pass rendering (patch **A**) measured −23 draws, −30k triangles and −52 program switches per frame. On the frozen scene, CPU went 7.0 → 6.0 ms on the dev build (mean of 3–4 windows each) and 7.2 → 6.1 ms on the production build, about −15% in both.

**Fix, in increasing order of effort:**

- `forceSinglePass: true` on the WORM body material. This keeps both faces in one pass; the shells are convex and 0.8-opaque, but the inside walls' draw order changes, so it needs a visual check.
- Use `FrontSide` while the camera is outside the cube and `DoubleSide` only on the tunnel ride. This is where the inside of a shell is actually seen.
- Instance the bodies with one shared BackSide/FrontSide material pair: two draws for the whole cube. The sticker path's `worldTransformTracker` already solves the live-transform problem this needs.
- SignatureEffects: `forceSinglePass` is visually exact for flat rings. Also set `visible = count > 0`.

### P0-3 — The Explode transition re-renders the whole app every frame

During each 1.2 s Explode open/close (`EXPLODE_TRANSITION`, `wormExpansion.js:8`), `tickExpansion` (`healerWorm/expansion.js:29`) calls `onExpansionAmount`. That writes `explosionT` to the store every frame (`useWormCrawler.js:404-407`).

`explosionT` is subscribed by:

- `GameScene.jsx:114`
- `CubeAssembly.jsx:117`
- every `Cubie` (`Cubie.jsx:128`)
- `useCubeState.js:50`, which puts it on App itself
- `orbSystems.jsx:76`
- `TunnelInteriorView.jsx:69`
- three overlays

Replaying exactly that store traffic on a frozen scene:

| | R3F commits/s | DOM commits/s |
| --- | ---: | ---: |
| Hold | 1.0–1.7 | 11–15 |
| Explode transition | 41–47 | 100–115 |

Over the same windows the frame rate fell 18–28% at 1×, and by half under the 4× throttle (19–20 → 9–10 fps). Each Explode pays this twice: once opening, once closing.

**Fix:** the value is already mirrored on the `wormExpansion.amount` bridge (`useWormCrawler.js:405`). Have the frame loops read the bridge and publish only the start and end of the transition to the store, as `wormBuffs` already does for every other buff clock.

### P1-4 — Instanced buffers upload their full capacity every frame

three.js re-uploads an attribute in full whenever `needsUpdate` is set, unless an update range limits it. Several instanced meshes set `needsUpdate` every frame over buffers sized for the largest board, including frames where their count is 0:

| Mesh (capacity) | KB per frame |
| --- | ---: |
| Parity-orb opaque batches, `orbBatches.js` (256 each, 17–19 batches) | 274 |
| Sticker `InstancedMesh`, `StickerInstances.jsx` (2,048). Tile-press dents dirty it every frame in WORM | 128 |
| `PadProvider` (`PadSprings.jsx:199-202`) stalk + mouth (2,048 each), even at `count = 0` | 2 × 128 |
| `PadEnergy.jsx:165-169` column + vortex (2,048 each, plus `aSeed`), even at `count = 0` | 2 × 136 |
| `WormBody` (`MAX_TAIL` = 1,200) | 75 |

That is 1.0–1.1 MB/frame, about 60 MB/s at 60 fps. Limiting each upload to the live instances (patch **B**) measured 851–899 → 6.6–6.8 KB/frame on the frozen scene.

This does not show on the renderer's main thread in this environment, because the copy happens in the GPU process. On a phone it is memory bandwidth and driver time.

**Fix:**

- `attr.clearUpdateRanges(); attr.addUpdateRange(0, count * itemSize)`. r159 has this API; `updateRange` is deprecated.
- Skip `needsUpdate` entirely when the count is and was 0, and set `visible = count > 0` so the mesh skips program setup too.

### P1-5 — Programs released between uses are recompiled on the next one

three.js deletes a program when the last material using it is disposed. R3F disposes JSX materials on unmount. Effects that mount per event therefore recompile on every event once nothing else holds their program.

Over 150 s of play there were 265 links in 48 separate bursts, P0-1's included. The patterns other than light changes:

| Pattern | Links | Source |
| --- | --- | --- |
| Every orb pickup | 1–3 (instanced `MeshBasicMaterial`, etc.) | `OrbPickupBurst.jsx:113-131` mounts six fresh materials per burst |
| Every run start (spawning phase) | 9 | `HealerWormMode.jsx:724-733` unmounts `WormBody`, `WormFace` and others while `wormGamePhase` is scrambling, so their physical/standard materials are rebuilt |
| A wormhole spawn when none is live (first of a run, or after all have healed) | 10–23 | Per-tile JSX `<shaderMaterial>`s in `StickerPlane.jsx:2305-2380` (wispy ring, crack, seam leak, aperture, rim glow, parity breakthrough), plus `WormholeNetwork` band shaders. Identical sources share a program only while one is alive |
| Special-orb spawns | 6–7, plus P0-1's lit recompiles | First use of the orb's own unlit materials (points, sprite, shader, basic) |

**Fix:** keep one material per effect variant alive for the whole mode. Use module-level materials that are never disposed, or pooled effects that are hidden rather than unmounted: the pattern `WormholeRings` and `HealerBombs` already use and document. Then compile them once in the mode's warm-up. `HealerBombs`' `<WarmUp>` is the existing model.

### P1-6 — Two extra draws per sticker in WORM

Besides the instanced sticker face, each WORM sticker renders:

- a `TileBoundary` perimeter (`StickerPlane.jsx:1980`), with shared geometry and material;
- an inward-facing antipodal back plane (`StickerPlane.jsx:2006-2010`) with its own `MeshStandardMaterial` per sticker (`:1822`).

The back plane faces the cube's interior, so from outside the cube, which is nearly all of the crawl, the GPU back-face culls it. The CPU still pays a full draw and material setup for it.

| Board | Sticker-overhead draws per frame |
| --- | ---: |
| 3×3 | ~90 |
| 5×5 | ~190 |
| 10×10 (level 32/37/40) | up to 1,200 |

Hiding the back planes while the camera is outside (patch **D**) measured −43 draws per frame on a 3×3 and −0.2 to −0.7 ms, within run-to-run noise at this board size. The saving grows with n².

**Fix:** draw `TileBoundary` as one more instanced mesh reading the matrices `StickerInstances` already maintains (1 draw). Show the back planes only when the camera is inside the cube, and give them one material per colour rather than per sticker.

### P1-7 — Parity orbs are still ~8 draws each

On the 3×3, orbs cost:

- about 83 individual draws and 59k triangles (`SingleOrbImpl`: four tori, spheres, cylinder, band);
- 17 instanced-batch draws and 17k triangles.

That makes orbs the second-largest draw source after cubie bodies.

The cage rings, axis and inner glow are additive (`orbMaterials.js:24-45`), so their order does not matter and they can be instanced without sorting risk. The glass shell and patterned band are the parts that need separate meshes. This is the Mega review's open "High" item; these measurements show it matters on ordinary boards too.

### P2-8 — Scene-wide React re-renders

- **`GameScene` subscribes to broad store fields.** It takes `cubies`, `explosionT`, `wormPhase`, `wormHealedCount` and more (`GameScene.jsx:112-131`), so every flip, heal, turn and phase change reconciles the whole scene. On top of that, App re-renders every second because `useGameSession`'s `gameTime` interval reaches it (`App.jsx:339`, `useGameSession.js:37-42`); WORM's HUD runs on its own clock and never reads it.
- **Measured rate and cost.** 1.8–3.5 R3F commit frames per second. Each adds 0.3–0.7 ms to its frame in production on desktop, several times that on a phone.
- **Idle combat pools re-render.** Each commit re-renders the idle combat pools in full, because `CombatScene` and its rigs are not memoised. Over 12 s: `EnemyOutline` 1,368 renders, `Shot`/`Burst` 304 each, `Crawler` 152, and `StickerPlane` 340 (the board has 54).

**Fix:** stop the `gameTime` interval in WORM, or subscribe to it only in the components that display it. Narrow `GameScene`'s selector. Memoise `CombatScene` and the pooled rigs.

### P2-9 — Hidden objects still pay matrix updates

The WORM scene graph holds 1,675 objects, all with `matrixAutoUpdate`, and 943 of them are in hidden subtrees. `updateMatrixWorld` traverses those regardless of visibility, and it is the single largest three.js function in the production profile at 10.9% of JavaScript time.

The largest hidden pools:

| Pool | Objects |
| --- | ---: |
| Combat `Crawler` rigs | 288 |
| `EnemyOutline` | 108 |
| `Burst` | 80 |
| `TunnelInteriorView` | 59 |
| `HealParticles` | 54 |
| `Shot` | 48 |

Setting `matrixWorldAutoUpdate = false` on hidden subtrees (patch **C**) measured between 0 and −1 ms across windows, within noise on a 3×3.

**Fix:** toggle `matrixWorldAutoUpdate` together with `visible` on pool roots, or mount combat rigs only during an encounter.

### P2-10 — DOM and helper work that runs whether or not anything changed

- **`SignatureButton` polling.** `SignatureButton.jsx:16` polls `wormBuffs.signature` every 100 ms. `signatureReadout` (`signatures.js:147`) builds a new object every frame (`useWormCrawler.js:636`), so the button re-renders 10×/s regardless of change. **Fix:** compare the readout fields before setting state.
- **Combat HUD polling.** `CombatControls.jsx:10-11` forces the ambient combat HUD to re-render every 100 ms with a counter. **Fix:** re-render only when a displayed value changes.
- **`RotationCountdownHUD` paint loop.** `RotationCountdownHUD.jsx:52-80` writes `width`, `background`, `boxShadow` and `textContent` every animation frame. The trace shows style recalculation and layout on every frame (about 50 ms/s of style, layout and paint on desktop). **Fix:** drain the bar with `transform: scaleX()`, and write each property only when its value changes.
- **`prefersReducedMotion()` calls `matchMedia` each time.** `utils/device.js:15` runs `window.matchMedia(query)` on every call, and it is called from 46 sites, several inside `useFrame`. That is 0.8% of JavaScript time in native `matchMedia`. **Fix:** cache one `MediaQueryList` and read `.matches`, which is still live.

### P2-11 — Geometry weight (GPU side, not measured here)

- Each WORM cubie body is about 1,300 triangles (drei `RoundedBox`, `smoothness={4}`), and currently drawn twice. The shells are dark and 0.8-opaque, so a lower `smoothness` for WORM is worth an art check.
- The Black Hole background is two draws of about 8k triangles each.
- The antipodal-core miniature (`VoidCore`) draws about 15k triangles every frame, seen only faintly through the translucent shells.
- Transparent double-pass shells are also blended overdraw, which is the usual mobile fill-rate cost.

Profile on a device before acting on these.

### Watch items

A 3.5-minute run with six death/retry cycles found:

- Geometry counts return to baseline after every retry.
- Textures grew 20 → 27.
- Post-GC heap grew 44.7 → 52.5 MB, about 1.3 MB per run.

Not a confirmed leak, but worth one longer soak with a heap snapshot diff. Program count swings 93–213 over the same run; that is P0-1 and P1-5.

## What is already in good shape

- **Simulation:** tiny. The WORM frame callback, with the crawler tick and `stepWormSim`, is about 2–3% of JavaScript time. GC is 0.7–1.2%. The per-frame allocation work in earlier passes shows.
- **Rendering already batched:**
  - Sticker faces are one instanced draw with a bounded count.
  - The worm body is one instanced draw.
  - Elemental patches are instanced.
  - Orbs are memoised and animated from one frame callback.
- **No render targets in steady play:** one main-scene pass per frame, and no preview or thumbnail renders during a run. Texture uploads are rare (3–4 in 45 s).

## Suggested order

1. **P0-1 fixed light rig + warm-up** and **P0-3 explode bridge.** Both are small and low risk. P0-1 removes the largest hitches; P0-3 removes a half-rate stretch from every Explode.
2. **P1-4 live-range uploads** and **P0-2 single-pass shells**, after an art check of the shell's inside walls. Together these cut the CPU frame by 20–24%.
3. **P1-5 resident FX materials**, with the warm-up extended to cover them.
4. **P1-6 instanced tile boundaries and back planes**, and **P1-7 instanced orb parts.** This is where large boards are won.
5. **P2** items as their files are touched.

After each step, rerun:

```bash
node scripts/perf-worm/run.mjs --mode=frames --url=http://localhost:4173/WORM-3/ --ms=45000
node scripts/perf-worm/run.mjs --mode=frames --url=http://localhost:4173/WORM-3/ --ms=45000 --throttle=4
node scripts/perf-worm/run.mjs --mode=attribute --url=http://localhost:4173/WORM-3/ --ms=20000
```

Compare against the headline table. Then confirm on a physical phone with real draws (`--draw`, or Chrome remote debugging). This audit cannot measure GPU time, and P0-2, P1-6 and P2-11 all have GPU-side effects as well.


## Implementation follow-up — fixed lights, upload ranges, live expansion

The first implementation addresses findings 1, 3 and 4, retaining the existing
transparent shell rendering and interior tile backs:

- WORM has a fixed pool of four point lights on desktop, two on mobile. Orb and
  Glow Worm sources keep their animated colour, intensity, distance and live
  transforms; the nearest visible sources occupy the pool. Inactive slots use
  zero intensity, never visibility gating. The elemental hemisphere stays
  mounted, and elemental warm-up compiles against the actual scene light rig.
- Pads, orb batches, stickers and all worm-body variants upload active prefixes
  through r159's supported range API. Empty pad/orb batches are hidden and do
  not dirty their buffers. Pending ranges survive skipped renders and shrinking
  counts, so restored meshes cannot lose unconsumed writes.
- The WORM simulation publishes continuous expansion to its existing bridge.
  Store notifications occur at transition boundaries and the interior-guide
  threshold (six writes over a complete opening/closing cycle at 60 Hz).
  Lattice centres update after simulation, followed by raised cubies, pads,
  pad energy, camera and stickers. Camera framing, orb fallback placement,
  interior snapshots, antiverse exposure and highlight anchors use the live
  amount. Non-WORM Explode retains its existing store-driven animation.

Validation: full CI passed after rebasing onto `0feb495`, including the new
mirror-room/camera changes (296 files / 3,634 tests, zero lint errors, production
build and bundle budgets). A real-draw browser screenshot was also checked:
cube, worm, orbs, lighting and HUD rendered successfully. The real R3F lattice test exercises 3×3 and 6×6 expansion and
collapse with raised corners and no React commits between store boundaries.
Upload tests exercise three.js's actual WebGLAttributes path in WebGL1 and
WebGL2, including empty pools and pending writes across hidden frames.

A short corrected-harness check compared `738f48c` with this implementation
before the mirror-room/camera rebase, using unminified production builds,
1280×800, 3×3 Free Play, 15 seconds of live play, and suppressed draws:

| Measurement | Main baseline | Implementation |
| --- | ---: | ---: |
| Median uploads per frame | 1,041.1 KiB | 52.2 KiB |
| Program links during the sample | 120 | 21 |
| Script time p50 / p95 | 5.4 / 8.0 ms | 5.7 / 8.3 ms |
| Maximum sampled script time | 308.4 ms | 38.9 ms |

These are sanity-check observations, not a controlled FPS benchmark. Random
pickups differed (lightning versus grass), and adaptive FX tiers differed.
Uploads fell about 95%, while ordinary script-frame cost was similar. The
samples support reduced wasted uploads and fewer compilation hitches; they do
not establish a general frame-rate improvement or physical-phone GPU results.
