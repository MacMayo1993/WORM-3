// src/utils/constants.js
// Core game constants and color mappings

export const COLORS = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#FFD500',
  white: '#ffffff',
  orange: '#f97316',
  green: '#22c55e',
  black: '#121212',
  wormhole: '#dda15e'
};

/**
 * Classic Rubik's sticker palette — the physical cube's colours, as distinct
 * from COLORS above, which is the in-game standard scheme.
 *
 * The two differ on purpose. The in-game scheme is tuned for the manifold's
 * antipodal reveal and sits in a bright, screen-native register. This one is
 * the toy: a deep crimson red rather than a light one, and a vivid orange, so
 * red and orange separate the way they do on a real cube. Reach for it where
 * the UI is naming the physical object — the cube-face nav tiles and the mode
 * carousel — and for COLORS where the game is rendering play state.
 */
export const RUBIKS_CLASSIC = {
  red: '#C41E3A',
  green: '#009B48',
  blue: '#0051A2',
  orange: '#FF7A00',
  yellow: '#FFD500',
  white: '#F0F0F0'
};

/** The same palette keyed by face ID, so callers can go straight from DIR_TO_COLOR. */
export const RUBIKS_FACE_COLORS = {
  1: RUBIKS_CLASSIC.red,     // PZ - Front
  2: RUBIKS_CLASSIC.green,   // NX - Left
  3: RUBIKS_CLASSIC.white,   // PY - Top
  4: RUBIKS_CLASSIC.orange,  // NZ - Back
  5: RUBIKS_CLASSIC.blue,    // PX - Right
  6: RUBIKS_CLASSIC.yellow   // NY - Bottom
};

/**
 * Ink that stays readable on a given fill. White and yellow stickers need dark
 * type; the rest take cream. Computed from relative luminance rather than
 * listed per colour, so swapping a palette value cannot silently leave white
 * text on a white tile.
 */
export const readableInk = (hex, { dark = '#1a1410', light = '#fffdf2' } = {}) => {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return light;
  const chan = (i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
  return L > 0.42 ? dark : light;
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

// Convert vector to direction key — O(1) Map lookup instead of 6-branch if-chain
const _VEC_TO_DIR_MAP = new Map([
  ['1,0,0', 'PX'], ['-1,0,0', 'NX'],
  ['0,1,0', 'PY'], ['0,-1,0', 'NY'],
  ['0,0,1', 'PZ'], ['0,0,-1', 'NZ'],
]);
export const VEC_TO_DIR = (x, y, z) => {
  const dir = _VEC_TO_DIR_MAP.get(`${x},${y},${z}`);
  if (!dir) throw new Error(`VEC_TO_DIR: invalid vector (${x}, ${y}, ${z})`);
  return dir;
};

// Antipodal face mapping (for Antipodal Mode)
// Maps each face direction to its opposite
export const ANTIPODAL_FACE = {
  PZ: 'NZ',  // Front ↔ Back
  NZ: 'PZ',
  PX: 'NX',  // Right ↔ Left
  NX: 'PX',
  PY: 'NY',  // Top ↔ Bottom
  NY: 'PY'
};

// Axis to antipodal face mapping (for slice rotations)
// Maps rotation axis to the faces that are antipodal
export const AXIS_TO_ANTIPODAL_FACES = {
  row: ['PY', 'NY'],    // Y-axis: Top ↔ Bottom
  col: ['PX', 'NX'],    // X-axis: Right ↔ Left
  depth: ['PZ', 'NZ']   // Z-axis: Front ↔ Back
};

// Face direction → solved face ID (1-6)
export const DIR_TO_COLOR = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

// Face ID (1-6) → face direction
export const COLOR_TO_DIR = { 1: 'PZ', 2: 'NX', 3: 'PY', 4: 'NZ', 5: 'PX', 6: 'NY' };

// Flip cap — tiles "die" at this many flips (standard mode, outside Disparity/Chaos)
export const FLIP_CAP = 6;

// Distance from the cubie center to the outer face of a sticker (world units).
// Used consistently across coordinates.js, crawlerPhysics.js, and any code that
// needs to position geometry on the cube surface.
export const SURFACE_OFFSET = 0.52;

// Where a wormhole ribbon anchors on its tile: a distance along the tile's face
// normal from the cubie centre, POSITIVE meaning the tile side.
//
// This used to be −0.52 duplicated across five files, which put every tunnel
// endpoint a full cubie width (1.04) away from the tile it belongs to, on the
// opposite side of the cubie — tunnels visibly stopped short of their tiles and
// the worm teleported that distance when its dive handed off to the ride.
// Slightly inside SURFACE_OFFSET so the ribbon's end edge is not coplanar with
// the sticker it meets. Every consumer imports this; nothing redefines it.
export const TUNNEL_ANCHOR_OFFSET = 0.50;

// Victory condition type constants (use instead of magic strings)
export const VICTORY = {
  RUBIKS:   'rubiks',
  SUDOKUBE: 'sudokube',
  ULTIMATE: 'ultimate',
  WORM:     'worm',
};

// Rotation axis constants (use instead of magic strings)
export const AXIS = {
  COL:   'col',
  ROW:   'row',
  DEPTH: 'depth',
};

// Game mode identifiers — returned by getActiveMode() selector
export const MODES = {
  FREEPLAY:    'freeplay',    // Default, no special mode active
  WORM_HEALER: 'worm-healer', // Co-op platformer / worm healer
  TEACH:       'teach',       // Teaching / algorithm mode
  HOLONOMY:    'holonomy',    // Holonomy loop mode
  MERGE:       'merge',       // Merge Blocks mode
  HOLLOW:      'hollow',      // Hollow Void Cube
  MIRROR:      'mirror',      // Mirror Blocks mode
  CHAOS:       'chaos',       // Chaos / Disparity mode (chaosLevel > 0)
  FLIP:        'flip',        // Flip Mode
};

// Half-life acceleration: each halving of remaining distance doubles the rate.
// Scales with the cap in force — e.g. at cap 6: flips 0-2 = 1x, 3-4 = 2x, 5 = 4x.
// Disparity/Chaos sessions pass their configured cap (selectEffectiveFlipCap) so
// decay accelerates against the tile life those sessions actually grant, rather
// than against the standard-play constant.
export const getHalfLifeMultiplier = (flips, flipCap = FLIP_CAP) => {
  if (flips >= flipCap) return 0; // dead tile
  const remaining = flipCap - flips;
  return Math.pow(2, Math.max(0, Math.floor(Math.log2(flipCap / remaining))));
};
