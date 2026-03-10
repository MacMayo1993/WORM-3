// src/game/quantumState.js
// Quantum Superposition mechanics for WORM-3
//
// Stickers can exist in a superposition of two colors simultaneously.
// The superposition collapses to a definite color when the sticker is
// disturbed by a rotation (the "measurement" that collapses the wave function).
//
// Terminology:
//   color1 = the sticker's current definite color (what the real cube shows)
//   color2 = the alternate superposed color (the phantom/ghost state)
//   seed   = deterministic random [0,1) used for collapse outcome + flicker phase

import { ANTIPODAL_COLOR } from '../utils/constants.js';

/** Stable key for a sticker location */
export const stickerKey = (x, y, z, dirKey) => `${x}-${y}-${z}-${dirKey}`;

/**
 * Mark a fraction of surface stickers as superposed.
 * Returns an object keyed by stickerKey → { x, y, z, dirKey, color1, color2, seed }.
 *
 * color2 is always the antipodal counterpart of color1, creating the classic
 * RP² identity flip as the "other" quantum state.
 *
 * @param {Array} cubies  3D cubie array
 * @param {number} size   Cube size
 * @param {number} ratio  Fraction of stickers to superpose (0–1), default 0.45
 */
export const createSuperposition = (cubies, size, ratio = 0.45) => {
  const superposed = {};
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          // Dead tiles cannot be superposed
          if ((st.flips || 0) >= 25) continue;
          if (Math.random() < ratio) {
            const key = stickerKey(x, y, z, dirKey);
            superposed[key] = {
              x, y, z, dirKey,
              color1: st.curr,
              color2: ANTIPODAL_COLOR[st.curr],
              seed: Math.random(),
            };
          }
        }
      }
    }
  }
  return superposed;
};

/**
 * Collapse superposed stickers in a rotated slice.
 * The "measurement" (rotation) forces each superposed sticker in the slice to
 * commit to one of its two colors based on its deterministic seed.
 *
 * Returns [newSuperposed, collapseEvents] where collapseEvents is an array of
 * { x, y, z, dirKey, collapsedColor } for visual feedback / state patching.
 *
 * @param {Object} superposed   Current superposed stickers map
 * @param {number} size         Cube size
 * @param {string} axis         'row' | 'col' | 'depth'
 * @param {number} sliceIndex   Which slice index was rotated
 */
export const collapseSlice = (superposed, size, axis, sliceIndex) => {
  const next = { ...superposed };
  const events = [];

  for (const [key, entry] of Object.entries(superposed)) {
    const { x, y, z } = entry;
    const inSlice =
      (axis === 'col'   && x === sliceIndex) ||
      (axis === 'row'   && y === sliceIndex) ||
      (axis === 'depth' && z === sliceIndex);

    if (inSlice) {
      // Wave function collapse — seed < 0.5 keeps color1, else takes color2
      const collapsedColor = entry.seed < 0.5 ? entry.color1 : entry.color2;
      events.push({ ...entry, collapsedColor });
      delete next[key];
    }
  }

  return [next, events];
};

/**
 * Apply collapse results directly to cubies.
 * Follows the shallow-clone pattern from cubeRotation.js — only the two
 * cubie objects that actually change are deep-replaced.
 *
 * @param {Array}  cubies         3D cubie array (already rotated by this slice)
 * @param {Array}  collapseEvents Output of collapseSlice
 */
export const applyCollapse = (cubies, collapseEvents) => {
  if (!collapseEvents.length) return cubies;
  const next = cubies.map(L => L.map(R => R.slice()));
  for (const ev of collapseEvents) {
    const { x, y, z, dirKey, collapsedColor } = ev;
    // After rotation x/y/z coordinates have already shifted — we need the
    // NEW coordinates.  The collapseSlice event carries the PRE-rotation
    // coords; we must remap them via the axis/sliceIndex transform.
    // However, we only alter the color value, which is stored in sticker.curr.
    // The sticker object lives at the NEW grid position after rotation, but
    // the event { x, y, z, dirKey } still reflects the old position.
    // Strategy: look up by old-position at the new cubies array (rotation
    // already committed the geometry move), and patch the *color* only.
    const c = next[x]?.[y]?.[z];
    if (!c) continue;
    const st = c.stickers[dirKey];
    if (!st) continue;
    const stickers = { ...c.stickers };
    stickers[dirKey] = { ...st, curr: collapsedColor };
    next[x][y][z] = { ...c, stickers };
  }
  return next;
};

/**
 * Remove a single sticker from superposition (e.g., when manually flipped).
 */
export const removeSuperposition = (superposed, x, y, z, dirKey) => {
  const key = stickerKey(x, y, z, dirKey);
  if (!superposed[key]) return superposed;
  const next = { ...superposed };
  delete next[key];
  return next;
};

/**
 * Clear all superpositions (called on reset / new game).
 */
export const clearSuperposition = () => ({});
