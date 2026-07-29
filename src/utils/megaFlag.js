// Opt-in flag for the experimental Mega Worm tier (15×15×15 with parallel
// slice rotations).
//
// Mega Worm is a separate performance tier, not another notch on the 2–7 size
// slider: it needs its own renderer budget and its own capability story before
// it can be offered to everyone. Until that lands it stays behind a flag.
//
// Visiting the site with `?megaworm=1` reveals the 15×15 tier in the Worm setup
// wizard; `?megaworm=0` hides it again. The choice is remembered per browser so
// the flag is only needed once — the same contract `testUnlock.js` uses for
// `?unlockall=1`, and for the same reason: a phone has no console to paste into.
//
// Nothing here is shared between players: it is a localStorage entry on one
// device, and it only controls what the UI offers. The 15×15 construction path
// itself is guarded separately in cubeState.js, so a flipped flag can never put
// an unsupported size into a standard mode.

export const MEGA_WORM_KEY = 'worm3_mega_worm';

/**
 * Resolve the Mega Worm state from a query string plus persisted storage,
 * applying the flag to storage when one is present. Pure apart from the storage
 * it is handed, so it can be tested without a browser.
 *
 * @param {string} search - location.search, e.g. '?megaworm=1'
 * @param {Storage|null} storage - localStorage, or a stand-in
 * @returns {boolean} whether the Mega Worm tier should be offered
 */
export function resolveMegaWorm(search, storage) {
  let raw = null;
  try {
    raw = new URLSearchParams(search || '').get('megaworm');
  } catch {
    raw = null;
  }

  if (raw !== null) {
    // An explicit flag wins and is remembered, so a bookmark without the query
    // string keeps working afterwards.
    const on = raw !== '0' && raw !== 'false' && raw !== 'off';
    try {
      if (on) storage?.setItem(MEGA_WORM_KEY, '1');
      else storage?.removeItem(MEGA_WORM_KEY);
    } catch { /* private mode / storage disabled — fall through to the value */ }
    return on;
  }

  try {
    return storage?.getItem(MEGA_WORM_KEY) === '1';
  } catch {
    return false;
  }
}

// Resolved once at module load: the flag cannot change without a navigation,
// and every consumer (wizard tier, perf HUD) must agree on it for the session.
export const MEGA_WORM_ENABLED = typeof window === 'undefined'
  ? false
  : resolveMegaWorm(window.location?.search, window.localStorage);
