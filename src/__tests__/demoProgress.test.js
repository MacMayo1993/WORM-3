import { describe, it, expect } from 'vitest';
import { displacedPairCount, totalFlippedCount } from '../game/demoProgress.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

const flipFrontFace = (state, size) => {
  const map = buildManifoldGridMap(state, size);
  let next = state;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      next = flipStickerPair(next, size, x, y, size - 1, 'PZ', map);
    }
  return next;
};

describe('demo step completion checks', () => {
  const size = 3;

  it('counts nothing on a fresh cube', () => {
    const state = makeCubies(size);
    expect(displacedPairCount(state)).toBe(0);
    expect(totalFlippedCount(state)).toBe(0);
  });

  it('counts one pair per tap — both ends of the pair move together', () => {
    const state = makeCubies(size);
    const map = buildManifoldGridMap(state, size);
    const flipped = flipStickerPair(state, size, 0, 0, size - 1, 'PZ', map);
    expect(totalFlippedCount(flipped)).toBe(2);
    expect(displacedPairCount(flipped)).toBe(1);
  });

  it('fills to the step target as a face is sent across, and empties on the way back', () => {
    let state = flipFrontFace(makeCubies(size), size);
    expect(displacedPairCount(state)).toBe(size * size);

    state = flipFrontFace(state, size);
    expect(displacedPairCount(state)).toBe(0);
  });

  // Regression for a step that could not be finished: the flip step used to
  // count front-face tiles and close on "cube solved", so a player who twisted a
  // row mid-step had the target moved under them and could never finish by
  // flipping alone. The pair count is position-independent, so a twist changes
  // where the work is, never how much is left.
  it('is unmoved by twists — a rotation relocates displaced pairs without changing the count', () => {
    let state = flipFrontFace(makeCubies(size), size);
    const before = displacedPairCount(state);

    state = rotateSliceCubies(state, size, 'row', 0, 1);
    expect(displacedPairCount(state)).toBe(before);

    state = rotateSliceCubies(state, size, 'row', 0, -1);
    state = flipFrontFace(state, size);
    expect(displacedPairCount(state)).toBe(0);
  });

  it('handles a 2×2 twisted cube without reading past the grid', () => {
    let state = makeCubies(2);
    state = rotateSliceCubies(state, 2, 'col', 1, -1);
    expect(() => displacedPairCount(state)).not.toThrow();
    expect(displacedPairCount(state)).toBe(0);
  });
});
