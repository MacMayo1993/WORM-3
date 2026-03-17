# WORM-3 Code Review: Modularization & Optimization Opportunities

**Date:** 2026-03-17
**Scope:** Full `src/` directory — 190 files, ~49,625 LOC

---

## Executive Summary

The architecture is fundamentally sound: pure game logic in `src/game/`, Zustand state management, and functional components throughout. The main issues are **component monolithism** (19 files exceed 600 lines) and **code duplication patterns**. No major bugs detected.

---

## 1. Critical Monoliths (600+ Lines)

| File | Lines | Primary Issue |
|------|-------|---------------|
| `src/worm/HealerWormMode.jsx` | 2,041 | 93 hooks; worm physics, UI, death handling, healing all in one |
| `src/3d/styles/TileStyleMaterials.jsx` | 1,840 | 10+ shader styles embedded as inline strings |
| `src/3d/LifeJourneyBackgrounds.jsx` | 1,782 | 9 separate environment components in one file |
| `src/3d/StickerPlane.jsx` | 1,382 | Rendering, flip logic, biome logic, 3 embedded shaders |
| `src/App.jsx` | 1,148 | All mode initialization, menu state, keyboard handlers mixed |
| `src/3d/CubeAssembly.jsx` | 913 | Drag, rotation, touch, camera all in one component |
| `src/teach/TeachMode.jsx` | 868 | Solver integration + algorithm hints + UI coordination |
| `src/3d/CityBuildings.jsx` | 1,033 | Building generation, LOD, street layout, animation |
| `src/components/menus/WormModeSetupWizard.jsx` | 778 | 5+ wizard steps without step components |
| `src/components/menus/FreeplaySetupWizard.jsx` | 726 | Duplicates WormModeSetupWizard patterns |
| `src/components/menus/SettingsMenu.jsx` | 649 | Color, tile style, background, image upload all inline |
| `src/components/menus/MainMenu.jsx` | 607 | Menu navigation + intro cube + all button handlers |

---

## 2. Specific Refactoring Plans

### A. `HealerWormMode.jsx` (2,041 → ~4 files @ ~400 lines each) — CRITICAL

Split into:
- `useWormCrawler.js` — crawler position/body segment state (already logically grouped internally)
- `useWormPhysics.js` — jump, gravity, collision detection math
- `useWormHealing.js` — healing system, powerup pickups, health tracking
- `WormHUD.jsx` — death menu, retry UI, health bar overlay
- `HealerWormMode.jsx` — thin orchestrator (~300 lines)

### B. `TileStyleMaterials.jsx` (1,840 → ~12 files)

Create `src/3d/styles/shaders/` directory:
- `WaterShader.js`, `LavaShader.js`, `IceShader.js`, `GalaxyShader.js`, `NeuralShader.js`, etc.
- `TileShaderRegistry.js` — registers and retrieves compiled materials
- Cache compiled materials in a `Map` keyed by `styleId + configHash` to avoid recompilation

### C. `LifeJourneyBackgrounds.jsx` (1,782 → ~11 files)

- `BaseEnvironment.jsx` — shared InstancedMesh setup, particle system, tile layout
- `src/3d/environments/` directory with one file per level environment
- `useEnvironmentGeometry.js` hook for shared InstancedMesh setup logic

### D. `StickerPlane.jsx` (1,382 → ~4 files)

- `src/3d/shaders/StickerShaders.js` — spider, hazard crack, parityBreak shader definitions
- `useStickerFlip.js` — flip detection, flip animation state
- `useBiomeSticker.js` — biome-specific color/material overrides
- `StickerPlane.jsx` — rendering only (~300 lines)

### E. `App.jsx` (1,148 → ~700 lines + hooks)

Extract mode initialization hooks:
- `useChaosModeSetup.js`
- `useDisparitySetup.js`
- `useWormSetup.js`
- `useModeManager.js` — centralize all mode switching (currently scattered across App)
- `useMenuState.js` — welcome, settings, level select, intro animation state
- Keep `App.jsx` focused on Canvas layout and screen transitions

### F. Setup Wizards (778 + 726 lines — shared duplication)

Both wizards share: step navigation, cube size selector, difficulty selector, visual mode selector.

- `WizardStep.jsx` — base step wrapper with consistent header/footer UI
- `CubeSizeStep.jsx`, `DifficultyStep.jsx`, `VisualModeStep.jsx` — shared form steps
- `useWizardFlow.js` — step navigation, validation, submit handler

### G. `SettingsMenu.jsx` (649 → ~4 panels @ ~150 lines each)

- `ColorPanel.jsx`
- `TileStylePanel.jsx`
- `BackgroundPanel.jsx`
- `useImageUpload.js` — image upload/preview/crop logic

