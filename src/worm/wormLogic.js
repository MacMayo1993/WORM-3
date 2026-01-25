// src/worm/wormLogic.js
// Core game logic for WORM mode - surface navigation, collision, teleportation

import { getManifoldNeighbors, findAntipodalStickerByGrid, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { getStickerWorldPos } from '../game/coordinates.js';

// Direction vectors for each face - defines "forward/back/left/right" relative to each face
// When looking at the face head-on, these are the local coordinate axes
const FACE_DIRECTIONS = {
  // PZ (Front/Red): X is right, Y is up
  PZ: {
    up:    { dx: 0, dy: 1, dz: 0 },
    down:  { dx: 0, dy: -1, dz: 0 },
    left:  { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  },
  // NZ (Back/Orange): X is left (flipped), Y is up
  NZ: {
    up:    { dx: 0, dy: 1, dz: 0 },
    down:  { dx: 0, dy: -1, dz: 0 },
    left:  { dx: 1, dy: 0, dz: 0 },
    right: { dx: -1, dy: 0, dz: 0 }
  },
  // PX (Right/Blue): Z is left, Y is up
  PX: {
    up:    { dx: 0, dy: 1, dz: 0 },
    down:  { dx: 0, dy: -1, dz: 0 },
    left:  { dx: 0, dy: 0, dz: 1 },
    right: { dx: 0, dy: 0, dz: -1 }
  },
  // NX (Left/Green): Z is right, Y is up
  NX: {
    up:    { dx: 0, dy: 1, dz: 0 },
    down:  { dx: 0, dy: -1, dz: 0 },
    left:  { dx: 0, dy: 0, dz: -1 },
    right: { dx: 0, dy: 0, dz: 1 }
  },
  // PY (Top/White): X is right, Z is down (looking from above)
  PY: {
    up:    { dx: 0, dy: 0, dz: -1 },
    down:  { dx: 0, dy: 0, dz: 1 },
    left:  { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  },
  // NY (Bottom/Yellow): X is right, Z is up (looking from below)
  NY: {
    up:    { dx: 0, dy: 0, dz: 1 },
    down:  { dx: 0, dy: 0, dz: -1 },
    left:  { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  }
};

// Map movement direction when crossing face boundaries
// When you move off the edge of one face onto another, the "forward" direction may need to rotate
const FACE_TRANSITION_DIR = {
  // From PZ (front)
  'PZ->PY': { up: 'down', down: 'up', left: 'left', right: 'right' },
  'PZ->NY': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'PZ->PX': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'PZ->NX': { up: 'up', down: 'down', left: 'left', right: 'right' },

  // From NZ (back)
  'NZ->PY': { up: 'up', down: 'down', left: 'right', right: 'left' },
  'NZ->NY': { up: 'down', down: 'up', left: 'right', right: 'left' },
  'NZ->PX': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'NZ->NX': { up: 'up', down: 'down', left: 'left', right: 'right' },

  // From PX (right)
  'PX->PY': { up: 'right', down: 'left', left: 'up', right: 'down' },
  'PX->NY': { up: 'left', down: 'right', left: 'up', right: 'down' },
  'PX->PZ': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'PX->NZ': { up: 'up', down: 'down', left: 'left', right: 'right' },

  // From NX (left)
  'NX->PY': { up: 'left', down: 'right', left: 'down', right: 'up' },
  'NX->NY': { up: 'right', down: 'left', left: 'down', right: 'up' },
  'NX->PZ': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'NX->NZ': { up: 'up', down: 'down', left: 'left', right: 'right' },

  // From PY (top)
  'PY->PZ': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'PY->NZ': { up: 'down', down: 'up', left: 'right', right: 'left' },
  'PY->PX': { up: 'left', down: 'right', left: 'down', right: 'up' },
  'PY->NX': { up: 'right', down: 'left', left: 'up', right: 'down' },

  // From NY (bottom)
  'NY->PZ': { up: 'up', down: 'down', left: 'left', right: 'right' },
  'NY->NZ': { up: 'down', down: 'up', left: 'right', right: 'left' },
  'NY->PX': { up: 'right', down: 'left', left: 'up', right: 'down' },
  'NY->NX': { up: 'left', down: 'right', left: 'down', right: 'up' }
};

/**
 * Get the next tile position when moving in a direction on the cube surface
 * @param {Object} pos - Current position {x, y, z, dirKey}
 * @param {string} moveDir - Movement direction: 'up', 'down', 'left', 'right'
 * @param {number} size - Cube size (3, 4, or 5)
 * @returns {Object} New position {x, y, z, dirKey, newMoveDir} or null if invalid
 */
export const getNextSurfacePosition = (pos, moveDir, size) => {
  const { x, y, z, dirKey } = pos;
  const dirs = FACE_DIRECTIONS[dirKey];
  if (!dirs) return null;

  const delta = dirs[moveDir];
  if (!delta) return null;

  // Calculate new position
  let nx = x + delta.dx;
  let ny = y + delta.dy;
  let nz = z + delta.dz;

  // Check if we're still on the same face
  const isOnFace = (px, py, pz, dk) => {
    switch (dk) {
      case 'PX': return px === size - 1;
      case 'NX': return px === 0;
      case 'PY': return py === size - 1;
      case 'NY': return py === 0;
      case 'PZ': return pz === size - 1;
      case 'NZ': return pz === 0;
      default: return false;
    }
  };

  // If still within bounds on same face, simple move
  if (nx >= 0 && nx < size && ny >= 0 && ny < size && nz >= 0 && nz < size) {
    if (isOnFace(nx, ny, nz, dirKey)) {
      return { x: nx, y: ny, z: nz, dirKey, moveDir };
    }
  }

  // Edge crossing - use getManifoldNeighbors to find the correct neighbor
  const neighbors = getManifoldNeighbors(x, y, z, dirKey, size);

  // Find the neighbor that matches our intended direction
  for (const neighbor of neighbors) {
    // Skip same-face neighbors (we handle those above)
    if (neighbor.dirKey === dirKey) continue;

    // Check if this neighbor is in the direction we're moving
    const dx = neighbor.x - x;
    const dy = neighbor.y - y;
    const dz = neighbor.z - z;

    if (dx === delta.dx && dy === delta.dy && dz === delta.dz) {
      // Found the cross-face neighbor
      const transitionKey = `${dirKey}->${neighbor.dirKey}`;
      const dirMap = FACE_TRANSITION_DIR[transitionKey];
      const newMoveDir = dirMap ? dirMap[moveDir] : moveDir;

      return {
        x: neighbor.x,
        y: neighbor.y,
        z: neighbor.z,
        dirKey: neighbor.dirKey,
        moveDir: newMoveDir
      };
    }
  }

  // Fallback: find any cross-face neighbor (edge case)
  for (const neighbor of neighbors) {
    if (neighbor.dirKey !== dirKey) {
      const transitionKey = `${dirKey}->${neighbor.dirKey}`;
      const dirMap = FACE_TRANSITION_DIR[transitionKey];
      const newMoveDir = dirMap ? dirMap[moveDir] : moveDir;

      return {
        x: neighbor.x,
        y: neighbor.y,
        z: neighbor.z,
        dirKey: neighbor.dirKey,
        moveDir: newMoveDir
      };
    }
  }

  return null;
};

/**
 * Turn the worm left or right
 * @param {string} currentDir - Current movement direction
 * @param {string} turn - 'left' or 'right'
 * @returns {string} New movement direction
 */
export const turnWorm = (currentDir, turn) => {
  const dirs = ['up', 'right', 'down', 'left'];
  const idx = dirs.indexOf(currentDir);
  if (idx === -1) return currentDir;

  if (turn === 'right') {
    return dirs[(idx + 1) % 4];
  } else if (turn === 'left') {
    return dirs[(idx + 3) % 4]; // +3 is same as -1 mod 4
  }
  return currentDir;
};

/**
 * Check if a position is flipped (has wormhole)
 * @param {Object} pos - Position {x, y, z, dirKey}
 * @param {Array} cubies - Cube state
 * @returns {boolean} True if the sticker at this position is flipped
 */
export const isPositionFlipped = (pos, cubies) => {
  const sticker = cubies[pos.x]?.[pos.y]?.[pos.z]?.stickers?.[pos.dirKey];
  if (!sticker) return false;
  return sticker.curr !== sticker.orig;
};

/**
 * Get the antipodal position for a wormhole teleport
 * @param {Object} pos - Current position {x, y, z, dirKey}
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @param {Map} manifoldMap - Pre-computed manifold map (optional, will build if not provided)
 * @returns {Object|null} Antipodal position or null
 */
export const getAntipodalPosition = (pos, cubies, size, manifoldMap = null) => {
  const sticker = cubies[pos.x]?.[pos.y]?.[pos.z]?.stickers?.[pos.dirKey];
  if (!sticker) return null;

  // Use provided manifoldMap or build one (expensive fallback)
  const map = manifoldMap || buildManifoldGridMap(cubies, size);
  const antipodal = findAntipodalStickerByGrid(map, sticker, size);

  if (!antipodal) return null;

  return {
    x: antipodal.x,
    y: antipodal.y,
    z: antipodal.z,
    dirKey: antipodal.dirKey
  };
};

/**
 * Check if the worm collides with itself
 * @param {Object} newHead - New head position {x, y, z, dirKey}
 * @param {Array} segments - Worm body segments (excluding head)
 * @returns {boolean} True if collision detected
 */
export const checkSelfCollision = (newHead, segments) => {
  // Check against all body segments (skip index 0 which is the old head position)
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (
      seg.x === newHead.x &&
      seg.y === newHead.y &&
      seg.z === newHead.z &&
      seg.dirKey === newHead.dirKey
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Create a position key for set-based collision checking
 * @param {Object} pos - Position {x, y, z, dirKey}
 * @returns {string} Unique key for this position
 */
export const positionKey = (pos) => {
  return `${pos.x},${pos.y},${pos.z},${pos.dirKey}`;
};

/**
 * Generate initial worm position (center of front face)
 * @param {number} size - Cube size
 * @returns {Array} Initial worm segments
 */
export const createInitialWorm = (size) => {
  const center = Math.floor(size / 2);
  const z = size - 1; // Front face

  // Start with 3 segments: head and 2 body
  return [
    { x: center, y: center, z, dirKey: 'PZ' },       // Head
    { x: center, y: center - 1, z, dirKey: 'PZ' },   // Body 1
    { x: center, y: center - 2 >= 0 ? center - 2 : center - 1, z, dirKey: 'PZ' }  // Body 2
  ];
};

/**
 * Spawn orbs on random surface positions (avoiding worm)
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @param {number} count - Number of orbs to spawn
 * @param {Array} wormSegments - Current worm positions to avoid
 * @param {Array} existingOrbs - Existing orb positions to avoid
 * @returns {Array} Array of orb positions {x, y, z, dirKey}
 */
export const spawnOrbs = (cubies, size, count, wormSegments = [], existingOrbs = []) => {
  const orbs = [];
  const occupied = new Set();

  // Mark worm positions as occupied
  for (const seg of wormSegments) {
    occupied.add(positionKey(seg));
  }

  // Mark existing orbs as occupied
  for (const orb of existingOrbs) {
    occupied.add(positionKey(orb));
  }

  // Collect all valid surface positions
  const validPositions = [];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = cubies[x]?.[y]?.[z];
        if (!cubie) continue;

        for (const dirKey of Object.keys(cubie.stickers)) {
          // Check if this sticker is on the surface
          const isVisible = (
            (dirKey === 'PX' && x === size - 1) ||
            (dirKey === 'NX' && x === 0) ||
            (dirKey === 'PY' && y === size - 1) ||
            (dirKey === 'NY' && y === 0) ||
            (dirKey === 'PZ' && z === size - 1) ||
            (dirKey === 'NZ' && z === 0)
          );

          if (isVisible) {
            const pos = { x, y, z, dirKey };
            if (!occupied.has(positionKey(pos))) {
              validPositions.push(pos);
            }
          }
        }
      }
    }
  }

  // Randomly select positions for orbs
  const shuffled = validPositions.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected;
};

/**
 * Update worm positions after a cube rotation
 * Since the worm "rides" the cube, its positions stay at the same physical stickers
 * @param {Array} segments - Current worm segments
 * @param {string} axis - Rotation axis ('col', 'row', 'depth')
 * @param {number} sliceIndex - Which slice is rotating
 * @param {number} dir - Direction (1 or -1)
 * @param {number} size - Cube size
 * @returns {Array} Updated worm segments
 */
export const updateWormAfterRotation = (segments, axis, sliceIndex, dir, size) => {
  return segments.map(seg => {
    // Check if this segment is in the rotating slice
    let inSlice = false;
    if (axis === 'col' && seg.x === sliceIndex) inSlice = true;
    if (axis === 'row' && seg.y === sliceIndex) inSlice = true;
    if (axis === 'depth' && seg.z === sliceIndex) inSlice = true;

    if (!inSlice) return seg;

    // Rotate the position
    const k = (size - 1) / 2;
    let nx = seg.x, ny = seg.y, nz = seg.z;

    if (axis === 'col') {
      // Rotate around X axis
      const cy = seg.y - k;
      const cz = seg.z - k;
      const ry = -dir * cz;
      const rz = dir * cy;
      ny = Math.round(ry + k);
      nz = Math.round(rz + k);
    } else if (axis === 'row') {
      // Rotate around Y axis
      const cx = seg.x - k;
      const cz = seg.z - k;
      const rx = dir * cz;
      const rz = -dir * cx;
      nx = Math.round(rx + k);
      nz = Math.round(rz + k);
    } else if (axis === 'depth') {
      // Rotate around Z axis
      const cx = seg.x - k;
      const cy = seg.y - k;
      const rx = -dir * cy;
      const ry = dir * cx;
      nx = Math.round(rx + k);
      ny = Math.round(ry + k);
    }

    // Rotate the direction key
    const rotateDir = (d, ax, direction) => {
      const rotations = {
        col: { PY: direction > 0 ? 'NZ' : 'PZ', NZ: direction > 0 ? 'NY' : 'PY',
               NY: direction > 0 ? 'PZ' : 'NZ', PZ: direction > 0 ? 'PY' : 'NY',
               PX: 'PX', NX: 'NX' },
        row: { PX: direction > 0 ? 'PZ' : 'NZ', PZ: direction > 0 ? 'NX' : 'PX',
               NX: direction > 0 ? 'NZ' : 'PZ', NZ: direction > 0 ? 'PX' : 'NX',
               PY: 'PY', NY: 'NY' },
        depth: { PX: direction > 0 ? 'NY' : 'PY', PY: direction > 0 ? 'PX' : 'NX',
                 NX: direction > 0 ? 'PY' : 'NY', NY: direction > 0 ? 'NX' : 'PX',
                 PZ: 'PZ', NZ: 'NZ' }
      };
      return rotations[ax]?.[d] || d;
    };

    const newDirKey = rotateDir(seg.dirKey, axis, dir);

    return { x: nx, y: ny, z: nz, dirKey: newDirKey, moveDir: seg.moveDir };
  });
};

/**
 * Get world position for a worm segment (for rendering)
 * @param {Object} seg - Segment position {x, y, z, dirKey}
 * @param {number} size - Cube size
 * @param {number} explosionFactor - Explosion animation factor
 * @returns {Array} [x, y, z] world coordinates
 */
export const getSegmentWorldPos = (seg, size, explosionFactor = 0) => {
  return getStickerWorldPos(seg.x, seg.y, seg.z, seg.dirKey, size, explosionFactor);
};

/**
 * Calculate score based on worm length and stats
 * @param {number} length - Worm length
 * @param {number} orbsEaten - Total orbs eaten
 * @param {number} warpsUsed - Total wormhole warps
 * @returns {number} Score
 */
export const calculateScore = (length, orbsEaten, warpsUsed) => {
  return (length * 100) + (orbsEaten * 50) + (warpsUsed * 25);
};
