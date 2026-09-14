# Merge Mode — Implementation Readiness & Optimization Plan

**Date:** 2026-03-09  
**Purpose:** Answer two practical questions before implementation mode starts:
1) **Where are we currently at?**
2) **What can we optimize next?**

## 1) Current Status (as of this branch)

### Overall

Merge Mode is **functionally wired but content-incomplete**.

- ✅ Entry flow is connected (Main Menu → Merge Theme Picker → game start).
- ✅ Runtime state exists (`mergeMode`, `mergeTheme`, `mergeRegionTiers`).
- ✅ Tier computation runs after key gameplay actions (rotate + shuffle).
- ✅ Renderer integration is present (`StickerPlane` mounts `MergeTileOverlay`).
- ❌ Theme image packs are still missing from `public/merge-mode/**`.
- ⚠️ Reliability and test coverage are not yet at implementation-ready quality.

### Progress Snapshot by Area

| Area | Status | Notes |
|---|---|---|
| Menu + picker routing | Done | User can launch merge flow from main menu. |
| Store state contract | Done | Store has merge keys + setters. |
| Region algorithm wiring | Mostly done | Recompute is present after rotate/shuffle. |
| Overlay rendering path | Done | `MergeTileOverlay` reads tier per home key. |
| Asset pipeline | Blocked | Theme/color/tier PNG files are not present. |
| Automated tests | Not started | No merge-specific tests in `src/__tests__`. |
| Lifecycle hardening | Partial | Enter flow exists; exit/cleanup semantics not fully explicit. |

---

## 2) What We Can Optimize (priority order)

### P0 — Unblock visuals with placeholder assets

**Why:** Without images, the mode appears broken even if logic is correct.

- Add one complete placeholder theme first: `public/merge-mode/<theme>/color1..6/tier1..3.png`.
- Validate that tier-2 pulse and tier-3 pop are visible in runtime.
- After validation, scale to remaining themes.

### P1 — Make tier recomputation exhaustive and deterministic

**Why:** Region tiers should never be stale after any cube mutation path.

- Recompute tiers on `reset()` and `changeSize()` when `mergeMode` is active.
- Consider centralizing cube-mutation post-processing (single place to trigger merge recompute).
- Optionally clear `mergeRegionTiers` when merge mode is disabled.

### P1 — Add focused tests to prevent regressions

**Why:** Merge mode behavior is algorithmic and easy to break silently.

- Add `mergeRegions.test.js` for:
  - solved cube (expect all tier-3),
  - mixed/partial regions,
  - small-cube boundaries.
- Add one integration-style store/flow test for merge start/cancel semantics.

### P2 — Performance polish for larger cubes

**Why:** Tier recomputation cost scales with face tiles and rotation frequency.

- Memoize or incrementally update face-region calculations where feasible.
- Keep `MergeTileOverlay` lightweight (no unnecessary re-renders).
- Add debug counters for tier distribution to detect expensive edge cases.

### P2 — Product semantics and lifecycle clarity

**Why:** Reduces ambiguity and future mode conflicts.

- Define canonical “enter merge mode” and “exit merge mode” transitions.
- Decide whether switching to other modes automatically disables merge mode.
- Document persistence expectations (`mergeTheme` remembered vs reset).

---

## 3) Practical “Next 1–2 PRs” Plan

### PR A (Unblock + Reliability)

1. Add one placeholder theme asset pack.
2. Ensure merge tiers recompute on reset/size change paths.
3. Add quick manual verification notes (menu, shuffle, rotate, reset, size change).

### PR B (Tests + Hardening)

1. Add `mergeRegions.test.js` coverage.
2. Add basic merge flow state test.
3. Add explicit merge exit cleanup behavior and document it.

---

## 4) Definition of Done for Implementation Mode

Merge Mode is considered implementation-ready when:

- Menu-to-game merge flow works consistently.
- Tier map updates correctly on all user-visible board state changes.
- At least one full theme renders tier visuals end-to-end.
- Merge-specific tests pass in CI.
- Mode enter/exit semantics are explicit and deterministic.

---

## Quick File Pointers

- Flow wiring: `src/App.jsx`, `src/components/UILayer.jsx`, `src/components/menus/MainMenu.jsx`, `src/components/screens/MergeThemePicker.jsx`
- State: `src/hooks/useGameStore.js`
- Recompute hooks: `src/hooks/useCubeState.js`
- Rendering: `src/3d/StickerPlane.jsx`, `src/3d/MergeTileOverlay.jsx`
- Assets root: `public/merge-mode/`
