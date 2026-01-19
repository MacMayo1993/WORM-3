// src/utils/constants.js
// Core game constants and color mappings

export const COLORS = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#eab308',
  white: '#ffffff',
  orange: '#f97316',
  green: '#22c55e',
  black: '#121212',
  wormhole: '#dda15e'
};

// Map face ID (1-6) to color
export const FACE_COLORS = {
  1: COLORS.red,      // PZ - Front (Red)
  2: COLORS.green,    // NX - Left (Green)
  3: COLORS.white,    // PY - Top (White)
  4: COLORS.orange,   // NZ - Back (Orange)
  5: COLORS.blue,     // PX - Right (Blue)
  6: COLORS.yellow    // NY - Bottom (Yellow)
};

// Antipodal color mapping for projective plane topology
// Maps each face to its opposite face
export const ANTIPODAL_COLOR = {
  1: 4,  // Red (PZ) ↔ Orange (NZ)
  4: 1,
  2: 5,  // Green (NX) ↔ Blue (PX)
  5: 2,
  3: 6,  // White (PY) ↔ Yellow (NY)
  6: 3
};

// Direction key to vector mapping
export const DIR_TO_VEC = {
  PX: [1, 0, 0],    // Right (+X)
  NX: [-1, 0, 0],   // Left (-X)
  PY: [0, 1, 0],    // Top (+Y)
  NY: [0, -1, 0],   // Bottom (-Y)
  PZ: [0, 0, 1],    // Front (+Z)
  NZ: [0, 0, -1]    // Back (-Z)
};

// Convert vector to direction key
export const VEC_TO_DIR = (x, y, z) => {
  if (x === 1 && y === 0 && z === 0) return 'PX';
  if (x === -1 && y === 0 && z === 0) return 'NX';
  if (x === 0 && y === 1 && z === 0) return 'PY';
  if (x === 0 && y === -1 && z === 0) return 'NY';
  if (x === 0 && y === 0 && z === 1) return 'PZ';
  return 'NZ';
};
