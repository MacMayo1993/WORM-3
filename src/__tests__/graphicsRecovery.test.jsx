import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GraphicsRecovery, { GraphicsContextMonitor } from '../3d/GraphicsRecovery.jsx';
import CaptureController from '../components/capture/CaptureController.jsx';
import { useGameStore } from '../hooks/useGameStore.js';

const renderer = vi.hoisted(() => ({ gl: null }));
vi.mock('@react-three/fiber', () => ({ useThree: selector => selector(renderer) }));
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); host.className = 'full-screen'; document.body.append(host);
  root = createRoot(host);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  act(() => useGameStore.getState().setCaptureMode(false));
  vi.restoreAllMocks(); vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text);
const click = text => act(() => button(text).click());
const Broken = () => { throw new Error('No WebGL'); };

it('does not invent a graphics failure while a healthy scene loads slowly', () => {
  vi.useFakeTimers(); const fail = vi.fn();
  act(() => root.render(<GraphicsRecovery onFailure={fail}>{() => <canvas>Static browser fallback</canvas>}</GraphicsRecovery>));
  act(() => vi.advanceTimersByTime(120000));
  expect(fail).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
});

it('bounds retries, focuses the modal, and allows a menu without remounting a broken renderer', () => {
  vi.useFakeTimers(); const fail = vi.fn(), menu = vi.fn();
  act(() => root.render(<GraphicsRecovery isMenu onFailure={fail} onMenu={menu}>{() => <Broken />}</GraphicsRecovery>));
  expect(document.activeElement).toBe(button('Retry graphics'));
  expect(host.hasAttribute('inert')).toBe(true);
  act(() => vi.advanceTimersByTime(120000));
  expect(fail).toHaveBeenCalledTimes(1);
  click('Retry graphics'); click('Retry graphics');
  expect(fail).toHaveBeenCalledTimes(3);
  expect(button('Retry graphics')).toBeUndefined();
  expect(button('Reload game')).toBeDefined();
  click('Return to menu');
  expect(menu).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(host.hasAttribute('inert')).toBe(false);
  expect(document.querySelector('[data-graphics-recovery="banner"]')).not.toBeNull();
  expect(fail).toHaveBeenCalledTimes(3);
});

it('handles context loss and removes the listener on unmount', () => {
  const canvas = document.createElement('canvas'), failure = vi.fn();
  renderer.gl = { domElement: canvas, getContext: () => ({ isContextLost: () => false }) };
  act(() => root.render(<GraphicsContextMonitor onFailure={failure} />));
  const event = new Event('webglcontextlost', { cancelable: true });
  act(() => canvas.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true); expect(failure).toHaveBeenCalledTimes(1);
  act(() => root.render(null));
  canvas.dispatchEvent(new Event('webglcontextlost'));
  expect(failure).toHaveBeenCalledTimes(1);
});

it('owns Tab and Escape before capture shortcuts, and isolates touch and keys from gameplay', () => {
  act(() => useGameStore.getState().setCaptureMode(true));
  act(() => root.render(<><CaptureController /><GraphicsRecovery onMenu={() => {}}>{() => <Broken />}</GraphicsRecovery></>));
  const downstream = vi.fn(); window.addEventListener('keydown', downstream);
  const key = (type, value, shiftKey = false) => act(() => document.activeElement.dispatchEvent(new KeyboardEvent(type, { key: value, shiftKey, bubbles: true, cancelable: true })));
  key('keydown', 'Tab'); key('keyup', 'Tab');
  expect(document.activeElement).toBe(button('Return to menu'));
  key('keydown', 'Tab'); expect(document.activeElement).toBe(button('Retry graphics'));
  key('keydown', 'Tab', true); expect(document.activeElement).toBe(button('Return to menu'));
  key('keydown', 'Escape'); key('keydown', 'q');
  expect(downstream).not.toHaveBeenCalled();
  expect(useGameStore.getState().captureMode).toBe(true);
  const touch = vi.fn(); window.addEventListener('touchstart', touch);
  act(() => button('Return to menu').dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true })));
  expect(touch).not.toHaveBeenCalled();
  window.removeEventListener('touchstart', touch); window.removeEventListener('keydown', downstream);
});

it('does not let an already armed capture gesture timer escape the recovery dialog', () => {
  vi.useFakeTimers();
  act(() => useGameStore.getState().setCaptureMode(true));
  const view = broken => <><CaptureController /><GraphicsRecovery onMenu={() => {}}>{() => broken ? <Broken /> : <canvas />}</GraphicsRecovery></>;
  act(() => root.render(view(false)));
  const touch = new Event('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(touch, 'touches', { value: [{ identifier: 1, clientX: 20, clientY: 20 }, { identifier: 2, clientX: 40, clientY: 20 }] });
  act(() => window.dispatchEvent(touch));
  act(() => root.render(view(true)));
  act(() => vi.advanceTimersByTime(1500));
  expect(useGameStore.getState().captureMode).toBe(true);
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
});

it('a successful retry remounts healthy content and releases input isolation', () => {
  let broken = true;
  const retried = vi.fn(() => { broken = false; });
  act(() => root.render(<GraphicsRecovery onRetry={retried} onMenu={() => {}}>{() => broken ? <Broken /> : <canvas data-testid="healthy" />}</GraphicsRecovery>));
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  click('Retry graphics');
  expect(retried).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-testid="healthy"]')).not.toBeNull();
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(host.hasAttribute('inert')).toBe(false);
});

it('detects a context already lost before the monitor mounted', () => {
  const failure = vi.fn();
  renderer.gl = { domElement: document.createElement('canvas'), getContext: () => ({ isContextLost: () => true }) };
  act(() => root.render(<GraphicsContextMonitor onFailure={failure} />));
  expect(failure).toHaveBeenCalledTimes(1);
});

it('catches non-bubbling context loss before scene children can commit', () => {
  const failure = vi.fn();
  const pending = new Promise(() => {});
  const SuspendedScene = () => { throw pending; };
  act(() => root.render(<GraphicsRecovery onFailure={failure} onMenu={() => {}}>{() => <><canvas /><React.Suspense fallback={null}><SuspendedScene /></React.Suspense></>}</GraphicsRecovery>));
  const event = new Event('webglcontextlost', { cancelable: true });
  act(() => host.querySelector('canvas').dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(failure).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
});
