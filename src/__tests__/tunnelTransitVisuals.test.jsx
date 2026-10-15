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
  // The lens at the centre: the crossing beats follow it, not the head.
  tunnelState.t = 0.58; tunnelState.lensT = 0.5;
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  tunnelState.t = 0; tunnelState.lensT = 0;
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
it('marks the exit cut with a bloom in the exit colour that clears on its own', () => {
  act(() => root.render(<TunnelTransitOverlay />)); frame(100);
  const bloom = () => Number(host.children[3].style.opacity);
  expect(bloom()).toBe(0);
  act(() => useGameStore.setState({ wormPhase: 'exiting' })); frame(100);
  expect(bloom()).toBe(0);
  // The chase camera calls this in the frame it cuts; the bloom lands in that
  // frame, before the store has heard about windout.
  act(() => tunnelState.onExitCut());
  expect(bloom()).toBeGreaterThan(0.5);
  act(() => useGameStore.setState({ wormPhase: 'windout' })); frame(32);
  expect(bloom()).toBeGreaterThan(0.3);
  expect(host.children[3].style.background).toContain('62, 219, 255');
  act(() => useGameStore.setState({ wormPhase: 'crawling' })); frame(600);
  expect(bloom()).toBe(0);
});

it('blooms the identification beat when the lens reaches the centre, not when the head does', () => {
  act(() => root.render(<TunnelTransitOverlay />));
  const seam = () => Number(host.children[2].style.opacity);
  // Head at the centre, lens still a cubie back in the entry arm: no bloom yet.
  tunnelState.t = 0.5; tunnelState.lensT = 0.3; frame(100);
  expect(seam()).toBe(0);
  // The lens arrives.
  tunnelState.t = 0.62; tunnelState.lensT = 0.5; frame(100);
  expect(seam()).toBeGreaterThan(0);
});
