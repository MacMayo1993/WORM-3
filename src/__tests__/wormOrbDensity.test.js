import { it, expect } from 'vitest';
import { scaledWormOrbCount } from '../worm/wormDifficulty.js';
import { createWormSlice } from '../hooks/storeSlices/wormSlice.js';

it('keeps Hard populated without quadratic growth', () => {
  expect([2, 3, 5, 7, 15].map(n => scaledWormOrbCount(8, n))).toEqual([5, 8, 13, 19, 40]);
  expect(scaledWormOrbCount(10, 5)).toBe(17);
  expect(scaledWormOrbCount(12, 5)).toBe(20);
});
it('leaves free tiles on tiny boards and bounds oversized inputs', () => {
  expect(scaledWormOrbCount(1000, 2)).toBe(8);
  expect(scaledWormOrbCount(1000, 15)).toBe(96);
});
it('retains scaled counts and caps oversized settings', () => {
  let state;
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  state = createWormSlice(set, () => state);
  state.initWormMode(9999, 0, 3.5, scaledWormOrbCount(8, 15), 5);
  expect(state.wormOrbCount).toBe(40);
  state.setWormOrbCount(196);
  expect(state.wormOrbCount).toBe(96);
});
