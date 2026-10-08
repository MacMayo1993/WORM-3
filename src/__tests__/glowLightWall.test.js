import { describe, it, expect } from 'vitest';
import { LIGHT, makeCombat, stepCombat, surfacePose, combatKey, surfaceRoute } from '../worm/combat/portalCombat.js';
import { makeGlowTrail, litTiles, LIT_MIN_LIFE } from '../worm/healerWorm/glowTrail.js';
import { makeSignature } from '../worm/healerWorm/signatures.js';
import { ttPush } from '../worm/circularBuffers.js';

const tile = (x = 2, y = 2, dirKey = 'PZ', z = 4) => ({ x, y, z, dirKey });
const keyOf = t => combatKey(t);
// A player who cannot be hurt: these tests are about what the light does to enemies.
const player = (head = tile(0, 2), lit = null) => ({ head, heading: 'right', position: surfacePose(head, head, 0, 5).position,
  protected: true, blocked: false, portalOpen: true, canFinish: true, lit: lit ? () => lit : undefined });
function arena() { const c = makeCombat(5, tile(2, 4)); c.started = true; c.spawnTimer = 999; return c; }
function enemy(c, t = tile(3, 2), extra = {}) {
  const e = { id: ++c.seq, type: 'crawler', hp: 1, tile: t, next: null, t: 0, emerging: 0, stun: 0, ...extra };
  c.enemies.push(e); return e;
}
const ticks = (c, p, n) => { for (let i = 0; i < n; i++) stepCombat(c, 0.05, p); };
const wall = (...tiles) => new Set(tiles.map(keyOf));

describe('Glow Worm light wall: which tiles are lit', () => {
  const sim = (character, life, keys = ['1,1,4,PZ', '2,1,4,PZ', '']) => {
    const signature = Object.assign(makeSignature(), { character, glowTrail: makeGlowTrail() });
    signature.glowTrail.life = life;
    for (const key of keys) ttPush(signature.glowTrail.path, key);
    return { signature };
  };
  it('is exactly the painted route while the paint stands', () => {
    expect([...litTiles(sim('glow', 12))].sort()).toEqual(['1,1,4,PZ', '2,1,4,PZ']);
  });
  it('is gone once the paint has faded, and for any other worm', () => {
    expect(litTiles(sim('glow', 0))).toBeNull();
    expect(litTiles(sim('glow', LIT_MIN_LIFE))).toBeNull();
    expect(litTiles(sim('classic', 12))).toBeNull();
    expect(litTiles({ signature: Object.assign(makeSignature(), { character: 'glow' }) })).toBeNull();
  });
});

describe('Glow Worm light wall: enemies', () => {
  it('burns a crawler that runs into it, and does not let it through', () => {
    const c = arena(), e = enemy(c);
    const lit = wall(tile(2, 2));
    stepCombat(c, 0.05, player(tile(0, 2), lit));
    expect(c.lightHits).toBe(1);
    expect(c.kills).toBe(1);
    expect(c.enemies).toHaveLength(0);
    expect(c.dying).toContain(e);
    expect(c.bursts.some(b => b.kind === 'light' && keyOf(b.tile) === keyOf(tile(2, 2)))).toBe(true);
  });
  it('lets the same enemy walk straight through when nothing is lit', () => {
    const c = arena(), e = enemy(c);
    ticks(c, player(tile(0, 2)), 60);
    expect(c.lightHits).toBe(0);
    expect(c.kills).toBe(0);
    expect(e.tile.x).toBeLessThan(3);
  });
  it('hurts, throws back and stuns a brute, three touches to kill it', () => {
    const c = arena(), e = enemy(c, tile(3, 2), { type: 'brute', hp: 3 });
    const lit = wall(tile(2, 2)), p = player(tile(0, 2), lit);
    const before = surfaceRoute(e.tile, p.head, 5).length;
    stepCombat(c, 0.05, p);
    expect(c.lightHits).toBe(1);
    expect(e.hp).toBe(2);
    expect(e.stun).toBeGreaterThan(0);
    expect(e.knockback).toBe(true);
    expect(keyOf(e.next)).not.toBe(keyOf(tile(2, 2)));          // thrown back, not into the light
    expect(surfaceRoute(e.next, p.head, 5).length).toBeGreaterThan(before);   // away from the player
    // It keeps coming and the light keeps holding it; it never gets across.
    for (let i = 0; i < 1200 && c.enemies.length; i++) {
      stepCombat(c, 0.05, p);
      expect(keyOf(e.tile)).not.toBe(keyOf(tile(2, 2)));
    }
    expect(c.lightHits).toBe(3);
    expect(c.kills).toBe(1);
    expect(c.killsByType.brute).toBe(1);
  });
  it('burns an enemy that is standing in the light, a brute slower than a crawler', () => {
    const lit = wall(tile(3, 2));
    const crawler = arena(); enemy(crawler, tile(3, 2), { stun: 5 });
    const brute = arena(); enemy(brute, tile(3, 2), { type: 'brute', hp: 3, stun: 5 });
    let crawlerDead = null, bruteDead = null;
    for (let i = 1; i <= 100; i++) {
      stepCombat(crawler, 0.05, player(tile(0, 2), lit)); stepCombat(brute, 0.05, player(tile(0, 2), lit));
      if (crawlerDead === null && !crawler.enemies.length) crawlerDead = i * 0.05;
      if (bruteDead === null && !brute.enemies.length) bruteDead = i * 0.05;
    }
    expect(crawlerDead).toBeLessThan(0.8);
    expect(bruteDead).toBeGreaterThan(crawlerDead * 2);
    expect(bruteDead).toBeLessThan(3);
    expect(crawler.lightHits).toBe(0);                          // burning is not a touch
  });
  it('leaves an enemy alone while it is still emerging from the portal', () => {
    const c = arena(), e = enemy(c, tile(3, 2), { emerging: 0.8 });
    ticks(c, player(tile(0, 2), wall(tile(3, 2))), 10);          // 0.5 s
    expect(e.hp).toBe(1);
    expect(c.enemies).toContain(e);
  });
  it('lets a step already past halfway finish, then burns what arrives', () => {
    const c = arena();
    enemy(c, tile(3, 2), { next: tile(2, 2), t: 0.6 });
    const lit = wall(tile(2, 2));
    stepCombat(c, 0.05, player(tile(0, 2), lit));
    expect(c.lightHits).toBe(0);
    ticks(c, player(tile(0, 2), lit), 40);
    expect(c.enemies).toHaveLength(0);                            // it burned in the light
  });
  it('is read once per step and only when an enemy is on the board', () => {
    let reads = 0;
    const p = { ...player(tile(0, 2)), lit: () => { reads++; return null; } };
    const c = arena();
    ticks(c, p, 5);
    expect(reads).toBe(0);
    enemy(c); ticks(c, p, 5);
    expect(reads).toBe(5);
  });
  it('exposes its numbers', () => {
    expect(LIGHT.touch).toBe(1); expect(LIGHT.burn).toBeGreaterThan(1); expect(LIGHT.stun).toBeGreaterThan(0);
  });
});
