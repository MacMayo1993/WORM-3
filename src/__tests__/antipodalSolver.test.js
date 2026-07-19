import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import {
  flipResiduals,
  planStrictCompletion,
  applyStrictCompletion,
  residualWeight,
} from '../game/antipodalSolver.js';

// Simulate a wormhole flip: recolour a sticker to its antipode, mark flipped.
function flip(cubies, x, y, z, dir) {
  const st = cubies[x][y][z].stickers[dir];
  st.curr = ANTIPODAL_COLOR[st.curr]; // toggle, matching the real wormhole flip
  st.flips = (st.flips ?? 0) + 1;
}

describe('antipodalSolver — Phase 2 flip-parity clearing', () => {
  it('a solved cube has no residuals', () => {
    const cubies = makeCubies(3);
    expect(flipResiduals(cubies, 3)).toEqual([]);
    expect(residualWeight(cubies, 3)).toBe(0);
    expect(planStrictCompletion(cubies, 3)).toEqual([]);
  });

  it('detects exactly the flipped tiles as residuals', () => {
    const cubies = makeCubies(3);
    flip(cubies, 0, 0, 2, 'PZ');
    flip(cubies, 2, 2, 2, 'PX');
    expect(residualWeight(cubies, 3)).toBe(2);
    const dirs = flipResiduals(cubies, 3).map((r) => r.dir).sort();
    expect(dirs).toEqual(['PX', 'PZ']);
  });

  it('an even number of flips on one sticker leaves no residual', () => {
    const cubies = makeCubies(3);
    flip(cubies, 0, 0, 2, 'PZ');
    flip(cubies, 0, 0, 2, 'PZ'); // back to home colour
    expect(residualWeight(cubies, 3)).toBe(0);
  });

  it('clears a flipped-but-solved cube to the strict solved state', () => {
    let cubies = makeCubies(3);
    flip(cubies, 0, 0, 2, 'PZ');
    flip(cubies, 2, 2, 2, 'PX');
    flip(cubies, 1, 2, 1, 'PY');
    expect(checkRubiksSolved(cubies, 3)).toBe(false); // strict: flipped tiles show antipode
    cubies = applyStrictCompletion(cubies, 3);
    expect(checkRubiksSolved(cubies, 3)).toBe(true); // strict solved after Phase 2
    expect(residualWeight(cubies, 3)).toBe(0);
  });

  it('clears residuals on a position-solved cube regardless of flip pattern', () => {
    // Position-solved means every piece home; flip an arbitrary subset of tiles.
    let cubies = makeCubies(3);
    const targets = [
      [0, 0, 0, 'NZ'], [0, 0, 0, 'NX'], [0, 0, 0, 'NY'],
      [2, 2, 2, 'PX'], [2, 2, 2, 'PY'], [2, 2, 2, 'PZ'],
      [1, 0, 2, 'NY'], [0, 1, 0, 'NX'],
    ];
    targets.forEach(([x, y, z, d]) => flip(cubies, x, y, z, d));
    expect(residualWeight(cubies, 3)).toBe(targets.length);
    cubies = applyStrictCompletion(cubies, 3);
    expect(checkRubiksSolved(cubies, 3)).toBe(true);
  });

  it('is idempotent on an already strict-solved cube', () => {
    const cubies = makeCubies(3);
    const out = applyStrictCompletion(cubies, 3);
    expect(checkRubiksSolved(out, 3)).toBe(true);
  });

  it('only reports exterior stickers (never interior)', () => {
    const cubies = makeCubies(3);
    // The centre cubie (1,1,1) has no stickers; nothing to flip there.
    flip(cubies, 1, 1, 2, 'PZ'); // a face-centre sticker, still exterior
    expect(residualWeight(cubies, 3)).toBe(1);
  });

  it('does not touch piece positions — a scramble stays scrambled after clearing', () => {
    // Phase 2 only heals colour; it must not solve position on its own.
    let cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 0, 1); // scramble
    flip(cubies, 2, 2, 2, 'PX');
    cubies = applyStrictCompletion(cubies, 3);
    // Colours healed, but the cube is still positionally scrambled → not solved.
    expect(checkRubiksSolved(cubies, 3)).toBe(false);
    expect(residualWeight(cubies, 3)).toBe(0);
  });
});
