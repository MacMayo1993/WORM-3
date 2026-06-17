// src/game/manifoldMapStore.js
//
// Single owner of the *live* manifold grid map (gridId → { x, y, z, dirKey, sticker }).
//
// Why this exists
// ---------------
// The manifold map is a pure function of cube GEOMETRY. Geometry only changes on a
// rotation, size change, or shuffle — exactly the events that bump `rotationEpoch`.
// Sticker flips move nothing (they only mutate `curr`/`flips` in place), so they never
// invalidate this map. That invariant is the whole reason `rotationEpoch` can serve as the
// single source of truth for "when must the map be rebuilt".
//
// Before this module, the map was rebuilt independently in 6+ places (useCubeState, the
// worm tunnel-lookup effect, tunnel-entry material assignment, healing labels, …), each
// with its own cache keyed on its own cubies reference and its own assumptions about when
// it goes stale. That duplication is what made the rotation → manifold → worm path fragile:
// if any one consumer's cache drifted from the committed cube state, only that consumer
// silently corrupted.
//
// Keying a single cache on (size, epoch) gives every subsystem the same map for a given
// epoch with one rebuild, and — importantly — a *fresh* Map reference whenever the epoch
// advances, so React.memo'd consumers that receive the map as a prop re-render correctly on
// rotation while staying reference-stable across flips.
//
// Contract for callers
// --------------------
//  - Pass the committed store `cubies` together with that cube's `rotationEpoch`.
//  - Consumers that deliberately operate on a lagged/debounced snapshot (e.g. the
//    decorative WormholeRings, which throttles its scan) must NOT use this owner — their
//    cubies are not the live epoch's, so they keep their own cache.

import { buildManifoldGridMap } from './manifoldLogic.js';

let _epoch = -1;
let _size = -1;
let _map = null;

/**
 * Return the manifold grid map for the current cube geometry.
 *
 * O(1) on a cache hit (same size + epoch); a single O(size³×6) rebuild when the epoch
 * advances. Flips share the cached map for free because they never change geometry.
 *
 * @param {Array} cubies - committed store cubies for this epoch
 * @param {number} size  - cube size
 * @param {number} epoch - rotationEpoch that produced `cubies`
 * @returns {Map} gridId → { x, y, z, dirKey, sticker }
 */
export function getManifoldMap(cubies, size, epoch) {
  if (_map && _epoch === epoch && _size === size) return _map;
  _map = buildManifoldGridMap(cubies, size);
  _epoch = epoch;
  _size = size;
  return _map;
}

/** Drop the cached map. Call on teardown and between tests for isolation. */
export function resetManifoldMap() {
  _epoch = -1;
  _size = -1;
  _map = null;
}
