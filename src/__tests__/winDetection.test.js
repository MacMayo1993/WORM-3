import { describe, it, expect } from 'vitest';
import {
  checkRubiksSolved,
  checkRubiksSolvedAntipodal,
  checkRubiksSolvedInverted,
  checkRubiksSolvedEitherPolarity,
  checkRubiksSolvedRotationInvariant,
  checkRubiksWin,
  colorClass,
  checkFaceComplete,
  checkWormVictory,
  detectWinConditions,
  extractFaceGrid,
  checkSudokubeSolved,
} from '../game/winDetection.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

// Simulate a wormhole flip: recolour a sticker to its antipode.
function flipSticker(cubies, x, y, z, dir) {
  const st = cubies[x][y][z].stickers[dir];
  st.curr = ANTIPODAL_COLOR[st.curr]; // toggle, matching the real wormhole flip
  st.flips = (st.flips ?? 0) + 1;
}

describe('checkRubiksSolved', () => {
  it('should return true for a freshly created cube', () => {
    const cubies = makeCubies(3);
    expect(checkRubiksSolved(cubies, 3)).toBe(true);
  });

  it('should return false for a scrambled cube', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    expect(checkRubiksSolved(cubies, 3)).toBe(false);
  });

  it('should return true after applying and reversing a rotation', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, -1);
    expect(checkRubiksSolved(cubies, 3)).toBe(true);
  });

  it('should return false for a solved cube with a flipped tile (strict mode)', () => {
    const cubies = makeCubies(3);
    flipSticker(cubies, 0, 0, 2, 'PZ');
    expect(checkRubiksSolved(cubies, 3)).toBe(false);
  });

  it('should work for different cube sizes', () => {
    const cubies2 = makeCubies(2);
    expect(checkRubiksSolved(cubies2, 2)).toBe(true);

    const cubies4 = makeCubies(4);
    expect(checkRubiksSolved(cubies4, 4)).toBe(true);
  });
});

describe('checkRubiksWin (rotation-invariant for centreless cubes)', () => {
  // Level 1 (Baby Cube) scramble: one top-layer turn. Turning the BOTTOM layer
  // instead makes every face uniform — a genuine solve in a rotated frame that
  // a first-time player naturally reaches. Strict absolute checking rejects it;
  // the win check must accept it.
  it('accepts a 2×2 solved in a rotated orientation', () => {
    let cubies = makeCubies(2);
    cubies = rotateSliceCubies(cubies, 2, 'row', 1, 1); // scramble (level 1)
    cubies = rotateSliceCubies(cubies, 2, 'row', 0, 1); // "solve" via the other layer

    expect(checkRubiksSolved(cubies, 2)).toBe(false);              // strict: rejects the rotated frame
    expect(checkRubiksSolvedRotationInvariant(cubies, 2)).toBe(true);
    expect(checkRubiksWin(cubies, 2)).toBe(true);                  // the live win accepts it
  });

  it('still rejects a genuinely scrambled 2×2', () => {
    let cubies = makeCubies(2);
    cubies = rotateSliceCubies(cubies, 2, 'row', 1, 1);
    expect(checkRubiksWin(cubies, 2)).toBe(false);
  });

  it('is unchanged from the strict check for odd cubes', () => {
    const solved = makeCubies(3);
    expect(checkRubiksWin(solved, 3)).toBe(true);

    let scrambled = makeCubies(3);
    scrambled = rotateSliceCubies(scrambled, 3, 'col', 0, 1);
    expect(checkRubiksWin(scrambled, 3)).toBe(false);
  });
});

