/**
 * storeSlices — the pieces useGameStore is assembled from.
 *
 * Each slice is a `(set, get) => ({ ...state, ...actions })` factory owning one
 * domain, following the pattern createWormSlice established. The split follows
 * the section banners the store already carried, so nothing moved domains.
 *
 * Adding state: put it in the slice that owns the concept, then add its key to
 * src/__tests__/gameStoreSurface.test.js — that contract test is what catches a
 * slice dropped from the assembly, which would otherwise only show up as a
 * runtime "x is not a function" inside a component.
 */

export { createCubeSlice } from './cubeSlice.js';
export { createSessionSlice } from './sessionSlice.js';
export { createVisualSlice } from './visualSlice.js';
export { createChaosSlice } from './chaosSlice.js';
export { createDisparitySlice } from './disparitySlice.js';
export { createWormSlice } from './wormSlice.js';
export { createUiSlice } from './uiSlice.js';
export { createModesSlice } from './modesSlice.js';
export { createSettingsSlice } from './settingsSlice.js';

export { persistedState, SETTINGS_STORAGE_KEY, SETTINGS_VERSION_KEY, CURRENT_SETTINGS_VERSION, PARITY_POINTS_KEY, OWNED_ITEMS_KEY, BET_STREAK_KEY } from './persistedState.js';
export { makeDisparityRuntimeDefaults, makeWormSessionDefaults, MAX_UNDO_HISTORY } from './sessionDefaults.js';
