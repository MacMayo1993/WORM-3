import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useDemoMode } from '../hooks/useDemoMode.js';
import SettingsMenu from '../components/menus/SettingsMenu.jsx';
import ScreenTransition from '../components/ScreenTransition.jsx';
import DemoForecastPicker from '../components/screens/DemoForecastPicker.jsx';
import DisparityWinnerScreen from '../components/screens/DisparityWinnerScreen.jsx';
import { DemoCoach, DemoStepIntro } from '../components/screens/DemoFlowController.jsx';
import { STEP_INTRO_LINES } from '../utils/demoStepCopy.js';
import { makeCubies } from '../game/cubeState.js';

vi.mock('../3d/TilePreviewRenderer.js', () => ({
  registerTilePreview: vi.fn(), updateTilePreview: vi.fn(),
  unregisterTilePreview: vi.fn(), setTilePreviewActive: vi.fn(),
}));

let host, root, demo, before;
const callbacks = {
  setRotatedCubies: cubies => useGameStore.getState().setRotatedCubies(cubies),
  cancelShuffle: vi.fn(), changeSize: vi.fn(), reset: vi.fn(),
  cancelDisparityRun: vi.fn(), startDisparityGame: vi.fn(),
  animatedShuffle: vi.fn(), handleOpenStore: vi.fn(),
};

