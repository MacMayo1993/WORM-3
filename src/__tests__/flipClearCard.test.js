import { describe, expect, it } from 'vitest';
import { flipClearRecords, nextStarLine } from '../components/screens/flipClearRecords.js';
import { computeStars, flipStarLines, nextFlipStar } from '../levels/scoring.js';
import { FLIP_PUZZLES } from '../levels/packs/flip-puzzles.js';

const labels = args => flipClearRecords(args).map(r => r.label);

describe('flip clear card', () => {
  it('names a first clear, a star upgrade and a new best', () => {
    expect(labels({ previous: null, stars: 2, flips: 3, newBest: true, relapses: 0 })).toEqual(['First clear']);
    expect(labels({ previous: { stars: 1, bestFlips: 5 }, stars: 3, flips: 2, newBest: true, relapses: 2 }))
      .toEqual(['★ → ★★★', 'New best · was 5 flips', 'Survived 2 relapses']);
    expect(labels({ previous: { stars: 3, bestFlips: 2 }, stars: 3, flips: 2, newBest: false, relapses: 1 }))
      .toEqual(['Best 2 flips', 'Survived 1 relapse']);
  });

  it('asks for exactly the flips the next star needs, the same lines the score uses', () => {
    for (const level of FLIP_PUZZLES) {
      const lines = flipStarLines(level);
      for (let flips = 0; flips <= lines.two + 3; flips++) {
        const stars = computeStars(level, { flips });
        const next = nextFlipStar(level, flips);
        if (stars === 3) expect(next).toBeNull();
        else {
          expect(next.stars).toBe(stars + 1);
          expect(computeStars(level, { flips: next.flips })).toBe(next.stars);
          expect(computeStars(level, { flips: next.flips + 1 })).toBeLessThan(next.stars);
        }
      }
    }
  });

  it('words the next star, a zero-flip target and a beaten target', () => {
    expect(nextStarLine({ stars: 3, flips: 2 }, 2, 3)).toBe('★★★: solve it in 2 flips or fewer.');
    expect(nextStarLine({ stars: 3, flips: 0 }, 0, 1)).toBe('★★★: solve it with no flips at all.');
    expect(nextStarLine(null, 3, 1)).toBe('Beat the target by 2 flips.');
    expect(nextStarLine(null, 0, 0)).toBe('No flips at all. Perfect.');
  });
});
