import { beforeEach, describe, expect, it } from 'vitest';
import { makeWormSim, resetWormSim, stepWormSim } from '../worm/healerWorm/wormSim.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { recordStoryMechanic, nextStoryPower, offerStoryPower, STORY_ELEMENTS } from '../worm/story/mastery.js';
import { storyLevel, storyChecklist, storyOutcome, storyProgressText } from '../worm/story/levels.js';
import { storyGrowthTarget } from '../worm/story/starGoals.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { makeCubies } from '../game/cubeState.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { ttAt } from '../worm/circularBuffers.js';
import { tunnelTailReach } from '../worm/healerWorm/tunnelTrail.js';
import { resetLiveRotation, liveRotation } from '../worm/liveRotation.js';
import { WORM_LIFT } from '../worm/healerWorm/constants.js';
import { getFusion } from '../worm/healerWorm/elementalFusion.js';

const SIZE = 3;
beforeEach(() => { resetLiveRotation(); liveRotation.active = false; });

function makeCtx(overrides = {}) {
  const events = [];
  const log = type => (...args) => { events.push({ type, args }); };
  return {
    events,
    getCubies: () => null, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88', resolveTunnel: () => null,
    feel: log('feel'), onDeath: log('death'), onTunnelEnter: log('tunnelEnter'), onCrawlResume: log('crawlResume'),
    onPhase: log('phase'), onBoostState: log('boost'), onSurvivalTick: log('survival'), spawnWormholePair: log('spawn'),
    onFlippedTile: log('flipped'), applyDeposit: log('deposit'), onOrbPickup: log('pickup'), onPowerupsChanged: log('powerups'),
    applyHeal: log('heal'), onSpecialsChanged: log('specials'), onRocketState: log('rocketState'), onMagnetState: log('magnetState'),
    onSpecialSpawned: log('specialSpawned'), onSpecialExpired: log('specialExpired'), onStoryMechanic: log('mechanic'),
    ...overrides,
  };
}
const mechanics = (ctx, key) => ctx.events.filter(e => e.type === 'mechanic' && e.args[0] === key);
function runUntil(sim, ctx, predicate, maxSeconds = 30, dt = 0.05) {
  for (let i = 0; i < Math.round(maxSeconds / dt); i++) {
    stepWormSim(sim, dt, SIZE, ctx);
    if (predicate()) return true;
  }
  return false;
}
function flippedWorld() {
  const cubies = makeCubies(SIZE);
  const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' }, exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
  cubies[1][2][2].stickers.PZ.curr = 4;
  cubies[1][0][0].stickers.NZ.curr = 1;
  return { cubies, tunnel: { entry, exit, entryColor: 4, exitColor: 1 }, tunnelKey: 'first' };
}
function makeSim(tailLength) {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  sim.tailLength = tailLength;
  return sim;
}

