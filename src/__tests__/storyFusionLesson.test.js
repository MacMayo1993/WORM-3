import { beforeEach, expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyOutcome, storyChecklist } from '../worm/story/levels.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { STORY_ELEMENTS, nextStoryPower, offerStoryPower, recordStoryMechanic, updateMastery } from '../worm/story/mastery.js';
import { makeWormSim, startElemental, tileKey } from '../worm/healerWorm/wormSim.js';
import { activeFusion } from '../worm/healerWorm/elementalFusion.js';
import { addElementalPatch } from '../worm/healerWorm/elementalGameplay.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { makeTileTrail, ttPush } from '../worm/circularBuffers.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { storyHudSnapshot } from '../worm/story/hudSnapshot.js';
import { assess, requiredPowerCycles } from '../../tools/worm-level-auditor/web/audit.js';
import { requiredPowerCycle } from '../../tools/worm-level-auditor/web/generator.js';

beforeEach(resetLiveRotation);
function setup(id = 24) {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  const p = stageStory(sim, size, level, 'classic');
  const offer = () => offerStoryPower(sim, p, level, size, p.cubies);
  const ctx = { feel() {}, onElementalTheme() {}, onStoryMechanic: (...args) => recordStoryMechanic(p, ...args) };
  const claim = type => {
    const index = type ? sim.specials.findIndex(orb => orb.type === type) : 0;
    expect(index).toBeGreaterThanOrEqual(0);
    const [orb] = sim.specials.splice(index, 1);
    recordStoryMechanic(p, 'elementPickups', orb.type);
    startElemental(sim, ctx, orb.type);
    return orb;
  };
  p.powerDelay = 0; p.elementSupplyDelay = 0;
  return { level, size, sim, p, offer, claim, ctx };
}

it('offers all six choices for ordered lessons and counts both real recipe orders', () => {
  const { level, sim, p, offer, claim, ctx } = setup();
  expect(offer()).toBe(true);
  expect(sim.specials.map(o => o.type)).toEqual(expect.arrayContaining(STORY_ELEMENTS));
  expect(p.powerHint).toContain('Water → Fire: Quench');
  expect(p.powerHint).toContain('Fire → Water: Steam');
  claim('water'); sim.elementalFocusT = 0;
  expect(offer()).toBe(false); // existing choices remain through the reveal/recovery
  claim('fire'); sim.elementalFocusT = 0;
  expect(activeFusion(sim)).toBe('quench');
  expect(p.mechanics.quenchFusions).toBe(1);
  p.elementSupplyDelay = 0;
  expect(offer()).toBe(true); // replenish Water during the Fire effect
  claim('water'); sim.elementalFocusT = 0;
  expect(activeFusion(sim)).toBe('steam');
  expect(p.mechanics.steamFusions).toBe(1);
  startElemental(sim, ctx, 'water'); // same catalyst refresh is not a second fusion
  expect(p.mechanics.steamFusions).toBe(1);
  const won = { alive: true, elapsed: 90, cuts: 0, peakLength: 100, orbs: level.orbs, healed: level.target,
    remaining: 0, tailClear: true, landed: true, rotationSettled: true, ...p.mechanics };
  const outcome = storyOutcome(level, won);
  expect(outcome.stars).toBe(3);
  const hud = storyHudSnapshot(null, level, won, 1, outcome);
  won.quenchFusions = 0;
  expect(storyOutcome(level, won)).toBeNull();
  expect(hud.checklist.finishMetrics.quenchFusions).toBe(1);
  expect(stageStory(sim, level.cubeSize, level).mechanics).toEqual({});
});

it('keeps uncollected elemental choices after an effect expires without granting fusion credit', () => {
  const { sim, p, offer, claim } = setup();
  offer(); claim('water'); sim.elementalFocusT = 0;
  const fire = sim.specials.find(orb => orb.type === 'fire');
  sim.elementalT = 0; sim.elementalType = null;
  offer();
  expect(sim.specials).toContain(fire);
  expect(p.mechanics.steamFusions).toBeUndefined();
  expect(p.mechanics.quenchFusions).toBeUndefined();
  p.elementSupplyDelay = 0;
  expect(offer()).toBe(true);
  expect(sim.specials.some(orb => orb.type === 'water')).toBe(true);
});

it('waits instead of putting center choices inside a blocked body', () => {
  const { sim, size, p, offer } = setup();
  sim.tileTrail = makeTileTrail(6 * size * size);
  for (const tile of getAllSurfaceTiles(size)) ttPush(sim.tileTrail, tileKey(tile));
  sim.tailLength = 10000;
  expect(offer()).toBe(false);
  expect(p.elementSupplyCursor).toBe(0);
  sim.tailLength = 0;
  expect(offer()).toBe(true);
});

it('offers six choices in introductory lessons and awards mastery to both active fusion halves', () => {
  const early = setup(8);
  early.offer();
  expect(early.sim.specials.map(o => o.type)).toEqual(expect.arrayContaining(STORY_ELEMENTS));
  early.claim('water'); early.sim.elementalFocusT = 0;
  expect(early.offer()).toBe(false);
  const { sim, p, level, ctx } = setup(40);
  startElemental(sim, ctx, 'water'); startElemental(sim, ctx, 'fire');
  sim.elementalFocusT = 0; sim.waterMomentum = 1;
  addElementalPatch(sim, sim.pos, 'fire');
  for (let i = 0; i < 31; i++) updateMastery(sim, p, level, 0.1);
  expect(p.elements.has('water')).toBe(true);
  expect(p.elements.has('fire')).toBe(true);
  const metrics = storyMetrics(sim, p, level, { size: level.cubeSize, rotationEpoch: 0, wormSessionOrbs: 0 }, [], 0);
  expect(metrics.elements).toBe(2);
});

