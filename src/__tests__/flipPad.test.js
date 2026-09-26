import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { K_STAR, classifyPad, flipPadPair, padWear, padIsWorn, pairFlips, projectPair, asymmetricEnergy } from '../game/flipPad.js';

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
  it('marks the last life as worn even below K_STAR', () => {
    expect(padIsWorn(0.5, 1)).toBe(true);
    expect(padIsWorn(0.5, 2)).toBe(false);
    expect(padIsWorn(K_STAR, 3)).toBe(true);
  });
  it.each([3, 6, 8, 13, 20])('lets K_STAR alone decide every lifted pad on cap %s', cap => {
    for (let n = 1; n < cap; n += 2) expect(padIsWorn(n / cap, cap - n)).toBe(n / cap >= K_STAR);
  });
  it('gives cap 3 no worn pad; its worn tile is the last home tile', () => {
    expect(classifyPad({ flips: 1, cap: 3 })).toMatchObject({ state: 'pad', worn: false });
    expect(classifyPad({ flips: 2, cap: 3 })).toMatchObject({ state: 'home', worn: true });
  });
  it("keeps a pair's wear when its twin is not mounted, but averages a home twin", () => {
    expect(pairFlips(5, null)).toBe(5);
    expect(pairFlips(5, undefined)).toBe(5);
    expect(pairFlips(5, 5)).toBe(5);
    expect(pairFlips(1, 0)).toBe(0.5); // a lone pad: its home twin still counts (P+)
    expect(pairFlips(3, 1)).toBe(2); // heal history leaves both twins on the symmetric part
  });
});
