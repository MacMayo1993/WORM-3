// src/worm/healerWorm/bombs.js
// Bomberman-style bombs for WORM healer mode — a timed hazard layered on top of
// the wormhole-heal loop. A bomb spawns on a random surface tile with a lit fuse.
// When the fuse hits zero it detonates a plus-shaped blast: BOMB_BLAST_RADIUS
// tiles straight out in each of the four face-local directions (up/down/left/
// right), folding across cube seams exactly like the worm crawls. The blast
// kills the worm if it catches the head and burns the tail off (like a rotation
// cut) if it catches a body segment — it never touches the surface tiles.
//
// The player disarms a bomb by surrounding it with the worm's body, the SAME
// eight-cell encirclement that heals a wormhole (getWormholeHealRing). All the
// geometry here is pure and reused from wormLogic so bombs wrap the manifold the
// same way every other WORM system does.

import { getNextSurfacePosition, getWormholeHealRing } from '../wormLogic.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING } from './constants.js';

// ─── Tuning ──────────────────────────────────────────────────────────────────
export const BOMB_FUSE_SECONDS = 5; // countdown from spawn to detonation
export const BOMB_BLAST_RADIUS = 3; // tiles each arm reaches (the "3 out" of Bomberman)
export const BOMB_SPAWN_INTERVAL = 11; // seconds between spawn attempts
export const BOMB_DISARM_REWARD = 12; // coins for surrounding a live bomb

// Four face-local headings the blast fires along — the Bomberman plus.
const BLAST_DIRS = ['up', 'right', 'down', 'left'];

/**
 * How many bombs may be live at once. Scales gently with the board so a mega
 * cube isn't trivially safe, but stays low enough that the surface never fills
 * with fuses the player can't reach.
 * @param {number} size
 * @returns {number}
 */
export function bombCap(size) {
  return size <= 3 ? 1 : size <= 4 ? 2 : 3;
}

/**
 * The unique tile key ("x,y,z,dirKey") for a tile-like object.
 * @param {{x:number,y:number,z:number,dirKey:string}} t
 * @returns {string}
 */
export function tileKeyOf(t) {
  return `${t.x},${t.y},${t.z},${t.dirKey}`;
}

/**
 * Compute the plus-shaped blast footprint for a bomb.
 *
 * The centre tile plus up to BOMB_BLAST_RADIUS tiles along each of the four
 * face-local directions. An arm stops early if it runs off a valid surface cell
 * (getNextSurfacePosition returns null), which can only happen at a degenerate
 * boundary — normal seam crossings just re-label the heading on the new face.
 *
 * @param {{tile:{x:number,y:number,z:number,dirKey:string}}} bomb
 * @param {number} size
 * @param {number} [radius]
 * @returns {{ keys: Set<string>, center: object, arms: Array<Array<object>> }}
 */
export function computeBlastTiles(bomb, size, radius = BOMB_BLAST_RADIUS) {
  const center = bomb.tile;
  const keys = new Set([tileKeyOf(center)]);
  const arms = [];
  for (const dir of BLAST_DIRS) {
    const arm = [];
    let cell = center;
    for (let step = 0; step < radius; step++) {
      cell = getNextSurfacePosition(cell, dir, size);
      if (!cell) break;
      const key = tileKeyOf(cell);
      // A wrapped arm can loop back onto a cell another arm already claimed
      // (small cubes especially); keep the render segment but don't double-count.
      arm.push(cell);
      keys.add(key);
    }
    arms.push(arm);
  }
  return { keys, center, arms };
}

/**
 * The eight cells the worm must occupy to disarm a bomb — identical to the
 * wormhole heal ring, so surrounding a bomb is the same skill as sealing a
 * wormhole.
 * @param {{tile:object}} bomb
 * @param {number} size
 * @param {Set<string>} [out]
 * @returns {Set<string>}
 */
export function bombDisarmRing(bomb, size, out) {
  return getWormholeHealRing(bomb.tile, size, out);
}

/**
 * Is the bomb fully encircled by the currently occupied body tiles?
 * @param {{tile:object}} bomb
 * @param {Set<string>} occupiedKeys - tile keys the visible body covers
 * @param {number} size
 * @returns {boolean}
 */
export function isBombDisarmed(bomb, occupiedKeys, size) {
  if (!occupiedKeys || occupiedKeys.size === 0) return false;
  const ring = bombDisarmRing(bomb, size);
  if (ring.size === 0) return false;
  for (const key of ring) {
    if (!occupiedKeys.has(key)) return false;
  }
  return true;
}

/**
 * Resolve what a detonating blast does to the worm.
 *
 * Mirrors checkWormHitBySlice: the head (trail index 0) inside the blast is an
 * instant death, unless the worm is airborne over it; otherwise the first body
 * segment inside the blast marks where the tail burns off. Returns null when the
 * blast misses the worm entirely.
 *
 * @param {object} worm - useWormCrawler proxy ({ current } accessors)
 * @param {Set<string>} blastKeys - tile keys the blast covers
 * @returns {{type:'death'} | {type:'cut', cutTrailIdx:number} | null}
 */
export function checkBlastHitWorm(worm, blastKeys) {
  // A rocket-boosting worm barrels through hazards untouched, same as the slice check.
  if (worm.rocketActive?.current) return null;
  const trail = worm.tileTrail?.current;
  if (!trail || trail.count === 0 || !blastKeys || blastKeys.size === 0) return null;

  const airborne = worm.isJumping?.current || (worm.landingGraceT?.current ?? 0) > 0;
  const activeTiles = Math.max(1, Math.ceil((worm.tailLength?.current ?? 1) * BODY_BALL_SPACING));
  const bodyEnd = Math.min(activeTiles, trail.count);

  // Head kills first (only when grounded — a jump clears the blast).
  if (!airborne && blastKeys.has(ttAt(trail, 0))) return { type: 'death' };

  // Otherwise the earliest body segment in the blast is where the tail burns off.
  for (let i = 1; i < bodyEnd; i++) {
    if (blastKeys.has(ttAt(trail, i))) return { type: 'cut', cutTrailIdx: i };
  }
  return null;
}
