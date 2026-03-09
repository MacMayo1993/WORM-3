/**
 * mergeRegions.js — Merge Mode region detection
 *
 * Pure function. No React dependencies.
 * Given the current cube state, finds connected same-color sticker regions
 * on each face and assigns each sticker an evolution tier.
 *
 * Tier rules (scales with cube size):
 *   Tier 1 — 1–2 connected tiles of the same color  (base form)
 *   Tier 2 — 3 to (size²-1) connected tiles          (mid form, pulses)
 *   Tier 3 — size² tiles (full face covered)          (final form, pops out)
 *
 * Result is keyed by "home key": `${origPos.x}-${origPos.y}-${origPos.z}-${origDir}`
 * This key is stable for a given sticker regardless of where it has moved,
 * and is already available in StickerPlane via meta.origPos + meta.origDir.
 */

// Maps each face direction to the two axes that form its 2D face grid.
// ax and ay are the grid coords used for adjacency BFS.
const DIR_FACE_AXES = {
  PZ: (x, _y, z) => ({ ax: x, ay: z }),  // NB: PZ face sits at y=size-1 plane but grid is XZ? No…
  NZ: (x, _y, z) => ({ ax: x, ay: z }),
  PX: (_x, y, z) => ({ ax: y, ay: z }),
  NX: (_x, y, z) => ({ ax: y, ay: z }),
  PY: (x, _y, z) => ({ ax: x, ay: z }),
  NY: (x, _y, z) => ({ ax: x, ay: z }),
};

// Correct face axes: each face is a 2D slice of the cube.
// PZ (front, z=size-1): grid is (x, y)
// NZ (back,  z=0):      grid is (x, y)
// PX (right, x=size-1): grid is (y, z)
// NX (left,  x=0):      grid is (y, z)
// PY (top,   y=size-1): grid is (x, z)
// NY (bottom,y=0):      grid is (x, z)
const FACE_GRID = {
  PZ: (x, y, _z) => ({ ax: x, ay: y }),
  NZ: (x, y, _z) => ({ ax: x, ay: y }),
  PX: (_x, y, z) => ({ ax: y, ay: z }),
  NX: (_x, y, z) => ({ ax: y, ay: z }),
  PY: (x, _y, z) => ({ ax: x, ay: z }),
  NY: (x, _y, z) => ({ ax: x, ay: z }),
};

const DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

/**
 * computeMergeRegions(cubies, size)
 *
 * @param {Array} cubies  3D array cubies[x][y][z] as returned by makeCubies / rotateSliceCubies
 * @param {number} size   Cube dimension (2–5)
 * @returns {Object}      Map-like plain object: homeKey → tier (1 | 2 | 3)
 */
export function computeMergeRegions(cubies, size) {
  const result = {};
  const fullFaceSize = size * size;

  for (const dir of DIRS) {
    // Build a map from face-grid coord string → sticker descriptor
    // byCoord: "ax-ay" → { ax, ay, color, homeKey }
    const byCoord = new Map();
    const getAxes = FACE_GRID[dir];

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cubie = cubies[x]?.[y]?.[z];
          if (!cubie) continue;
          const sticker = cubie.stickers[dir];
          if (!sticker) continue; // this cubie has no face in this direction

          const { ax, ay } = getAxes(x, y, z);
          const homeKey = `${sticker.origPos.x}-${sticker.origPos.y}-${sticker.origPos.z}-${sticker.origDir}`;
          byCoord.set(`${ax}-${ay}`, { ax, ay, color: sticker.curr, homeKey });
        }
      }
    }

    if (byCoord.size === 0) continue;

    // BFS: find connected components of same-color stickers on this face
    const visited = new Set();

    for (const [coord] of byCoord) {
      if (visited.has(coord)) continue;

      const region = [];
      const queue = [coord];
      visited.add(coord);

      while (queue.length > 0) {
        const cur = queue.shift();
        region.push(cur);
        const { ax, ay, color } = byCoord.get(cur);

        const neighbors = [
          `${ax + 1}-${ay}`,
          `${ax - 1}-${ay}`,
          `${ax}-${ay + 1}`,
          `${ax}-${ay - 1}`,
        ];

        for (const nb of neighbors) {
          if (visited.has(nb)) continue;
          const ns = byCoord.get(nb);
          if (!ns || ns.color !== color) continue;
          visited.add(nb);
          queue.push(nb);
        }
      }

      // Assign tier based on region size
      const tier = region.length >= fullFaceSize ? 3 : region.length >= 3 ? 2 : 1;
      for (const c of region) {
        result[byCoord.get(c).homeKey] = tier;
      }
    }
  }

  return result;
}
