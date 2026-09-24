import { expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel } from '../worm/story/levels.js';
import { stageStory } from '../worm/story/runtime.js';
import { updateMastery, offerStoryPower, nextStoryPower, STORY_POWER_OPENING_DELAY, STORY_POWER_COOLDOWN } from '../worm/story/mastery.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
const setup = id => {
  const level = storyLevel(id), size = level.cubeSize ?? 5, sim = makeWormSim(size);
  const p = stageStory(sim, size, level, 'classic');
  const offer = () => offerStoryPower(sim, p, level, size, p.cubies);
  const advance = seconds => { for (let t = 0; t < Math.round(seconds * 100); t++) updateMastery(sim, p, level, 0.01); };
  return { level, size, sim, p, offer, advance };
};
it.each(WORM_STORY_LEVELS)('level $id starts without power-ups and offers required pickups off the straight route', level => {
  const { size, sim, p, offer } = setup(level.id);
  expect(sim.specials).toHaveLength(0);
  expect(offer()).toBe(false);
  if (!nextStoryPower(p, level)) return;
  p.powerDelay = 0;
  // A dense initial orb route may occupy the eligible side tiles until collected.
  sim.powerups = sim.powerups.filter(orb => orb.dirKey !== sim.pos.dirKey);
  expect(offer()).toBe(true);
  let ahead = sim.pos, heading = sim.moveDir;
  for (let step = 0; step <= 3; step++) {
    expect(tileKey(sim.specials[0])).not.toBe(tileKey(ahead));
    ahead = getNextSurfacePosition(ahead, heading, size); heading = ahead.moveDir;
  }
});
it('uses active time for the opening and recovery, including an expired offering', () => {
  const { sim, p, level, offer, advance } = setup(17);
  sim.powerups = [];
  for (let n = 0; n < 1000; n++) updateMastery(sim, p, level, 0); // held / paused time
  expect(p.powerDelay).toBe(STORY_POWER_OPENING_DELAY);
  advance(STORY_POWER_OPENING_DELAY - 0.1); expect(offer()).toBe(false);
  advance(0.2); expect(offer()).toBe(true);
  expect(sim.specials[0].type).toBe('rocket');
  advance(20); expect(p.powerDelay).toBe(STORY_POWER_COOLDOWN);
  sim.specials = []; // expired or missed: no instant replacement
  expect(offer()).toBe(false);
  advance(STORY_POWER_COOLDOWN - 0.1); expect(offer()).toBe(false);
  advance(0.2); expect(offer()).toBe(true);
});
it('waits for the flight and recovery to finish before repeating a required rocket', () => {
  const { sim, p, offer, advance } = setup(37);
  p.mechanics.explodes = 3; sim.powerups = []; p.powerDelay = 0;
  expect(offer()).toBe(true);
  sim.specials = []; sim.rocketActive = true;
  advance(6); expect(offer()).toBe(false);
  sim.rocketActive = false;
  advance(0.01);
  expect(p.mechanics.rockets).toBe(1);
  expect(offer()).toBe(false);
  advance(STORY_POWER_COOLDOWN + 0.01);
  expect(offer()).toBe(true);
  expect(sim.specials[0].type).toBe('rocket');
});
it('introduces calmer required pickups before rockets without starving later objectives', () => {
  const { p, level } = setup(40);
  expect(nextStoryPower(p, level)).toBe('magnet');
  p.mechanics.magnetOrbs = 4;
  for (const element of ['water', 'fire', 'grass', 'ice', 'lightning']) {
    expect(nextStoryPower(p, level)).toBe(element); p.elements.add(element);
  }
  expect(nextStoryPower(p, level)).toBe('explode');
  p.mechanics.explodes = 2;
  expect(nextStoryPower(p, level)).toBe('rocket');
  p.mechanics.rockets = 1;
  expect(nextStoryPower(p, level)).toBeNull();
});
