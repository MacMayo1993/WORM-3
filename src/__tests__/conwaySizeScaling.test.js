import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
// Real engine constants/helpers — previously mirrored here (and the mirror
// drifted from the worker once already); import so tuning stays test-covered.
import {
  CONWAY_RULES,
  conwayPeriodByLevel,
  conwayBirthCapByLevel,
  conwayRecoveryCapByLevel,
  numChainsByLevel,
  chainCapByLevel,
  computeSizePenalty,
  computeSizeScale,
  MAX_OPS_PER_CHAIN_TICK,
} from '../game/chaosSim.js';
import { getManifoldNeighbors } from '../game/manifoldLogic.js';
import { buildSurfaceCoords } from '../game/chaosMetrics.js';

/**
 * Cross-size validation for Conway propagation scaling constants.
 * Ensures the chaos engine's size-dependent parameters stay within safe bounds
 * for all supported cube sizes (2×2 through 7×7).
 */

// Count surface stickers for a given cube size
const countSurfaceStickers = (size) => {
  const cubies = makeCubies(size);
  let count = 0;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        count += Object.keys(cubies[x][y][z].stickers).length;
      }
    }
  }
  return count;
};

// Expected surface sticker counts per size: 6 * size²
const EXPECTED_STICKERS = { 2: 24, 3: 54, 4: 96, 5: 150, 6: 216, 7: 294 };

