import { describe, it, expect } from 'vitest';
import { getLevelPar, computeStars, parSlack } from '../levels/scoring.js';
import { createLevel } from '../levels/schema.js';

describe('getLevelPar', () => {
  it('derives par from scramble + flip sequence lengths', () => {
    const level = createLevel({ id: 1, scrambleSequence: [{}, {}, {}], flipSequence: [{}] });
    expect(getLevelPar(level)).toBe(4);
  });

  it('honours an explicit par override', () => {
    const level = createLevel({ id: 1, scrambleSequence: [{}, {}], par: 7 });
    expect(getLevelPar(level)).toBe(7);
  });

  it('returns null when the level has no authored disturbance', () => {
    expect(getLevelPar(createLevel({ id: 1 }))).toBeNull();
    expect(getLevelPar(null)).toBeNull();
  });
});

describe('computeStars — golf scoring', () => {
  const level = createLevel({ id: 1, scrambleSequence: [{}, {}, {}, {}] }); // par 4

  it('awards 3 stars at or under par', () => {
    expect(computeStars(level, { moves: 4 })).toBe(3);
    expect(computeStars(level, { moves: 2 })).toBe(3);
  });

  it('awards 2 stars within the slack window over par', () => {
    expect(parSlack(4)).toBe(2);
    expect(computeStars(level, { moves: 5 })).toBe(2);
    expect(computeStars(level, { moves: 6 })).toBe(2); // par 4 + slack 2
  });

  it('awards 1 star for a slower finish', () => {
    expect(computeStars(level, { moves: 7 })).toBe(1);
    expect(computeStars(level, { moves: 99 })).toBe(1);
  });

  it('keeps a fair 2-star window on very short pars', () => {
    const tiny = createLevel({ id: 1, scrambleSequence: [{}] }); // par 1, slack min 2
    expect(computeStars(tiny, { moves: 1 })).toBe(3);
    expect(computeStars(tiny, { moves: 3 })).toBe(2); // 1 + slack 2
    expect(computeStars(tiny, { moves: 4 })).toBe(1);
  });

  it('falls back to the cube-size heuristic when there is no par', () => {
    const freeplay = createLevel({ id: 1, cubeSize: 3 }); // no sequences -> no par
    expect(getLevelPar(freeplay)).toBeNull();
    expect(computeStars(freeplay, { moves: 999, time: 9999 })).toBe(1);
    expect(computeStars(freeplay, { moves: 1, time: 1 })).toBe(3);
  });
});
