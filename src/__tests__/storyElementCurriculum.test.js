import { expect, it } from 'vitest';
import { storyLevel, storyChecklist } from '../worm/story/levels.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { STORY_ELEMENTS, storyElementTypes } from '../worm/story/elementGoals.js';
import { nextStoryPower, offerStoryPower, recordStoryMechanic, updateMastery } from '../worm/story/mastery.js';
import { makeWormSim, startElemental, startJump } from '../worm/healerWorm/wormSim.js';
import { addElementalPatch } from '../worm/healerWorm/elementalGameplay.js';
import { requiredPowerCycle, levelGoal } from '../../tools/worm-level-auditor/web/generator.js';
import { schemaErrors } from '../../tools/worm-level-auditor/scripts/generator-engine.mjs';
import { STORY_WORLDS } from '../worm/story/worlds.js';

function setup(id) {
  const level = storyLevel(id), sim = makeWormSim(level.cubeSize);
  const p = stageStory(sim, level.cubeSize, level, 'classic');
  const read = () => storyMetrics(sim, p, level, { size: level.cubeSize, cubies: p.cubies }, [], 0.1);
  return { level, sim, p, read };
}

it('requires Earth in the opening collection lesson, even after duplicate or unrelated pickups', () => {
  const { level, p, read } = setup(8);
  for (const type of ['water', 'fire', 'fire', 'air']) recordStoryMechanic(p, 'elementPickups', type);
  expect(read().uniqueElements).toBe(2);
  expect(nextStoryPower(p, level)).toBe('grass');
  recordStoryMechanic(p, 'elementPickups', 'grass');
  expect(read().uniqueElements).toBe(3);
  expect(level.goal).toContain('water, fire and earth');
});

it.each([[13, 'grass', 'earthSprings'], [17, 'air', 'airJumps']])('level %i teaches %s as an explicit action lesson', (id, type, key) => {
  const { level, sim, p, read } = setup(id);
  expect(id).toBeLessThan(40);
  expect(storyElementTypes(level)).toEqual([type]);
  // An unrelated activation cannot satisfy an explicit action lesson.
  p.elements.add('water'); p.mechanics.rockets = 1;
  expect(read()[key] ?? 0).toBe(0);
  for (let miss = 0; miss < 3; miss++) {
    p.powerDelay = 0; p.elementSupplyDelay = 0; sim.specials = [];
    expect(offerStoryPower(sim, p, level, level.cubeSize, p.cubies)).toBe(true);
    expect(sim.specials.map(orb => orb.type)).toContain(type);
  }
  expect(p.powerHint).toContain('All six elements');
  expect(level.goal).toContain(type === 'grass' ? 'land 1 Earth spring jump' : 'land 1 Air jump');
  expect(storyChecklist(level).find(goal => goal.key === key).label).toContain('Land');
  expect(requiredPowerCycle(level)).toContain(type);
  expect(requiredPowerCycle(level)).not.toContain('water');
  expect(levelGoal(level)).toContain(type === 'grass' ? 'Earth spring jump' : 'Air jump');
  const ctx = { getCubies: () => p.cubies, feel() {}, onElementalTheme() {}, onStoryMechanic: (...args) => recordStoryMechanic(p, ...args) };
  startElemental(sim, ctx, type); sim.elementalFocusT = 0;
  expect(read()[key] ?? 0).toBe(0); // activation is not an explicit jump lesson
  if (type === 'grass') addElementalPatch(sim, sim.pos, 'grass');
  startJump(sim, ctx, level.cubeSize);
  expect(read()[key] ?? 0).toBe(0); // takeoff is not a completed lesson
  sim.isJumping = false; sim.phase = 'crawling';
  updateMastery(sim, p, level, 0.1);
  expect(read()[key]).toBe(1);
  expect(nextStoryPower(p, level)).toBeNull();
});

it.each([40, 64, 69, 70, 100, 106, 113, 120])('level %i requires and supplies all six, including Earth and Air', id => {
  const { level, sim, p, read } = setup(id);
  const key = id === 64 ? 'uniqueElements' : 'elements';
  expect(level.mechanics[key]).toBe(STORY_ELEMENTS.length);
  expect(requiredPowerCycle(level)).toEqual(expect.arrayContaining(STORY_ELEMENTS));
  expect(storyChecklist(level).find(goal => goal.key === key).label).toContain('all 6 elements');
  for (const missing of ['grass', 'air']) {
    p.mechanics = { ...level.mechanics }; p.fusionIds = new Set(Array.from({ length: 30 }, (_, i) => i));
    p.elements = new Set(STORY_ELEMENTS.filter(type => type !== missing));
    p.collectedElements = new Set(p.elements);
    expect(read()[key]).toBe(5);
    expect(storyChecklist(level, read()).find(goal => goal.key === key).done).toBe(false);
    expect(nextStoryPower(p, level)).toBe(missing);
    // A center under the staged head may be blocked; the missing type must
    // get a turn on the next refill even before that center is clear.
    const offered = new Set();
    for (let attempt = 0; attempt < 2; attempt++) {
      sim.specials = []; p.powerDelay = 0; p.elementSupplyDelay = 0;
      expect(offerStoryPower(sim, p, level, level.cubeSize, p.cubies)).toBe(true);
      sim.specials.forEach(orb => offered.add(orb.type));
    }
    expect(offered.has(missing)).toBe(true);
    p.elements.add(missing); p.collectedElements.add(missing);
    expect(read()[key]).toBe(6);
  }
});

it('accepts six-element generated goals and rejects seven or an undersized authored set', () => {
  const config = { ...storyLevel(70) }, world = STORY_WORLDS[70];
  expect(schemaErrors({ config, world })).toEqual([]);
  expect(schemaErrors({ config: { ...config, mechanics: { elements: 7 } }, world })).toContain('There are only 6 supported elemental types.');
  expect(schemaErrors({ config: { ...config, elementTypes: ['air'], mechanics: { elements: 2 } }, world })).toContain('Element target exceeds the authored element set.');
});
