import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import TunnelTransitOverlay from '../worm/TunnelTransitOverlay.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
let host, root;
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({ wormHealerMode: true, wormPhase: 'tunnel', wormAlive: true, wormPaused: false,
    wormActiveTunnelColors: { entryColor: '#ff477e', exitColor: '#3edbff' } });
  tunnelState.t = 0.5;
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  tunnelState.t = 0;
  vi.unstubAllGlobals(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const frame = ms => act(() => vi.advanceTimersByTime(ms));
it('freezes the transit envelope during pause and clears it on death', () => {
  act(() => root.render(<TunnelTransitOverlay />)); frame(100);
  const before = [...host.children].map(el => el.style.opacity);
  expect(Number(before[2])).toBeGreaterThan(0);
  act(() => useGameStore.setState({ wormPaused: true })); frame(500);
  expect([...host.children].map(el => el.style.opacity)).toEqual(before);
  act(() => useGameStore.setState({ wormAlive: false })); frame(2000);
  expect([...host.children].every(el => Number(el.style.opacity) === 0)).toBe(true);
});
it('suppresses the crossing pulse for reduced motion and cancels RAF on unmount', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  act(() => root.render(<TunnelTransitOverlay />)); frame(300);
  expect(host.children[2].style.opacity).toBe('0');
  act(() => root.render(null));
  expect(vi.getTimerCount()).toBe(0);
});
