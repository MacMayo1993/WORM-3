/**
 * antipodalMode.js - Core logic for Antipodal Mode (Mirror Quotient)
 *
 * Implements reverse antipodal rotations based on RP² topology.
 * When a face rotates CW, its antipodal face rotates CCW (opposite direction).
 */

/**
 * Get the antipodal slice index for a given rotation
 * @param {string} _axis - 'row', 'col', or 'depth' (not used, but kept for API consistency)
 * @param {number} sliceIndex - Original slice index (0 to size-1)
 * @param {number} size - Cube size
 * @returns {number} - Antipodal slice index
 */
export function getAntipodalSliceIndex(_axis, sliceIndex, size) {
  // Antipodal slice is the opposite slice: (size - 1 - sliceIndex)
  // For example, on a 3x3 cube:
  // - Slice 0 (top/front/right) ↔ Slice 2 (bottom/back/left)
  // - Slice 1 (middle) ↔ Slice 1 (same, middle layer)
  return size - 1 - sliceIndex;
}

/**
 * Get the reverse direction for antipodal rotation
 * @param {number} dir - Original direction (1 for CW, -1 for CCW)
 * @returns {number} - Reversed direction
 */
export function getReverseDirection(dir) {
  return -dir;
}

/**
 * Check if a rotation should trigger an antipodal echo
 * @param {string} _axis - 'row', 'col', or 'depth'
 * @param {number} _sliceIndex - Slice index
 * @param {number} _size - Cube size
 * @returns {boolean} - True if should trigger echo
 */
export function shouldTriggerEcho(_axis, _sliceIndex, _size) {
  // Always trigger echo for all slices in antipodal mode
  // Middle layer (for odd sizes) will rotate itself in reverse
  return true;
}

/**
 * Calculate echo synchronization percentage
 * @param {number} totalMoves - Total moves made
 * @param {number} reversalCount - Number of antipodal reversals
 * @returns {number} - Sync percentage (0-100)
 */
export function calculateEchoSync(totalMoves, reversalCount) {
  if (totalMoves === 0) return 100;
  // Perfect sync means reversalCount equals totalMoves (every move triggered an echo)
  const sync = Math.min(100, (reversalCount / totalMoves) * 100);
  return Math.round(sync);
}

/**
 * Generate a unique ID for an echo rotation
 * @returns {string} - Unique ID
 */
export function generateEchoId() {
  return `echo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get antipodal face information for visualization
 * @param {string} axis - 'row', 'col', or 'depth'
 * @param {number} sliceIndex - Slice index
 * @param {number} size - Cube size
 * @returns {object} - { originalFace, antipodalFace, isMiddleLayer }
 */
export function getAntipodalFaceInfo(axis, sliceIndex, size) {
  const antipodalSlice = getAntipodalSliceIndex(axis, sliceIndex, size);
  const isMiddleLayer = sliceIndex === antipodalSlice;

  let originalFace, antipodalFace;

  switch (axis) {
    case 'row': // Y-axis rotation
      originalFace = sliceIndex === 0 ? 'NY' : sliceIndex === size - 1 ? 'PY' : 'middle';
      antipodalFace = antipodalSlice === 0 ? 'NY' : antipodalSlice === size - 1 ? 'PY' : 'middle';
      break;
    case 'col': // X-axis rotation
      originalFace = sliceIndex === 0 ? 'NX' : sliceIndex === size - 1 ? 'PX' : 'middle';
      antipodalFace = antipodalSlice === 0 ? 'NX' : antipodalSlice === size - 1 ? 'PX' : 'middle';
      break;
    case 'depth': // Z-axis rotation
      originalFace = sliceIndex === 0 ? 'NZ' : sliceIndex === size - 1 ? 'PZ' : 'middle';
      antipodalFace = antipodalSlice === 0 ? 'NZ' : antipodalSlice === size - 1 ? 'PZ' : 'middle';
      break;
    default:
      originalFace = 'unknown';
      antipodalFace = 'unknown';
  }

  return {
    originalFace,
    antipodalFace,
    antipodalSlice,
    isMiddleLayer,
  };
}
