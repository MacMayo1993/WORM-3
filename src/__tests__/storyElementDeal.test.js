import { describe, expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyChecklist } from '../worm/story/levels.js';
import { stageStory } from '../worm/story/runtime.js';
import { nextStoryPower } from '../worm/story/mastery.js';
import { STORY_ELEMENTS, rollStoryElements, storyElementsRandom } from '../worm/story/elementGoals.js';
import { storyHudSnapshot } from '../worm/story/hudSnapshot.js';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';

const stage = id => {
  const level = storyLevel(id), sim = makeWormSim(level.cubeSize);
  return { level, sim, p: stageStory(sim, level.cubeSize, level, 'classic') };
};

describe('Story deals its elements per attempt', () => {
  it('deals every element exactly once, reproducibly from the run randomness', () => {
    const level = storyLevel(27);
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const order = rollStoryElements(level, rand);
    expect([...order].sort()).toEqual([...STORY_ELEMENTS].sort());
    seed = 7;
    expect(rollStoryElements(level, rand)).toEqual(order);
  });

  it('gives a replayed level different elements from attempt to attempt', () => {
    const firsts = new Set(), triples = new Set();
    for (let attempt = 0; attempt < 60; attempt++) {
      const { p } = stage(27);
      firsts.add(p.elementOrder[0]);
      triples.add(p.elementOrder.slice(0, 3).sort().join());
    }
    expect(firsts.size).toBeGreaterThanOrEqual(4);
    expect(triples.size).toBeGreaterThanOrEqual(6);
  });

  it('keeps the elements a level names itself, and deals none where no goal asks for them', () => {
    for (const level of WORM_STORY_LEVELS) {
      const { p } = stage(level.id);
      if (level.elementTypes) expect(p.elementOrder).toBeNull();
      expect(!!p.elementOrder).toBe(storyElementsRandom(level));
    }
    // The elements tutorial, and the levels whose story names water and fire.
    for (const id of [8, 13, 17, 48, 83]) expect(storyLevel(id).elementTypes).toBeTruthy();
    // Steam and Quench lessons take their elements from the recipe.
    expect(stage(24).p.elementOrder).toBeNull();
  });

  it('offers the dealt elements first and names them in the live checklist', () => {
    const { level, p } = stage(27);
    const dealt = p.elementOrder.slice(0, 3);
    expect(nextStoryPower(p, level)).toBe(dealt[0]);
    const goal = storyChecklist(level, { elementOrder: p.elementOrder }).find(g => g.key === 'elements');
    const names = { grass: 'earth' };
    expect(goal.label).toBe(`Master ${dealt.map(type => names[type] ?? type).join(', ')}`);
  });

  it('says the elements are random before a run, and names fixed ones', () => {
    expect(storyLevel(27).goal).toContain('master 3 random elements');
    expect(storyChecklist(storyLevel(30)).find(g => g.key === 'uniqueElements').label).toBe('Collect 3 random elements');
    expect(storyLevel(8).goal).toContain('collect 3 different elements (water, fire and earth)');
    expect(storyLevel(64).goal).toContain('collect all 6 different elements');
  });

  it('rebuilds the HUD labels when a retry deals new elements', () => {
    const level = storyLevel(27), metrics = { elapsed: 0, elements: 0 };
    const first = storyHudSnapshot(null, level, { ...metrics, elementOrder: ['ice', 'air', 'fire', 'water', 'grass', 'lightning'] }, 1, null);
    const retry = storyHudSnapshot(first, level, { ...metrics, elementOrder: ['water', 'lightning', 'grass', 'ice', 'air', 'fire'] }, 1, null);
    const label = snapshot => snapshot.checklist.goals.find(g => g.key === 'elements').label;
    expect(label(first)).toBe('Master ice, air, fire');
    expect(label(retry)).toBe('Master water, lightning, earth');
  });
});
