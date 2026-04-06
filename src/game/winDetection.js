// src/game/winDetection.js
// Win condition detection logic
import { faceRCFor, faceValue } from './coordinates.js';

// Check if classic Rubik's cube is solved (all faces uniform color)
export const checkRubiksSolved = (cubies, size) => {
  // Map direction to expected face color
  const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        // Interior cubies have no stickers — skip them
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
        const c = cubies[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          const expectedColor = DIR_TO_FACE[dirKey];
          if (st.curr !== expectedColor) return false;
        }
      }
    }
  }
  return true;
};

// Check if a single face is a valid Latin square (Sudokube condition)
export const checkFaceLatinSquare = (faceGrid, size) => {
  // Check rows
  for (let r = 0; r < size; r++) {
    const seen = new Set();
    for (let c = 0; c < size; c++) {
      const val = faceGrid[r][c];
      if (val < 1 || val > size || seen.has(val)) return false;
      seen.add(val);
    }
  }
  // Check columns
  for (let c = 0; c < size; c++) {
    const seen = new Set();
    for (let r = 0; r < size; r++) {
      const val = faceGrid[r][c];
      if (val < 1 || val > size || seen.has(val)) return false;
      seen.add(val);
    }
  }
  return true;
};

// Extract face grid for Sudokube checking.
// Each cell value is the sticker's ORIGINAL identity (origDir + origPos), NOT a
// function of its current grid position.  Using faceValue(faceDir, x, y, z) for
// the current position would always produce a valid Latin square by construction
// (faceValue is ((r+c) % size) + 1 which is inherently a Latin square pattern),
// making the check trivially pass regardless of cube state.
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

// Check if Sudokube is solved (all faces are valid Latin squares based on current positions)
export const checkSudokubeSolved = (cubies, size) => {
  const FACE_DIRS = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];
  for (const faceDir of FACE_DIRS) {
    if (!checkFaceLatinSquare(extractFaceGrid(cubies, size, faceDir), size)) return false;
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
export const detectWinConditions = (cubies, size) => {
  const rubiks = checkRubiksSolved(cubies, size);
  const sudokube = checkSudokubeSolved(cubies, size);
  const ultimate = rubiks && sudokube;
  // Reuse the already-computed rubiks result — avoids running the O(size²) scan twice.
  const worm = rubiks && allStickersFlipped(cubies, size);

  return { rubiks, sudokube, ultimate, worm };
};