describe('passing yourself in the Core', () => {
  // Ride one tunnel, then dive into the next while the body is still inside.
  function secondDive(tailLength) {
    const { cubies, tunnel, tunnelKey } = flippedWorld();
    const sim = makeSim(tailLength);
    let route = { tunnel, tunnelKey };
    const ctx = makeCtx({ getCubies: () => cubies, resolveTunnel: () => route });
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling' && sim.tunnelPassages.length > 0)).toBe(true);
    expect(mechanics(ctx, 'selfPasses')).toHaveLength(0); // the first ride had nothing to pass
    const passage = sim.tunnelPassages[0];
    // Open a second door just ahead of the head, on the far side of the cube.
    const next = getNextSurfacePosition(sim.pos, sim.moveDir, SIZE);
    const sticker = cubies[next.x][next.y][next.z].stickers[next.dirKey];
    sticker.curr = sticker.orig === 1 ? 2 : 1;
    const far = { x: SIZE - 1 - next.x, y: SIZE - 1 - next.y, z: SIZE - 1 - next.z, dirKey: { PX: 'NX', NX: 'PX', PY: 'NY', NY: 'PY', PZ: 'NZ', NZ: 'PZ' }[next.dirKey] };
    route = { tunnel: { entry: { ...next }, exit: far, entryColor: sticker.curr, exitColor: sticker.orig }, tunnelKey: 'second' };
    return { sim, ctx, passage };
  }

  it('credits a dive taken while the tail still rides the first tunnel, once the head is crawling again', () => {
    const { sim, ctx, passage } = secondDive(100);
    expect(runUntil(sim, ctx, () => sim.phase === 'windup', 5)).toBe(true);
    expect(sim.tunnelPassages).toContain(passage);
    expect(sim.selfPassPending).toBe(true);
    expect(mechanics(ctx, 'selfPasses')).toHaveLength(0); // not on the dive itself
    // crawling.enter() publishes the resume on the tick after the phase flips.
    const resumes = () => ctx.events.filter(e => e.type === 'crawlResume').length;
    expect(runUntil(sim, ctx, () => resumes() === 2, 20)).toBe(true);
    expect(mechanics(ctx, 'selfPasses')).toHaveLength(1);
    expect(sim.selfPassPending).toBe(false);
  });

  it('does not credit a dive once the tail has left every tunnel', () => {
    const { sim, ctx, passage } = secondDive(100);
    sim.stepHistory.distance = passage.exitDistance + tunnelTailReach(sim.tailLength) + 1;
    expect(runUntil(sim, ctx, () => sim.phase === 'windup', 5)).toBe(true);
    expect(sim.selfPassPending).toBe(false);
    expect(runUntil(sim, ctx, () => ctx.events.filter(e => e.type === 'crawlResume').length === 2, 20)).toBe(true);
    expect(mechanics(ctx, 'selfPasses')).toHaveLength(0);
  });

  it('gives no credit for a pass the worm does not survive', () => {
    const { sim, ctx } = secondDive(100);
    expect(runUntil(sim, ctx, () => sim.phase === 'windup', 5)).toBe(true);
    sim.alive = false; sim.phase = 'dead';
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(mechanics(ctx, 'selfPasses')).toHaveLength(0);
  });
});

