import { describe, expect, it } from 'vitest';
import { FLIP_PUZZLES } from '../levels/packs/flip-puzzles.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { applyTileMove, inverseTileMove } from '../game/tileOrientation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkFlipPuzzleSolved } from '../game/winDetection.js';
import { makeCubies } from '../game/cubeState.js';
import { computeStars } from '../levels/scoring.js';
import { searchFlipTarget } from '../levels/flipTarget.js';
import { newFlipRun, advanceFlipRun, scarredPairs, canRelapse, flipCheckpoint, LESSON_MS, ROLL_MS } from '../game/flipRelapse.js';
import { FLIP_CAP } from '../utils/constants.js';

const prep = level => ({ size: 3, currentLevelData: level, cubies: buildLevelStartState(level, 3),
  flipRun: newFlipRun(level.id), hasShuffled: true });
const flip = (board, loc) => flipStickerPair(board, 3, loc.x, loc.y, loc.z, loc.dirKey, buildManifoldGridMap(board, 3));
const edge = 'M1-002', corner = 'M1-003', centre = 'M3-005', sideEdge = 'M1-006', topCorner = 'M3-001';
const witnesses = [
  [[], [edge]], [[], [centre]], [[], [corner, edge]], [['col'], []], [[], [corner, sideEdge]],
  [['row'], [corner, topCorner]], [[], [edge, centre, corner]], [['depth', 'col'], [corner]],
  [[], [corner, centre, sideEdge]], [['depth'], [corner]],
];

describe('Flip Cube levels', () => {
  it.each(FLIP_PUZZLES)('$name opens unsolved, has a replayable target and no cheaper four-turn solution', level => {
    const start = prep(level);
    if (level.relapseLesson) Object.assign(start, advanceFlipRun(start, LESSON_MS, FLIP_CAP));
    let board = start.cubies;
    expect(checkFlipPuzzleSolved(board, 3)).toBe(false);
    const cheaper = searchFlipTarget(board, 3);
    expect(cheaper ?? Infinity).toBeGreaterThanOrEqual(level.flipPar);
    for (const move of [...level.scrambleSequence].reverse()) board = applyTileMove(board, 3, inverseTileMove(move)).cubies;
    const [axes, repairs] = witnesses[level.id - 601];
    for (const axis of axes) board = applyTileMove(board, 3, { axis, sliceIndex: 1, dir: 1, numTurns: 2 }).cubies;
    for (const id of repairs) board = flip(board, buildManifoldGridMap(board, 3).get(id));
    expect(repairs).toHaveLength(level.flipPar);
    expect(checkFlipPuzzleSolved(board, 3)).toBe(true);
    expect(computeStars(level, { flips: repairs.length })).toBe(3);
    expect(level.requirements.previousLevel).toBe(level.id === 601 ? null : level.id - 1);
  });
  it('accepts rotated and flipped layouts and rejects duplicate face colours', () => {
    let board = makeCubies(3);
    for (const sliceIndex of [0, 1, 2]) board = applyTileMove(board, 3, { axis: 'row', dir: 1, sliceIndex }).cubies;
    expect(checkFlipPuzzleSolved(board, 3)).toBe(true);
    expect(searchFlipTarget(board, 3, 0)).toBe(0);
    for (const row of board) for (const line of row) for (const piece of line) {
      for (const sticker of Object.values(piece.stickers)) sticker.curr = 1;
    }
    expect(checkFlipPuzzleSolved(board, 3)).toBe(false);
  });
  it('restores the same paired roll from a checkpoint and protects capped tiles', () => {
    const state = prep(FLIP_PUZZLES[4]);
    expect(scarredPairs(state.cubies, 3, 6)).toHaveLength(1);
    const saved = flipCheckpoint(state).beforeFlipInput;
    const after = advanceFlipRun(state, LESSON_MS, 6);
    expect(after.flipRun.count).toBe(1);
    expect(after.flipRun.flips).toBe(0);
    expect(advanceFlipRun({ ...state, ...saved }, LESSON_MS, 6)).toEqual(after);
    expect(advanceFlipRun({ ...state, currentLevelData: FLIP_PUZZLES[0] }, ROLL_MS, 6).cubies).toBeUndefined();
    expect(canRelapse({ flips: 2, curr: 1, orig: 1 }, 3)).toBe(false);
    expect(canRelapse({ flips: 6, curr: 1, orig: 1 }, 6)).toBe(false);
  });
});
