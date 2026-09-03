// src/game/winDetection.js
// Win condition detection logic
import { faceRCFor, faceValue } from './coordinates.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

// Map direction to expected face color
const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

// Canonical representative of a colour's antipodal class (RP² quotient).
// Red/Orange, Green/Blue and White/Yellow each collapse to a single class,
// represented by the smaller of the pair. classOf(1)===classOf(4), etc.
export const colorClass = (c) => Math.min(c, ANTIPODAL_COLOR[c]);

// Check if classic Rubik's cube is solved (all faces uniform color).
// When `antipodal` is true, stickers are compared up to antipodal
// identification — a face is "solved" if every sticker belongs to that face's
// antipodal class, so a tile flipped through a wormhole (showing its antipode)
// still counts as solved. This is the RP² quotient notion of solved.
//
// This is the win condition for WIN_CONDITIONS.ANTIPODAL levels, where the
// MANIFOLD is what gets solved rather than the literal colouring: opposite
// faces are one face of the real projective plane, so a tile showing its
// antipode is showing its own manifold and is home. Two consequences worth
// knowing before relying on it — a flip can never move a sticker out of its
// colour class, so flips neither help nor hinder such a solve (they are
// accepted, never required); and a 180° turn carries every tile to its
// antipodal face, so it leaves the cube solved at zero cost.
export const checkRubiksSolved = (cubies, size, { antipodal = false } = {}) => {
  const key = antipodal ? (c) => colorClass(c) : (c) => c;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        // Interior cubies have no stickers — skip them
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
        const c = cubies[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          if (key(st.curr) !== key(DIR_TO_FACE[dirKey])) return false;
        }
      }
    }
  }
  return true;
};

// Convenience wrapper: solved up to antipodal identification (flips allowed).
export const checkRubiksSolvedAntipodal = (cubies, size) => checkRubiksSolved(cubies, size, { antipodal: true });

// Rotation-invariant solved check: every face shows a SINGLE colour, regardless
// of which absolute face that colour "belongs" to. Because stickers are
// conserved (exactly size² of each colour), all six faces being uniform means
// the cube is genuinely solved — just possibly in a rotated orientation.
//
// This matters for cubes with no fixed centres (2×2, 4×4, …): they have 24
// equivalent solved orientations, and the strict `checkRubiksSolved` only
// accepts one of them, so a player who lines every face up in a rotated frame
// would otherwise never register a win. For odd cubes the two checks agree in
// practice, but this stays correct there too. Honours the same antipodal option.
export const checkRubiksSolvedRotationInvariant = (cubies, size, { antipodal = false } = {}) => {
  const key = antipodal ? (c) => colorClass(c) : (c) => c;
  const faceColor = {}; // dirKey -> the colour class seen so far on that face

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        // Interior cubies have no stickers — skip them
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
        const c = cubies[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          const v = key(st.curr);
          if (faceColor[dirKey] === undefined) faceColor[dirKey] = v;
          else if (faceColor[dirKey] !== v) return false;
        }
      }
    }
  }
  return true;
};

// The solved check the live game should use for a win. Cubes without fixed
// centres are judged rotation-invariantly (any of their 24 solved orientations
// counts); cubes with centres keep the strict home-orientation check so
// existing 3×3+ behaviour is unchanged.
export const checkRubiksWin = (cubies, size, opts) =>
  size % 2 === 0 ? checkRubiksSolvedRotationInvariant(cubies, size, opts) : checkRubiksSolved(cubies, size, opts);

// Sudokube condition for a single face: it shows every number 1..size² exactly
// once (1-9 on a 3×3, 1-16 on a 4×4). With one distinct number per home cell,
// a completed face is a full set of the numbers rather than a Latin square.
export const checkFaceComplete = (faceGrid, size) => {
  const target = size * size;
  const seen = new Set();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const val = faceGrid[r][c];
      if (val < 1 || val > target || seen.has(val)) return false;
      seen.add(val);
    }
  }
  return seen.size === target;
};

// Extract face grid for Sudokube checking.
// Each cell value is the sticker's ORIGINAL identity (origDir + origPos), NOT a
// function of its current grid position. Using the current position would give
// every cell its own home number by construction, so the check would trivially
// pass regardless of cube state — the identity value is what actually moves with
// the sticker as it travels the cube.
export const extractFaceGrid = (cubies, size, faceDir) => {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));

  // Only iterate the single plane of cubies that can have a sticker for this face
  const fill = (x, y, z) => {
    const st = cubies[x][y][z].stickers[faceDir];
    if (st) {
      const { r, c: col } = faceRCFor(faceDir, x, y, z, size);
      grid[r][col] = faceValue(st.origDir, st.origPos.x, st.origPos.y, st.origPos.z, size);
    }
  };

  if (faceDir === 'PX') {
    for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) fill(size - 1, y, z);
  } else if (faceDir === 'NX') {
    for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) fill(0, y, z);
  } else if (faceDir === 'PY') {
    for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) fill(x, size - 1, z);
  } else if (faceDir === 'NY') {
    for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) fill(x, 0, z);
  } else if (faceDir === 'PZ') {
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) fill(x, y, size - 1);
  } else {
    // NZ
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) fill(x, y, 0);
  }

  return grid;
};

// Check if Sudokube is solved (every face shows each number 1..size² exactly once)
export const checkSudokubeSolved = (cubies, size) => {
  const FACE_DIRS = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
  for (const faceDir of FACE_DIRS) {
    if (!checkFaceComplete(extractFaceGrid(cubies, size, faceDir), size)) return false;
  }
  return true;
};

// Returns true if every exterior sticker has been flipped through a wormhole at least once.
// Does NOT check whether the cube is solved — use checkWormVictory for the full condition.
// Exported so callers can drive WORM³ progress UI (e.g. "47/54 stickers flipped").
export const allStickersFlipped = (cubies, size) => {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
        for (const st of Object.values(cubies[x][y][z].stickers)) {
          if ((st.flips ?? 0) === 0) return false;
        }
      }
    }
  }
  return true;
};

// Count how many exterior stickers have been flipped at least once (flips > 0).
// Returns { flipped, total } for use in WORM³ progress UI.
export const countFlippedStickers = (cubies, size) => {
  let flipped = 0, total = 0;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
        for (const st of Object.values(cubies[x][y][z].stickers)) {
          total++;
          if ((st.flips ?? 0) > 0) flipped++;
        }
      }
    }
  }
  return { flipped, total };
};

// Check if WORM³ victory - cube is solved AND every sticker has traveled through wormhole
export const checkWormVictory = (cubies, size) => checkRubiksSolved(cubies, size) && allStickersFlipped(cubies, size);

// Main win detection function - returns { rubiks, sudokube, ultimate, worm }
//
// Priority note: `ultimate` (rubiks + sudokube) takes precedence over `worm`
// (rubiks + allFlipped). If a player simultaneously satisfies ALL four conditions,
// only `ultimate` and `worm` will both be true — the caller (useGameSession) sets
// `victory` to whichever it checks first. This is intentional: `ultimate` is the
// harder achievement and should be surfaced over `worm` if both are met at once.
export const detectWinConditions = (cubies, size) => {
  const rubiks = checkRubiksSolved(cubies, size);
  const sudokube = checkSudokubeSolved(cubies, size);
  const ultimate = rubiks && sudokube;
  // Reuse the already-computed rubiks result — avoids running the O(size²) scan twice.
  const worm = rubiks && allStickersFlipped(cubies, size);

  return { rubiks, sudokube, ultimate, worm };
};
