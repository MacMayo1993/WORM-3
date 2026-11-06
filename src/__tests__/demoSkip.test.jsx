import React, { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useDemoMode } from '../hooks/useDemoMode.js';
import { makeCubies } from '../game/cubeState.js';
import { DEMO_STEP_IDS } from '../game/demoSequence.js';
import { newWormDemo, WORM_DEMO_LESSON_COUNT } from '../game/wormDemoState.js';
import { DemoStepIntro, DemoCoach, DemoProgressBar, VIEW_SHOWCASE_SEQUENCE } from '../components/screens/DemoFlowController.jsx';
import DemoForecastPicker from '../components/screens/DemoForecastPicker.jsx';
import WormDemoLessonCard from '../components/screens/WormDemoLessonCard.jsx';
import DemoEndScreen from '../components/screens/DemoEndScreen.jsx';
import { inspectionLens } from '../3d/inspectionBridge.js';

let host, root, demo, before;
const state = () => useGameStore.getState();
const callbacks = {
  cancelShuffle: vi.fn(), cancelDisparityRun: vi.fn(), animatedShuffle: vi.fn(),
  startDisparityGame: vi.fn(), handleOpenStore: vi.fn(), closeNavSheet: vi.fn(),
  setRotatedCubies: cubies => state().setRotatedCubies(cubies),
  changeSize: size => useGameStore.setState({ size, cubies: makeCubies(size) }),
  reset: () => state().setRotatedCubies(makeCubies(state().size)),
  startAnimatedShuffle: vi.fn(),
};
function Harness() {
  const api = useDemoMode(callbacks);
  useLayoutEffect(() => { demo = api; });
  return null;
}
const draw = node => act(() => root.render(node));
const click = label => act(() => [...host.querySelectorAll('button')].find(b => b.textContent === label).click());
const wait = ms => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = state();
  useGameStore.setState({ ...newWormDemo(), demoSkipped: false, demoMode: true, demoStep: 'worm-traversal',
    size: 3, cubies: makeCubies(3), wormHealerMode: false, wormPauseMenuOpen: false,
    showMainMenu: false, showSettings: false, showDisparityWinner: false, chaosLevel: 0,
    randomMode: false, visualMode: 'classic', showCutawayLens: false, showAntipodalPiP: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); useGameStore.setState(before, true);
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('skips every demo section without starting it, leaving no stale timers or completion reward', () => {
  draw(<Harness />);
  const xp = state().playerProgress.xp;
  for (const step of DEMO_STEP_IDS.filter(s => s !== 'end')) {
    expect(state().demoStep).toBe(step);
    act(() => demo.handleDemoSkipStep(step));
    const next = state().demoStep;
    // Double taps and an outgoing dialogue cannot skip the next lesson too.
    act(() => demo.handleDemoSkipStep(step));
    expect(state().demoStep).toBe(next);
    expect(state().demoMode).toBe(true);
    expect(demo.demoCelebrationStep).toBeNull();
    wait(60000);
    expect(state().demoStep).toBe(next);
  }
  expect(state().demoStep).toBe('end');
  expect(demo.demoStepIntroVisible).toBe(false);
  expect(state().playerProgress.xp).toBe(xp);
  expect(callbacks.startDisparityGame).not.toHaveBeenCalled();
  expect(callbacks.handleOpenStore).not.toHaveBeenCalled();
});

it('cancels an active WORM run and cube watch when skipping straight toward Views', () => {
  draw(<Harness />);
  act(() => demo.handleDemoStepContinue());
  expect(state().wormHealerMode).toBe(true);
  act(() => demo.handleDemoSkipStep('worm-traversal'));
  expect(state().wormHealerMode).toBe(false);
  expect(state().demoWormFinished).toBe(false);
  act(() => demo.handleDemoStepContinue());
  act(() => demo.handleDemoSkipStep('baby-cube'));
  wait(60000);
  expect(callbacks.startAnimatedShuffle).not.toHaveBeenCalled();
  for (const step of ['twin-paradox', 'flip-gateway', 'learn-to-solve', 'control-tour']) act(() => demo.handleDemoSkipStep(step));
  expect(state().demoStep).toBe('view-showcase');
  act(() => demo.handleDemoStepContinue());
  act(() => demo.handleDemoViewSpotlightClick());
  expect(state().visualMode).toBe('grid');
  expect(demo.demoShowcaseSubStep).toBe(0);
});

it('restores Cutaway staging when skipping the Views section', () => {
  useGameStore.setState({ demoStep: 'view-showcase' });
  const home = { x: inspectionLens.x, y: inspectionLens.y };
  draw(<Harness />);
  act(() => demo.handleDemoStepContinue());
  act(() => demo.handleDemoViewSpotlightClick());
  const cutaway = VIEW_SHOWCASE_SEQUENCE.findIndex(v => v.key === 'cutaway');
  for (let i = 0; i < cutaway; i++) act(() => demo.handleDemoShowcaseNext());
  expect(state().showCutawayLens).toBe(true);
  act(() => demo.handleDemoSkipStep('view-showcase'));
  expect(state()).toMatchObject({ demoStep: 'make-it-yours', showCutawayLens: false, showTunnels: false,
    showAntipodalPiP: false, visualMode: 'classic', hollowMode: false, exploded: false });
  expect({ x: inspectionLens.x, y: inspectionLens.y }).toEqual(home);
  expect(demo.demoShowcaseSubStep).toBe(-1);
});

it('skips Chaos while a reward timer is pending without advancing Random afterward', () => {
  useGameStore.setState({ demoStep: 'chaos-forecast' });
  draw(<Harness />);
  act(() => demo.handleDemoStepContinue());
  act(() => demo.handleDemoForecastPick({ id: 'red-orange', faceIds: [1, 4] }));
  act(() => demo.handleDemoDisparityDismiss());
  act(() => demo.handleDemoSkipStep('chaos-forecast'));
  wait(60000);
  expect(state().demoStep).toBe('random-showcase');
  expect(demo.demoRewardStamp).toBeNull();
  expect(demo.demoForecastVisible).toBe(false);
  expect(state().showDisparityWinner).toBe(false);
});

it('makes Skip Mobi, Skip Step, and Exit Demo three distinct actions inside the dialog', () => {
  const play = vi.fn(), skipStep = vi.fn(), exit = vi.fn();
  draw(<DemoStepIntro step="chaos-forecast" onContinue={play} onSkipStep={skipStep} onExit={exit} />);
  const dialog = host.querySelector('[role="dialog"]');
  expect([...dialog.querySelectorAll('button')].map(b => b.textContent)).toContain('Skip Step');
  click('Skip Mobi'); wait(300);
  expect(play).toHaveBeenCalledTimes(1); expect(skipStep).not.toHaveBeenCalled(); expect(exit).not.toHaveBeenCalled();
  draw(<DemoStepIntro key="next" step="random-showcase" onContinue={play} onSkipStep={skipStep} onExit={exit} />);
  click('Skip Step'); wait(300);
  expect(skipStep).toHaveBeenCalledTimes(1); expect(exit).not.toHaveBeenCalled();
  draw(<DemoStepIntro key="exit" step="random-showcase" onContinue={play} onSkipStep={skipStep} onExit={exit} />);
  click('Exit Demo'); wait(300); expect(exit).toHaveBeenCalledTimes(1);
});

it('dismisses follow-up Mobi copy and keeps skip reachable during the forecast and hands-on phases', () => {
  const seen = vi.fn(), skip = vi.fn();
  draw(<DemoCoach step="baby-cube" copy="Try rotating the cube." onCopySeen={seen} onSkipStep={skip} />);
  click('Skip Mobi'); wait(300); expect(seen).toHaveBeenCalledTimes(1); expect(skip).not.toHaveBeenCalled();
  draw(<DemoForecastPicker onSkipStep={skip} />); click('Skip Step'); expect(skip).toHaveBeenCalledTimes(1);
  draw(<DemoProgressBar currentStep="worm-traversal" onSkipStep={skip} />);
  click('Skip Step'); expect(skip).toHaveBeenCalledTimes(2);
});

it.each([true, false])('skips an unfinished WORM exercise without marking it completed (alive=%s)', alive => {
  useGameStore.setState({ wormHealerMode: true, wormGamePhase: 'active', wormAlive: alive });
  draw(<WormDemoLessonCard />);
  click('Skip Exercise');
  expect(state()).toMatchObject({ demoWormLessonIndex: 1, demoWormComplete: false, demoWormCompleted: [],
    demoWormSkipped: [0], demoWormStarted: false, demoWormPrepared: false, wormAlive: true, wormPaused: true });
  act(() => state().skipWormDemoLesson(0)); expect(state().demoWormLessonIndex).toBe(1);
});

it('skips the final WORM exercise directly to the next chapter without a completion stamp', () => {
  useGameStore.setState({ demoWormLessonIndex: WORM_DEMO_LESSON_COUNT - 1 });
  draw(<Harness />);
  act(() => state().skipWormDemoLesson(WORM_DEMO_LESSON_COUNT - 1));
  expect(state().demoStep).toBe('baby-cube');
  expect(state().demoWormCompleted).toEqual([]);
  expect(demo.demoCelebrationStep).toBeNull();
});

it('labels a skipped tour as finished and resets skips on replay', () => {
  useGameStore.setState({ demoSkipped: true, demoStep: 'end' });
  draw(<DemoEndScreen />);
  expect(host.textContent).toContain('Demo Finished');
  expect(host.textContent).not.toContain('Demo Complete');
  draw(<Harness />);
  act(() => demo.handleDemoReplay());
  expect(state()).toMatchObject({ demoStep: 'worm-traversal', demoSkipped: false, demoWormSkipped: [] });
});

it('launches short challenges directly and restores the player on finish without starting the full tour', () => {
  useGameStore.setState({ demoMode: false, demoStep: null });
  const settings = state().settings, character = state().wormCharacter, xp = state().playerProgress.xp;
  draw(<Harness />);
  act(() => demo.handleStartDemo('challenges'));
  expect(state()).toMatchObject({ demoMode: true, demoStep: 'worm-traversal', demoWormCourse: 'challenges', wormHealerMode: true, size: 5 });
  expect(demo.demoColdOpenVisible).toBe(false);
  expect(demo.demoStepIntroVisible).toBe(false);
  act(() => useGameStore.setState({ demoWormFinished: true }));
  expect(state()).toMatchObject({ demoMode: false, demoStep: null, showMainMenu: true, wormHealerMode: false, wormCharacter: character });
  expect(state().settings).toEqual(settings);
  expect(state().playerProgress.xp).toBe(xp);
  wait(60000);
  expect(state().demoMode).toBe(false);
});


it('keeps the saved character during a temporary showcase and restores it on exit', async () => {
  useGameStore.setState({ demoMode: false, demoStep: null,
    ownedItems: [...state().ownedItems, 'character_book'] });
  state().setWormCharacter('book');
  draw(<Harness />);
  act(() => demo.handleStartDemo('challenges'));
  expect(state().wormCharacter).toBe('glow');
  expect(localStorage.getItem('worm3_character')).toBe('book');
  // A fresh loader sees the player's choice even if the browser was closed
  // before cleanup could restore the temporary in-memory showcase character.
  vi.resetModules();
  const { persistedState: reloaded } = await import('../hooks/storeSlices/persistedState.js');
  expect(reloaded.wormCharacter).toBe('book');
  act(() => useGameStore.setState({ demoWormFinished: true }));
  expect(state().wormCharacter).toBe('book');
  expect(localStorage.getItem('worm3_character')).toBe('book');
  // An intentional later selection still persists normally.
  act(() => state().setWormCharacter('classic'));
  expect(localStorage.getItem('worm3_character')).toBe('classic');
});


it('repairs spent Chaos stickers when skipping the live round without a payout or early Random start', () => {
  const spent = makeCubies(3).map(plane => plane.map(row => row.map(c => ({ ...c,
    stickers: Object.fromEntries(Object.entries(c.stickers).map(([dir, sticker]) => [dir, { ...sticker, flips: 6 }]))
  }))));
  useGameStore.setState({ demoStep: 'chaos-forecast', cubies: spent, chaosLevel: 3,
    flipMode: true, showTunnels: true, autoRotateEnabled: true });
  draw(<Harness />);
  const coins = state().parityPoints;
  act(() => demo.handleDemoSkipStep('chaos-forecast'));
  expect(state().cubies).toEqual(makeCubies(3));
  expect(state().chaosLevel).toBe(0);
  expect(state().autoRotateEnabled).toBe(false);
  expect(state().flipMode).toBe(false);
  expect(state().showTunnels).toBe(false);
  expect(state().parityPoints).toBe(coins);
  expect(state().demoStep).toBe('random-showcase');
  expect(demo.demoStepIntroVisible).toBe(true);
  wait(20000);
  expect(state().randomMode).toBe(false);
  expect(callbacks.animatedShuffle).not.toHaveBeenCalled();
});
