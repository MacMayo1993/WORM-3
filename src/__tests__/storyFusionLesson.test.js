import { beforeEach, expect, it } from 'vitest';
import { storyLevel, storyOutcome, storyChecklist } from '../worm/story/levels.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { offerStoryPower, recordStoryMechanic, updateMastery, fusionReachableTiles } from '../worm/story/mastery.js';
import { makeWormSim, startElemental, tileKey } from '../worm/healerWorm/wormSim.js';
import { activeFusion } from '../worm/healerWorm/elementalFusion.js';
import { addElementalPatch } from '../worm/healerWorm/elementalGameplay.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { ttPush } from '../worm/circularBuffers.js';
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
  const claim = () => {
    const [orb] = sim.specials.splice(0, 1);
    recordStoryMechanic(p, 'elementPickups', orb.type);
    startElemental(sim, ctx, orb.type);
    return orb;
  };
  p.powerDelay = 0;
  return { level, size, sim, p, offer, claim, ctx };
}

it('offers reachable ordered partners, counts each recipe, and exposes the same completion goals', () => {
  const { level, size, sim, p, offer, claim, ctx } = setup();
  expect(offer()).toBe(true);
  expect(sim.specials[0].type).toBe('water');
  claim();
  expect(offer()).toBe(false); // focus shot is held
  sim.elementalFocusT = 0;
  const won = { alive: true, elapsed: 90, cuts: 0, peakLength: 100, orbs: 18, healed: 3,
    remaining: 0, tailClear: true, landed: true, rotationSettled: true };
  for (const [type, effect] of [['fire', 'steam'], ['water', 'quench']]) {
    expect(offer()).toBe(true); // bypass only the ordinary power cooldown
    const orb = sim.specials[0];
    expect(orb.type).toBe(type);
    expect(orb.ttl).toBe(sim.elementalT);
    expect(fusionReachableTiles(sim, size, p.cubies, level.speed).has(tileKey(orb))).toBe(true);
    expect(sim.powerups.some(food => tileKey(food) === tileKey(orb))).toBe(false);
    expect(p.powerHint).toContain(effect === 'steam' ? 'Water → Fire: Steam' : 'Fire → Water: Quench');
    claim();
    expect(activeFusion(sim)).toBe(effect);
    expect(p.mechanics[`${effect}Fusions`]).toBe(1);
    sim.elementalFocusT = 0;
    const metrics = { ...won, ...p.mechanics };
    expect(!!storyOutcome(level, metrics)).toBe(effect === 'quench');
  }
  startElemental(sim, ctx, 'water'); // same catalyst: refresh only
  expect(p.mechanics.quenchFusions).toBe(1);
  expect(offer()).toBe(false); // goals met: no endless elemental offers
  const metrics = { ...won, ...p.mechanics };
  const outcome = storyOutcome(level, metrics);
  expect(outcome.stars).toBe(3);
  expect(storyChecklist(level, metrics).filter(g => g.key.endsWith('Fusions')).map(g => g.label)).toEqual([
    'Make Steam: Water → Fire', 'Make Quench: Fire → Water',
  ]);
  const hud = storyHudSnapshot(null, level, metrics, 1, outcome);
  metrics.quenchFusions = 0;
  expect(hud.checklist.finishMetrics.quenchFusions).toBe(1);
  expect(stageStory(sim, size, level).mechanics).toEqual({});
});

it('removes a missed catalyst when its base expires and retries without granting credit', () => {
  const { sim, p, offer, claim } = setup();
  offer(); claim(); sim.elementalFocusT = 0;
  sim.elementalT = 5;
  expect(offer()).toBe(true);
  expect(sim.specials[0]).toMatchObject({ type: 'fire', ttl: 5, fusionBase: 'water' });
  sim.elementalT = 0; sim.elementalType = null;
  expect(offer()).toBe(true); // publishes removal to the HUD
  expect(sim.specials).toHaveLength(0);
  expect(p.mechanics.steamFusions).toBeUndefined();
  expect(offer()).toBe(false);
  p.powerDelay = 0;
  expect(offer()).toBe(true);
  expect(sim.specials[0].type).toBe('water');
});

it('waits instead of putting a catalyst behind blocked routes or offering it too late', () => {
  const { sim, size, p, offer, claim } = setup();
  offer(); claim(); sim.elementalFocusT = 0;
  sim.elementalT = 2.9;
  expect(offer()).toBe(false);
  sim.elementalT = 9;
  for (const tile of getAllSurfaceTiles(size)) ttPush(sim.tileTrail, tileKey(tile));
  sim.tailLength = 1200;
  expect(offer()).toBe(false);
  expect(p.lastPower).toBe('water');
  sim.tailLength = 0;
  expect(offer()).toBe(true);
});

it('keeps single-element lessons sequential and awards mastery to both active halves', () => {
  const early = setup(8);
  early.offer(); early.claim(); early.sim.elementalFocusT = 0;
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
