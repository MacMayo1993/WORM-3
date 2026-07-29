// src/game/sliceIndex.js
//
// The single canonical answer to "which cells are in this slice?".
//
// Why this exists
// ---------------
// The same three-comparison membership test had been written out five times —
// cubeRotation's rotation loop, CubeAssembly's drag-start and animation-start
// discovery loops, wormHelpers.rotateTilePosition, and wormLogic.isTileInSlice
// (the one actually documented as canonical, which nothing else called). Four of
// those five wrapped the test in a full `size³` walk to find `size²` cells: at
// size 7 that is 343 iterations to collect 49, and at the Mega Worm size of 15 it
// is 3,375 to collect 225. Generating the coordinates directly is both the same
// answer and the only version that scales.
//
// Everything that needs slice membership — logical rotation, renderer animation,
// warning geometry, worm ride and collision — must go through this module, so
// there is exactly one definition to be right about.
//
// Axis names map to grid coordinates the way they do everywhere else in the
// rotation pipeline: 'col' → x, 'row' → y, 'depth' → z.
//
// Linear index convention
// -----------------------
// `getSliceLinearIndices` returns flat indices in the repo's established
// flattening order, `x*size*size + y*size + z`. That is the order CubeAssembly's
// `positionCache` / `cubieRefs` are built in, the order `liveCubies.refs` is
// indexed by, and the order WormholeNetwork uses for its mesh lookup. Any new
// consumer must use the same order or it will address the wrong cubie.

/** Largest cube size the ordinary game modes support. */
export const MAX_STANDARD_SIZE = 7;

/** The Mega Worm cube size. Fixed — this is a performance tier, not a slider notch. */
export const MEGA_SIZE = 15;

/** Largest size any construction path may produce. */
export const MAX_CUBE_SIZE_ANY = MEGA_SIZE;

/**
 * Whether a grid cell lies in the given slice.
 *
 * Used to decide whether the worm (or any tile-anchored object) should ride a
 * slice that is mid-rotation so it turns with the cube instead of snapping at
 * commit time.
 */
export function isTileInSlice(axis, sliceIndex, x, y, z) {
  if (axis === 'col') return x === sliceIndex;
  if (axis === 'row') return y === sliceIndex;
  if (axis === 'depth') return z === sliceIndex;
  return false;
}

/**
 * Visit every cell of a slice exactly once, in O(size²).
 *
 * The callback receives (x, y, z) — no object is allocated per cell, so this is
 * safe to call from a commit path or a frame loop.
 *
 * Iteration order is the two free axes ascending, outer loop first, which for
 * every axis yields the same relative ordering the old `size³` walk produced
 * (that walk visited x→y→z and skipped non-members, so the surviving order was
 * always "the two free axes ascending"). Callers that relied on it — none do
 * today, but the property is cheap to keep — are unaffected.
 */
export function forEachSliceCoordinate(size, axis, sliceIndex, callback) {
  if (!Number.isInteger(sliceIndex) || sliceIndex < 0 || sliceIndex >= size) return;
  if (axis === 'col') {
    for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) callback(sliceIndex, y, z);
  } else if (axis === 'row') {
    for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) callback(x, sliceIndex, z);
  } else if (axis === 'depth') {
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) callback(x, y, sliceIndex);
  }
}

// Cache of flat index lists. A slice's membership depends only on
// (size, axis, sliceIndex) — never on cube state — so these are computed once
// and live for the process. The whole cache at size 15 is 45 arrays × 225 ints
// ≈ 40 KB, and it removes the per-rotation allocation the callers used to do.
const _linearIndexCache = new Map();

/**
 * Flat cubie indices for a slice, in `x*size*size + y*size + z` order.
 *
 * Returns a shared, cached Int32Array — treat it as read-only. Returns an empty
 * array for an out-of-range slice or an unknown axis rather than throwing, so a
 * renderer frame loop can't be taken down by a stale index mid-transition.
 */
export function getSliceLinearIndices(size, axis, sliceIndex) {
  const key = `${size}|${axis}|${sliceIndex}`;
  const hit = _linearIndexCache.get(key);
  if (hit) return hit;

  const out = new Int32Array(
    (axis === 'col' || axis === 'row' || axis === 'depth') &&
    Number.isInteger(sliceIndex) && sliceIndex >= 0 && sliceIndex < size
      ? size * size
      : 0
  );
  let n = 0;
  forEachSliceCoordinate(size, axis, sliceIndex, (x, y, z) => {
    out[n++] = x * size * size + y * size + z;
  });
  _linearIndexCache.set(key, out);
  return out;
}

/** Drop the cached index lists. For tests that want to assert on cache behaviour. */
export function resetSliceIndexCache() {
  _linearIndexCache.clear();
}

/**
 * Which plane of a rotation wave owns this cell, or -1 for none.
 *
 * O(1) in the number of planes — a wave holds at most three, and they are
 * parallel and disjoint, so the first match is the only match. This is the
 * lookup every per-cell consumer should use during a wave (step-history bake,
 * collision classification, orb ride) instead of testing each plane in turn.
 *
 * @param {{axis: string, rotations: Array<{sliceIndex: number}>}|null} wave
 * @returns {number} index into `wave.rotations`, or -1
 */
export function getActivePlaneForCoordinate(wave, x, y, z) {
  if (!wave) return -1;
  const axis = wave.axis;
  // Reduce the cell to its coordinate on the wave's axis once, then compare —
  // the planes share an axis by construction, so the branch is hoisted out of
  // the loop rather than re-evaluated per plane.
  const coord = axis === 'col' ? x : axis === 'row' ? y : axis === 'depth' ? z : -1;
  if (coord < 0) return -1;
  const rots = wave.rotations;
  for (let i = 0; i < rots.length; i++) {
    if (rots[i].sliceIndex === coord) return i;
  }
  return -1;
}
