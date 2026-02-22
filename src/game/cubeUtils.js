/**
 * Cube Utility Functions
 *
 * Common utilities for cube operations, eliminating duplicated logic.
 */

/**
 * Check if a sticker at (x, y, z) with direction dirKey is on the cube's edge
 * (i.e., is a visible sticker on the outside of the cube)
 *
 * @param {number} x - X coordinate (0 to size-1)
 * @param {number} y - Y coordinate (0 to size-1)
 * @param {number} z - Z coordinate (0 to size-1)
 * @param {string} dirKey - Direction key: 'PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'
 * @param {number} size - Cube size (e.g., 3 for 3x3x3)
 * @returns {boolean} True if the sticker is on the edge
 */
export function isOnEdge(x, y, z, dirKey, size) {
  switch (dirKey) {
    case 'PX': return x === size - 1;
    case 'NX': return x === 0;
    case 'PY': return y === size - 1;
    case 'NY': return y === 0;
    case 'PZ': return z === size - 1;
    case 'NZ': return z === 0;
    default: return false;
  }
}

/**
 * Check if a cubie at position (x, y, z) is on the edge for any of the given directions
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @param {number} size - Cube size
 * @returns {Object} Object with boolean flags for each face
 */
export function getEdgeFlags(x, y, z, size) {
  return {
    px: x === size - 1,
    nx: x === 0,
    py: y === size - 1,
    ny: y === 0,
    pz: z === size - 1,
    nz: z === 0,
  };
}

/**
 * Get all visible sticker directions for a cubie at position (x, y, z)
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @param {number} size - Cube size
 * @returns {string[]} Array of direction keys for visible stickers
 */
export function getVisibleDirections(x, y, z, size) {
  const dirs = [];
  if (x === size - 1) dirs.push('PX');
  if (x === 0) dirs.push('NX');
  if (y === size - 1) dirs.push('PY');
  if (y === 0) dirs.push('NY');
  if (z === size - 1) dirs.push('PZ');
  if (z === 0) dirs.push('NZ');
  return dirs;
}

/**
 * Iterate over all edge stickers in the cube
 *
 * @param {number} size - Cube size
 * @param {function} callback - Called with (x, y, z, dirKey) for each edge sticker
 */
export function forEachEdgeSticker(size, callback) {
  const dirs = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        for (const dirKey of dirs) {
          if (isOnEdge(x, y, z, dirKey, size)) {
            callback(x, y, z, dirKey);
          }
        }
      }
    }
  }
}

/**
 * Count total edge stickers for a given cube size
 *
 * @param {number} size - Cube size
 * @returns {number} Total number of edge stickers (6 * size * size)
 */
export function countEdgeStickers(size) {
  return 6 * size * size;
}
