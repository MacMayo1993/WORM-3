import { it, expect } from 'vitest';
import { strikeVisuals, STRIKE_CHARGE, STRIKE_HOLD, STRIKE_LIFE } from '../worm/healerWorm/strikeVisuals.js';
import { STRIKE_MIN_GAP } from '../worm/healerWorm/strikeScheduler.js';

it('charges before impact, holds the strike, then leaves time for a readable afterglow', () => {
  expect(strikeVisuals(0.2).impact).toBe(0);
  expect(strikeVisuals(0.2).branches).toBe(0);
  expect(strikeVisuals(STRIKE_CHARGE).core).toBe(1);
  expect(strikeVisuals(STRIKE_CHARGE + STRIKE_HOLD - 0.001).core).toBe(1);
  expect(strikeVisuals(0.8).branches).toBeGreaterThan(0);
  expect(strikeVisuals(STRIKE_LIFE).core).toBe(0);
  expect(strikeVisuals(STRIKE_LIFE).branches).toBe(0);
  expect(STRIKE_MIN_GAP).toBeGreaterThan(STRIKE_LIFE);
});

it('keeps every intensity bounded through the complete strike', () => {
  for (let age = 0; age < STRIKE_LIFE + 0.1; age += 1 / 120) {
    for (const intensity of Object.values(strikeVisuals(age))) {
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    }
  }
});