it('audits ordered supply and budgets repeated fusion quantities', () => {
  const { level } = setup();
  expect(requiredPowerCycle(level)).toEqual(['water', 'fire']);
  expect(requiredPowerCycles({ mechanics: { steamFusions: 200 } })).toBe(400);
  const record = { config: level, objectives: storyChecklist(level), stages: { glow: {
    powerCycle: ['water', 'fire'], initialOrbs: 60, totalPairs: 3, activePairs: 3, pendingPairs: 0, refillSixColors: true,
  } }, timing: { opening: 10, lifetime: 20, cooldown: 3, elementDuration: 10 },
    completionContract: { acceptsComplete: true, rejectsMissingGoals: true } };
  expect(assess(record).rows.filter(row => row.key.endsWith('Fusions')).every(row => row.state === 'playtest')).toBe(true);
  expect(assess(record, 'glow', { disabledPowers: ['fire'] }).status).toBe('impossible');
  expect(assess({ ...record, config: { ...level, mechanics: { steamFusions: 200 } } }).status).toBe('undersupplied');
});

it.each([30, 40])('offers six separate face-center choices for fusion practice in level %i', id => {
  const { sim, p, offer, claim } = setup(id);
  p.mechanics = { magnetOrbs: 999, explodes: 999, rockets: 999 };
  p.viewOffered = true;
  expect(offer()).toBe(true);
  expect(sim.specials.map(o => o.type)).toEqual(expect.arrayContaining(STORY_ELEMENTS));
  expect(new Set(sim.specials.map(tileKey)).size).toBe(6);
  expect(new Set(sim.specials.map(o => o.dirKey)).size).toBe(6);
  for (const orb of sim.specials) expect(sim.powerups.map(tileKey)).not.toContain(tileKey(orb));
  expect(p.powerHint).toContain('All six elements');
  expect(offer()).toBe(false);
  const first = claim('water'); sim.elementalFocusT = 0;
  const second = claim('fire');
  expect(sim.elementalPair).toBe(first.type);
  expect(sim.elementalType).toBe(second.type);
  expect(p.mechanics.elementPickups).toBe(2);
});

const prefixLevels = WORM_STORY_LEVELS.filter(level => level.id >= 21 &&
  [3, 4].includes(level.mechanics?.uniqueElements ?? level.mechanics?.elements));
it.each(prefixLevels)('level $id keeps the last required element available alongside all six choices', level => {
  const { sim, p, offer } = setup(level.id);
  const key = level.mechanics.uniqueElements ? 'uniqueElements' : 'elements';
  // This attempt's deal decides which elements the goal asks for.
  const required = (p.elementOrder ?? STORY_ELEMENTS).slice(0, level.mechanics[key]);
  p.mechanics = { ...level.mechanics };
  p.collectedElements = new Set(required.slice(0, -1));
  p.elements = new Set(required.slice(0, -1));
  expect(offer()).toBe(true);
  expect(sim.specials.map(orb => orb.type)).toContain(required.at(-1));
  const companion = sim.specials.find(orb => orb.type !== required.at(-1));
  // Taking only the companion must not complete the remaining identity goal.
  recordStoryMechanic(p, 'elementPickups', companion.type);
  p.elements.add(companion.type);
  expect(nextStoryPower(p, level)).toBe(required.at(-1));
});

it.each(prefixLevels)('level $id rejects unrelated elements as substitutes for its authored prefix', level => {
  const { sim, p, size } = setup(level.id);
  const key = level.mechanics.uniqueElements ? 'uniqueElements' : 'elements';
  const order = p.elementOrder ?? STORY_ELEMENTS, count = level.mechanics[key], required = order.slice(0, count);
  p.mechanics = { ...level.mechanics };
  sim.combat = { kills: level.mechanics.kills ?? 0 };
  p.collectedElements = new Set([...required.slice(0, -1), order[count]]);
  p.elements = new Set(p.collectedElements);
  const read = () => storyMetrics(sim, p, level, { size, rotationEpoch: 0, wormSessionOrbs: 0 }, [], 0);
  // Every other task is complete; only the element identity goal is in question.
  const won = { alive: true, elapsed: 1, landed: true, tailClear: true, rotationSettled: true, remaining: 0,
    ...Object.fromEntries(storyChecklist(level, { elementOrder: p.elementOrder }).filter(goal => goal.key !== key).map(goal => [goal.key, goal.target])) };
  expect(read()[key]).toBe(count - 1);
  expect(storyOutcome(level, { ...read(), ...won })).toBeNull();
  expect(nextStoryPower(p, level)).toBe(required.at(-1));
  recordStoryMechanic(p, 'elementPickups', required.at(-1));
  p.elements.add(required.at(-1));
  expect(read()[key]).toBe(count);
  expect(storyOutcome(level, { ...read(), ...won })).not.toBeNull();
});
