// src/worm/wormLogic.js
// Core game logic for WORM mode - surface navigation AND tunnel navigation
// Supports two modes: surface crawling (classic) and inside-tunnel traversal (new)

import { getManifoldNeighbors, findAntipodalStickerByGrid, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import * as THREE from 'three';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';

// ============================================================================
// TUNNEL MODE - Worm travels INSIDE the cube through antipodal wormhole tunnels
// ============================================================================

/**
 * Tunnel segment position - represents a position inside a tunnel
 * @typedef {Object} TunnelPosition
 * @property {string} tunnelId - Unique ID for the tunnel (e.g., "PZ-1-1")
 * @property {number} t - Progress through tunnel (0 = entry portal, 1 = exit portal)
 * @property {Object} entry - Entry portal position {x, y, z, dirKey}
 * @property {Object} exit - Exit portal position {x, y, z, dirKey}
 */

/**
 * Get all active tunnels (connections between flipped stickers and their antipodals)
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @returns {Array} Array of tunnel objects {id, entry, exit, flips}
 */
export const getActiveTunnels = (cubies, size) => {
  const tunnels = [];
  const seen = new Set();
  const manifoldMap = buildManifoldGridMap(cubies, size);

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = cubies[x]?.[y]?.[z];
        if (!cubie) continue;

        for (const dirKey of Object.keys(cubie.stickers || {})) {
          const sticker = cubie.stickers[dirKey];
          if (!sticker) continue;

          // Check if sticker is on surface and flipped
          const isVisible = (
            (dirKey === 'PX' && x === size - 1) ||
            (dirKey === 'NX' && x === 0) ||
            (dirKey === 'PY' && y === size - 1) ||
            (dirKey === 'NY' && y === 0) ||
            (dirKey === 'PZ' && z === size - 1) ||
            (dirKey === 'NZ' && z === 0)
          );

          if (!isVisible) continue;

          const isFlipped = sticker.curr !== sticker.orig;
          if (!isFlipped) continue;

          // Create tunnel ID (use sorted positions to avoid duplicates)
          const entryKey = `${x},${y},${z},${dirKey}`;
          if (seen.has(entryKey)) continue;

          // Find antipodal
          const antipodal = findAntipodalStickerByGrid(manifoldMap, sticker, size);
          if (!antipodal) continue;

          const exitKey = `${antipodal.x},${antipodal.y},${antipodal.z},${antipodal.dirKey}`;

          // Mark both ends as seen
          seen.add(entryKey);
          seen.add(exitKey);

          // Count flips for intensity
          const flips = (sticker.flips || 0) + (antipodal.sticker?.flips || 0);

          tunnels.push({
            id: `tunnel-${x}-${y}-${z}-${dirKey}`,
            entry: { x, y, z, dirKey },
            exit: { x: antipodal.x, y: antipodal.y, z: antipodal.z, dirKey: antipodal.dirKey },
            flips: Math.max(1, flips),
            entryColor: sticker.curr,
            exitColor: antipodal.sticker?.curr || sticker.curr
          });
        }
      }
    }
  }

  return tunnels;
};

/**
 * Get world position along a tunnel at parameter t (0-1)
 * @param {Object} tunnel - Tunnel object with entry/exit positions
 * @param {number} t - Parameter along tunnel (0 = entry, 1 = exit)
 * @param {number} size - Cube size
 * @param {number} explosionFactor - Explosion animation factor
 * @returns {Array} [x, y, z] world coordinates
 */
export const getTunnelWorldPos = (tunnel, t, size, explosionFactor = 0) => {
  const entryPos = getStickerWorldPos(
    tunnel.entry.x, tunnel.entry.y, tunnel.entry.z,
    tunnel.entry.dirKey, size, explosionFactor
  );
  const exitPos = getStickerWorldPos(
    tunnel.exit.x, tunnel.exit.y, tunnel.exit.z,
    tunnel.exit.dirKey, size, explosionFactor
  );

  // Use smart control point for curved path through center
  const controlPoint = calculateSmartControlPoint(entryPos, exitPos, size, 0);

  // Quadratic Bezier interpolation
  const vStart = new THREE.Vector3(...entryPos);
  const vControl = controlPoint;
  const vEnd = new THREE.Vector3(...exitPos);

  // B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
  const oneMinusT = 1 - t;
  const result = new THREE.Vector3()
    .addScaledVector(vStart, oneMinusT * oneMinusT)
    .addScaledVector(vControl, 2 * oneMinusT * t)
    .addScaledVector(vEnd, t * t);

  return [result.x, result.y, result.z];
};

