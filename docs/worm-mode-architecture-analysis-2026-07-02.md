# WORM Mode Architecture Analysis — 2026-07-02

Full review of the WORM (healer worm) mode: architecture, functionality, and performance.
Builds on `healer-worm-mode-breakdown.md`, `worm-disparity-perf-review-2026-06-10.md`, and
`game-modes-performance-review-2026-06-26.md`. Findings from those docs that are already fixed
in the current code are not repeated; everything below was verified against the code as of today.

---

## 1. Architecture map

WORM mode is really **two independent modes plus a legacy layer**:

| Layer | Entry point | Status |
|---|---|---|
| Healer worm (single-player snake/heal game) | `src/3d/GameScene.jsx:310` → `HealerWormMode3DWrapper` | Active, primary |
| Co-op platformer (split-screen crawler) | `src/App.jsx:1331` → `PlatformerWormMode` | Active, secondary |
| Legacy segment-based worm APIs | `src/worm/wormLogic.js` (surface + tunnel segment functions) | **Dead code** (tests only) |
| Prototypes | `src/coming-soon/worm/` | Parked |

### Healer worm data flow

```
useGameStore (Zustand worm slice, useGameStore.js:145)
        │  settings, run lifecycle, HUD state
        ▼
useWormCrawler (useWormCrawler.js, 1,250 lines)         ← simulation. Ref-based, zero-render.
  · phase machine: crawling → windup → entering → tunnel → exiting → windout
  · tileTrail / pathHistory / stepHistory rings (circularBuffers.js)
  · tunnel lookup (buildTunnelLookup + incremental update, wormLogic.js:236,254)
  · orb economy: deposit / heal / void traversal bookkeeping (beginTunnelTransition)
        │  refs (headInterpPos, stepHistory, phase, …)
        ▼
HealerWormMode.jsx (3,269 lines) — ~20 render subsystems, each with its own useFrame:
  WormBody · WormFace · WormTrail · WormholeRings · TunnelPortalRings/FX ·
  SliceWarningLights · PowerupOrbs · HeartBurst/HealBurst/OrbFlash/Thunk ·
  TunnelInteriorView · CollisionGlow · GlowWormAura · PortalGlow · TunnelHealProgress
        │
        ▼
HealerWormMode3DWrapper (line 2893) — game-phase driver:
  scrambling → spawning → countdown → active (inverse-rotation hazard) → finalHealing → solved
```

Cross-cutting communication happens through **six module-level mutable singletons** that
bypass React/Zustand for per-frame data:

- `liveRotation.js` — mid-tween slice rotation (written by CubeAssembly, read by worm ride logic)
- `liveCubies.js` — live cubie mesh refs
- `tunnelProgressBridge.js` — worm tunnel t for the DOM Möbius HUD
- `wormTurnBridge.js` — DOM D-pad → canvas queueTurn
- `pressState` (wormLogic.js:1252) — tile depression map read by CubeAssembly
- `healBurstMap` / `activateSticker` (3d/TileStyleMaterials, StickerAnimationManager)

This is a sound pattern for 60 Hz data (Zustand reactivity would be worse), but the contracts
live in scattered comments.

### What is already strong (verified — do not redo)

The mode is heavily optimized and most previous review findings are fixed:
scratch-vector discipline everywhere, pre-allocated ring buffers (`circularBuffers.js`),
incremental tunnel lookup (`updateTunnelLookupIncremental`), incremental manifold map with
epoch caching, debounced O(n³) scans in WormholeRings, distance LOD + instance compaction in
WormBody, color-epoch gating of `setColorAt` uploads, frame-delta clamping (`MAX_TICK_DELTA`),
speed-change accumulator rescaling, high-water-mark zeroing of stale instances, phase-handler
caching, and the framerate-independent step-history back-fill. Test coverage of the pure layer
is genuinely good (8 worm test files: buffers, physics, tunnel lookup, slice ride, navigation).

---

## 2. Performance findings (ordered by impact)

### P1 — WormholeRings never sets `instancedMesh.count` → full-capacity draws every frame ⚠️ HIGHEST

