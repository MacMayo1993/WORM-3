// src/worm/wormLogic.js
// Core game logic for WORM mode - surface navigation AND tunnel navigation
// Supports two modes: surface crawling (classic) and inside-tunnel traversal (new)

import { getManifoldNeighbors, findAntipodalStickerByGrid, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { FACE_COLORS } from '../utils/constants.js';
import { getStickerSafe } from '../game/cubeState.js';
import * as THREE from 'three';

// ============================================================================
// TUNNEL MODE - Worm travels INSIDE the cube through antipodal wormhole tunnels
// ============================================================================

// ── Tunnel mode named constants ──────────────────────────────────────────────
// Spacing (in t-units) between initial worm segments when spawning inside a tunnel
const INITIAL_SEGMENT_SPACING = 0.15;
// Base world-space distance threshold used by findNextTunnel for size-3 cubes.
// Scaled proportionally inside the function for larger cubes: on a 5×5 cube,
// corner stickers on adjacent faces sit ~4+ units apart, which would exceed a
// hardcoded 3.0 and cause findNextTunnel to silently return null.
const TUNNEL_ADJACENCY_DISTANCE = 3.0;
// Self-collision detection threshold (in t-units). Intentionally narrow (3× smaller
// than orbCollisionThreshold) to avoid false positives when re-entering a tunnel
// whose own body segments are still near the entry portal.
const TUNNEL_SELF_COLLISION_THRESHOLD = 0.05;

/**
 * Tunnel segment position - represents a position inside a tunnel
 * @typedef {Object} TunnelPosition
 * @property {string} tunnelId - Unique ID for the tunnel (e.g., "PZ-1-1")
 * @property {number} t - Progress through tunnel (0 = entry portal, 1 = exit portal)
 * @property {Object} entry - Entry portal position {x, y, z, dirKey}
 * @property {Object} exit - Exit portal position {x, y, z, dirKey}
 */

/**
 * Returns a rotation-stable key for a surface sticker using origPos + origDir.
 * The key survives cube rotations because origPos/origDir never change.
 * Returns null if the sticker cannot be found.
 */
export function getStableKey(x, y, z, dirKey, cubies) {
  const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return null;
  const { origPos, origDir } = sticker;
  return `${origDir}-${origPos.x}-${origPos.y}-${origPos.z}`;
}

/**
 * Scans cubies to find the current grid position of a sticker by its stable key.
 * Returns { x, y, z, dirKey } or null.
 */
export function findStickerByStableKey(cubies, size, stableKey) {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = cubies?.[x]?.[y]?.[z];
        if (!cubie) continue;
        for (const dKey of Object.keys(cubie.stickers)) {
          const st = cubie.stickers[dKey];
          if (!st?.origPos) continue;
          if (`${st.origDir}-${st.origPos.x}-${st.origPos.y}-${st.origPos.z}` === stableKey) {
            return { x, y, z, dirKey: dKey };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Get all active tunnels (connections between flipped stickers and their antipodals)
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @returns {Array} Array of tunnel objects {id, entry, exit, flips}
 */
/**
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @param {Map|null} [cachedManifoldMap] - Optional pre-built manifold map. When the caller
 *   already holds one (e.g. HealerWormMode), passing it avoids an O(size³×6) rebuild.
 */
export const getActiveTunnels = (cubies, size, cachedManifoldMap = null) => {
  const tunnels = [];
  const seen = new Set();
  const manifoldMap = cachedManifoldMap ?? buildManifoldGridMap(cubies, size);

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

          // Pre-compute world positions so findNextTunnel avoids per-call getStickerWorldPos
          const entryWorld = getStickerWorldPos(x, y, z, dirKey, size, 0);
          const exitWorld = getStickerWorldPos(antipodal.x, antipodal.y, antipodal.z, antipodal.dirKey, size, 0);
          // No Object.freeze — frozen objects prevent V8 property-access optimisation
          // and tunnel objects are already treated as immutable by all consumers.
          tunnels.push({
            id: `tunnel-${x}-${y}-${z}-${dirKey}`,
            entry: { x, y, z, dirKey },
            exit: { x: antipodal.x, y: antipodal.y, z: antipodal.z, dirKey: antipodal.dirKey },
            flips: Math.max(1, flips),
            entryColor: sticker.curr,
            exitColor: antipodal.sticker?.curr || sticker.curr,
            entryWorldVec: new THREE.Vector3(entryWorld[0], entryWorld[1], entryWorld[2]),
            exitWorldVec: new THREE.Vector3(exitWorld[0], exitWorld[1], exitWorld[2]),
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
  const k = (size - 1) / 2;
  const scale = 1 + explosionFactor * 1.8;

  // Use the geometric center of each face tile (not sticker offset).
  const entryCenter = new THREE.Vector3(
    (tunnel.entry.x - k) * scale,
    (tunnel.entry.y - k) * scale,
    (tunnel.entry.z - k) * scale
  );
  const exitCenter = new THREE.Vector3(
    (tunnel.exit.x - k) * scale,
    (tunnel.exit.y - k) * scale,
    (tunnel.exit.z - k) * scale
  );
  const coreCenter = new THREE.Vector3(0, 0, 0);

  // Enforce exact path: entry tile center -> void core center -> exit tile center.
  if (t <= 0.5) {
    const localT = Math.max(0, t) * 2;
    const result = entryCenter.clone().lerp(coreCenter, localT);
    return [result.x, result.y, result.z];
  }

  const localT = (Math.min(1, t) - 0.5) * 2;
  const result = coreCenter.clone().lerp(exitCenter, localT);
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
  const spacing = INITIAL_SEGMENT_SPACING;

  for (let i = 0; i < initialLength; i++) {
    // Head at t=0.5, body segments behind
    const t = Math.max(0.05, 0.5 - (i * spacing));
    segments.push({
      tunnelId: startTunnel.id,
      t,
      tunnel: startTunnel,
      direction: 1
    });
  }

  return segments;
};

export const getTunnelSideKey = (endpoint) => (
  `${endpoint.x},${endpoint.y},${endpoint.z},${endpoint.dirKey}`
);

/**
 * Find the closest tunnel entrance to a given exit position
 * @param {Object} exitPos - Exit position {x, y, z, dirKey}
 * @param {Array} tunnels - Available tunnels
 * @param {string} excludeTunnelId - Tunnel to exclude (the one we're exiting)
 * @param {number} size - Cube size
 * @returns {Object|null} Best next tunnel or null if none available
 */
// Reusable scratch vector for findNextTunnel — avoids per-call allocation
const _findExitVec = new THREE.Vector3();

export const findNextTunnel = (exitPos, tunnels, excludeTunnelId, size, inactiveSideKeys = new Set()) => {
  // Compute exit world position once (reuse scratch vector)
  const exitWorld = getStickerWorldPos(exitPos.x, exitPos.y, exitPos.z, exitPos.dirKey, size, 0);
  _findExitVec.set(exitWorld[0], exitWorld[1], exitWorld[2]);

  let bestTunnel = null;
  let bestDist = Infinity;

  for (const tunnel of tunnels) {
    if (tunnel.id === excludeTunnelId) continue;

    // Use pre-computed world vectors if available, otherwise compute on-the-fly
    const entryVec = tunnel.entryWorldVec ?? new THREE.Vector3(
      ...getStickerWorldPos(tunnel.entry.x, tunnel.entry.y, tunnel.entry.z, tunnel.entry.dirKey, size, 0)
    );
    const dist = _findExitVec.distanceTo(entryVec);

    const entryKey = getTunnelSideKey(tunnel.entry);
    if (!inactiveSideKeys.has(entryKey) && dist < bestDist) {
      bestDist = dist;
      bestTunnel = { tunnel, enterFromEntry: true, enteredSideKey: entryKey };
    }

    // Also check tunnel's exit end (can enter from either side)
    const exitVec2 = tunnel.exitWorldVec ?? new THREE.Vector3(
      ...getStickerWorldPos(tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, size, 0)
    );
    const dist2 = _findExitVec.distanceTo(exitVec2);

    const exitKey = getTunnelSideKey(tunnel.exit);
    if (!inactiveSideKeys.has(exitKey) && dist2 < bestDist) {
      bestDist = dist2;
      bestTunnel = { tunnel, enterFromEntry: false, enteredSideKey: exitKey };
    }
  }

  // Scale adjacency threshold proportionally with cube size.
  // A 3×3 cube needs ~3.0 units; a 5×5 cube needs ~5.0+ units because its surface
  // stickers span a larger world-space range (grid positions reach ±2 instead of ±1).
  const adjacencyThreshold = TUNNEL_ADJACENCY_DISTANCE * (size / 3);
  return bestTunnel && bestDist < adjacencyThreshold ? bestTunnel : null;
};

/**
 * Check if worm collides with itself in tunnel mode.
 *
 * IMPORTANT: call this BEFORE setWorm so segments still reflects the current state.
 * Pass isGrowing=true when pendingGrowth > 0 (tail will NOT be removed this frame).
 *
 * Threshold is intentionally conservative (0.05 t-units) to avoid false positives
 * when re-entering a tunnel whose body segments are still near the entry portal.
 * At base speed 0.4 t/sec, 0.05 t-units ≈ 0.125 s of travel — well within visual
 * overlap range (~0.35 t-units for a 2-world-unit tunnel) when it actually fires.
 *
 * @param {Object} newHead - New head segment {tunnelId, t}
 * @param {Array} segments - Current worm segments (index 0 = current head)
 * @param {boolean} isGrowing - True when growing this frame (tail stays)
 * @returns {boolean} True if real collision
 */
export const checkTunnelSelfCollision = (newHead, segments, isGrowing = false) => {
  // Need at least 3 segments before a meaningful self-collision is possible.
  if (segments.length < 3) return false;

  const collisionThreshold = TUNNEL_SELF_COLLISION_THRESHOLD;
  const limit = isGrowing ? segments.length : segments.length - 1;
  // With the snake-following algorithm, body segments always trail directly
  // behind the head in the same tunnel (lower t for direction=1, higher t for
  // direction=-1). A genuine self-intersection only occurs when the head is
  // about to run into a segment that is AHEAD of it — i.e. the worm is catching
  // its own tail from behind. Trailing segments must be ignored, or the false-
  // positive fires within 2 frames of entering any new tunnel.
  const headDir = newHead.direction ?? 1;

  for (let i = 1; i < limit; i++) {
    const seg = segments[i];
    if (seg.tunnelId !== newHead.tunnelId) continue;

    const tDiff = seg.t - newHead.t; // positive → seg is ahead when dir=1
    const segIsAhead = headDir > 0 ? tDiff > 0 : tDiff < 0;
    if (segIsAhead && Math.abs(tDiff) < collisionThreshold) {
      return true;
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
export const spawnTunnelOrbs = (tunnels, count, wormSegments = [], faceColors = FACE_COLORS) => {
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
          tunnel,
          faceId: tunnel.entryColor,
          color: faceColors[tunnel.entryColor] || '#ffd700'
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
      tunnel,
      faceId: tunnel.entryColor,
      color: faceColors[tunnel.entryColor] || '#ffd700'
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

    // Tunnel disappeared - find nearest new tunnel, clamp t away from edges to avoid instant exit
    if (newTunnels.length > 0) {
      const randomTunnel = newTunnels[Math.floor(Math.random() * newTunnels.length)];
      return {
        tunnelId: randomTunnel.id,
        t: Math.max(0.15, Math.min(0.85, seg.t)),
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
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  },
  // NZ (Back/Orange): X is left (flipped), Y is up
  NZ: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: 1, dy: 0, dz: 0 },
    right: { dx: -1, dy: 0, dz: 0 }
  },
  // PX (Right/Blue): Z is left, Y is up
  PX: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: 0, dy: 0, dz: 1 },
    right: { dx: 0, dy: 0, dz: -1 }
  },
  // NX (Left/Green): Z is right, Y is up
  NX: {
    up: { dx: 0, dy: 1, dz: 0 },
    down: { dx: 0, dy: -1, dz: 0 },
    left: { dx: 0, dy: 0, dz: -1 },
    right: { dx: 0, dy: 0, dz: 1 }
  },
  // PY (Top/White): X is right, Z is down (looking from above)
  PY: {
    up: { dx: 0, dy: 0, dz: -1 },
    down: { dx: 0, dy: 0, dz: 1 },
    left: { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  },
  // NY (Bottom/Yellow): X is right, Z is up (looking from below)
  NY: {
    up: { dx: 0, dy: 0, dz: 1 },
    down: { dx: 0, dy: 0, dz: -1 },
    left: { dx: -1, dy: 0, dz: 0 },
    right: { dx: 1, dy: 0, dz: 0 }
  }
};

const FACE_TRANSITION_DIR = {
  'PZ->PY': { up: 'up', down: 'up', left: 'left', right: 'right' },
  'PZ->NY': { up: 'down', down: 'down', left: 'left', right: 'right' },
  'PZ->PX': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'PZ->NX': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'NZ->PY': { up: 'down', down: 'down', left: 'right', right: 'left' },
  'NZ->NY': { up: 'up', down: 'up', left: 'right', right: 'left' },
  'NZ->PX': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'NZ->NX': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'PX->PY': { up: 'left', down: 'left', left: 'down', right: 'up' },
  'PX->NY': { up: 'left', down: 'left', left: 'up', right: 'down' },
  'PX->PZ': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'PX->NZ': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'NX->PY': { up: 'right', down: 'right', left: 'up', right: 'down' },
  'NX->NY': { up: 'right', down: 'right', left: 'down', right: 'up' },
  'NX->PZ': { up: 'up', down: 'down', left: 'right', right: 'right' },
  'NX->NZ': { up: 'up', down: 'down', left: 'left', right: 'left' },
  'PY->PZ': { up: 'down', down: 'down', left: 'left', right: 'right' },
  'PY->NZ': { up: 'down', down: 'down', left: 'right', right: 'left' },
  'PY->PX': { up: 'right', down: 'left', left: 'down', right: 'down' },
  'PY->NX': { up: 'left', down: 'right', left: 'down', right: 'down' },
  'NY->PZ': { up: 'up', down: 'up', left: 'left', right: 'right' },
  'NY->NZ': { up: 'up', down: 'up', left: 'right', right: 'left' },
  'NY->PX': { up: 'left', down: 'right', left: 'up', right: 'up' },
  'NY->NX': { up: 'right', down: 'left', left: 'up', right: 'up' },
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
  const nx = x + delta.dx;
  const ny = y + delta.dy;
  const nz = z + delta.dz;

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

  // Edge crossing - determine which face we crossed onto based on which coordinate went out of bounds
  let expectedDirKey = null;
  if (nx >= size) expectedDirKey = 'PX';
  else if (nx < 0) expectedDirKey = 'NX';
  else if (ny >= size) expectedDirKey = 'PY';
  else if (ny < 0) expectedDirKey = 'NY';
  else if (nz >= size) expectedDirKey = 'PZ';
  else if (nz < 0) expectedDirKey = 'NZ';

  if (expectedDirKey) {
    const neighbors = getManifoldNeighbors(x, y, z, dirKey, size);
    for (const neighbor of neighbors) {
      if (neighbor.dirKey === expectedDirKey) {
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
  const sticker = getStickerSafe(cubies, pos.x, pos.y, pos.z, pos.dirKey);
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
  const sticker = getStickerSafe(cubies, pos.x, pos.y, pos.z, pos.dirKey);
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
 * Check if the worm collides with itself (surface mode).
 *
 * IMPORTANT: call this BEFORE setWorm so segments still reflects the current state.
 * Pass isGrowing=true when the tail will NOT be removed this frame (pendingGrowth > 0),
 * so we don't falsely collide with the tail that is about to vacate its tile.
 *
 * @param {Object} newHead - New head position {x, y, z, dirKey}
 * @param {Array} segments - Current worm segments (index 0 = current head)
 * @param {boolean} isGrowing - True when the worm is growing this frame (tail stays)
 * @returns {boolean} True if real collision detected
 */
export const checkSelfCollision = (newHead, segments, isGrowing = false) => {
  // Need at least 3 segments (head + body + tail) before a real self-collision is possible.
  // With only 2 segments the "body" IS the tail and would be excluded anyway.
  if (segments.length < 3) return false;

  // When not growing, the tail (last segment) is removed by setWorm this same frame.
  // Exclude it from the check so landing on the vacating tail isn't a false death.
  const limit = isGrowing ? segments.length : segments.length - 1;

  for (let i = 1; i < limit; i++) {
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
export const spawnOrbs = (cubies, size, count, wormSegments = [], existingOrbs = [], faceColors = FACE_COLORS) => {
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
              const faceId = cubie.stickers[dirKey].curr;
              validPositions.push({ ...pos, faceId, color: faceColors[faceId] });
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
        col: {
          PY: direction > 0 ? 'NZ' : 'PZ', NZ: direction > 0 ? 'NY' : 'PY',
          NY: direction > 0 ? 'PZ' : 'NZ', PZ: direction > 0 ? 'PY' : 'NY',
          PX: 'PX', NX: 'NX'
        },
        row: {
          PX: direction > 0 ? 'PZ' : 'NZ', PZ: direction > 0 ? 'NX' : 'PX',
          NX: direction > 0 ? 'NZ' : 'PZ', NZ: direction > 0 ? 'PX' : 'NX',
          PY: 'PY', NY: 'NY'
        },
        depth: {
          PX: direction > 0 ? 'NY' : 'PY', PY: direction > 0 ? 'PX' : 'NX',
          NX: direction > 0 ? 'PY' : 'NY', NY: direction > 0 ? 'NX' : 'PX',
          PZ: 'PZ', NZ: 'NZ'
        }
      };
      return rotations[ax]?.[d] || d;
    };

    const newDirKey = rotateDir(seg.dirKey, axis, dir);

    return { ...seg, x: nx, y: ny, z: nz, dirKey: newDirKey };
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

// ============================================================================
// WORM WEIGHT - Tile press state & healing logic (surface mode)
// ============================================================================

/**
 * Shared press state for worm weight visualization.
 * Written each frame by WormGameLoop, read by CubeAssembly to animate tile depression.
 * Module-level singleton — only one worm game runs at a time.
 * Map key: "x,y,z,dirKey" → current press depth (0.0–1.0).
 */
export const pressState = {
  tiles: new Map(),
};

/**
 * Get all 8 surrounding surface tile neighbors (Moore neighborhood).
 * Cardinal neighbors via getNextSurfacePosition; diagonals via two sequential steps.
 * @param {Object} pos - Position {x, y, z, dirKey}
 * @param {number} size - Cube size
 * @returns {Array} Up to 8 neighboring positions {x, y, z, dirKey}
 */
export const getSurroundingNeighbors = (pos, size) => {
  const cardinalDirs = ['up', 'down', 'left', 'right'];
  const cardinalResults = {};
  const seen = new Set();
  const neighbors = [];

  // Step 1: 4 cardinal neighbors
  for (const dir of cardinalDirs) {
    const next = getNextSurfacePosition(pos, dir, size);
    if (next) {
      const key = positionKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        neighbors.push(next);
      }
      cardinalResults[dir] = next;
    }
  }

  // Step 2: 4 diagonal neighbors via two sequential cardinal steps
  const diagPairs = [
    ['up', 'left'], ['up', 'right'],
    ['down', 'left'], ['down', 'right'],
  ];
  for (const [d1, d2] of diagPairs) {
    const step1 = cardinalResults[d1];
    if (!step1) continue;
    const step2 = getNextSurfacePosition(step1, d2, size);
    if (step2) {
      const key = positionKey(step2);
      if (!seen.has(key)) {
        seen.add(key);
        neighbors.push(step2);
      }
    }
  }

  return neighbors;
};

/**
 * Build a Set of tile keys currently occupied by worm body segments (surface mode).
 * @param {Array} wormSegments - Worm segment array [{x, y, z, dirKey}, ...]
 * @returns {Set<string>} Set of "x,y,z,dirKey" keys
 */
export const getPressedTileKeys = (wormSegments) => {
  const keys = new Set();
  for (const seg of wormSegments) {
    if (seg.x !== undefined) keys.add(positionKey(seg));
  }
  return keys;
};

/**
 * Narrowed healing scan: checks only tiles in the 8-neighbor neighborhood
 * of the worm head instead of the full O(size³×6) surface scan.
 * @param {Array} cubies - Cube state
 * @param {number} size - Cube size
 * @param {Array} wormSegments - Current worm segments (head is index 0)
 * @returns {Array} Array of {x, y, z, dirKey} positions ready to be healed
 */
export const checkHealingCandidatesNearHead = (cubies, size, wormSegments) => {
  if (!wormSegments || wormSegments.length === 0) return [];
  const head = wormSegments[0];
  if (head.x === undefined) return [];

  const pressedKeys = getPressedTileKeys(wormSegments);
  const candidates = [];
  const neighbors = getSurroundingNeighbors(head, size);

  for (const tile of neighbors) {
    const cubie = cubies[tile.x]?.[tile.y]?.[tile.z];
    if (!cubie) continue;
    const sticker = cubie.stickers?.[tile.dirKey];
    if (!sticker) continue;
    if (sticker.curr === sticker.orig) continue; // not flipped

    const tileNeighbors = getSurroundingNeighbors(tile, size);
    const nonFlippedNeighbors = tileNeighbors.filter(n => {
      const ns = getStickerSafe(cubies, n.x, n.y, n.z, n.dirKey);
      return ns && ns.curr === ns.orig;
    });
    if (nonFlippedNeighbors.length === 0) continue;
    if (nonFlippedNeighbors.every(n => pressedKeys.has(positionKey(n)))) {
      candidates.push(tile);
    }
  }

  return candidates;
};
