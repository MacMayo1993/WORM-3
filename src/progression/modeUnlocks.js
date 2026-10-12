// src/progression/modeUnlocks.js
// WORM Story is the game; the other modes open as the player clears its levels,
// so a first session is one clear thing to do instead of six doors at once.
//
// A save is in one of three gate states, kept in localStorage under
// MODE_GATE_KEY:
//   'new'   — a brand-new player whose first launch has not happened yet: the
//             intro hands them straight to Story level 1 instead of the menu.
//   'gated' — modes open by WORM levels cleared (MODE_UNLOCK_LEVELS).
//   'open'  — everything open: players who were already here before the gate
//             shipped, and the dev / ?unlockall=1 builds.
// Pure: no React, no store.
import { wormLevelsCompleted } from '../worm/wormUnlocks.js';

export const MODE_GATE_KEY = 'worm3_mode_gate';
export const MODE_GATES = ['new', 'gated', 'open'];

/** WORM levels cleared to open each carousel mode (ids as ModeCarousel uses them). */
export const MODE_UNLOCK_LEVELS = {
  worm: 0,
  store: 1,
  freeplay: 3,
  chaos: 5,
  random: 8,
  cube: 10
};

/** The carousel's display names, for unlock notices. */
export const MODE_UNLOCK_LABELS = {
  worm: 'WORM',
  store: 'Store',
  freeplay: 'Flip Cube',
  chaos: 'Chaos',
  random: 'Random',
  cube: 'Teach'
};

export const modeUnlockLevels = id => MODE_UNLOCK_LEVELS[id] ?? 0;

/**
 * The gate a save starts in. A stored gate wins; without one, a player who has
 * already seen the intro was here before the gate and keeps every mode open.
 */
export function resolveModeGate(stored, { introSeen = false, unlockAll = false } = {}) {
  if (unlockAll) return 'open';
  if (MODE_GATES.includes(stored)) return stored;
  return introSeen ? 'open' : 'new';
}

/** Whether a mode can be played. A mode the player has already launched stays open. */
export function isModeUnlocked(id, { progress, gate = 'gated', plays } = {}) {
  if (gate === 'open') return true;
  if (plays?.[id]?.plays > 0) return true;
  return wormLevelsCompleted(progress) >= modeUnlockLevels(id);
}

/** WORM levels still to clear before a mode opens (0 when open). */
export function levelsUntilModeUnlock(id, progress) {
  return Math.max(0, modeUnlockLevels(id) - wormLevelsCompleted(progress));
}

/** The short reason shown on a locked mode's key. */
export function modeLockText(id, progress) {
  const left = levelsUntilModeUnlock(id, progress);
  return `Clear ${left} more WORM level${left === 1 ? '' : 's'}`;
}

/** Modes a level clear just opened, in unlock order, for the result card. */
export function modesUnlockedBetween(before, after, gate = 'gated') {
  if (gate === 'open') return [];
  const was = wormLevelsCompleted(before);
  const now = wormLevelsCompleted(after);
  return Object.entries(MODE_UNLOCK_LEVELS)
    .filter(([, need]) => need > was && need <= now)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}