---

## 3. Code Duplication Patterns

### A. Cube access pattern — affects 7+ files
```javascript
// Repeated 100+ times:
cubies[x]?.[y]?.[z]?.stickers?.[dirKey]
```
**Fix:** Add `getStickerSafe(cubies, x, y, z, dir)` to `src/game/cubeState.js`.

### B. Direction/vector mappings
`DIR_TO_COLOR`, `COLOR_TO_DIR` redefined in `solveDetection.js` when they already exist in `constants.js`.

**Fix:** Remove duplicates, import from `src/utils/constants.js` as single source of truth.

### C. Three.js vector pre-allocation
`CubeAssembly.jsx` and `StickerPlane.jsx` both do module-level vector pre-allocation with different patterns.

**Fix:** Document a shared pre-allocation pattern; consider a `useVectorPool()` hook or a shared `src/utils/vectorPool.js`.

---

## 4. Performance Opportunities

### A. Shader material caching
`TileStyleMaterials.jsx` creates shader materials without caching. On re-renders, these are recompiled.

**Fix:** Cache in a `Map<styleId, THREE.ShaderMaterial>` and return cached instance on repeat calls.

### B. Manifold map rebuilding
`useCubeState()` rebuilds the manifold map on every rotation. The result is passed redundantly to multiple components including `HealerWormMode`.

**Fix:** Cache in Zustand store with a `rotationEpoch` invalidation key; expose via a single `useManifoldMap()` hook.

### C. Hook over-proliferation
`HealerWormMode.jsx` has 93 hook declarations. Many are derived state that could be computed in a single `useMemo` or extracted to a custom hook to reduce re-evaluation surface.

### D. `getActiveTunnels()` called multiple times per frame
**Fix:** Memoize the result or lift it to a store subscription that updates only on rotation events.

---

## 5. Architecture Notes

### What's already good
- `src/game/` pure-function pattern is excellent — easy to test, zero React coupling
- Zustand `subscribeWithSelector` is correctly used
- `useShallow()` for store subscriptions prevents over-rendering
- Mobile input handling is comprehensive
- Vector pre-allocation in hot render paths shows performance awareness

### Mode system needs a unified interface
Currently 8+ modes (Classic, Chaos, Disparity, Worm/Healer, Teach, Coop, Holonomy, Biome, Merge) are initialized ad-hoc in `App.jsx` with no shared interface.

**Fix:** Create `src/modes/ModeSystem.js` with a `GameMode` base interface:
```javascript
// Each mode exports an object conforming to:
{
  init(store, config) {},   // called on mode enter
  cleanup(store) {},         // called on mode exit
  handleInput(event) {},     // optional input overrides
}
```
Then `useModeManager.js` drives transitions through this interface.

### Testing gaps
Current tests cover `cubeRotation`, `tilingGraph`, `mergeRegions`. Missing:
- `winDetection.js` — no tests
- `solveDetection.js` — no tests (complex CFOP state machine)
- `antipodalIntegrity.js` — no tests
- Hook integration tests

---

## 6. Priority Roadmap

### Phase 1 — Quick Wins (~7 hours total)
1. `getStickerSafe()` utility + consolidate direction mappings (1h)
2. Split `SettingsMenu` into 4 panels (2h)
3. Extract `TileStyleMaterials` shaders to `src/3d/styles/shaders/` (3h)
4. Create `WizardStep` base + shared form-step components (1h)

### Phase 2 — Core Refactoring (~17 hours total)
1. Split `HealerWormMode.jsx` into 5 files (8h)
2. Extract `App.jsx` mode initialization to dedicated hooks (5h)
3. Refactor `CubeAssembly.jsx` input/camera handling (4h)

### Phase 3 — Environment & Polish (~11 hours total)
1. Consolidate `LifeJourneyBackgrounds` + `BackgroundEnvironments` with `BaseEnvironment` (5h)
2. Refactor `TeachMode.jsx` and `CityBuildings.jsx` (6h)

### Phase 4 — Test Coverage & Docs (~5-10 hours)
- Tests for `winDetection`, `solveDetection`, `antipodalIntegrity`
- Update `CLAUDE.md` with new directory structure
- Document mode system interface

**Estimated total effort: 40-50 hours**

---

## 7. Metrics Summary

| Metric | Current | Target |
|--------|---------|--------|
| Largest file | 2,041 lines | < 800 lines |
| Files > 600 LOC | 19 | 0 |
| Avg file size | ~261 LOC | 150–200 LOC |
| Max hooks per component | 93 | < 20 |
| Identified duplication patterns | 7+ | Extracted to utilities |
| Test coverage (game logic files) | ~30% | > 80% |
