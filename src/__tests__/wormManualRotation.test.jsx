import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { useKeyboardControls } from '../hooks/useKeyboardControls.js';
import { makeCubies } from '../game/cubeState.js';

let root, host, api;
const shuffle = vi.fn(), undo = vi.fn();
function Harness() {
  const animation = useAnimation();
  React.useEffect(() => { api = animation; }, [animation]);
  useKeyboardControls({ onMove: animation.onMove, onShuffle: shuffle, onUndo: undo });
  return null;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ size: 3, cubies: makeCubies(3), wormHealerMode: true, wormPaused: false,
    wormJumpRescueActive: false, animState: null, pendingMove: null, moves: 0, moveHistory: [],
    showMainMenu: false, showWelcome: false, showSettings: false, showHelp: false });
  host = document.createElement('div'); root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT; vi.clearAllMocks(); });

it.each([1, 2, 4])('rejects a manual %i-quarter-turn commit without changing the cube', turns => {
  const before = useGameStore.getState();
  act(() => api.onMove('row', 1, { x: 1, y: 1, z: 2 }, turns));
  const after = useGameStore.getState();
  expect(after.cubies).toBe(before.cubies);
  expect(after.animState).toBeNull();
  expect(after.moves).toBe(0);
});
it('keeps scheduled hazard turns and ordinary puzzle turns working', () => {
  act(() => api.startAnimation('row', 1, 1));
  expect(useGameStore.getState().animState).toMatchObject({ axis: 'row', sliceIndex: 1 });
  act(() => api.handleAnimComplete());
  expect(useGameStore.getState().moves).toBe(1);
  act(() => useGameStore.setState({ wormHealerMode: false }));
  act(() => api.onMove('col', -1, { x: 2, y: 1, z: 2 }));
  expect(useGameStore.getState().animState).toMatchObject({ axis: 'col', sliceIndex: 2 });
});
it('does not let jump or undo keys invoke puzzle actions in WORM', () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
  });
  expect(shuffle).not.toHaveBeenCalled(); expect(undo).not.toHaveBeenCalled();
});
