import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { useUndo } from '../hooks/useUndo.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { applyTileMove } from '../game/tileOrientation.js';

let root, api, undo, saved;
function Harness() {
  const animation = useAnimation();
  const undoAction = useUndo(animation.startAnimation).undo;
  React.useLayoutEffect(() => { api = animation; undo = undoAction; });
  return null;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  saved = useGameStore.getState();
  useGameStore.setState({ cubies: rotateSliceCubies(makeCubies(3), 3, 'row', 2, 1), size: 3,
    moves: 0, moveHistory: [], wormHealerMode: false, animState: null, pendingMove: null });
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  useGameStore.setState(saved, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([1, 2, 3])('commits and undoes a %i-quarter move with exact orientation recovery', turns => {
  const before = useGameStore.getState().cubies;
  act(() => api.onMove('row', 1, { x: 0, y: 2, z: 0 }, turns));
  if (turns === 1) act(() => api.handleAnimComplete());
  expect(useGameStore.getState().cubies[1][2][1].stickers.PY.uvTurns ?? 0).toBe(0);
  const resets = useGameStore.getState().moveHistory[0].orientationResets;
  if (turns === 3) expect(resets).toHaveLength(0); // already upright after the rigid turn
  else expect(resets.length).toBeGreaterThan(0);
  act(() => undo());
  if (turns === 1) act(() => api.handleAnimComplete());
  expect(useGameStore.getState().cubies).toEqual(before);
  expect(useGameStore.getState().moves).toBe(0);
  expect(useGameStore.getState().moveHistory).toHaveLength(0);
});

it('preserves opposing layer directions and reset history through animated undo', () => {
  const before = useGameStore.getState().cubies;
  act(() => api.startAnimation('row', 1, 0, false, [0, 2], [1, -1]));
  act(() => api.handleAnimComplete());
  act(() => undo());
  expect(useGameStore.getState().pendingMove.sliceDirs).toEqual([-1, 1]);
  act(() => api.handleAnimComplete());
  expect(useGameStore.getState().cubies).toEqual(before);
});

it('applies a shuffle half-turn atomically with the same home rule as gameplay', () => {
  const before = useGameStore.getState().cubies;
  const move = { axis: 'col', sliceIndex: 2, dir: 1, numTurns: 2 };
  act(() => api.startAnimatedShuffle([move]));
  act(() => api.handleAnimComplete());
  expect(useGameStore.getState().cubies).toEqual(applyTileMove(before, 3, move).cubies);
  expect(useGameStore.getState().moves).toBe(0);
  expect(useGameStore.getState().moveHistory).toHaveLength(0);
});

it('can still undo legacy history entries without an orientation journal', () => {
  const home = makeCubies(3);
  act(() => useGameStore.setState({ cubies: rotateSliceCubies(home, 3, 'row', 2, 1), moves: 1,
    moveHistory: [{ type: 'rotation', axis: 'row', sliceIndex: 2, dir: 1 }] }));
  act(() => undo());
  act(() => api.handleAnimComplete());
  expect(useGameStore.getState().cubies).toEqual(home);
});
