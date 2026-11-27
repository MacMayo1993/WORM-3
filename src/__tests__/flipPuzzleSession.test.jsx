import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { useCubeState } from '../hooks/useCubeState.js';
import { useGameSession } from '../hooks/useGameSession.js';
import { useUndo } from '../hooks/useUndo.js';
import { useParityDecay } from '../hooks/useParityDecay.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { FLIP_PUZZLES } from '../levels/packs/flip-puzzles.js';
import { newFlipRun, ROLL_MS } from '../game/flipRelapse.js';
import { ProgressManager } from '../levels/ProgressManager.js';

let root, before, input;
function Session() {
  const animation = useAnimation();
  const cube = useCubeState();
  const { undo } = useUndo(animation.startAnimation);
  useParityDecay();
  useGameSession();
  React.useLayoutEffect(() => { input = { ...animation, flip: cube.flipSticker, undo }; });
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  const level = FLIP_PUZZLES[6];
  useGameStore.setState({ currentLevelData: level, currentLevel: level.id, size: 3,
    cubies: buildLevelStartState(level, 3), moves: 0, moveHistory: [], hasShuffled: true,
    victory: null, showWelcome: false, showMainMenu: false, hasFlippedOnce: true,
    flipRun: newFlipRun(1), flipActiveMs: 0, rotationEpoch: before.rotationEpoch + 1 });
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Session />));
});
afterEach(() => {
  act(() => root.unmount());
  useGameStore.setState(before, true);
  vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('a relapse clears the undo history, and undo never rewinds the roll clock', () => {
  const pos = {x: 0, y: 2, z: 2};
  // Undo before any relapse: the flip comes back, the clock keeps running.
  act(() => input.flip(pos, 'PZ'));
  act(() => vi.advanceTimersByTime(ROLL_MS - 1000));
  const clock = useGameStore.getState().flipRun.elapsed;
  expect(useGameStore.getState().flipRun.flips).toBe(1);
  act(() => input.undo());
  expect(useGameStore.getState().flipRun.flips).toBe(0);
  expect(useGameStore.getState().flipRun.elapsed).toBeGreaterThanOrEqual(clock);
  // Play on until a relapse lands: it clears the history, so Undo cannot rewind it.
  act(() => input.flip(pos, 'PZ'));
  act(() => input.onMove('col', 1, pos, 2));
  act(() => vi.advanceTimersByTime(ROLL_MS * 6));
  const after = useGameStore.getState();
  expect(after.flipRun.count).toBeGreaterThan(0);
  expect(after.moveHistory).toEqual([]);
  act(() => input.undo());
  expect(useGameStore.getState().cubies).toBe(after.cubies);
  expect(useGameStore.getState().flipRun.count).toBe(after.flipRun.count);
});
it('freezes the roll clock in the session menu and resumes without missed rolls', () => {
  act(() => vi.advanceTimersByTime(9000));
  const atPause = useGameStore.getState().flipRun;
  act(() => useGameStore.setState({ flipSessionMenu: true }));
  act(() => vi.advanceTimersByTime(40000));
  expect(useGameStore.getState().flipRun).toBe(atPause);
  act(() => useGameStore.setState({ flipSessionMenu: false }));
  act(() => vi.advanceTimersByTime(1000));
  expect(useGameStore.getState().flipRun.elapsed).toBe(ROLL_MS);
});
it('keeps the best zero-flip run and uses time only among equal flip counts', () => {
  const progress = new ProgressManager({ autoSave: false });
  progress.completeLevel(604, { flips: 0, time: 40, moves: 7 });
  progress.completeLevel(604, { flips: 1, time: 6, moves: 3 });
  expect(progress.getLevelStats(604)).toMatchObject({ bestFlips: 0, bestFlipTime: 40, stars: 3 });
  progress.completeLevel(604, { flips: 0, time: 25, moves: 5 });
  expect(progress.getLevelStats(604)).toMatchObject({ bestFlips: 0, bestFlipTime: 25 });
});

it('banks a clear and its unlock before the clear card is dismissed', () => {
  const level = FLIP_PUZZLES[0];
  act(() => useGameStore.setState({ cubies: buildLevelStartState(level, 3), currentLevel: level.id,
    currentLevelData: level, flipRun: newFlipRun(level.id), showNetPanel: true }));
  act(() => input.flip({ x: 1, y: 2, z: 2 }, 'PZ'));
  act(() => vi.advanceTimersByTime(800));
  const won = useGameStore.getState();
  expect(won.victory).toBe('rubiks');
  expect(won.showNetPanel).toBe(false);
  expect(won.flipRun.completion.previous).toBeNull();
  const reloaded = new ProgressManager();
  expect(reloaded.getLevelStats(level.id)).toMatchObject({ bestFlips: 1, stars: 3, completionCount: 1 });
  expect(reloaded.isLevelUnlocked(602)).toBe(true);
});

it('closes the far-side window when the level is solved', () => {
  const level = FLIP_PUZZLES[0];
  const cubies = buildLevelStartState(level, 3);
  act(() => useGameStore.setState({ currentLevelData: level, currentLevel: level.id, cubies, flipRun: newFlipRun(1), showAntipodalPiP: true, moveHistory: [] }));
  // First Flip: one paired flip on the front top edge solves it.
  act(() => input.flip({ x: 1, y: 2, z: 2 }, 'PZ'));
  act(() => vi.advanceTimersByTime(2000));
  expect(useGameStore.getState().victory).toBeTruthy();
  expect(useGameStore.getState().showAntipodalPiP).toBe(false);
});

it('turns a layer on its own on a cube-turn level, without counting a move or leaving an undo', () => {
  const level = FLIP_PUZZLES[9];
  act(() => useGameStore.setState({ currentLevelData: level, currentLevel: level.id, cubies: buildLevelStartState(level, 3),
    flipRun: newFlipRun(level.id), moveHistory: [], moves: 0 }));
  act(() => input.flip({ x: 0, y: 2, z: 2 }, 'PZ'));
  expect(useGameStore.getState().moveHistory).toHaveLength(1);
  const before = useGameStore.getState().cubies;
  // Into the warning: the layer is picked and shown, nothing has turned yet.
  act(() => vi.advanceTimersByTime(12600));
  expect(useGameStore.getState().flipRun.cubeTurn).toBeTruthy();
  expect(useGameStore.getState().cubies).toBe(before);
  // Past the turn: it starts like a scramble move.
  act(() => vi.advanceTimersByTime(3000));
  const { pendingMove, animState } = useGameStore.getState();
  expect(pendingMove).toMatchObject({ isCubeTurn: true, isShuffle: true });
  expect(animState).toBeTruthy();
  act(() => input.handleAnimComplete());
  const after = useGameStore.getState();
  expect(after.cubies).not.toBe(before);
  expect(after.moves).toBe(1);
  expect(after.moveHistory).toEqual([]);
  expect(after.flipRun.cubeTurns).toBe(1);
});
