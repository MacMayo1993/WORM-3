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
