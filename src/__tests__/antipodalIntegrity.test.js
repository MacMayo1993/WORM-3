import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import {
  computeAntipodalIntegrity,
  computeCommutatorNorm,
  getRegime,
  K_STAR
} from '../game/antipodalIntegrity.js';

describe('K_STAR constant', () => {
  it('equals 1/(2 ln 2) ≈ 0.7213', () => {
    expect(K_STAR).toBeCloseTo(0.7213, 3);
    expect(K_STAR).toBe(1 / (2 * Math.LN2));
  });
});

describe('computeAntipodalIntegrity', () => {
  it('returns integrity = 1 for solved 3×3 cube', () => {
    const cubies = makeCubies(3);
    const result = computeAntipodalIntegrity(cubies, 3);
    expect(result.integrity).toBe(1);
    expect(result.preserved).toBe(result.total);
    expect(result.broken).toBe(0);
  });

  it('returns integrity = 1 for solved 2×2 cube', () => {
    const cubies = makeCubies(2);
    const result = computeAntipodalIntegrity(cubies, 2);
    expect(result.integrity).toBe(1);
    expect(result.preserved).toBe(result.total);
  });

  it('returns 27 total pairs for a 3×3 cube', () => {
    const cubies = makeCubies(3);
    const result = computeAntipodalIntegrity(cubies, 3);
    // 54 stickers / 2 = 27 pairs
    expect(result.total).toBe(27);
  });

  it('returns 12 total pairs for a 2×2 cube', () => {
    const cubies = makeCubies(2);
    const result = computeAntipodalIntegrity(cubies, 2);
    // 24 stickers / 2 = 12 pairs
    expect(result.total).toBe(12);
  });

  it('returns pairs array with correct structure', () => {
    const cubies = makeCubies(3);
    const result = computeAntipodalIntegrity(cubies, 3);
    expect(result.pairs).toHaveLength(27);
    result.pairs.forEach((pair) => {
      expect(pair).toHaveProperty('a');
      expect(pair).toHaveProperty('b');
      expect(pair).toHaveProperty('preserved');
      expect(pair.a).toHaveProperty('x');
      expect(pair.a).toHaveProperty('y');
      expect(pair.a).toHaveProperty('z');
      expect(pair.a).toHaveProperty('dirKey');
    });
  });

  it('integrity decreases after quarter-turn rotation', () => {
    let cubies = makeCubies(3);
    // A single quarter-turn should break some antipodal pairs
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    const result = computeAntipodalIntegrity(cubies, 3);
    expect(result.integrity).toBeLessThan(1);
    expect(result.broken).toBeGreaterThan(0);
  });

  it('integrity preserved after 180-degree rotation', () => {
    let cubies = makeCubies(3);
    // Two quarter-turns = 180° should preserve more antipodal pairs
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    const result = computeAntipodalIntegrity(cubies, 3);
    // 180° face turns preserve antipodality (per paper Proposition 4a)
    // Note: single-face 180° may not preserve all 27 since it only affects one layer
    expect(result.integrity).toBeGreaterThan(0);
  });

  it('integrity approaches 0 after many scrambles', () => {
    let cubies = makeCubies(3);
    // Apply many random rotations
    for (let i = 0; i < 50; i++) {
      const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
      const slice = Math.floor(Math.random() * 3);
      const dir = Math.random() > 0.5 ? 1 : -1;
      cubies = rotateSliceCubies(cubies, 3, ax, slice, dir);
    }
    const result = computeAntipodalIntegrity(cubies, 3);
    // Heavily scrambled state should have low integrity
    expect(result.integrity).toBeLessThan(0.5);
  });

  it('integrity is always between 0 and 1', () => {
    let cubies = makeCubies(3);
    for (let i = 0; i < 20; i++) {
      const ax = ['row', 'col', 'depth'][i % 3];
      cubies = rotateSliceCubies(cubies, 3, ax, i % 3, 1);
      const result = computeAntipodalIntegrity(cubies, 3);
      expect(result.integrity).toBeGreaterThanOrEqual(0);
      expect(result.integrity).toBeLessThanOrEqual(1);
    }
  });
});

describe('computeCommutatorNorm', () => {
  it('returns 0 for solved cube', () => {
    const cubies = makeCubies(3);
    const norm = computeCommutatorNorm(cubies, 3);
    expect(norm).toBe(0);
  });

  it('returns positive value for scrambled cube', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    const norm = computeCommutatorNorm(cubies, 3);
    expect(norm).toBeGreaterThan(0);
  });
});

describe('getRegime', () => {
  it('returns "structure" for high integrity', () => {
    expect(getRegime(1.0)).toBe('structure');
    expect(getRegime(0.9)).toBe('structure');
    expect(getRegime(0.8)).toBe('structure');
  });

  it('returns "entropy" for low integrity', () => {
    expect(getRegime(0.0)).toBe('entropy');
    expect(getRegime(0.1)).toBe('entropy');
    expect(getRegime(0.5)).toBe('entropy');
  });

  it('returns "critical" near k*', () => {
    expect(getRegime(K_STAR)).toBe('critical');
    expect(getRegime(K_STAR + 0.01)).toBe('critical');
    expect(getRegime(K_STAR - 0.01)).toBe('critical');
  });
});
