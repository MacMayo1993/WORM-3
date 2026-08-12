/**
 * useGameStore - Zustand State Management
 *
 * Central state store for WORM³.
 *
 * The store itself is an assembly: each domain lives in its own slice under
 * src/hooks/storeSlices/, following the pattern createWormSlice established.
 * This file owns three things and nothing else — the assembly order, the
 * derived selectors, and persistence.
 *
 * Adding state? Put it in the slice that owns the concept, and add its key to
 * src/__tests__/gameStoreSurface.test.js.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MODES, FLIP_CAP } from '../utils/constants.js';
import {
  createCubeSlice,
  createSessionSlice,
  createVisualSlice,
  createChaosSlice,
  createDisparitySlice,
  createWormSlice,
  createUiSlice,
  createModesSlice,
  createSettingsSlice,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION_KEY,
  CURRENT_SETTINGS_VERSION,
  PARITY_POINTS_KEY,
  OWNED_ITEMS_KEY,
  BET_STREAK_KEY,
} from './storeSlices/index.js';

export { MAX_UNDO_HISTORY } from './storeSlices/sessionDefaults.js';

export const useGameStore = create(
  subscribeWithSelector((set, get) => ({
    ...createCubeSlice(set, get),
    ...createSessionSlice(set, get),
    ...createVisualSlice(set, get),
    ...createChaosSlice(set, get),
    ...createDisparitySlice(set, get),
    ...createWormSlice(set, get),
    ...createUiSlice(set, get),
    ...createModesSlice(set, get),
    ...createSettingsSlice(set, get),
  }))
);

// ── Derived selectors ───────────────────────────────────────────────────────

/**
 * The flip cap actually in force right now.
 *
 * Disparity/Chaos sessions run on the cap chosen in the setup wizard
 * (3 / 8 / 13 / 20); everything else runs on the standard-play constant. This is
 * the ONE place that decision is made — the simulation, the player's own flip
 * path, the per-tile health bars, the wormhole network's sever threshold and the
 * HUD's dead-tile readout all read it, so a tile that looks alive is a tile the
 * player can still flip.
 *
 * @param {object} state - Zustand store state
 * @returns {number} flips a tile survives before it burns out
 */
export const selectEffectiveFlipCap = (state) =>
  state.chaosLevel > 0 ? state.disparityFlipCap : FLIP_CAP;

/**
 * Returns the single active game mode identifier.
 *
 * Priority order matches the original design: worm-healer overrides teach,
 * teach overrides holonomy, etc. Use with `useGameStore(getActiveMode)`.
 *
 * Note this resolves conflicts rather than preventing them — the underlying mode
 * flags are independent booleans, so two really can be set at once and the
 * loser keeps running its effects. Collapsing them into one `activeMode` field
 * behind this selector is the next step.
 *
 * @param {object} state - Zustand store state
 * @returns {string} One of the MODES values
 */
export const getActiveMode = (state) => {
  if (state.wormHealerMode)         return MODES.WORM_HEALER;
  if (state.teachModeActive)        return MODES.TEACH;
  if (state.holonomyMode)           return MODES.HOLONOMY;
  if (state.mergeMode)              return MODES.MERGE;
  if (state.hollowMode)             return MODES.HOLLOW;
  if (state.mirrorMode)             return MODES.MIRROR;
  if (state.chaosLevel > 0)         return MODES.CHAOS;
  if (state.flipMode)               return MODES.FLIP;
  return MODES.FREEPLAY;
};

// ── Persistence ─────────────────────────────────────────────────────────────
// Every persisted slice is written by subscription, never inline in an action.
//
// The wallet used to be the exception: `localStorage.setItem(PARITY_POINTS_KEY,…)`
// was hand-copied into six actions (earn, spend, buy, cash-out, round-begin,
// refund), so any future writer of parityPoints that forgot the line would lose
// the player's money on reload. Settings already had the right pattern; the
// wallet, purchases and streak now use it too.
const persist = (key, serialise = String) => (value) => {
  try {
    localStorage.setItem(key, serialise(value));
  } catch { /* storage unavailable (private mode, quota) — state stays in memory */ }
};

useGameStore.subscribe(
  (state) => state.settings,
  (settings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(SETTINGS_VERSION_KEY, String(CURRENT_SETTINGS_VERSION));
    } catch { }
  }
);

useGameStore.subscribe((state) => state.parityPoints, persist(PARITY_POINTS_KEY));
useGameStore.subscribe((state) => state.ownedItems, persist(OWNED_ITEMS_KEY, JSON.stringify));
useGameStore.subscribe((state) => state.betStreak, persist(BET_STREAK_KEY));
