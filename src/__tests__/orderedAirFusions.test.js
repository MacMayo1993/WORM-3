import { beforeEach, expect, it } from 'vitest';
import { makeWormSim, resetWormSim, startElemental, startJump, stepWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { activeFusion } from '../worm/healerWorm/elementalFusion.js';
import { airFusionLanding, airFusionStep } from '../worm/healerWorm/airFusionGameplay.js';
import { addElementalPatch, tickElementalGameplay, waterSpeedBonus, turnShedsMomentum, iceHoldsTurn } from '../worm/healerWorm/elementalGameplay.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
const SIZE = 5;
beforeEach(resetLiveRotation);
function setup(base, catalyst) {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  const noop = () => {};
  const ctx = { feel: noop, onElementalTheme: noop, onStoryMechanic: noop,
    getSpeed: () => 1, getCubies: () => null, getGamePhase: () => 'active', isPaused: () => false,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({}), getHealingProgress: () => ({}), getOrbColor: () => '#22ff88',
    resolveTunnel: () => null, onDeath: noop, onTunnelEnter: noop, onCrawlResume: noop, onPhase: noop,
    onBoostState: noop, onRocketState: noop, onMagnetState: noop, onSurvivalTick: noop,
    spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: noop, onOrbPickup: noop,
    onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop, onSpecialSpawned: noop, onSpecialExpired: noop };
  startElemental(sim, ctx, base); startElemental(sim, ctx, catalyst);
  sim.elementalFocusT = 0; sim.tailLength = 0; sim.fusionBursts.length = 0;
  return { sim, ctx };
}
function land(sim, ctx) {
  sim.isJumping = true; sim.jumpT = 0.99999;
  stepWormSim(sim, 0.05, SIZE, ctx);
  expect(sim.isJumping).toBe(false);
}
it('Sea Breeze carries momentum through airborne turns; Rainwind instead refills and douses on landing', () => {
  const breeze = setup('water','air'), rain = setup('air','water');
  for (const {sim} of [breeze,rain]) { sim.isJumping = true; sim.waterMomentum = 0.5; tickElementalGameplay(sim, 0.5); }
  expect(breeze.sim.waterMomentum).toBeGreaterThan(0.5);
  expect(rain.sim.waterMomentum).toBeLessThan(0.5);
  expect(turnShedsMomentum(breeze.sim)).toBe(false);
  expect(turnShedsMomentum(rain.sim)).toBe(true);
  expect(waterSpeedBonus(breeze.sim)).toBe(0.4);
  expect(waterSpeedBonus(rain.sim)).toBe(0.25);
  land(rain.sim,rain.ctx);
  expect(rain.sim.waterMomentum).toBe(1);
  expect(rain.sim.fusionBursts.at(-1)).toMatchObject({recipe:'air-water',defuse:true,hit:'stun'});
  land(breeze.sim,breeze.ctx);
  expect(breeze.sim.fusionBursts).toHaveLength(0);
  expect(turnShedsMomentum(breeze.sim)).toBe(true);
});
it('Updraft boosts hot-ground launches; Bellows paints long-lived fire during actual airborne steps', () => {
  const up = setup('fire','air'), bellows = setup('air','fire');
  for (const {sim,ctx} of [up,bellows]) { addElementalPatch(sim,sim.pos,'fire'); startJump(sim,ctx,SIZE); }
  expect(up.sim.jumpSpan).toBeCloseTo(bellows.sim.jumpSpan+1);
  expect(up.sim.jumpHeight).toBeCloseTo(bellows.sim.jumpHeight+1.2);
  const previous = tileKey(bellows.sim.pos);
  bellows.sim.elementalPatches.clear();
  for (let i=0;i<60 && tileKey(bellows.sim.pos)===previous;i++) stepWormSim(bellows.sim,0.02,SIZE,bellows.ctx);
  expect(bellows.sim.elementalPatches.get(previous)).toMatchObject({type:'fire'});
  expect(bellows.sim.elementalPatches.get(previous).ttl).toBeGreaterThan(5);
  up.sim.elementalPatches.clear(); airFusionStep(up.sim);
  expect(up.sim.elementalPatches.size).toBe(0);
  // A mid-air second jump cannot repeatedly harvest the same hot launch tile.
  startJump(up.sim,up.ctx,SIZE); startJump(bellows.sim,bellows.ctx,SIZE);
  expect(up.sim.jumpHeight).toBeCloseTo(bellows.sim.jumpHeight);
});
it('Dust Devil stuns at spring takeoff; Highlands grows charged pads after actual landings', () => {
  const dust = setup('grass','air'), high = setup('air','grass');
  for (const {sim,ctx} of [dust,high]) { addElementalPatch(sim,sim.pos,'grass'); startJump(sim,ctx,SIZE); }
  expect(dust.sim.fusionBursts.at(-1)).toMatchObject({recipe:'grass-air',hit:'stun'});
  expect(dust.sim.fusionBursts.at(-1).tiles.length).toBeGreaterThan(9);
  expect(high.sim.fusionBursts).toHaveLength(0);
  land(high.sim,high.ctx); land(dust.sim,dust.ctx);
  expect(high.sim.elementalPatches.get(tileKey(high.sim.pos))).toMatchObject({charged:true,ttl:12});
  expect(high.sim.fusionBursts).toHaveLength(0); // Highlands grants no landing stun.
  expect(dust.sim.elementalPatches.get(tileKey(dust.sim.pos)).charged).toBeUndefined();
  startJump(high.sim,high.ctx,SIZE); startJump(dust.sim,dust.ctx,SIZE);
  expect(high.sim.jumpHeight).toBeGreaterThan(dust.sim.jumpHeight);
});
it('Snowdrift freezes beneath flight; Polar Wind frees ground steering and freezes at takeoff', () => {
  const snow = setup('ice','air'), polar = setup('air','ice');
  for (const {sim} of [snow,polar]) sim.interpT = 0.5;
  expect(iceHoldsTurn(snow.sim,0.01,0.4)).toBe(true);
  expect(iceHoldsTurn(polar.sim,0.01,0.4)).toBe(false);
  for (const {sim,ctx} of [snow,polar]) startJump(sim,ctx,SIZE);
  expect(polar.sim.fusionBursts.at(-1)).toMatchObject({recipe:'air-ice',hit:'freeze'});
  expect(polar.sim.elementalPatches.size).toBe(9);
  expect([...polar.sim.elementalPatches.values()].every(p=>p.ttl===3)).toBe(true);
  expect(snow.sim.elementalPatches.size).toBe(0);
  airFusionStep(snow.sim);
  expect(snow.sim.elementalPatches.get(tileKey(snow.sim.pos))).toMatchObject({type:'frost',ttl:7});
  polar.sim.elementalPatches.clear(); airFusionStep(polar.sim);
  expect(polar.sim.elementalPatches.size).toBe(0);
});
it('Stormwind discharges a lethal cross on landing; Thunderhead does not', () => {
  const storm = setup('air','lightning'), thunder = setup('lightning','air');
  land(storm.sim,storm.ctx); land(thunder.sim,thunder.ctx);
  expect(storm.sim.fusionBursts.at(-1)).toMatchObject({recipe:'air-lightning',hit:'kill',lightning:true});
  expect(storm.sim.fusionBursts.at(-1).tiles).toHaveLength(9);
  expect(thunder.sim.fusionBursts.filter(b => b.kind === 'air-reaction')).toHaveLength(0);
  expect(thunder.sim.fusionBursts.filter(b => b.kind === 'element-discharge')).toHaveLength(1);
});
it('a third element and expiry immediately stop the previous Air reaction', () => {
  const {sim,ctx} = setup('air','fire'); sim.isJumping = true;
  startElemental(sim,ctx,'ice');
  expect(activeFusion(sim)).toBe('coldfire');
  sim.elementalPatches.clear(); airFusionStep(sim);
  expect(sim.elementalPatches.size).toBe(0);
  const rain = setup('air','water'); rain.sim.elementalT = 0; rain.sim.waterMomentum = 0.2;
  airFusionLanding(rain.sim,SIZE);
  expect(rain.sim.waterMomentum).toBe(0.2);
  expect(rain.sim.fusionBursts).toHaveLength(0);
});
it('paused simulation cannot repeat landing bursts or air trails', () => {
  const {sim,ctx} = setup('air','lightning');
  sim.isJumping = true; sim.jumpT = 0.99999; ctx.isPaused = () => true;
  for (let i=0;i<10;i++) stepWormSim(sim,0.05,SIZE,ctx);
  expect(sim.fusionBursts).toHaveLength(0);
  ctx.isPaused = () => false; land(sim,ctx);
  expect(sim.fusionBursts.filter(b => b.kind === 'air-reaction')).toHaveLength(1);
  expect(sim.fusionBursts.filter(b => b.kind === 'element-discharge')).toHaveLength(1);
  stepWormSim(sim,0.01,SIZE,ctx);
  expect(sim.fusionBursts.filter(b => b.kind === 'air-reaction')).toHaveLength(1);
  expect(sim.fusionBursts.filter(b => b.kind === 'element-discharge')).toHaveLength(1);
});
