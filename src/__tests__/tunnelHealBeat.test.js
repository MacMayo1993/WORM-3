import { beforeEach, describe, expect, it } from 'vitest';
import { makeWormSim, resetWormSim, stepWormSim, applyRotationToSim } from '../worm/healerWorm/wormSim.js';
import { advanceTunnelHead, tunnelTailReach } from '../worm/healerWorm/tunnelTrail.js';
import { resetLiveRotation, liveRotation } from '../worm/liveRotation.js';
import { TUNNEL_HEAL_HOLD, DOUBLE_HEAL_HOLD, HEAL_PAUSE_DURATION } from '../worm/healerWorm/constants.js';
import { makeHealBeat, stepHealBeat, healKickFov, HEAL_KICK_SECONDS, HEAL_KICK_FOV } from '../worm/healBeat.js';
import { WORM_HAPTICS, SEAL_LADDER_TOP, createWormFeedback } from '../worm/wormFeedback.js';

// A tunnel heal is the main way a pair goes home, so it lands as the run's peak beat:
// a short hitstop, a lens punch, a seal on both mouths and a heal ladder that climbs
// a step with every heal this run. Ring heals keep their own longer pause.
const SIZE = 3;
beforeEach(() => { resetLiveRotation(); liveRotation.active = false; });

