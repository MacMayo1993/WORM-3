# Worm Mode — Full Audit: Pain Points & Optimization Improvements

**Date:** 2026-06-28
**Scope:** Everything under `src/worm/` (Healer Worm crawl mode + the legacy co-op
platformer), its store surface in `src/hooks/useGameStore.js`, its HUD
(`src/worm/WormCrawlerHUD.jsx`, `src/components/overlays/HealerWormHUD.jsx`), and the
wiring in `src/App.jsx` / `src/3d/GameScene.jsx`.
**Method:** Static read-through of the hot paths (the `useWormCrawler` frame loop, the
phase machine, React re-render triggers, the store, the bundle output) with verified
`file:line` references against the current branch head (`claude/admiring-gates-09pnz4`).
Baseline confirmed before writing: **310 tests green, lint 0 errors / 4 worm warnings,
`npm run build` succeeds.**

This audit **builds on** and does not re-litigate three prior reviews:
- `docs/worm-disparity-perf-review-2026-06-10.md` — the 3D/frame-loop perf track
  (WormholeRings caching, WormBody tail LOD, incremental manifold map, etc. — all ✅).
- `docs/game-modes-performance-review-2026-06-26.md` — cross-mode main-thread scans (✅).
- `docs/full-repo-review-2026-03-27.md` — repo-wide architecture/DX.

The 3D render pipeline for worm mode is, frankly, already **very well optimized** (see
"What is already strong" below). The genuinely *new* pain points this pass surfaces are
mostly **outside** the per-frame GPU path the earlier reviews exhausted: a large block of
**unreachable code**, the **maintainability** of a file that has more than doubled since it
was first flagged, and a **React-render** hotspot in the 2D HUD that the perf reviews
(which focused on the canvas) never looked at.

---

## What is already strong (verified — do not redo)

- **3D frame loop is allocation-free.** `useWormCrawler` and every FX component hoist all
  `THREE.Vector3/Object3D/Color/Matrix4` temporaries to module scope (e.g.
  `HealerWormMode.jsx:85-93, 299-307, 1537-1556, 2166-2191`). The crawl simulation writes
  head position/normal straight into pre-allocated refs (`:966-968`).
- **Ring-buffer history, not arrays.** `stepHistory`/`tileTrail`/`pathHistory` are
  pre-allocated rings (`makeStepHistory`/`makeTileTrail`, `:314-372`) with in-place
  map/filter/trim — no per-frame array churn, and framerate-independent back-fill (`:972-996`).
- **Shared manifold map.** The tunnel-lookup effect and FX consumers pull from
  `getManifoldMap(cubies, size, rotationEpoch)` (`manifoldMapStore.js`) keyed on epoch, plus
  `buildManifoldGridMapIncremental` so flips patch the map instead of rebuilding it.
- **WormBody is diffed.** Instanced tail uses a `colorEpochRef` to skip rewriting the color
  buffer on unchanged frames (`:2298-2301`) and distance-LOD thins the segment writes.
- **HUD selectors use `useShallow`.** `WormCrawlerHUD` and `HealerWormHUD` select with
  `useShallow` so unrelated store writes don't re-render them.
- **Lazy-loaded + split correctly.** `HealerWormMode3DWrapper` is `React.lazy`'d in
  `GameScene.jsx:24-26` and is **no longer** statically imported anywhere — the defeated
  code-split that `full-repo-review-2026-03-27.md §2.1` flagged is **resolved**. Confirmed:
  `grep` finds zero static imports; it builds as its own 88 kB chunk.

---

## New findings (ordered by impact)

### W1 — A ~2,470-line co-op platformer subsystem is unreachable dead code ⚠️ HIGHEST IMPACT (maintainability)

`src/worm/` ships **two** worm games. The Healer crawl mode is the live one. The **co-op
platformer** is a second, fully separate implementation that **cannot be reached from the
UI**:

| File | Lines | Reachable? |
|------|-------|-----------|
| `PlatformerWormMode.jsx` | 733 | only when `coopMode === true` |
| `CrawlerCharacter.jsx` | 671 | imported only by PlatformerWormMode |
| `crawlerPhysics.js` | 345 | imported only by CrawlerCharacter + PlatformerWormMode (+ its test) |
| `PlatformerHUD.jsx` | 312 | imported only by PlatformerWormMode |
| `SimpleCubeRenderer.jsx` | 158 | imported only by PlatformerWormMode |
| **Total** | **~2,219** | **unreachable** |

The trigger chain is broken at the last hop:

```
App.jsx:1318      if (coopMode) return <PlatformerWormMode .../>
App.jsx:858       setCoopMode(true)        // only inside handleMenuCoop
App.jsx:1512      onMenuCoop: handleMenuCoop
UILayer.jsx:381   onCoop={onMenuCoop}
MainMenu.jsx:1305 onCoop: _onCoop          // ← destructured with `_` prefix = intentionally UNUSED
```

By this repo's own `no-unused-vars` `^_` convention, `_onCoop` is a deliberately-ignored
prop. There is **no other caller** of `handleMenuCoop`, and `CubeModeSelectScreen`/
`ModeCarousel` expose no co-op entry. The MainMenu's `id: 'worm'` tile
(`MainMenu.jsx:790`) maps to the *Healer* mode, not this platformer.

**It still costs you:** the build emits `PlatformerWormMode-*.js` at **38.57 kB (11.69 kB
gzip)** every build, and ~2,200 lines sit in `src/worm/` confusing anyone navigating the
directory (it doubles the apparent surface of "worm mode").

**Contradiction to resolve first:** `docs/ROADMAP.md:12` lists *"WORM platformer co-op ✅
Working"*, and `ROADMAP.md:243` plans to *reuse* `PlatformerWormMode`'s dual-Canvas
split-screen for a future feature. So this is **intentionally-kept-but-unwired**, not
abandoned-by-accident. Do **not** silently delete it.

**Recommendation (needs a product decision — see "Open question" at the end):**
- If co-op is still on the roadmap → **re-wire it**: give MainMenu/ModeCarousel a real
  entry that calls `onCoop`, or remove the dead `handleMenuCoop`/`onMenuCoop`/`_onCoop`
  plumbing so the chain isn't half-connected. Right now it's the worst of both worlds —
  shipped, untested in CI's reachable paths, and invisible.
- If co-op is shelved → move the five files to a `coming-soon/` area (the repo already uses
  `coming-soon/` for parked features, per `game-modes-performance-review §F1`) so they stop
  inflating the live worm directory and bundle.

### W2 — `WormTouchControls.jsx` (250 lines) is orphaned — zero references ⚠️ HIGH (dead code, safe to remove)

`grep -rn "WormTouchControls" src/` returns **only its own definition**. Nothing imports
it — not even the dead platformer. The touch input that worm mode actually uses is
`WormSwipeControls`, defined inside `HealerWormMode.jsx:2067`. This is unambiguous dead
code (unlike W1 it has no roadmap claim attached), and is the one safe immediate deletion.

### W3 — `HealerWormMode.jsx` is a 5,097-line / 268 KB single file ⚠️ HIGH (maintainability)

This one file holds the entire live mode: a **1,151-line** `useWormCrawler` hook
(`:386-1534`) plus **23** components (`WormChaseCamera`, `TunnelSurfFX`,
`TunnelInteriorView`, `WormSwipeControls`, `WormBody`, `GlowWormAura`, `PortalGlow`,
`WormTrail`, `WormFace`, `PowerupOrbs`, `OrbFlashSystem`, `WormInteriorGlass`,
`HeartBurst`, `HealBurst3D`, `HeartBurstSystem`, `TunnelHealProgress`, `WormholeRings`,
`TunnelPortalRings`, `TunnelPortalFX`, `SliceWarningLights`, `ThunkEffect`,
`HealerWormMode3DWrapper`, `CollisionGlow`) and ~30 `useFrame` loops.

`full-repo-review-2026-03-27.md:33` already flagged this file — **at 2,370 lines** — and
recommended splitting it "by behavior seams: separate simulation, input mapping, camera
logic, HUD projection." Three months later it is **5,097 lines (+115%)** and the split was
never done. Left alone it keeps growing; it is the single biggest regression-risk and
merge-conflict surface in the codebase.

**Recommendation (mechanical, behavior-preserving — but benefits from in-browser smoke
test):** extract along the existing seams, which are already cleanly separable because they
communicate only through the returned `worm` refs object and the store:
- `worm/healerWorm/useWormCrawler.js` — the simulation hook + its `tick`/phase machine and
  the pure helpers above it (`readLiveTile`, `cutWormTail`, `makeStepHistory`, …).
- `worm/healerWorm/WormChaseCamera.jsx`, `…/WormBody.jsx` (+ aura/face/trail),
  `…/TunnelFX.jsx` (the `Tunnel*`/`Wormhole*`/`Portal*` cluster),
  `…/WormFX.jsx` (heart/heal/orb-flash/thunk/collision-glow/slice-warning).
- Keep `HealerWormMode.jsx` as the thin `HealerWormMode3DWrapper` composition root.

Do it as a **pure move** (no logic edits) in one commit so the diff is reviewable and the
test suite + build stay green at each step.

