# Performance Review: Worm Mode + Disparity Mode at Large Cube Sizes

**Date:** 2026-06-10
**Scope:** `src/worm/` (Healer Worm mode), disparity/chaos mode, and the shared 3D rendering layer they sit on.
**Symptom:** Smooth at sizes 3–5, stutters at 6–7 (max supported size is 7, `src/game/cubeState.js:6`).

## Why 6–7 stutters when 3–5 is fine

Sticker count grows as 6n² and cubie count as n³, but several systems pay **superlinear** cost on top of that growth:

| Size | Stickers (6n²) | Cubies (n³) | vs. size 5 |
|------|----------------|-------------|------------|
| 5    | 150            | 125         | 1.0×       |
| 6    | 216            | 216         | 1.4× stickers, 1.7× cubies |
| 7    | 294            | 343         | 2.0× stickers, 2.7× cubies |

A size-7 cube has ~2× the stickers of size 5, but because each sticker carries its own `useFrame` callback, its own (potential) shader material, and 3–6 extra meshes for volume tile styles, the *per-sticker* cost also rises with scene complexity. 16.7 ms/frame budget that was comfortable at 150 stickers is blown at 294.

The findings below are ordered by expected impact. Line numbers were verified against the current branch head.

---

## Part 1 — Shared rendering layer (affects both modes, biggest wins)

### 1.1 One `useFrame` callback per sticker — O(6n²) callbacks/frame  ⚠️ HIGHEST IMPACT

**`src/3d/StickerPlane.jsx:799`** — every `StickerPlane` registers its own `useFrame`. At size 7 that is **294 callback invocations per frame, 17,600/sec at 60 fps**, before any of them do real work.

The callback already has a good `anyActive` early-out gate (`StickerPlane.jsx:861-865`), but even the gate costs: ~8 boolean terms, several ref reads, `meta?.flips` access, plus the R3F scheduler overhead of dispatching 294 subscribers. Idle tiles still pay the dispatch + gate price every frame.

**Fix:** replace per-sticker `useFrame` with a single manager loop (same pattern already used by `StickerInstances.jsx`, which batches all solid stickers into one `InstancedMesh` + one `useFrame`):

- Keep a module-level registry `Map<gridId, stickerHandle>` of *active* stickers only (tiles enter on flip/shake/heal trigger, leave when their animation settles).
- One `useFrame` in `CubeAssembly` iterates only the active set. Idle tiles cost literally zero.
- The per-sticker handles expose refs (`spinT`, `shakeT`, material uniforms) so the manager mutates them exactly as the per-sticker callbacks do today.

**Expected gain:** 2–4 ms/frame at size 7. This is the single biggest structural win.

### 1.2 Volume tile styles create 3–6 un-instanced meshes per sticker

**`src/3d/StickerPlane.jsx:1425-1464`** — when a volume style (lava, ice, water, neural, circuit, galaxy, wood, grass) is active, each sticker mounts its own `<LavaVolume/>` etc. Each volume component creates its own geometries and meshes (LavaVolume ≈ 4 meshes, NeuralVolume ≈ 6). At size 7 with a lava skin: **294 × 4 ≈ 1,200 extra draw calls** vs. ~1 for the instanced solid path.

**Fix (in order of effort):**
1. Hoist geometries to module-level shared constants (one `PlaneGeometry`/`BoxGeometry` per style, like `_sharedStickerGeo`). Cheap, immediate GPU-memory and setup win.
2. Longer-term: render each volume style as a per-style `InstancedMesh` set (one instanced draw per sub-mesh per style), mirroring `StickerInstances`.
3. Quick mitigation: at `size >= 6`, automatically fall back volume styles to their flat shader equivalents (the shader styles are already cached/instridge-friendly). A "performance fallback" conditional in `StickerPlane.jsx:1425` is a one-line guard per style.

**Expected gain:** up to 4–7 ms/frame at size 7 when a volume style is equipped; zero effect when not.

### 1.3 Shader material churn during flips

**`src/3d/StickerPlane.jsx:996` and `:1338`** — mid-flip and on color change, the mesh is reassigned a new material from `getTileStyleMaterial(...)`. The LRU cache in `src/3d/styles/TileStyleMaterials.jsx:89-121` (`MAX_MAT_CACHE = 200`) absorbs most of this, but at large sizes with antipodal color variants the key space (style × faceColor × antipodalColor) can exceed 200, causing evictions → `material.dispose()` → **shader recompiles mid-game** (tens of ms hitch, exactly the "stutter" signature).

