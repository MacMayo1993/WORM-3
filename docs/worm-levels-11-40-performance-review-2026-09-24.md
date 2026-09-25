# WORM levels 11–40: performance and optimization review

Reviewed 2026-09-24 against `main` at `0998ecbd` (chapter expansion `e829a33f`). Changes are on `perf/story-chapters-review`.

The expansion is structurally sound: all 30 levels stage valid boards with enough initial orbs, and the large-board effects safeguards are wired up. The most concrete avoidable costs were hollow-frame mesh multiplication, per-frame story HUD allocation, whole-surface searches for local powers, and Random mode disposing its shader cache. These are fixed in this branch. The largest remaining rendering risks are Brick Blast (37), Mega Crawl (39), and Eternal Remix (40).

This is a source review, simulation/test review, geometry verification, and CPU microbenchmark. No browser/GPU or physical-phone FPS measurements were available. Mesh counts below describe constructed objects, not measured visible draw calls. Passing staging tests establishes initial feasibility, not that every level's par time is achievable by every character.

## Changes made

| Finding | Affected levels | Change | Evidence |
|---|---|---|---|
| Twelve separate meshes and geometries for every hollow cubie | 21, 35 | Merge the same twelve beams into one shared frame geometry per cubie; keep materials and transforms | Level 21: 1,176 → 98 frame meshes. Level 35: 3,552 → 296. Triangle counts unchanged; tests check open holes, beam hits and bounds |
| HUD builds two goal arrays, repeats completion checks and serializes two checklists every frame | All, most noticeable at 40's 13 objectives | Reuse the HUD snapshot until a displayed counter, second, hint, clearance or settling state changes | Idle level-40 CPU benchmark: 0.00859 → 0.00021 ms/update, about 41× faster for this helper |
| Local power placement scans up to the entire six-face surface; blocked placements retry each frame | Mastery and bomb levels | Examine only the radius-three patch on the current face, at most 49 coordinate candidates; retain original selection order | Exhaustive comparison on every tile of sizes 2–10 and 15, with occupied and flipped cells |
| Every ten-second remix destroys all cached tile materials and publishes three store changes | 26, 30, 40 | Retain the existing 500-entry LRU cache; update palette, face styles and remix seed atomically | Test verifies material identity, no cache disposal, and one store notification per remix |
| Remix interval continues changing a paused worm level | 26, 30, 40 | Skip remix callbacks while Worm is paused | Fake-clock test covers paused cycles and resumption |
| Three-element trials offer ice/lightning after water/fire/grass are already mastered | 27, 30 | Restrict offerings to the authored element count | Regression tests verify grass is last and no extra element follows |
| Bomb coverage still uses unexpanded logical trail length | Particularly 40, which combines bombs and Explode | Share the expansion-aware coverage count with tunnel rings for bomb placement/disarming and blast contact | Regression verifies an expanded short body neither disarms a complete logical ring nor takes a blast hit on an uncovered old tail cell |

Core simulation and objective completion still update every frame. The HUD optimization does not throttle pickups, victories, deadlines or landing detection. The bomb change retains the existing expansion-scale approximation used by tunnel rings; it does not introduce a new exact arclength collision model.

Relevant code: `src/3d/Cubie.jsx`, `src/3d/hollowFrameGeometry.js`, `src/hooks/useRandomMode.js`, `src/worm/story/mastery.js`, `src/worm/story/hudSnapshot.js`, `src/worm/useWormCrawler.js`, and `src/worm/healerWorm/bodyCoverage.js`.

## Measured CPU costs

Reproduce with `node scripts/bench-story-chapters.mjs`. These numbers came from the container's Node runtime. The comparison uses the previous helper logic and the new helper in the same process, with warmup and seven timed batches of 10,000 calls. It measures the helper work only, excluding React, WebGL, shader compilation, browser layout and device thermals.

| Operation | Previous ms/call | Revised ms/call |
|---|---:|---:|
| Level 40 idle HUD | 0.00859 | 0.00021 |
| Blocked local power search, 7×7 | 0.00898 | 0.00224 |
| Blocked local power search, 10×10 | 0.01769 | 0.00227 |
| Blocked local power search, 15×15 synthetic case | 0.03721 | 0.00219 |

