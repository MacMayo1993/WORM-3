import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import {
  stickerKey,
  createSuperposition,
  collapseSlice,
  applyCollapse,
  removeSuperposition,
  clearSuperposition,
} from '../game/quantumState.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

describe('quantumState', () => {
  describe('stickerKey', () => {
    it('produces a unique string per sticker location', () => {
      expect(stickerKey(0, 0, 0, 'PZ')).toBe('0-0-0-PZ');
      expect(stickerKey(2, 1, 0, 'NX')).toBe('2-1-0-NX');
    });

    it('two distinct locations produce distinct keys', () => {
      expect(stickerKey(0, 0, 0, 'PZ')).not.toBe(stickerKey(0, 0, 0, 'NZ'));
      expect(stickerKey(1, 0, 0, 'PZ')).not.toBe(stickerKey(0, 1, 0, 'PZ'));
    });
  });

  describe('createSuperposition', () => {
    it('returns an object of superposed stickers', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0); // 100% ratio so all surface stickers are superposed
      expect(typeof sp).toBe('object');
      expect(Object.keys(sp).length).toBeGreaterThan(0);
    });

    it('each entry has color1 and color2 as antipodal pair', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0);
      for (const entry of Object.values(sp)) {
        expect(ANTIPODAL_COLOR[entry.color1]).toBe(entry.color2);
      }
    });

    it('entry keys match stickerKey format', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0);
      for (const [key, entry] of Object.entries(sp)) {
        expect(key).toBe(stickerKey(entry.x, entry.y, entry.z, entry.dirKey));
      }
    });

    it('each entry has a seed between 0 and 1', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0);
      for (const entry of Object.values(sp)) {
        expect(entry.seed).toBeGreaterThanOrEqual(0);
        expect(entry.seed).toBeLessThan(1);
      }
    });

    it('with ratio 0 returns empty superposition', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 0);
      expect(Object.keys(sp).length).toBe(0);
    });
  });

  describe('collapseSlice', () => {
    it('removes stickers in the rotated slice', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0);
      const [collapsed, events] = collapseSlice(sp, 3, 'col', 0); // x === 0 slice

      // All events should be from x=0
      for (const ev of events) {
        expect(ev.x).toBe(0);
      }

      // The collapsed stickers should no longer appear in returned map
      for (const ev of events) {
        const k = stickerKey(ev.x, ev.y, ev.z, ev.dirKey);
        expect(collapsed[k]).toBeUndefined();
      }
    });

    it('leaves stickers outside the slice untouched', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0);
      const initialOutsideCount = Object.values(sp).filter(e => e.x !== 0).length;
      const [collapsed] = collapseSlice(sp, 3, 'col', 0);
      const remainingCount = Object.keys(collapsed).length;
      expect(remainingCount).toBe(initialOutsideCount);
    });

    it('each collapse event carries a collapsedColor that is color1 or color2', () => {
      const cubies = makeCubies(3);
      const sp = createSuperposition(cubies, 3, 1.0);
      const [, events] = collapseSlice(sp, 3, 'row', 2);
      for (const ev of events) {
        expect([ev.color1, ev.color2]).toContain(ev.collapsedColor);
      }
    });

    it('seed < 0.5 collapses to color1, seed >= 0.5 collapses to color2', () => {
      const cubies = makeCubies(3);
      // Manually create a superposed entry with known seed
      const sp = {
        '0-0-2-PZ': { x: 0, y: 0, z: 2, dirKey: 'PZ', color1: 1, color2: 4, seed: 0.3 },
        '1-0-2-PZ': { x: 1, y: 0, z: 2, dirKey: 'PZ', color1: 1, color2: 4, seed: 0.7 },
      };
      const [, events] = collapseSlice(sp, 3, 'depth', 2);
      const e1 = events.find(e => e.x === 0 && e.y === 0);
      const e2 = events.find(e => e.x === 1 && e.y === 0);
      expect(e1?.collapsedColor).toBe(1); // seed 0.3 < 0.5 → color1
      expect(e2?.collapsedColor).toBe(4); // seed 0.7 >= 0.5 → color2
    });
  });

  describe('applyCollapse', () => {
    it('returns same cubies reference when no events', () => {
      const cubies = makeCubies(3);
      const result = applyCollapse(cubies, []);
      expect(result).toBe(cubies);
    });

    it('patches sticker color for a collapse event', () => {
      const cubies = makeCubies(3);
      // PZ face at (0,0,2) starts as color 1 (Red); patch to 4 (Orange)
      const events = [{ x: 0, y: 0, z: 2, dirKey: 'PZ', collapsedColor: 4 }];
      const result = applyCollapse(cubies, events);
      expect(result[0][0][2].stickers['PZ'].curr).toBe(4);
      // Original unchanged
      expect(cubies[0][0][2].stickers['PZ'].curr).toBe(1);
    });
  });

  describe('removeSuperposition', () => {
    it('removes the specified sticker from superposition', () => {
      const sp = {
        '1-1-2-PZ': { x: 1, y: 1, z: 2, dirKey: 'PZ', color1: 1, color2: 4, seed: 0.5 },
        '0-0-2-PZ': { x: 0, y: 0, z: 2, dirKey: 'PZ', color1: 1, color2: 4, seed: 0.2 },
      };
      const result = removeSuperposition(sp, 1, 1, 2, 'PZ');
      expect(result['1-1-2-PZ']).toBeUndefined();
      expect(result['0-0-2-PZ']).toBeDefined();
    });

    it('returns same object if key not present', () => {
      const sp = {};
      const result = removeSuperposition(sp, 0, 0, 0, 'PZ');
      expect(result).toBe(sp);
    });
  });

  describe('clearSuperposition', () => {
    it('returns an empty object', () => {
      expect(clearSuperposition()).toEqual({});
    });
  });
});
