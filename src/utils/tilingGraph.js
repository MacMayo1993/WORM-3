// src/utils/tilingGraph.js
// Tiling graph representation for WORM³ RP² Rubik's cube.
//
// Reframes the cube surface as an abstract graph:
//   Vertices  = sticker positions (54 for 3×3)
//   Edges     = surface adjacency (within-face 4-connected + cross-face folds + RP² antipodal)
//   Cycles    = precomputed cycle decompositions for each standard move
//
// This enables O(1) twist application, compact state (array of ints), and
// instant parity/invariant computation for the RP² quotient structure.

import { makeCubies } from '../game/cubeState.js';
import { ANTIPODAL_FACE } from './constants.js';

// Face order (index 0–5 used internally)
export const FACE_DIRS = ['PZ', 'NX', 'PY', 'NZ', 'PX', 'NY'];
const DIR_TO_FACE_IDX = { PZ: 0, NX: 1, PY: 2, NZ: 3, PX: 4, NY: 5 };

// Standard move definitions (U/D/R/L/F/B and primes, plus middle slices for odd sizes)
const MOVE_TEMPLATES = [
  { key: 'U', axis: 'row', sliceRel: 'top', dir: 1 },
  { key: "U'", axis: 'row', sliceRel: 'top', dir: -1 },
  { key: 'D', axis: 'row', sliceRel: 'bottom', dir: -1 },
  { key: "D'", axis: 'row', sliceRel: 'bottom', dir: 1 },
  { key: 'R', axis: 'col', sliceRel: 'top', dir: 1 },
  { key: "R'", axis: 'col', sliceRel: 'top', dir: -1 },
  { key: 'L', axis: 'col', sliceRel: 'bottom', dir: -1 },
  { key: "L'", axis: 'col', sliceRel: 'bottom', dir: 1 },
  { key: 'F', axis: 'depth', sliceRel: 'top', dir: 1 },
  { key: "F'", axis: 'depth', sliceRel: 'top', dir: -1 },
  { key: 'B', axis: 'depth', sliceRel: 'bottom', dir: -1 },
  { key: "B'", axis: 'depth', sliceRel: 'bottom', dir: 1 },
];

// ─── Vertex encoding ─────────────────────────────────────────────────────────

// Compute face grid (r, c) from 3D cubie position and face direction.
// Matches faceRCFor() in src/game/coordinates.js exactly.
function faceRC(dirKey, x, y, z, size) {
  const s = size - 1;
  switch (dirKey) {
    case 'PZ': return [s - y, x];
    case 'NZ': return [s - y, s - x];
    case 'PX': return [s - y, s - z];
    case 'NX': return [s - y, z];
    case 'PY': return [z, x];
    case 'NY': return [s - z, x];
    default: return [0, 0];
  }
}

// Compute 3D cubie position from face index and grid (r, c).
// Inverse of faceRC.
function faceRCTo3D(faceIdx, r, c, size) {
  const s = size - 1;
  switch (FACE_DIRS[faceIdx]) {
    case 'PZ': return [c, s - r, s];
    case 'NZ': return [s - c, s - r, 0];
    case 'PX': return [s, s - r, s - c];
    case 'NX': return [0, s - r, c];
    case 'PY': return [c, s, r];
    case 'NY': return [c, 0, s - r];
    default: return [0, 0, 0];
  }
}

// Map (dirKey, x, y, z) → vertex index in [0, 6*size²).
export function stickerVertex(dirKey, x, y, z, size) {
  const faceIdx = DIR_TO_FACE_IDX[dirKey];
  const [r, c] = faceRC(dirKey, x, y, z, size);
  return faceIdx * size * size + r * size + c;
}

// Decode vertex index → { faceIdx, r, c }.
export function vertexToFaceRC(v, size) {
  const sz = size * size;
  const faceIdx = Math.floor(v / sz);
  const rem = v % sz;
  return { faceIdx, r: Math.floor(rem / size), c: rem % size };
}

// Compute the RP² antipodal vertex for vertex v.
// Antipodal identification: point (dir, x, y, z) ↔ (ANTIPODAL_FACE[dir], s-x, s-y, s-z).
export function antipodalVertex(v, size) {
  const { faceIdx, r, c } = vertexToFaceRC(v, size);
  const dirKey = FACE_DIRS[faceIdx];
  const [x, y, z] = faceRCTo3D(faceIdx, r, c, size);
  const s = size - 1;
  const antiDir = ANTIPODAL_FACE[dirKey];
  return stickerVertex(antiDir, s - x, s - y, s - z, size);
}

// ─── Adjacency ───────────────────────────────────────────────────────────────

