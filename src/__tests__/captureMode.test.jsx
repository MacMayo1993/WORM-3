import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import CaptureChrome from '../components/capture/CaptureChrome.jsx';
import CaptureController from '../components/capture/CaptureController.jsx';
import CapturePanel from '../components/capture/CapturePanel.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { callWormTurn } from '../worm/wormTurnBridge.js';
vi.mock('../worm/wormTurnBridge.js', () => ({ callWormTurn: vi.fn() }));
let host, root;
const set = state => act(() => useGameStore.setState(state));
const touch = (type, touches) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: touches });
  act(() => window.dispatchEvent(e));
};
const fingers = [{ identifier: 1, clientX: 40, clientY: 40 }, { identifier: 2, clientX: 80, clientY: 40 }];
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ captureMode: false, showMainMenu: false, showWelcome: false,
    showSettings: false, showHelp: false, showTutorial: false, showFirstFlipTutorial: false,
    showLevelTutorial: false, showCutscene: false, showLevelSelect: false, showPackSelect: false,
    victory: null, showDisparityWinner: false, wormHealerMode: false, wormAlive: true, wormStoryLevel: null, demoMode: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it.each([
  ['Cube Free Play', {}], ['Cube Levels', { currentLevel: 2 }],
  ['Chaos', { chaosLevel: 2 }], ['Random', { randomMode: true }],
  ['Learn to Solve', { teachModeActive: true }], ['Biome', { visualMode: 'biome' }],
  ['Worm Free Play', { wormHealerMode: true }],
  ['Worm Levels', { wormHealerMode: true, wormStoryLevel: 2, wormStoryStarted: true }],
  ['Worm Combat', { wormHealerMode: true, wormCombatMode: true }],
])('starts from settings in %s and preserves gameplay state', (_, mode) => {
  set({ ...mode, showSettings: true });
  act(() => root.render(<CapturePanel />));
  expect(host.querySelector('button').disabled).toBe(false);
  act(() => host.querySelector('button').click());
  expect(useGameStore.getState()).toMatchObject({ ...mode, captureMode: true, showSettings: false });
});
it('keeps HUD effects mounted while removing paint, hit targets and focus', () => {
  const unmount = vi.fn();
  function Hud() { useEffect(() => unmount, []); return <button>HUD</button>; }
  act(() => root.render(<><canvas /><CaptureChrome><Hud /></CaptureChrome></>));
  const canvas = host.querySelector('canvas');
  set({ captureMode: true });
  const chrome = host.querySelector('.capture-chrome');
  expect(chrome.hidden).toBe(true); expect(chrome.style.display).toBe('none');
  expect(chrome.hasAttribute('inert')).toBe(true); expect(unmount).not.toHaveBeenCalled();
  expect(host.querySelector('canvas')).toBe(canvas);
  set({ captureMode: false }); expect(chrome.hidden).toBe(false);
});
it('Escape restores UI without reaching game handlers; normal controls pass through', () => {
  act(() => root.render(<CaptureController />)); set({ captureMode: true });
  const downstream = vi.fn(); window.addEventListener('keydown', downstream);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })));
  expect(downstream).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H' })));
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(downstream).toHaveBeenCalledTimes(1);
  expect(useGameStore.getState().captureMode).toBe(false);
  expect(document.documentElement.classList.contains('capture-active')).toBe(false);
  window.removeEventListener('keydown', downstream);
});
it('requires a stationary two-finger hold and swallows releases after exiting', () => {
  act(() => root.render(<CaptureController />)); set({ captureMode: true });
  touch('touchstart', fingers);
  act(() => vi.advanceTimersByTime(999)); expect(useGameStore.getState().captureMode).toBe(true);
  act(() => vi.advanceTimersByTime(1)); expect(useGameStore.getState().captureMode).toBe(false);
  const release = vi.fn(); window.addEventListener('touchend', release);
  touch('touchend', [fingers[0]]); touch('touchend', []);
  expect(release).not.toHaveBeenCalled(); expect(callWormTurn).not.toHaveBeenCalled();
  window.removeEventListener('touchend', release);
});
it('cancels the hold on movement or touch cancellation', () => {
  act(() => root.render(<CaptureController />)); set({ captureMode: true });
  touch('touchstart', fingers); touch('touchmove', [{ ...fingers[0], clientX: 70 }, fingers[1]]);
  act(() => vi.advanceTimersByTime(1200)); expect(useGameStore.getState().captureMode).toBe(true);
  touch('touchend', []); touch('touchstart', fingers); touch('touchcancel', []);
  act(() => vi.advanceTimersByTime(1200)); expect(useGameStore.getState().captureMode).toBe(true);
});
it('uses a short two-finger tap for one worm signature without exiting', () => {
  act(() => root.render(<CaptureController />)); set({ captureMode: true, wormHealerMode: true });
  touch('touchstart', fingers); touch('touchend', [fingers[0]]); touch('touchend', []);
  expect(callWormTurn).toHaveBeenCalledExactlyOnceWith('signature');
  expect(useGameStore.getState().captureMode).toBe(true);
});
it('supports the standalone viewer and resets capture on return to main menu', () => {
  set({ showMainMenu: true }); act(() => root.render(<CapturePanel viewer />));
  act(() => host.querySelector('button').click()); expect(useGameStore.getState().captureMode).toBe(true);
  act(() => useGameStore.getState().setShowMainMenu(true)); expect(useGameStore.getState().captureMode).toBe(false);
});
it('does not start capture over an unread worm briefing', () => {
  set({ wormHealerMode: true, wormStoryLevel: 1, wormStoryStarted: false });
  act(() => root.render(<CapturePanel />)); expect(host.querySelector('button').disabled).toBe(true);
});
