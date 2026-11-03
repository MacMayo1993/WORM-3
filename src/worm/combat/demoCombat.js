import { ELEMENTS, ENEMIES } from './combatDefs.js';
import { makeCombat, makeEnemy } from './portalCombat.js';

export const isDemoCombatLesson = id => id === 'combat' || id === 'combat-elements';

// A small, deterministic encounter. Physics, aim, shields, recharge, elemental
// drops and enemy AI all remain the live combat engine; only wave spawning is off.
export function makeDemoCombat(size, head, lesson) {
  const lessonId = typeof lesson === 'string' ? lesson : lesson.practiceId ?? lesson.id;
  const portal = { ...head, y: Math.min(size - 1, head.y + 3) };
  const c = makeCombat(size, portal);
  Object.assign(c, { practice: true, started: true, held: true });
  const elemental = lessonId === 'combat-elements';
  const element = ELEMENTS[lesson.combatElement] ? lesson.combatElement : 'ice';
  c.practiceElement = elemental ? element : null;
  const enemyType = ENEMIES[lesson.combatEnemy] ? lesson.combatEnemy : elemental ? 'brute' : 'crawler';
  const enemy = makeEnemy(c, enemyType);
  enemy.emerging = 0;
  c.enemies = [enemy];
  if (elemental) {
    // Collect the requested real colored drop before firing. Every variant
    // uses the normal status effects, damage, movement and reward drops.
    c.drops.push({ id: ++c.seq, tile: { ...head }, life: 9999, element });
  }
  return c;
}

export function readDemoCombat(c, lessonId) {
  if (!c?.practice) return { done: false, progress: 'Preparing the encounter' };
  const elemental = lessonId === 'combat-elements';
  const elementalHits = c.elementalHitsByType?.[c.practiceElement] ?? 0;
  const done = c.kills > 0 && c.shotsHit > 0 && (!elemental || elementalHits > 0);
  const detail = elemental && elementalHits === 0
    ? `Collect the colored drop, then hit the enemy with ${ELEMENTS[c.practiceElement]?.label ?? 'elemental'} shots`
    : c.kills > 0 ? 'Enemy defeated with real shots'
      : 'Face the enemy and hold Fire / F. Jump to dodge';
  return { done, progress: `${detail} · ${c.health}/3 shields · ${c.shotsHit} hits` };
}
