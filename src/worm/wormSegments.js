// src/worm/wormSegments.js
//
// Where the worm's body actually is on screen, published for effects to aim at.
//
// Same singleton-bridge pattern as liveCubies: a value that changes every frame and
// is only ever READ by renderers does not belong in Zustand, where each write would
// re-run every subscriber's selector across the whole app.
//
// The positions are hard to recompute from outside. WormBody walks a ring buffer of
// step history along a curve, applies the live slice rotation to any point sitting
// in a turning layer, and thins segments by camera distance — a sibling component
// that tried to re-derive that would drift out of sync with what is drawn, which for
// a lightning strike means bolts landing next to the worm instead of on it. WormBody
// already computes every segment's world position; this records them as it goes.
//
// STRICTLY render-only. Nothing here feeds the simulation, and a consumer must treat
// the contents as advisory: `count` can be 0 for a frame during resets and phase
// changes, and stale entries beyond `count` are not cleared.

const MAX_PUBLISHED = 96;

export const wormSegments = {
  /** Segment world positions, packed xyz. Only the first `count * 3` are valid. */
  positions: new Float32Array(MAX_PUBLISHED * 3),
  /** How many segments are live this frame. */
  count: 0,
  /** Frame-ish counter, bumped on every publish — lets a reader spot a stale feed. */
  epoch: 0,
  max: MAX_PUBLISHED
};

/** Start a frame's publication. Called by WormBody before it writes any segment. */
export function beginWormSegments() {
  wormSegments.count = 0;
}

/**
 * Record one segment's world position. Silently drops anything past the cap — a
 * mega-worm has hundreds of segments and an effect does not need them all.
 */
export function pushWormSegment(x, y, z) {
  const i = wormSegments.count;
  if (i >= MAX_PUBLISHED) return;
  wormSegments.positions[i * 3] = x;
  wormSegments.positions[i * 3 + 1] = y;
  wormSegments.positions[i * 3 + 2] = z;
  wormSegments.count = i + 1;
}

/** Close a frame's publication. */
export function endWormSegments() {
  wormSegments.epoch++;
}

/** Zero the feed — run reset, death and mode unmount all go through here. */
export function resetWormSegments() {
  wormSegments.count = 0;
  wormSegments.epoch = 0;
}