describe('checkFaceComplete', () => {
  it('should return true when a 3x3 face shows every number 1-9 once', () => {
    const grid = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    expect(checkFaceComplete(grid, 3)).toBe(true);
  });

  it('should accept any ordering, not just sorted', () => {
    const grid = [
      [9, 4, 7],
      [2, 6, 1],
      [8, 3, 5],
    ];
    expect(checkFaceComplete(grid, 3)).toBe(true);
  });

  it('should return false when a number repeats (and one is missing)', () => {
    const grid = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 1], // 1 twice, no 9
    ];
    expect(checkFaceComplete(grid, 3)).toBe(false);
  });

  it('should return false for out-of-range values', () => {
    const grid = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10], // 10 is out of range for a 3x3 (1-9)
    ];
    expect(checkFaceComplete(grid, 3)).toBe(false);
  });

  it('should work for a 2x2 face (numbers 1-4)', () => {
    expect(checkFaceComplete([[1, 2], [3, 4]], 2)).toBe(true);
    expect(checkFaceComplete([[1, 1], [2, 2]], 2)).toBe(false);
  });
});

describe('checkWormVictory', () => {
  it('should return false for a solved cube with no flips', () => {
    const cubies = makeCubies(3);
    // Cube is solved but no stickers have been flipped
    expect(checkWormVictory(cubies, 3)).toBe(false);
  });

  it('should return false for a cube with some flips but not solved', () => {
    let cubies = makeCubies(3);
    // Scramble the cube
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    // Mark some stickers as flipped
    cubies[0][0][2].stickers.PZ.flips = 1;
    expect(checkWormVictory(cubies, 3)).toBe(false);
  });

  it('should return true for solved cube where all stickers have flips', () => {
    const cubies = makeCubies(3);
    // Mark all stickers as having been flipped
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          for (const st of Object.values(cubies[x][y][z].stickers)) {
            st.flips = 1;
          }
        }
      }
    }
    expect(checkWormVictory(cubies, 3)).toBe(true);
  });
});

describe('extractFaceGrid', () => {
  it('uses sticker identity (origDir/origPos) not current grid position', () => {
    // A freshly made cube is solved — each sticker sits on its home cell, so the
    // face shows numbers 1-9 exactly once.
    const cubies = makeCubies(3);
    const grid = extractFaceGrid(cubies, 3, 'PZ');
    expect(grid).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(checkFaceComplete(grid, 3)).toBe(true);
  });

  it('returns an incomplete face after scrambling (proves values track sticker identity)', () => {
    // If extractFaceGrid mistakenly used the current position, the face would
    // always show 1-9 regardless of cube state. After scrambling, sticker
    // identities are mixed up — the front face must drop a number.
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'row', 0, 1);
    const grid = extractFaceGrid(cubies, 3, 'PZ');
    expect(checkFaceComplete(grid, 3)).toBe(false);
  });

  it('is consistent with checkSudokubeSolved on a solved cube', () => {
    const cubies = makeCubies(3);
    for (const dir of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
      const grid = extractFaceGrid(cubies, 3, dir);
      expect(checkFaceComplete(grid, 3)).toBe(true);
    }
    expect(checkSudokubeSolved(cubies, 3)).toBe(true);
  });
});

describe('Sudokube numbering range', () => {
  // The number shown on each sticker is faceValue(origDir, origPos) — the same
  // value extractFaceGrid collects — so a solved face must show exactly 1..size²:
  // 1-4 on a 2×2, 1-9 on a 3×3, 1-16 on a 4×4.
  for (const size of [2, 3, 4]) {
    it(`numbers a solved ${size}×${size} face 1..${size * size} on every face`, () => {
      const cubies = makeCubies(size);
      const expected = Array.from({ length: size * size }, (_, i) => i + 1);
      for (const dir of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
        const numbers = extractFaceGrid(cubies, size, dir).flat().sort((a, b) => a - b);
        expect(numbers).toEqual(expected);
      }
    });
  }
});

describe('detectWinConditions', () => {
  it('should detect all conditions for fresh cube', () => {
    const cubies = makeCubies(3);
    const result = detectWinConditions(cubies, 3);

    expect(result.rubiks).toBe(true);
    expect(result.sudokube).toBe(true);
    expect(result.ultimate).toBe(true);
    expect(result.worm).toBe(false); // No flips yet
  });

  it('should return all false for scrambled cube', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'row', 1, 1);
    cubies = rotateSliceCubies(cubies, 3, 'depth', 2, -1);

    const result = detectWinConditions(cubies, 3);

    expect(result.rubiks).toBe(false);
    expect(result.sudokube).toBe(false);
    expect(result.ultimate).toBe(false);
    expect(result.worm).toBe(false);
  });
});

