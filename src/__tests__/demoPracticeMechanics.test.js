import { beforeEach, expect, it, vi } from 'vitest';
import { stageWormPractice, readWormPractice } from '../worm/healerWorm/demoPractice.js';
import { makeWormSim, stepWormSim, queueTurn } from '../worm/healerWorm/wormSim.js';
import { SPECIAL_TYPES } from '../worm/healerWorm/specialDefs.js';
import { VIEW_POWER_TYPES } from '../worm/healerWorm/viewPowerups.js';
import { ORDERED_FUSIONS, activeFusion } from '../worm/healerWorm/elementalFusion.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

const size = 5;
function fixture(lesson) {
  const sim = makeWormSim(size), practice = stageWormPractice(sim, size, lesson);
  const state = { wormSessionOrbs: 0 }, control = { paused: false };
  const ctx = {
    getCubies: () => practice.cubies, getGamePhase: () => 'active', isPaused: () => control.paused,
    getSpeed: () => 2, getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999,
    isPrismCharacter: () => false, isStoryMode: () => true, getOrbInventory: () => practice.inventory,
    getHealingProgress: () => ({}), getOrbColor: () => '#fff', resolveTunnel: () => null,
    onOrbPickup: () => state.wormSessionOrbs++,
  };
  for (const key of ['feel', 'onDeath', 'onTunnelEnter', 'onCrawlResume', 'onPhase', 'onBoostState', 'onSurvivalTick',
    'spawnWormholePair', 'onFlippedTile', 'applyDeposit', 'onPowerupsChanged', 'applyHeal',
    'onSpecialsChanged', 'onSpecialSpawned', 'onSpecialExpired', 'onElementalTheme', 'onFusion',
    'onRocketState', 'onMagnetState']) ctx[key] = vi.fn();
  let result = { done: false };
  const tick = () => {
    stepWormSim(sim, .05, size, ctx);
    if (!control.paused) result = readWormPractice(sim, practice, lesson, state, size, .05);
  };
  const until = (predicate, max = 1400) => {
    for (let i = 0; i < max && !predicate(); i++) tick();
    expect(predicate()).toBeTruthy();
  };
  return { sim, practice, state, control, tick, until, done: () => result.done };
}
beforeEach(resetLiveRotation);

it.each(SPECIAL_TYPES)('stages %s through the canonical real pickup path', id => {
  const { sim } = fixture({ id });
  expect(sim.specials[0]).toMatchObject({ type: id, y: 2 });
});

it('launches from a real persistent trampoline and waits for the landing', () => {
  const f = fixture({ id: 'spring' });
  f.until(() => f.sim.isJumping);
  expect(f.sim.springLaunch).toBe(true);
  expect(f.done()).toBe(false);
  f.until(f.done);
  expect(f.sim.bouncePads.size).toBe(1);
  expect(f.sim.alive).toBe(true);
});

it('waits for actual expansion and settling, freezes on pause and resets on retry', () => {
  const f = fixture({ id: 'explode' });
  f.until(() => f.sim.expansionAmount === .6);
  expect(f.done()).toBe(false);
  f.control.paused = true;
  const left = f.sim.explodeT;
  for (let i = 0; i < 60; i++) f.tick();
  expect(f.sim.explodeT).toBe(left);
  f.control.paused = false;
  f.until(f.done);
  expect(f.sim.expansionAmount).toBe(0);
  const reset = stageWormPractice(f.sim, size, { id: 'explode' });
  expect(reset.sawExpansion).toBeUndefined();
  expect(f.sim.explodeT).toBe(0);
  expect(f.sim.specials[0].type).toBe('explode');
});

it.each(VIEW_POWER_TYPES)('experiences %s until the real look timer restores it', id => {
  const f = fixture({ id });
  f.until(() => f.sim.viewPower === id);
  expect(f.done()).toBe(false);
  f.control.paused = true;
  const left = f.sim.viewPowerT;
  for (let i = 0; i < 40; i++) f.tick();
  expect(f.sim.viewPowerT).toBe(left);
  f.control.paused = false;
  f.until(f.done);
  expect(f.sim.viewPower).toBeNull();
});

