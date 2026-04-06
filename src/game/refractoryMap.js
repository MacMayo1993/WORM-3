// src/game/refractoryMap.js
// Per-tile cooldown tracking — prevents rapid re-flipping of the same sticker.
// Shared across hooks (useCubeState, useParityDecay) via module-level Map.
//
// NOTE for tests: this module holds global state across test runs.
// Call clearRefractory() in beforeEach / afterEach when testing code that
// calls flipSticker, otherwise refractory state bleeds between test cases.

const _map = new Map();
const REFRACTORY_MS = 3000; // 3-second cooldown per tile

/** Returns true if the tile is still in its refractory window. */
export const isInRefractory = (x, y, z, dirKey) => {
  const last = _map.get(`${x}-${y}-${z}-${dirKey}`);
  return last != null && Date.now() - last < REFRACTORY_MS;
};

/** Mark a tile as just-flipped — starts the refractory timer. */
export const markFlipped = (x, y, z, dirKey) => {
  _map.set(`${x}-${y}-${z}-${dirKey}`, Date.now());
};

/** Clear all refractory state (on reset, shuffle, size change). */
export const clearRefractory = () => _map.clear();
