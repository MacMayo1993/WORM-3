import { describe, it, expect } from 'vitest';
import { progressManager, ProgressManager } from '../levels/ProgressManager.js';

describe('progressManager singleton', () => {
  it('ties testMode to the build, never hardcoding it on', () => {
    // testMode bypasses all progression and unlocks every level unconditionally.
    // Dev/preview builds want that so the campaign can be exercised without
    // grinding; a shipped build must not have it, and Vite folds
    // import.meta.env.DEV to false at bundle time to guarantee that. Asserting
    // the link here catches the flag being pinned to a literal in either
    // direction — which would either bypass progression in production or take
    // the campaign away from dev.
    expect(progressManager.testMode).toBe(!!import.meta.env.DEV);
  });

  it('level 1 is always unlocked regardless of testMode', () => {
    expect(progressManager.isLevelUnlocked(1)).toBe(true);
  });

  it('level 2+ is locked for a fresh progress state without testMode', () => {
    const fresh = new ProgressManager({ testMode: false });
    // No completions recorded — later levels must be locked
    expect(fresh.isLevelUnlocked(2)).toBe(false);
    expect(fresh.isLevelUnlocked(10)).toBe(false);
  });

  it('unlocks next level after completing the prerequisite', () => {
    const pm = new ProgressManager({ testMode: false });
    expect(pm.isLevelUnlocked(2)).toBe(false);
    pm.completeLevel(1);
    expect(pm.isLevelUnlocked(2)).toBe(true);
  });

  it('persists earned stars from completion performance instead of treating completion as three stars', () => {
    const pm = new ProgressManager({ testMode: false, autoSave: false });
    expect(pm.completeLevel(1, { time: 999, moves: 999 }).stats.stars).toBe(1);
    expect(pm.completeLevel(1, { time: 1, moves: 1 }).stats.stars).toBe(3);
    expect(pm.loadLevelStats()[1].stars).toBe(3);
  });
});
