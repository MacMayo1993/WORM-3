// The characters' signature abilities, reworked to stay out of the way until asked for:
// nothing is previewed on the cube while an ability merely waits (Spring's arc used to
// sit on screen whenever the leap was available), one beat marks a cooldown ending, and
// Spring aims only while its input is held. Plus the two abilities that did little on a
// quiet board: Glow's light now lets the head slip through its own body, and the
// wipers sweep up a cut's dropped orbs.
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, stepWormSim, queueTurn } from '../worm/healerWorm/wormSim.js';
import { signatureReadout, signatureAvailability, releaseMobiTunnel, tickSignature, SIGNATURES, SPRING_HOLD_FLOOR } from '../worm/healerWorm/signatures.js';
import { SPRING_COIL_SECONDS, SPRING_AIM_MAX, SIGNATURE_READY_BEAT } from '../worm/characterAbilities.js';
import { makeGlowTrail } from '../worm/healerWorm/glowTrail.js';
import { ttPush } from '../worm/circularBuffers.js';
import { WIGGLE_DURATION } from '../worm/healerWorm/wiggleSweep.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

const SIZE = 5;
function world(character, overrides = {}) {
  const cubies = makeCubies(SIZE);
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  const events = [];
  const ctx = {
    events, getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88', resolveTunnel: () => null, getCharacter: () => character, ...overrides,
  };
  for (const type of ['feel', 'onDeath', 'onTunnelEnter', 'onCrawlResume', 'onPhase', 'onBoostState', 'onSurvivalTick',
    'spawnWormholePair', 'onFlippedTile', 'applyDeposit', 'onOrbPickup', 'onPowerupsChanged', 'applyHeal',
    'onSpecialsChanged', 'onRocketState', 'onMagnetState', 'onSpecialSpawned', 'onSpecialExpired', 'onElementalTheme', 'onFusion']) {
    if (!ctx[type]) ctx[type] = (...args) => events.push({ type, args });
  }
  return { sim, ctx, cubies };
}
const step = (sim, ctx, seconds = 0.05) => stepWormSim(sim, seconds, SIZE, ctx);
const run = (sim, ctx, seconds) => { for (let t = 0; t < seconds - 0.001; t += 0.05) step(sim, ctx); };
const press = sim => { queueTurn(sim, 'signature-hold'); queueTurn(sim, 'signature'); };
beforeEach(() => resetLiveRotation());

describe('a ready ability shows nothing on the cube', () => {
  it('Spring publishes no landing preview while it waits, only while it coils', () => {
    const { sim, ctx } = world('inch');
    run(sim, ctx, 0.5);
    const ready = signatureReadout(sim, SIZE, ctx);
    expect(ready.ready).toBe(true);
    expect(sim.signature.preview).toBeNull();
    queueTurn(sim, 'signature'); step(sim, ctx);
    signatureReadout(sim, SIZE, ctx);
    expect(sim.signature.preview).not.toBeNull();
    expect(sim.signature.previewBlocked).toBe(false);   // a coil is not "recharging": its arc is not a warning
  });

  it('a coil toward a blocked landing is flagged, so the arc can warn', () => {
    const { sim, ctx, cubies } = world('inch');
    queueTurn(sim, 'signature'); step(sim, ctx);
    const p = signatureAvailability(sim, SIZE, ctx, true).target;
    cubies[p.x][p.y][p.z].stickers[p.dirKey].curr = 4;
    signatureReadout(sim, SIZE, ctx);
    expect(sim.signature.previewBlocked).toBe(true);
  });

  it('MOBI publishes no tunnel site while it waits', () => {
    const { sim, ctx } = world('mobi', { canCreateMobiTunnel: () => true });
    signatureReadout(sim, SIZE, ctx);
    expect(sim.signature.preview).toBeNull();
  });
});

describe('Spring aims while held', () => {
  it('a tap (released at once) leaps as soon as the coil is done', () => {
    const { sim, ctx } = world('inch');
    press(sim); queueTurn(sim, 'signature-release');
    step(sim, ctx);
    run(sim, ctx, SPRING_COIL_SECONDS + 0.1);
    expect(sim.isJumping).toBe(true); expect(sim.jumpSpan).toBeGreaterThan(3);
  });

  it('a held input stays coiled and crawling, showing the leap, and leaps on release', () => {
    const { sim, ctx } = world('inch');
    run(sim, ctx, 1.1);                                              // under way (a run opens with a short hold)
    press(sim); step(sim, ctx);
    const from = sim.headInterpPos.clone();
    run(sim, ctx, 1.2);
    expect(sim.isJumping).toBe(false);
    expect(sim.signature.charge).toBe(SPRING_HOLD_FLOOR);            // coiled, aiming
    expect(sim.headInterpPos.distanceTo(from)).toBeGreaterThan(0.5); // and still crawling
    expect(signatureReadout(sim, SIZE, ctx).coiled).toBe(true);
    expect(sim.signature.preview).not.toBeNull();
    expect(sim.signature.cooldown).toBe(0);                          // nothing is spent while aiming
    queueTurn(sim, 'signature-release'); step(sim, ctx);
    expect(sim.isJumping).toBe(true); expect(sim.jumpSpan).toBeGreaterThan(3);
    expect(sim.signature.cooldown).toBeGreaterThan(0);
  });

  it('lets go on its own once the hold has lasted SPRING_AIM_MAX', () => {
    const { sim, ctx } = world('inch');
    press(sim); step(sim, ctx);
    run(sim, ctx, SPRING_COIL_SECONDS + SPRING_AIM_MAX - 0.2);
    expect(sim.isJumping).toBe(false);
    run(sim, ctx, 0.4);
    expect(sim.isJumping).toBe(true);
  });

  it('drops a held coil if the worm leaves the surface, spending nothing', () => {
    const { sim, ctx } = world('inch');
    press(sim); step(sim, ctx); run(sim, ctx, 0.5);
    expect(sim.signature.charge).toBe(SPRING_HOLD_FLOOR);
    sim.phase = 'tunnel';
    tickSignature(sim, 0.05, SIZE, ctx);
    expect(sim.signature.charge).toBe(0); expect(sim.signature.cooldown).toBe(0);
    sim.phase = 'crawling'; queueTurn(sim, 'signature-release'); step(sim, ctx);
    expect(sim.isJumping).toBe(false);
  });

  it('a hold and release never queue a turn or start anything by themselves', () => {
    const { sim, ctx } = world('inch');
    queueTurn(sim, 'signature-hold'); queueTurn(sim, 'signature-release'); step(sim, ctx);
    expect(sim.pendingTurns).toHaveLength(0);
    expect(sim.signature.charge).toBe(0); expect(sim.signature.seq).toBe(0);
  });
});