function Harness() {
  demo = useDemoMode(callbacks);
  const settings = useGameStore(s => s.settings);
  const showSettings = useGameStore(s => s.showSettings);
  const showWinner = useGameStore(s => s.showDisparityWinner);
  return <>
    {showSettings && <SettingsMenu settings={settings}
      onSettingsChange={useGameStore.getState().setSettings}
      onClose={() => useGameStore.getState().setShowSettings(false)} />}
    <ScreenTransition show={demo.demoTryVisible && !demo.demoStepIntroVisible && !demo.demoForecastVisible && !showSettings} freezeOnExit>
      <DemoCoach step={demo.demoStep} onNext={demo.demoStep === 'chaos-forecast'
        ? demo.handleDemoDisparityDismiss : () => demo.advanceDemoStep(demo.demoStep)} />
    </ScreenTransition>
    {demo.demoForecastVisible && <DemoForecastPicker onPick={demo.handleDemoForecastPick} onExit={demo.handleExitDemo} />}
    {showWinner && <DisparityWinnerScreen demoNavigation onDismiss={demo.handleDemoDisparityDismiss} />}
    {demo.demoStepIntroVisible && <DemoStepIntro step={demo.demoStep}
      onContinue={demo.handleDemoStepContinue} onExit={demo.handleExitDemo} />}
  </>;
}
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label);
const click = node => act(() => node.click());
const wait = ms => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({
    demoMode: true, demoStep: 'make-it-yours', size: 3, cubies: makeCubies(3),
    showSettings: false, showMainMenu: false, showWelcome: false,
    wormHealerMode: false, wormPauseMenuOpen: false, randomMode: false,
    showDisparityWinner: false, disparityWinner: null, chaosLevel: 0,
    ownedItems: [...before.ownedItems, 'scheme_pastel', 'tile_checkerboard'],
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useGameStore.setState(before, true);
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('keeps palette and tile edits on Settings until an explicit Next: Chaos →', () => {
  act(() => demo.handleDemoStepContinue());
  wait(20000); // The old coach appeared above the modal after twelve seconds.
  expect(host.querySelector('.demo-coach-pill')).toBeNull();
  click(host.querySelector('input[name="colorScheme"][value="pastel"]'));
  click(button('Tiles'));
  click(host.querySelector('[title="Apply Tile Grout to all faces"]'));
  expect(useGameStore.getState().settings.colorScheme).toBe('pastel');
  expect(Object.values(useGameStore.getState().settings.manifoldStyles)).toEqual(Array(6).fill('checkerboard'));
  expect(demo.demoStep).toBe('make-it-yours');
  expect(demo.demoStepIntroVisible).toBe(false);
  // Even a retained callback from the fading coach cannot bypass the modal.
  act(() => demo.advanceDemoStep('make-it-yours'));
  expect(demo.demoStep).toBe('make-it-yours');
  click(host.querySelector('[aria-label="Close settings"]'));
  wait(20000);
  expect(demo.demoCelebrationStep).toBeNull();
  expect(demo.demoStep).toBe('make-it-yours');
  expect(button('Next: Chaos →')).toBeDefined();
  click(button('Edit look'));
  expect(host.querySelector('.demo-coach-pill')).toBeNull();
  click(host.querySelector('[aria-label="Close settings"]'));
  click(button('Next: Chaos →'));
  expect(demo.demoStep).toBe('chaos-forecast');
  expect(demo.demoStepIntroVisible).toBe(true);
  expect(demo.demoForecastVisible).toBe(false);
  expect(useGameStore.getState().settings.colorScheme).toBe('pastel');
  expect(callbacks.startDisparityGame).not.toHaveBeenCalled();
  act(() => demo.handleDemoStepContinue());
  act(() => demo.handleDemoForecastPick({ faceIds: [1, 4] }));
  expect(callbacks.startDisparityGame).toHaveBeenCalledWith(expect.objectContaining({
    colorScheme: 'pastel',
    perFaceStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(face => [face, 'checkerboard'])),
  }), { pickIgnition: true });
});

it('opens the preview actions immediately when Settings closes before the coach delay', () => {
  act(() => demo.handleDemoStepContinue());
  wait(1700);
  click(host.querySelector('[aria-label="Close settings"]'));
  expect(demo.demoTryVisible).toBe(true);
  expect(demo.demoCelebrationStep).toBeNull();
  expect(button('Edit look')).toBeDefined();
  expect(button('Next: Chaos →')).toBeDefined();
});

it('restores visible preview actions after Edit look is closed during the 180ms exit', () => {
  act(() => demo.handleDemoStepContinue());
  wait(1700);
  click(host.querySelector('[aria-label="Close settings"]'));
  wait(250);
  const opacity = () => host.querySelector('.demo-coach-pill').parentElement.style.opacity;
  expect(opacity()).toBe('1');
  for (let i = 0; i < 3; i++) {
    click(button('Edit look'));
    wait(50);
    act(() => host.querySelector('.settings-overlay').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    wait(250);
    expect(opacity()).toBe('1');
    expect(demo.demoStep).toBe('make-it-yours');
    expect(demo.demoStepIntroVisible).toBe(false);
  }
  wait(20000);
  expect(demo.demoStep).toBe('make-it-yours');
  click(button('Next: Chaos →'));
  expect(demo.demoStep).toBe('chaos-forecast');
});

it.each([
  ['chaos-forecast', 'make-it-yours', 'Choose a pair'],
  ['random-showcase', 'chaos-forecast', 'Start Random'],
])('waits for every %s briefing page before starting the mode', (step, previous, launchLabel) => {
  act(() => {
    useGameStore.getState().setDemoStep(previous);
    demo.advanceDemoStep(previous);
  });
  const lines = STEP_INTRO_LINES[step];
  for (let i = 0; i < lines.length; i++) {
    expect(host.textContent).toContain(lines[i]);
    wait(20000); // Reading time never launches the mode or skips a page.
    expect(demo.demoForecastVisible).toBe(false);
    expect(useGameStore.getState().randomMode).toBe(false);
    expect(callbacks.animatedShuffle).not.toHaveBeenCalled();
    expect(callbacks.startDisparityGame).not.toHaveBeenCalled();
    click(button(i === lines.length - 1 ? launchLabel : 'Next ▶'));
  }
  wait(300);
  expect(demo.demoStepIntroVisible).toBe(false);
  if (step === 'chaos-forecast') {
    expect(demo.demoForecastVisible).toBe(true);
    expect(callbacks.startDisparityGame).not.toHaveBeenCalled();
  } else {
    expect(useGameStore.getState().randomMode).toBe(true);
    expect(callbacks.animatedShuffle).toHaveBeenCalledTimes(1);
  }
});

it('can exit the required Chaos briefing without skipping into the next section', () => {
  act(() => demo.advanceDemoStep('make-it-yours'));
  click(button('Exit Demo'));
  wait(300);
  expect(demo.demoStep).toBeNull();
  expect(useGameStore.getState().demoMode).toBe(false);
  expect(demo.demoForecastVisible).toBe(false);
  expect(callbacks.startDisparityGame).not.toHaveBeenCalled();
  expect(useGameStore.getState().randomMode).toBe(false);
});

it.each(['first strike', 'playing', 'winner reveal', 'results'])(
  'offers Next during Chaos %s and advances once with the correct reward', phase => {
    act(() => useGameStore.getState().setDemoStep('chaos-forecast'));
    act(() => demo.handleDemoStepContinue());
    expect(demo.demoTryVisible).toBe(true); // No five-second wait.
    {
      click(host.querySelector('[aria-pressed="false"]'));
      click(button('Confirm pick'));
      act(() => useGameStore.setState({ chaosIgnitionPicking: phase === 'first strike', chaosLevel: phase === 'playing' ? 3 : 0 }));
    }
    const won = phase === 'winner reveal' || phase === 'results';
    if (won) act(() => useGameStore.setState({
      disparityWinner: { pair: ['M1-001', 'M4-009'] }, showDisparityWinner: phase === 'results',
    }));
    wait(50);
    const next = button('Next: Random →');
    expect(next).toBeDefined();
    expect(next.disabled).toBe(false);
    if (phase === 'results') {
      expect(next.closest('[aria-label="Demo navigation"]')).not.toBeNull();
      expect(document.activeElement).toBe(next);
      expect(host.querySelector('.demo-coach-pill')).toBeNull();
    }
    const coins = useGameStore.getState().parityPoints;
    act(() => { next.click(); next.click(); });
    expect(useGameStore.getState().parityPoints).toBe(coins + (won ? 200 : 50));
    expect(demo.demoTryVisible).toBe(false);
    expect(useGameStore.getState().showDisparityWinner).toBe(false);
    expect(useGameStore.getState().chaosLevel).toBe(0);
    expect(callbacks.cancelDisparityRun).toHaveBeenCalled();
    wait(2800);
    expect(demo.demoStep).toBe('random-showcase');
    expect(demo.demoStepIntroVisible).toBe(true);
    expect(useGameStore.getState().randomMode).toBe(false);
  }
);
