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
      if (seen.has(val)) return false;
      seen.add(val);
    }
  }
  return true;
};

// Extract face grid for Sudokube checking
export const extractFaceGrid = (cubies, size, faceDir) => {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        const st = c.stickers[faceDir];
        if (st) {
          const { r, c: col } = faceRCFor(faceDir, x, y, z, size);
          // Calculate Latin square value based on current color position
          // The value is derived from where this sticker's current color originated
          const val = faceValue(faceDir, x, y, z, size);
          grid[r][col] = val;
        }
      }
    }
  }
  return grid;
};

// Check if Sudokube is solved (all faces are valid Latin squares based on current positions)
export const checkSudokubeSolved = (cubies, size) => {
  const FACE_DIRS = ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY'];

  for (const faceDir of FACE_DIRS) {
    // Build the actual value grid based on sticker positions
    const grid = Array.from({ length: size }, () => Array(size).fill(0));

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const c = cubies[x][y][z];
          const st = c.stickers[faceDir];
          if (st) {
            const { r, c: col } = faceRCFor(faceDir, x, y, z, size);
            // Get the Latin square value from original position
            const origVal = faceValue(st.origDir, st.origPos.x, st.origPos.y, st.origPos.z, size);
            grid[r][col] = origVal;
          }
        }
      }
    }

    if (!checkFaceLatinSquare(grid, size)) return false;
  }
  return true;
};

// Check if WORM³ victory - entire cube solved but every sticker is in disparity (flipped)
export const checkWormVictory = (cubies, size) => {
  const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

  let allCorrectPosition = true;
  let allFlipped = true;
  let totalStickers = 0;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          totalStickers++;
          const expectedColor = DIR_TO_FACE[dirKey];

          // Check if sticker shows the correct color for its position
          if (st.curr !== expectedColor) {
            allCorrectPosition = false;
          }

          // Check if sticker has been flipped (curr !== orig)
          if (st.curr === st.orig) {
            allFlipped = false;
          }
        }
      }
    }
  }

  // WORM³ victory: cube is solved AND every single sticker is flipped
  return allCorrectPosition && allFlipped && totalStickers > 0;
};

// Main win detection function - returns { rubiks, sudokube, ultimate, worm }
export const detectWinConditions = (cubies, size) => {
  const rubiks = checkRubiksSolved(cubies, size);
  const sudokube = checkSudokubeSolved(cubies, size);
  const ultimate = rubiks && sudokube;
  const worm = checkWormVictory(cubies, size);

  return { rubiks, sudokube, ultimate, worm };
};
