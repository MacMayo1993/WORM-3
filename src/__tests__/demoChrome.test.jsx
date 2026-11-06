import React, { act, useState, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import UILayer from '../components/UILayer.jsx';
import { DemoRewardStamp, DemoStepIntro } from '../components/screens/DemoFlowController.jsx';
import { useDemoMode } from '../hooks/useDemoMode.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

const device = vi.hoisted(() => ({ mobile: true }));
vi.mock('../utils/device.js', async original => ({ ...await original(), get isMobile() { return device.mobile; } }));
vi.mock('../components/menus/MainMenu.jsx', () => ({ default: () => null }));
vi.mock('../components/menus/SettingsMenu.jsx', () => ({ default: () => null }));
vi.mock('../components/menus/HelpMenu.jsx', () => ({ default: () => null }));

let host, root, before, demo;
const callbacks = {
  cancelShuffle: vi.fn(), changeSize: vi.fn(), reset: vi.fn(),
  cancelDisparityRun: vi.fn(), startDisparityGame: vi.fn(), animatedShuffle: vi.fn(),
  setRotatedCubies: cubies => useGameStore.getState().setRotatedCubies(cubies),
};
function Harness() {
  const [sheetOpen, setSheetOpen] = useState(true);
  const flow = useDemoMode(callbacks);
  useLayoutEffect(() => { demo = flow; });
  const chaosLevel = useGameStore(s => s.chaosLevel);
  const blocked = !!flow.demoRewardStamp || flow.demoStepIntroVisible;
  return <>
    <UILayer metrics={{}} settings={before.settings} resolvedColors={{}}
      chaosMode={chaosLevel > 0} chaosLevel={chaosLevel} cascades={[]} moveHistory={['move']} canUndo undo={() => {}}
      teachMode={{ active: false, courseActive: false }}
      ui={{ sheetOpen, setSheetOpen, sheetMode: 'views', demoDialogueVisible: blocked }}
      handlers={{ onDemoDisparityDismiss: flow.handleDemoDisparityDismiss }} />
    {flow.demoRewardStamp && <DemoRewardStamp {...flow.demoRewardStamp} onExit={flow.handleExitDemo} />}
    {flow.demoStepIntroVisible && <DemoStepIntro step={flow.demoStep} onContinue={flow.handleDemoStepContinue} onExit={flow.handleExitDemo} />}
  </>;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks();
  before = useGameStore.getState();
  useGameStore.setState({ demoMode: true, demoStep: 'chaos-forecast', showWelcome: false,
    showMainMenu: false, wormHealerMode: false, wormPauseMenuOpen: false, showSettings: false, showHelp: false,
    showTutorial: false, showLevelTutorial: false, showFirstFlipTutorial: false, showCutscene: false,
    showDisparityWinner: false, disparityWinner: null, showNetPanel: false, showLeaderboard: false,
    showMobileTouchHint: true, faceRotationTarget: 'PZ', selectedTileForRotation: null,
    randomMode: false, chaosLevel: 3, size: 3, cubies: makeCubies(3) });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); useGameStore.setState(before, true);
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([true, false])('keeps game controls hidden from results through reward and Random briefing (mobile=%s)', async mobile => {
  device.mobile = mobile;
  await act(async () => root.render(<Harness />));
  expect(host.querySelector('.top-app-bar')).toBeNull();
  expect(host.querySelector('[aria-label="Open menu"]')).toBeNull();
  expect(host.querySelector('[aria-label="Game controls"]')).not.toBeNull();
  act(() => demo.handleDemoForecastPick({ faceIds: [1, 4] }));
  await act(async () => useGameStore.setState({ disparityWinner: { pair: ['M1-001', 'M4-009'] }, showDisparityWinner: true }));
  await act(async () => { await vi.dynamicImportSettled(); });
  const next = host.querySelector('.chaos-demo-next button');
  expect(next).not.toBeNull();
  expect(next.closest('[inert]')).toBeNull();
  const controls = () => host.querySelector('.top-app-bar, .bottom-nav-bar, .mobile-touch-hint, .sheet-open, [aria-label="Open menu"], [aria-label="Close menu"]');
  expect(controls()).toBeNull();
  act(() => { next.click(); next.click(); });
  expect(controls()).toBeNull();
  expect(host.querySelector('[aria-label="Chaos reward"]').closest('[inert]')).toBeNull();
  expect(useGameStore.getState().cubies).toEqual(makeCubies(3));
  act(() => vi.advanceTimersByTime(2600));
  expect(demo.demoStep).toBe('random-showcase');
  expect(host.querySelector('[aria-label="Chaos reward"]')).toBeNull();
  expect(controls()).toBeNull();
  expect(host.querySelector('[role="dialog"]').closest('[inert]')).toBeNull();
  expect(useGameStore.getState().randomMode).toBe(false);
  act(() => demo.handleDemoStepContinue());
  act(() => vi.advanceTimersByTime(300));
  expect(useGameStore.getState().randomMode).toBe(true);
  expect(host.querySelector('[aria-label="Game controls"]')).not.toBeNull();
  expect(host.querySelector('.sheet-open')).toBeNull();
});
