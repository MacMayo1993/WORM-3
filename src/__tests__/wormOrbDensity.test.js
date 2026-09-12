import { it, expect } from 'vitest';
import { scaledWormOrbCount } from '../worm/wormDifficulty.js';
import { createWormSlice } from '../hooks/storeSlices/wormSlice.js';

it('keeps Hard plentiful and scales with all six faces', () => {
  expect([2, 3, 5, 7, 15].map(n => scaledWormOrbCount(36, n))).toEqual([16, 36, 100, 196, 384]);
  expect(scaledWormOrbCount(40, 5)).toBe(111);
  expect(scaledWormOrbCount(45, 5)).toBe(125);
});
it('leaves free tiles on tiny boards and bounds oversized inputs', () => {
  expect(scaledWormOrbCount(1000, 2)).toBe(20);
  expect(scaledWormOrbCount(1000, 15)).toBe(384);
});
it('retains dense counts through run initialization and settings updates', () => {
  let state;
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  state = createWormSlice(set, () => state);
  state.initWormMode(9999, 0, 3.5, scaledWormOrbCount(36, 15), 5);
  expect(state.wormOrbCount).toBe(384);
  state.setWormOrbCount(196);
  expect(state.wormOrbCount).toBe(196);
});