/**
 * Create initial worm inside a random tunnel
 * @param {Array} tunnels - Available tunnels
 * @param {number} initialLength - Initial worm length (segments)
 * @returns {Array} Initial worm segments with tunnel positions
 */
export const createInitialTunnelWorm = (tunnels, initialLength = 3) => {
  if (tunnels.length === 0) {
    // No tunnels yet - return empty (game will need to create tunnels first)
    return [];
  }

  // Pick a random tunnel to start in
  const startTunnel = tunnels[Math.floor(Math.random() * tunnels.length)];

  const segments = [];
  const spacing = 0.15; // Space between segments along tunnel

  for (let i = 0; i < initialLength; i++) {
    // Head at t=0.5, body segments behind
    const t = Math.max(0.05, 0.5 - (i * spacing));
    segments.push({
      tunnelId: startTunnel.id,
      t,
      tunnel: startTunnel
    });
  }

  return segments;
};

/**
 * Find the closest tunnel entrance to a given exit position
 * @param {Object} exitPos - Exit position {x, y, z, dirKey}
 * @param {Array} tunnels - Available tunnels
 * @param {string} excludeTunnelId - Tunnel to exclude (the one we're exiting)
 * @param {number} size - Cube size
 * @returns {Object|null} Best next tunnel or null if none available
 */
export const findNextTunnel = (exitPos, tunnels, excludeTunnelId, size) => {
  // Get world position of exit
  const exitWorld = getStickerWorldPos(exitPos.x, exitPos.y, exitPos.z, exitPos.dirKey, size, 0);
  const exitVec = new THREE.Vector3(...exitWorld);

  let bestTunnel = null;
  let bestDist = Infinity;

  for (const tunnel of tunnels) {
    if (tunnel.id === excludeTunnelId) continue;

    // Check distance to this tunnel's entry
    const entryWorld = getStickerWorldPos(
      tunnel.entry.x, tunnel.entry.y, tunnel.entry.z,
      tunnel.entry.dirKey, size, 0
    );
    const entryVec = new THREE.Vector3(...entryWorld);
    const dist = exitVec.distanceTo(entryVec);

    if (dist < bestDist) {
      bestDist = dist;
      bestTunnel = { tunnel, enterFromEntry: true };
    }

    // Also check distance to tunnel's exit (can enter from either end)
    const exitWorld2 = getStickerWorldPos(
      tunnel.exit.x, tunnel.exit.y, tunnel.exit.z,
      tunnel.exit.dirKey, size, 0
    );
    const exitVec2 = new THREE.Vector3(...exitWorld2);
    const dist2 = exitVec.distanceTo(exitVec2);

    if (dist2 < bestDist) {
      bestDist = dist2;
      bestTunnel = { tunnel, enterFromEntry: false };
    }
  }

  // Only return if within reasonable distance (adjacent or nearby)
  if (bestTunnel && bestDist < 3.0) {
    return bestTunnel;
  }

  return null;
};

/**
 * Check if worm collides with itself in tunnel mode
 * @param {Object} newHead - New head segment {tunnelId, t}
 * @param {Array} segments - Body segments (excluding head)
 * @returns {boolean} True if collision
 */
