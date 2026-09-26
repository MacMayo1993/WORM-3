import DemoWormControlHint from '../components/screens/WormDemoLessonCard.jsx';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import DemoDialog from '../components/screens/DemoDialog.jsx';
import DemoEndScreen from '../components/screens/DemoEndScreen.jsx';
import { DemoControlTour, DemoProgressBar, DemoStepHint, DemoFlipProgress, DemoCoach } from '../components/screens/DemoFlowController.jsx';
import BottomNavBar from '../components/menus/BottomNavBar.jsx';
import DisparityHUD from '../components/overlays/DisparityHUD.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { demoTimer } from '../utils/demoTimer.js';
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({ wormAlive: true, wormGamePhase: 'active', demoWormLessonIndex: 0, demoWormComplete: false, demoWormFinished: false, wormPauseMenuOpen: false, wormHealerMode: false, demoExploring: false, demoExploreComplete: false });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const render = node => act(() => root.render(node));

it('retains remaining lesson time across a pause and cancels on exit', () => {
  vi.useFakeTimers(); let paused = false; const callback = vi.fn();
  const timer = demoTimer(callback, 1000, () => paused);
  vi.advanceTimersByTime(400); paused = true; vi.advanceTimersByTime(20000);
  expect(callback).not.toHaveBeenCalled(); paused = false; vi.advanceTimersByTime(550);
  expect(callback).not.toHaveBeenCalled(); vi.advanceTimersByTime(50); expect(callback).toHaveBeenCalledTimes(1);
  timer.cancel(); const pending = demoTimer(callback, 1000, () => false); pending.cancel(); vi.advanceTimersByTime(2000);
  expect(callback).toHaveBeenCalledTimes(1);
});
it('positions the Flip pointer at the measured button center, not a slot estimate', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.dataset.demoControl === 'flip') return { left: 110, width: 80 };
    return { left: 20, width: 320 };
  });
  render(<><BottomNavBar spotlightTile="flip" /><DemoControlTour index={2} /></>);
  expect(host.querySelector('.demo-tour-card').style.getPropertyValue('--tour-pointer')).toBe('130px');
});
it('makes background inert and restores it across overlapping dialog transitions', () => {
  render(<><button id="behind">Game</button><DemoDialog aria-label="First"><button>Continue</button></DemoDialog></>);
  expect(host.querySelector('#behind').hasAttribute('inert')).toBe(true);
  render(<><button id="behind">Game</button><DemoDialog aria-label="First"><button>Continue</button></DemoDialog><DemoDialog aria-label="Second"><button>Done</button></DemoDialog></>);
  expect(host.querySelector('[aria-label="Second"]').hasAttribute('inert')).toBe(false);
  expect(host.querySelector('[aria-label="First"]').hasAttribute('inert')).toBe(true);
  render(<button id="behind">Game</button>);
  expect(host.querySelector('#behind').hasAttribute('inert')).toBe(false);
});
it('traps focus in the dialog and gives Escape one close action', () => {
  const close = vi.fn(); render(<DemoDialog onClose={close}><button>First</button><button>Last</button></DemoDialog>);
  const buttons = [...host.querySelectorAll('button')]; buttons.forEach(button => Object.defineProperty(button, 'offsetParent', {get: () => host}));
  buttons[1].focus(); act(() => buttons[1].dispatchEvent(new KeyboardEvent('keydown', {key:'Tab', bubbles:true, cancelable:true})));
  expect(document.activeElement).toBe(buttons[0]);
  act(() => buttons[0].dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))); expect(close).toHaveBeenCalledTimes(1);
});
it('groups the worm instruction, progress and skip into a single dock', () => {
  const skip = vi.fn(); render(<DemoWormControlHint onSkip={skip} />);
  expect(host.querySelectorAll('.worm-demo-card')).toHaveLength(1);
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'End practice').click()); expect(skip).toHaveBeenCalledTimes(1);
});
it('keeps the flip instruction and live pair counter together across the phase change', () => {
  const draw = phase => <>
    <DemoStepHint step="flip-gateway" />
    <DemoFlipProgress progress={{ phase, done: 0, total: 9 }} />
    <DemoCoach step="flip-gateway" />
  </>;
  render(draw('flip-all'));
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
  expect(host.querySelector('.demo-flip-task').textContent).toContain('Tap nine different pairs');
  render(draw('unflip-all'));
  expect(host.querySelector('.demo-flip-task').textContent).toContain('Home0 / 9');
  expect(host.querySelector('.demo-flip-task').textContent).toContain('Tap the raised tiles');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it('explains a bomb death and makes Retry the first focused action', () => {
  useGameStore.setState({wormAlive:false, wormDeathDetails:{cause:'bomb'}});
  const retry = vi.fn(); render(<DemoWormControlHint onRetry={retry} />);
  expect(host.textContent).toContain('bomb blast'); expect(document.activeElement.textContent).toBe('Try again');
  act(() => document.activeElement.click()); expect(retry).toHaveBeenCalledTimes(1);
});
it('keeps Chaos demo guidance inside match details instead of covering the HUD', () => {
  useGameStore.setState({ demoMode: true, demoStep: 'chaos-forecast' });
  render(<><DisparityHUD /><DemoStepHint step="chaos-forecast" /></>);
  expect(host.querySelector('.demo-step-hint')).toBeNull();
  expect(host.textContent).not.toContain('Will it be your pick?');
  act(() => host.querySelector('[aria-label="Inspect match"]').click());
  expect(host.querySelector('#chaos-match-details').textContent).toContain('Will it be your pick?');
});
it('finishes Explore as 7/7 and removes its already-completed invitation', () => {
  useGameStore.setState({demoExploring:true, demoExploreComplete:true});
  render(<><DemoProgressBar currentStep="end"/><DemoEndScreen /></>);
  expect(host.textContent).toContain('7 / 7'); expect(host.textContent).toContain('Explore Complete');
  expect(host.textContent).not.toContain('Keep learning');
});

it('publishes pause-menu ownership and provides a 48px pause target', () => {
  useGameStore.setState({demoMode:true, demoStep:'worm-traversal', demoWormStarted:true, wormGamePhase:'active', wormPaused:false});
  render(<WormCrawlerHUD phase="crawling" wormAlive />);
  const pause = host.querySelector('[aria-label="Pause"]');
  expect(pause.style.width).toBe('48px'); expect(pause.style.height).toBe('48px');
  act(() => pause.dispatchEvent(new Event('pointerdown', {bubbles:true})));
  expect(useGameStore.getState().wormPauseMenuOpen).toBe(true);
  expect(useGameStore.getState().wormPaused).toBe(true);
  const resume = [...host.querySelectorAll('button')].find(b => b.classList.contains('worm-pause-resume'));
  act(() => resume.click());
  expect(useGameStore.getState().wormPauseMenuOpen).toBe(false);
  expect(useGameStore.getState().wormPaused).toBe(false);
});
