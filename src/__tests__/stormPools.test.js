// The storm's fixed pools: strips never exceed their slots, short strips collapse
// their unused tail to nothing, and sparks die on schedule and stop uploading.
import { describe, it, expect } from 'vitest';
import { createStripGeometry, createStripWriter, STRIP_POINTS } from '../manifold/stormStrips.js';
import { createSparkPool, spawnSpark, stepSparks, clearSparks } from '../manifold/stormSparks.js';

describe('strip writer', () => {
  it('packs strips into the pool and refuses past capacity', () => {
    const geo = createStripGeometry(2);
    const w = createStripWriter(geo, 2);
    w.begin();
    expect(w.open()).toBe(0);
    expect(w.open()).toBe(1);
    expect(w.open()).toBe(-1);
    w.end();
    expect(geo.drawRange.count).toBe(2 * (STRIP_POINTS - 1) * 6);
    w.begin();
    w.end();
    expect(geo.drawRange.count).toBe(0);
  });

  it('writes unit tangents and collapses a short strip’s tail to zero width', () => {
    const geo = createStripGeometry(1);
    const w = createStripWriter(geo, 1);
    w.begin();
    const s = w.open();
    for (let i = 0; i < 3; i++) w.point(s, i, i, 0, 0, 0.1, 1, 1, 1, 1, 1, 0);
    w.close(s, 3);
    w.end();
    const tan = geo.attributes.aTangent.array;
    expect([tan[0], tan[1], tan[2]]).toEqual([1, 0, 0]);
    const wid = geo.attributes.aWidth.array;
    const alp = geo.attributes.aAlpha.array;
    const pos = geo.attributes.position.array;
    for (let i = 3; i < STRIP_POINTS; i++) {
      expect(wid[i * 2]).toBe(0);
      expect(alp[i * 2]).toBe(0);
      expect(pos[i * 2 * 3]).toBe(2);
    }
    // Both sides of the ribbon share a centreline point.
    expect(geo.attributes.aSide.array[0]).toBe(-1);
    expect(geo.attributes.aSide.array[1]).toBe(1);
  });
});

describe('spark pool', () => {
  it('recycles round-robin and lets every spark die on schedule', () => {
    const pool = createSparkPool(4);
    for (let i = 0; i < 6; i++) spawnSpark(pool, 0, 0, 0, 0, 1, 0, 0.2, 0.1, 1, 1, 1);
    expect(pool.next).toBe(2);
    expect(stepSparks(pool, 0.1)).toBe(4);
    // Moving, dragged and falling under gravity.
    expect(pool.pos[1]).toBeGreaterThan(0);
    expect(pool.vel[1]).toBeLessThan(1);
    expect(stepSparks(pool, 0.2)).toBe(0);
    expect(Array.from(pool.alpha)).toEqual([0, 0, 0, 0]);
    expect(Array.from(pool.size)).toEqual([0, 0, 0, 0]);
  });

  it('clears every live spark at once', () => {
    const pool = createSparkPool(3);
    spawnSpark(pool, 0, 0, 0, 0, 0, 0, 5, 0.1, 1, 1, 1);
    clearSparks(pool);
    expect(stepSparks(pool, 0.01)).toBe(0);
  });
});