describe('the ready beat', () => {
  it('pulses once when a cooldown ends, and not while it runs', () => {
    const { sim, ctx } = world('glow');
    queueTurn(sim, 'signature'); step(sim, ctx);
    expect(sim.signature.cooldown).toBeGreaterThan(SIGNATURES.glow.cooldown - 0.2);
    expect(sim.signature.readyT).toBe(0);
    sim.signature.cooldown = 0.4;                                    // the tail end of the recharge
    run(sim, ctx, 0.2);
    expect(sim.signature.readyT).toBe(0);
    run(sim, ctx, 0.3);
    expect(sim.signature.readyT).toBeGreaterThan(SIGNATURE_READY_BEAT - 0.2);
    run(sim, ctx, SIGNATURE_READY_BEAT + 0.1);
    expect(sim.signature.readyT).toBe(0);
  });

  it('marks MOBI ready again when its tunnel is healed', () => {
    const { sim } = world('mobi');
    sim.signature.mobiTunnel = { pairId: 'p1', stableKeys: [], reentryT: 0 };
    releaseMobiTunnel(sim, { pairId: 'other' });
    expect(sim.signature.readyT).toBe(0);
    releaseMobiTunnel(sim, { pairId: 'p1' });
    expect(sim.signature.mobiTunnel).toBeNull(); expect(sim.signature.readyT).toBe(SIGNATURE_READY_BEAT);
  });
});

describe('Glow: the light lets the head slip through its own body', () => {
  // Up the front face, then three left turns: the head comes back round into its own body.
  function loopIntoBody(paint) {
    const { sim, ctx } = world('glow');
    sim.tailLength = 100;
    run(sim, ctx, 3);
    if (paint) {
      const trail = makeGlowTrail();
      ttPush(trail.path, '2,4,4,PZ');
      trail.life = 30;
      sim.signature.glowTrail = trail;
    }
    for (let i = 0; i < 3; i++) {
      queueTurn(sim, 'turnLeft');
      for (let k = 0; k < 40; k++) { step(sim, ctx); if (sim.interpT < 0.1) break; }
      run(sim, ctx, 0.3);
    }
    for (let k = 0; k < 40 && sim.alive; k++) run(sim, ctx, 0.1);
    return { sim, ctx };
  }

  it('without light the loop is a bite', () => {
    const { sim, ctx } = loopIntoBody(false);
    expect(sim.alive).toBe(false);
    expect(ctx.events.find(e => e.type === 'onDeath').args[0].reason).toBe('self-collision');
  });

  it('on a lit tile the head passes through and says so', () => {
    const { sim } = loopIntoBody(true);
    expect(sim.alive).toBe(true);
  });
});

describe('Wiggle: the wipers sweep up dropped orbs', () => {
  it('takes back a cut orb the sweep crosses, as a recovery, and leaves one it does not', () => {
    const { sim, ctx } = world('wiggle', { isStoryMode: () => true });
    sim.tailLength = 4;
    const payload = [{ faceId: 2, color: '#0f0', segments: 3 }];
    sim.droppedOrbs = [
      { x: 0, y: 2, z: 4, dirKey: 'PZ', ttl: 5, payload },
      { x: 0, y: 4, z: 4, dirKey: 'PZ', ttl: 5, payload },
    ];
    const length = sim.tailLength;
    queueTurn(sim, 'signature'); step(sim, ctx);
    run(sim, ctx, WIGGLE_DURATION - 0.05);
    const pickups = ctx.events.filter(e => e.type === 'onOrbPickup');
    expect(pickups).toHaveLength(1);
    expect(pickups[0].args[5]).toBe(true);
    expect(sim.tailLength).toBe(length + 3);
    expect(sim.droppedOrbs).toHaveLength(1); expect(sim.droppedOrbs[0].y).toBe(4);
  });
});