describe('antipodal (RP²) quotient solved detection', () => {
  it('colorClass merges each antipodal pair and separates the three axes', () => {
    expect(colorClass(1)).toBe(colorClass(4)); // Red / Orange
    expect(colorClass(2)).toBe(colorClass(5)); // Green / Blue
    expect(colorClass(3)).toBe(colorClass(6)); // White / Yellow
    expect(colorClass(1)).not.toBe(colorClass(2));
    expect(colorClass(2)).not.toBe(colorClass(3));
  });

  it('treats a solved cube with flipped tiles as solved up to antipodal identification', () => {
    const cubies = makeCubies(3);
    flipSticker(cubies, 0, 0, 2, 'PZ'); // F
    flipSticker(cubies, 2, 2, 2, 'PX'); // R
    flipSticker(cubies, 1, 2, 1, 'PY'); // U
    expect(checkRubiksSolved(cubies, 3)).toBe(false);        // strict: no
    expect(checkRubiksSolvedAntipodal(cubies, 3)).toBe(true); // quotient: yes
  });

  it('a fully solved cube is also antipodally solved', () => {
    expect(checkRubiksSolvedAntipodal(makeCubies(3), 3)).toBe(true);
  });

  it('a scrambled cube is not antipodally solved', () => {
    const cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 0, 1);
    expect(checkRubiksSolvedAntipodal(cubies, 3)).toBe(false);
  });
});

describe('the two polarities of the solved fibre', () => {
  // Flip every β-pair by recolouring both members of each antipodal position
  // pair. Equivalent to the real all-dirty board without pulling in the
  // manifold machinery.
  const invertEverySticker = (size) => {
    const cubies = makeCubies(size);
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          for (const dir of Object.keys(cubies[x][y][z].stickers)) flipSticker(cubies, x, y, z, dir);
        }
      }
    }
    return cubies;
  };

  it('accepts the home board and the fully inverted board, and nothing between', () => {
    const home = makeCubies(3);
    const inverted = invertEverySticker(3);
    const partial = makeCubies(3);
    flipSticker(partial, 0, 0, 2, 'PZ');

    expect(checkRubiksSolvedInverted(home, 3)).toBe(false);
    expect(checkRubiksSolvedInverted(inverted, 3)).toBe(true);

    expect(checkRubiksSolvedEitherPolarity(home, 3)).toBe(true);
    expect(checkRubiksSolvedEitherPolarity(inverted, 3)).toBe(true);
    expect(checkRubiksSolvedEitherPolarity(partial, 3)).toBe(false);
  });

  it('rejects a half-inverted board, which per-face uniformity would wrongly accept', () => {
    // Flip both faces of ONE antipodal face-pair (PZ and NZ). Every face still
    // shows a single colour, so the rotation-invariant check passes it — but its
    // cost is not a branch of min(n11, P − n11), so it must not be a win.
    const cubies = makeCubies(3);
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        flipSticker(cubies, x, y, 2, 'PZ');
        flipSticker(cubies, x, y, 0, 'NZ');
      }
    }
    expect(checkRubiksSolvedRotationInvariant(cubies, 3)).toBe(true); // uniform per face
    expect(checkRubiksSolvedEitherPolarity(cubies, 3)).toBe(false);   // but not a polarity
  });

  it('is not the quotient check, which is blind to flips on an unturned cube', () => {
    // Guards against "simplifying" checkRubiksSolvedEitherPolarity down to
    // checkRubiksSolvedAntipodal: flipping never leaves the colour class, so the
    // quotient check passes a flip-only board no matter how disturbed it is —
    // it would fire victory the instant a flip puzzle loaded.
    const barelyStarted = makeCubies(3);
    flipSticker(barelyStarted, 0, 0, 2, 'PZ');
    expect(checkRubiksSolvedAntipodal(barelyStarted, 3)).toBe(true);
    expect(checkRubiksSolvedEitherPolarity(barelyStarted, 3)).toBe(false);
  });
});