**Fix:**
- Raise `MAX_MAT_CACHE` to ~500 (materials are small; the GPU programs are the expensive part and they're what eviction destroys).
- Pre-warm the cache for the *current* style with all 6 face colors × their antipodal partners on game start (extend the existing warm-up at `TileStyleMaterials.jsx:256-277`).

**Expected gain:** eliminates intermittent 20–100 ms hitches on first flips of each color combo.

### 1.4 Full cubie re-render on every move

**`src/3d/CubeAssembly.jsx:919-928`** — the `items` array is rebuilt from `cubies` on every rotation, so all n³ `Cubie` children reconcile (memo comparators at `Cubie.jsx` cut the damage, but the comparator itself iterates 6 sticker dirs × n³ cubies). At size 7 that's 343 comparator runs + slice re-renders per move. Noticeable as a small hitch on each move at size 7, worse during auto-scramble.

**Fix:** keep stable cubie object identity for unrotated cubies (the rotation logic should reuse untouched cubie references rather than recreating them — check `rotateSliceCubies`); then the memo comparator exits on reference equality for ~6/7ths of the cube.

---

## Part 2 — Worm mode (`src/worm/HealerWormMode.jsx`)

### 2.1 WormholeRings: O(flipped-stickers) loop recomputes static data every frame  ⚠️ HIGH

**`HealerWormMode.jsx:2360-2660`** — the rings `useFrame` iterates `allPositions` (every flipped visible sticker, worst case 6n² = 294 at size 7). Throttling already exists (20 Hz crawling / 60 Hz in tunnels, lines 2360-2373) — good — but each iteration:

- Calls `getStickerWorldPos(x, y, z, dirKey, size, 0)` (`:2403`) which **allocates 2–3 arrays per call** (`src/game/coordinates.js:47-66`) and recomputes a value that is constant for the lifetime of the `allPositions` entry.
- Looks up `FACE_NORMALS[dirKey]` per frame for the same reason.
- For void/critical tunnels, runs nested loops: 5 bubbles, 7 sparks, 4 poles, 4 tapes, 4 frame segments per tile — each with quaternion/matrix math.

**Fix (low risk, high value):** precompute in the `allPositions` useMemo (`:2319-2352`):

```js
result.push({
  x, y, z, dirKey: dk,
  tunnelKey: ...,
  wp: getStickerWorldPos(x, y, z, dk, size, 0),   // cache once
  normal: FACE_NORMALS[dk] ?? FACE_NORMALS.PZ,     // cache once
});
```

Then the frame loop does zero allocation and zero recompute for positions/normals. Additionally: early-return when `allPositions.length === 0` *before* touching the eight instanced mesh refs, and only set the eight `instanceMatrix.needsUpdate` flags (`:2652-2660`) for meshes whose count actually changed or that contain animated instances.

### 2.2 `allPositions` rebuild runs two full O(6n³) scans per cube change

**`HealerWormMode.jsx:2320-2321`** — `buildManifoldGridMap` + `getActiveTunnels` each walk all cubies × 6 dirs. The 200 ms debounce (`:2311-2315`) caps this at 5×/sec, but at chaos L4 (~12 flips/sec) the debounce timer keeps resetting… and then fires a full rebuild. At size 7 each rebuild is ~2,000 map insertions + tunnel pairing.

**Fix:** the debounce currently *delays* but still rebuilds on every settled change. Two options:
- Raise the debounce to 350–500 ms during `crawling` phase (the rings are throttled to 20 Hz there anyway; visual latency is invisible).
- Better: maintain the manifold map incrementally — flips only mutate `st.curr/st.flips` on known stickers; a flip event can patch the map and tunnel set in O(1) instead of O(n³). The chaos worker already knows exactly which stickers it flipped each tick.

### 2.3 WormBody: up to `MAX_TAIL` (1200) matrix writes per frame

**`HealerWormMode.jsx:1581-1716`** — the tail loop runs `min(MAX_TAIL, tailLength)` iterations with `setMatrixAt` + `setColorAt` each frame. Tail length scales with orbs eaten, and larger cubes host longer runs. 1,200 iterations × vector math ≈ 1–2 ms/frame on mid-range hardware.

**Fix:**
- Set `instanceColor.needsUpdate` only when a color actually changed (track an epoch on orb pickup instead of rewriting colors every frame).
- Distance-LOD the tail: render every segment near the head, every 2nd segment beyond ~200, every 4th beyond ~600 (scale segments up slightly to hide gaps). Cuts worst case from 1,200 to ~450 writes with no visible difference at gameplay camera distance.

### 2.4 Nine separate `useFrame` callbacks in one mode

WormChaseCamera (`:1212`), TunnelSurfFX (`:1385`), WormBody (`:1581`), GlowWormAura (`:1761`), PortalGlow (`:1785`), WormholeRings (`:2360`), TunnelPortalRings (`:2735`), RainbowSpiralRing (`:2875`), ThunkEffect (`:3030`), main phase loop (`:3219`). Each is individually fine; collectively they add scheduler overhead and scattered `getState()` reads. Low priority, but if 1.1's manager pattern is built, fold the small ones (aura, portal glow, spiral ring) into it.

### 2.5 PowerupOrbs memo invalidated by every cubie change

**`HealerWormMode.jsx:1955-1970`** — orb colors recompute (hex parse + luminance per orb) with `cubies` in the dependency array, so every flip/rotation re-runs it even when orbs didn't change. Cheap in absolute terms (~24 orbs) but easy to fix: key the memo on `wormPowerups` + a small derived signature (the orbs' sticker `curr` values) instead of the whole `cubies` array.

