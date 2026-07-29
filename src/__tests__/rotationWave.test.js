// The wave model's whole safety argument is that parallel same-axis planes are
// disjoint and therefore commute. These tests hold that argument to account:
// validation refuses anything that would break disjointness, and the atomic
// commit is proved equal to every sequential order of the same single-plane
// turns.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeWave,
  singlePlaneWave,
  invertWave,
  waveToMoves,
  waveTurnCount,
  isSinglePlane,
  waveToLastRotation,
  applyWaveToCubies,
  resetWaveIds,
  MAX_WAVE_PLANES,
} from '../game/rotationWave.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { MEGA_SIZE } from '../game/sliceIndex.js';

const SIZE = 5;

beforeEach(() => resetWaveIds());

// Strip object identity so two cubes can be compared on content alone.
const plain = (cubies) => JSON.stringify(cubies);

// Every ordering of [0,1,2].
const PERMUTATIONS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

describe('normalizeWave — validation', () => {
  it('accepts up to three parallel planes', () => {
    const { wave, error } = normalizeWave('row', [
      { sliceIndex: 0, dir: 1 }, { sliceIndex: 2, dir: -1 }, { sliceIndex: 4, dir: 1 },
    ], SIZE);
    expect(error).toBeUndefined();
    expect(wave.axis).toBe('row');
    expect(wave.rotations).toHaveLength(3);
  });

  it('rejects a fourth plane', () => {
    const { error } = normalizeWave('row', [
      { sliceIndex: 0, dir: 1 }, { sliceIndex: 1, dir: 1 },
      { sliceIndex: 2, dir: 1 }, { sliceIndex: 3, dir: 1 },
    ], SIZE);
    expect(error).toMatch(/max 3/);
    expect(MAX_WAVE_PLANES).toBe(3);
  });

  it('rejects an out-of-range slice', () => {
    expect(normalizeWave('col', [{ sliceIndex: SIZE, dir: 1 }], SIZE).error).toMatch(/out of range/);
    expect(normalizeWave('col', [{ sliceIndex: -1, dir: 1 }], SIZE).error).toMatch(/out of range/);
  });

  it('rejects an unknown axis, an empty wave and a bad direction', () => {
    expect(normalizeWave('diagonal', [{ sliceIndex: 0, dir: 1 }], SIZE).error).toMatch(/unknown axis/);
    expect(normalizeWave('col', [], SIZE).error).toMatch(/no rotations/);
    expect(normalizeWave('col', [{ sliceIndex: 0, dir: 2 }], SIZE).error).toMatch(/±1/);
  });
});

describe('normalizeWave — same-plane merging', () => {
  it('merges two turns of the same plane into a double turn', () => {
    const { wave } = normalizeWave('col', [
      { sliceIndex: 1, dir: 1 }, { sliceIndex: 1, dir: 1 },
    ], SIZE);
    expect(wave.rotations).toEqual([{ sliceIndex: 1, dir: 1, numTurns: 2 }]);
  });

  it('cancels opposing turns of the same plane', () => {
    const { error } = normalizeWave('col', [
      { sliceIndex: 1, dir: 1 }, { sliceIndex: 1, dir: -1 },
    ], SIZE);
    expect(error).toMatch(/cancels/);
  });

  it('drops a cancelled plane but keeps the rest of the wave', () => {
    const { wave } = normalizeWave('row', [
      { sliceIndex: 1, dir: 1 }, { sliceIndex: 1, dir: -1 }, { sliceIndex: 3, dir: 1 },
    ], SIZE);
    expect(wave.rotations).toEqual([{ sliceIndex: 3, dir: 1, numTurns: 1 }]);
  });

  it('takes the short route rather than sweeping 270°', () => {
    const { wave } = normalizeWave('col', [{ sliceIndex: 0, dir: 1, numTurns: 3 }], SIZE);
    expect(wave.rotations).toEqual([{ sliceIndex: 0, dir: -1, numTurns: 1 }]);
  });

  it('reduces four quarter turns to nothing', () => {
    expect(normalizeWave('col', [{ sliceIndex: 0, dir: 1, numTurns: 4 }], SIZE).error).toMatch(/cancels/);
  });

  it('keeps the caller-requested sweep direction on a half turn', () => {
    const cw = normalizeWave('col', [{ sliceIndex: 0, dir: 1, numTurns: 2 }], SIZE).wave;
    const ccw = normalizeWave('col', [{ sliceIndex: 0, dir: -1, numTurns: 2 }], SIZE).wave;
    expect(cw.rotations[0]).toEqual({ sliceIndex: 0, dir: 1, numTurns: 2 });
    expect(ccw.rotations[0]).toEqual({ sliceIndex: 0, dir: -1, numTurns: 2 });
  });

  it('normalises a negative multi-turn to the right net rotation', () => {
    // -3 quarter turns ≡ +1. Getting the sign wrong here would rotate the layer
    // the wrong way and silently corrupt the cube.
    const { wave } = normalizeWave('col', [{ sliceIndex: 0, dir: -1, numTurns: 3 }], SIZE);
    expect(wave.rotations).toEqual([{ sliceIndex: 0, dir: 1, numTurns: 1 }]);

    const cubies = makeCubies(SIZE);
    expect(plain(applyWaveToCubies(cubies, SIZE, wave)))
      .toBe(plain(rotateSliceCubies(cubies, SIZE, 'col', 0, 1)));
  });
});