function makeCtx() {
  const events = [];
  const log = type => (...args) => { events.push({ type, args }); };
  return {
    events,
    getCubies: () => null, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88', resolveTunnel: () => null, getDoubleHealWindow: () => 0,
    feel: log('feel'), onDeath: log('death'), onTunnelEnter: log('tunnelEnter'), onCrawlResume: log('crawlResume'),
    onPhase: log('phase'), onBoostState: log('boost'), onSurvivalTick: log('survival'), spawnWormholePair: log('spawn'),
    onFlippedTile: log('flipped'), applyDeposit: log('deposit'), onOrbPickup: log('pickup'), onPowerupsChanged: log('powerups'),
    applyHeal: log('heal'), onSpecialsChanged: log('specials'), onRocketState: log('rocketState'), onMagnetState: log('magnetState'),
    onSpecialSpawned: log('specialSpawned'), onSpecialExpired: log('specialExpired'), onStoryMechanic: log('mechanic'),
    onSkill: log('skill'),
  };
}
const tunnelA = { entry: { x: 1, y: 2, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 0, z: 0, dirKey: 'NZ' } };
const tunnelB = { entry: { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' } };
const passage = (tunnel, tunnelKey, exitDistance) => ({ tunnel, tunnelKey, exitDistance, clearFrame: false,
  heal: { tunnel, tunnelKey, stableKey: tunnelKey } });
const seals = ctx => ctx.events.filter(e => e.type === 'feel' && e.args[0] === 'seal').map(e => e.args[1]);
function makeSim() {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  sim.tailLength = 60;
  return sim;
}
const settle = (sim, ctx) => { stepWormSim(sim, 0, SIZE, ctx); stepWormSim(sim, 0, SIZE, ctx); };
const cleared = sim => sim.stepHistory.distance - tunnelTailReach(sim.tailLength) - 1;

describe('the tunnel heal beat in the sim', () => {
  it('holds the crawl, counts the beat and sounds the first rung of the ladder', () => {
    const sim = makeSim(), ctx = makeCtx();
    sim.tunnelPassages.push(passage(tunnelA, 'A', cleared(sim)));
    settle(sim, ctx);
    expect(sim.healed).toBe(1);
    expect(sim.healPauseT).toBe(TUNNEL_HEAL_HOLD);
    expect(sim.healFocusTile).toBeNull(); // the lens stays on the chase
    expect(sim.healBeatSeq).toBe(1);
    expect(sim.healBeatTier).toBe(1);
    expect(sim.pendingHealBurst).toMatchObject({ exitTile: tunnelA.exit, entryTile: tunnelA.entry, tier: 1 });
    expect(seals(ctx)).toEqual([{ combo: 0, tier: 1 }]);
    // The hold is a hitstop: the crawl stands still, then resumes.
    const distance = sim.stepHistory.distance;
    stepWormSim(sim, TUNNEL_HEAL_HOLD / 2, SIZE, ctx);
    expect(sim.stepHistory.distance).toBe(distance);
    stepWormSim(sim, TUNNEL_HEAL_HOLD, SIZE, ctx);
    expect(sim.healPauseT).toBe(0);
  });

  it('climbs one rung per heal, and a double heal rings and holds bigger', () => {
    const sim = makeSim(), ctx = makeCtx();
    sim.tunnelPassages.push(passage(tunnelA, 'A', cleared(sim)), passage(tunnelB, 'B', sim.stepHistory.distance));
    settle(sim, ctx);
    // A sealed while B's paid heal still rode in the body: a double heal.
    expect(sim.healBeatTier).toBe(2);
    expect(sim.healPauseT).toBe(DOUBLE_HEAL_HOLD);
    expect(sim.pendingHealBurst.tier).toBe(2);
    sim.healPauseT = 0;
    sim.stepHistory.distance += tunnelTailReach(sim.tailLength) + 1;
    settle(sim, ctx);
    expect(sim.healed).toBe(2);
    expect(sim.healBeatSeq).toBe(2);
    expect(seals(ctx)).toEqual([{ combo: 0, tier: 2 }, { combo: 1, tier: 1 }]);
    // The double heal is called out; the single one after it is not.
    expect(ctx.events.filter(e => e.type === 'skill').map(e => e.args[0])).toEqual(['double']);
  });

  it('never cuts short a ring heal\'s longer pause or its camera focus', () => {
    const sim = makeSim(), ctx = makeCtx();
    // A ring heal landing in the same tick, just before this seal.
    ctx.applyHeal = () => { sim.healPauseT = HEAL_PAUSE_DURATION; sim.healFocusTile = tunnelB.exit; };
    sim.tunnelPassages.push(passage(tunnelA, 'A', cleared(sim)));
    settle(sim, ctx);
    expect(sim.healed).toBe(1);
    expect(sim.healPauseT).toBe(HEAL_PAUSE_DURATION);
    expect(sim.healFocusTile).toBe(tunnelB.exit);
    expect(sim.healBeatSeq).toBe(1);
  });

  it('takes no hold away from the crawl when the heal lands mid-ride', () => {
    const sim = makeSim(), ctx = makeCtx();
    sim.tunnelPassages.push(passage(tunnelA, 'A', cleared(sim)));
    stepWormSim(sim, 0, SIZE, ctx); // the clear frame
    sim.phase = 'tunnel'; sim.prevPhase = 'tunnel';
    sim.activeTunnel = tunnelB; sim.currentTunnelKey = 'B';
    stepWormSim(sim, 0, SIZE, ctx);
    expect(sim.healed).toBe(1);
    expect(sim.healPauseT).toBe(0);
    expect(sim.healBeatSeq).toBe(1); // the sound, the rings and the seal still play
  });

  it('keeps a paid reverse visit open through its whole exit flourish', () => {
    const sim = makeSim(), ctx = makeCtx();
    const reverse = { entry: tunnelA.exit, exit: tunnelA.entry, padHeight: 0.5 };
    sim.phase = sim.prevPhase = 'windout';
    sim.activeTunnel = reverse;
    // Exiting clears the current key before windout starts. The first visit
    // owns the queued heal, while the latest visit still owns the landing.
    sim.currentTunnelKey = null;
    const first = passage(tunnelA, 'A', cleared(sim));
    const latest = { tunnel: reverse, tunnelKey: 'A', exitDistance: cleared(sim), heal: null, clearFrame: false };
    sim.tunnelPassages.push(first, latest);
    settle(sim, ctx);
    expect(sim.healed).toBe(0);
    expect(sim.tunnelPassages).toHaveLength(2);

    sim.activeTunnel = null;
    sim.phase = sim.prevPhase = 'crawling';
    settle(sim, ctx);
    expect(sim.healed).toBe(1);
    expect(sim.tunnelPassages).toHaveLength(0);
  });

  it('seals a paid pair once instead of collapsing its later unpaid passage first', () => {
    const sim = makeSim(), ctx = makeCtx();
    const first = passage(tunnelA, 'A', cleared(sim));
    const latest = { tunnel: { entry: tunnelA.exit, exit: tunnelA.entry }, tunnelKey: 'A',
      exitDistance: cleared(sim), heal: null, clearFrame: false };
    sim.tunnelPassages.push(first, latest);
    sim.tunnelUseCounts.set('A', 3);
    settle(sim, ctx);
    expect(sim.healed).toBe(1);
    expect(ctx.events.filter(e => e.type === 'feel' && e.args[0] === 'collapse')).toEqual([]);
    expect(sim.voidTunnelKeys.size).toBe(0);
    expect(sim.tunnelPassages).toHaveLength(0);
  });

  it('keeps the current exit passage attached through a slice turn', () => {
    const sim = makeSim(), ctx = makeCtx();
    sim.tailLength = 10;
    sim.phase = sim.prevPhase = 'windout';
    sim.activeTunnel = { ...tunnelA, padHeight: 0.3, padExpansion: 0 };
    sim.pos = { ...tunnelA.exit };
    advanceTunnelHead(sim, 'windout', 0, SIZE);
    sim.tunnelPassages.push(passage(sim.activeTunnel, 'A', sim.stepHistory.distance));
    stepWormSim(sim, 0.1, SIZE, ctx);
    applyRotationToSim(sim, SIZE, ctx, { axis: 'row', sliceIndex: 0, dir: 1 }, { inOpeningScramble: false, paused: false });
    // The moved mouth can add enough recorded distance to clear a short tail,
    // but it still must not seal while the head is finishing its exit flourish.
    for (let i = 0; i < 5; i++) {
      stepWormSim(sim, 0.05, SIZE, ctx);
      expect(sim.phase).toBe('windout');
      expect(sim.healed).toBe(0);
    }
    expect(sim.tunnelPassages[0].tunnel).toBe(sim.activeTunnel);
  });

  it('starts every run back at the bottom of the ladder', () => {
    const sim = makeSim();
    sim.healBeatSeq = 5; sim.healBeatTier = 2;
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.healBeatSeq).toBe(0);
    expect(sim.healBeatTier).toBe(0);
  });
});

describe('the heal beat feedback', () => {
  it('gives a double heal a heavier knock and caps the ladder', () => {
    const one = WORM_HAPTICS.seal(0, { tier: 1 }), two = WORM_HAPTICS.seal(0, { tier: 2 });
    const total = pattern => pattern.reduce((a, b) => a + b, 0);
    expect(total(two)).toBeGreaterThan(total(one));
    expect(SEAL_LADDER_TOP).toBeGreaterThan(0);
  });

  it('dispatches the tier to the haptic pattern and the sound', () => {
    const calls = [];
    const feedback = createWormFeedback((event, opts) => calls.push([event, opts]), () => {});
    feedback.emit('seal', { combo: 3, tier: 2 });
    expect(calls).toEqual([['seal', expect.objectContaining({ combo: 3, tier: 2, haptics: true, priority: 4 })]]);
  });
});

describe('the lens punch (healBeat.js)', () => {
  it('rises fast, lets go smoothly and is bigger for a double heal', () => {
    expect(healKickFov(0, 1)).toBe(0);
    expect(healKickFov(0.06, 1)).toBeCloseTo(HEAL_KICK_FOV[1]);
    expect(healKickFov(0.06, 2)).toBeCloseTo(HEAL_KICK_FOV[2]);
    expect(healKickFov(0.3, 1)).toBeLessThan(HEAL_KICK_FOV[1]);
    expect(healKickFov(HEAL_KICK_SECONDS, 1)).toBe(0);
    expect(healKickFov(Infinity, 1)).toBe(0);
  });

  it('kicks once per heal while crawling, holds through pause and stays still under reduced motion', () => {
    const beat = makeHealBeat();
    expect(stepHealBeat(beat, 0, 1, 1 / 60)).toBe(0);
    stepHealBeat(beat, 1, 1, 1 / 60);
    let peak = 0;
    for (let f = 0; f < 10; f++) peak = Math.max(peak, stepHealBeat(beat, 1, 1, 1 / 60));
    expect(peak).toBeGreaterThan(HEAL_KICK_FOV[1] * 0.9);
    // Pause holds the kick where it is.
    const held = stepHealBeat(beat, 1, 1, 1 / 60, { live: false });
    expect(stepHealBeat(beat, 1, 1, 1 / 60, { live: false })).toBe(held);
    for (let f = 0; f < 60; f++) stepHealBeat(beat, 1, 1, 1 / 60);
    expect(stepHealBeat(beat, 1, 1, 1 / 60)).toBe(0);
    // A new run resets the count without a kick; a heal mid-ride gives none.
    expect(stepHealBeat(beat, 0, 1, 1 / 60)).toBe(0);
    stepHealBeat(beat, 1, 1, 1 / 60, { crawling: false });
    expect(stepHealBeat(beat, 1, 1, 1 / 60)).toBe(0);
    // Reduced motion: never.
    const calm = makeHealBeat();
    for (let f = 0; f < 10; f++) expect(stepHealBeat(calm, 1, 2, 1 / 60, { calm: true })).toBe(0);
  });
});