---

## Part 3 — Disparity (chaos) mode

### 3.1 TopMenuBar stats: full O(n³) scan every 500 ms

**`src/components/menus/TopMenuBar.jsx:105-146`** — while chaos is active, a `setInterval(compute, 500)` walks **all cubies** (including the n³−(n−2)³ shells *and* interior access) and `Object.entries` every sticker, then `setChaosStats(...)` re-renders the menu bar. At size 7: ~294 sticker visits + object allocation, twice a second, on the main thread, *concurrent with* the worker doing the same accounting.

**Fix:** the chaos worker already maintains `cachedMetrics` (`src/workers/chaosWorker.js`) and posts metrics to the main thread (`useChaosWorker.js:132-135` stores them in refs). Pipe those into the store (or a tiny event emitter) and delete the TopMenuBar interval scan entirely. Zero new computation, one less redundant system.

### 3.2 Duplicate manifold map build + full cubies structured-clone per rotation

**`src/hooks/useChaosWorker.js:148-179`** — on chaos start *and on every rotation* (`rotationEpoch` effect at `:170-179`), the main thread:
1. Rebuilds `buildManifoldGridMap(cubies, size)` — O(6n³), duplicating work the worker also does after `SYNC_CUBIES`.
2. Posts the **entire cubies array** via `postMessage` — a structured clone of ~150 KB+ at size 7, on the rotation critical path (right when a frame hitch is most visible).

**Fix:**
- Keep `SYNC_CUBIES` (the comment at `:172-175` explains why it must fire on rotations), but make the main-thread `buildManifoldGridMap` lazy: consumers of `manifoldMapRef` can rebuild on demand instead of eagerly per rotation, or the worker can return its map keys with its next tick.
- Reduce the payload: post the rotation parameters (axis, index, direction) and let the worker apply the same pure `rotateSliceCubies` to its own copy — `src/game/` functions are React-free by design (CLAUDE.md), so the worker can import them directly. This turns ~150 KB clones into a 3-field message.

### 3.3 DisparityHUD re-renders on every death with whole-array subscription

**`src/components/overlays/DisparityHUD.jsx:115-123`** — subscribes to `disparityDeaths` (full array, new reference per death). At chaos L4–5 deaths arrive several per second; each re-runs the HUD's sorting/grouping memos. Subscribe instead to `s.disparityDeaths.length` + last element, and derive groups in a memo keyed on length.

### 3.4 DisparityHealthBar churn

`src/3d/DisparityHealthBar.jsx` is memoized (good), but each flip increments `meta.flips`, re-rendering the parent StickerPlane subtree. This is inherent to per-sticker rendering and mostly disappears once 1.1 lands. Optional mitigation for now: skip health bars below 25% damage at `size >= 6`.