### W4 — `WormCrawlerHUD` re-renders ~10×/sec during normal play ⚠️ MEDIUM (React perf)

The wormhole countdown is published from the frame loop at **0.1-second resolution**:

```js
// HealerWormMode.jsx:788-793  (inside tick)
const countdownDeci = Math.round(countdown * 10);
if (countdownDeci !== lastCountdownDeci.current) {
  lastCountdownDeci.current = countdownDeci;
  st.setWormholeCountdown(countdown);   // fires ~10× per second
}
```

`WormCrawlerHUD` subscribes to `wormholeCountdown` inside its **one big** `useShallow`
selector (`WormCrawlerHUD.jsx:755-774`) and renders it as `…toFixed(1)s`
(`WormCrawlerHUD.jsx:890`). Because that value changes 10×/sec, the **entire 993-line HUD
component reconciles 10 times a second** — recomputing its JSX tree, the orb-inventory row,
the speed slider, the boost/jump buttons, etc. — *concurrently with* the 60 fps WebGL
render. The earlier perf reviews fixed `DisparityHUD` (`§3.3`) but never examined this HUD.

**Fix (low risk, self-contained):** pull `wormholeCountdown` out of the big selector and
read it inside a tiny leaf component that renders *only* the timer text:

```jsx
function WormholeCountdownValue() {
  const c = useGameStore(s => s.wormholeCountdown ?? 0);
  return <div style={WORMHOLE_VALUE_STYLE}>{c.toFixed(1)}s</div>;
}
```

Now only that ~1-element leaf re-renders at 10 Hz; the rest of the HUD re-renders only on
real events (orb pickup, speed change, phase change). `wormBodyTiles`, `wormSessionOrbs`,
and `wormOrbInventory` are event-driven (orb pickup/deposit), so they're fine to leave.

### W5 — `tick()` rebuilds the `PHASE_HANDLERS` table every frame ⚠️ MEDIUM (GC churn)

`PHASE_HANDLERS` is an **object literal recreated on every `tick` call**
(`HealerWormMode.jsx:811-1311`) — 7 phase objects, each with `update` (and several with
`enter`/`exit`) arrow functions, plus the inline `evaluatePosAndNormal` closure inside
`crawling.update`. That's roughly **7 objects + ~12 closures allocated 60×/second
(~1,100 short-lived allocations/sec)** purely to dispatch the active phase.

V8 collects these cheaply, but it is avoidable steady-state garbage in the hottest loop in
the app, and it's the kind of thing that shows up as GC sawtooth under a profiler during
long runs. The handlers close only over **stable** values — module-level scratch vectors,
refs, `size` (constant per run), and the memoized `beginTunnelTransition`/`killWorm`/
`resolveTunnelAtTile` callbacks — so the table can be built **once**.

**Fix:** build `PHASE_HANDLERS` once in a `useMemo`/`useRef` (keyed on `size`) and have
`tick` look up `handlers[phase.current].update(delta, STEP_SEC)`. `delta`/`STEP_SEC` are
already passed as params, so no closure-over-per-frame-state problem. *Caveat:* verify the
handlers genuinely capture nothing per-frame before hoisting (they don't today, but the
extraction in W3 is the natural moment to do this cleanly).

### W6 — Latent staleness: memoized `tick` captures non-memoized closures ⚠️ MEDIUM (correctness fragility)

`tick` is a `useCallback` with deps `[size, beginTunnelTransition, resolveTunnelAtTile,
killWorm]` (`:1322`), but its body calls `spawnWormholePair` (`:728`, a **plain function
recreated every render**, not in the dep array), `applyOrbPickupGrowth` (`:709`, same), and
`startJump`/`tileKey` (these *are* memoized). ESLint flags exactly this at `:1322`
("missing dependencies: 'spawnWormholePair', 'startJump', 'tileKey', …").

Today it's **harmless** — `spawnWormholePair`/`applyOrbPickupGrowth` only read refs and
`useGameStore.getState()`, so the stale captured copy behaves identically to a fresh one.
But it's a footgun: the moment someone makes either close over a prop/state value, `tick`
will silently use the mount-time version. Wrap both in `useCallback` (they have stable
inputs) and add them to `tick`'s deps so the lint rule passes honestly instead of via an
implicit "trust me." Same applies to the `:1404` effect missing `tileKey`.

### W7 — Duplicated per-component cosmetic subscriptions ⚠️ LOW