`WormholeRings` (HealerWormMode.jsx:1731–2220) allocates 8 instanced meshes sized to worst
case and hides unused slots by writing zero-scale matrices up to the previous high-water mark
— but **never assigns `mesh.count`** (contrast with `WormBody`, line 802, and `WormTrail`,
line 1062, which do). Every frame the GPU therefore processes the full capacity:

| Mesh | Capacity at size 5 | Typical live |
|---|---|---|
| live rings (torus 8×32) | 150 | 2–10 |
| void outer + inner rings | 150 + 150 | 0–6 |
| bubbles | 750 | 0–30 |
| sparks | 1,050 | 0–14 |
| poles + tapes | 600 + 600 | 0–32 |
| void frames | 600 | 0–24 |

≈ 4,000 zero-scaled instances still run the vertex stage every frame at size 5.

**Fix:** compact writes are already contiguous (`liveIdx`, `voidIdx`, …), so set
`mesh.count = liveIdx` etc. at the end of the frame loop instead of (or in addition to) the
zero-out pass. The per-bubble/spark write guards (`bubbleIdx < bubbles.count`) must switch to
comparing against capacity constants, since `count` will no longer equal capacity.
Small change, pure win; also removes most of the zero-matrix writes.

### P2 — WormCrawlerHUD re-renders wholesale at 10 Hz

`useWormCrawler.tick` publishes `wormholeCountdown` at deci-second resolution
(useWormCrawler.js:497–502 — up to 10 store writes/sec while crawling). The 977-line DOM HUD
subscribes to it inside one big `useShallow` selector (WormCrawlerHUD.jsx:692) together with
inventory, speed, settings, etc., so the **entire HUD tree re-renders 10×/sec** for the
lifetime of a run — layout/paint on the DOM side competes with the canvas thread on mobile.

**Fix:** either (a) move the countdown readout into a tiny leaf component with its own
narrow selector, or (b) drop the countdown from Zustand entirely and drive the digits via a
ref + rAF exactly like `MobiusHUD` already does with `tunnelProgressBridge`. Option (b) is
consistent with the mode's existing bridge pattern.

### P3 — Rotation-commit bake walks the full 60,000-slot step history

The rotation-commit subscription (useWormCrawler.js:1208–1225) iterates `sh.count` slots to
bake the turn into body history. `sh.count` saturates at capacity
(`MAX_TAIL × STEPS_PER_TILE = 60,000`) over a long run regardless of actual body length, so
each hazard rotation (every 10 s) does a 60k-iteration loop with two `applyAxisAngle` calls
per in-slice slot. `WormBody` already solved this exact problem with its `_neededSteps` cap
(HealerWormMode.jsx:519–523).

**Fix:** compute the same reach cap (`tailLength × spacing × STEPS_PER_TILE × 2 + margin`)
and only walk that many recent slots; older history is never rendered or collided against.
Same reasoning applies to `shTrimTo` in `cutWormTail` (already cheap) — only the bake loop
matters.

### P4 — Debounce timer churn + stale phase read in WormholeRings

The debounce effect (HealerWormMode.jsx:1781–1787) schedules/cancels a `setTimeout` on
**every** `cubies` identity change (~12×/sec under chaos flips) and picks the 200 ms vs
400 ms delay from `worm.phase.current` *at schedule time*, so a flip that lands right before
a tunnel entry uses the wrong cadence. Cheap, but easy to tighten: derive a "flipped-sticker
signature" (count + epoch) and only reschedule when the signature changes, or debounce via a
frame counter inside the existing `useFrame` throttle instead of timers.

### P5 — One-frame staleness window in the tunnel lookup

`tunnelLookupRef` is rebuilt in a `useEffect` after render (useWormCrawler.js:183–195), but
`tick` runs in `useFrame` and can consume the lookup for the cubies state *before* React has
flushed the effect for a flip that happened in the same tick (`spawnWormholePair` sets state
mid-tick). Practical impact is a ≤1-frame delay in a tile reading as a tunnel — currently
masked by `TUNNEL_TRIGGER_PROGRESS` — but it is the kind of latent ordering bug that surfaces
when timings change. If the registry consolidation in A1 (below) happens, resolve lookups
from the store-owned registry synchronously at flip time instead.

