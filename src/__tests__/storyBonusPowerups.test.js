import { expect, it } from 'vitest';
import { storyLevel, WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { stageStory } from '../worm/story/runtime.js';
import { offerStoryBonus, offerStoryPower, updateMastery, fusionReachableTiles, STORY_ELEMENTS } from '../worm/story/mastery.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';

function setup(id) {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  const p = stageStory(sim, size, level, 'classic');
  p.bonusDelay = 0; p.powerDelay = 0;
  return { sim, p, level, size, bonus: () => offerStoryBonus(sim, p, level, size, p.cubies),
    quest: () => offerStoryPower(sim, p, level, size, p.cubies) };
}
it.each([3, 7, 18, 21, 40, 80, 120])('level %i cycles bonus powers without needing quest completion', id => {
  const { sim, p, bonus } = setup(id);
  const expected = ['spring', 'orb-shower', ...(id >= 7 ? ['magnet', 'rocket'] : []), ...(id >= 18 ? ['explode'] : []), ...(id >= 21 ? ['view'] : [])];
  for (let cycle = 0; cycle < 2; cycle++) for (const type of expected) {
    p.bonusDelay = 0;
    expect(bonus()).toBe(true);
    expect(sim.specials).toHaveLength(1);
    expect(sim.specials[0].storyBonus).toBe(true);
    expect(sim.specials[0].type.startsWith(type)).toBe(true);
    expect(sim.powerups.map(tileKey)).not.toContain(tileKey(sim.specials[0]));
    expect(bonus()).toBe(false);
    sim.specials = [];
  }
  expect(p.mechanics).toEqual({});
});
it('preserves a live bonus when a required power spawns, without delaying quest recovery', () => {
  const { sim, p, level, bonus, quest } = setup(30);
  expect(bonus()).toBe(true);
  const spring = sim.specials[0];
  expect(quest()).toBe(true);
  expect(sim.specials[0].type).toBe('magnet');
  expect(sim.specials).toContain(spring);
  sim.specials.shift(); p.powerDelay = 0.1;
  updateMastery(sim, p, level, 0.1);
  expect(p.powerDelay).toBe(0);
  expect(quest()).toBe(true);
  expect(sim.specials[0].type).toBe('explode');
  expect(sim.specials).toContain(spring);
});
it('keeps introductory levels and ordered fusion windows clear, and freezes bonus timing at zero delta', () => {
  for (const id of [1, 2, 24]) expect(setup(id).bonus()).toBe(false);
  const { sim, p, level } = setup(3);
  delete p.bonusDelay;
  updateMastery(sim, p, level, 0);
  expect(p.bonusDelay).toBe(6);
  for (let i = 0; i < 60; i++) updateMastery(sim, p, level, 0.1);
  expect(p.bonusDelay).toBeCloseTo(0);
});
it.each(WORM_STORY_LEVELS.filter(l => l.mechanics?.uniqueElements || l.mechanics?.elements || l.mechanics?.elementPickups))('level $id places elemental offers across faces with a timed route for the partner', level => {
  const { sim, p, size, quest } = setup(level.id);
  p.mechanics = { magnetOrbs: 999, rockets: 999, explodes: 999 };
  expect(quest()).toBe(true);
  const [first, second] = sim.specials;
  expect(STORY_ELEMENTS).toContain(first.type);
  expect(first.dirKey).not.toBe(sim.pos.dirKey);
  if (second) {
    expect(second.dirKey).not.toBe(first.dirKey);
    expect(fusionReachableTiles({ ...sim, pos: first, elementalT: 10 }, size, p.cubies, level.speed).has(tileKey(second))).toBe(true);
  }
});
