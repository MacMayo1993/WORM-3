import { describe, it, expect } from 'vitest';
import { makeDemoCombat, readDemoCombat } from '../worm/combat/demoCombat.js';
import { stepCombat, surfacePose } from '../worm/combat/portalCombat.js';
const head = { x: 2, y: 0, z: 4, dirKey: 'PZ' };
const player = () => ({ head, heading: 'up', position: surfacePose(head, head, 0, 5, .2).position,
  portalOpen: true, canFinish: false, blocked: false, protected: false });
const tick = (c, p = player()) => stepCombat(c, .05, p);
describe('live demo combat', () => {
  it('requires a real hit and kill, not a button press or timer', () => {
    const c = makeDemoCombat(5, head, 'combat');
    expect(readDemoCombat(c, 'combat').done).toBe(false);
    c.fireRequested = true; tick(c);
    expect(c.shotsFired).toBe(1);
    expect(readDemoCombat(c, 'combat').done).toBe(false);
    for (let i = 0; i < 15; i++) tick(c);
    expect(c.shotsHit).toBe(1); expect(c.kills).toBe(1);
    expect(readDemoCombat(c, 'combat').done).toBe(true);
    expect(c.won).toBe(false);
    for (let i = 0; i < 500; i++) tick(c);
    expect(c.enemies).toHaveLength(0); expect(c.waveSpawned).toBe(0);
  });
  it('collects a real ice drop, freezes a brute, and defeats it with three hits', () => {
    const c = makeDemoCombat(5, head, 'combat-elements'); tick(c);
    expect(c.dropsCollected).toBe(1); expect(c.element).toBe('ice');
    c.fireRequested = true;
    for (let i = 0; i < 15; i++) tick(c);
    expect(c.enemies[0].freeze).toBeGreaterThan(0);
    expect(readDemoCombat(c, 'combat-elements').done).toBe(false);
    c.fireHeld = true;
    for (let i = 0; i < 40; i++) tick(c);
    expect(c.elementalHits).toBe(3); expect(c.kills).toBe(1);
    expect(readDemoCombat(c, 'combat-elements').done).toBe(true);
  });
  it('holds clocks and discards firing while paused; retry produces clean state', () => {
    const c = makeDemoCombat(5, head, 'combat'); c.fireHeld = true;
    tick(c, { ...player(), blocked: true });
    expect(c.time).toBe(0); expect(c.shotsFired).toBe(0); expect(c.fireHeld).toBe(false);
    c.health = 0; c.shotsHit = 4;
    const fresh = makeDemoCombat(5, head, 'combat');
    expect(fresh.health).toBe(3); expect(fresh.shotsHit).toBe(0);
    expect(fresh.enemies).toHaveLength(1); expect(readDemoCombat(fresh, 'combat').done).toBe(false);
  });
});

it.each(['fire', 'ice', 'water', 'grass', 'air', 'lightning'].flatMap(element =>
  ['crawler', 'scout', 'brute'].map(enemy => [element, enemy])))('plays real %s shots against %s', (element, enemy) => {
  const lesson = { id: `combat-${element}-${enemy}`, practiceId: 'combat-elements', combatElement: element, combatEnemy: enemy };
  const c = makeDemoCombat(5, head, lesson);
  expect(c.enemies[0].type).toBe(enemy);
  tick(c); expect(c.element).toBe(element); c.fireHeld = true;
  for (let i = 0; i < 150 && c.kills === 0; i++) tick(c);
  expect(c.kills).toBe(1);
  expect(c.elementalHitsByType[element]).toBeGreaterThan(0);
  expect(readDemoCombat(c, 'combat-elements').done).toBe(true);
  c.elementalHitsByType = { wrong: 10 };
  expect(readDemoCombat(c, 'combat-elements').done).toBe(false);
});
