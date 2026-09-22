import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import ComingSoonScreen from '../components/screens/ComingSoonScreen.jsx';
import SecondaryModesSheet from '../components/menus/SecondaryModesSheet.jsx';
import { useKeyboardControls } from '../hooks/useKeyboardControls.js';
import { useGameStore, getActiveMode } from '../hooks/useGameStore.js';
import { BLOCKING_FLAGS, MODAL_SURFACES } from '../hooks/uiSurfaces.js';

let host, root, initialState;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  initialState = useGameStore.getState();
  const closed = Object.fromEntries([...BLOCKING_FLAGS, ...MODAL_SURFACES.map(s => s.flag)].map(k => [k, false]));
  useGameStore.setState({ ...closed, victory: null, animState: null, currentLevelData: null, wormHealerMode: false });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGameStore.setState(initialState, true);
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const render = node => act(() => root.render(node));
const press = key => act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));

it('offers Biome and Möbius Cubelet without retired mode cards', () => {
  const biome = vi.fn(), cubelet = vi.fn();
  render(<ComingSoonScreen onBiome={biome} onMobiusCubelet={cubelet} />);
  expect(host.textContent).not.toMatch(/Hands|Holonomy|Merge Mode|Crawler|Co-op/i);
  const grow = [...host.querySelectorAll('[role="button"], button')].find(n => n.textContent.trim().startsWith('Play'));
  expect(grow).toBeTruthy();
  act(() => grow.click());
  expect(biome).toHaveBeenCalledOnce();
  const card = [...host.querySelectorAll('button')].find(n => n.textContent.includes('Möbius Cubelet'));
  act(() => card.click());
  const look = [...host.querySelectorAll('[role="button"], button')].find(n => n.textContent.trim().startsWith('Open'));
  expect(look).toBeTruthy();
  act(() => look.click());
  expect(cubelet).toHaveBeenCalledOnce();
});

it('keeps Solve and Teach in the secondary sheet without the Hands toggle', () => {
  render(<SecondaryModesSheet open mode="more" />);
  expect(host.textContent).not.toContain('Hands');
  expect(host.textContent).toContain('Solve');
  expect(host.textContent).toContain('Teach');
});

function KeyboardHarness(props) {
  useKeyboardControls(props);
  return null;
}

it('keeps normal rotation, help and Escape working after the retired P shortcut', () => {
  const move = vi.fn();
  render(<KeyboardHarness onMove={move} />);
  press('p');
  expect(useGameStore.getState().handsMode).toBeUndefined();
  press('w');
  expect(move).toHaveBeenCalledOnce();
  press('h');
  expect(useGameStore.getState().showHelp).toBe(true);
  press('w');
  expect(move).toHaveBeenCalledOnce();
  press('Escape');
  expect(useGameStore.getState().showHelp).toBe(false);
  press('w');
  expect(move).toHaveBeenCalledTimes(2);
});

it('ignores retired flags while resolving active release modes', () => {
  const retired = { handsMode: true, holonomyMode: true, mergeMode: true, coopMode: true };
  expect(getActiveMode(retired)).toBe('freeplay');
  expect(getActiveMode({ ...retired, teachModeActive: true })).toBe('teach');
  expect(getActiveMode({ ...retired, wormHealerMode: true })).toBe('worm-healer');
});
