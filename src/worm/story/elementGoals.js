import { ELEMENTAL_TYPES, getElementalDef } from '../healerWorm/elementalDefs.js';

export const STORY_ELEMENTS = ELEMENTAL_TYPES;
// A focused lesson names its own elementTypes (and a level whose story is told
// around particular elements pins them the same way). Every other level deals
// its elements afresh on each attempt: stageStory rolls `practice.elementOrder`
// and the offers, credit, checklist and hints all read that one order.
const DEALT_GOALS = ['elements', 'uniqueElements', 'elementPickups', 'fusions', 'uniqueFusions'];
export const STORY_ELEMENT_GOALS = [...DEALT_GOALS, 'steamFusions', 'quenchFusions'];
export const hasStoryElementGoal = level => STORY_ELEMENT_GOALS.some(key => level.mechanics?.[key] > 0);
export const storyElementsRandom = level => !level.elementTypes && DEALT_GOALS.some(key => level.mechanics?.[key]);
/** This attempt's element order, or null for a level that names its own (or asks for none). */
export function rollStoryElements(level, rand = Math.random) {
  if (!storyElementsRandom(level)) return null;
  const order = STORY_ELEMENTS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
export const storyElementTypes = (level, order = null) => level.elementTypes ?? order ?? STORY_ELEMENTS;
export const storyElementCount = (elements, target = STORY_ELEMENTS.length, types = STORY_ELEMENTS) =>
  types.slice(0, target).filter(type => elements.has(type)).length;
export function storyElementPool(level, order = null) {
  const m = level.mechanics ?? {};
  const count = Math.max(m.uniqueElements ?? 0, m.elements ?? 0, m.elementPickups ?? 0);
  const types = storyElementTypes(level, order);
  return count ? types.slice(0, count) : types;
}
export const storyElementNames = (level, count, order = null) =>
  storyElementTypes(level, order).slice(0, count).map(type => getElementalDef(type).label.toLowerCase());