describe('double heals', () => {
  const tunnelA = { entry: { x: 1, y: 2, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 0, z: 0, dirKey: 'NZ' } };
  const tunnelB = { entry: { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' } };
  const passage = (tunnel, tunnelKey, exitDistance) => ({ tunnel, tunnelKey, exitDistance, clearFrame: false,
    heal: { tunnel, tunnelKey, stableKey: tunnelKey } });
  // Two settled steps: one rendered clear frame, then the heal.
  const settle = (sim, ctx) => { stepWormSim(sim, 0, SIZE, ctx); stepWormSim(sim, 0, SIZE, ctx); };

  it('counts a seal while another paid heal still rides in the body', () => {
    const sim = makeSim(60), ctx = makeCtx();
    const cleared = sim.stepHistory.distance - tunnelTailReach(sim.tailLength) - 1;
    sim.tunnelPassages.push(passage(tunnelA, 'A', cleared), passage(tunnelB, 'B', sim.stepHistory.distance));
    settle(sim, ctx);
    expect(sim.healed).toBe(1);
    expect(mechanics(ctx, 'multiHeals')).toHaveLength(1);
    // The second seal has nothing left riding with it.
    sim.healPauseT = 0;
    sim.stepHistory.distance += tunnelTailReach(sim.tailLength) + 1;
    settle(sim, ctx);
    expect(sim.healed).toBe(2);
    expect(mechanics(ctx, 'multiHeals')).toHaveLength(1);
  });

  it('does not count a lone seal or a body still carrying an unpaid ride', () => {
    const sim = makeSim(60), ctx = makeCtx();
    const cleared = sim.stepHistory.distance - tunnelTailReach(sim.tailLength) - 1;
    sim.tunnelPassages.push(passage(tunnelA, 'A', cleared), { ...passage(tunnelB, 'B', sim.stepHistory.distance), heal: null });
    settle(sim, ctx);
    expect(sim.healed).toBe(1);
    expect(mechanics(ctx, 'multiHeals')).toHaveLength(0);
  });
});

describe('story credit for the new goals', () => {
  const setup = id => {
    const level = storyLevel(id), sim = makeWormSim(level.cubeSize);
    const p = stageStory(sim, level.cubeSize, level, 'glow');
    p.rotationEpoch = 0;
    const read = (state = {}) => storyMetrics(sim, p, level, { wormSessionOrbs: 0, rotationEpoch: 0, size: level.cubeSize, ...state }, [], 0.02);
    return { level, sim, p, read };
  };

  it('records passes and double heals from the sim, and only those keys', () => {
    const { p, read } = setup(54);
    recordStoryMechanic(p, 'selfPasses'); recordStoryMechanic(p, 'selfPasses'); recordStoryMechanic(p, 'multiHeals');
    recordStoryMechanic(p, 'healed'); // not a story event
    expect(read()).toMatchObject({ selfPasses: 2, multiHeals: 1 });
    expect(p.mechanics.healed).toBeUndefined();
  });

  it('counts every fusion and each ordered recipe once', () => {
    const { p, read } = setup(66);
    for (const id of ['steam', 'steam', 'quench', undefined]) recordStoryMechanic(p, 'elementFusion', id);
    expect(read()).toMatchObject({ fusions: 3, uniqueFusions: 2, steamFusions: 2, quenchFusions: 1 });
    const retry = stageStory(makeWormSim(8), 8, storyLevel(66), 'glow');
    expect(retry.fusionIds.size).toBe(0);
  });

  it('offers paired elements until a fusion quest is brewed, then stops', () => {
    const { level, sim, p } = setup(66);
    expect(nextStoryPower(p, level)).toBe('water');
    p.powerDelay = 0;
    expect(offerStoryPower(sim, p, level, level.cubeSize, p.cubies)).toBe(true);
    expect(sim.specials).toHaveLength(2);
    expect(STORY_ELEMENTS).toContain(sim.specials[1].type);
    expect(sim.specials[1].type).not.toBe(sim.specials[0].type);
    for (const [base, catalyst] of [['water', 'fire'], ['fire', 'water'], ['grass', 'ice']]) recordStoryMechanic(p, 'elementFusion', getFusion(base, catalyst).id);
    expect(nextStoryPower(p, level)).toBeNull();
  });

  it('measures body length at its peak, so paying tolls afterwards keeps the credit', () => {
    const { level, sim, read } = setup(41);
    sim.tailLength = 130; expect(read().bodyLength).toBe(130);
    sim.tailLength = 40; expect(read().bodyLength).toBe(130);
    const metrics = { alive: true, elapsed: 1, landed: true, orbs: level.target, colors: 6, bodyLength: 99 };
    expect(storyOutcome(level, metrics)).toBeNull();
    expect(storyOutcome(level, { ...metrics, bodyLength: 100 })).not.toBeNull();
    expect(storyGrowthTarget(level)).toBeGreaterThan(level.mechanics.bodyLength);
    expect(storyProgressText(level, { ...metrics, elapsed: 10 })).toContain('99/100 body segments');
  });

  it('counts landed body jumps on a level that is not a jump trial', () => {
    const { level, sim, read } = setup(46);
    expect(level.kind).toBe('mastery');
    sim.tailLength = 140;
    const body = ttAt(sim.tileTrail, 5).split(',');
    sim.pos = { x: +body[0], y: +body[1], z: +body[2], dirKey: body[3] };
    sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, level.cubeSize, 0)).z += WORM_LIFT;
    sim.prevWorldPos = null; sim.interpT = 0.6; sim.isJumping = true; sim.jumpT = 0.5;
    expect(read().bodyJumps).toBe(0);
    sim.isJumping = false;
    expect(read().bodyJumps).toBe(1);
    expect(storyChecklist(level, read()).find(goal => goal.key === 'bodyJumps')).toMatchObject({ label: 'Jump over your body', value: 1 });
  });

  it('labels every new goal on a tunnel trial that also asks for them', () => {
    const level = storyLevel(54);
    expect(storyChecklist(level).map(goal => goal.label)).toEqual(['Pass yourself in the Core', 'Double heals', 'Grow your worm', 'Cross tunnel pairs']);
    expect(level.goal).toContain('pass yourself in the Core twice');
  });
});
