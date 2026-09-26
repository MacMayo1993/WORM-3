import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { classifyPad, flipPadPair, padWear, projectPair, asymmetricEnergy } from '../game/flipPad.js';

describe('flip pad state and identity', () => {
  it.each([2, 3, 7, 15])('gives both endpoints exactly the same key on size %s', size => {
    const map = buildManifoldGridMap(makeCubies(size), size);
    for (const { sticker } of map.values()) {
      const twin = findAntipodalStickerByGrid(map, sticker, size).sticker;
      expect(flipPadPair(sticker, size)).toBe(flipPadPair(twin, size));
    }
  });
  it.each([[3, 1, false], [6, 3, false], [6, 5, true], [8, 5, false], [8, 7, true], [13, 9, false], [13, 11, true], [20, 13, false], [20, 15, true]])('cap %s at %s has worn=%s', (cap, flips, worn) => {
    expect(classifyPad({ cap, flips }).worn).toBe(worn);
  });
  it('keeps the final home tile warned for odd caps', () => {
    expect(classifyPad({ cap: 3, flips: 2 })).toMatchObject({ state: 'home', worn: true, lifted: false });
  });
  it('gives terminal states precedence over parity and locks', () => {
    expect(classifyPad({ flips: 3, cap: 3, locked: true }).state).toBe('dead');
    expect(classifyPad({ flips: 1, voided: true, locked: true }).state).toBe('pit');
    expect(classifyPad({ flips: 1, locked: true }).state).toBe('locked');
    expect(classifyPad({ flips: 1, twinFlips: 0 }).state).toBe('lone');
  });
  it('uses rides rather than the constant one flip in WORM', () => {
    expect([0, 1, 2, 3].map(rides => padWear(1, 6, rides))).toEqual([0, 0.25, 0.5, 0.75]);
    expect(classifyPad({ flips: 1, rides: 3 }).worn).toBe(true);
  });
  it('projects pair inputs and defines the solved energy fraction as zero', () => {
    expect(projectPair(1, 5)).toEqual({ symmetric: 3, antisymmetric: -2 });
    expect(asymmetricEnergy([[0, 0]])).toBe(0);
    expect(asymmetricEnergy([[1, 1], [1, 0]])).toBeCloseTo(1 / 6);
    expect(asymmetricEnergy([[1, 0]])).toBe(0.5);
  });
});
