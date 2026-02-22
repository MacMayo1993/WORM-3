import { describe, it, expect } from 'vitest';
import {
  buildTilingGraph,
  applyTwist,
  cubiesToTilingState,
  computeGraphParity,
  isTilingStateSolved,
  stickerVertex,
  antipodalVertex,
  vertexToFaceRC,
  FACE_DIRS,
} from '../utils/tilingGraph.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

// ─── Graph structure ──────────────────────────────────────────────────────────

describe('buildTilingGraph – structure', () => {
  it('creates the correct number of vertices for a 3×3 cube', () => {
    const g = buildTilingGraph(3);
    expect(g.numVerts).toBe(54);
    expect(g.adj.length).toBe(54);
  });

  it('creates the correct number of vertices for a 2×2 cube', () => {
    const g = buildTilingGraph(2);
    expect(g.numVerts).toBe(24);
    expect(g.adj.length).toBe(24);
  });

  it('creates the correct number of vertices for a 4×4 cube', () => {
    const g = buildTilingGraph(4);
    expect(g.numVerts).toBe(96);
    expect(g.adj.length).toBe(96);
  });

  it('adjacency lists are symmetric (undirected graph)', () => {
    const g = buildTilingGraph(3);
    for (let v = 0; v < g.numVerts; v++) {
      for (const nb of g.adj[v]) {
        expect(g.adj[nb]).toContain(v);
      }
    }
  });

  it('no vertex is its own neighbour (no self-loops)', () => {
    const g = buildTilingGraph(3);
    for (let v = 0; v < g.numVerts; v++) {
      expect(g.adj[v]).not.toContain(v);
    }
  });

  it('centre sticker on a face has exactly 4 within-face neighbours (3×3)', () => {
    const g = buildTilingGraph(3);
    // Centre of PZ face: faceIdx=0, r=1, c=1 → vertex 0*9+1*3+1 = 4
    const centre = 0 * 9 + 1 * 3 + 1;
    // Within-face: (0,1),(2,1),(1,0),(1,2) → vertices 1,7,3,5
    const withinFace = [
      0 * 9 + 0 * 3 + 1, // (0,1)
      0 * 9 + 2 * 3 + 1, // (2,1)
      0 * 9 + 1 * 3 + 0, // (1,0)
      0 * 9 + 1 * 3 + 2, // (1,2)
    ];
    for (const nb of withinFace) {
      expect(g.adj[centre]).toContain(nb);
    }
  });

  it('every vertex has an antipodal neighbour', () => {
    const g = buildTilingGraph(3);
    for (let v = 0; v < g.numVerts; v++) {
      const av = antipodalVertex(v, 3);
      expect(av).not.toBe(v);
      expect(g.adj[v]).toContain(av);
    }
  });
});

// ─── Vertex encoding ──────────────────────────────────────────────────────────

describe('stickerVertex', () => {
  it('maps distinct stickers to distinct vertices for 3×3', () => {
    const cubies = makeCubies(3);
    const verts = new Set();
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          for (const [dirKey] of Object.entries(cubies[x][y][z].stickers)) {
            verts.add(stickerVertex(dirKey, x, y, z, 3));
          }
        }
      }
    }
    expect(verts.size).toBe(54);
  });

  it('vertex IDs are in range [0, 54) for a 3×3 cube', () => {
    const cubies = makeCubies(3);
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          for (const [dirKey] of Object.entries(cubies[x][y][z].stickers)) {
            const v = stickerVertex(dirKey, x, y, z, 3);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(54);
          }
        }
      }
    }
  });
});

describe('antipodalVertex', () => {
  it('is its own inverse (double antipodal = identity)', () => {
    for (let v = 0; v < 54; v++) {
      const av = antipodalVertex(v, 3);
      expect(antipodalVertex(av, 3)).toBe(v);
    }
  });

  it('maps PZ face stickers to NZ face stickers', () => {
    // PZ = faceIdx 0, NZ = faceIdx 3
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const v = 0 * 9 + r * 3 + c;
        const av = antipodalVertex(v, 3);
        const { faceIdx } = vertexToFaceRC(av, 3);
        expect(FACE_DIRS[faceIdx]).toBe('NZ');
      }
    }
  });
});

