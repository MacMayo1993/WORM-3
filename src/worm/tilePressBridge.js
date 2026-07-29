// src/worm/tilePressBridge.js
//
// How hard the worm is standing on each tile.
//
// The worm's weight has to reach the cube's stickers every frame, and the cube is
// drawn by the ordinary React tree (CubeAssembly → Cubie → StickerPlane, ~300 of
// them on a 7×7). Routing this through the store would re-render that tree on
// every crawl step for what is purely a per-frame visual, so it goes through a
// plain module-level map instead — the same pattern liveRotation and liveCubies
// already use to hand the worm's world to the cube's renderer.
//
// Keyed by manifold grid id (`M<face>-<idx>`), which is derived from a sticker's
// ORIGINAL home and so names the physical tile rather than a grid slot: a dent
// stays with the tile it was made on when a slice turns underneath it.
//
// The press itself is a real spring rather than an ease, because the thing being
// modelled is weight: it sinks fast under the worm and rebounds past level once
// the worm has moved on, which is what makes the surface read as springy rather
// than as something that got dented and slowly forgot about it.

const K = 210;    // spring stiffness — how hard the tile is pulled toward its target
const DAMP = 19;  // damping; ζ ≈ 0.65, so one visible rebound and then still
const MAX_DT = 0.05;

// Below this the tile is at rest and stops being tracked (and its sticker stops
// being ticked). Small enough that the rebound has visibly finished.
const REST_EPS = 0.0015;
const REST_V_EPS = 0.02;

// A very long worm covers a lot of ground, and every pressed tile costs an active
// sticker tick plus a drawn border. Past this many the oldest covered tiles simply
// do not light — the head end is what anyone is looking at.
export const MAX_PRESSED_TILES = 64;

/** Colour the lit squares burn in — the equipped worm skin's body colour. */
export const wormPress = {
  color: '#33ff66'
};

// gridId -> { p, v, target }. `p` may go slightly negative on the rebound — that is
// the tile popping back proud of the surface, and it is deliberate.
const tiles = new Map();

/**
 * Ask for `amount` (0..1) of press on a tile this frame. Called once per covered
 * tile per frame; the largest request wins, so overlapping body segments do not
 * stack into a deeper dent than the worm can make.
 */
export function pressTile(gridId, amount) {
  if (!gridId) return;
  const a = amount < 0 ? 0 : amount > 1 ? 1 : amount;
  const entry = tiles.get(gridId);
  if (entry) {
    if (a > entry.target) entry.target = a;
  } else {
    tiles.set(gridId, { p: 0, v: 0, target: a });
  }
}

/**
 * Advance every tracked tile's spring, then clear the frame's targets so a tile
 * the worm has left starts rebounding on the very next frame without anyone
 * having to say so.
 *
 * @returns {number} tiles still moving — for callers that want to know whether
 *   anything is happening without walking the map themselves.
 */
export function tickWormPress(delta) {
  const dt = delta > MAX_DT ? MAX_DT : delta;
  for (const [key, e] of tiles) {
    e.v += ((e.target - e.p) * K - e.v * DAMP) * dt;
    e.p += e.v * dt;
    if (e.target === 0 && Math.abs(e.p) < REST_EPS && Math.abs(e.v) < REST_V_EPS) {
      // Settled flat: drop it so idle tiles cost nothing.
      e.p = 0;
      tiles.delete(key);
      continue;
    }
    e.target = 0;
  }
  return tiles.size;
}

/** Current press of a tile: 1 = fully under the worm, 0 = flat, <0 = rebounding proud. */
export function getWormPress(gridId) {
  return gridId ? (tiles.get(gridId)?.p ?? 0) : 0;
}

/** Whether any tile is still moving — cheap enough to call per frame. */
export function anyWormPress() {
  return tiles.size > 0;
}

/** Drop every dent. Called when a run resets, so a new worm starts on a flat cube. */
export function resetWormPress() {
  tiles.clear();
}
