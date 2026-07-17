import { describe, it, expect, beforeEach, vi } from 'vitest';
import { awardDemoCoinsOnce, DEMO_REWARD_CLAIMED_KEY } from '../hooks/useDemoMode.js';
import { PRE_DEMO_SETTINGS_KEY } from '../hooks/useGameStore.js';

const SETTINGS_STORAGE_KEY = 'worm3_settings';

describe('demo coin award is one-time', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('awards coins on the first call and sets the claimed flag', () => {
    const store = { earnCoins: vi.fn() };
    awardDemoCoinsOnce(store, 50);
    expect(store.earnCoins).toHaveBeenCalledWith(50);
    expect(localStorage.getItem(DEMO_REWARD_CLAIMED_KEY)).toBe('1');
  });

  it('never awards again once claimed — replaying the demo is not a coin faucet', () => {
    const store = { earnCoins: vi.fn() };
    awardDemoCoinsOnce(store, 200);
    awardDemoCoinsOnce(store, 200);
    awardDemoCoinsOnce(store, 50);
    expect(store.earnCoins).toHaveBeenCalledTimes(1);
  });

  it('respects a flag claimed in a previous session', () => {
    localStorage.setItem(DEMO_REWARD_CLAIMED_KEY, '1');
    const store = { earnCoins: vi.fn() };
    awardDemoCoinsOnce(store, 200);
    expect(store.earnCoins).not.toHaveBeenCalled();
  });
});

describe('interrupted-demo settings recovery on boot', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('restores the pre-demo snapshot over persisted demo settings', async () => {
    // Simulate a refresh mid-demo: demo settings were persisted, snapshot present.
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ colorScheme: 'pastel', backgroundTheme: 'desert' })
    );
    localStorage.setItem(
      PRE_DEMO_SETTINGS_KEY,
      JSON.stringify({ colorScheme: 'standard', backgroundTheme: 'space' })
    );

    const { useGameStore } = await import('../hooks/useGameStore.js');
    const settings = useGameStore.getState().settings;
    expect(settings.colorScheme).toBe('standard');
    expect(settings.backgroundTheme).toBe('space');
    // The snapshot is consumed and re-persisted as the canonical settings.
    expect(localStorage.getItem(PRE_DEMO_SETTINGS_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)).colorScheme).toBe('standard');
  });

  it('leaves settings untouched when no snapshot exists (normal boot)', async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ colorScheme: 'standard', backgroundTheme: 'space' })
    );

    const { useGameStore } = await import('../hooks/useGameStore.js');
    expect(useGameStore.getState().settings.backgroundTheme).toBe('space');
    expect(localStorage.getItem(PRE_DEMO_SETTINGS_KEY)).toBeNull();
  });
});
