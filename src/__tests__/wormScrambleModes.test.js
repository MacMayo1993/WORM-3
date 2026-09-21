import { describe, expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import {
  buildWormScramble,
  invertWormScramble,
} from '../worm/healerWorm/scramble.js';

function seededRandom() {
  let seed = 17;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('worm scramble plane counts', () => {
  for (let size = 2; size <= 10; size++) {
    it(`${size}x${size} uses one plane per rotation`, () => {
      const moves = buildWormScramble(size, 20, seededRandom());
      expect(moves).toHaveLength(20);
      for (const move of moves) {
        expect(move.sliceIndices).toBeUndefined();
        expect(move.sliceDirs).toBeUndefined();
        expect(move.sliceIndex).toBeGreaterThanOrEqual(0);
        expect(move.sliceIndex).toBeLessThan(size);
      }

      const inverse = invertWormScramble(moves);
      expect(inverse.map(move => move.dir)).toEqual(
        [...moves].reverse().map(move => -move.dir),
      );
    });
  }

  it.each([8, 9, 10])('restores every cubie and sticker after a size-%i scramble and inverse', size => {
    const initial = makeCubies(size);
    expect(initial.flat(2).reduce((n, cubie) => n + Object.keys(cubie.stickers).length, 0)).toBe(6 * size * size);
    const moves = buildWormScramble(size, 20, seededRandom());
    const result = [...moves, ...invertWormScramble(moves)].reduce((cubies, move) =>
      rotateSliceCubies(cubies, size, move.axis, move.sliceIndex, move.dir), initial);
    expect(result).toEqual(initial);
  });

  it('reserves two non-adjacent, opposite-turning planes for Mega Mode', () => {
    const moves = buildWormScramble(15, 20, seededRandom());
    for (const move of moves) {
      expect(move.sliceIndices).toHaveLength(2);
      expect(Math.abs(move.sliceIndices[0] - move.sliceIndices[1])).toBeGreaterThanOrEqual(2);
      expect(move.sliceDirs).toEqual([move.dir, -move.dir]);
    }

    const inverse = invertWormScramble(moves);
    expect(inverse.map(move => move.sliceDirs)).toEqual(
      [...moves].reverse().map(move => move.sliceDirs.map(dir => -dir)),
    );
  });
});
