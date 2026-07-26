import { describe, it, expect } from 'vitest';
import { resolveUnlockAll, UNLOCK_ALL_KEY } from '../utils/testUnlock.js';

// Minimal stand-in for localStorage so each case starts from a known state.
const makeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data,
  };
};

describe('resolveUnlockAll', () => {
  it('is off by default', () => {
    expect(resolveUnlockAll('', makeStorage())).toBe(false);
    expect(resolveUnlockAll('?foo=1', makeStorage())).toBe(false);
  });

  it('unlocks and remembers the choice when the flag is set', () => {
    const storage = makeStorage();
    expect(resolveUnlockAll('?unlockall=1', storage)).toBe(true);
    // Persisted, so a later visit without the query string stays unlocked —
    // otherwise the flag would have to be re-typed on every navigation.
    expect(storage.getItem(UNLOCK_ALL_KEY)).toBe('1');
    expect(resolveUnlockAll('', storage)).toBe(true);
  });

  it('turns back off and forgets, so the locked experience is testable again', () => {
    const storage = makeStorage({ [UNLOCK_ALL_KEY]: '1' });
    expect(resolveUnlockAll('?unlockall=0', storage)).toBe(false);
    expect(storage.getItem(UNLOCK_ALL_KEY)).toBe(null);
    expect(resolveUnlockAll('', storage)).toBe(false);
  });

  it('treats other falsey spellings as off', () => {
    for (const raw of ['0', 'false', 'off']) {
      expect(resolveUnlockAll(`?unlockall=${raw}`, makeStorage()), raw).toBe(false);
    }
  });

  it('treats a bare or truthy flag as on', () => {
    for (const search of ['?unlockall=1', '?unlockall=true', '?unlockall=yes', '?unlockall=']) {
      // '?unlockall=' parses to an empty string, which is not one of the
      // opt-out spellings — someone typing it clearly wants the unlock.
      expect(resolveUnlockAll(search, makeStorage()), search).toBe(true);
    }
  });

  it('survives storage being unavailable', () => {
    // Safari private mode throws on setItem rather than failing quietly; the
    // unlock should still apply for this page load instead of crashing boot.
    const hostile = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(resolveUnlockAll('?unlockall=1', hostile)).toBe(true);
    expect(resolveUnlockAll('', hostile)).toBe(false);
    expect(resolveUnlockAll('', null)).toBe(false);
  });
});
