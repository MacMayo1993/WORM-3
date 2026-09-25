import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useRandomMode } from '../hooks/useRandomMode.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
function Harness() { useRandomMode(); return null; }
let root, host;
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove(); vi.useRealTimers();
  useGameStore.setState({ randomMode: false, wormHealerMode: false, wormPaused: false });
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('retains cached materials, updates a remix atomically, and skips paused story cycles', () => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ randomMode: true, wormHealerMode: true, wormPaused: false,
    showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false });
  const cached = getTileStyleMaterial('grass', '#abcdef');
  const disposed = vi.fn(); cached.addEventListener('dispose', disposed);
  const updates = [];
  const unsubscribe = useGameStore.subscribe((s, prev) => { if (s.settings !== prev.settings || s.randomStyleTick !== prev.randomStyleTick) updates.push(s); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  expect(updates).toHaveLength(1);
  const tick = useGameStore.getState().randomStyleTick;
  act(() => vi.advanceTimersByTime(10000));
  expect(updates).toHaveLength(2);
  expect(useGameStore.getState().randomStyleTick).toBe(tick + 1);
  expect(getTileStyleMaterial('grass', '#abcdef')).toBe(cached);
  expect(disposed).not.toHaveBeenCalled();
  act(() => useGameStore.setState({ wormPaused: true }));
  act(() => vi.advanceTimersByTime(30000));
  expect(updates).toHaveLength(2);
  act(() => useGameStore.setState({ wormPaused: false }));
  act(() => vi.advanceTimersByTime(10000));
  expect(updates).toHaveLength(3);
  unsubscribe(); cached.removeEventListener('dispose', disposed);
});

it('counts only active play time from the ready card and across partial-cycle pauses', () => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ randomMode: true, wormHealerMode: true, wormPaused: true, wormRunId: 100,
    showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  const tick = () => useGameStore.getState().randomStyleTick;
  const initial = tick();
  const advance = ms => act(() => vi.advanceTimersByTime(ms));
  const pause = value => act(() => useGameStore.setState({ wormPaused: value }));

  advance(9000); // Ready card time must not use nine seconds of the first cycle.
  pause(false);
  expect(tick()).toBe(initial); // No immediate remix/shake on Start.
  advance(9999); expect(tick()).toBe(initial);
  advance(1); expect(tick()).toBe(initial + 1);

  advance(6000); pause(true);
  advance(45000); expect(tick()).toBe(initial + 1);
  pause(false);
  advance(3999); expect(tick()).toBe(initial + 1);
  advance(1); expect(tick()).toBe(initial + 2);
  advance(10000); expect(tick()).toBe(initial + 3);

  advance(8000); pause(true);
  act(() => useGameStore.setState({ wormRunId: 101 })); // Retry resets remaining time.
  advance(29000); pause(false);
  advance(9999); expect(tick()).toBe(initial + 3);
  advance(1); expect(tick()).toBe(initial + 4);

  act(() => root.unmount()); root = null;
  advance(30000); expect(tick()).toBe(initial + 4);
});
