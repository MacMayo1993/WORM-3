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
it('restores intervening relapses and reproduces the same roll after replaying a move', () => {
  const pos = {x: 0, y: 2, z: 2};
  const play = () => {
    act(() => input.flip(pos, 'PZ'));
    act(() => input.onMove('col', 1, pos, 2));
    act(() => vi.advanceTimersByTime(ROLL_MS * 6));
    return useGameStore.getState();
  };
  const start = useGameStore.getState(), after = play();
  expect(after.flipRun.count).toBeGreaterThan(0);
  expect(after.flipRun.flips).toBe(1);
  act(() => input.undo());
  expect(useGameStore.getState().flipRun.count).toBe(0);
  act(() => input.undo());
  expect(useGameStore.getState().cubies).toEqual(start.cubies);
  expect(useGameStore.getState().flipRun).toEqual(start.flipRun);
  const replay = play();
  expect(replay.cubies).toEqual(after.cubies);
  expect(replay.flipRun).toEqual(after.flipRun);
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
