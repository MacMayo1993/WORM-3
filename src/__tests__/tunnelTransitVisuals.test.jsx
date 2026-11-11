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
    settings: { ...useGameStore.getState().settings, reducedMotion: false, reduceFlashing: false },
    wormActiveTunnelColors: { entryColor: '#ff477e', exitColor: '#3edbff' } });
  // The lens at the centre: the crossing beats follow it, not the head.
  tunnelState.t = 0.58; tunnelState.lensT = 0.5; tunnelState.mouthGlow = 0;
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  tunnelState.t = 0; tunnelState.lensT = 0; tunnelState.mouthGlow = 0;
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
it('keeps a continuous, unobstructed overlay across the exit handoff', () => {
  act(() => root.render(<TunnelTransitOverlay />)); frame(100);
  act(() => useGameStore.setState({ wormPhase: 'exiting' })); frame(100);
  const before = Number(host.children[0].style.opacity);
  act(() => useGameStore.setState({ wormPhase: 'windout' })); frame(32);
  expect(host.children).toHaveLength(4);
  expect(Math.abs(Number(host.children[0].style.opacity) - before)).toBeLessThan(.02);
  act(() => useGameStore.setState({ wormPhase: 'crawling' })); frame(2000);
  expect([...host.children].every(el => Number(el.style.opacity) === 0)).toBe(true);
});

it('holds white passage light through entry and exit, freezes on pause and releases after leaving', () => {
  act(() => useGameStore.setState({ wormPhase: 'entering' }));
  tunnelState.mouthGlow = 1;
  act(() => root.render(<TunnelTransitOverlay />)); frame(1000);
  const mouth = host.querySelector('[data-testid="tunnel-mouth-glow"]');
  const entry = Number(mouth.style.opacity);
  expect(entry).toBeGreaterThan(.8);
  act(() => useGameStore.setState({ wormPhase: 'exiting' })); frame(100);
  expect(Math.abs(Number(mouth.style.opacity) - entry)).toBeLessThan(.01);
  act(() => useGameStore.setState({ wormPaused: true }));
  const paused = mouth.style.opacity;
  tunnelState.mouthGlow = .2; frame(200);
  expect(mouth.style.opacity).toBe(paused);
  act(() => useGameStore.setState({ wormPaused: false })); frame(32);
  expect(Number(mouth.style.opacity)).toBeCloseTo(.17, 2);
  tunnelState.mouthGlow = 0; frame(32);
  expect(Number(mouth.style.opacity)).toBe(0);
});

it.each(['reducedMotion', 'reduceFlashing'])('suppresses white crossing light with %s enabled', setting => {
  tunnelState.mouthGlow = 1;
  act(() => useGameStore.setState({ settings: { ...useGameStore.getState().settings, [setting]: true } }));
  act(() => root.render(<TunnelTransitOverlay />)); frame(1000);
  expect(host.querySelector('[data-testid="tunnel-mouth-glow"]').style.opacity).toBe('0');
  expect(host.children[2].style.opacity).toBe('0');
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
