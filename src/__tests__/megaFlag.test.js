import { describe, it, expect } from 'vitest';
import { resolveMegaWorm, MEGA_WORM_KEY } from '../utils/megaFlag.js';

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

describe('resolveMegaWorm', () => {
  it('is off by default', () => {
    expect(resolveMegaWorm('', makeStorage())).toBe(false);
    expect(resolveMegaWorm('?foo=1', makeStorage())).toBe(false);
    // The unlock-all flag is a separate switch — it must not open Mega Worm.
    expect(resolveMegaWorm('?unlockall=1', makeStorage())).toBe(false);
  });

  it('enables and remembers the choice when the flag is set', () => {
    const storage = makeStorage();
    expect(resolveMegaWorm('?megaworm=1', storage)).toBe(true);
    expect(storage.getItem(MEGA_WORM_KEY)).toBe('1');
    expect(resolveMegaWorm('', storage)).toBe(true);
  });

  it('turns back off and forgets, so the standard tiers are testable again', () => {
    const storage = makeStorage({ [MEGA_WORM_KEY]: '1' });
    expect(resolveMegaWorm('?megaworm=0', storage)).toBe(false);
    expect(storage.getItem(MEGA_WORM_KEY)).toBe(null);
    expect(resolveMegaWorm('', storage)).toBe(false);
  });

  it('treats other falsey spellings as off', () => {
    for (const raw of ['0', 'false', 'off']) {
      expect(resolveMegaWorm(`?megaworm=${raw}`, makeStorage()), raw).toBe(false);
    }
  });

  it('treats a bare or truthy flag as on', () => {
    for (const search of ['?megaworm=1', '?megaworm=true', '?megaworm=yes', '?megaworm=']) {
      expect(resolveMegaWorm(search, makeStorage()), search).toBe(true);
    }
  });

  it('survives storage being unavailable', () => {
    const hostile = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(resolveMegaWorm('?megaworm=1', hostile)).toBe(true);
    expect(resolveMegaWorm('', hostile)).toBe(false);
    expect(resolveMegaWorm('', null)).toBe(false);
  });
});
