// Opt-in test unlock for deployed builds.
//
// Development builds already unlock the store and the campaign (see
// DEV_FREE_ECONOMY in useGameStore.js), but a GitHub Pages build is a
// production bundle, so none of that applies there and every cosmetic sits
// behind Parity Points. Visiting the site with `?unlockall=1` grants every
// store item and opens the whole campaign, which makes new content testable on
// a real device — phone included, where there is no console to paste into.
//
// The choice is remembered per browser, so the flag is only needed once;
// `?unlockall=0` clears it and puts the normal locked experience back. Nothing
// here is shared between players: it is a localStorage entry on one device.

export const UNLOCK_ALL_KEY = 'worm3_unlock_all';

/**
 * Resolve the unlock state from a query string plus persisted storage, applying
 * the flag to storage when one is present. Pure apart from the storage it is
 * handed, so it can be tested without a browser.
 *
 * @param {string} search - location.search, e.g. '?unlockall=1'
 * @param {Storage|null} storage - localStorage, or a stand-in
 * @returns {boolean} whether everything should be unlocked
 */
export function resolveUnlockAll(search, storage) {
  let raw = null;
  try {
    raw = new URLSearchParams(search || '').get('unlockall');
  } catch {
    raw = null;
  }

  if (raw !== null) {
    // An explicit flag wins and is remembered, so a bookmark without the query
    // string keeps working afterwards.
    const on = raw !== '0' && raw !== 'false' && raw !== 'off';
    try {
      if (on) storage?.setItem(UNLOCK_ALL_KEY, '1');
      else storage?.removeItem(UNLOCK_ALL_KEY);
    } catch { /* private mode / storage disabled — fall through to the value */ }
    return on;
  }

  try {
    return storage?.getItem(UNLOCK_ALL_KEY) === '1';
  } catch {
    return false;
  }
}

// Resolved once at module load: the flag cannot change without a navigation,
// and both the economy and the campaign must agree on it for the whole session.
export const UNLOCK_ALL = typeof window === 'undefined'
  ? false
  : resolveUnlockAll(window.location?.search, window.localStorage);
