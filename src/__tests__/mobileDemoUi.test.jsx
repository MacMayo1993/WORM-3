import DemoWormControlHint from '../components/screens/WormDemoLessonCard.jsx';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import DemoDialog from '../components/screens/DemoDialog.jsx';
import DemoEndScreen from '../components/screens/DemoEndScreen.jsx';
import { DemoControlTour, DemoStepIntro, DemoProgressBar, DemoStepHint, DemoFlipProgress, DemoCoach, CONTROL_TOUR_KEYS } from '../components/screens/DemoFlowController.jsx';
import DemoForecastPicker from '../components/screens/DemoForecastPicker.jsx';
import BottomNavBar from '../components/menus/BottomNavBar.jsx';
import DisparityHUD from '../components/overlays/DisparityHUD.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { demoTimer } from '../utils/demoTimer.js';
import { WORM_DEMO_LESSONS } from '../game/wormDemoLessons.js';
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({ demoSkipped: false, wormAlive: true, wormGamePhase: 'active', demoWormLessonIndex: 0, demoWormComplete: false, demoWormFinished: false, wormPauseMenuOpen: false, wormHealerMode: false });
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
  render(<><BottomNavBar spotlightTile="flip" /><DemoControlTour index={CONTROL_TOUR_KEYS.indexOf('flip')} /></>);
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
it('requires the exercise goal before Next and provides an explicit Skip Exercise', () => {
  render(<DemoWormControlHint />);
  expect(host.querySelectorAll('.worm-demo-card')).toHaveLength(1);
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Next').disabled).toBe(true);
  const skip = [...host.querySelectorAll('button')].find(b => b.textContent === 'Skip Exercise');
  expect(skip.disabled).toBe(false);
  expect(host.textContent).not.toMatch(/End practice|Finish practice/);
});
it('continues after healing and preserves Next if the player dies after reaching the goal', () => {
  useGameStore.setState({ demoWormLessonIndex: WORM_DEMO_LESSONS.findIndex(l => l.id === 'heal'), demoWormComplete: true, demoWormStarted: true });
  render(<DemoWormControlHint />);
  const next = () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Next');
  expect(next().disabled).toBe(false);
  expect(host.textContent).toContain('learn to heal by surrounding');
  expect(host.textContent).not.toContain('Finish practice');
  act(() => useGameStore.setState({ wormAlive: false }));
  expect(next().disabled).toBe(false);
  expect(host.textContent).toContain('Goal reached');
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
it('names the rule behind a self-collision or a collapsed tunnel instead of a generic line', () => {
  useGameStore.setState({wormAlive:false, wormDeathDetails:{reason:'self-collision'}});
  render(<DemoWormControlHint />);
  expect(host.textContent).toContain('your own body');
  act(() => useGameStore.setState({wormDeathDetails:{reason:'void-tunnel-exhausted'}}));
  expect(host.textContent).toContain('three rides');
});
it('points the Undo beat at the Undo key and keeps it lit only while asked for', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.dataset.demoControl === 'undo') return { left: 30, width: 60 };
    return { left: 20, width: 320 };
  });
  const undo = vi.fn();
  render(<><BottomNavBar spotlightTile="undo" canUndo onUndo={undo} /><DemoControlTour index={CONTROL_TOUR_KEYS.indexOf('undo')} /></>);
  expect(host.querySelector('.demo-tour-card').textContent).toContain('Undo');
  expect(host.querySelector('.demo-tour-card').style.getPropertyValue('--tour-pointer')).toBe('40px');
  act(() => host.querySelector('[aria-label="Undo"]').click());
  expect(undo).toHaveBeenCalledTimes(1);
});
it('states the Chaos round rules before the round, since the HUD keeps them collapsed', () => {
  render(<DemoForecastPicker onPick={() => {}} />);
  const rules = host.querySelector('[aria-label="How the round works"]').textContent;
  expect(host.textContent).toContain('first strike');
  expect(rules).toContain('twin drop out together');
  expect(rules).toContain('heal');
  expect(rules).toContain('stake');
});
it('keeps Chaos demo guidance inside match details instead of covering the HUD', () => {
  useGameStore.setState({ demoMode: true, demoStep: 'chaos-forecast' });
  render(<><DisparityHUD /><DemoStepHint step="chaos-forecast" /></>);
  expect(host.querySelector('.demo-step-hint')).toBeNull();
  expect(host.textContent).not.toContain('Will it be your pick?');
  act(() => host.querySelector('[aria-label="Inspect match"]').click());
  expect(host.querySelector('#chaos-match-details').textContent).toContain('Will it be your pick?');
});
it('finishes all eleven sections before offering free play', () => {
  render(<><DemoProgressBar currentStep="end"/><DemoEndScreen /></>);
  expect(host.textContent).toContain('11 / 11'); expect(host.textContent).toContain('Demo Complete');
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


it('keeps WORM demo controls below its gameplay HUD and remeasures after rotation', () => {
  let bottom = 72;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { bottom: this.classList.contains('worm-hud-top') ? bottom : 0 };
  });
  const skip = vi.fn(), exit = vi.fn();
  render(<><div className="worm-hud-top" /><DemoProgressBar belowWormHud currentStep="view-showcase" onSkipStep={skip} onExit={exit} /></>);
  const bar = host.querySelector('[aria-label="Demo controls"]');
  expect(bar.style.top).toBe('84px');
  bottom = 48;
  act(() => window.dispatchEvent(new Event('resize')));
  expect(bar.style.top).toBe('60px');
  const buttons = bar.querySelectorAll('button');
  act(() => buttons[0].click()); act(() => buttons[1].click());
  expect(skip).toHaveBeenCalledTimes(1); expect(exit).toHaveBeenCalledTimes(1);
  expect(bar.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('7');
});

it('keeps step progress and both navigation actions inside Mobi’s active dialog', () => {
  render(<DemoStepIntro step="chaos-forecast" onContinue={() => {}} onSkipStep={() => {}} onExit={() => {}} />);
  const dialog = host.querySelector('[role="dialog"]');
  const bar = dialog.querySelector('[aria-label="Demo controls"]');
  expect(host.querySelectorAll('[aria-label="Demo progress"]')).toHaveLength(1);
  expect(bar.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('9');
  expect([...bar.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Skip Step', 'Exit Demo']);
  expect(bar.closest('[inert]')).toBeNull();
  expect(dialog.querySelector('.mobi-footer-actions').textContent).toContain('Skip Mobi');
});

it('uses the top-bar position for cube demo progress, even inside instructions', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 72 });
  render(<><div className="top-app-bar" /><DemoProgressBar currentStep="chaos-forecast" onExit={() => {}} /></>);
  expect(host.querySelector('.demo-toolbar').style.top).toBe('');
  render(<DemoForecastPicker onPick={() => {}} onExit={() => {}} />);
  expect(host.querySelector('.demo-toolbar--inline')).toBeNull();
  expect(host.querySelector('.demo-forecast-panel').textContent).toContain('Which pair survives?');
  expect(host.querySelectorAll('[aria-label="Demo progress"]')).toHaveLength(1);
});
