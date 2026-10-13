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

it.each([[13, 'grass', 'earth'], [17, 'air', 'air']])('level %i teaches %s before all-element mastery', (id, type, name) => {
  const { level, sim, p, read } = setup(id);
  expect(id).toBeLessThan(40);
  expect(storyElementTypes(level)).toEqual([type]);
  // An unrelated mastered element cannot satisfy the focused lesson.
  p.elements.add('water'); p.mechanics.rockets = 1;
  expect(read().elements).toBe(0);
  for (let miss = 0; miss < 3; miss++) {
    p.powerDelay = 0; sim.specials = [];
    expect(offerStoryPower(sim, p, level, level.cubeSize, p.cubies)).toBe(true);
    expect(sim.specials.map(orb => orb.type)).toEqual([type]);
  }
  expect(p.powerHint.toLowerCase()).toContain(name);
  expect(level.goal).toContain(`master 1 element (${name})`);
  expect(storyChecklist(level).find(goal => goal.key === 'elements').label).toBe(`Master ${name}`);
  expect(requiredPowerCycle(level)).toContain(type);
  expect(requiredPowerCycle(level)).not.toContain('water');
  expect(levelGoal(level)).toContain(`(${name})`);
  const ctx = { getCubies: () => p.cubies, feel() {}, onElementalTheme() {}, onStoryMechanic: (...args) => recordStoryMechanic(p, ...args) };
  startElemental(sim, ctx, type); sim.elementalFocusT = 0;
  expect(read().elements).toBe(0); // pickup is not mastery
  if (type === 'grass') addElementalPatch(sim, sim.pos, 'grass');
  startJump(sim, ctx, level.cubeSize);
  expect(read().elements).toBe(0); // takeoff is not a completed lesson
  sim.isJumping = false; sim.phase = 'crawling';
  updateMastery(sim, p, level, 0.1);
  expect(read().elements).toBe(1);
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
    sim.specials = []; p.powerDelay = 0;
    expect(offerStoryPower(sim, p, level, level.cubeSize, p.cubies)).toBe(true);
    expect(sim.specials[0].type).toBe(missing);
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
