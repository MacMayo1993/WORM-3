import * as THREE from 'three';
import { cubieHasFlippedFace } from '../../game/raisedCubie.js';
import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
import { SURFACE_OFFSET } from '../../utils/constants.js';

const AXES = ['x', 'y', 'z'];
const FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

// Build the boundary of the exposed floor opening, not a separate fence around
// every portal sticker. A raised corner exposes three faces; their shared cube
// edges are inside the opening and must not carry crossing strips of tape.
export function buildCautionPerimeter(positions, cubies, size, cap, separateCubies = false) {
  const faces = new Map();
  const visited = new Set();
  const addFace = (tile, dirKey) => {
    const key = `${tile.x},${tile.y},${tile.z},${dirKey}`;
    if (!faces.has(key)) faces.set(key, { x: tile.x, y: tile.y, z: tile.z, dirKey });
  };
  for (const tile of positions) {
    addFace(tile, tile.dirKey);
    const key = `${tile.x},${tile.y},${tile.z}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (!cubieHasFlippedFace(cubies[tile.x]?.[tile.y]?.[tile.z], cap)) continue;
    for (let axis = 0; axis < 3; axis++) {
      if (tile[AXES[axis]] === size - 1) addFace(tile, FACES[axis * 2]);
      if (tile[AXES[axis]] === 0) addFace(tile, FACES[axis * 2 + 1]);
    }
  }

  // Doubled grid coordinates give exact shared-vertex keys, including where
  // patches meet across cube edges and between neighboring raised cubies.
  const vertices = new Map(), edges = new Map();
  for (const face of faces.values()) {
    const axis = 'XYZ'.indexOf(face.dirKey[1]);
    const sign = face.dirKey[0] === 'P' ? 1 : -1;
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([du, dv]) => {
      const q = [face.x * 2, face.y * 2, face.z * 2];
      q[axis] += sign; q[u] += du; q[v] += dv;
      const center = [face.x, face.y, face.z];
      // Adjacent cubies share corners only while assembled. Explode separates
      // their unit-sized openings, so each cubie then needs its own boundary.
      const key = `${separateCubies ? center.join(',') + ':' : ''}${q.join(',')}`;
      if (!vertices.has(key)) vertices.set(key, { key, grid: q, center, normals: new Set(), up: new THREE.Vector3() });
      return vertices.get(key);
    });
    if (sign < 0) corners.reverse();
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const key = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
      if (edges.has(key)) edges.delete(key);
      else edges.set(key, { a, b, face });
    }
  }
  const posts = new Set();
  for (const { a, b, face } of edges.values()) for (const vertex of [a, b]) {
    posts.add(vertex);
    vertex.normals.add(face.dirKey);
  }
  for (const vertex of posts) for (const dir of vertex.normals) {
    const axis = 'XYZ'.indexOf(dir[1]);
    vertex.up.setComponent(axis, dir[0] === 'P' ? 1 : -1);
  }
  return { faces: [...faces.values()], edges: [...edges.values()], posts: [...posts] };
}

// At a cube edge, sum the adjacent face normals instead of normalizing them:
// each face keeps the same tape height, and both strips share a mitered corner.
// The base remains on the unraised floor throughout the cubie's formation.
export function cautionPointInto(out, vertex, size, expansion, height = 0) {
  const scale = cubeExpansionScale(size, expansion), k = (size - 1) / 2;
  for (let axis = 0; axis < 3; axis++) {
    const center = vertex.center[axis];
    const cornerOffset = vertex.grid[axis] / 2 - center;
    out.setComponent(axis, (center - k) * scale + cornerOffset);
  }
  return out.addScaledVector(vertex.up, SURFACE_OFFSET - 0.5 + height);
}
