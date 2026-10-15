import { expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyOutcome } from '../worm/story/levels.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { STORY_ELEMENTS, nextStoryPower, offerStoryPower, recordStoryMechanic, updateMastery } from '../worm/story/mastery.js';
import { hasStoryElementGoal } from '../worm/story/elementGoals.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { makeWormSim, startElemental, startJump, tileKey } from '../worm/healerWorm/wormSim.js';

function setup(id = 69) {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  const p = stageStory(sim, size, level, 'classic');
  p.elements = new Set(['water', 'fire', 'ice', 'lightning']);
  p.powerDelay = 0; p.elementSupplyDelay = 0; p.viewOffered = true;
  const ctx = { getCubies: () => p.cubies, feel() {}, onElementalTheme() {},
    onStoryMechanic: (...args) => recordStoryMechanic(p, ...args) };
  return { level, size, sim, p, ctx, offer: () => offerStoryPower(sim, p, level, size, p.cubies) };
}

function clearCenters(sim, p, size) {
  sim.pos = { x: 0, y: 0, z: size - 1, dirKey: 'PZ' }; sim.prevTile = null; sim.tailLength = 0;
  for (const t of getAllSurfaceTiles(size)) {
    const sticker = p.cubies[t.x][t.y][t.z].stickers[t.dirKey];
    sticker.curr = sticker.orig;
  }
}

it.each(WORM_STORY_LEVELS.filter(hasStoryElementGoal))('level $id offers all six at face centers, even after its element tasks finish', level => {
  const { sim, p, size, offer } = setup(level.id);
  clearCenters(sim, p, size);
  p.mechanics = { ...level.mechanics }; p.elements = new Set(STORY_ELEMENTS); p.collectedElements = new Set(STORY_ELEMENTS);
  for (let round = 0; round < 3; round++) {
    expect(offer()).toBe(true);
    const elements = sim.specials.filter(o => o.storyCenterElement);
    expect(elements.map(o => o.type).sort()).toEqual([...STORY_ELEMENTS].sort());
    expect(new Set(elements.map(o => o.dirKey)).size).toBe(6);
    for (const orb of elements) {
      const axis = orb.dirKey.at(-1).toLowerCase();
      for (const key of ['x', 'y', 'z'].filter(k => k !== axis))
        expect([Math.floor((size - 1) / 2), Math.ceil((size - 1) / 2)]).toContain(orb[key]);
      expect(sim.powerups.map(tileKey)).not.toContain(tileKey(orb));
    }
    expect(offer()).toBe(false); // no duplicates
    sim.specials = []; p.elementSupplyDelay = 0;
  }
});

it('waits for the pickup cooldown even when the center-supply timer is already ready', () => {
  const { sim, p, size, offer, ctx } = setup();
  clearCenters(sim, p, size); offer();
  const first = sim.specials.shift(), others = sim.specials.slice();
  startElemental(sim, ctx, first.type); sim.elementalFocusT = 0;
  expect(offer()).toBe(false); // recovery
  for (let i = 0; i < 31; i++) updateMastery(sim, p, storyLevel(69), 0.1);
  expect(sim.elementalClaimCooldown).toBe(15);
  expect(offer()).toBe(false);
  sim.elementalClaimCooldown = 0.01; expect(offer()).toBe(false);
  sim.elementalClaimCooldown = 0;
  expect(offer()).toBe(true);
  expect(sim.specials).toHaveLength(6);
  for (const orb of others) expect(sim.specials).toContain(orb);
  expect(sim.specials.at(-1).type).toBe(first.type);
  expect(sim.specials.at(-1).id).not.toBe(first.id);
});