The search benchmark deliberately fills all cells so the old search traverses its full candidate array. It is a worst-case retry, not an average successful spawn. Level 39 currently has no mastery-power objective; its 15×15 search result demonstrates scaling only. The absolute CPU savings are small compared with a 16.7 ms frame budget. Hollow mesh consolidation addresses a substantially larger structural rendering cost, whose frame-time benefit still needs GPU profiling.

Story staging took approximately 0.03–4.23 ms per level in this run (median of 11 warm invocations, Classic's extra orbs included, simulation allocated before timing). Level 39 was slowest at 4.23 ms; level 40 was 2.60 ms. No staging rewrite is justified by these measurements. Results vary with warmup, random Classic-orb placement and hardware.

## All 30 levels

Surface tiles = 6n²; visible shell cubies = n³ − (n−2)³. These are useful workload measures, not FPS predictions. Risk is relative within this chapter expansion, based on the renderer and simultaneous mechanics after the fixes above.

| Level | Board | Tiles | Rendering / gameplay review |
|---|---:|---:|---|
| 11 · Pocket Crawl | 2×2 | 24 | Low render load. 22 initial orbs for a 14-orb goal; head/body exclusions leave all six colors available |
| 12 · Grid Lines | 3×3 | 54 | Low. Three unique tunnel pairs fit; small-board mouth/body placement passes |
| 13 · Numbers Underfoot | 4×4 | 96 | Low–moderate. Number labels add work; seeded crossing fits the far row |
| 14 · Glass Carousel | 3×3 | 54 | Moderate transparency/overdraw risk; small board limits cost |
| 15 · Chrome Works | 6×6 | 216 | Moderate. Reflective bodies and liquidChrome styling; volume extras already suppressed |
| 16 · Mind the Gap | 7×7 | 294 | Moderate. Gap scale and repeated turns; 48 base orbs cover the 24-orb goal |
| 17 · Launch Pad | 4×4 | 96 | Moderate flight/landing load. Sequential rocket offering; boost/double-jump completion uses actual landings |
| 18 · Blast Radius | 6×6 | 216 | Moderate. Expansion updates many transforms; explosion credit waits for closure |
| 19 · Neon Arcade | 8×8 | 384 | Elevated. Pulsing edge frames plus styled tiles across 296 cubies; edge segments already merged per cubie |
| 20 · Size Summit | 8×8 | 384 | Elevated combined effects, turns and sequential powers. Five power/ability tasks plus healing/orbs/turns |
| 21 · Hollow Hills | 5×5 | 150 | Frame bottleneck fixed: 1,176 → 98 frame meshes; shader/volume load remains |
| 22 · Ghost Frame | 5×5 | 150 | Moderate. Wireframe hides ordinary stickers; flipped wormhole pieces retain their neon/tunnel presentation |
| 23 · Brick by Brick | 4×4 | 96 | Moderate. Up to 288 stud-detail meshes; much smaller than level 37 |
| 24 · Biome Crossing | 6×6 | 216 | Moderate. Correctly borrows elemental tiles without mounting the city/building renderer |
| 25 · The Far Side | 5×5 | 150 | Elevated. Far-side viewport adds a second scene pass; AO is already excluded while PiP is active |
| 26 · Remix | 5×5 | 150 | Cache disposal/pause fixes applied. First-time shader compilation and per-cubie style remounts remain |
| 27 · Neon Storm | 6×6 | 216 | Moderate–elevated. Neon plus elemental effects; corrected to stop after the required three elements |
| 28 · Shatterglass | 7×7 | 294 | Elevated. Transparent surfaces combined with expansion and rocket effects |
| 29 · Number Siege | 7×7 | 294 | Elevated. Number labels, enemy/bomb updates and turns share the frame budget; encounters are bounded |
| 30 · Kaleidoscope | 6×6 | 216 | Elevated. Remix plus powers; cache/HUD/element-limit fixes apply |
| 31 · Nine Lives | 9×9 | 486 | Elevated styled-surface load. No combat/rotation objective; initial non-Classic supply 48 for goal 36 |
| 32 · Tenfold Tunnels | 10×10 | 600 | Elevated shader and tunnel-render load. Six pairs and 24 base orbs; no periodic turns |
| 33 · Knife Edge | 2×2 | 24 | Low rendering load, high control pressure. Five-second turns need human difficulty testing |
| 34 · Chrome Gauntlet | 9×9 | 486 | High shader risk: liquidTank/lavaLamp/orbChamber styling plus frequent turns and reflective bodies |
| 35 · Hollow Siege | 8×8 | 384 | Frame bottleneck fixed: 3,552 → 296. Still combines shaders, combat, bombs and turns |
| 36 · Ghost Storm | 6×6 | 216 | Moderate–elevated. Ordinary stickers omitted in wireframe, but elemental effects remain |
| 37 · Brick Blast | 10×10 | 600 | High. Up to 1,800 stud-detail meshes, plus 488 cubie bodies, sticker planes and repeated expansion |
| 38 · Mirror Numbers | 7×7 | 294 | High. Numbers plus second camera pass and six-second turns |
| 39 · Mega Crawl | 15×15 | 1,350 | High. Mega's shared chassis/reduced effects are enabled, but the authored non-solid tile shaders still use individual planes |
| 40 · Worm Eternal | 10×10 | 600 | High. Largest checklist, Random remounts, turns, combat and powers. HUD/cache/spawn and expanded-bomb fixes apply |

## Safeguards already working

- Chapter launch settings select the correct board everywhere, including Mega's reduced-effects tier for level 39.
- Mega omits 1,178 individual rounded bodies and uses its shared chassis; it also disables hollow framing at that size.
- Tile volume extras are suppressed from size 6 upward and under adaptive reduced effects. This does not reduce the cost of the underlying fragment shader.
- LED edges already share one segmented line per cubie rather than a line mesh for every edge.
- Surface tile lists and tunnel/manifold lookups are cached; story staging is not repeated in the active frame loop.
- Story powers are offered one at a time and are not replaced while their effect is active. Story combat spawns one enemy per encounter, rather than an unbounded population.
- The far-side camera unmounts during tunnel travel, and the main AO composer is not mounted alongside its manual two-pass renderer.
- Story appearance/view settings restore on exit, and chapter unlocks/reward claims are tested. Biome's city renderer is deliberately absent.

## Remaining priorities

1. **Profile 37, 39 and 40 on the target phone before calling this FPS-complete.** For 37, prototype batching stud geometry/materials by face color while preserving slice transforms. For 39, extend sticker instancing to compatible shader styles rather than replacing the authored look. For 40, measure ten-second remix spikes separately from steady gameplay: keeping the cache prevents forced recompilation but cannot eliminate first-use programs or React remounts.
2. **Measure levels 25 and 38 with PiP both on and off.** Its small viewport still submits a second scene and traverses its objects. If that pass dominates, render it into a retained texture at a lower update rate; simply skipping its direct scissor pass would make the inset vanish when the main frame clears it.
3. **Measure shader-heavy 34 and transparent 28.** Lowering volume effects does not simplify ray-based/animated fragment work or transparency sorting. Use GPU evidence to choose shader detail tiers; do not assume cube size alone predicts which look is slowest.
4. **Human route/limit testing remains.** Test 33's fast turns, 37's three explosions/two flights, and 40's long sequence with each character. Existing tests prove supplies and event counting, not comfortable route lengths, on-screen readability or attainable three-star times.

For device profiling, capture warm steady-state and first-entry separately, plus rotation, pickup, explosion opening/closing and Random transitions. Record median/p95 frame time, long frames, renderer calls/triangles and geometry/texture counts before and after retries. A 60 FPS target gives 16.7 ms/frame; a 30 FPS fallback gives 33.3 ms. These are suggested acceptance targets, not results from this review.

## Verification

- Full suite: **2,798 tests passed across 207 files**.
- ESLint: **0 errors, 99 warnings**; warning cleanup is outside this patch.
- Production build and bundle gate: **passed**. Initial route: 8 files, 2,068.1 KB raw / 510.8 KB Brotli, within 10-file / 2,300 KB / 640 KB budgets.
- New coverage verifies all supported sizes/faces for placement equivalence, hollow geometry holes/beams, HUD transitions, Random cache/pause behavior, three-element limits and expanded bomb coverage.
- No published changes or phone/browser FPS claims. The benchmark and this report are included with the code for reproduction and review.

Push preparation: rebased onto `43824424` (the live story-task tracker). All 78 focused HUD, story-flow, checklist and performance tests passed after the rebase. The full-suite figures above describe the original review run.
