import { expect, it } from 'vitest';
import { recordCompletedHeal, tickHealChain, STORY_DOUBLE_HEAL_WINDOW } from '../worm/healerWorm/healChain.js';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { storyLevel } from '../worm/story/levels.js';

it('counts distinct consecutive repairs once each and excludes repeat repairs of the same pair', () => {
  const sim = { phase: 'crawling', healChain: null }, events = [];
  const ctx = { getDoubleHealWindow: () => STORY_DOUBLE_HEAL_WINDOW, onStoryMechanic: key => events.push(key) };
  recordCompletedHeal(sim, ctx, 'A');
  recordCompletedHeal(sim, ctx, 'A');
  expect(events).toEqual([]);
  tickHealChain(sim, 19);
  recordCompletedHeal(sim, ctx, 'B', true);
  expect(events).toEqual(['multiHeals']);
  recordCompletedHeal(sim, ctx, 'C');
  expect(events).toHaveLength(2);
  tickHealChain(sim, 20);
  recordCompletedHeal(sim, ctx, 'D');
  expect(events).toHaveLength(2);
});

it('keeps the route window through every tunnel phase and shows its remaining time in the live hint', () => {
  const level = storyLevel(69), sim = makeWormSim(level.cubeSize);
  const p = stageStory(sim, level.cubeSize, level, 'classic');
  const ctx = { getDoubleHealWindow: () => STORY_DOUBLE_HEAL_WINDOW };
  recordCompletedHeal(sim, ctx, 'A');
  for (const phase of ['windup', 'tunnel', 'exiting', 'windout']) {
    sim.phase = phase; tickHealChain(sim, 10);
    expect(sim.healChain.remaining).toBe(20);
  }
  sim.phase = 'crawling'; tickHealChain(sim, 1);
  const read = () => storyMetrics(sim, p, level, { size: level.cubeSize }, [], 0);
  expect(read().powerHint).toContain('within 19s');
  p.mechanics.multiHeals = 1;
  expect(read().powerHint ?? '').not.toContain('Double heal:');
  resetWormSim(sim, level.cubeSize, { orbCount: 0 });
  expect(sim.healChain).toBeNull();
});

it('retains overlap-only behavior when the mode has no story grace window', () => {
  const sim = {}, events = [], ctx = { onStoryMechanic: key => events.push(key) };
  recordCompletedHeal(sim, ctx, 'A'); recordCompletedHeal(sim, ctx, 'B');
  expect(events).toEqual([]);
  recordCompletedHeal(sim, ctx, 'C', true);
  expect(events).toEqual(['multiHeals']);
});
