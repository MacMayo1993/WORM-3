import { beforeEach, expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel } from '../worm/story/levels.js';
import { stageStory, replenishStoryOrbs } from '../worm/story/runtime.js';
import { offerStoryPower, nextStoryPower, STORY_POWER_COOLDOWN, STORY_POWER_LIFETIME, STORY_POWER_OPENING_DELAY } from '../worm/story/mastery.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { makeGrowthOrb } from '../worm/healerWorm/orbSpawning.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { collectManifoldRing, getActiveTunnels } from '../worm/wormLogic.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { ELEMENTAL_DURATION, MAGNET_RADIUS } from '../worm/healerWorm/constants.js';
import { ttPush } from '../worm/circularBuffers.js';

// Independent checklist of every authored power quest, including required variety.
const POOLS = {
  7: ['magnet', 'rocket'], 8: ['water', 'fire'], 17: ['rocket'], 18: ['explode'],
  20: ['magnet', 'explode', 'water', 'rocket', 'fire'],
  24: ['water', 'fire', 'grass'], 27: ['water', 'fire', 'grass'], 28: ['explode', 'rocket'],
  30: ['magnet', 'explode', 'water', 'fire', 'grass'], 36: ['water', 'fire', 'grass', 'ice'],
  37: ['explode', 'rocket'], 40: ['magnet', 'explode', 'water', 'rocket', 'fire', 'grass', 'ice', 'lightning'],
};
// Generated quests specify the same canonical inventory; keep the authored table above fixed.
for (const level of WORM_STORY_LEVELS.filter(level => level.id > 40)) {
  const m = level.mechanics ?? {}, required = new Set();
  if (m.magnetOrbs) required.add('magnet');
  if (m.explodes) required.add('explode');
  if (m.rockets) required.add('rocket');
  const count = Math.max(m.elements ?? 0, m.uniqueElements ?? 0, m.elementPickups ?? 0);
  for (const element of ['water', 'fire', 'grass', 'ice', 'lightning'].slice(0, count)) required.add(element);
  if (required.size) POOLS[level.id] = ['magnet', 'explode', 'water', 'rocket', 'fire', 'grass', 'ice', 'lightning'].filter(type => required.has(type));
}
beforeEach(() => resetLiveRotation());
function setup(id, character = 'classic') {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  sim.rand = () => 0.42;
  const p = stageStory(sim, size, level, character);
  const offer = () => offerStoryPower(sim, p, level, size, p.cubies);
  const reoffer = () => { sim.specials = []; p.powerDelay = 0; return offer(); };
  return { level, size, sim, p, offer, reoffer };
}

it.each(WORM_STORY_LEVELS)('level $id supplies six colors, every tunnel and recurring quest powers', level => {
  for (const character of ['glow', 'classic']) {
    const { size, sim, p, reoffer } = setup(level.id, character);
    expect(Object.keys(p.orbTargets)).toHaveLength(6);
    expect(new Set(sim.powerups.map(tileKey)).size).toBe(sim.powerups.length);
    const pairs = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
    expect(getActiveTunnels(p.cubies, size).length + p.pendingMouths.length).toBe(pairs);
    // No completed goals: missed magnets/mastery cannot hold other tasks hostage.
    const pool = POOLS[level.id] ?? [];
    if (!pool.length) expect(nextStoryPower(p, level)).toBeNull();
    for (let cycle = 0; cycle < 3; cycle++) {
      const offered = [];
      for (let i = 0; i < pool.length; i++) {
        expect(reoffer()).toBe(true); // includes the original dense opening layout
        expect(sim.specials).toHaveLength(1);
        offered.push(sim.specials[0].type);
      }
      expect(offered).toEqual(pool);
    }
    expect(p.mechanics).toEqual({});
    expect(p.elements.size).toBe(0);
    // Refill after complete depletion, including small boards and large finales.
    sim.specials = []; sim.powerups = []; p.orbRefillDelay = 0;
    expect(replenishStoryOrbs(sim, p, { cubies: p.cubies }, size, 0.1)).toBe(true);
    expect(new Set(sim.powerups.map(o => p.cubies[o.x][o.y][o.z].stickers[o.dirKey].orig)).size).toBe(6);
  }
});

