# Merge Mode — Incremental Implementation Design Document

**Date:** 2026-03-09
**Branch:** `claude/evolving-tiles-feature-LkzDd`
**Status:** Foundation committed; rendering pipeline not yet wired.

---

## What Has Been Built

The following pieces exist on disk but are not yet fully connected:

| File | State |
|---|---|
| `src/game/mergeRegions.js` | Complete — pure BFS region-tier computation |
| `src/components/screens/MergeThemePicker.jsx` | Complete — theme picker UI |
| `src/hooks/useGameStore.js` | Partial — state keys added (`mergeMode`, `mergeTheme`, `mergeRegionTiers`), no reactivity |
| `src/App.jsx` | Partial — handlers wired, props passed into `handlers` bag |
| `src/components/menus/MainMenu.jsx` | Partial — `MergeIcon` + nav item added, but `onMerge` prop never passed from `UILayer` |
| `src/components/UILayer.jsx` | **Missing** — `MergeThemePicker` not mounted; `onMenuMerge` and `onMerge` not threaded through |
| `src/3d/StickerPlane.jsx` | **Missing** — no tier-based visual rendering |
| `public/merge-mode/` | Stub only — folder structure defined, no images present |

---

## Gap Analysis

### Gap 1 — UILayer does not mount `MergeThemePicker`
`App.jsx` passes `showMergeThemePicker`, `onMergeStart`, and `onMergeCancel` inside the `handlers` prop, but `UILayer.jsx` never destructures them and never renders `<MergeThemePicker>`. The picker is unreachable at runtime.

### Gap 2 — `MainMenu` never receives `onMerge`
`UILayer.jsx` renders `<MainMenu>` with hard-coded props. `onMenuMerge` from the `handlers` bag is not forwarded, so clicking the Merge nav item does nothing.

### Gap 3 — `computeMergeRegions` is never called
`mergeRegionTiers` in the store is always `{}`. Nothing calls `computeMergeRegions` after a rotation or shuffle, so tiers are never populated.

### Gap 4 — `StickerPlane` has no tier-aware rendering
Even if tiers were populated, no component reads `mergeRegionTiers` or renders the PNG overlays (`tier1.png` / `tier2.png` / `tier3.png`) or the tier-2 pulse animation.

### Gap 5 — Theme image assets are missing
`public/merge-mode/<theme>/<colorN>/tier{1,2,3}.png` files do not exist. Without them, tier-3 "pop-out" and tier-2 overlay rendering will silently show nothing.

---

## Incremental Implementation Steps

### Step 1 — Thread `onMerge` through UILayer into MainMenu
**Files:** `src/components/UILayer.jsx`
**Scope:** ~5 lines.

1. Destructure `onMenuMerge` from `handlers` in `UILayer`.
2. Add `onMerge={onMenuMerge}` to the `<MainMenu …>` JSX.

**Verification:** Clicking "Merge" in the main menu now calls `handleMenuMerge` in `App.jsx`, which sets `showMergeThemePicker = true` and hides the main menu.

---

### Step 2 — Mount `MergeThemePicker` in UILayer
**Files:** `src/components/UILayer.jsx`
**Scope:** ~8 lines.

1. Destructure `showMergeThemePicker`, `onMergeStart`, `onMergeCancel` from `handlers`.
2. Add a lazy-mounted block alongside the existing wizard blocks:

```jsx
{showMergeThemePicker && (
  <Suspense fallback={null}>
    <MergeThemePicker onStart={onMergeStart} onBack={onMergeCancel} />
  </Suspense>
)}
```

3. Add `import { lazy } from 'react'` guard and lazy-import `MergeThemePicker` using the same pattern as `FreeplaySetupWizard`.

**Verification:** Selecting a theme and pressing "Enter the Cube" calls `handleMergeStart(themeId)` in `App.jsx`, which sets `mergeMode = true`, `mergeTheme = themeId`, resets the game, and shuffles.

---

### Step 3 — Call `computeMergeRegions` after every rotation
**Files:** `src/hooks/useCubeState.js` (or wherever `rotateSliceCubies` results are committed to the store)
**Scope:** ~10 lines.

After any call to `setCubies` (post-rotation or post-shuffle), if `mergeMode` is active:

```js
import { computeMergeRegions } from '../game/mergeRegions.js';

// inside the rotation commit path:
const { mergeMode, size } = useGameStore.getState();
if (mergeMode) {
  const tiers = computeMergeRegions(newCubies, size);
  useGameStore.getState().setMergeRegionTiers(tiers);
}
```

The `homeKey` format (`${origPos.x}-${origPos.y}-${origPos.z}-${origDir}`) already matches what `StickerPlane` has access to via `meta.origPos` and `meta.origDir`.

**Verification:** After a rotation with `mergeMode` on, `useGameStore.getState().mergeRegionTiers` contains non-empty entries with values 1, 2, or 3.

---

### Step 4 — Create `MergeTileOverlay` component
**Files:** `src/3d/MergeTileOverlay.jsx` (new file)
**Scope:** ~80 lines.

A Three.js/R3F component rendered inside each `StickerPlane` when `mergeMode` is active. Reads the tier for the current sticker's home key from the store and:

| Tier | Visual |
|---|---|
| 1 | Nothing extra — default cube sticker appearance |
| 2 | Semi-transparent PNG overlay (`tier2.png`) + pulsing scale animation via `useFrame` |
| 3 | Full `tier3.png` image popping out on the `+z` (normal) axis; brief scale-up "pop" on transition |

