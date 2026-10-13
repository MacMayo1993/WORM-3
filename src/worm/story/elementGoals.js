import { ELEMENTAL_TYPES, getElementalDef } from '../healerWorm/elementalDefs.js';

export const STORY_ELEMENTS = ELEMENTAL_TYPES;
// Most levels teach the original progression. A focused lesson can instead name
// its own elementTypes; the offers, credit and instructions must use that same set.
export const storyElementTypes = level => level.elementTypes ?? STORY_ELEMENTS;
export const storyElementCount = (elements, target = STORY_ELEMENTS.length, types = STORY_ELEMENTS) =>
  types.slice(0, target).filter(type => elements.has(type)).length;
export function storyElementPool(level) {
  const m = level.mechanics ?? {};
  const count = Math.max(m.uniqueElements ?? 0, m.elements ?? 0, m.elementPickups ?? 0);
  const types = storyElementTypes(level);
  return count ? types.slice(0, count) : types;
}
export const storyElementNames = (level, count) =>
  storyElementTypes(level).slice(0, count).map(type => getElementalDef(type).label.toLowerCase());