// Build the full adjacency list for the tiling graph.
// Three kinds of edges:
//   1. Within-face: 4-connected grid neighbours on the same face
//   2. Cross-face:  stickers on the same corner/edge cubie share a surface fold
//   3. Antipodal:   RP² identification connects each sticker to its antipodal twin
function buildAdjacency(size, cubies) {
  const numVerts = 6 * size * size;
  const adj = Array.from({ length: numVerts }, () => new Set());

  // 1. Within-face adjacency (horizontal and vertical neighbours)
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = faceIdx * size * size + r * size + c;
        if (r > 0) {
          const nb = faceIdx * size * size + (r - 1) * size + c;
          adj[v].add(nb);
          adj[nb].add(v);
        }
        if (c > 0) {
          const nb = faceIdx * size * size + r * size + (c - 1);
          adj[v].add(nb);
          adj[nb].add(v);
        }
      }
    }
  }

  // 2. Cross-face adjacency: every pair of stickers on the same cubie shares a
  //    surface edge (whether the cubie is an edge piece with 2 stickers or a
  //    corner piece with 3).
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const dirs = Object.keys(cubies[x][y][z].stickers);
        if (dirs.length < 2) continue;
        for (let i = 0; i < dirs.length; i++) {
          for (let j = i + 1; j < dirs.length; j++) {
            const vi = stickerVertex(dirs[i], x, y, z, size);
            const vj = stickerVertex(dirs[j], x, y, z, size);
            adj[vi].add(vj);
            adj[vj].add(vi);
          }
        }
      }
    }
  }

  // 3. RP² antipodal edges
  for (let v = 0; v < numVerts; v++) {
    const av = antipodalVertex(v, size);
    adj[v].add(av);
    adj[av].add(v);
  }

  return adj.map((s) => [...s].sort((a, b) => a - b));
}

// ─── Cycle computation ───────────────────────────────────────────────────────

// Convert direction vector to direction key.
function vecToDir(x, y, z) {
  if (x === 1) return 'PX';
  if (x === -1) return 'NX';
  if (y === 1) return 'PY';
  if (y === -1) return 'NY';
  if (z === 1) return 'PZ';
  return 'NZ';
}

// Compute the permutation induced by a single slice rotation.
// Returns perm[] where perm[newVertex] = oldVertex
// (the sticker that was at oldVertex moved to newVertex after the rotation).
function computeRotationPermutation(size, axis, sliceIndex, dir) {
  const numVerts = 6 * size * size;
  const perm = Array.from({ length: numVerts }, (_, i) => i); // identity
  const k = (size - 1) / 2;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const inSlice =
          (axis === 'col' && x === sliceIndex) ||
          (axis === 'row' && y === sliceIndex) ||
          (axis === 'depth' && z === sliceIndex);
        if (!inSlice) continue;

        // Rotate the cubie's centre position.
        let cx = x - k, cy = y - k, cz = z - k;
        let ncx, ncy, ncz;
        if (axis === 'col') {
          ncx = cx;
          ncy = -dir * cz;
          ncz = dir * cy;
        } else if (axis === 'row') {
          ncx = dir * cz;
          ncy = cy;
          ncz = -dir * cx;
        } else {
          ncx = -dir * cy;
          ncy = dir * cx;
          ncz = cz;
        }
        const nx = Math.round(ncx + k);
        const ny = Math.round(ncy + k);
        const nz = Math.round(ncz + k);

        // For each face direction, rotate the direction vector and compute new vertex.
        const FACE_VECS = [
          ['PX', 1, 0, 0],
          ['NX', -1, 0, 0],
          ['PY', 0, 1, 0],
          ['NY', 0, -1, 0],
          ['PZ', 0, 0, 1],
          ['NZ', 0, 0, -1],
        ];

        for (const [dirKey, vx, vy, vz] of FACE_VECS) {
          // Only process faces that are on the outer boundary of this cubie.
          const onBoundary =
            (vx === 1 && x === size - 1) ||
            (vx === -1 && x === 0) ||
            (vy === 1 && y === size - 1) ||
            (vy === -1 && y === 0) ||
            (vz === 1 && z === size - 1) ||
            (vz === -1 && z === 0);
          if (!onBoundary) continue;

          // Rotate the direction vector.
          let rvx, rvy, rvz;
          if (axis === 'col') {
            rvx = vx;
            rvy = -dir * vz;
            rvz = dir * vy;
          } else if (axis === 'row') {
            rvx = dir * vz;
            rvy = vy;
            rvz = -dir * vx;
          } else {
            rvx = -dir * vy;
            rvy = dir * vx;
            rvz = vz;
          }

          const newDirKey = vecToDir(rvx, rvy, rvz);
          const oldV = stickerVertex(dirKey, x, y, z, size);
          const newV = stickerVertex(newDirKey, nx, ny, nz, size);
          perm[newV] = oldV;
        }
      }
    }
  }

  return perm;
}

