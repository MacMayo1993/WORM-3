import { expect, it } from 'vitest';
import { ELEMENTAL_TYPES, getElementalDef } from '../worm/healerWorm/elementalDefs.js';
import { readWormPractice } from '../worm/healerWorm/demoPractice.js';
import { getFusion, hasElement, fusionEffect } from '../worm/healerWorm/elementalFusion.js';
import { fusionFeedback } from '../worm/healerWorm/elementalFeedback.js';
import { makeWormSim, startElemental, startJump } from '../worm/healerWorm/wormSim.js';
import { addElementalPatch } from '../worm/healerWorm/elementalGameplay.js';
import { stageStory } from '../worm/story/runtime.js';
import { storyLevel } from '../worm/story/levels.js';
import { offerStoryPower, recordStoryMechanic, updateMastery, STORY_ELEMENTS } from '../worm/story/mastery.js';

function setup(id = 64) {
  const level = storyLevel(id), sim = makeWormSim(level.cubeSize);
  const practice = stageStory(sim, level.cubeSize, level, 'classic');
  const ctx = { feel() {}, onElementalTheme() {}, onStoryMechanic: (...a) => recordStoryMechanic(practice, ...a) };
  return { level, sim, practice, ctx };
}
it('keeps Earth save compatibility and appends Air after authored element prefixes', () => {
  expect(getElementalDef('grass').label).toBe('Earth');
  expect(getElementalDef('air').label).toBe('Air');
  expect(ELEMENTAL_TYPES).toEqual(STORY_ELEMENTS);
  expect(storyLevel(40).mechanics.elements).toBe(5);
  expect(storyLevel(64).mechanics.uniqueElements).toBe(6);
});
it('maps Fire then Water to Steam and the reverse to Quench', () => {
  expect(getFusion('fire', 'water').id).toBe('steam');
  expect(getFusion('water', 'fire').id).toBe('quench');
});
it('boosts both jumps without compounding and stops boosting when Air expires', () => {
  const { sim, ctx } = setup();
  startJump(sim, ctx);
  const normal = { height: sim.jumpHeight, span: sim.jumpSpan };
  sim.isJumping = false; sim.jumpCount = 0; sim.jumpT = 0;
  startElemental(sim, ctx, 'air');
  startJump(sim, ctx);
  expect(sim.jumpHeight).toBeCloseTo(normal.height * 1.4);
  expect(sim.jumpSpan).toBeCloseTo(normal.span * 1.35);
  startJump(sim, ctx);
  expect(sim.jumpCount).toBe(2);
  expect(sim.jumpHeight).toBeCloseTo(normal.height * 1.4);
  expect(sim.jumpSpan).toBeCloseTo(normal.span * 1.35);
  sim.elementalT = 0; sim.isJumping = false; sim.jumpCount = 0; sim.jumpT = 0;
  startJump(sim, ctx);
  expect(sim.jumpHeight).toBe(normal.height);
  expect(sim.jumpSpan).toBe(normal.span);
});
it.each(ELEMENTAL_TYPES.filter(type => type !== 'air'))('combines Air with %s in both orders and describes both mechanics', other => {
  for (const [base, catalyst] of [[other, 'air'], ['air', other]]) {
    const { sim, ctx } = setup();
    startElemental(sim, ctx, base); startElemental(sim, ctx, catalyst);
    expect(hasElement(sim, base)).toBe(true);
    expect(hasElement(sim, catalyst)).toBe(true);
    const recipe = getFusion(base, catalyst);
    expect(fusionEffect(recipe)).toBe(recipe.id);
    expect(recipe.rule).toBe(true);
    expect(fusionFeedback(recipe, {}).text).not.toBe(fusionFeedback(getFusion(catalyst, base), {}).text);
    expect(fusionFeedback(recipe, {}).text).not.toContain('undefined');
  }
});
it('combines an Earth spring pad with Air lift', () => {
  const { sim, ctx } = setup();
  startElemental(sim, ctx, 'grass'); startElemental(sim, ctx, 'air');
  addElementalPatch(sim, sim.pos, 'grass');
  startJump(sim, ctx);
  expect(sim.springLaunch).toBe(true);
  expect(sim.jumpHeight).toBeCloseTo(1.8 * 1.4);
  expect(sim.jumpSpan).toBeCloseTo(2.2 * 1.35);
});
it('offers Air for a missing sixth element, and awards mastery only after landing', () => {
  const { sim, ctx, practice, level } = setup(70);
  practice.elements = new Set(STORY_ELEMENTS.slice(0, 5));
  practice.mechanics = { fusions: 999 }; practice.viewOffered = true; practice.powerDelay = 0;
  expect(offerStoryPower(sim, practice, level, level.cubeSize, practice.cubies)).toBe(true);
  expect(sim.specials.some(s => s.type === 'air')).toBe(true);
  startElemental(sim, ctx, 'air'); sim.elementalFocusT = 0;
  updateMastery(sim, practice, level, 0.1);
  expect(practice.elements.has('air')).toBe(false);
  startJump(sim, ctx);
  updateMastery(sim, practice, level, 0.1);
  expect(practice.elements.has('air')).toBe(false);
  sim.isJumping = false; sim.phase = 'crawling';
  updateMastery(sim, practice, level, 0.1);
  expect(practice.elements.has('air')).toBe(true);
});

it('finishes the Air demo only after an Air jump lands alive', () => {
  const { sim } = setup();
  const practice = { elementTime: 0 }, lesson = { id: 'air' };
  sim.phase = 'crawling'; sim.elementalType = 'air'; sim.elementalT = 10;
  expect(readWormPractice(sim, practice, lesson, {}, 7, 0.05).done).toBeFalsy();
  sim.isJumping = true;
  expect(readWormPractice(sim, practice, lesson, {}, 7, 0.05).done).toBe(false);
  sim.isJumping = false; sim.alive = false;
  expect(readWormPractice(sim, practice, lesson, {}, 7, 0.05).done).toBe(false);
  sim.alive = true;
  expect(readWormPractice(sim, practice, lesson, {}, 7, 0.05).done).toBe(true);
});
