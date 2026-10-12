import { describe, it, expect } from 'vitest';
import {
  MODE_UNLOCK_LEVELS, resolveModeGate, isModeUnlocked, levelsUntilModeUnlock, modeLockText, modesUnlockedBetween
} from '../progression/modeUnlocks.js';
import { completeStoryChanges } from '../worm/story/rewards.js';

const cleared = n => ({ wormStory: { stars: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 1])) } });

describe('resolveModeGate', () => {
  it('starts a brand-new save as new and a returning player as open', () => {
    expect(resolveModeGate(null)).toBe('new');
    expect(resolveModeGate(null, { introSeen: true })).toBe('open');
  });
  it('keeps a stored gate and ignores junk', () => {
    expect(resolveModeGate('gated', { introSeen: true })).toBe('gated');
    expect(resolveModeGate('bogus')).toBe('new');
  });
  it('opens everything on the unlock-all builds', () => {
    expect(resolveModeGate('gated', { unlockAll: true })).toBe('open');
  });
});

describe('isModeUnlocked', () => {
  it('always opens WORM and opens the rest by WORM levels cleared', () => {
    expect(isModeUnlocked('worm', { progress: cleared(0) })).toBe(true);
    expect(isModeUnlocked('store', { progress: cleared(0) })).toBe(false);
    expect(isModeUnlocked('store', { progress: cleared(1) })).toBe(true);
    for (const [id, need] of Object.entries(MODE_UNLOCK_LEVELS)) {
      if (!need) continue;
      expect(isModeUnlocked(id, { progress: cleared(need - 1) })).toBe(false);
      expect(isModeUnlocked(id, { progress: cleared(need) })).toBe(true);
    }
  });
  it('never re-locks a mode the player has already launched, or an open save', () => {
    expect(isModeUnlocked('chaos', { progress: cleared(0), plays: { chaos: { plays: 1 } } })).toBe(true);
    expect(isModeUnlocked('cube', { progress: cleared(0), gate: 'open' })).toBe(true);
  });
});

describe('lock copy', () => {
  it('counts the levels left', () => {
    expect(levelsUntilModeUnlock('freeplay', cleared(1))).toBe(2);
    expect(modeLockText('freeplay', cleared(1))).toBe('Clear 2 more WORM levels');
    expect(modeLockText('freeplay', cleared(2))).toBe('Clear 1 more WORM level');
  });
});

describe('modesUnlockedBetween', () => {
  it('names the modes a clear just opened', () => {
    expect(modesUnlockedBetween(cleared(0), cleared(1))).toEqual(['store']);
    expect(modesUnlockedBetween(cleared(2), cleared(3))).toEqual(['freeplay']);
    expect(modesUnlockedBetween(cleared(3), cleared(4))).toEqual([]);
    expect(modesUnlockedBetween(cleared(0), cleared(1), 'open')).toEqual([]);
  });
});

describe('completeStoryChanges', () => {
  const base = {
    wormStoryLevel: 1, wormHealerMode: true, demoMode: false, wormAlive: true, wormPaused: false, wormStoryStarted: true,
    wormStoryResult: null, wormRunId: 7, wormGamePhase: 'active', playerProgress: cleared(0), ownedItems: ['character_classic'],
    parityPoints: 0, wormCharacter: 'classic', xpRun: null
  };
  const win = {
    alive: true, elapsed: 30, orbs: 99, colors: 6, rotations: 99, landed: true, uniqueTunnels: 99, tailClear: true,
    bodyJumps: 99, bodyLength: 99, rotationSettled: true, healSettled: true, healed: 99, remaining: 0
  };
  it('reports the Store opening on a gated save’s first clear', () => {
    const result = completeStoryChanges({ ...base, modeGate: 'gated' }, 7, win).wormStoryResult;
    expect(result).toBeTruthy();
    expect(result.unlockedModes).toEqual(['store']);
  });
  it('says nothing for an open save', () => {
    const result = completeStoryChanges({ ...base, modeGate: 'open' }, 7, win).wormStoryResult;
    expect(result).toBeTruthy();
    expect(result.unlockedModes).toBeUndefined();
  });
});
