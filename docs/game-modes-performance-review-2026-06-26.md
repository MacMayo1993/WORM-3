# Full Performance & Optimization Review — All Game Modes

**Date:** 2026-06-26
**Scope:** Every game mode (Classic, Sudokube, Ultimate, Worm/Healer, Disparity/Chaos,
Teach, Holonomy, Merge, Hollow/Mirror, Random) plus the shared render pipeline, the
Zustand store, the menu/intro, and the per-move/per-frame hot paths they all sit on.
**Method:** Static read-through of the hot paths (frame loops, pure game logic, store
mutations, React re-render triggers) with verified `file:line` references against the
current branch head.

This review **builds on** two prior audits and does not re-litigate their findings:
- `docs/worm-disparity-perf-review-2026-06-10.md` (worm + disparity, Phases 1–3 mostly ✅)
- `docs/rendering-optimization-audit.md` (rendering + visual-technique track)

The focus here is **new, cross-mode findings** the earlier passes did not cover —
primarily redundant full-cube scans that run on the **main thread on every cube
mutation, in every mode**, concurrent with the work the chaos worker already does.

---

## What is already strong (verified — do not redo)

The codebase is, on the whole, carefully optimized. Confirmed-good patterns:

- **Batched solid stickers** — `StickerInstances.jsx` collapses up to 294 sticker quads
  into one `InstancedMesh` with per-slot **matrix and color diffing** (`lastMatricesRef`
  Float64 / `lastColorsRef`), so a cube at rest uploads zero bytes/frame.
- **Single sticker-animation loop** — `StickerAnimationManager.js` + `StickerAnimationDriver.jsx`
  replaced 294 per-sticker `useFrame` subscriptions with one driver over an *active set*;
  idle tiles cost nothing.
- **Shared manifold map** — `manifoldMapStore.js` caches the `O(6n³)` map on `(size, epoch)`;
  flips reuse it for free.
- **Atomic store writes** — `useAnimation.js` / `useCubeState.js` batch cubies + epoch +
  moves + history into a single `setState`, so one move = one re-render.
- **Stable cubie identity** — `rotateSliceCubies` only replaces references for cubies in
  the rotating slice; `Cubie.jsx`'s `cubiePropsAreEqual` bails out on reference equality
  for ~6/7ths of the cube.
- **Chaos off the main thread** — flip logic runs in `chaosWorker.js`; rotations are
  replayed via a 3-field `ROTATE_SLICE` message rather than cloning cubies.
- **Per-instance scratch reuse** — `CubeAssembly.jsx` and `HealerWormMode.jsx` hoist all
  `THREE.Vector3/Quaternion/Matrix4` temps to module scope; no per-frame GC churn.
- **Adaptive quality** — `PerformanceMonitor` clamps DPR and sets `perfReducedFX`
  (`App.jsx:1369`) on sustained frame-rate decline.

---

## New findings (ordered by impact)

### F1 — Three redundant full-cube scans run on the main thread on *every* cube mutation ⚠️ HIGHEST IMPACT

Every time `cubies` changes, `App` re-renders (it subscribes via `useCubeState`). Three
independent `O(n³)`/`O(6n²)` scans then run on the main thread, regardless of mode and
regardless of whether their output is even on screen. In Disparity/Chaos and Worm modes
`setCubies` fires **many times per second** (every worker TICK / every heal), so these
scans run in lockstep with the high-frequency flip stream — exactly when the frame budget
is tightest, and *on top of* the work the chaos worker is already doing off-thread.

| # | Scan | Location | Cost per call (size 7) | Result consumed? |
|---|------|----------|------------------------|------------------|
| a | `metrics` (flips/wormholes/entropy) | `src/hooks/useCubeState.js:71-88` | iterates all **n³** cubies × stickers | HUD (`FloatingHUD` reads `metrics.flips`) |
| b | `computeAntipodalIntegrity` | `src/game/antipodalIntegrity.js:36-84` via `src/hooks/useAntipodalIntegrity.js:12` | **n³** scan + a `Set` + ~600 template-string keys + ~150 nested objects (`pairs`) | only `integrity` is used by the HUD; **`pairs` only used in Antipodal Integrity mode** |
| c | `detectWinConditions` → `checkSudokubeSolved` | `src/game/winDetection.js:139-146`, called from `src/hooks/useGameSession.js:54` | six Latin-square face scans, each building a size×size grid | **never** — Sudokube/Ultimate screens were removed |

**All three are addressed in this branch** — see "Implemented" below. (b) was the worst
offender: it allocated a `Set`, two template-literal strings per sticker (~600 at size 7),
and a `pairs` array of ~150 objects-with-two-nested-objects **on every chaos tick**, while
its `pairs` array was only ever read when the Antipodal Integrity mode was active. The
whole feature has been removed, so that scan no longer exists in any mode. (a) is now a
surface-only scan, and (c) no longer runs the dead Sudokube check.