### P6 — PlatformerWormMode runs two WebGL contexts

The co-op mode mounts **two `<Canvas>` elements** (PlatformerWormMode.jsx) — two GL contexts,
two render loops, duplicated scene resources. drei's `View` (already imported there) can
render both viewports from a single context. Worth doing before any mobile push for co-op;
otherwise fine on desktop.

### P7 — Minor per-frame costs (batch of small items)

- `CollisionGlow`, `GlowWormAura`, `PortalGlow`, `OrbFlashSystem` keep their `useFrame`
  callbacks registered even when inert. Each early-outs cheaply, so this is only worth
  addressing opportunistically (e.g. `isGlow === false` could skip registration entirely by
  mounting the component conditionally, as is already done for the glow overlay mesh).
- Body sphere geometry is 16×16 (≈512 tris/instance) for up to 1,200 instances. With the
  existing LOD compaction this rarely bites, but a 12×12 sphere (~290 tris) is visually
  indistinguishable at gameplay camera distance.
- `getStickerWorldPos` returns a fresh array per call; hot paths already minimize calls, but
  an `Into`-style variant (like `getTunnelWorldPosInto`) would remove the remaining
  per-step allocations in `tick`/rotation handlers.

---

## 3. Functionality / correctness findings

### F1 — ~600 lines of dead legacy worm code ship in the bundle

`wormLogic.js` (1,353 lines) still contains the complete **segment-based** worm
implementation that predates the current arc-length body. Verified unused outside
`src/__tests__/`:

- Tunnel-segment mode: `createInitialTunnelWorm`, `findNextTunnel`, `checkTunnelSelfCollision`,
  `spawnTunnelOrbs`, `updateTunnelWormAfterRotation`, `getTargetTunnelId` (lines 420–783)
- Surface-segment mode: `checkSelfCollision`, `createInitialWorm`, `spawnOrbs`,
  `updateWormAfterRotation` + `WORM_ROTATIONS`/`rotateWormDir` (lines 1033–1229)
- Worm-weight healing scan: `checkHealingCandidatesNearHead`, `getSurroundingNeighbors`,
  `getPressedTileKeys` (lines 1263–1352)

Still live from that file: tunnel geometry/centerline helpers, `getActiveTunnels`,
`buildTunnelLookup`/incremental, `getNextSurfacePosition`/`turnWorm`/`rotateMoveDir`,
`isTileInSlice`, `getStableKey`, `getSegmentWorldPos` (ParityOrb), `pressState` (CubeAssembly).

**Recommendation:** split `wormLogic.js` into `tunnelGeometry.js` (centerline/arc/wind math),
`tunnelRegistry.js` (getActiveTunnels + lookup builders), and `surfaceNavigation.js`
(FACE_DIRECTIONS / transitions / rotateMoveDir); delete the dead exports and their tests, or
move them to `coming-soon/` if the tunnel-rider prototype still wants them. This shrinks the
worm chunk and makes the file map match reality.

### F2 — The orb/heal/void economy is untestable where it matters most

The most intricate gameplay rules — orb deposit with prism wildcard drain, heal-cost
accounting, traversal counting, void arming/cancellation on heal — live inside
`beginTunnelTransition` and the `exiting` phase handler (useWormCrawler.js:256–388, 918–992),
interleaved with `useGameStore.setState` calls. None of it is covered by the otherwise strong
test suite, and it's exactly where regressions have historically needed long comments to
explain (void-kill cancellation on heal, stale-trail false tail-bites, swept-entry guard).

**Recommendation:** extract pure functions into `healerWorm/economy.js`:
`computeDeposit(inventory, progress, tailLength, character) → {n, nextInv, nextProgress}`,
`applyTraversal(useCounts, voidKeys, tunnelKey) → {verdict: safe|void-armed|killed}`,
`settleHeal(progress, stableKey)`. The hook becomes a thin adapter, and the rules get direct
unit tests. This is the highest-leverage refactor for functional safety.

