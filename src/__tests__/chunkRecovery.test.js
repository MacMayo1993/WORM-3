import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RELOAD_KEY, CHUNK_RELOAD_RESET_MS, MAX_CHUNK_RELOADS, installChunkRecovery, isChunkLoadError, isRecovering,
  recoverFromStaleChunk, resetChunkRecovery
} from '../utils/chunkRecovery.js';

// A window with just what recovery touches: an event target, a fetch, a clock and
// a session storage we can break.
function makeWindow({ fetch = vi.fn(() => Promise.resolve()), store = new Map(), storageBroken = false } = {}) {
  const target = new EventTarget();
  const storage = {
    getItem: key => { if (storageBroken) throw new Error('denied'); return store.has(key) ? store.get(key) : null; },
    setItem: (key, value) => { if (storageBroken) throw new Error('denied'); store.set(key, String(value)); },
    removeItem: key => { store.delete(key); }
  };
  return {
    win: Object.assign(target, {
      fetch, location: { href: 'https://example.test/WORM-3/' }, sessionStorage: storage,
      setTimeout: (...args) => setTimeout(...args), clearTimeout: id => clearTimeout(id)
    }),
    store, fetch
  };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => resetChunkRecovery({ win: makeWindow().win }));
afterEach(() => vi.useRealTimers());

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x.test/assets/Foo-abc.js',   // Chrome, Edge
    'error loading dynamically imported module: https://x.test/assets/Foo-abc.js',    // Firefox
    'Importing a module script failed.',                                              // Safari
    'Unable to preload CSS for /assets/Foo-abc.css',                                  // Vite
    'Loading chunk 12 failed.'                                                        // webpack-style
  ])('recognises %s', message => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
    expect(isChunkLoadError(message)).toBe(true);
  });

  it.each([new Error('mesh.dispose is not a function'), 'Cannot read properties of undefined', null, undefined, {}])(
    'ignores %s', error => expect(isChunkLoadError(error)).toBe(false));
});

describe('recoverFromStaleChunk', () => {
  it('refetches index.html past the HTTP cache, then reloads', async () => {
    const { win, fetch } = makeWindow();
    const reload = vi.fn();
    expect(recoverFromStaleChunk({ win, reload })).toBe(true);
    await flush();
    expect(fetch).toHaveBeenCalledWith('https://example.test/WORM-3/', { cache: 'reload' });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the refetch fails (offline: the service worker may hold a good shell)', async () => {
    const { win } = makeWindow({ fetch: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });
    const reload = vi.fn();
    recoverFromStaleChunk({ win, reload });
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('is idempotent within a page: the preload event and React\'s error spend one attempt, not two', async () => {
    const { win, store } = makeWindow();
    const reload = vi.fn();
    expect(recoverFromStaleChunk({ win, reload })).toBe(true);
    expect(isRecovering()).toBe(true);
    expect(recoverFromStaleChunk({ win, reload })).toBe(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(CHUNK_RELOAD_KEY)).toBe('1');
  });

  it('stops after the cap, across reloads of the same tab, so a stale CDN cannot loop it', async () => {
    const { win, store } = makeWindow();
    const reload = vi.fn();
    for (let load = 1; load <= MAX_CHUNK_RELOADS; load++) {
      resetPageLife();                                   // the tab reloads: fresh module state, same sessionStorage
      expect(recoverFromStaleChunk({ win, reload })).toBe(true);
      await flush();
    }
    expect(reload).toHaveBeenCalledTimes(MAX_CHUNK_RELOADS);
    resetPageLife();
    expect(recoverFromStaleChunk({ win, reload })).toBe(false);
    await flush();
    expect(reload).toHaveBeenCalledTimes(MAX_CHUNK_RELOADS);
    expect(store.get(CHUNK_RELOAD_KEY)).toBe(String(MAX_CHUNK_RELOADS));

    // The module-level "already reloading" flag is per page life; a real reload clears it.
    function resetPageLife() { resetChunkRecovery({ win, storage: { removeItem() {} } }); }
  });

  it('refuses to reload when it cannot count attempts (private mode), because it could not promise to stop', async () => {
    const { win, fetch } = makeWindow({ storageBroken: true });
    const reload = vi.fn();
    expect(recoverFromStaleChunk({ win, reload })).toBe(false);
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('installChunkRecovery', () => {
  it('reloads on Vite\'s preload error and not before', async () => {
    const { win, fetch } = makeWindow();
    const reload = vi.fn();
    const uninstall = installChunkRecovery({ win, reload });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('vite:preloadError'));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    uninstall();
  });

  it('forgets its attempts once the page has survived long enough to be consistent', () => {
    vi.useFakeTimers();
    const { win, store } = makeWindow();
    store.set(CHUNK_RELOAD_KEY, '2');
    installChunkRecovery({ win, reload: vi.fn() });
    vi.advanceTimersByTime(CHUNK_RELOAD_RESET_MS - 1);
    expect(store.get(CHUNK_RELOAD_KEY)).toBe('2');
    vi.advanceTimersByTime(1);
    expect(store.has(CHUNK_RELOAD_KEY)).toBe(false);
  });

  it('stops listening and cancels the timer when uninstalled', async () => {
    vi.useFakeTimers();
    const { win, store } = makeWindow();
    store.set(CHUNK_RELOAD_KEY, '1');
    const reload = vi.fn();
    installChunkRecovery({ win, reload })();
    win.dispatchEvent(new Event('vite:preloadError'));
    vi.advanceTimersByTime(CHUNK_RELOAD_RESET_MS);
    expect(reload).not.toHaveBeenCalled();
    expect(store.get(CHUNK_RELOAD_KEY)).toBe('1');
  });
});