// Decompose a permutation into disjoint cycles (length ≥ 2 only).
function permToCycles(perm) {
  const visited = new Uint8Array(perm.length);
  const cycles = [];

  for (let start = 0; start < perm.length; start++) {
    if (visited[start] || perm[start] === start) {
      visited[start] = 1;
      continue;
    }
    const cycle = [];
    let cur = start;
    while (!visited[cur]) {
      visited[cur] = 1;
      cycle.push(cur);
      cur = perm[cur];
    }
    if (cycle.length > 1) cycles.push(cycle);
  }

  return cycles;
}

// Precompute all standard move cycles for a given cube size.
// Keys: 'U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"
// Also keyed by 'axis-sliceIndex-dir' for programmatic access.
// Middle-slice keys: 'M'/'S'/'E' (and primes) for odd sizes.
function precomputeCycles(size) {
  const cycles = {};

  for (const tmpl of MOVE_TEMPLATES) {
    const sliceIndex = tmpl.sliceRel === 'top' ? size - 1 : 0;
    const perm = computeRotationPermutation(size, tmpl.axis, sliceIndex, tmpl.dir);
    const c = permToCycles(perm);
    cycles[tmpl.key] = c;
    cycles[`${tmpl.axis}-${sliceIndex}-${tmpl.dir}`] = c;
  }

  // Middle slices for odd-sized cubes (3×3, 5×5, …)
  if (size % 2 === 1) {
    const mid = Math.floor(size / 2);
    const midDefs = [
      { key: 'M', axis: 'row', mid },
      { key: 'S', axis: 'col', mid },
      { key: 'E', axis: 'depth', mid },
    ];
    for (const { key, axis } of midDefs) {
      for (const dir of [1, -1]) {
        const perm = computeRotationPermutation(size, axis, mid, dir);
        const c = permToCycles(perm);
        const label = dir === 1 ? key : `${key}'`;
        cycles[label] = c;
        cycles[`${axis}-${mid}-${dir}`] = c;
      }
    }
  }

  return cycles;
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Build the complete tiling graph for a cube of the given size.
// Returns:
//   adj       – adjacency list (array of sorted neighbour arrays)
//   cycles    – precomputed move cycles (see precomputeCycles)
//   numVerts  – total vertex count (6 * size²)
//   size      – cube size
export function buildTilingGraph(size = 3) {
  const cubies = makeCubies(size);
  const numVerts = 6 * size * size;
  const adj = buildAdjacency(size, cubies);
  const cycles = precomputeCycles(size);
  return { adj, cycles, numVerts, size };
}

// Apply a precomputed move (given as an array of cycles) to a tiling state.
// state[v] = origVertex of the sticker currently at position v.
// Returns a new state array (does not mutate the input).
export function applyTwist(state, moveCycles) {
  const next = state.slice();
  for (const cycle of moveCycles) {
    const len = cycle.length;
    const saved = state[cycle[0]];
    for (let i = 0; i < len - 1; i++) {
      next[cycle[i]] = state[cycle[i + 1]];
    }
    next[cycle[len - 1]] = saved;
  }
  return next;
}

// Convert the current cubies state to a compact tiling state array.
// state[v] = original vertex (solved-state position) of the sticker at v.
// Solved state = identity permutation [0, 1, 2, …, numVerts-1].
export function cubiesToTilingState(cubies, size) {
  const numVerts = 6 * size * size;
  const state = new Array(numVerts).fill(-1);

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        for (const [dirKey, st] of Object.entries(cubies[x][y][z].stickers)) {
          const v = stickerVertex(dirKey, x, y, z, size);
          const origV = stickerVertex(st.origDir, st.origPos.x, st.origPos.y, st.origPos.z, size);
          state[v] = origV;
        }
      }
    }
  }

  return state;
}

// Compute the parity of a tiling state permutation.
// Returns 0 (even) or 1 (odd).
// Useful for detecting impossible states and RP² non-contractible loops.
export function computeGraphParity(state) {
  const visited = new Uint8Array(state.length);
  let oddLengthCycles = 0;

  for (let start = 0; start < state.length; start++) {
    if (visited[start]) continue;
    let len = 0;
    let cur = start;
    while (!visited[cur]) {
      visited[cur] = 1;
      cur = state[cur];
      len++;
    }
    // A cycle of length L contributes (L-1) transpositions.
    // Even L → (L-1) = odd number of transpositions → flips parity.
    if (len % 2 === 0) oddLengthCycles++;
  }

  return oddLengthCycles % 2;
}

// Check whether a tiling state represents the solved cube.
export function isTilingStateSolved(state) {
  for (let v = 0; v < state.length; v++) {
    if (state[v] !== v) return false;
  }
  return true;
}
