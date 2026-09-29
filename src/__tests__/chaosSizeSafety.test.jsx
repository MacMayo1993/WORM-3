import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useChaosMode } from '../hooks/useChaosMode.js';
import SecondaryModesSheet from '../components/menus/SecondaryModesSheet.jsx';

let before, root, host, workers;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ chaosLevel: 0, activeBet: null, autoRotateEnabled: false, showMainMenu: false, wormHealerMode: false });
  useGameStore.getState().setSize(10);
  workers = [];
  vi.stubGlobal('Worker', class {
    constructor() { this.postMessage = vi.fn(); this.terminate = vi.fn(); workers.push(this); }
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useGameStore.setState(before, true);
  vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const state = () => useGameStore.getState();
function Engine() { useChaosMode(); return null; }
function Menu() {
  const s = useGameStore();
  return <SecondaryModesSheet open mode="more" size={s.size} chaosMode={s.chaosLevel > 0}
    chaosLevel={s.chaosLevel} onToggleChaos={s.toggleChaos} onSetChaosLevel={s.setChaosLevel}
    maxChaosLevel={5} />;
}

it.each([6, 10, 15])('blocks direct, updater and keyboard Chaos activation on a size-%i board without replacing it', size => {
  state().setSize(size);
  const board = state().cubies;
  state().setChaosLevel(5); expect(state().chaosLevel).toBe(0);
  state().setChaosLevel(() => 5); expect(state().chaosLevel).toBe(0);
  state().toggleChaos(); expect(state().chaosLevel).toBe(0);
  expect(state().size).toBe(size); expect(state().cubies).toBe(board);
});

it.each([2, 3, 4, 5])('still allows all five Chaos levels on a size-%i board', size => {
  state().setSize(size);
  for (let level = 1; level <= 5; level++) {
    state().setChaosLevel(level); expect(state().chaosLevel).toBe(level);
  }
  state().toggleChaos(); expect(state().chaosLevel).toBe(0);
  state().toggleChaos(); expect(state().chaosLevel).toBe(1);
});

it('stops Chaos atomically when resizing above its supported limit', () => {
  state().setSize(5); state().setChaosLevel(5);
  const snapshots = [];
  const unsubscribe = useGameStore.subscribe(s => snapshots.push([s.size, s.chaosLevel]));
  state().setSize(10); unsubscribe();
  expect(snapshots).toEqual([[10, 0]]);
  expect(state().cubies).toHaveLength(10);
});

it('explains the limit in Flip Cube’s menu and enables Chaos after choosing a supported size', () => {
  act(() => root.render(<Menu />));
  const chaos = () => [...host.querySelectorAll('button')].find(b => b.querySelector('.sheet-item-label')?.textContent === 'Chaos');
  expect(chaos().disabled).toBe(true);
  expect(host.textContent).toContain('5×5');
  act(() => chaos().click()); expect(state().chaosLevel).toBe(0);
  act(() => state().setSize(5));
  expect(chaos().disabled).toBe(false);
  act(() => chaos().click());
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Level 5')).click());
  expect(state().chaosLevel).toBe(5);
});

it('never starts the worker for an unsupported state restored outside the normal actions', () => {
  useGameStore.setState({ chaosLevel: 5 });
  act(() => root.render(<Engine />));
  expect(workers).toHaveLength(1);
  expect(workers[0].postMessage.mock.calls.some(([m]) => m.type === 'START')).toBe(false);
  expect(state().chaosLevel).toBe(0);
});

it('starts level 5 at the supported boundary and stops it when the board becomes 10×10', () => {
  state().setSize(5); state().setChaosLevel(5);
  act(() => root.render(<Engine />));
  expect(workers[0].postMessage.mock.calls.find(([m]) => m.type === 'START')[0].payload)
    .toMatchObject({ size: 5, chaosLevel: 5 });
  act(() => state().setSize(10));
  expect(workers[0].terminate).toHaveBeenCalled();
  expect(workers.at(-1).postMessage.mock.calls.some(([m]) => m.type === 'START')).toBe(false);
  expect(state().chaosLevel).toBe(0);
});