**Notes on what was considered for (a):** gating the `metrics` recompute out during chaos
was rejected — `TopMenuBar` already ignores `metrics` (it reads worker `chaosStats`), but
`FloatingHUD` still reads `metrics.flips` live during chaos for its parity readout, so
freezing it would visibly stall that HUD. The surface-only scan keeps it correct while
cutting the iteration to the cubies that actually hold stickers.

**Expected gain:** removes one full-cube scan + ~750 allocations per chaos/worm flip tick
(the antipodal scan) outright, and trims the remaining `metrics` scan to the surface shell.

---

### F2 — One `useFrame` per cubie for the pop animation (~218 callbacks/frame at size 7) ⚠️ MEDIUM

**`src/3d/Cubie.jsx:334-356`** — every visible cubie registers its own `useFrame` purely
to drive the disparity heal "pop" burst. At size 7 that is ~218 callbacks dispatched every
frame, and each one does `useGameStore.getState().cubiePops[popKey]` + `position.set(0,0,0)`
**every idle frame, in every mode** — even though `cubiePops` is empty during all of
Classic/Sudokube/Ultimate/Worm normal play.

This is the exact anti-pattern the 2026-06-10 review eliminated for stickers (§1.1), but it
was never applied to the cubie pop layer.

**Partially fixed in this branch:** the per-frame `position.set(0,0,0)` write is now gated
behind a `poppedRef` so idle cubies early-out without writing (removes ~218 redundant
transform writes/frame in every non-disparity mode). The remaining structural step — fold
cubie pops into the `StickerAnimationManager` active set so idle cubies don't even dispatch
a `useFrame` — is left for a follow-up that benefits from in-browser verification.

**Expected gain (done):** ~218 redundant transform writes/frame removed in every
non-disparity mode. **Remaining:** ~218 `useFrame` dispatches/frame (the manager fold).

---

### F3 — `frameloop="always"` + shadows + N8AO run the full pipeline while idle/in menus ⚠️ MEDIUM (battery/thermal)

**`src/App.jsx:1366-1367`** — the single persistent Canvas runs `shadows` with
`frameloop="always"`. That is correct during gameplay (continuous shader animation), but it
also means:
- The **main menu** scene (`MenuScene`) and intro keep rendering at 60 fps with shadow-map
  regeneration, plus 6 `useFrame` loops in `MainMenu.jsx` and the menu worm-particle
  backgrounds — all while the user is just looking at a menu.
- Shadow maps regenerate every frame during rotations; with `shadows` enabled and ~218
  shadow-casting cubies at size 7 this is a real per-frame cost the 2026-06-10 review
  predated (shadows were added in recent commits `e2b8471`, `d1f8307`).

**Already partly handled (verified):** the shadow-casting light and the N8AO pass live in
`GameScene` (gameplay only), and both are gated by `shadowsOn`/`aoEnabled`
(`GameScene.jsx:165-170`) off mobile, off `perfReducedFX`, and off wireframe/glass. The
menu renders `MenuScene` (no shadow-casting light), so it pays no shadow/AO cost — and when
a full-screen overlay (settings / mode select) covers the menu, the scene collapses to a
flat `<color>` clear (`App.jsx:1384`). So the worst of F3 is already mitigated.

**Remaining (left as recommendation — needs in-browser tuning, not changed here):**
- `frameloop="demand"` for the menu/intro so the idle menu stops re-rendering at 60 fps.
  Risky on the single persistent Canvas (it also hosts gameplay), so deferred.
- Drop `directionalLight` `shadow-mapSize` from `2048²` toward `1024²` at size ≥ 6 to keep
  the per-frame shadow pass cheap on the largest cubes.

**Expected gain:** idle-power/thermal win on the menu; smaller shadow pass at large sizes.

---

### F4 — `metrics` scan walks interior cubies it can never use (FIXED)

**`src/hooks/useCubeState.js`** — the triple loop iterated the full `n³` lattice including
interior cubies (343 iterations at size 7 vs the ~218 that actually hold stickers). Now
skips fully-interior cubies with the same shell guard `winDetection.js:14` uses, and
switched to indexed loops + `for…in` (no `Object.keys` array per cubie). Behavior-identical
(interior cubies carry no stickers, so they contributed nothing to the counts).

---

### F5 — Win-detection effect re-subscribes on an object dependency (cosmetic)

**`src/hooks/useGameSession.js:43-66`** — the effect depends on `achievedWins` (a new object
reference each time it is set). After a win it re-runs, but `victory` is now set so it
early-returns — harmless. Noted only so a future refactor doesn't widen it into real work;
depending on `achievedWins.rubiks`/`.worm` booleans would be tighter.