it('cycles every element when only one center is safe, without putting pickups in tunnels', () => {
  const { sim, p, size, offer } = setup();
  clearCenters(sim, p, size);
  for (const t of getAllSurfaceTiles(size)) if (t.dirKey !== 'PX') {
    const sticker = p.cubies[t.x][t.y][t.z].stickers[t.dirKey]; sticker.curr = -1;
  }
  const seen = new Set();
  for (let n = 0; n < 12; n++) {
    p.elementSupplyDelay = 0; sim.specials = [];
    expect(offer()).toBe(true);
    expect(sim.specials).toHaveLength(1);
    expect(sim.specials[0].dirKey).toBe('PX');
    seen.add(sim.specials[0].type);
  }
  expect([...seen].sort()).toEqual([...STORY_ELEMENTS].sort());
});

it('keeps the elemental opening/refill clock frozen when gameplay time is held', () => {
  const { sim, p, level, offer } = setup();
  p.elementSupplyDelay = 10;
  for (let i = 0; i < 100; i++) updateMastery(sim, p, level, 0);
  expect(p.elementSupplyDelay).toBe(10); expect(offer()).toBe(false);
});

it('keeps the active Earth action visible while an Air companion remains uncollected', () => {
  const { sim, p, offer, ctx, size } = setup();
  sim.specials = [{ ...sim.pos, type: 'air' }];
  startElemental(sim, ctx, 'grass', size);
  sim.elementalFocusT = 0;
  offer();
  expect(p.powerHint).toContain('Earth: jump from a spring patch and land safely');
  expect(p.powerHint).not.toContain('Air:');
});

it('finishes level 69 elemental mastery after real Earth and Air launches land', () => {
  const { level, size, sim, p, ctx, offer } = setup();
  const completed = { alive: true, elapsed: 100, healed: level.target, remaining: 0, tailClear: true,
    rotationSettled: true, landed: true, orbs: level.orbs, rotations: level.rotations, multiHeals: 1 };
  const outcome = () => storyOutcome(level, { ...completed, elements: storyMetrics(sim, p, level, { size, cubies: p.cubies }, [], 0).elements });
  expect(outcome()).toBeNull();
  for (const type of ['grass', 'air']) {
    startElemental(sim, ctx, type, size); sim.elementalFocusT = 0;
    offer();
    expect(p.powerHint).toContain(type === 'grass' ? 'Earth:' : 'Air:');
    if (type === 'air') expect(p.powerHint).toContain('release Jump and land');
    startJump(sim, ctx, size);
    updateMastery(sim, p, level, 0.1);
    expect(p.elements.has(type)).toBe(false);
    expect(outcome()).toBeNull();
    sim.isJumping = false; sim.jumpCount = 0; sim.jumpT = 0;
    updateMastery(sim, p, level, 0.1);
    expect(p.elements.has(type)).toBe(true);
  }
  expect(nextStoryPower(p, level)).toBeNull();
  expect(outcome()).not.toBeNull();
  expect(stageStory(sim, size, level, 'classic').lastElementCompanion).toBeNull();
});

it('clears all elemental choices during fusion while preserving unrelated pickups', () => {
  const { sim, p, size, offer, ctx } = setup();
  clearCenters(sim, p, size); offer();
  const bonus = { ...sim.pos, type: 'spring', storyBonus: true, ttl: 20 };
  sim.specials.push(bonus);
  startElemental(sim, ctx, 'air');
  startElemental(sim, ctx, 'fire');
  expect(sim.specials).toEqual([bonus]);
  sim.elementalFocusT = 0; sim.elementalClaimCooldown = 0; p.elementSupplyDelay = 0;
  for (let n = 0; n < 20; n++) expect(offer()).toBe(false);
  expect(sim.specials).toEqual([bonus]);
  // Also clean stale/restored elemental orbs on the first story update.
  sim.specials.push({ ...sim.pos, type: 'water' });
  expect(offer()).toBe(true); expect(sim.specials).toEqual([bonus]);
  sim.elementalT = 0;
  expect(offer()).toBe(true);
  expect(sim.specials.filter(o => o.storyCenterElement)).toHaveLength(6);
});
