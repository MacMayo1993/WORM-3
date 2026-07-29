import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

// Mirrors useAnimation.applyMove: a move turns one or more parallel layers, each by
// its own direction (worm hazard turns two non-adjacent planes opposite ways).
function applyMove(cubies, size, move) {
  let c = cubies;
  const layers = move.sliceIndices?.length ? move.sliceIndices : [move.sliceIndex];
  const dirs = move.sliceDirs?.length ? move.sliceDirs : layers.map(() => move.dir);
  for (let li = 0; li < layers.length; li++) {
    c = rotateSliceCubies(c, size, move.axis, layers[li], dirs[li]);
  }
  return c;
}

// Inverse of a pair-move sequence: reverse order, flip every layer's direction —
// the exact transform HealerWormMode's inverseQueue builds to "solve" the board.
function invertSeq(seq) {
  return [...seq].reverse().map((m) => ({ ...m, sliceDirs: m.sliceDirs.map((d) => -d) }));
}

function currGrid(cubies, size) {
  const out = [];
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      for (let z = 0; z < size; z++)
        for (const dir of Object.keys(cubies[x][y][z].stickers).sort())
          out.push(cubies[x][y][z].stickers[dir].curr);
  return out;
}

describe('worm parallel-pair scramble is solved by its reversed, flipped inverse', () => {
  const makePairSeq = (size, steps) => {
    const axes = ['col', 'row', 'depth'];
    const seq = [];
    for (let i = 0; i < steps; i++) {
      const axis = axes[i % 3];
      const a = i % size;
      let b = (i * 7 + 3) % size;
      while (Math.abs(a - b) < 2) b = (b + 1) % size;
      const d = i % 2 === 0 ? 1 : -1;
      seq.push({ axis, sliceIndices: [a, b], sliceDirs: [d, -d] });
    }
    return seq;
  };

  for (const size of [5, 15]) {
    it(`returns a ${size}x${size} cube to solved after 20 pair-moves + inverse`, () => {
      const solved = currGrid(makeCubies(size), size);
      const seq = makePairSeq(size, 20);

      let c = makeCubies(size);
      for (const m of seq) c = applyMove(c, size, m);
      // Scramble must actually change something.
      expect(currGrid(c, size)).not.toEqual(solved);

      for (const m of invertSeq(seq)) c = applyMove(c, size, m);
      expect(currGrid(c, size)).toEqual(solved);
    });
  }

  it('each pair-move is undone by flipping both plane directions', () => {
    const size = 15;
    const solved = currGrid(makeCubies(size), size);
    const move = { axis: 'row', sliceIndices: [2, 11], sliceDirs: [1, -1] };
    let c = applyMove(makeCubies(size), size, move);
    expect(currGrid(c, size)).not.toEqual(solved);
    c = applyMove(c, size, { ...move, sliceDirs: [-1, 1] });
    expect(currGrid(c, size)).toEqual(solved);
  });
});