const stormRecipes = new Set(['conductor', 'plasma', 'current', 'firestorm', 'cryostorm', 'grounded', 'lightning-air']);
const jumpRecipes = new Set(['wildfire', 'geyser', 'ski-jump', 'thunderpad', 'frostbloom', 'water-air', 'air-water', 'fire-air', 'air-fire', 'grass-air', 'air-grass', 'ice-air', 'air-ice', 'air-lightning']);
it.each(Object.values(ORDERED_FUSIONS))('collects $base then $catalyst and plays the real $label fusion', recipe => {
  const lesson = { id: `fusion-${recipe.id}`, practiceId: 'fusion', fusionBase: recipe.base, fusionCatalyst: recipe.catalyst };
  const f = fixture(lesson);
  f.until(() => f.sim.elementalType === recipe.base);
  expect(f.sim.elementalPair).toBeNull();
  expect(f.done()).toBe(false);
  f.until(() => activeFusion(f.sim) === recipe.id);
  expect(f.done()).toBe(false);
  if (stormRecipes.has(recipe.id)) {
    for (let i = 0; i < 80; i++) f.tick();
    expect(f.done()).toBe(false); // Movement and ignition cannot fake storm evidence.
    return;
  }
  if (jumpRecipes.has(recipe.id)) {
    queueTurn(f.sim, 'jump');
    f.until(() => f.sim.isJumping && f.sim.elementalFocusT === 0);
    if (recipe.id === 'water-air') queueTurn(f.sim, 'turnLeft');
    f.until(() => !f.sim.isJumping);
    if (!f.done() && recipe.id === 'wildfire') {
      queueTurn(f.sim, 'jump');
      f.until(() => f.sim.isJumping);
      f.until(() => !f.sim.isJumping);
    }
  }
  if (['slipstream', 'meltdown', 'static'].includes(recipe.id)) {
    f.until(() => f.sim.elementalFocusT === 0 && f.sim.interpT > .25 && f.sim.interpT < .7);
    queueTurn(f.sim, 'turnLeft');
  }
  f.until(f.done);
  expect(f.sim.elementalPair).toBe(recipe.base);
  expect(f.sim.elementalType).toBe(recipe.catalyst);
});

it('requires a flame dash rather than merely waiting with fire active', () => {
  const f = fixture({ id: 'fire' });
  f.until(() => f.sim.elementalType === 'fire' && f.sim.elementalFocusT === 0);
  for (let i = 0; i < 80; i++) f.tick();
  expect(f.done()).toBe(false);
  queueTurn(f.sim, 'boost');
  f.until(() => f.sim.elementalAbilities.fireDashT > 0);
  expect(f.done()).toBe(false);
  f.until(f.done);
});

it('requires the slide-completing drift burst rather than an ordinary jump', () => {
  const f = fixture({ id: 'ice' });
  f.until(() => f.sim.elementalType === 'ice' && f.sim.elementalFocusT === 0);
  queueTurn(f.sim, 'jump'); f.until(() => f.sim.isJumping); f.until(() => !f.sim.isJumping);
  expect(f.done()).toBe(false);
  queueTurn(f.sim, 'turnLeft');
  f.until(() => f.sim.elementalAbilities.driftT > 0);
  f.until(f.done);
});

it('chains all three staged side-lane orbs through real lightning collection', () => {
  const f = fixture({ id: 'lightning' });
  f.until(f.done);
  expect(f.state.wormSessionOrbs).toBe(3);
  expect(f.sim.elementalAbilities.lightningT).toBeGreaterThan(0);
  expect(f.sim.specials).toHaveLength(0);
});

it('uses full water momentum to sweep both neighbouring lanes', () => {
  const f = fixture({ id: 'water' });
  f.until(f.done);
  expect(f.state.wormSessionOrbs).toBe(2);
  expect(f.sim.waterMomentum).toBeGreaterThanOrEqual(.8);
});

it.each(['slipstream', 'meltdown', 'static', 'water-air', 'air-water', 'fire-air', 'air-fire', 'ice-air', 'air-ice', 'air-lightning'])(
  '%s cannot finish from ignition and ordinary crawling alone', id => {
    const recipe = Object.values(ORDERED_FUSIONS).find(r => r.id === id);
    const f = fixture({ id: `fusion-${id}`, practiceId: 'fusion', fusionBase: recipe.base, fusionCatalyst: recipe.catalyst });
    f.until(() => activeFusion(f.sim) === id && f.sim.elementalFocusT === 0);
    for (let i = 0; i < 100; i++) f.tick();
    expect(f.done()).toBe(false);
  });

it('freezes an unfinished fusion exercise on pause and clears its evidence on Retry', () => {
  const lesson = { id: 'fusion-air-water', practiceId: 'fusion', fusionBase: 'air', fusionCatalyst: 'water' };
  const f = fixture(lesson);
  f.until(() => activeFusion(f.sim) === 'air-water' && f.sim.elementalFocusT === 0);
  queueTurn(f.sim, 'jump'); f.until(() => f.sim.isJumping);
  const jump = f.sim.jumpT, left = f.sim.elementalT;
  f.control.paused = true;
  for (let i = 0; i < 40; i++) f.tick();
  expect(f.sim.jumpT).toBe(jump); expect(f.sim.elementalT).toBe(left); expect(f.done()).toBe(false);
  f.control.paused = false; f.until(f.done);
  const reset = stageWormPractice(f.sim, size, lesson);
  expect(reset.reaction).toBeUndefined();
  expect(f.sim.elementalType).toBeNull();
  expect(f.sim.specials.map(p => p.type)).toEqual(['air', 'water']);
});
