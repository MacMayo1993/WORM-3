import { expect, it } from 'vitest';
import { storyLevel, storyOutcome } from '../worm/story/levels.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { STORY_ELEMENTS, nextStoryPower, offerStoryPower, recordStoryMechanic, updateMastery } from '../worm/story/mastery.js';
import { makeWormSim, startElemental, startJump } from '../worm/healerWorm/wormSim.js';

function setup() {
  const level = storyLevel(69), size = level.cubeSize, sim = makeWormSim(size);
  const p = stageStory(sim, size, level, 'classic');
  p.elements = new Set(['water', 'fire', 'ice', 'lightning']);
  p.powerDelay = 0;
  const ctx = { getCubies: () => p.cubies, feel() {}, onElementalTheme() {},
    onStoryMechanic: (...args) => recordStoryMechanic(p, ...args) };
  return { level, size, sim, p, ctx, offer: () => offerStoryPower(sim, p, level, size, p.cubies) };
}

it.each([STORY_ELEMENTS, [...STORY_ELEMENTS].reverse(), ['grass', 'air', 'lightning', 'water', 'ice', 'fire']])(
  'keeps all six elements available when level 69 only needs Earth and Air (deal %j)', (...order) => {
    const { sim, p, offer, ctx } = setup();
    p.elementOrder = order;
    for (let round = 0; round < 2; round++) {
      const offered = new Set();
      for (let n = 0; n < STORY_ELEMENTS.length; n++) {
        sim.specials = []; sim.elementalT = 0; sim.elementalFocusT = 0; p.powerDelay = 0;
        expect(offer()).toBe(true);
        expect(sim.specials).toHaveLength(2);
        const [primary, companion] = sim.specials;
        expect(['grass', 'air']).toContain(primary.type);
        expect(companion.type).not.toBe(primary.type);
        sim.specials.forEach(orb => offered.add(orb.type));
        // Alternate missed offers and collecting both halves of the pair.
        if (n % 2) for (const orb of sim.specials) startElemental(sim, ctx, orb.type);
      }
      expect([...offered].sort()).toEqual([...STORY_ELEMENTS].sort());
      expect(p.elements.size).toBe(4); // spawning/collecting does not grant mastery
    }
  },
);

it('keeps the active Earth action visible while an Air companion remains uncollected', () => {
  const { sim, p, offer, ctx, size } = setup();
  sim.specials = [{ ...sim.pos, type: 'air' }];
  startElemental(sim, ctx, 'grass', size);
  sim.elementalFocusT = 0;
  expect(offer()).toBe(false);
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
