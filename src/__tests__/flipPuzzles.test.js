import { describe, expect, it } from 'vitest';
import { FLIP_PUZZLES, FLIP_PUZZLE_BACKGROUNDS } from '../levels/packs/flip-puzzles.js';
import { STORY_ENVIRONMENTS } from '../utils/backgrounds.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { applyTileMove, inverseTileMove } from '../game/tileOrientation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkFlipPuzzleSolved } from '../game/winDetection.js';
import { makeCubies } from '../game/cubeState.js';
import { computeStars } from '../levels/scoring.js';
import { searchFlipTarget } from '../levels/flipTarget.js';
import { newFlipRun, advanceFlipRun, scarredPairs, canRelapse, flipCheckpoint, restoreFlipCheckpoint, flipTurnsLocked, flipFreeplayActive,
  LESSON_MS, ROLL_MS } from '../game/flipRelapse.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { puzzleXpChanges } from '../progression/awards.js';
import { createXpRun, newProgress } from '../progression/model.js';
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
    expect(FLIP_CAP % 2).toBe(0);
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

describe('Flip Cube review fixes', () => {
  it('locks turns (drag and release included) at the same moments the move port refuses them', () => {
    const level = FLIP_PUZZLES[0];
    const base = { ...prep(level), victory: null, firstFlipHighlightPair: null };
    expect(flipTurnsLocked(base)).toBe(false);
    expect(flipTurnsLocked({ ...base, firstFlipHighlightPair: ['M1-002', 'M4-002'] })).toBe(true);
    expect(flipTurnsLocked({ ...base, hasShuffled: false })).toBe(true);
    expect(flipTurnsLocked({ ...base, victory: 'rubiks' })).toBe(true);
    const lesson = FLIP_PUZZLES.find(l => l.relapseLesson);
    expect(flipTurnsLocked({ ...prep(lesson), victory: null })).toBe(true);
    // Never outside a flip level.
    expect(flipTurnsLocked({ ...base, currentLevelData: null, hasShuffled: false })).toBe(false);
  });

  it('undo restores the board and flip score but never rewinds the relapse clock', () => {
    const state = { ...prep(FLIP_PUZZLES[6]), moves: 3 };
    const saved = flipCheckpoint(state).beforeFlipInput;
    expect(saved).not.toHaveProperty('flipRun');
    const later = { ...state, moves: 5, flipRun: { ...state.flipRun, flips: 2, elapsed: 9000, nextRoll: 10000, seed: 77 } };
    const restored = restoreFlipCheckpoint(later, saved);
    expect(restored.cubies).toBe(state.cubies);
    expect(restored.moves).toBe(3);
    expect(restored.flipRun).toMatchObject({ flips: 0, elapsed: 9000, nextRoll: 10000, seed: 77 });
  });

  it('a relapse clears the undo history', () => {
    const lesson = FLIP_PUZZLES.find(l => l.relapseLesson);
    const state = { ...prep(lesson), moveHistory: [{ type: 'flip' }] };
    const after = advanceFlipRun(state, LESSON_MS, FLIP_CAP);
    expect(after.cubies).toBeDefined();
    expect(after.moveHistory).toEqual([]);
  });

  it('plain free play takes no board snapshots, and the free-play flag never leaks into other modes', () => {
    const free = { size: 3, cubies: makeCubies(3), moves: 0, flipRun: newFlipRun(1), flipFreeplay: true, settings: { flipRelapse: false } };
    expect(flipCheckpoint(free)).toEqual({});
    expect(flipCheckpoint({ ...free, settings: { flipRelapse: true } })).toHaveProperty('beforeFlipInput');
    expect(flipFreeplayActive(free)).toBe(true);
    for (const other of [{ randomMode: true }, { teachModeActive: true }, { chaosLevel: 1 }, { wormHealerMode: true }, { currentLevelData: FLIP_PUZZLES[0] }]) {
      expect(flipFreeplayActive({ ...free, ...other })).toBe(false);
    }
  });

  it('pays XP stars from flips on a flip level, and counts a flipped solve as solved', () => {
    const level = FLIP_PUZZLES[1]; // Centre Swap: one centre-pair flip solves it
    let cubies = buildLevelStartState(level, 3);
    for (const move of [...level.scrambleSequence].reverse()) cubies = applyTileMove(cubies, 3, inverseTileMove(move)).cubies;
    cubies = flip(cubies, buildManifoldGridMap(cubies, 3).get(centre));
    expect(checkFlipPuzzleSolved(cubies, 3)).toBe(true);
    const playerProgress = newProgress();
    const state = {
      ...useGameStore.getState(), demoMode: false, showMainMenu: false, wormHealerMode: false, teachModeActive: false, animState: null,
      currentLevel: level.id, currentLevelData: level, activePackId: 'flip-puzzles', size: 3, cubies, moves: 40, gameTime: 30,
      victory: 'rubiks', hasShuffled: true, flipRun: { ...newFlipRun(1), flips: level.flipPar }, playerProgress
    };
    state.xpRun = createXpRun('story', 0, 0, { puzzle: true, levelId: level.id, size: 3, eligible: true, scrambleMoves: 6, challenge: 'x' });
    const result = puzzleXpChanges(state);
    expect(result.playerProgress.milestones[`stars:${level.id}`]).toBe(3);
    expect(result.playerProgress.bests).toMatchObject({ [Object.keys(result.playerProgress.bests)[0]]: level.flipPar });
  });

  it('gives every level a scene that draws (a photo panorama, the nebula or the black hole)', () => {
    expect(new Set(FLIP_PUZZLE_BACKGROUNDS).size).toBe(FLIP_PUZZLES.length);
    for (const level of FLIP_PUZZLES) {
      const scene = level.background;
      expect(STORY_ENVIRONMENTS[scene] || ['moon', 'blackhole'].includes(scene), `${level.name}: ${scene}`).toBeTruthy();
    }
  });
});