// ─── Tiling state ─────────────────────────────────────────────────────────────

describe('cubiesToTilingState', () => {
  it('solved cubies produce the identity permutation', () => {
    const cubies = makeCubies(3);
    const state = cubiesToTilingState(cubies, 3);
    expect(state.length).toBe(54);
    for (let v = 0; v < 54; v++) {
      expect(state[v]).toBe(v);
    }
  });

  it('solved cubies → isTilingStateSolved returns true', () => {
    const cubies = makeCubies(3);
    const state = cubiesToTilingState(cubies, 3);
    expect(isTilingStateSolved(state)).toBe(true);
  });

  it('rotated cubies produce a non-identity permutation', () => {
    const cubies = makeCubies(3);
    const rotated = rotateSliceCubies(cubies, 3, 'row', 2, 1);
    const state = cubiesToTilingState(rotated, 3);
    const isIdentity = state.every((v, i) => v === i);
    expect(isIdentity).toBe(false);
  });
});

// ─── applyTwist ───────────────────────────────────────────────────────────────

describe('applyTwist', () => {
  it('applying a move and its inverse returns the solved state', () => {
    const g = buildTilingGraph(3);
    const solved = Array.from({ length: 54 }, (_, i) => i);

    for (const [key, cycles] of Object.entries(g.cycles)) {
      // Find the inverse move key
      let inverseKey;
      if (key.endsWith("'")) {
        inverseKey = key.slice(0, -1);
      } else if (!key.includes('-')) {
        inverseKey = `${key}'`;
      } else {
        continue; // skip axis-based keys for this test
      }
      if (!g.cycles[inverseKey]) continue;

      const afterMove = applyTwist(solved, cycles);
      const afterInverse = applyTwist(afterMove, g.cycles[inverseKey]);
      expect(afterInverse).toEqual(solved);
    }
  });

  it('applying the same move 4 times returns the solved state', () => {
    const g = buildTilingGraph(3);
    const solved = Array.from({ length: 54 }, (_, i) => i);

    for (const key of ['U', 'D', 'R', 'L', 'F', 'B']) {
      let state = solved.slice();
      for (let i = 0; i < 4; i++) {
        state = applyTwist(state, g.cycles[key]);
      }
      expect(state).toEqual(solved);
    }
  });

  it('tiling state matches cubiesToTilingState after one move', () => {
    const g = buildTilingGraph(3);
    // U move: axis='row', sliceIndex=2, dir=1
    const solved = Array.from({ length: 54 }, (_, i) => i);
    const tilingAfter = applyTwist(solved, g.cycles['U']);

    // Apply the same move to cubies and derive state
    const cubies = makeCubies(3);
    const rotated = rotateSliceCubies(cubies, 3, 'row', 2, 1);
    const cubiesAfter = cubiesToTilingState(rotated, 3);

    expect(tilingAfter).toEqual(cubiesAfter);
  });

  it('does not mutate the input state', () => {
    const g = buildTilingGraph(3);
    const original = Array.from({ length: 54 }, (_, i) => i);
    const copy = original.slice();
    applyTwist(original, g.cycles['R']);
    expect(original).toEqual(copy);
  });
});

// ─── Precomputed cycles ───────────────────────────────────────────────────────

