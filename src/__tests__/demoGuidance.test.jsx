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
import { makeCubies } from '../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { CONTROL_TOUR_KEYS } from '../components/screens/DemoFlowController.jsx';

const callbacks = { setRotatedCubies: vi.fn(), cancelShuffle: vi.fn(), changeSize: vi.fn(), reset: vi.fn(),
  cancelDisparityRun: vi.fn(), startDisparityGame: vi.fn(), animatedShuffle: vi.fn(), handleOpenStore: vi.fn() };
describe('short demo and retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useGameStore.setState({ demoMode: true, demoStep: 'worm-traversal', wormAlive: true,
      wormTunnelCount: 0, wormPhase: 'crawling', wormGamePhase: 'playing', wormHealerMode: false, demoWormFinished: false });
  });
  afterEach(() => { useGameStore.setState({ demoMode: false }); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  it('does not finish a control-tour beat merely because reading took 20 seconds', () => {
    useGameStore.setState({ demoStep: 'control-tour', wormPauseMenuOpen: false });
    const { result, unmount } = renderHook(() => useDemoMode(callbacks));
    act(() => result.current.handleDemoStepContinue());
    act(() => vi.advanceTimersByTime(20000));
    expect(result.current.demoTourIndex).toBe(0);
    unmount();
  });
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
  it('hands nine sent pairs straight to the home counter without reopening Mobi', () => {
    useGameStore.setState({ demoStep: 'flip-gateway', size: 3, cubies: makeCubies(3), wormHealerMode: false });
    const { result, unmount } = renderHook(() => useDemoMode({ ...callbacks,
      setRotatedCubies: cubies => useGameStore.getState().setRotatedCubies(cubies) }));
    try {
      act(() => result.current.handleDemoStepContinue());
      act(() => vi.advanceTimersByTime(1000));
      const flip = (x, y) => act(() => {
        const { cubies } = useGameStore.getState();
        useGameStore.getState().setRotatedCubies(flipStickerPair(cubies, 3, x, y, 2, 'PZ', buildManifoldGridMap(cubies, 3)));
      });
      expect(result.current.demoFlipProgress).toEqual({ phase: 'flip-all', done: 0, total: 9 });
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) flip(x, y);
      expect(result.current.demoFlipProgress).toEqual({ phase: 'unflip-all', done: 0, total: 9 });
      expect(result.current.demoCoachCopy).toBeNull();
      expect(result.current.demoTryVisible).toBe(true);
      flip(0, 0);
      expect(result.current.demoFlipProgress).toEqual({ phase: 'unflip-all', done: 1, total: 9 });
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x || y) flip(x, y);
      expect(result.current.demoFlipProgress).toBeNull();
      expect(result.current.demoCelebrationStep).toBe('flip-gateway');
    } finally { unmount(); }
  });
  it('keeps practicing after emergence and offers optional lessons only when practice ends', () => {
    const { result, unmount } = renderHook(() => useDemoMode(callbacks));
    act(() => useGameStore.setState({ wormTunnelCount: 1, wormPhase: 'windup' }));
    expect(result.current.demoCelebrationStep).toBeNull();
    act(() => useGameStore.setState({ wormPhase: 'crawling' }));
    expect(result.current.demoCelebrationStep).toBeNull();
    act(() => useGameStore.getState().finishWormDemo());
    expect(result.current.demoCelebrationStep).toBe('worm-traversal');
    act(() => result.current.dismissDemoCelebration());
    expect(useGameStore.getState().demoStep).toBe('end');
    act(() => result.current.handleDemoExplore());
    expect(useGameStore.getState().demoStep).toBe('learn-to-solve');
    unmount();
  });
});
describe('demo runs each mode on its live mechanics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useGameStore.setState({ demoMode: true, wormPauseMenuOpen: false, wormHealerMode: false });
  });
  afterEach(() => {
    useGameStore.setState({ demoMode: false, chaosIgnitionPicking: false });
    vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('holds the Undo beat until Undo itself is pressed', async () => {
    useGameStore.setState({ demoStep: 'control-tour' });
    const { result, unmount } = renderHook(() => useDemoMode({ ...callbacks, closeNavSheet: vi.fn() }));
    try {
      act(() => result.current.handleDemoStepContinue());
      act(() => vi.advanceTimersByTime(1600));
      const undoBeat = CONTROL_TOUR_KEYS.indexOf('undo');
      for (const key of CONTROL_TOUR_KEYS.slice(0, undoBeat)) await act(async () => result.current.handleDemoNavTap(key));
      expect(result.current.demoTourIndex).toBe(undoBeat);
      await act(async () => result.current.handleDemoNavTap('flip'));
      expect(result.current.demoTourIndex).toBe(undoBeat);
      await act(async () => result.current.handleDemoNavTap('undo'));
      expect(result.current.demoTourIndex).toBe(undoBeat + 1);
    } finally { unmount(); }
  });

  it('launches the Chaos round through the live first-strike pick', () => {
    const startDisparityGame = vi.fn();
    useGameStore.setState({ demoStep: 'chaos-forecast' });
    const { result, unmount } = renderHook(() => useDemoMode({ ...callbacks, startDisparityGame }));
    try {
      act(() => result.current.handleDemoForecastPick({ id: 'red-orange', faceIds: [1, 4] }));
      expect(startDisparityGame).toHaveBeenCalledTimes(1);
      expect(startDisparityGame).toHaveBeenCalledWith(expect.objectContaining({ flipMode: true }), { pickIgnition: true });
    } finally { unmount(); }
  });

  it('cancels a Chaos launch still waiting on its first strike when the demo exits', () => {
    const cancelDisparityRun = vi.fn();
    useGameStore.setState({ demoStep: 'chaos-forecast', chaosIgnitionPicking: true });
    const { result, unmount } = renderHook(() => useDemoMode({ ...callbacks, cancelDisparityRun, closeNavSheet: vi.fn() }));
    try {
      act(() => result.current.handleExitDemo());
      expect(cancelDisparityRun).toHaveBeenCalled();
      expect(useGameStore.getState().chaosIgnitionPicking).toBe(false);
      expect(useGameStore.getState().demoMode).toBe(false);
    } finally { unmount(); }
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
