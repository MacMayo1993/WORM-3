import React, { act, useState } from 'react';
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
import { WORM_DEMO_LESSON_COUNT } from '../game/wormDemoState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { newWormDemo } from '../game/wormDemoState.js';
import { CONTROL_TOUR_KEYS, DEMO_LEVEL_CONFIGS, VIEW_SHOWCASE_SEQUENCE } from '../components/screens/DemoFlowController.jsx';

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
  it('keeps WORM practice required and advances to the cube only after the final exercise', () => {
    const { result, unmount } = renderHook(() => useDemoMode(callbacks));
    act(() => useGameStore.setState({ wormTunnelCount: 1, wormPhase: 'windup' }));
    expect(result.current.demoCelebrationStep).toBeNull();
    act(() => useGameStore.setState({ wormPhase: 'crawling' }));
    expect(result.current.demoCelebrationStep).toBeNull();
    act(() => useGameStore.getState().finishWormDemo());
    act(() => result.current.advanceDemoStep('worm-traversal'));
    expect(useGameStore.getState().demoStep).toBe('worm-traversal');
    expect(result.current.demoCelebrationStep).toBeNull();
    act(() => useGameStore.setState({ demoWormLessonIndex: WORM_DEMO_LESSON_COUNT - 1, demoWormComplete: true }));
    act(() => useGameStore.getState().nextWormDemoLesson());
    expect(result.current.demoCelebrationStep).toBe('worm-traversal');
    act(() => result.current.dismissDemoCelebration());
    expect(useGameStore.getState().demoStep).toBe('baby-cube');
    expect(result.current.demoStepIntroVisible).toBe(true);
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
describe('required curriculum', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useGameStore.setState({ ...newWormDemo(), demoMode: false, demoStep: null, size: 3, cubies: makeCubies(3),
      wormHealerMode: false, wormPauseMenuOpen: false, showSettings: false, victory: null });
  });
  afterEach(() => { useGameStore.setState({ demoMode: false }); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const store = () => useGameStore.getState();
  const rotate = moves => {
    let cubies = store().cubies;
    for (const { axis, sliceIndex, dir } of moves) cubies = rotateSliceCubies(cubies, store().size, axis, sliceIndex, dir);
    store().setRotatedCubies(cubies);
  };
  const live = { ...callbacks,
    changeSize: size => useGameStore.setState({ size, cubies: makeCubies(size) }),
    reset: () => store().setRotatedCubies(makeCubies(store().size)),
    setRotatedCubies: cubies => store().setRotatedCubies(cubies),
    startAnimatedShuffle: (moves, done) => { rotate(moves); done?.(); },
  };
  it.each(['handleStartDemo', 'handleDemoReplay'])('%s starts with fresh WORM practice even after an old completed run', action => {
    const { result, unmount } = renderHook(() => useDemoMode(live));
    try {
      act(() => useGameStore.setState({ demoWormLessonIndex: 18, demoWormComplete: true, demoWormFinished: true, demoWormCompleted: ['rotation'], wormPauseMenuOpen: true }));
      act(() => result.current[action]());
      expect(store()).toMatchObject({ demoMode: true, demoStep: 'worm-traversal', demoWormLessonIndex: 0,
        demoWormComplete: false, demoWormFinished: false, demoWormCompleted: [], wormPauseMenuOpen: false, wormHealerMode: true });
      expect(result.current.demoColdOpenVisible).toBe(true);
    } finally { unmount(); }
  });
  it('runs from WORM through every remaining section to completion without an optional branch', async () => {
    const { result, unmount } = renderHook(() => {
      const [navSheetOpen, setNavOpen] = useState(false);
      return { ...useDemoMode({ ...live, navSheetOpen, closeNavSheet: () => setNavOpen(false) }), setNavOpen };
    });
    const seen = [];
    const enter = step => {
      expect(store().demoStep).toBe(step); seen.push(step);
      act(() => result.current.handleDemoStepContinue());
    };
    const celebrate = step => {
      expect(result.current.demoCelebrationStep).toBe(step);
      act(() => result.current.dismissDemoCelebration());
    };
    const flip = (x, y) => act(() => store().setRotatedCubies(flipStickerPair(store().cubies, store().size, x, y, store().size - 1, 'PZ', buildManifoldGridMap(store().cubies, store().size))));
    try {
      act(() => result.current.handleStartDemo());
      act(() => result.current.handleDemoColdOpenContinue());
      enter('worm-traversal');
      // Physics outcomes for each exercise are covered in wormDemoPractice;
      // this boundary starts at the last achieved goal, then uses the real Next.
      act(() => useGameStore.setState({ demoWormLessonIndex: WORM_DEMO_LESSON_COUNT - 1, demoWormComplete: true }));
      act(() => store().nextWormDemoLesson());
      celebrate('worm-traversal');
      enter('baby-cube');
      act(() => vi.advanceTimersByTime(3000));
      act(() => rotate([...DEMO_LEVEL_CONFIGS['baby-cube'].watch.moves].reverse().map(m => ({ ...m, dir: -m.dir }))));
      celebrate('baby-cube');
      result.current.onTapFlipRef.current = ({ x, y }) => flip(x, y);
      enter('twin-paradox');
      act(() => vi.advanceTimersByTime(1600));
      act(() => store().setFlipMode(true));
      act(() => vi.advanceTimersByTime(3000));
      flip(1, 1); celebrate('twin-paradox');
      enter('flip-gateway');
      for (let repeat = 0; repeat < 2; repeat++) for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) flip(x, y);
      celebrate('flip-gateway');
      enter('learn-to-solve');
      act(() => rotate([...DEMO_LEVEL_CONFIGS['learn-to-solve'].scrambleSequence].reverse().map(m => ({ ...m, dir: -m.dir }))));
      celebrate('learn-to-solve');
      enter('control-tour');
      act(() => vi.advanceTimersByTime(2000));
      for (const key of CONTROL_TOUR_KEYS) {
        await act(async () => result.current.handleDemoNavTap(key));
        if (['views', 'more'].includes(key)) {
          act(() => result.current.setNavOpen(true));
          act(() => result.current.setNavOpen(false));
        }
      }
      celebrate('control-tour');
      enter('view-showcase');
      act(() => result.current.handleDemoViewSpotlightClick());
      for (let i = 0; i < VIEW_SHOWCASE_SEQUENCE.length; i++) {
        expect(result.current.demoShowcaseSubStep).toBe(i);
        act(() => result.current.handleDemoShowcaseNext());
      }
      enter('make-it-yours');
      act(() => vi.advanceTimersByTime(2000));
      act(() => store().setShowSettings(false));
      act(() => result.current.advanceDemoStep('make-it-yours'));
      enter('chaos-forecast');
      expect(result.current.demoForecastVisible).toBe(true);
      act(() => result.current.handleDemoDisparityDismiss());
      expect(store().demoStep).toBe('chaos-forecast');
      act(() => result.current.handleDemoForecastPick({ id: 'red-orange', faceIds: [1, 4] }));
      act(() => result.current.handleDemoDisparityDismiss());
      act(() => vi.advanceTimersByTime(2800));
      enter('random-showcase');
      act(() => vi.advanceTimersByTime(12000));
      expect(result.current.demoTryVisible).toBe(true);
      act(() => result.current.advanceDemoStep('random-showcase'));
      enter('cosmetic-reward');
      expect(callbacks.handleOpenStore).toHaveBeenCalled();
      act(() => result.current.advanceDemoStep('cosmetic-reward'));
      expect(store().demoStep).toBe('end');
      expect(seen).toEqual(['worm-traversal', 'baby-cube', 'twin-paradox', 'flip-gateway', 'learn-to-solve',
        'control-tour', 'view-showcase', 'make-it-yours', 'chaos-forecast', 'random-showcase', 'cosmetic-reward']);
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
