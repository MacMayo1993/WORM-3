import { it, expect } from 'vitest';
import { elementalFeedback, fusionFeedback, patchOpacity } from '../worm/healerWorm/elementalFeedback.js';
import { trampolineCompression } from '../worm/healerWorm/trampoline.js';
import { getFusion } from '../worm/healerWorm/elementalFusion.js';
import { wormBuffs, resetWormBuffs } from '../worm/wormBuffs.js';
it('explains each ordered fusion by its own rule, never its reverse', () => {
  expect(fusionFeedback(getFusion('water', 'ice'), { waterMomentum: 1 }).text).toContain('+40%');
  expect(fusionFeedback(getFusion('ice', 'water'), { waterMomentum: 1 }).text).toContain('Tiles you leave freeze');
  expect(fusionFeedback(getFusion('fire', 'water'), {}).text).toContain('Puts out bombs');
  expect(fusionFeedback(getFusion('water', 'fire'), {}).text).toContain('Obsidian');
  expect(fusionFeedback(getFusion('water', 'grass'), {}).text).toContain('Rain grows a pad');
  expect(fusionFeedback(getFusion('ice', 'fire'), { meltdownT: 0.3 }).text).toContain('DASH');
  expect(fusionFeedback(getFusion('ice', 'lightning'), { staticT: 1 }).text).toContain('DISCHARGE');
});
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
it('keeps mat pulses going until the tail clears, reduces motion and fades only unused pads', () => {
  const pad = { bounceDistance: 10 };
  expect(trampolineCompression({}, 10, 4)).toBe(0);
  expect(trampolineCompression(pad, 10, 4)).not.toBe(trampolineCompression(pad, 10.27, 4));
  expect(trampolineCompression(pad, 10, 4, true)).toBe(trampolineCompression(pad, 13, 4, true));
  expect(trampolineCompression(pad, 15, 4)).toBe(0);
  expect(patchOpacity(Infinity)).toBe(1);
  expect(patchOpacity(1)).toBe(1);
  expect(patchOpacity(0)).toBe(0);
});
it('resets all new HUD mirrors between runs', () => {
  wormBuffs.waterMomentum = 1; wormBuffs.springReady = true; wormBuffs.springCount = 5;
  wormBuffs.meltdownT = 1; wormBuffs.staticT = 1;
  resetWormBuffs();
  expect(wormBuffs.meltdownT).toBe(0);
  expect(wormBuffs.staticT).toBe(0);
  expect(wormBuffs.waterMomentum).toBe(0);
  expect(wormBuffs.springReady).toBe(false);
  expect(wormBuffs.springCount).toBe(0);
});
