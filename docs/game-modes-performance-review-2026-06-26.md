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

**(c) is fixed in this branch** — see "Implemented" below.

**(a) and (b) remain and are the bigger structural cost** because, unlike (c), they are
*not* gated out during chaos. `computeAntipodalIntegrity` is the worst offender: it
allocates a `Set`, two template-literal strings per sticker (~600 at size 7), and a
`pairs` array of ~150 objects-with-two-nested-objects — **on every chaos tick** — and the
`pairs` array is only ever read when `antipodalIntegrityMode` is active
(`AntipodalVisualization.jsx:111`, gated by `GameScene.jsx:310`). In every other mode it
is built and immediately thrown away.

**Fix:**
1. **Antipodal (b):** make the scan allocation-free — pick the canonical half of each pair
   by a numeric index comparison instead of a `Set` + string keys, and only build the
   `pairs` array behind an `includePairs` flag that `useAntipodalIntegrity` passes as
   `antipodalIntegrityMode`. Keep `includePairs` defaulting to `true` so the existing
   `antipodalIntegrity.test.js` contract (`pairs.length === 27`) stays green. Removes
   ~750 allocations per scan in all non-antipodal modes.
2. **Metrics (a):** during chaos (`chaosLevel > 0`), stop rescanning — the worker already
   reports `totalFlips`/`deadTiles` in `chaosStats` (`useChaosWorker.js:155`). Derive the
   HUD's `metrics.flips` from `chaosStats` and freeze the memo's full recompute, the same
   way `TopMenuBar` was already converted in the 2026-06-10 Phase 1 work (§3.1).
3. **Both:** consider keying these memos on a cheap derived signature rather than the whole
   `cubies` reference where a frozen value is acceptable mid-cascade.

**Expected gain:** removes 2 full-cube scans + ~750 allocations from every chaos/worm
flip tick — directly attacks the residual main-thread cost during the heaviest modes.

---

### F2 — One `useFrame` per cubie for the pop animation (~218 callbacks/frame at size 7) ⚠️ MEDIUM

**`src/3d/Cubie.jsx:334-356`** — every visible cubie registers its own `useFrame` purely
to drive the disparity heal "pop" burst. At size 7 that is ~218 callbacks dispatched every
frame, and each one does `useGameStore.getState().cubiePops[popKey]` + `position.set(0,0,0)`
**every idle frame, in every mode** — even though `cubiePops` is empty during all of
Classic/Sudokube/Ultimate/Worm normal play.

This is the exact anti-pattern the 2026-06-10 review eliminated for stickers (§1.1), but it
was never applied to the cubie pop layer.

**Fix:** route cubie pops through the existing `StickerAnimationManager` active-set pattern
— register a per-cubie tick, activate it only when a pop is enqueued for that `popKey`,
and deactivate from inside the tick when `rawT >= 1`. Idle cubies then cost zero. A cheap
interim fix is to gate the per-frame `position.set(0,0,0)` behind a `wasPoppedRef` so idle
frames do no writes (removes the writes but keeps the dispatch overhead).

**Expected gain:** removes ~218 store reads + ~218 redundant transform writes per frame in
every non-disparity mode.

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

**Fix:**
- Gate `shadows` and the N8AO pass off for the **menu/intro** scenes (they don't need cube
  self-shadowing), or drop to a small `shadow-mapSize` there.
- Consider `frameloop="demand"` for the menu and for visually-static overlays/sub-scenes,
  invalidating on interaction only (the rendering audit §E already recommended this).
- Tie shadow-map size and the N8AO pass to the existing `perfReducedFX` tier and/or cube
  size, so size 6–7 and underpowered devices shed them automatically.

**Expected gain:** large idle-power/thermal win on the menu (the most-visited screen), and
removes a per-frame shadow cost from large-cube gameplay.

---

### F4 — `metrics` scan walks interior cubies it can never use (minor)

