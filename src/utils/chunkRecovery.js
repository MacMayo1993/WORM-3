// After a GitHub Pages deploy the hashed chunk filenames change and the old ones
// are deleted, so a tab that was loaded before the deploy (or a first visit that
// straddles it) fails its next lazy import: "Failed to fetch dynamically
// imported module". The cure is one fresh load of index.html.
//
// Two things report the failure: Vite's `vite:preloadError` event (a preload
// link or dependency 404ed) and the import() rejection itself, which React.lazy
// rethrows during render. Both land here, so recovery is idempotent: the first
// signal spends one attempt and starts the reload, later signals in the same
// page life just say "already on it". Attempts are capped per tab: right after a
// deploy the Pages CDN can keep serving the stale index.html for several
// minutes, and an unguarded reload would spin for ever. When the cap is spent the
// original error surfaces, and the root error boundary turns it into a screen
// the player can act on instead of a blank page.

export const CHUNK_RELOAD_KEY = 'worm3_chunk_reload';
export const MAX_CHUNK_RELOADS = 2;
// The page survived this long, so its chunks are consistent: a later deploy may reload again.
export const CHUNK_RELOAD_RESET_MS = 30000;

// What each engine calls a failed dynamic import or stylesheet preload.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk [\w-]+ failed/i;

export const isChunkLoadError = error => CHUNK_ERROR.test(String(error?.message ?? error ?? ''));

let reloading = false;

/** True while a recovery reload has been started in this page. */
export const isRecovering = () => reloading;

/**
 * Spend one reload attempt on a stale-chunk failure.
 * @returns {boolean} true when a reload is under way (this call started it, or an earlier one did).
 */
export function recoverFromStaleChunk({ win = window, storage = win.sessionStorage, reload = () => win.location.reload() } = {}) {
  if (reloading) return true;
  let attempts;
  try {
    attempts = Number(storage.getItem(CHUNK_RELOAD_KEY) || '0');
    if (attempts >= MAX_CHUNK_RELOADS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
  } catch {
    // Without a counter there is no way to promise the reload cannot loop.
    return false;
  }
  reloading = true;
  // Re-fetch index.html bypassing the HTTP cache first: a plain reload happily
  // reuses the stale cached index that references the deleted chunks.
  Promise.resolve()
    .then(() => win.fetch(win.location.href, { cache: 'reload' }))
    .catch(() => { /* offline: reload anyway, the service worker may hold a good shell */ })
    .then(reload);
  return true;
}

/** Forget every attempt, e.g. when the player asks for a reload themselves. */
export function resetChunkRecovery({ win = window, storage = win.sessionStorage } = {}) {
  reloading = false;
  try { storage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage unavailable */ }
}

/** Listen for Vite's preload failures. Returns an uninstall function. */
export function installChunkRecovery({ win = window, ...options } = {}) {
  const onPreloadError = () => { recoverFromStaleChunk({ win, ...options }); };
  win.addEventListener('vite:preloadError', onPreloadError);
  const timer = win.setTimeout(() => resetChunkRecovery({ win, ...options }), CHUNK_RELOAD_RESET_MS);
  return () => {
    win.removeEventListener('vite:preloadError', onPreloadError);
    win.clearTimeout(timer);
  };
}
