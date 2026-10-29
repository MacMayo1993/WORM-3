import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SceneReadySignal from '../3d/SceneReadySignal.jsx';

const state = vi.hoisted(() => ({ active: false, frame: null }));
vi.mock('@react-three/fiber', () => ({ useFrame: callback => { state.frame = callback; } }));
vi.mock('@react-three/drei', () => ({ useProgress: { getState: () => state } }));
let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement('div'));
  state.active = false;
});
afterEach(() => {
  act(() => root.unmount());
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const frame = () => act(() => state.frame());

it('waits for texture loading plus rendered frames and reports once', () => {
  const ready = vi.fn();
  act(() => root.render(<SceneReadySignal token={1} onReady={ready} />));
  frame(); frame();
  state.active = true;
  frame(); frame(); frame();
  expect(ready).not.toHaveBeenCalled();
  state.active = false;
  frame(); frame();
  expect(ready).not.toHaveBeenCalled();
  frame(); frame();
  expect(ready).toHaveBeenCalledExactlyOnceWith(1);
});

it('waits again when advancing to another level of the same cube size', () => {
  const ready = vi.fn();
  act(() => root.render(<SceneReadySignal key={1} token={1} onReady={ready} />));
  frame(); frame(); frame();
  act(() => root.render(<SceneReadySignal key={2} token={2} onReady={ready} />));
  frame(); frame();
  expect(ready).toHaveBeenCalledTimes(1);
  frame();
  expect(ready).toHaveBeenLastCalledWith(2);
});
