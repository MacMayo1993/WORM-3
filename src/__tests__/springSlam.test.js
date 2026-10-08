import { describe, it, expect } from 'vitest';
import { SLAM, makeCombat, stepCombat, surfacePose, surfaceRoute } from '../worm/combat/portalCombat.js';
import { springSlamTiles } from '../worm/healerWorm/jumpLanding.js';
import { isBombSlammed } from '../worm/healerWorm/bombs.js';

const tile = (x = 2, y = 2, dirKey = 'PZ', z = 4) => ({ x, y, z, dirKey });
const head = tile(0, 2);
const slamAt = (at, seq = 1) => ({ seq, tile: at });
const player = slam => ({ head, heading: 'right', position: surfacePose(head, head, 0, 5).position,
  protected: true, blocked: false, portalOpen: true, canFinish: true, slam });
function arena() { const c = makeCombat(5, tile(2, 4)); c.started = true; c.spawnTimer = 999; return c; }
function enemy(c, t, extra = {}) {
  const e = { id: ++c.seq, type: 'crawler', hp: 1, tile: t, next: null, t: 0, emerging: 0, stun: 0, ...extra };
  c.enemies.push(e); return e;
}

describe("Inch Worm's Spring landing: enemies", () => {
  it('knocks out a crawler within a tile of the landing, and leaves one beyond it', () => {
    const c = arena(), far = enemy(c, tile(4, 4));   // a few tiles off
    enemy(c, tile(1, 3));                            // diagonal neighbour of the landing
    stepCombat(c, 0.05, player(slamAt(tile(0, 2))));
    expect(c.slamHits).toBe(1);
    expect(c.kills).toBe(1);
    expect(c.enemies).toEqual([far]);
    expect(far.hp).toBe(1); expect(far.stun).toBe(0);
    expect(c.bursts.some(b => b.kind === 'slam')).toBe(true);
  });
  it('hurts, stuns and throws back a brute instead of killing it', () => {
    const c = arena(), e = enemy(c, tile(1, 2), { type: 'brute', hp: 3 });
    const before = surfaceRoute(e.tile, head, 5).length;
    stepCombat(c, 0.05, player(slamAt(tile(0, 2))));
    expect(e.hp).toBe(3 - SLAM.damage);
    expect(e.stun).toBeGreaterThan(1);
    expect(e.knockback).toBe(true);
    expect(surfaceRoute(e.next, head, 5).length).toBeGreaterThan(before);
    expect(c.enemies).toContain(e);
  });
  it('takes each landing once, and leaves an enemy still emerging alone', () => {
    const c = arena(), brute = enemy(c, tile(1, 2), { type: 'brute', hp: 3 }), rising = enemy(c, tile(0, 3), { emerging: 0.8 });
    const slam = slamAt(tile(0, 2));
    stepCombat(c, 0.05, player(slam));
    expect(brute.hp).toBe(2); expect(rising.hp).toBe(1);
    for (let i = 0; i < 4; i++) stepCombat(c, 0.05, player(slam));    // the window outlives the frame it began on
    expect(brute.hp).toBe(2); expect(c.slamHits).toBe(1);
    stepCombat(c, 0.05, player(slamAt(tile(0, 2), 2)));              // a new landing is a new slam
    expect(c.slamHits).toBeGreaterThan(1);
  });
  it('does nothing without a landing', () => {
    const c = arena(); enemy(c, tile(1, 2));
    stepCombat(c, 0.05, player(null));
    expect(c.slamHits).toBe(0); expect(c.enemies).toHaveLength(1);
  });
});

describe("Inch Worm's Spring landing: bombs", () => {
  const ring = springSlamTiles({ x: 1, y: 1, z: 2, dirKey: 'PZ' }, 3);
  it('defuses a bomb on or beside the landing tile only', () => {
    const bomb = (x, y) => ({ tile: { x, y, z: 2, dirKey: 'PZ' } });
    expect(isBombSlammed(bomb(1, 1), ring)).toBe(true);
    expect(isBombSlammed(bomb(2, 2), ring)).toBe(true);          // diagonal
    expect(isBombSlammed(bomb(1, 0), ring)).toBe(true);
    expect(ring.size).toBe(9);                                   // the landing and the eight around it
    expect(isBombSlammed({ tile: { x: 0, y: 0, z: 0, dirKey: 'NZ' } }, ring)).toBe(false);
    expect(isBombSlammed({ tile: { x: 1, y: 1, z: 0, dirKey: 'NZ' } }, ring)).toBe(false);   // the far side of the cube
    expect(isBombSlammed(bomb(1, 1), null)).toBe(false);
  });
});
