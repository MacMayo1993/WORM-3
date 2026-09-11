// The per-mode play record. It is the only per-mode history the game keeps, it
// comes back out of player-writable localStorage, and the carousel renders it
// directly — so a malformed entry must not be able to put NaN on the menu.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { MODE_PLAYS_KEY } from '../hooks/storeSlices/persistedState.js';

describe('recordModePlay', () => {
  beforeEach(() => { useGameStore.setState({ modePlays: {} }); });

  it('starts a mode at one play', () => {
    useGameStore.getState().recordModePlay('worm');
    expect(useGameStore.getState().modePlays.worm.plays).toBe(1);
  });

  it('counts repeat plays of the same mode', () => {
    for (let i = 0; i < 3; i++) useGameStore.getState().recordModePlay('worm');
    expect(useGameStore.getState().modePlays.worm.plays).toBe(3);
  });

  it('keeps modes separate', () => {
    useGameStore.getState().recordModePlay('worm');
    useGameStore.getState().recordModePlay('chaos');
    useGameStore.getState().recordModePlay('chaos');
    expect(useGameStore.getState().modePlays.worm.plays).toBe(1);
    expect(useGameStore.getState().modePlays.chaos.plays).toBe(2);
  });

  it('stamps the time of the latest play', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    useGameStore.getState().recordModePlay('worm');
    const first = useGameStore.getState().modePlays.worm.lastPlayed;
    vi.setSystemTime(new Date('2026-06-16T12:00:00Z'));
    useGameStore.getState().recordModePlay('worm');
    expect(useGameStore.getState().modePlays.worm.lastPlayed).toBeGreaterThan(first);
    vi.useRealTimers();
  });

  it('ignores a call with no mode id rather than writing an undefined key', () => {
    useGameStore.getState().recordModePlay(undefined);
    useGameStore.getState().recordModePlay('');
    expect(useGameStore.getState().modePlays).toEqual({});
  });

  it('persists through the store subscription, not by an inline write', () => {
    useGameStore.getState().recordModePlay('worm');
    const stored = JSON.parse(localStorage.getItem(MODE_PLAYS_KEY));
    expect(stored.worm.plays).toBe(1);
  });
});

describe('loading a play record from storage', () => {
  const load = async (raw) => {
    localStorage.setItem(MODE_PLAYS_KEY, raw);
    vi.resetModules();
    const mod = await import('../hooks/storeSlices/persistedState.js?fresh=' + Math.random());
    return mod.persistedState.modePlays;
  };

  afterEach(() => { localStorage.removeItem(MODE_PLAYS_KEY); });

  it('reads a well-formed record', async () => {
    expect(await load(JSON.stringify({ worm: { plays: 4, lastPlayed: 1000 } })))
      .toEqual({ worm: { plays: 4, lastPlayed: 1000 } });
  });

  it('drops entries whose count is not a usable number', async () => {
    const out = await load(JSON.stringify({
      a: { plays: 'lots' }, b: { plays: NaN }, c: { plays: 0 },
      d: { plays: -3 }, e: null, good: { plays: 2, lastPlayed: 5 },
    }));
    expect(out).toEqual({ good: { plays: 2, lastPlayed: 5 } });
  });

  it('floors a fractional count and defaults a missing timestamp', async () => {
    expect(await load(JSON.stringify({ worm: { plays: 3.7 } })))
      .toEqual({ worm: { plays: 3, lastPlayed: 0 } });
  });

  it('survives malformed JSON and non-object shapes', async () => {
    expect(await load('not json at all')).toEqual({});
    expect(await load(JSON.stringify([1, 2, 3]))).toEqual({});
    expect(await load(JSON.stringify('a string'))).toEqual({});
  });
});