The same cosmetic selectors are independently subscribed in 6+ components inside the file:
`useGameStore(s => s.wormCharacter ?? 'classic')` appears **5×** (`:2268, 2694, 2762, 2959,
3176`) and `s.wormSkin` **3×** (`:2267, 2757`, …). Each is a separate Zustand subscription
re-running its equality check on relevant writes. They only change when the player swaps
skin/character (rare), so impact is small — but it's avoidable duplication. If W3's split
happens, pass `{ character, skin }` down once from the wrapper (resolved via one selector)
instead of re-subscribing in every leaf.

### W8 — `getActiveTunnels` allocates 2 `THREE.Vector3` per tunnel on every cube change ⚠️ LOW

`wormLogic.js:159-160` does `new THREE.Vector3(...)` for `entryWorldVec`/`exitWorldVec` per
tunnel. The tunnel-lookup effect (`HealerWormMode.jsx:491-509`) re-runs on **every** raw
`cubies` change (`~12×/sec` at chaos L4, deliberately *not* debounced for gameplay
correctness), each time calling `getActiveTunnels`, which re-scans `O(size³)` and re-allocs
those vectors for every flipped pair. Tunnel counts are small so this is minor, but the two
vectors per tunnel are pure garbage on a path that runs at flip frequency. Could write into
a pooled/cached vector per tunnel keyed on the canonical tunnel key. Low priority.

### W9 — 4 ESLint warnings in `src/worm/` ⚠️ LOW (hygiene)

`npx eslint src/worm/` reports 4 warnings: the two `exhaustive-deps` in W6
(`HealerWormMode.jsx:1322, :1404`), and `react-refresh/only-export-components` in
`ParityOrb.jsx:29` (a constant exported from a component file — breaks Fast Refresh in dev).
None are bugs; clearing them keeps `npm run lint` honest so real warnings don't get lost in
noise.

---

## Non-issues confirmed (so a future pass doesn't re-flag them)

- **~30 `useFrame` loops in the file** look alarming but most are conditionally mounted and
  the heavy ones are already diffed/throttled; folding the tiny FX pollers into one manager
  is a nice-to-have, not a hotspot. (`worm-disparity-perf-review §2.4` already noted this as
  low priority.)
- **`setWormPowerups(powerupsRef.current.slice())` on pickup** (`:1114`) allocates a new
  array, but only once per orb eaten (event-driven), not per frame. Fine.
- **`PowerupOrbs` subscribing to `cubies`** (`:3131-3136`) re-renders the wrapper on every
  flip, but the `orbSignature` memo (`:3145-3153`) keeps the child `ParityOrbs` stable
  unless an orb tile actually changed. Already handled (`worm-disparity-perf-review §2.5`).
- **Timers/subscriptions** (`deathMenuTimer`, the `BoostButton` interval, the two store
  `subscribe` effects) all have cleanup. No leaks found.

---

## Prioritized roadmap

**Phase 0 — decisions (blocks the big wins)**
0. Decide co-op platformer's fate (W1). This gates ~2,200 lines + a 38.6 kB chunk.

**Phase 1 — dead-code & hygiene (low risk, no playtest needed)**
1. Delete `WormTouchControls.jsx` (W2) — zero references, safe.
2. Either re-wire or relocate the co-op tree per the Phase-0 decision (W1).
3. Clear the 4 lint warnings; wrap `spawnWormholePair`/`applyOrbPickupGrowth` in
   `useCallback` and fix `tick`/effect deps (W6, W9).

**Phase 2 — React-render & GC (low risk, benefits from a quick in-app smoke test)**
4. Isolate the wormhole countdown into a leaf subscriber (W4) — kills the 10 Hz full-HUD
   re-render.
5. Hoist `PHASE_HANDLERS` to build once per run (W5) — removes ~1,100 allocs/sec from the
   hottest loop.

**Phase 3 — structural (mechanical move, review-heavy)**
6. Split `HealerWormMode.jsx` along the seams in W3 — pure file moves, suite/build green at
   each step.
7. After the split, dedupe cosmetic subscriptions (W7) and pool `getActiveTunnels` vectors
   (W8) as cleanup riders.

**Success metric:** during a normal size-3 worm run, the 2D HUD should reconcile only on
gameplay events (not 10×/sec), the crawl loop should hold steady-state zero allocations
beyond the unavoidable event writes, and `src/worm/` should contain only code reachable
from the live mode (or clearly parked under `coming-soon/`).

---

## Open question for the maintainer

The single decision that unblocks the most cleanup: **is the co-op worm platformer
(`PlatformerWormMode` + crawler) a live-but-unwired feature you want re-connected to the
menu, or is it shelved?** `ROADMAP.md` says "✅ Working," but no UI path reaches it today.
Your answer determines whether W1 is a *re-wire* task or a *relocate-to-`coming-soon/`*
task. Everything else in Phases 1–3 is behavior-preserving and can proceed regardless.
