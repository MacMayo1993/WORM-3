import { describe, it, expect } from 'vitest';

/**
 * Tests for the Conway Game-of-Life propagation rules used in chaos mode.
 * These verify the rule definitions and the neighbor-counting logic that
 * drives birth/survival/recovery decisions in the chaos worker.
 */

// Mirror the CONWAY_RULES from the worker (can't import worker directly in vitest/jsdom)
const CONWAY_RULES = [
  null,
  { birth: new Set([3]), survive: new Set([1, 2]), recoveryRate: 0.3, period: 2200 },
  { birth: new Set([2, 3]), survive: new Set([1, 2]), recoveryRate: 0.25, period: 1800 },
  { birth: new Set([2]), survive: new Set([]), recoveryRate: 0.5, period: 1400 },
  { birth: new Set([3, 4]), survive: new Set([2, 3, 4]), recoveryRate: 0.15, period: 1600 },
  { birth: new Set([1, 2]), survive: new Set([1, 2, 3, 4]), recoveryRate: 0.1, period: 1000 },
];

describe('Conway Propagation Rules', () => {
  describe('Rule definitions', () => {
    it('has rules for all 5 chaos levels', () => {
      for (let level = 1; level <= 5; level++) {
        expect(CONWAY_RULES[level]).toBeDefined();
        expect(CONWAY_RULES[level].birth).toBeInstanceOf(Set);
        expect(CONWAY_RULES[level].survive).toBeInstanceOf(Set);
        expect(CONWAY_RULES[level].recoveryRate).toBeGreaterThan(0);
        expect(CONWAY_RULES[level].recoveryRate).toBeLessThanOrEqual(1);
        expect(CONWAY_RULES[level].period).toBeGreaterThan(0);
      }
    });

    it('Level 1 (Life analog) requires exactly 3 neighbors for birth', () => {
      const rules = CONWAY_RULES[1];
      expect(rules.birth.has(2)).toBe(false);
      expect(rules.birth.has(3)).toBe(true);
      expect(rules.birth.has(4)).toBe(false);
    });

    it('Level 1 survives with 1 or 2 neighbors', () => {
      const rules = CONWAY_RULES[1];
      expect(rules.survive.has(0)).toBe(false);
      expect(rules.survive.has(1)).toBe(true);
      expect(rules.survive.has(2)).toBe(true);
      expect(rules.survive.has(3)).toBe(false);
    });

    it('Level 2 (HighLife analog) births with 2 or 3 neighbors', () => {
      const rules = CONWAY_RULES[2];
      expect(rules.birth.has(1)).toBe(false);
      expect(rules.birth.has(2)).toBe(true);
      expect(rules.birth.has(3)).toBe(true);
      expect(rules.birth.has(4)).toBe(false);
    });

    it('Level 3 (Seeds analog) has empty survival set', () => {
      const rules = CONWAY_RULES[3];
      expect(rules.survive.size).toBe(0);
      expect(rules.birth.has(2)).toBe(true);
    });

    it('Level 3 has highest recovery rate due to no survival', () => {
      expect(CONWAY_RULES[3].recoveryRate).toBeGreaterThanOrEqual(CONWAY_RULES[1].recoveryRate);
      expect(CONWAY_RULES[3].recoveryRate).toBeGreaterThanOrEqual(CONWAY_RULES[2].recoveryRate);
    });

    it('Level 4 (Day & Night inspired) has symmetric-ish birth/survive', () => {
      const rules = CONWAY_RULES[4];
      expect(rules.birth.has(3)).toBe(true);
      expect(rules.birth.has(4)).toBe(true);
      expect(rules.survive.has(2)).toBe(true);
      expect(rules.survive.has(3)).toBe(true);
      expect(rules.survive.has(4)).toBe(true);
    });

    it('Level 5 is the most aggressive — births with just 1 neighbor', () => {
      const rules = CONWAY_RULES[5];
      expect(rules.birth.has(1)).toBe(true);
      expect(rules.survive.has(1)).toBe(true);
      expect(rules.survive.has(4)).toBe(true);
    });

    it('recovery rates decrease as levels increase (more persistent chaos)', () => {
      expect(CONWAY_RULES[1].recoveryRate).toBeGreaterThan(CONWAY_RULES[4].recoveryRate);
      expect(CONWAY_RULES[4].recoveryRate).toBeGreaterThan(CONWAY_RULES[5].recoveryRate);
    });

    it('periods decrease as levels increase (faster generations)', () => {
      expect(CONWAY_RULES[1].period).toBeGreaterThan(CONWAY_RULES[5].period);
    });
  });

  describe('Birth/Survival logic simulation', () => {
    function evaluateSticker(level, isInfected, infectedNeighborCount) {
      const rules = CONWAY_RULES[level];
      if (!isInfected) {
        return rules.birth.has(infectedNeighborCount) ? 'birth' : 'stay_healthy';
      }
      return rules.survive.has(infectedNeighborCount) ? 'survive' : 'recover';
    }

    it('Level 1: isolated infected sticker recovers', () => {
      expect(evaluateSticker(1, true, 0)).toBe('recover');
    });

    it('Level 1: infected sticker with 1 neighbor survives', () => {
      expect(evaluateSticker(1, true, 1)).toBe('survive');
    });

    it('Level 1: infected sticker with 2 neighbors survives', () => {
      expect(evaluateSticker(1, true, 2)).toBe('survive');
    });

    it('Level 1: overpopulated infected sticker recovers', () => {
      expect(evaluateSticker(1, true, 4)).toBe('recover');
    });

    it('Level 1: healthy sticker with exactly 3 infected neighbors is born', () => {
      expect(evaluateSticker(1, false, 3)).toBe('birth');
    });

    it('Level 1: healthy sticker with 2 neighbors stays healthy', () => {
      expect(evaluateSticker(1, false, 2)).toBe('stay_healthy');
    });

    it('Level 3 (Seeds): nothing survives regardless of neighbor count', () => {
      for (let n = 0; n <= 6; n++) {
        expect(evaluateSticker(3, true, n)).toBe('recover');
      }
    });

    it('Level 3 (Seeds): birth only with exactly 2', () => {
      expect(evaluateSticker(3, false, 1)).toBe('stay_healthy');
      expect(evaluateSticker(3, false, 2)).toBe('birth');
      expect(evaluateSticker(3, false, 3)).toBe('stay_healthy');
    });

    it('Level 5: very easy to be born and very hard to recover', () => {
      expect(evaluateSticker(5, false, 1)).toBe('birth');
      expect(evaluateSticker(5, false, 2)).toBe('birth');
      expect(evaluateSticker(5, true, 1)).toBe('survive');
      expect(evaluateSticker(5, true, 2)).toBe('survive');
      expect(evaluateSticker(5, true, 3)).toBe('survive');
      expect(evaluateSticker(5, true, 4)).toBe('survive');
      // Only 0 or 5+ neighbors would cause recovery
      expect(evaluateSticker(5, true, 0)).toBe('recover');
    });
  });

  describe('Recovery mechanic', () => {
    it('recovery toggles color back (simulated antipodal flip)', () => {
      const ANTIPODAL_COLOR = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };
      // Simulate: orig=1, after 3 flips curr should be 4 (odd flips = antipodal)
      let curr = 1;
      let flips = 0;
      // Apply 3 chaos flips
      for (let i = 0; i < 3; i++) {
        curr = ANTIPODAL_COLOR[curr];
        flips++;
      }
      expect(curr).toBe(4);
      expect(flips).toBe(3);

      // Recovery: decrement flips, toggle color
      curr = ANTIPODAL_COLOR[curr];
      flips--;
      expect(curr).toBe(1); // Back to original
      expect(flips).toBe(2);

      // Another recovery
      curr = ANTIPODAL_COLOR[curr];
      flips--;
      expect(curr).toBe(4); // Antipodal (odd flips)
      expect(flips).toBe(1);

      // Final recovery — fully healed
      curr = ANTIPODAL_COLOR[curr];
      flips--;
      expect(curr).toBe(1); // Original color restored
      expect(flips).toBe(0);
    });
  });
});