**`src/hooks/useCubeState.js:76-86`** — the triple loop iterates the full `n³` lattice,
including interior cubies. Interior cubies carry an empty `stickers` object so the inner
loop is skipped, but the `n³` iteration itself still runs (343 iterations at size 7 vs the
~218 that actually hold stickers). Subsumed by the F1(a) fix; if F1(a) is deferred, at
least skip interior cubies with the same `x>0 && x<size-1 && …` guard used by
`winDetection.js:14`.

---

### F5 — Win-detection effect re-subscribes on an object dependency (cosmetic)

**`src/hooks/useGameSession.js:43-66`** — the effect depends on `achievedWins` (a new object
reference each time it is set). After a win it re-runs, but `victory` is now set so it
early-returns — harmless. Noted only so a future refactor doesn't widen it into real work;
depending on `achievedWins.rubiks`/`.worm` booleans would be tighter.

---

## Per-mode notes

- **Classic / Sudokube / Ultimate** — share the move pipeline; F1(c) (fixed) and F1(a)/F2
  were the only per-move waste. Otherwise clean. (Note: the "Sudokube"/"Ultimate" *win
  screens* were removed, so `checkSudokubeSolved` was dead weight — see F1c.)
- **Worm / Healer** — heaviest mode, already deeply reviewed (2026-06-10 Part 2). F1(a)/F1(b)
  still apply here at full frequency because heals/tile-chaos mutate `cubies` continuously
  while `chaosLevel` is 0, so neither scan is gated. F2's idle cubie loop also runs here.
- **Disparity / Chaos** — worker-side accounting is correctly off-thread, but F1(a)/F1(b)
  re-introduce two main-thread full-cube scans on every TICK. Closing F1 is the single
  biggest remaining disparity-mode win after the 2026-06-10 work.
- **Teach / Solve** — `TeachMode.jsx` has no frame loops; `SolveMode.jsx:77` memoizes
  `checkSolveProgress` on `cubies` (recomputes once per move only). Healthy.
- **Holonomy / Merge / Hollow / Mirror / Random** — no new hot-path issues found;
  `Cubie.jsx` already keys mirror/wireframe memos on primitive deps, not object refs.

---

## Implemented in this branch (low-risk, behavior-preserving)

**F1(c) — stop computing the unused Sudokube/Ultimate win conditions on every move.**
`src/hooks/useGameSession.js` now calls `checkRubiksSolved` + `allStickersFlipped`
directly (the only two conditions the live game still surfaces) instead of
`detectWinConditions`, which additionally ran `checkSudokubeSolved` (six Latin-square face
scans) purely to populate the removed screens. `winDetection.js` is untouched, so its
public API and `winDetection.test.js` are unaffected. `checkRubiksSolved` is shared by both
remaining conditions and `allStickersFlipped` only runs once the cube is already solved, so
the common (unsolved) path is now a single surface scan with an early-out instead of three
full scans.

Everything else above is left as a recommendation: F1(a)/F1(b) touch shared logic and mode
gating that warrant a playtest pass, F2/F3 are structural and benefit from in-browser
profiling to tune thresholds.

---

## Prioritized roadmap

**Phase 1 — main-thread scan reduction (highest value, medium risk)**
1. F1(b): allocation-free `computeAntipodalIntegrity` + `includePairs` flag.
2. F1(a): derive `metrics` from worker `chaosStats` during chaos; freeze full recompute.
3. ✅ F1(c): skip `checkSudokubeSolved` in the live win check (done).

**Phase 2 — frame-loop hygiene (medium risk, big idle win)**
4. F2: fold cubie pops into the `StickerAnimationManager` active set.
5. F3: disable shadows/N8AO and use `frameloop="demand"` for the menu/intro; tie
   shadow-map size + N8AO to `perfReducedFX`/size for gameplay.

**Phase 3 — polish**
6. F4/F5: surface-only metrics scan; tighten effect deps.

**Success metric:** during Disparity/Worm at size 7, no main-thread full-cube scan should
run more than once per committed rotation — the high-frequency flip stream should touch the
main thread only for the targeted `setCubies` and the already-diffed instance uploads.
