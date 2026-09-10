import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

function renderHook(hook) {
  const result = { current: null };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  function Harness() { result.current = hook(); return null; }
  act(() => root.render(<Harness />));
  return { result, unmount: () => { act(() => root.unmount()); host.remove(); } };
}
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDemoMode } from '../hooks/useDemoMode.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { flipPose } from '../utils/flipPose.js';
import { PAIRS, pairPoint } from '../components/intro/introTopology.js';
import { Vector3 } from 'three';

const callbacks = { setRotatedCubies: vi.fn(), cancelShuffle: vi.fn(), changeSize: vi.fn(), reset: vi.fn(),
  cancelDisparityRun: vi.fn(), startDisparityGame: vi.fn(), animatedShuffle: vi.fn(), handleOpenStore: vi.fn() };
describe('short demo and retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useGameStore.setState({ demoMode: true, demoStep: 'worm-traversal', wormAlive: true,
      wormTunnelCount: 0, wormPhase: 'crawling', wormGamePhase: 'playing', wormHealerMode: false });
  });
  afterEach(() => { useGameStore.setState({ demoMode: false }); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  it('stays on a failed attempt and lets retry start a new run', () => {
    const { result, unmount } = renderHook(() => useDemoMode(callbacks));
    act(() => useGameStore.setState({ wormAlive: false }));
    act(() => vi.advanceTimersByTime(20000));
    expect(useGameStore.getState().demoStep).toBe('worm-traversal');
    const previousRun = useGameStore.getState().wormRunId;
    act(() => result.current.handleDemoStepContinue());
    expect(useGameStore.getState().wormRunId).toBe(previousRun + 1);
    expect(useGameStore.getState().wormAlive).toBe(true);
    unmount();
  });
  it('waits for emergence, then completes the core tour and offers optional lessons', () => {
    const { result, unmount } = renderHook(() => useDemoMode(callbacks));
    act(() => useGameStore.setState({ wormTunnelCount: 1, wormPhase: 'windup' }));
    expect(result.current.demoCelebrationStep).toBeNull();
    act(() => useGameStore.setState({ wormPhase: 'crawling' }));
    expect(result.current.demoCelebrationStep).toBe('worm-traversal');
    act(() => result.current.dismissDemoCelebration());
    expect(useGameStore.getState().demoStep).toBe('end');
    act(() => result.current.handleDemoExplore());
    expect(useGameStore.getState().demoStep).toBe('learn-to-solve');
    unmount();
  });
});
describe('shared intro primitives', () => {
  it('snaps shut at the seam and returns to full size', () => {
    expect(flipPose(0).mainScale).toBe(1);
    expect(flipPose(0.5).mainScale).toBeCloseTo(0.001);
    expect(flipPose(0.8).mainScale).toBeGreaterThan(1);
    expect(flipPose(1).mainScale).toBe(1);
  });
  it('pins every tunnel endpoint while the gameplay corkscrew moves', () => {
    for (const pair of PAIRS) for (const time of [0, 1, 5]) {
      const a = pairPoint(pair, 0, 2, new Vector3(), 0.51, time);
      const b = pairPoint(pair, 1, 2, new Vector3(), 0.51, time);
      expect(a.clone().add(b).length()).toBeLessThan(1e-8);
      expect(a.toArray().every(Number.isFinite)).toBe(true);
    }
  });
});