export const checkTunnelSelfCollision = (newHead, segments) => {
  const collisionThreshold = 0.1; // How close segments can be before collision

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.tunnelId === newHead.tunnelId) {
      if (Math.abs(seg.t - newHead.t) < collisionThreshold) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Spawn orbs inside tunnels at midpoints
 * @param {Array} tunnels - Available tunnels
 * @param {number} count - Number of orbs to spawn
 * @param {Array} wormSegments - Current worm positions to avoid
 * @returns {Array} Array of orb positions {tunnelId, t, tunnel}
 */
export const spawnTunnelOrbs = (tunnels, count, wormSegments = []) => {
  if (tunnels.length === 0) return [];

  const orbs = [];
  const usedTunnels = new Set();

  // Mark tunnels with worm segments as partially occupied
  const wormTunnelTs = new Map(); // tunnelId -> array of t values
  for (const seg of wormSegments) {
    if (!wormTunnelTs.has(seg.tunnelId)) {
      wormTunnelTs.set(seg.tunnelId, []);
    }
    wormTunnelTs.get(seg.tunnelId).push(seg.t);
  }

  // Shuffle tunnels for random placement
  const shuffledTunnels = [...tunnels].sort(() => Math.random() - 0.5);

  for (const tunnel of shuffledTunnels) {
    if (orbs.length >= count) break;

    // Try to place orb at midpoint (t=0.5) or nearby
    const possibleTs = [0.5, 0.3, 0.7, 0.2, 0.8];

    for (const t of possibleTs) {
      // Check if worm is near this position
      const wormTs = wormTunnelTs.get(tunnel.id) || [];
      const tooClose = wormTs.some(wt => Math.abs(wt - t) < 0.2);

      if (!tooClose && !usedTunnels.has(`${tunnel.id}-${t}`)) {
        orbs.push({
          tunnelId: tunnel.id,
          t,
          tunnel
        });
        usedTunnels.add(`${tunnel.id}-${t}`);
        break;
      }
    }
  }

  // If we need more orbs, allow multiple per tunnel
  while (orbs.length < count && shuffledTunnels.length > 0) {
    const tunnel = shuffledTunnels[orbs.length % shuffledTunnels.length];
    const t = 0.3 + Math.random() * 0.4; // Random position in middle section
    orbs.push({
      tunnelId: tunnel.id,
      t,
      tunnel
    });
  }

  return orbs.slice(0, count);
};

/**
 * Update tunnel worm positions after cube rotation
 * Tunnels may change, so we need to remap worm segments
 * @param {Array} segments - Current worm segments
 * @param {Array} newTunnels - New tunnel configuration after rotation
 * @param {Array} oldTunnels - Old tunnel configuration before rotation
 * @returns {Array} Updated worm segments
 */
export const updateTunnelWormAfterRotation = (segments, newTunnels, oldTunnels) => {
  // Create lookup for old tunnels
  const oldTunnelMap = new Map();
  for (const t of oldTunnels) {
    oldTunnelMap.set(t.id, t);
  }

  // Create lookup for new tunnels by entry/exit positions
  const newTunnelByEntry = new Map();
  const newTunnelByExit = new Map();
  for (const t of newTunnels) {
    const entryKey = `${t.entry.x},${t.entry.y},${t.entry.z},${t.entry.dirKey}`;
    const exitKey = `${t.exit.x},${t.exit.y},${t.exit.z},${t.exit.dirKey}`;
    newTunnelByEntry.set(entryKey, t);
    newTunnelByExit.set(exitKey, t);
  }

  return segments.map(seg => {
    // Try to find the same tunnel in new configuration
    const newTunnel = newTunnels.find(t => t.id === seg.tunnelId);
    if (newTunnel) {
      return { ...seg, tunnel: newTunnel };
    }

    // Tunnel disappeared - find nearest new tunnel
    if (newTunnels.length > 0) {
      const randomTunnel = newTunnels[Math.floor(Math.random() * newTunnels.length)];
      return {
        tunnelId: randomTunnel.id,
        t: seg.t,
        tunnel: randomTunnel
      };
    }

    // No tunnels available
    return seg;
  });
};

/**
 * Get the target tunnel that contains an orb (for highlighting)
 * @param {Array} orbs - Current orbs
 * @param {Object} wormHead - Worm head segment
 * @returns {string|null} Target tunnel ID or null
 */
export const getTargetTunnelId = (orbs, wormHead) => {
  if (orbs.length === 0) return null;

  // Prioritize orbs in the same tunnel as the worm
  const sameTunnelOrb = orbs.find(o => o.tunnelId === wormHead?.tunnelId);
  if (sameTunnelOrb) return sameTunnelOrb.tunnelId;

  // Otherwise return first orb's tunnel
  return orbs[0]?.tunnelId || null;
};

// ============================================================================
// SURFACE MODE (Original) - Worm crawls on cube surface
// ============================================================================

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
