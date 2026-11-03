import { FUSION_PRACTICE_GOALS } from '../worm/healerWorm/demoFusionPractice.js';
import { DEMO_SIGNATURE_LESSONS } from './demoSignatureLessons.js';
import { VIEW_POWER_DEFS } from '../worm/healerWorm/viewPowerups.js';
import { ORDERED_FUSIONS } from '../worm/healerWorm/elementalFusion.js';
import { ELEMENTAL_DEFS } from '../worm/healerWorm/elementalDefs.js';

// The opening DEMO is a playable highlight reel, not the entire training course.
// The scene picker makes the complete catalogue available without gating it.
export const WORM_SHOWCASE_IDS = [
  'collect-heal', 'body-jump', 'surround', 'rocket', 'explode', 'fire',
  'fusion-slipstream', 'air', 'combat', 'combat-elements', 'bomb', 'rotation', 'signature',
];
export const EXTRA_DEMO_LESSONS = [
  ...DEMO_SIGNATURE_LESSONS,
  ...Object.keys(ELEMENTAL_DEFS).flatMap(element => ['crawler', 'scout', 'brute'].map(enemy => ({
    id: `combat-${element}-${enemy}`, practiceId: 'combat-elements', combatElement: element, combatEnemy: enemy,
    chapter: 'Portal defense', title: `${ELEMENTAL_DEFS[element].label} vs ${enemy}`,
    instruction: `Collect the ${ELEMENTAL_DEFS[element].label} drop. Steer to face the ${enemy}, then hold FIRE. Land elemental shots and defeat it. Jump to dodge contact.`,
    success: `Your ${ELEMENTAL_DEFS[element].label} shots hit and defeated the ${enemy}. Keep playing to collect its drop or choose another matchup.`,
  }))),
  { id: 'tunnel-collapse', chapter: 'Repair the ship', title: 'The last ride', instruction: 'This tunnel has already been ridden twice. You have no healing charges. JUMP onto the pad for its third ride, then keep moving until the tail clears. Watch both mouths collapse into pits.', success: 'Third ride complete: both mouths became real pits. Jump or turn away from collapsed mouths in a live run.' },
  { id: 'core-pass', chapter: 'Repair the ship', title: 'Pass yourself in the Core', instruction: 'Your practice tail is already long. JUMP onto the pad. As your head reaches the exit, press JUMP again toward the next pad ahead while your tail is still inside the Core. Keep moving until the second ride finishes.', success: 'You passed your own tail inside the Core and exited safely. Interior crossings follow different rules from biting your tail on the surface.' },
  { id: 'collect-heal', chapter: 'Repair the ship', title: 'Grow, ride, restore', instruction: 'Keep straight and collect both orbs. Then JUMP onto the marked pad, ride through the Core and keep moving until your tail clears.', success: 'You earned the charges, crossed the Core and sealed both mouths with your own tail.' },
  { id: 'spring', chapter: 'Power-up playground', title: 'Ride a trampoline', instruction: 'Keep straight onto the trampoline. Ride the whole launch arc and land safely.', success: 'Your whole body followed the spring arc. The trampoline stays on the board for another lap.' },
  { id: 'explode', chapter: 'Power-up playground', title: 'Open up the cube', instruction: 'Collect Explode. Keep crawling as the cube opens wide, your body bridges the gaps, and the pieces settle back together.', success: 'You crossed the expanded cube and watched it settle. Jumps, tunnel exits and turns can hold its timer.' },
  ...Object.entries(VIEW_POWER_DEFS).map(([id, def]) => ({ id, chapter: 'Living cube views', title: def.label, instruction: `Collect the ${def.label} orb, then steer around the transformed cube until its original look returns.`, success: 'That was a real timed view pickup. Movement and healing rules stay the same while the look changes.' })),
  ...Object.values(ORDERED_FUSIONS).map(recipe => ({
    id: `fusion-${recipe.id}`, practiceId: 'fusion', chapter: 'Fusion lab',
    fusionBase: recipe.base, fusionCatalyst: recipe.catalyst,
    title: recipe.label,
    instruction: `Collect ${ELEMENTAL_DEFS[recipe.base].label} first, then ${ELEMENTAL_DEFS[recipe.catalyst].label}. ${FUSION_PRACTICE_GOALS[recipe.id]}`,
    success: `${recipe.label} reaction demonstrated. ${recipe.description}`,
  })),
  { id: 'combat', chapter: 'Portal defense', title: 'Return fire', instruction: 'Steer toward the enemy to aim. Hold FIRE to shoot. Defeat the crawler with real hits; keep moving to avoid contact.', success: 'Crawler defeated. Shots, hits and the enemy defeat came from the same combat system used in a live run.' },
  { id: 'combat-elements', chapter: 'Portal defense', title: 'Elemental firepower', instruction: 'Collect the Ice drop, steer to aim, then hold FIRE. Freeze and defeat the armored enemy with elemental shots.', success: 'Elemental hits confirmed and enemy defeated. Elements change your weapon as well as your movement.' },
];
export const WORM_DEMO_LESSON_COUNT = 23 + EXTRA_DEMO_LESSONS.length;
export function demoChapter(lesson) {
  if (lesson.chapter) return lesson.chapter;
  if (['steer', 'orbs', 'jump', 'body-jump', 'double-jump', 'boost'].includes(lesson.id)) return 'Move and grow';
  if (['caution-fall', 'caution-rescue', 'tunnel', 'heal', 'surround'].includes(lesson.id)) return 'Repair the ship';
  if (['water', 'fire', 'grass', 'ice', 'lightning', 'air'].includes(lesson.id)) return 'Elemental powers';
  if (['bomb', 'rotation'].includes(lesson.id)) return 'Survive the hazards';
  if (lesson.id === 'signature') return 'Character abilities';
  return 'Power-up playground';
}
