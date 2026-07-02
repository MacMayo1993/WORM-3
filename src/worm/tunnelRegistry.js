// src/worm/tunnelRegistry.js
//
// Single owner of the live tile→tunnel lookup (tileKey → { tunnel, tunnelKey, reversed }).
//
// Why this exists
// ---------------
// Tunnel data used to be computed by two independent systems that could disagree:
// the crawler kept an exact lookup rebuilt in a React effect (so the first tick after
// a flip could still read the pre-flip lookup), while WormholeRings and the
// finalHealing sweep each ran their own full getActiveTunnels scan on their own
// schedule (debounced up to 400 ms behind the crawler's truth). One memoized owner,
// queried synchronously with the live store cubies, gives every consumer the same
// answer for the same cube state — and makes a flip visible to the crawler on the
// very tick it happens.
//
// Caching mirrors src/game/manifoldMapStore.js: keyed on (cubies identity, size,
// rotationEpoch). Flips swap only the affected cubie objects at fixed geometry, so a
// same-epoch change takes the cheap incremental path (only changed cubies rescanned);
// a rotation/size change (new epoch) forces a full rebuild.
//
// Contract for callers
// --------------------
//  - ALWAYS pass the live store `cubies` + `rotationEpoch` (useGameStore.getState()).
//    Passing a lagged/debounced snapshot would incrementally "update" the shared map
//    backwards and corrupt it for every other consumer. Consumers that render from a
//    debounced snapshot (WormholeRings) may still ANNOTATE from this live lookup —
//    string keys don't hold sticker references — but must never build it from lag.
//  - Treat the returned Map as read-only.

import { getManifoldMap } from '../game/manifoldMapStore.js';
import { buildTunnelLookup, updateTunnelLookupIncremental } from './wormLogic.js';

const _cache = { cubies: null, size: -1, epoch: -1, lookup: null };

/**
 * Return the tile→tunnel lookup for the current cube state.
 *
 * O(1) on a cache hit (same cubies identity). On a flip/heal at the same epoch it
 * re-examines only the cubies whose object identity changed; on an epoch or size
 * change it does one full O(size³×6) rebuild.
 *
 * @param {Array} cubies - committed live store cubies
 * @param {number} size  - cube size
 * @param {number} epoch - rotationEpoch that produced `cubies`
 * @returns {Map} tileKey "x,y,z,dirKey" → { tunnel, tunnelKey, reversed }
 */
export function getTunnelLookup(cubies, size, epoch) {
  const c = _cache;
  if (c.lookup && c.cubies === cubies && c.size === size && c.epoch === epoch) return c.lookup;

  const manifoldMap = getManifoldMap(cubies, size, epoch);
  if (c.lookup && c.cubies && c.size === size && c.epoch === epoch) {
    updateTunnelLookupIncremental(c.lookup, cubies, c.cubies, size, manifoldMap);
  } else {
    c.lookup = buildTunnelLookup(cubies, size, manifoldMap);
  }
  c.cubies = cubies;
  c.size = size;
  c.epoch = epoch;
  return c.lookup;
}

/**
 * Whether any antipodal tunnel is currently open. The lookup holds two entries per
 * tunnel (one per endpoint), so emptiness is exactly "no active tunnels".
 */
export function hasActiveTunnels(cubies, size, epoch) {
  return getTunnelLookup(cubies, size, epoch).size > 0;
}

/** Drop the cached lookup. Call on teardown and between tests for isolation. */
export function resetTunnelRegistry() {
  _cache.cubies = null;
  _cache.size = -1;
  _cache.epoch = -1;
  _cache.lookup = null;
}