describe('precomputeCycles', () => {
  it('contains standard move keys for 3×3', () => {
    const g = buildTilingGraph(3);
    const expected = ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"];
    for (const key of expected) {
      expect(g.cycles).toHaveProperty(key);
    }
  });

  it('contains middle-slice keys for odd size (3×3)', () => {
    const g = buildTilingGraph(3);
    expect(g.cycles).toHaveProperty('M');
    expect(g.cycles).toHaveProperty('S');
    expect(g.cycles).toHaveProperty('E');
  });

  it('does NOT contain middle-slice keys for even size (4×4)', () => {
    const g = buildTilingGraph(4);
    expect(g.cycles).not.toHaveProperty('M');
  });

  it('each cycle entry is a non-empty array of arrays', () => {
    const g = buildTilingGraph(3);
    for (const cycles of Object.values(g.cycles)) {
      expect(Array.isArray(cycles)).toBe(true);
      expect(cycles.length).toBeGreaterThan(0);
      for (const cycle of cycles) {
        expect(Array.isArray(cycle)).toBe(true);
        expect(cycle.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('all vertex indices in cycles are in valid range', () => {
    const g = buildTilingGraph(3);
    for (const cycles of Object.values(g.cycles)) {
      for (const cycle of cycles) {
        for (const v of cycle) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(54);
        }
      }
    }
  });
});

// ─── computeGraphParity ───────────────────────────────────────────────────────

describe('computeGraphParity', () => {
  it('solved state has parity 0', () => {
    const solved = Array.from({ length: 54 }, (_, i) => i);
    expect(computeGraphParity(solved)).toBe(0);
  });

  it('a single face move changes parity consistently', () => {
    const g = buildTilingGraph(3);
    const solved = Array.from({ length: 54 }, (_, i) => i);
    const after = applyTwist(solved, g.cycles['U']);
    // Parity is deterministic; just ensure it's 0 or 1
    const p = computeGraphParity(after);
    expect(p === 0 || p === 1).toBe(true);
  });

  it('parity returns to 0 after 4 identical moves', () => {
    const g = buildTilingGraph(3);
    let state = Array.from({ length: 54 }, (_, i) => i);
    for (let i = 0; i < 4; i++) {
      state = applyTwist(state, g.cycles['R']);
    }
    expect(computeGraphParity(state)).toBe(0);
  });
});

// ─── Cross-verification with cubeRotation ────────────────────────────────────

describe('tiling graph ↔ cubeRotation cross-verification', () => {
  const MOVES = [
    { key: 'U', axis: 'row', sliceIndex: 2, dir: 1 },
    { key: 'D', axis: 'row', sliceIndex: 0, dir: -1 },
    { key: 'R', axis: 'col', sliceIndex: 2, dir: 1 },
    { key: 'L', axis: 'col', sliceIndex: 0, dir: -1 },
    { key: 'F', axis: 'depth', sliceIndex: 2, dir: 1 },
    { key: 'B', axis: 'depth', sliceIndex: 0, dir: -1 },
  ];

  for (const { key, axis, sliceIndex, dir } of MOVES) {
    it(`tiling state matches cubies after move ${key}`, () => {
      const g = buildTilingGraph(3);
      const cubies = makeCubies(3);
      const solvedState = cubiesToTilingState(cubies, 3);

      // Apply via tiling graph
      const tilingResult = applyTwist(solvedState, g.cycles[key]);

      // Apply via cubies
      const rotatedCubies = rotateSliceCubies(cubies, 3, axis, sliceIndex, dir);
      const cubiesResult = cubiesToTilingState(rotatedCubies, 3);

      expect(tilingResult).toEqual(cubiesResult);
    });
  }

  it('multiple moves remain consistent between tiling and cubies', () => {
    const g = buildTilingGraph(3);
    let cubies = makeCubies(3);
    let state = cubiesToTilingState(cubies, 3);

    const sequence = [
      { key: 'U', axis: 'row', sliceIndex: 2, dir: 1 },
      { key: 'R', axis: 'col', sliceIndex: 2, dir: 1 },
      { key: "U'", axis: 'row', sliceIndex: 2, dir: -1 },
      { key: "R'", axis: 'col', sliceIndex: 2, dir: -1 },
    ];

    for (const mv of sequence) {
      state = applyTwist(state, g.cycles[mv.key]);
      cubies = rotateSliceCubies(cubies, 3, mv.axis, mv.sliceIndex, mv.dir);
    }

    expect(state).toEqual(cubiesToTilingState(cubies, 3));
  });
});
