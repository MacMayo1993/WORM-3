// The fx budget is the one place that decides what a board of a given size may
// spend. Worm mode is ~20 subsystems with their own frame loops; the reason this
// file exists is that each of them used to answer "is this a big cube?" on its
// own, or not at all.

import { describe, it, expect } from 'vitest';
import { fxBudget, isBigBoard, MEGA_SIZE } from '../worm/healerWorm/fxBudget.js';

describe('fx budget', () => {
  it('leaves the ordinary size ladder on the full budget', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) {
      const b = fxBudget(size);
      expect(b.tier).toBe('full');
      expect(b.warning).toBe('full');
      expect(b.orbDetail).toBe('full');
      expect(b.trailHz).toBe(60);
      expect(isBigBoard(size)).toBe(false);
    }
  });

  it('puts Mega on the reduced budget', () => {
    const b = fxBudget(MEGA_SIZE);
    expect(isBigBoard(MEGA_SIZE)).toBe(true);
    expect(b.warning).toBe('lite');
    expect(b.orbDetail).toBe('reduced');
    expect(b.trailHz).toBeLessThan(60);
    expect(b.trailDaubCap).toBeLessThan(fxBudget(3).trailDaubCap);
    expect(b.trailGlowCap).toBeLessThanOrEqual(fxBudget(3).trailGlowCap);
  });

  it('catches a board between the two ladders on the cheap side', () => {
    // Nothing sits between 7 and 15 today. A future 9×9 should land on the
    // reduced budget by default rather than by someone remembering to add it.
    expect(fxBudget(9).tier).toBe('big');
    expect(fxBudget(11).warning).toBe('lite');
  });

  it('hands back one shared object per tier rather than a fresh one per call', () => {
    // Read every frame by the trail; allocating a budget per frame would be the
    // kind of thing this file exists to prevent.
    expect(fxBudget(3)).toBe(fxBudget(4));
    expect(fxBudget(15)).toBe(fxBudget(15));
  });
});
