import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import {
  flipResiduals,
  planStrictCompletion,
  applyStrictCompletion,
  residualWeight,
  antipodalPairFlip,
  planNativeFlipCompletion,
  applyNativeFlipCompletion,
} from '../game/antipodalSolver.js';

// Count stickers whose painted colour differs from the reference cube.
function stickerDiffCount(a, b, size) {
  let n = 0;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      for (let z = 0; z < size; z++)
        for (const dir in a[x][y][z].stickers)
          if (a[x][y][z].stickers[dir].curr !== b[x][y][z].stickers[dir].curr) n++;
  return n;
}

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

describe('antipodalSolver — native paired-flip completion (commutator)', () => {
  it('a single antipodal pair flip toggles exactly two stickers and nothing else', () => {
    const solved = makeCubies(3);
    const flipped = antipodalPairFlip(solved, 3, 2, 2, 2, 'PZ');
    // exactly two stickers differ from solved…
    expect(stickerDiffCount(flipped, solved, 3)).toBe(2);
    // …and they are an antipodal pair (both residual, opposite classes)
    const res = flipResiduals(flipped, 3);
    expect(res).toHaveLength(2);
    const origs = res.map((r) => r.orig).sort();
    expect(ANTIPODAL_COLOR[origs[0]]).toBe(origs[1]);
  });

  it('the pair flip is its own inverse', () => {
    const solved = makeCubies(3);
    let c = antipodalPairFlip(solved, 3, 0, 0, 2, 'PZ');
    c = antipodalPairFlip(c, 3, 0, 0, 2, 'PZ');
    expect(checkRubiksSolved(c, 3)).toBe(true);
  });

  it('clears β-symmetric residuals in native flips at half the op count', () => {
    const map = buildManifoldGridMap(makeCubies(3), 3);
    // Create genuine paired residuals with the real mechanic (3 pairs = 6 tiles).
    let cubies = makeCubies(3);
    cubies = flipStickerPair(cubies, 3, 2, 2, 2, 'PZ', map);
    cubies = flipStickerPair(cubies, 3, 2, 2, 2, 'PX', map);
    cubies = flipStickerPair(cubies, 3, 1, 2, 1, 'PY', map);
    expect(residualWeight(cubies, 3)).toBe(6); // 3 antipodal pairs

    const plan = planNativeFlipCompletion(cubies, 3);
    expect(plan.asymmetric).toBe(false);
    expect(plan.heals).toHaveLength(0);
    expect(plan.flips).toHaveLength(3); // one flip per pair — half of 6

    const done = applyNativeFlipCompletion(cubies, 3, plan);
    expect(checkRubiksSolved(done, 3)).toBe(true);
  });

  it('falls back to heal for an asymmetric residual (one member of a pair)', () => {
    // Simulate an external single-sticker heal breaking β-symmetry: flip one
    // tile in place (curr toggled) with no partner flip.
    const cubies = makeCubies(3);
    flip(cubies, 2, 2, 2, 'PZ'); // single-sticker toggle → asymmetric parity
    expect(residualWeight(cubies, 3)).toBe(1);

    const plan = planNativeFlipCompletion(cubies, 3);
    expect(plan.asymmetric).toBe(true);
    expect(plan.flips).toHaveLength(0);
    expect(plan.heals).toHaveLength(1);

    const done = applyNativeFlipCompletion(cubies, 3, plan);
    expect(checkRubiksSolved(done, 3)).toBe(true);
  });
});