### F3 — Two parallel tunnel representations can disagree

Tunnel data is computed by two independent systems:

1. `buildTunnelLookup`/incremental — tileKey → tunnel, used by the crawler every step.
2. `getActiveTunnels` — array scan, used by WormholeRings (debounced), the finalHealing
   sweep (throttled 0.5 s), and `WormholeNetwork`/`MobiusTunnel` via `pairId`.

Both derive from the same cubies + manifold map, but at different times (exact vs debounced)
and with different canonical IDs (position-pair key vs sorted gridId `pairId`). The rings can
therefore lag the crawler's truth by up to 400 ms, and every consumer pays its own scan.

**Recommendation:** a single memoized tunnel registry module keyed on
`(cubies identity, rotationEpoch)` — built once per change, exposing both the array and the
tileKey lookup plus a single canonical ID. All consumers (crawler, rings, finalHealing,
MobiusTunnel dimming, HUD progress) read the same object. This also retires P5's ordering
window and the finalHealing rescan.

### F4 — Mid-run settings changes silently hard-reset the run

The init effect's dependency list (useWormCrawler.js:1114) includes `wormOrbCount` and
`wormholeInterval`. `initWormMode` bumps `wormRunId` so new runs reset intentionally — but if
any UI ever exposes orb count / interval during a live run (the settings sliders exist in the
setup wizard today), changing them mid-run silently respawns the worm and zeroes the session.
`wormSpeed` deliberately is *not* in the deps, so the asymmetry looks unintentional.
Either gate the reset on `wormRunId` only, or document that these two knobs are
run-immutable.

### F5 — Known gap: painted trail does not persist across tunnels

`crawling.enter()` resets `pathHistory` after every tunnel ride
(useWormCrawler.js:535–536, comment says "cross-tunnel persistence is a separate follow-up").
Given the trail is marketed as a "where I've been" map, carrying it across tunnels (keep the
ring; push a sentinel break so `WormTrail` doesn't draw a daub bridge between exit and entry
regions) would complete the feature. The seq-anchored ring already supports discontinuities.

### F6 — Duplicated constants with "keep in sync" contracts

- `TUNNEL_FACE_OFFSET = 0.52` / `TUNNEL_MINI_FACE_R = 0.25` (wormLogic.js:481) duplicate
  MobiusTunnel.jsx geometry with a sync comment — the worm rides the rendered ribbon only as
  long as nobody edits one side. Export from one module (tunnelGeometry.js per F1).
- `FACE_NORMALS` exists three times (healerWorm/constants.js THREE.Vector3 table,
  crawlerPhysics.js table, wormLogic.js plain-array `TUNNEL_FACE_NORMALS`). The plain-array
  variant exists to avoid a circular import — the F1 split resolves that cycle naturally.
- Tile-key builders exist four times (`positionKey`, `tileKey` in the hook, `_tileKeyStr`,
  `getTunnelSideKey`) — all produce `"x,y,z,dirKey"`. One exported `tileKey()` used
  everywhere prevents a silent format drift (the incremental lookup's canonical-entry rule
  depends on the string comparing correctly).

### F7 — `WORM_LIFT` vs body lift constant drift (cosmetic)

`WormBody` computes jump lift with a hardcoded `0.55` multiplier (HealerWormMode.jsx:468)
while the crawler's history uses `JUMP_HEIGHT = SURFACE_JUMP_HEIGHT = 1.5`
(useWormCrawler.js:695). The head therefore jumps visibly higher than the neck attachment
point during the arc. If intentional (head leads the arc), a named constant would prevent an
accidental "fix"; if not, unify.

---

## 4. Maintainability findings

### A1 — HealerWormMode.jsx is a 3,269-line god file

Twenty render subsystems in one file. The breakdown doc's "first extraction pass" moved
constants + surface tiles out; continue it. Natural seams (each already self-contained with
module-scratch blocks):

