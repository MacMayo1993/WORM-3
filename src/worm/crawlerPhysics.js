// src/worm/crawlerPhysics.js
// Continuous surface-crawling physics for the platformer WORM mode.
// The crawler moves freely on the cube surface in 3D, with face transitions
// handled automatically via projection.

import * as THREE from 'three';

// Face normals (outward)
const FACE_NORMALS = {
  PX: new THREE.Vector3(1, 0, 0),
  NX: new THREE.Vector3(-1, 0, 0),
  PY: new THREE.Vector3(0, 1, 0),
  NY: new THREE.Vector3(0, -1, 0),
  PZ: new THREE.Vector3(0, 0, 1),
  NZ: new THREE.Vector3(0, 0, -1),
};

const SURFACE_OFFSET = 0.52;

/**
 * Project a 3D point onto the cube surface.
 * Returns the projected position and the face it lands on.
 */
export function projectOntoCube(point, size) {
  const k = (size - 1) / 2;
  const s = k + SURFACE_OFFSET;
  const ax = Math.abs(point.x);
  const ay = Math.abs(point.y);
  const az = Math.abs(point.z);

  let face;
  const p = point.clone();

  if (ax >= ay && ax >= az) {
    face = p.x > 0 ? 'PX' : 'NX';
    p.x = Math.sign(p.x) * s;
    p.y = clamp(p.y, -k, k);
    p.z = clamp(p.z, -k, k);
  } else if (ay >= ax && ay >= az) {
    face = p.y > 0 ? 'PY' : 'NY';
    p.x = clamp(p.x, -k, k);
    p.y = Math.sign(p.y) * s;
    p.z = clamp(p.z, -k, k);
  } else {
    face = p.z > 0 ? 'PZ' : 'NZ';
    p.x = clamp(p.x, -k, k);
    p.y = clamp(p.y, -k, k);
    p.z = Math.sign(p.z) * s;
  }

  return { position: p, face };
}

/**
 * Project a vector onto the tangent plane of a face (remove normal component).
 */
export function projectOntoFace(vec, face) {
  const n = FACE_NORMALS[face];
  return vec.clone().sub(n.clone().multiplyScalar(vec.dot(n)));
}

/**
 * Get a default forward direction on a face.
 */
export function getDefaultForward(face) {
  switch (face) {
    case 'PZ': case 'NZ': return new THREE.Vector3(1, 0, 0);
    case 'PX': case 'NX': return new THREE.Vector3(0, 0, 1);
    case 'PY': case 'NY': return new THREE.Vector3(1, 0, 0);
    default: return new THREE.Vector3(1, 0, 0);
  }
}

/**
 * Rotate a tangent vector around the face normal by an angle (radians).
 */
export function rotateTangent(forward, face, angle) {
  const n = FACE_NORMALS[face];
  return forward.clone().applyAxisAngle(n, angle);
}

/**
 * Core physics step: move the crawler on the cube surface.
 *
 * @param {Object} state - { position: Vector3, forward: Vector3, face: string,
 *                            velocity: number, jumpHeight: number, jumpVel: number }
 * @param {Object} input - { turnRate: number (-1 to 1), thrust: number (0 or 1),
 *                            brake: number, jump: boolean, sprint: boolean }
 * @param {number} dt - Delta time in seconds
 * @param {number} size - Cube size
 * @returns {Object} Updated state
 */
export function stepCrawler(state, input, dt, size) {
  const { position, forward, face, jumpHeight, jumpVel } = state;
  let vel = state.velocity;

  // --- Turning ---
  const turnSpeed = 3.5; // radians per second
  let newForward = forward.clone();
  if (input.turnRate !== 0) {
    newForward = rotateTangent(forward, face, -input.turnRate * turnSpeed * dt);
  }

  // --- Acceleration ---
  const maxSpeed = input.sprint ? 5.0 : 3.0;
  const accel = 12.0;
  const friction = 8.0;

  if (input.thrust > 0) {
    vel = Math.min(maxSpeed, vel + accel * dt);
  } else {
    vel = Math.max(0, vel - friction * dt);
  }

  // --- Jump ---
  const gravity = 18.0;
  const jumpForce = 7.0;
  let newJumpHeight = jumpHeight;
  let newJumpVel = jumpVel;

  if (input.jump && jumpHeight <= 0.01) {
    newJumpVel = jumpForce;
    newJumpHeight = 0.01;
  }

  newJumpVel -= gravity * dt;
  newJumpHeight += newJumpVel * dt;

  if (newJumpHeight <= 0) {
    newJumpHeight = 0;
    newJumpVel = 0;
  }

  // --- Movement ---
  const moveDir = newForward.clone().normalize();
  const step = moveDir.multiplyScalar(vel * dt);
  const normal = FACE_NORMALS[face];
  // Lift position off surface by jumpHeight along normal
  const surfacePos = position.clone().sub(normal.clone().multiplyScalar(jumpHeight));
  const newSurfacePos = surfacePos.add(step);

  // Project back onto cube surface
  const projected = projectOntoCube(newSurfacePos, size);
  const newFace = projected.face;
  const newPosition = projected.position.clone().add(
    FACE_NORMALS[newFace].clone().multiplyScalar(newJumpHeight)
  );

  // Re-project forward onto new face if face changed
  let finalForward = newForward;
  if (newFace !== face) {
    finalForward = projectOntoFace(newForward, newFace);
    if (finalForward.length() < 0.001) {
      finalForward = getDefaultForward(newFace);
    } else {
      finalForward.normalize();
    }
  }

  return {
    position: newPosition,
    forward: finalForward,
    face: newFace,
    velocity: vel,
    jumpHeight: newJumpHeight,
    jumpVel: newJumpVel,
  };
}

