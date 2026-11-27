import { describe, expect, it } from 'vitest';
import { FLIP_PUZZLES } from '../levels/packs/flip-puzzles.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { flipHint, hintLine } from '../levels/flipHint.js';
import { flipCheckTiles } from '../game/flipCheck.js';
import { applyTileMove } from '../game/tileOrientation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkFlipPuzzleSolved } from '../game/winDetection.js';
import { makeCubies } from '../game/cubeState.js';
import { effectiveFlipPads } from '../game/raisedCubie.js';

const play = (board, step) => step.kind === 'turn'
  ? applyTileMove(board, 3, step).cubies
  : flipStickerPair(board, 3, step.a.x, step.a.y, step.a.z, step.a.dirKey, buildManifoldGridMap(board, 3));

function followHints(level, board) {
  let flips = 0;
  for (let steps = 0; steps < 40; steps++) {
    const step = flipHint(level, board, 3);
    if (!step) return { board, flips };
    expect(step.kind, level.name).not.toBe('lost');
    if (step.kind === 'pair') flips++;
    board = play(board, step);
  }
  throw new Error(`${level.name}: the hint never finished`);
}

describe('Show-me hint', () => {
  it.each(FLIP_PUZZLES)('$name: following the hint solves it at par', level => {
    // Scar Tissue's lesson relapses its scarred pair before play, which is the
    // second of its two flips; without the lesson the hint needs one fewer.
    const { board, flips } = followHints(level, buildLevelStartState(level, 3));
    expect(checkFlipPuzzleSolved(board, 3)).toBe(true);
    expect(flips).toBe(level.relapseLesson ? level.flipPar - 1 : level.flipPar);
  });

  it('leads a stray turn back onto the plan, and says so', () => {
    const level = FLIP_PUZZLES[5];
    const stray = applyTileMove(buildLevelStartState(level, 3), 3, { axis: 'depth', sliceIndex: 0, dir: 1 }).cubies;
    const step = flipHint(level, stray, 3);
    expect(step).toMatchObject({ kind: 'turn', axis: 'depth', sliceIndex: 0, dir: -1, back: true });
    expect(hintLine(step)).toMatch(/get back/);
    // And from there the plan still solves it at par.
    const { board, flips } = followHints(level, play(stray, step));
    expect(checkFlipPuzzleSolved(board, 3)).toBe(true);
    expect(flips).toBe(level.flipPar);
  });

  it('owns up when the board is too far from the plan', () => {
    const level = FLIP_PUZZLES[0];
    let board = buildLevelStartState(level, 3);
    for (const [axis, sliceIndex] of [['col', 0], ['row', 2], ['depth', 1], ['col', 2]]) board = applyTileMove(board, 3, { axis, sliceIndex, dir: 1 }).cubies;
    expect(flipHint(level, board, 3)).toEqual({ kind: 'lost' });
    expect(hintLine({ kind: 'lost' })).toMatch(/Undo, or Reset/);
  });

  it('rings a pair, not a turn, once only flips are left', () => {
    const step = flipHint(FLIP_PUZZLES[0], buildLevelStartState(FLIP_PUZZLES[0], 3), 3);
    expect(step.kind).toBe('pair');
    expect(hintLine(step)).toMatch(/ringed pair/);
  });
});

describe('Check', () => {
  it('marks nothing on a solved cube and both tiles of a flipped pair', () => {
    const solved = makeCubies(3);
    expect(flipCheckTiles(solved, 3)).toEqual([]);
    const flipped = flipStickerPair(solved, 3, 1, 2, 2, 'PZ', buildManifoldGridMap(solved, 3));
    expect(flipCheckTiles(flipped, 3).map(t => t.dirKey).sort()).toEqual(['NZ', 'PZ']);
  });
});

describe('Flip Cube levels keep the cube flat', () => {
  it('turns pads off in a flip level whatever the setting, and leaves free play alone', () => {
    const settings = { flipPads: 'full' };
    expect(effectiveFlipPads({ settings, currentLevelData: FLIP_PUZZLES[5] })).toBe('off');
    expect(effectiveFlipPads({ settings, currentLevelData: null })).toBe('full');
    expect(effectiveFlipPads({ settings, chaosLevel: 1 })).toBe('full');
  });
});
