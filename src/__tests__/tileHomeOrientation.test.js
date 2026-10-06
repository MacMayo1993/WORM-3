import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { applyTileMove, inverseTileMove, isOnHomeManifold } from '../game/tileOrientation.js';
import { recordHomeAlignments, tileDisplayAngle, clearHomeAlignments, HOME_ALIGNMENT_MS } from '../3d/tileHomeAlignment.js';
import { createChaosSim } from '../game/chaosSim.js';
import { checkRubiksSolved } from '../game/winDetection.js';

const move = { axis: 'row', sliceIndex: 2, dir: 1 };
const eachSticker = (cube, fn) => cube.flat(2).forEach(c => Object.entries(c.stickers).forEach(([face, s]) => fn(s, face, c)));

describe('home manifold orientation', () => {
  it.each([2, 3, 4, 7, 15])('aligns anywhere on the original face on a %i cube and preserves away orientations', size => {
    const home = makeCubies(size);
    const turn = { ...move, sliceIndex: size - 1 };
    const raw = rotateSliceCubies(home, size, turn.axis, turn.sliceIndex, turn.dir);
    const { cubies, orientationResets } = applyTileMove(home, size, turn);
    expect(orientationResets).toHaveLength(size ** 2);
    let movedHomeTile = false;
    eachSticker(cubies, (s, face, c) => {
      const source = raw[c.x][c.y][c.z].stickers[face];
      expect(s.uvTurns ?? 0).toBe(isOnHomeManifold(s, face) ? 0 : source.uvTurns ?? 0);
      const { uvTurns: _ignored, ...rest } = s;
      const { uvTurns: _rawIgnored, ...expected } = source;
      expect(rest).toEqual(expected);
      if (face === 'PY' && (s.origPos.x !== c.x || s.origPos.z !== c.z)) movedHomeTile = true;
    });
    expect(movedHomeTile).toBe(true);
    expect(home).toEqual(makeCubies(size));
  });

  it('leaves the center upright after a color-solved loop', () => {
    let c = makeCubies(3);
    for (let n = 0; n < 5; n++) for (const [axis, dir] of [['col', -1], ['row', -1], ['col', 1], ['row', -1]]) {
      c = applyTileMove(c, 3, { axis, dir, sliceIndex: 2 }).cubies;
    }
    expect(checkRubiksSolved(c, 3)).toBe(true);
    eachSticker(c, s => expect(s.uvTurns ?? 0).toBe(0));
  });

  it('does not align a tile which only passes its home face mid-half-turn', () => {
    const before = rotateSliceCubies(makeCubies(3), 3, 'col', 2, -1);
    const turn = { axis: 'col', sliceIndex: 2, dir: 1, numTurns: 2 };
    const raw = rotateSliceCubies(rotateSliceCubies(before, 3, 'col', 2, 1), 3, 'col', 2, 1);
    const after = applyTileMove(before, 3, turn).cubies;
    let away = 0;
    eachSticker(after, (s, face, c) => {
      if (isOnHomeManifold(s, face)) return;
      away++;
      expect(s.uvTurns ?? 0).toBe(raw[c.x][c.y][c.z].stickers[face].uvTurns ?? 0);
    });
    expect(away).toBeGreaterThan(0);
  });

  it.each([1, 2, 3])('restores exact prior orientation when undoing %i quarter turns on multiple layers', numTurns => {
    const before = rotateSliceCubies(makeCubies(3), 3, 'row', 2, 1);
    before[0][2][0].stickers.PY.flips = 3;
    const turn = { ...move, sliceIndices: [0, 2], sliceDirs: [1, -1], numTurns };
    const result = applyTileMove(before, 3, turn);
    expect(applyTileMove(result.cubies, 3, inverseTileMove({ ...turn, orientationResets: result.orientationResets })).cubies).toEqual(before);
  });

  it('does not treat antipodal color changes as a change of home manifold', () => {
    const c = makeCubies(3);
    c[1][2][1].stickers.PY.curr = 6;
    c[1][2][1].stickers.PY.flips = 1;
    const result = applyTileMove(c, 3, move).cubies[1][2][1].stickers.PY;
    expect(result).toMatchObject({ curr: 6, flips: 1, orig: 3, origDir: 'PY' });
    expect(result.uvTurns ?? 0).toBe(0);
    expect(isOnHomeManifold(result, 'NY')).toBe(false);
  });
});

it('settles along the shortest arc, finishes on interruption, and never replays after serialization', () => {
  const result = applyTileMove(makeCubies(3), 3, { ...move, dir: -1 });
  const reset = result.orientationResets[0];
  const meta = result.cubies[reset.x][reset.y][reset.z].stickers[reset.face];
  recordHomeAlignments(result, 100);
  const angle = tileDisplayAngle(meta, 100);
  expect(Math.abs(angle)).toBe(Math.PI / 2);
  expect(tileDisplayAngle(meta, 100 + HOME_ALIGNMENT_MS / 2)).toBeCloseTo(angle / 8);
  expect(tileDisplayAngle(JSON.parse(JSON.stringify(meta)), 100)).toBe(0);
  expect(tileDisplayAngle(meta, 110, true)).toBe(0);
  expect(tileDisplayAngle(meta, 120)).toBe(0);
  recordHomeAlignments(result, 200);
  clearHomeAlignments();
  expect(tileDisplayAngle(meta, 200)).toBe(0);
});

it('keeps the worker simulation equal to the main state for half-turns, opposing layers, and undo', () => {
  const before = rotateSliceCubies(makeCubies(3), 3, 'row', 2, 1);
  const sim = createChaosSim({ cubies: before, size: 3, chaosLevel: 1, flipCap: 3 });
  const move = { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1], numTurns: 2 };
  const result = applyTileMove(before, 3, move);
  sim.rotateSlice(move);
  expect(sim.getState()).toEqual(result.cubies);
  sim.rotateSlice(inverseTileMove({ ...move, orientationResets: result.orientationResets }));
  expect(sim.getState()).toEqual(before);
});