Implementation sketch:

```jsx
// src/3d/MergeTileOverlay.jsx
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';

export default function MergeTileOverlay({ homeKey, themeId, colorIndex }) {
  const tier = useGameStore(s => s.mergeRegionTiers[homeKey] ?? 1);
  const meshRef = useRef();

  const tier2Src = `/WORM-3/merge-mode/${themeId}/color${colorIndex}/tier2.png`;
  const tier3Src = `/WORM-3/merge-mode/${themeId}/color${colorIndex}/tier3.png`;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (tier === 2) {
      const s = 1 + 0.06 * Math.sin(clock.getElapsedTime() * 3.5);
      meshRef.current.scale.setScalar(s);
    } else if (tier === 3) {
      meshRef.current.position.z = 0.04; // pop forward
    }
  });

  if (tier === 1) return null;

  const src = tier === 3 ? tier3Src : tier2Src;
  return (
    <mesh ref={meshRef} position={[0, 0, 0.02]}>
      <planeGeometry args={[0.8, 0.8]} />
      <meshBasicMaterial map={useTexture(src)} transparent alphaTest={0.05} depthWrite={false} />
    </mesh>
  );
}
```

Note: `useTexture` caches by URL so repeated stickers for the same tier/theme only load once.

---

### Step 5 — Integrate `MergeTileOverlay` into `StickerPlane`
**Files:** `src/3d/StickerPlane.jsx`
**Scope:** ~15 lines.

1. Read `mergeMode` and `mergeTheme` from the store (add to the existing `useShallow` batch or a separate selector).
2. Derive `homeKey` from the sticker's `origPos` + `origDir` (already available as `meta.origPos` and `meta.origDir`).
3. Derive `colorIndex` from `sticker.curr` (face ID 1–6).
4. Render `<MergeTileOverlay>` as a sibling to the existing sticker mesh when `mergeMode && homeKey`:

```jsx
{mergeMode && homeKey && (
  <MergeTileOverlay
    homeKey={homeKey}
    themeId={mergeTheme}
    colorIndex={sticker.curr}
  />
)}
```

**Verification:** With placeholder PNG files in place, evolving regions show the tier-2 pulse and tier-3 pop-out on the cube surface.

---

### Step 6 — Add theme image assets
**Path:** `public/merge-mode/<theme>/color<N>/tier{1,2,3}.png`
**Scope:** 6 themes × 6 colors × 3 tiers = 108 PNG files.

Required directory structure (one example):

```
public/merge-mode/
└── pokemon/
    ├── color1/   ← Red face (PZ)
    │   ├── tier1.png   ← e.g. Charmander
    │   ├── tier2.png   ← e.g. Charmeleon
    │   └── tier3.png   ← e.g. Charizard
    ├── color2/   ← Green face (NX)
    │   ├── tier1.png
    │   ├── tier2.png
    │   └── tier3.png
    … (color3–color6)
└── dnd/
    … (same structure)
```

All images: **PNG with transparent background**, square, **256×256px** minimum.

Tier-1 images are loaded but visually suppressed (opacity 0 / not rendered). They can be omitted if `MergeTileOverlay` returns `null` for tier 1 — the README structure still documents them for completeness.

---

### Step 7 — Win/score integration (optional, future)
**Files:** `src/game/winDetection.js`, `src/hooks/useGameStore.js`
**Scope:** TBD.

Possible additions:
- Track count of `tier === 3` faces as a "Merge Score".
- Fire a confetti/victory event when all 6 faces reach tier 3 simultaneously.
- Persist best merge score to `localStorage` alongside existing settings.

---

## Dependency Order

```
Step 1 ──▶ Step 2        (UI routing must exist before game can start)
             │
             ▼
           Step 3        (tiers must be computed before visuals can read them)
             │
             ▼
           Step 4        (overlay component must exist before it can be imported)
             │
             ▼
           Step 5        (StickerPlane wires overlay into the render tree)
             │
             ▼
           Step 6        (images give the overlay something to display)
             │
             ▼
           Step 7        (win/score — independent, can be done any time after Step 3)
```

Steps 1 and 2 are independent of Steps 3–6 but must come first for the game loop to be reachable. Steps 4 and 5 can be developed in parallel (Step 4 just needs a stub export).

---

## Testing Checkpoints

| After Step | Manual verification |
|---|---|
| 1 | Clicking "Merge" in the menu opens the theme picker screen |
| 2 | Selecting a theme and pressing "Enter the Cube" starts a shuffled game |
| 3 | `useGameStore.getState().mergeRegionTiers` is non-empty after a rotation |
| 4 | `MergeTileOverlay` renders without errors with placeholder images |
| 5 | Tier-2 stickers pulse; tier-3 stickers pop forward on the 3D cube |
| 6 | Correct character images appear per theme and face color |

Unit test candidates (add to `src/__tests__/`):
- `mergeRegions.test.js` — test BFS on a solved 3×3 (all tier-3), a freshly shuffled cube (mostly tier-1), and a hand-crafted partial region.

---

## Files Modified / Created Per Step

| Step | Creates | Modifies |
|---|---|---|
| 1 | — | `UILayer.jsx` |
| 2 | — | `UILayer.jsx` |
| 3 | — | `useCubeState.js` (or rotation hook) |
| 4 | `MergeTileOverlay.jsx` | — |
| 5 | — | `StickerPlane.jsx` |
| 6 | 108 PNG assets | `public/merge-mode/` directories |
| 7 | — | `winDetection.js`, `useGameStore.js` |