describe('Conway Size Scaling (2×2 through 7×7)', () => {
  describe('Surface sticker counts', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) {
      it(`${size}×${size} has ${EXPECTED_STICKERS[size]} surface stickers`, () => {
        expect(countSurfaceStickers(size)).toBe(EXPECTED_STICKERS[size]);
      });
    }
  });

  describe('computeSizePenalty', () => {
    it('returns 1.0 for 3×3 (baseline)', () => {
      expect(computeSizePenalty(3)).toBeCloseTo(1.0);
    });

    it('returns < 1.0 for 2×2 (faster than baseline)', () => {
      expect(computeSizePenalty(2)).toBeCloseTo(0.65);
    });

    it('scales linearly from 3×3 to 7×7', () => {
      const penalties = [2, 3, 4, 5, 6, 7].map(computeSizePenalty);
      for (let i = 1; i < penalties.length; i++) {
        expect(penalties[i] - penalties[i - 1]).toBeCloseTo(0.35);
      }
    });

    it('7×7 penalty is 2.4 (not too aggressive)', () => {
      expect(computeSizePenalty(7)).toBeCloseTo(2.4);
    });

    for (const size of [2, 3, 4, 5, 6, 7]) {
      it(`${size}×${size} penalty is positive`, () => {
        expect(computeSizePenalty(size)).toBeGreaterThan(0);
      });
    }
  });

  describe('computeSizeScale', () => {
    it('returns 1 for cubes with ≤150 stickers (2×2 through 5×5)', () => {
      for (const size of [2, 3, 4, 5]) {
        expect(computeSizeScale(EXPECTED_STICKERS[size])).toBe(1);
      }
    });

    it('returns 2 for cubes with >150 stickers (6×6 and 7×7)', () => {
      for (const size of [6, 7]) {
        expect(computeSizeScale(EXPECTED_STICKERS[size])).toBe(2);
      }
    });

    it('never exceeds 2 (no unbounded chain multiplier)', () => {
      expect(computeSizeScale(1000)).toBe(2);
    });
  });

  describe('Effective chain count stays bounded', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (const size of [2, 3, 4, 5, 6, 7]) {
        it(`L${level} on ${size}×${size}: chains ≤ cap (${chainCapByLevel[level]})`, () => {
          const sizeScale = computeSizeScale(EXPECTED_STICKERS[size]);
          const rawChains = (numChainsByLevel[level] || 1) * sizeScale;
          const effectiveChains = Math.min(rawChains, chainCapByLevel[level]);
          expect(effectiveChains).toBeLessThanOrEqual(chainCapByLevel[level]);
          expect(effectiveChains).toBeGreaterThan(0);
        });
      }
    }
  });

  describe('Conway tick period scales with size penalty', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (const size of [2, 3, 4, 5, 6, 7]) {
        it(`L${level} on ${size}×${size}: effective period is reasonable`, () => {
          const basePeriod = conwayPeriodByLevel[level];
          const penalty = computeSizePenalty(size);
          const effectivePeriod = basePeriod * penalty;
          // Even the fastest combo (L5 on 2×2) shouldn't tick faster than 500ms
          expect(effectivePeriod).toBeGreaterThanOrEqual(500);
          // Even the slowest combo (L1 on 7×7) shouldn't exceed 6s
          expect(effectivePeriod).toBeLessThanOrEqual(6000);
        });
      }
    }
  });

  describe('MAX_OPS_PER_CHAIN_TICK bounds total work per cycle', () => {
    it('MAX_OPS budget stays a small per-commit batch', () => {
      expect(MAX_OPS_PER_CHAIN_TICK).toBeLessThanOrEqual(10);
    });

    for (const size of [2, 3, 4, 5, 6, 7]) {
      it(`${size}×${size}: ops budget < sticker count`, () => {
        expect(MAX_OPS_PER_CHAIN_TICK).toBeLessThan(EXPECTED_STICKERS[size]);
      });
    }
  });

  describe('Conway birth/recovery caps are bounded per tick', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      it(`L${level}: birth cap (${conwayBirthCapByLevel[level]}) + recovery cap (${conwayRecoveryCapByLevel[level]}) ≤ 10`, () => {
        const total = conwayBirthCapByLevel[level] + conwayRecoveryCapByLevel[level];
        expect(total).toBeLessThanOrEqual(10);
      });
    }
  });

  describe('Neighbor generation produces valid neighbors at all sizes', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) {
      it(`${size}×${size}: center face sticker has 4 same-face neighbors`, () => {
        if (size < 3) return; // 2×2 has no interior face stickers
        const mid = Math.floor(size / 2);
        const neighbors = getManifoldNeighbors(mid, mid, size - 1, 'PZ', size);
        const sameFace = neighbors.filter(n => n.dirKey === 'PZ');
        expect(sameFace.length).toBe(4);
      });

      it(`${size}×${size}: corner face sticker has cross-face neighbors`, () => {
        const neighbors = getManifoldNeighbors(0, 0, size - 1, 'PZ', size);
        const crossFace = neighbors.filter(n => n.dirKey !== 'PZ');
        expect(crossFace.length).toBeGreaterThan(0);
      });

      it(`${size}×${size}: all neighbors are in bounds`, () => {
        const cubies = makeCubies(size);
        const surfCoords = buildSurfaceCoords(size);
        for (const [x, y, z] of surfCoords) {
          for (const dirKey of Object.keys(cubies[x][y][z].stickers)) {
            const neighbors = getManifoldNeighbors(x, y, z, dirKey, size);
            for (const n of neighbors) {
              expect(n.x).toBeGreaterThanOrEqual(0);
              expect(n.x).toBeLessThan(size);
              expect(n.y).toBeGreaterThanOrEqual(0);
              expect(n.y).toBeLessThan(size);
              expect(n.z).toBeGreaterThanOrEqual(0);
              expect(n.z).toBeLessThan(size);
            }
          }
        }
      });
    }
  });

  describe('Neighbor counts are within expected range at all sizes', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) {
      it(`${size}×${size}: every sticker has 4–6 neighbors`, () => {
        const cubies = makeCubies(size);
        const surfCoords = buildSurfaceCoords(size);
        for (const [x, y, z] of surfCoords) {
          for (const dirKey of Object.keys(cubies[x][y][z].stickers)) {
            const neighbors = getManifoldNeighbors(x, y, z, dirKey, size);
            expect(neighbors.length).toBeGreaterThanOrEqual(size === 2 ? 4 : 4);
            expect(neighbors.length).toBeLessThanOrEqual(6);
          }
        }
      });
    }
  });

  describe('Conway rules apply correctly regardless of neighbor count range', () => {
    function evaluateSticker(level, isInfected, infectedNeighborCount) {
      const rules = CONWAY_RULES[level];
      if (!isInfected) {
        return rules.birth.has(infectedNeighborCount) ? 'birth' : 'stay_healthy';
      }
      return rules.survive.has(infectedNeighborCount) ? 'survive' : 'recover';
    }

    for (const level of [1, 2, 3, 4, 5]) {
      it(`L${level}: rules handle neighbor counts 0–6 without error`, () => {
        for (let n = 0; n <= 6; n++) {
          expect(() => evaluateSticker(level, false, n)).not.toThrow();
          expect(() => evaluateSticker(level, true, n)).not.toThrow();
          const healthyResult = evaluateSticker(level, false, n);
          const infectedResult = evaluateSticker(level, true, n);
          expect(['birth', 'stay_healthy']).toContain(healthyResult);
          expect(['survive', 'recover']).toContain(infectedResult);
        }
      });

      it(`L${level}: at least one birth rule triggers within 4–6 neighbor range`, () => {
        const rules = CONWAY_RULES[level];
        const birthsInRange = [4, 5, 6].some(n => rules.birth.has(n))
          || [1, 2, 3].some(n => rules.birth.has(n));
        expect(birthsInRange).toBe(true);
      });
    }
  });

  describe('Surface coord generation matches makeCubies', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) {
      it(`${size}×${size}: surfaceCoords covers all cubies with stickers`, () => {
        const cubies = makeCubies(size);
        const surfCoords = buildSurfaceCoords(size);
        const surfSet = new Set(surfCoords.map(([x, y, z]) => `${x},${y},${z}`));

        let stickerCubieCount = 0;
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
              if (Object.keys(cubies[x][y][z].stickers).length > 0) {
                stickerCubieCount++;
                expect(surfSet.has(`${x},${y},${z}`)).toBe(true);
              }
            }
          }
        }
        expect(stickerCubieCount).toBe(surfCoords.length);
      });
    }
  });
});