it('level 30 offers Explode second and all three elements without requiring magnet or water success', () => {
  const { sim, p, reoffer } = setup(30);
  const offered = [];
  for (let i = 0; i < 10; i++) { expect(reoffer()).toBe(true); offered.push(sim.specials[0].type); }
  expect(offered).toEqual([...POOLS[30], ...POOLS[30]]);
  p.mechanics.explodes = 1; p.mechanics.magnetOrbs = 4;
  p.collectedElements.add('fire');
  for (const type of ['water', 'grass', 'water', 'grass']) {
    expect(reoffer()).toBe(true); expect(sim.specials[0].type).toBe(type);
  }
  expect(stageStory(sim, 6, storyLevel(30)).lastPower).toBeNull();
});

it.each(Object.keys(POOLS).map(Number))('level %i leaves time for repeated pickup opportunities', id => {
  const { level } = setup(id);
  // A deliberately conservative supply budget: two full missed cycles, then
  // enough full cycles for every count, with the longest effect plus closing
  // recovery on every offer. This excludes routing, fights and tunnel time.
  const m = level.mechanics;
  const cycles = Math.max(2, m.explodes ?? 0, m.rockets ?? 0);
  const missed = 2 * POOLS[id].length * (STORY_POWER_LIFETIME + STORY_POWER_COOLDOWN);
  const attempts = cycles * POOLS[id].length * (ELEMENTAL_DURATION + 4 + STORY_POWER_COOLDOWN);
  expect(STORY_POWER_OPENING_DELAY + missed + attempts).toBeLessThan(level.limit);
});

it('makes room on a face filled with food without spawning on the head, body or a tunnel', () => {
  const { sim, p, size, reoffer } = setup(30);
  sim.powerups = getAllSurfaceTiles(size).filter(t => {
    const s = p.cubies[t.x][t.y][t.z].stickers[t.dirKey];
    return s.curr === s.orig;
  }).map(t => makeGrowthOrb(t));
  p.mechanics.magnetOrbs = 4; // Explode should take a food slot without adding support.
  const count = sim.powerups.length;
  expect(reoffer()).toBe(true);
  expect(sim.specials[0].type).toBe('explode');
  expect(sim.powerups).toHaveLength(count - 1);
  expect(sim.powerups.some(o => tileKey(o) === tileKey(sim.specials[0]))).toBe(false);
  const s = sim.specials[0], sticker = p.cubies[s.x][s.y][s.z].stickers[s.dirKey];
  expect(sticker.curr).toBe(sticker.orig);
  expect(tileKey(s)).not.toBe(tileKey(sim.pos));
});

it('does not skip a quest power when every safe position is blocked by the body', () => {
  const { sim, p, size, reoffer } = setup(30);
  const original = sim.powerups.slice();
  const face = getAllSurfaceTiles(size).filter(t => t.dirKey === sim.pos.dirKey);
  for (const t of face) ttPush(sim.tileTrail, tileKey(t));
  sim.tailLength = 500;
  expect(reoffer()).toBe(false);
  expect(p.lastPower).toBeNull();
  expect(sim.powerups).toEqual(original);
  sim.tailLength = 0;
  expect(reoffer()).toBe(true);
  expect(sim.specials[0].type).toBe('magnet');
});

it('keeps magnet catches in actual reach and bounds support across repeated missed offerings', () => {
  const { sim, p, size, reoffer } = setup(7);
  p.mechanics.rockets = 1;
  sim.powerups = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    // Alternate faces to leave old support far away from the next offering.
    sim.pos = attempt % 2 ? { x: 3, y: 3, z: 0, dirKey: 'NZ' } : { x: 3, y: 3, z: size - 1, dirKey: 'PZ' };
    sim.tailLength = 0;
    expect(reoffer()).toBe(true);
    const orb = sim.specials[0];
    const reach = collectManifoldRing(orb.x, orb.y, orb.z, orb.dirKey, size, MAGNET_RADIUS);
    expect(sim.powerups).toHaveLength(4);
    expect(sim.powerups.every(o => reach.has(tileKey(o)) && tileKey(o) !== tileKey(orb))).toBe(true);
    expect(new Set(sim.powerups.map(tileKey)).size).toBe(4);
  }
});

it('counts existing remote food before allocating magnet support and only supplies outstanding catches', () => {
  const { sim, p, reoffer } = setup(7);
  p.mechanics.rockets = 1; p.mechanics.magnetOrbs = 3;
  sim.powerups = [];
  expect(reoffer()).toBe(true);
  expect(sim.powerups).toHaveLength(1);
  sim.powerups[0].storyMagnet = false; // An ordinary orb already in the catch ring.
  expect(reoffer()).toBe(true);
  expect(sim.powerups).toHaveLength(1);
  expect(sim.powerups[0].storyMagnet).toBe(false);
});
