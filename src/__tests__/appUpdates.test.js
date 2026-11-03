import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UPDATE_CHECK_MS, installAppUpdates, showUpdateToast, watchForAppUpdates } from '../utils/appUpdates.js';

let cleanup;
const toast = () => document.getElementById('worm3-update-toast');
const setVisibility = value => Object.defineProperty(document, 'visibilityState', { configurable: true, value });
const setOnline = value => Object.defineProperty(navigator, 'onLine', { configurable: true, value });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible'); setOnline(true);
});
afterEach(() => {
  cleanup?.(); cleanup = null;
  toast()?.remove();
  vi.useRealTimers(); vi.restoreAllMocks();
  delete document.visibilityState; delete document.readyState; delete navigator.onLine;
});

it('checks on registration, periodically while open, and after returning to the game', async () => {
  const registration = { update: vi.fn().mockResolvedValue(), waiting: null };
  cleanup = watchForAppUpdates(registration, vi.fn());
  await flush();
  expect(registration.update).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
  expect(registration.update).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(10001);
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pageshow'));
  await flush();
  expect(registration.update).toHaveBeenCalledTimes(3);
});

it('skips hidden and offline checks, then checks when visible and back online', async () => {
  setVisibility('hidden');
  const registration = { update: vi.fn().mockResolvedValue(), waiting: null };
  cleanup = watchForAppUpdates(registration, vi.fn());
  await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
  expect(registration.update).not.toHaveBeenCalled();
  setVisibility('visible'); setOnline(false);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(registration.update).not.toHaveBeenCalled();
  setOnline(true); window.dispatchEvent(new Event('online'));
  await flush();
  expect(registration.update).toHaveBeenCalledTimes(1);
});

it('shows an already downloaded update offline and brings a dismissed prompt back on resume', () => {
  setOnline(false);
  const refresh = vi.fn();
  const registration = { update: vi.fn(), waiting: {} };
  cleanup = watchForAppUpdates(registration, () => showUpdateToast(refresh));
  expect(toast().textContent).toContain('Refresh game');
  toast().querySelector('[aria-label="Dismiss update"]').click();
  expect(toast()).toBeNull();
  window.dispatchEvent(new Event('focus'));
  expect(toast()).not.toBeNull();
  expect(registration.update).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

it('offers the update discovered by a check and retries a failed network check later', async () => {
  const notify = vi.fn();
  const registration = { update: vi.fn().mockRejectedValueOnce(new Error('offline')), waiting: null };
  cleanup = watchForAppUpdates(registration, notify);
  await flush();
  expect(notify).not.toHaveBeenCalled();
  registration.update.mockImplementation(() => { registration.waiting = {}; return Promise.resolve(); });
  await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
  expect(notify).toHaveBeenCalledTimes(1);
});

it('never overlaps checks or notifies after the watcher is disposed', async () => {
  let finish;
  const notify = vi.fn();
  const registration = { update: vi.fn(() => new Promise(resolve => { finish = resolve; })), waiting: null };
  cleanup = watchForAppUpdates(registration, notify);
  await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
  expect(registration.update).toHaveBeenCalledTimes(1);
  cleanup(); registration.waiting = {}; finish(); await flush();
  window.dispatchEvent(new Event('focus'));
  await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
  expect(notify).not.toHaveBeenCalled();
  expect(registration.update).toHaveBeenCalledTimes(1);
});

it('shows only one prompt, applies only on click, and allows retry after an apply error', async () => {
  const refresh = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue();
  showUpdateToast(refresh); showUpdateToast(refresh);
  expect(document.querySelectorAll('#worm3-update-toast')).toHaveLength(1);
  const button = toast().querySelector('button');
  expect(refresh).not.toHaveBeenCalled();
  button.click(); await flush();
  expect(button.disabled).toBe(false);
  expect(toast().textContent).toContain('Try again');
  button.click(); await flush();
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(button.disabled).toBe(true);
});

function registrationHarness() {
  const win = new EventTarget();
  Object.assign(win, {
    requestIdleCallback: vi.fn(), cancelIdleCallback: vi.fn(),
    location: { reload: vi.fn() }, navigator,
    setInterval, clearInterval, setTimeout, clearTimeout,
  });
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  const update = vi.fn().mockResolvedValue();
  const register = vi.fn(() => update);
  cleanup = installAppUpdates(register, win);
  const [start, options] = win.requestIdleCallback.mock.calls[0];
  expect(options.timeout).toBe(2000);
  expect(register).not.toHaveBeenCalled();
  start();
  return { win, update, register, callbacks: register.mock.calls[0][0] };
}

it('bounds the idle delay and reloads exactly once after an accepted update activates', async () => {
  const { win, update, callbacks } = registrationHarness();
  callbacks.onNeedRefresh();
  expect(update).not.toHaveBeenCalled();
  toast().querySelector('button').click(); await flush();
  expect(update).toHaveBeenCalledWith(true);
  expect(win.location.reload).not.toHaveBeenCalled();
  callbacks.onNeedReload(); callbacks.onNeedReload();
  expect(win.location.reload).toHaveBeenCalledTimes(1);
});

it('does not interrupt a run when another tab activates the new worker', () => {
  const { win, update, callbacks } = registrationHarness();
  callbacks.onNeedReload();
  expect(win.location.reload).not.toHaveBeenCalled();
  expect(toast()).not.toBeNull();
  toast().querySelector('button').click();
  expect(win.location.reload).toHaveBeenCalledTimes(1);
  expect(update).not.toHaveBeenCalled();
});

it('connects registration to the watcher and cancels all checks on disposal', async () => {
  const { win, callbacks } = registrationHarness();
  const registration = { update: vi.fn().mockResolvedValue(), waiting: null };
  callbacks.onRegisteredSW('/WORM-3/sw.js', registration);
  await flush();
  expect(registration.update).toHaveBeenCalledTimes(1);
  cleanup();
  await vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS);
  win.dispatchEvent(new Event('focus')); callbacks.onNeedRefresh();
  expect(registration.update).toHaveBeenCalledTimes(1);
  expect(toast()).toBeNull();
});

it('registers after load without requestIdleCallback and cancels a pending startup', async () => {
  const win = new EventTarget();
  Object.assign(win, { setTimeout, clearTimeout });
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
  const register = vi.fn();
  cleanup = installAppUpdates(register, win);
  await vi.advanceTimersByTimeAsync(200);
  expect(register).not.toHaveBeenCalled();
  win.dispatchEvent(new Event('load'));
  await vi.advanceTimersByTimeAsync(200);
  expect(register).toHaveBeenCalledTimes(1);
  cleanup();
  cleanup = installAppUpdates(register, win);
  win.dispatchEvent(new Event('load')); cleanup();
  await vi.advanceTimersByTimeAsync(200);
  expect(register).toHaveBeenCalledTimes(1);
});