describe('invertWave', () => {
  it('flips every direction and keeps the planes', () => {
    const wave = normalizeWave('depth', [
      { sliceIndex: 0, dir: 1 }, { sliceIndex: 4, dir: -1 },
    ], SIZE).wave;
    const inv = invertWave(wave);
    expect(inv.axis).toBe('depth');
    expect(inv.rotations.map(r => r.sliceIndex)).toEqual([0, 4]);
    expect(inv.rotations.map(r => r.dir)).toEqual([-1, 1]);
  });

  it('restores the cube exactly — cubies, sticker directions and origins', () => {
    const cubies = makeCubies(SIZE);
    const wave = normalizeWave('row', [
      { sliceIndex: 0, dir: 1 }, { sliceIndex: 2, dir: -1 }, { sliceIndex: 4, dir: 1, numTurns: 2 },
    ], SIZE).wave;
    const after = applyWaveToCubies(cubies, SIZE, wave);
    expect(plain(after)).not.toBe(plain(cubies));
    expect(plain(applyWaveToCubies(after, SIZE, invertWave(wave)))).toBe(plain(cubies));
  });
});

describe('applyWaveToCubies', () => {
  it('equals the same single-plane turns in every sequential order', () => {
    const cubies = makeCubies(SIZE);
    const planes = [
      { sliceIndex: 0, dir: 1, numTurns: 1 },
      { sliceIndex: 2, dir: -1, numTurns: 1 },
      { sliceIndex: 4, dir: 1, numTurns: 2 },
    ];
    const wave = normalizeWave('row', planes, SIZE).wave;
    const atomic = plain(applyWaveToCubies(cubies, SIZE, wave));

    for (const order of PERMUTATIONS) {
      let c = cubies;
      for (const i of order) {
        const p = planes[i];
        for (let t = 0; t < p.numTurns; t++) c = rotateSliceCubies(c, SIZE, 'row', p.sliceIndex, p.dir);
      }
      expect(plain(c), `order ${order.join('')}`).toBe(atomic);
    }
  });

  it('matches rotateSliceCubies exactly for a single plane, on every axis and slice', () => {
    const cubies = makeCubies(SIZE);
    for (const axis of ['col', 'row', 'depth']) {
      for (let s = 0; s < SIZE; s++) {
        for (const dir of [1, -1]) {
          expect(
            plain(applyWaveToCubies(cubies, SIZE, singlePlaneWave(axis, s, dir))),
            `${axis} ${s} ${dir}`
          ).toBe(plain(rotateSliceCubies(cubies, SIZE, axis, s, dir)));
        }
      }
    }
  });

  it('returns to the start after four quarter turns of a three-plane wave', () => {
    const cubies = makeCubies(SIZE);
    const wave = normalizeWave('depth', [
      { sliceIndex: 0, dir: 1 }, { sliceIndex: 1, dir: -1 }, { sliceIndex: 3, dir: 1 },
    ], SIZE).wave;
    let c = cubies;
    for (let i = 0; i < 4; i++) c = applyWaveToCubies(c, SIZE, wave);
    expect(plain(c)).toBe(plain(cubies));
  });

  it('leaves cubies outside every plane reference-identical', () => {
    // The renderer's memo comparator bails out on reference equality, so a wave
    // that replaced untouched cubies would trigger a whole-cube re-render.
    const cubies = makeCubies(SIZE);
    const wave = normalizeWave('col', [{ sliceIndex: 0, dir: 1 }, { sliceIndex: 4, dir: 1 }], SIZE).wave;
    const after = applyWaveToCubies(cubies, SIZE, wave);
    for (let y = 0; y < SIZE; y++) {
      for (let z = 0; z < SIZE; z++) {
        expect(after[2][y][z]).toBe(cubies[2][y][z]);
        expect(after[0][y][z]).not.toBe(cubies[0][y][z]);
      }
    }
  });

  it('works on a Mega-sized cube', () => {
    const cubies = makeCubies(MEGA_SIZE, { allowMega: true });
    const wave = normalizeWave('row', [
      { sliceIndex: 2, dir: 1 }, { sliceIndex: 7, dir: -1 }, { sliceIndex: 12, dir: 1 },
    ], MEGA_SIZE).wave;
    const after = applyWaveToCubies(cubies, MEGA_SIZE, wave);
    expect(after).toHaveLength(MEGA_SIZE);
    expect(plain(applyWaveToCubies(after, MEGA_SIZE, invertWave(wave)))).toBe(plain(cubies));
  });
});

describe('wave helpers', () => {
  it('reports single-plane status and the legacy rotation payload', () => {
    const one = singlePlaneWave('col', 1, -1);
    expect(isSinglePlane(one)).toBe(true);
    expect(waveToLastRotation(one)).toEqual({ axis: 'col', sliceIndex: 1, dir: -1, numTurns: 1 });

    const many = normalizeWave('col', [{ sliceIndex: 0, dir: 1 }, { sliceIndex: 2, dir: 1 }], SIZE).wave;
    expect(isSinglePlane(many)).toBe(false);
    // Null is the established "cubies changed wholesale, resync" signal, which is
    // exactly the right thing to tell a consumer that can't represent a wave.
    expect(waveToLastRotation(many)).toBeNull();
  });

  it('flattens to moves and counts total quarter turns', () => {
    const wave = normalizeWave('depth', [
      { sliceIndex: 0, dir: 1 }, { sliceIndex: 2, dir: -1, numTurns: 2 },
    ], SIZE).wave;
    expect(waveToMoves(wave)).toEqual([
      { axis: 'depth', sliceIndex: 0, dir: 1, numTurns: 1 },
      { axis: 'depth', sliceIndex: 2, dir: -1, numTurns: 2 },
    ]);
    expect(waveTurnCount(wave)).toBe(3);
  });

  it('gives every wave a distinct id', () => {
    const a = singlePlaneWave('col', 0, 1);
    const b = singlePlaneWave('col', 0, 1);
    expect(a.id).not.toBe(b.id);
  });
});