```
healerWorm/
  WormBody.jsx            (422–861 + trail scratch)
  WormFace.jsx            (1113–1300)
  WormTrail.jsx           (327–419, 926–1112)
  WormholeRings.jsx       (1421–2220, incl. caution-tape helpers)
  TunnelPortals.jsx       (TunnelPortalRings + TunnelPortalFX, 2225–2533)
  SliceWarningLights.jsx  (2534–2761)
  effects/                (HeartBurst, HealBurst3D, OrbFlash, Thunk, CollisionGlow, PortalGlow, GlowWormAura)
  TunnelInteriorView.jsx  (79–326)
  ModeWrapper.jsx         (HealerWormMode3DWrapper, 2893–3184)
```

Zero runtime cost (same lazy chunk), large review-ability win — most PRs touch exactly one
subsystem. Do it before any further feature work in this file; at the current size every
diff is high-risk to review.

### A2 — useWormCrawler mixes simulation, economy, and store I/O

1,250 lines: phase machine + economy (F2) + rotation remapping + store sync + lifecycle
reset. After F2's economy extraction, the remaining candidates are the rotation-commit
subscription (lines 1126–1238 — a self-contained "keep everything glued to the surface
through a turn" module) and the run-reset block (1042–1114). The tick itself is fine as one
unit — it's a game loop.

### A3 — Document the singleton bridges as a contract

`liveRotation`, `liveCubies`, `tunnelState`, `wormTurnBridge`, `pressState`, `healBurstMap`
each have a comment, but the write/read ordering rules (who writes at which useFrame
priority) are the actual invariant. A short `src/worm/BRIDGES.md` (or a `runtime.js` barrel
re-exporting them with the ordering table) would make the frame-priority contract explicit —
today it's derivable only by reading CubeAssembly.

### A4 — `phaseHandlersRef._size` is stored on the ref object itself

useWormCrawler.js:520–521 stashes `_size` on the ref container rather than in `.current` or
a second ref. Works, but reads as a bug. One-line cleanup.

---

## 5. Prioritized roadmap

**Quick wins (small diffs, immediate effect)**
1. P1 — set `mesh.count` in WormholeRings (biggest render win in the mode).
2. P2 — take `wormholeCountdown` out of the monolithic HUD selector (bridge or leaf component).
3. P3 — cap the rotation-commit bake loop to body reach.
4. A4 / F7 — trivial cleanups.

**Structural (medium, do in this order)**
5. F1 — split `wormLogic.js`, delete dead segment-worm code (~600 lines + tests).
6. F2 — extract the deposit/heal/void economy into pure, tested functions.
7. F3 (+P5) — single shared tunnel registry keyed on `(cubies, rotationEpoch)`.
8. A1 — carve HealerWormMode.jsx into `healerWorm/` modules.

**Feature-complete / opportunistic**
9. F5 — cross-tunnel trail persistence (sentinel breaks in `pathHistory`).
10. F4 — gate run resets on `wormRunId` only.
11. P6 — single-context split-screen for the co-op platformer.
12. P4, P7, F6, A2, A3 — batch alongside adjacent work.

## Implemented on this branch

- **P1** — WormholeRings now sets `mesh.count` per frame (capacity-based write guards);
  the zero-scale scrubbing pass is gone.
- **P2** — `wormholeCountdown` moved out of the main HUD selector into `PauseMenu`,
  its only display site.
- **P3** — rotation-commit history bake capped to body reach (WormBody's formula).
- **A4** — phase-handler cache size stored inside the cached object.
- **F1 (dead-code half)** — legacy segment-worm APIs deleted from `wormLogic.js`
  (1,353 → 661 lines), including the orphaned `pressState`/worm-weight system and its
  never-firing per-frame reader in `CubeAssembly`; `getActiveTunnels` no longer
  allocates the two per-tunnel world-position vectors that only `findNextTunnel`
  consumed. The tunnelGeometry/tunnelRegistry/surfaceNavigation file split remains open.
