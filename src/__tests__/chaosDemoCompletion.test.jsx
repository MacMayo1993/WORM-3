import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import UILayer from '../components/UILayer.jsx';
import { useDemoMode } from '../hooks/useDemoMode.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { Z } from '../utils/uiTheme.js';

vi.mock('../utils/device.js', async importOriginal => ({ ...await importOriginal(), isMobile: true }));
vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
// This suite exercises the live HUD; the menu's eager WebGL font preloader is unrelated.
vi.mock('../components/menus/MainMenu.jsx', () => ({ default: () => null }));

const initialState = useGameStore.getState();
let root, host, demo;
const state = () => useGameStore.getState();
const callbacks = {
  cancelShuffle: vi.fn(), changeSize: vi.fn(), reset: vi.fn(),
  setRotatedCubies: cubies => state().setRotatedCubies(cubies),
  cancelDisparityRun: vi.fn(), startDisparityGame: vi.fn(),
  animatedShuffle: vi.fn(), handleOpenStore: vi.fn(), closeNavSheet: vi.fn(),
};
const replay = vi.fn();

function Harness() {
  const flow = useDemoMode(callbacks);
  React.useLayoutEffect(() => { demo = flow; });
  const chaosLevel = useGameStore(s => s.chaosLevel);
  const settings = useGameStore(s => s.settings);
  return <UILayer
    metrics={{ flips: 0 }} resolvedColors={{}} settings={settings}
    chaosMode={chaosLevel > 0} chaosLevel={chaosLevel} cascades={[]}
    moveHistory={[{ axis: 'row', sliceIndex: 0, dir: 1 }]} canUndo undo={vi.fn()}
    teachMode={{ active: false, courseActive: false }}
    ui={{ sheetOpen: false, setSheetOpen: vi.fn(), setSheetMode: vi.fn(),
      demoChaosComplete: flow.demoChaosComplete, demoDialogueVisible: flow.demoStepIntroVisible }}
    handlers={{ onDemoDisparityDismiss: flow.handleDemoDisparityDismiss, onChaosReplay: replay }}
  />;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks();
  useGameStore.setState({ ...initialState, demoMode: true, demoStep: 'chaos-forecast',
    showMainMenu: false, showTutorial: false, showLevelTutorial: false,
    wormHealerMode: false, wormPauseMenuOpen: false, size: 3, cubies: makeCubies(3),
    chaosLevel: 3, autoRotateEnabled: true, disparityWinner: null, showDisparityWinner: false,
    parityPoints: 1000, settings: { ...initialState.settings, colorScheme: 'standard' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useGameStore.setState(initialState);
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const render = async () => {
  await act(async () => root.render(<Harness />));
  await act(async () => { await vi.dynamicImportSettled(); });
};
const win = async () => {
  await act(async () => state().setDisparityWinner({ pair: ['M1-001', 'M4-009'] }));
  await act(async () => { await vi.dynamicImportSettled(); });
};

it('removes mobile HUD controls at the winner, then advances once without replaying', async () => {
  await render();
  act(() => demo.handleDemoStepContinue());
  act(() => demo.handleDemoForecastPick({ faceIds: [1, 4] }));
  act(() => useGameStore.setState({ chaosLevel: 3, autoRotateEnabled: true }));
  expect(host.querySelector('.top-app-bar')).not.toBeNull();
  expect(host.querySelector('[data-demo-control="flip"]')).not.toBeNull();
  act(() => host.querySelector('[aria-label="Open menu"]').click());
  expect(host.querySelector('[aria-label="Reset"]')).not.toBeNull();

  await win();
  // The worker's delayed reveal has not run; the demo already owns the screen.
  expect(state().showDisparityWinner).toBe(false);
  expect(demo.demoChaosComplete).toBe(true);
  expect(state().autoRotateEnabled).toBe(false);
  expect(callbacks.closeNavSheet).toHaveBeenCalled();
  expect(host.querySelector('.top-app-bar')).toBeNull();
  expect(host.querySelector('[data-demo-control]')).toBeNull();
  expect(host.querySelector('[aria-label="Chaos match"]')).toBeNull();
  expect(host.querySelector('.mobile-controls')).toBeNull();
  const dialog = host.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain('Chaos complete');
  expect(dialog.parentElement.style.zIndex).toBe(String(Z.FULLSCREEN));
  expect([...host.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Next demo step →']);
  act(() => vi.advanceTimersByTime(500));
  const next = host.querySelector('button');
  expect(next.disabled).toBe(false);
  expect(document.activeElement).toBe(next);
  act(() => { next.click(); next.click(); });
  expect(state().parityPoints).toBe(1200);
  expect(demo.demoChaosComplete).toBe(true);
  expect(state().chaosLevel).toBe(0);
  expect(state().disparityWinner).toBeNull();
  act(() => vi.advanceTimersByTime(200));
  expect(host.querySelector('button')).toBeNull();
  act(() => vi.advanceTimersByTime(2400));
  expect(state().demoStep).toBe('random-showcase');
  expect(demo.demoStepIntroVisible).toBe(true);
  expect(demo.demoChaosComplete).toBe(false);
  expect(replay).not.toHaveBeenCalled();
  expect(callbacks.startDisparityGame).toHaveBeenCalledTimes(1);
});

it('cancels the delayed coach and keeps skipped Chaos clear throughout its payout', async () => {
  await render();
  act(() => demo.handleDemoStepContinue());
  act(() => vi.advanceTimersByTime(4500));
  act(() => demo.handleDemoChaosSkip());
  act(() => vi.advanceTimersByTime(1000));
  expect(demo.demoTryVisible).toBe(false);
  expect(demo.demoHintStep).toBeNull();
  expect(demo.demoChaosComplete).toBe(true);
  expect(host.querySelector('button')).toBeNull();
  expect(state().parityPoints).toBe(1050);
  act(() => vi.advanceTimersByTime(1600));
  expect(state().demoStep).toBe('random-showcase');
  act(() => demo.handleDemoChaosSkip());
  expect(state().parityPoints).toBe(1050);
});

it('preserves the regular Chaos replay and setup choices outside the demo', async () => {
  useGameStore.setState({ demoMode: false, demoStep: null,
    disparityWinner: { pair: ['M1-001', 'M4-009'] }, showDisparityWinner: true });
  await render();
  expect(host.textContent).toContain('Last pair standing');
  expect(host.textContent).toContain('Next round · same setup');
  expect(host.textContent).toContain('Change setup');
  expect(host.textContent).not.toContain('Next demo step');
  act(() => vi.advanceTimersByTime(500));
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'Next round · same setup').click());
  expect(replay).toHaveBeenCalledTimes(1);
});
