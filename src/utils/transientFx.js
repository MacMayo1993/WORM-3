// src/utils/transientFx.js
//
// Helpers for the transient FX maps in the game store (cubiePops, tunnelBirths,
// tunnelPulses). Entries are { startMs, durationMs } keyed by cubie position or
// tunnel pairId; readers poll them imperatively each frame and treat an expired
// entry exactly like a missing one. Nothing ever deleted entries, so the maps
// retained every animation ever fired and each write re-spread the whole
// (monotonically growing) object. Pruning at write time keeps them bounded to
// the animations actually in flight.

/**
 * Drop entries whose animation window has fully elapsed.
 *
 * Returns the SAME object reference when nothing expired, so useShallow
 * subscribers (e.g. MobiusTunnel on tunnelBirths/tunnelPulses) don't
 * re-render when the map is already clean.
 *
 * @param {Object} map - { key: { startMs, durationMs } }
 * @param {number} now - current clock in the same timebase as startMs (performance.now())
 * @returns {Object} pruned map, or `map` itself if nothing expired
 */
export const pruneExpiredFx = (map, now) => {
  let pruned = null;
  for (const k in map) {
    const e = map[k];
    if (e && now - e.startMs >= e.durationMs) {
      if (!pruned) pruned = { ...map };
      delete pruned[k];
    }
  }
  return pruned ?? map;
};