/**
 * Get the ground-level world position (no jump offset) for a crawler state.
 */
export function getGroundPosition(state, _size) {
  const normal = FACE_NORMALS[state.face];
  return state.position.clone().sub(normal.clone().multiplyScalar(state.jumpHeight));
}

/**
 * Convert world position to the nearest grid cell (for sticker lookup).
 */
export function worldToGrid(worldPos, face, size) {
  const k = (size - 1) / 2;
  // Remove surface offset to get base position
  const p = worldPos.clone();
  switch (face) {
    case 'PX': case 'NX': p.x = 0; break;
    case 'PY': case 'NY': p.y = 0; break;
    case 'PZ': case 'NZ': p.z = 0; break;
  }

  const x = Math.round(clamp(p.x + k, 0, size - 1));
  const y = Math.round(clamp(p.y + k, 0, size - 1));
  const z = Math.round(clamp(p.z + k, 0, size - 1));

  // Fix the coordinate that should be at face boundary
  switch (face) {
    case 'PX': return { x: size - 1, y, z, dirKey: face };
    case 'NX': return { x: 0, y, z, dirKey: face };
    case 'PY': return { x, y: size - 1, z, dirKey: face };
    case 'NY': return { x, y: 0, z, dirKey: face };
    case 'PZ': return { x, y, z: size - 1, dirKey: face };
    case 'NZ': return { x, y, z: 0, dirKey: face };
    default: return { x, y, z, dirKey: face };
  }
}

/**
 * Apply a cube rotation to the crawler's world position and forward vector.
 * Returns updated state if the crawler was on the rotating slice, or unchanged.
 */
export function rotateCrawlerWithSlice(state, axis, sliceIndex, dir, size) {
  const grid = worldToGrid(getGroundPosition(state, size), state.face, size);

  let inSlice = false;
  if (axis === 'col' && grid.x === sliceIndex) inSlice = true;
  if (axis === 'row' && grid.y === sliceIndex) inSlice = true;
  if (axis === 'depth' && grid.z === sliceIndex) inSlice = true;

  if (!inSlice) return state;

  // Build rotation quaternion
  const rotAxis = axis === 'col'
    ? new THREE.Vector3(1, 0, 0)
    : axis === 'row'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  const angle = dir * (Math.PI / 2);
  const quat = new THREE.Quaternion().setFromAxisAngle(rotAxis, angle);

  const newPos = state.position.clone().applyQuaternion(quat);
  const newFwd = state.forward.clone().applyQuaternion(quat);
  const projected = projectOntoCube(newPos, size);

  return {
    ...state,
    position: projected.position.clone().add(
      FACE_NORMALS[projected.face].clone().multiplyScalar(state.jumpHeight)
    ),
    forward: projectOntoFace(newFwd, projected.face).normalize(),
    face: projected.face,
  };
}

/**
 * Spawn orb positions on cube surface (world coordinates).
 */
export function spawnCrawlerOrbs(count, size, crawlerPos) {
  const k = (size - 1) / 2;
  const s = k + SURFACE_OFFSET;
  const orbs = [];
  const faces = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

  for (let i = 0; i < count; i++) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    const u = (Math.random() * (size - 1)) - k;
    const v = (Math.random() * (size - 1)) - k;

    let pos;
    switch (face) {
      case 'PX': pos = new THREE.Vector3(s, u, v); break;
      case 'NX': pos = new THREE.Vector3(-s, u, v); break;
      case 'PY': pos = new THREE.Vector3(u, s, v); break;
      case 'NY': pos = new THREE.Vector3(u, -s, v); break;
      case 'PZ': pos = new THREE.Vector3(u, v, s); break;
      case 'NZ': pos = new THREE.Vector3(u, v, -s); break;
    }

    // Don't spawn too close to crawler
    if (crawlerPos && pos.distanceTo(crawlerPos) < 1.5) {
      i--;
      continue;
    }

    orbs.push({ position: pos, face, collected: false, id: i });
  }
  return orbs;
}

/**
 * Check if crawler collides with an orb (distance-based).
 */
export function checkOrbCollision(crawlerPos, orbPos, threshold = 0.6) {
  return crawlerPos.distanceTo(orbPos) < threshold;
}

/**
 * Check if crawler is on a flipped (parity) sticker.
 */
export function isOnParityZone(state, cubies, size) {
  const grid = worldToGrid(getGroundPosition(state, size), state.face, size);
  const sticker = cubies[grid.x]?.[grid.y]?.[grid.z]?.stickers?.[grid.dirKey];
  if (!sticker) return false;
  return sticker.curr !== sticker.orig;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export { FACE_NORMALS, SURFACE_OFFSET };
