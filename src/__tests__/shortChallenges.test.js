import { describe, expect, it } from 'vitest';
import { SHORT_CHALLENGE_LEVELS } from '../levels/packs/short-challenges.js';
import { levelsManager, getPack } from '../levels/index.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { solveLine } from '../levels/parSolver.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksWin } from '../game/winDetection.js';
import { actionPair, cursorTile } from '../game/actionPair.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { makeCubies } from '../game/cubeState.js';
import { puzzleMode } from '../progression/model.js';

describe('short geometry challenges', () => {
  it.each(SHORT_CHALLENGE_LEVELS)('$name has an exact, playable short solution using its enabled actions', level => {
    const size = level.cubeSize;
    let board = buildLevelStartState(level, size, { random: () => { throw Error('No random staging'); } });
    expect(checkRubiksWin(board, size)).toBe(false);
    const line = solveLine(board, size, { maxMoves: level.par });
    expect(line?.cost).toBe(level.par);
    expect(line.cost).toBeLessThanOrEqual(3);
    if (!level.features.rotations) expect(line.turns).toHaveLength(0);
    if (!level.features.flips) expect(line.flips).toHaveLength(0);
    for (const move of line.turns) board = rotateSliceCubies(board, size, move.axis, move.sliceIndex, move.dir);
    for (const tile of line.flips) board = flipStickerPair(board, size, tile.x, tile.y, tile.z, tile.dirKey, buildManifoldGridMap(board, size));
    expect(checkRubiksWin(board, size)).toBe(true);
  });

  it('registers independent selectable challenges without colliding with campaign saves', () => {
    expect(getPack('short-challenges').levels).toBe(SHORT_CHALLENGE_LEVELS);
    for (const level of SHORT_CHALLENGE_LEVELS) {
      expect(level.requirements.previousLevel).toBeNull();
      expect(levelsManager.getPackForLevel(level.id).id).toBe('short-challenges');
    }
    expect(puzzleMode({ currentLevel: 501, activePackId: 'short-challenges' })).toBe('cube');
  });

  it('focuses an actually flipped pair in the authored puzzles', () => {
    for (const level of SHORT_CHALLENGE_LEVELS.filter(l => l.actionFocus)) {
      const board = buildLevelStartState(level, 3), map = buildManifoldGridMap(board, 3);
      expect(map.get(level.actionFocus)?.sticker.flips, level.name).toBe(1);
      expect(actionPair(board, 3, map, level.actionFocus, 8)?.ids).toHaveLength(2);
    }
  });
});

it('preview follows identity through turns and uses both endpoints’ live flip limits', () => {
  let board = makeCubies(3);
  const start = { x: 2, y: 1, z: 2, dirKey: 'PZ' };
  const id = getManifoldGridId(board[2][1][2].stickers.PZ, 3);
  const original = actionPair(board, 3, buildManifoldGridMap(board, 3), start, 3);
  board = rotateSliceCubies(board, 3, 'col', 2, 1);
  const map = buildManifoldGridMap(board, 3);
  const after = actionPair(board, 3, map, id, 3);
  expect(after.ids).toEqual(original.ids);
  const twin = map.get(after.ids[1]);
  board[twin.x][twin.y][twin.z].stickers[twin.dirKey].flips = 3;
  expect(actionPair(board, 3, map, id, 3).available).toBe(false);
  expect(actionPair(board, 3, map, id, 8).available).toBe(true);
  expect(actionPair(board, 3, map, 'missing', 8)).toBeNull();
  expect(cursorTile({ face: 'NZ', row: 1, col: 2 }, 3)).toEqual({ x: 0, y: 1, z: 0, dirKey: 'NZ' });
});
