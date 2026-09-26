import { it, expect } from 'vitest';
import { advancePlatformFormation, PLATFORM_FORMATION_SECONDS } from '../worm/platformFormation.js';
it.each([30, 60, 120])('takes two seconds to rise without overshoot at %i Hz', hz => {
  const spring = { lift: 0, velocity: 0 };
  let previous = 0;
  for (let i = 1; i <= hz * 2; i++) {
    advancePlatformFormation(spring, true, 1 / hz);
    expect(spring.lift).toBeGreaterThanOrEqual(previous);
    expect(spring.lift).toBeLessThanOrEqual(1);
    if (i === hz) expect(spring.lift).toBeCloseTo(.5, 8);
    previous = spring.lift;
  }
  expect(spring.lift).toBeCloseTo(1, 8);
  expect(spring.formationRemaining).toBeCloseTo(0, 8);
  expect(PLATFORM_FORMATION_SECONDS).toBe(2);
});
it('holds during pause, reverses smoothly, and completes immediately for reduced motion', () => {
  const spring = { lift: 0, velocity: 0 };
  for (let i = 0; i < 20; i++) advancePlatformFormation(spring, true, .05);
  const before = spring.lift;
  advancePlatformFormation(spring, true, 0);
  expect(spring.lift).toBe(before);
  advancePlatformFormation(spring, false, .01);
  expect(spring.lift).toBeLessThan(before);
  expect(spring.lift).toBeGreaterThan(before - .01);
  advancePlatformFormation(spring, true, 0, true);
  expect(spring.lift).toBe(1);
  expect(spring.formationRemaining).toBe(0);
});