---

## What is already done well (don't redo)

- **`StickerInstances.jsx`** — all solid stickers batched in one `InstancedMesh`, one `useFrame`, raycast disabled. This is the template the rest should follow.
- **Shared tremor state** — one trig computation per frame instead of per-sticker (`CubeAssembly.jsx:759-763`, `TileStyleMaterials.jsx:56-64`).
- **Shader warm-up** on load (`TileStyleMaterials.jsx:256-277`) and the material LRU cache (just undersized).
- **WormholeRings throttle** (20 Hz crawl / 60 Hz tunnel) and the cubies debounce — right idea; this review extends both.
- **Per-sticker death lookup** via `disparityDeathByGridId` dict selector (`StickerPlane.jsx:641`) — O(1), correct pattern.
- **Chaos worker** — flip logic correctly off the main thread.

---

## Prioritized roadmap

### Phase 1 — quick wins, low risk ✅ IMPLEMENTED (2026-06-10, this branch)
1. ✅ Cache `wp` + `normal` in `allPositions` entries; early-exit empty WormholeRings frames; zero-out only up to last frame's high-water marks (was ~8,000 writes/frame at size 7 even when idle); upload instance buffers only when written (§2.1).
2. ✅ TopMenuBar interval scans removed/guarded: chaos stats now pushed from the worker through the store (`chaosStats`), worker metrics extended with `totalFlips`/`deadTiles`, initial snapshot posted on START; the 200 ms completion-stats poll now skips when the cubies reference is unchanged (§3.1).
3. ✅ `MAX_MAT_CACHE` raised to 500; warm-up extended to the equipped per-face styles and to explicit antipodal-partner color variants (§1.3).
4. ✅ DisparityHUD `sortedGroups` walks backward from the newest death and stops at the oldest visible rank instead of rescanning the full death history (§3.3).
5. ✅ Volume styles (lava, ice, water, neural, circuit, galaxy, wood, grass) share geometries and per-face-color materials at module level via `getVolumeResource`, with `dispose={null}` so R3F never disposes shared resources; was 3–6 fresh geometries + materials per sticker per mount (§1.2 step 1).

### Phase 2 — structural, medium risk (~2–4 days)
6. Single animation-manager `useFrame` with an active-sticker registry; remove per-sticker callbacks (§1.1). **Biggest single gain.**
7. ✅ Worker-side rotation: `lastRotation` posted as a lightweight `ROTATE_SLICE` message instead of cloning cubies; main-thread manifold rebuild is now lazy (invalidated on rotation, rebuilt on the next flip-bearing TICK) instead of eager per rotation (§3.2).
8. WormBody tail LOD + color-epoch updates (§2.3).

### Phase 3 — polish (~as needed)
9. ✅ Auto-fallback to flat shader styles at `size >= 6` (§1.2): `StickerPlane.jsx`'s volume group (`GrassBlades`/`WaterVolume`/`LavaVolume`/`IceVolume`/`GalaxyVolume`/`NeuralVolume`/`CircuitVolume`/`WoodVolume`) is now set `visible={false}` via a `suppressVolumeFX` flag when the cube size is 6 or 7, leaving the already-present flat shader-styled sticker quad as the fallback. Full instanced-volume-styles rework remains a longer-term option if the visual loss at 6-7 is judged too aggressive.
10. Incremental manifold-map maintenance from flip events (§2.2).
11. ✅ Stable cubie identity across rotations for cheap memo bailouts (§1.4) — already implemented: `rotateSliceCubies` (`src/game/cubeRotation.js`) only replaces cubie object references for cubies inside the rotating slice, and `Cubie.jsx`'s `cubiePropsAreEqual` comparator relies on that reference equality to bail out early for the ~6/7ths of the cube that didn't rotate.
12. Adaptive quality tier (dynamic DPR clamp / effect toggles keyed to a moving frame-time average) — see also `docs/rendering-optimization-audit.md` §B; sizes 6–7 could default to the reduced tier.

**Combined expected effect at size 7:** Phases 1–2 should recover roughly 5–9 ms/frame in worm mode and remove the per-rotation/per-death hitches in disparity mode — enough to bring 6–7 in line with how 3–5 feels today.