---

## Per-mode notes

- **Classic / Sudokube / Ultimate** — share the move pipeline; F1(c) (fixed) was the only
  per-move waste. (The "Sudokube"/"Ultimate" *win screens* were removed, so
  `checkSudokubeSolved` was dead weight — see F1c.)
- **Worm / Healer** — heaviest mode, already deeply reviewed (2026-06-10 Part 2). Heals and
  tile-chaos mutate `cubies` continuously while `chaosLevel` is 0, so this is where the F1
  scans hit hardest — removing the antipodal-integrity scan and trimming `metrics` to the
  surface shell directly cut that per-mutation cost. F2's idle cubie writes are gated now.
- **Disparity / Chaos** — worker-side accounting is correctly off-thread. The one remaining
  main-thread full-cube scan per TICK (the antipodal-integrity I(T) metric) is now gone with
  the feature; `metrics` is surface-only.
- **Teach / Solve** — `TeachMode.jsx` has no frame loops; `SolveMode.jsx:77` memoizes
  `checkSolveProgress` on `cubies` (recomputes once per move only). Healthy.
- **Holonomy / Merge / Hollow / Mirror / Random** — no new hot-path issues found;
  `Cubie.jsx` already keys mirror/wireframe memos on primitive deps, not object refs.

---

## Implemented in this branch

**F1(b) — removed the Antipodal Integrity feature entirely (the worst per-tick scan).**
The I(T) integrity metric, its real-time visualization, and its HUD are deleted:
`game/antipodalIntegrity.js`, `hooks/useAntipodalIntegrity.js`,
`3d/AntipodalVisualization.jsx`, `components/overlays/AntipodalHUD.jsx`, and the dead
`coming-soon/game/cubeVerifier.js` (integrity-gated, referenced only by its own test) +
both their test files. All wiring is gone: the `antipodalIntegrityMode` store flag and its
setters, the `useAntipodalIntegrity()` call in `App.jsx`, the `antipodalData` props, the
`GameScene` render branch, the `UILayer` HUD, and the "I(T)" toggle in
`SecondaryModesSheet`. The separate **Antipodal Mode** (echo / Mirror-Quotient rotations,
`AntipodalModeEffects`/`AntipodalModeHUD`) and the **Antipodal PiP** camera are unrelated
and were left intact. Net: the highest-frequency main-thread allocator (a `Set` + ~600
strings + ~150 objects per chaos tick) is gone in every mode.

**F1(c) — stop computing the unused Sudokube/Ultimate win conditions on every move.**
`useGameSession.js` now calls `checkRubiksSolved` + `allStickersFlipped` directly instead of
`detectWinConditions` (which also ran `checkSudokubeSolved` — six Latin-square face scans —
purely for the removed screens). `winDetection.js` and its tests are untouched.

**F2 (partial) — gate the per-cubie pop animation's idle writes.** `Cubie.jsx`'s pop
`useFrame` now early-outs via a `poppedRef` instead of writing `position.set(0,0,0)` every
frame, removing ~218 redundant transform writes/frame in every non-disparity mode. The
deeper fold into `StickerAnimationManager` (to drop the dispatches too) is left as a
follow-up.

**F4 — surface-only `metrics` scan.** `useCubeState.js` skips fully-interior cubies and
drops the per-cubie `Object.keys` allocation; behavior-identical.

Verified: `npm run build` succeeds, full test suite green (303 tests), lint clean (no new
warnings).

The remaining items (F2 manager fold, F3 menu `frameloop="demand"` + large-cube shadow-map
sizing, F5 effect-dep tightening) are left as recommendations that benefit from in-browser
profiling.

---

## Prioritized roadmap

**Phase 1 — main-thread scan reduction (highest value)**
1. ✅ F1(b): Antipodal Integrity removed — its per-tick scan no longer exists.
2. ✅ F1(c): skip `checkSudokubeSolved` in the live win check.
3. ✅ F4: surface-only `metrics` scan.

**Phase 2 — frame-loop hygiene**
4. ◐ F2: idle pop writes gated (done); fold cubie pops into `StickerAnimationManager` to
   drop the ~218 idle dispatches/frame (remaining).
5. F3: `frameloop="demand"` for the menu/intro; drop `shadow-mapSize` at size ≥ 6
   (shadows/N8AO are already gated off mobile/`perfReducedFX`/wireframe/glass).

**Phase 3 — polish**
6. F5: tighten the win-detection effect deps to the `achievedWins` booleans.

**Success metric:** during Disparity/Worm at size 7, no main-thread full-cube scan should
run more than once per committed rotation — the high-frequency flip stream should touch the
main thread only for the targeted `setCubies` and the already-diffed instance uploads.
