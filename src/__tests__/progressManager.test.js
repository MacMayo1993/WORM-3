import { describe, it, expect } from 'vitest';
import { progressManager, ProgressManager } from '../levels/ProgressManager.js';

describe('progressManager singleton', () => {
  it('has testMode disabled — levels are not all unlocked by default', () => {
    // testMode: true bypasses all progression and unlocks every level unconditionally.
    // This must be false in production or the entire progression system is bypassed.
    expect(progressManager.testMode).toBe(false);
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
});
