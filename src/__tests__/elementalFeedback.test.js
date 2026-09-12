import { it, expect } from 'vitest';
import { elementalFeedback, patchOpacity, springStretch } from '../worm/healerWorm/elementalFeedback.js';
import { wormBuffs, resetWormBuffs } from '../worm/wormBuffs.js';
it('shows actual water gain and does not claim a water boost during rocket override', () => {
  expect(elementalFeedback('water', { waterMomentum: 0.8 }).text).toContain('+20%');
  expect(elementalFeedback('water', { waterMomentum: 1, rocketActive: true }).fraction).toBe(0);
  expect(elementalFeedback('water', { waterMomentum: 4 }).fraction).toBe(1);
});
it('distinguishes an actionable spring from remaining pads and fire shields from flames', () => {
  expect(elementalFeedback('grass', { springReady: true }).text).toContain('SPRING READY');
  expect(elementalFeedback('grass', { springCount: 3 }).text).toContain('3 springs');
  expect(elementalFeedback('fire', {}).text).toContain('Flames still hurt');
});
it('disables spring motion when reduced and fades only near expiry', () => {
  expect(springStretch(4, true)).toBe(1);
  expect(springStretch(4, false)).not.toBe(springStretch(4.2, false));
  expect(patchOpacity(1)).toBe(1);
  expect(patchOpacity(0)).toBe(0);
});
it('resets all new HUD mirrors between runs', () => {
  wormBuffs.waterMomentum = 1; wormBuffs.springReady = true; wormBuffs.springCount = 5;
  resetWormBuffs();
  expect(wormBuffs.waterMomentum).toBe(0);
  expect(wormBuffs.springReady).toBe(false);
  expect(wormBuffs.springCount).toBe(0);
});
