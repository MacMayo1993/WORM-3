// src/worm/healerWorm/safeLane.js
// Where the worm can stand when the next layer turns.
//
// The problem this exists to solve is geometric, and it is worst on the small
// boards. A move picks one of 3N (axis, sliceIndex) pairs; every surface tile
// carries three coordinates, so it sits on exactly 3 of those slices. A uniformly
// chosen turn therefore catches any given tile with probability 3/(3N) = 1/N —
// 50% on a 2x2, 33% on a 3x3. Subdividing the crawl grid does NOT change that
// number: the exposed fraction depends on the slice count, not on how finely the
// surface is tiled. The only honest fixes are to change which slice turns, or to
// make the complement legible and worth running to. This module does the latter.
//
// The complement of the threatened slice is an awkward shape to draw, but it does
// not need to be drawn whole: any slice on the SAME axis with a different index is
// entirely safe, because the turn only moves cells whose coordinate on that axis
// matches. So the "safe lane" is itself a slice, and LayerHighlight — which already
// knows how to rim a slice — can render it with no new geometry.
//
// Everything here is a pure function of (size, move). No store, no refs, no clock.

/** Move axis → the grid coordinate it slices on. Mirrors cubeRotation/liveRotation. */
export const AXIS_COORD = { col: 'x', row: 'y', depth: 'z' };

/**
 * Every plane a move turns. A hazard turn on Mega spins two non-adjacent planes,
 * so `sliceIndices` is the truth when present and `sliceIndex` is the fallback —
 * the same precedence SliceWarningLights and liveRotation use.
 */
export function pendingLayers(move) {
  if (!move) return [];
  if (move.sliceIndices?.length) return move.sliceIndices;
  return typeof move.sliceIndex === 'number' ? [move.sliceIndex] : [];
}

/**
 * Surface tiles on one slice. An end slice carries its whole cap face (size²) plus
 * the ring it cuts across the four side faces (4·size); an interior slice is the
 * ring alone. This is what makes end slices so much harsher on a small board:
 * 39% of a 3x3's surface versus 22% for a middle slice.
 */
export function sliceTileCount(size, sliceIndex) {
  const ring = 4 * size;
  return (sliceIndex === 0 || sliceIndex === size - 1) ? size * size + ring : ring;
}

/**
 * Pick the slice to advertise as safe for a pending move, or null when the move
 * leaves no lane free (every index on the axis is turning — only reachable if a
 * future move ever turns the whole cube).
 *
 * Preference order, all deterministic so the lane never flickers mid-warning:
 *   1. Farthest from any turning plane — the most margin if the player misjudges.
 *   2. Then the most tiles, so the lane is somewhere to move around in rather
 *      than a tightrope.
 *   3. Then the lowest index.
 */
export function chooseSafeLane(size, move) {
  const layers = pendingLayers(move);
  if (!move?.axis || layers.length === 0) return null;

  let best = null;
  for (let i = 0; i < size; i++) {
    if (layers.includes(i)) continue;
    let margin = Infinity;
    for (const layer of layers) margin = Math.min(margin, Math.abs(i - layer));
    const tiles = sliceTileCount(size, i);
    if (
      best === null ||
      margin > best.margin ||
      (margin === best.margin && tiles > best.tiles)
    ) {
      best = { axis: move.axis, sliceIndex: i, margin, tiles };
    }
  }
  return best;
}

/** Whether a grid cell sits on a lane produced by chooseSafeLane. */
export function isTileOnLane(lane, x, y, z) {
  if (!lane) return false;
  const coord = lane.axis === 'col' ? x : lane.axis === 'row' ? y : lane.axis === 'depth' ? z : null;
  return coord === lane.sliceIndex;
}
