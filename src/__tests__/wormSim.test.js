import { tickExpansion } from '../worm/healerWorm/expansion.js';
import { EXPLODE_AMOUNT, EXPLODE_TRANSITION } from '../worm/wormExpansion.js';
// Deterministic tests for the worm simulation core (healerWorm/wormSim.js).
// The sim is driven with fixed dt values and a stubbed ctx port — no React,
// no store, no renderer. This is the test surface the wormSim extraction exists
// to provide: crawl/turn/jump/boost/tunnel/rotation logic asserted directly on
// the plain state object.
import { jumpLandingTile } from '../worm/healerWorm/jumpLanding.js';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeWormSim,
  resetWormSim,
  stepWormSim,
  applyRotationToSim,
  killWormSim,
  queueTurn,
  jumpLiftOf,
  startJump,
  hasJumpClearance,
  evaluatePosAndNormal,
  tileKey,
  CORNER_STEP_LENGTH,
} from '../worm/healerWorm/wormSim.js';
import {
  MAX_TICK_DELTA,
  BOOST_DURATION,
  BOOST_COOLDOWN,
  MAX_JUMPS,
  BASE_TAIL_LENGTH,
  ORB_SEGMENT_GROWTH,
  windoutHeadS,
  activeTunnelCap,
  MAX_ACTIVE_TUNNEL_PAIRS,
} from '../worm/healerWorm/constants.js';
import { makeCubies } from '../game/cubeState.js';
import * as THREE from 'three';
import { liveRotation, setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { inchCrawlAdvance, advanceInchGaitState } from '../worm/healerWorm/inchGait.js';
import { shPush, shAt, shReset, ttAt, ttReset, ttPush } from '../worm/circularBuffers.js';
import { getNextSurfacePosition, getWormholeHealRing } from '../worm/wormLogic.js';
import { tunnelTailReach } from '../worm/healerWorm/tunnelTrail.js';
import { raisedPlatformPosition } from '../worm/healerWorm/raisedPlatforms.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';

const SIZE = 3;

// Stub ctx port: read defaults are overridable per test; every effect method
// records an event so tests can assert on what the sim asked the outside world to do.
function makeCtx(overrides = {}) {
  const events = [];
  const log = (type) => (...args) => { events.push({ type, args }); };
  return {
    events,
    getCubies: () => null,
    getGamePhase: () => 'active',
    isPaused: () => false,
    getSpeed: () => 1.0,
    getControlMode: () => 'non-oriented',
    getWormholeInterval: () => 9999,
    isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
    getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88',
    resolveTunnel: () => null,
    feel: log('feel'),
    onDeath: log('death'),
    onTunnelEnter: log('tunnelEnter'),
    onCrawlResume: log('crawlResume'),
    onPhase: log('phase'),
    onBoostState: log('boost'),
    onSurvivalTick: log('survival'),
    spawnWormholePair: log('spawn'),
    onFlippedTile: log('flipped'),
    applyDeposit: log('deposit'),
    onOrbPickup: log('pickup'),
    onPowerupsChanged: log('powerups'),
    applyHeal: log('heal'),
    onSpecialsChanged: log('specials'),
    onRocketState: log('rocketState'),
    onMagnetState: log('magnetState'),
    onSpecialSpawned: log('specialSpawned'),
    onSpecialExpired: log('specialExpired'),
    ...overrides,
  };
}

function makeSim() {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  return sim;
}

// Advance the sim by `seconds` of wall time in fixed sub-clamp increments.
function run(sim, ctx, seconds, dt = 0.05) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWormSim(sim, dt, SIZE, ctx);
}

// Step until `predicate()` holds (checked after every step) or maxSeconds elapse.
function runUntil(sim, ctx, predicate, maxSeconds = 30, dt = 0.05) {
  const steps = Math.round(maxSeconds / dt);
  for (let i = 0; i < steps; i++) {
    stepWormSim(sim, dt, SIZE, ctx);
    if (predicate()) return true;
  }
  return false;
}

const eventsOf = (ctx, type) => ctx.events.filter(e => e.type === type);

describe('ring healing waits for visible tile contact', () => {
  function setup(speed = 1) {
    const size = 5;
    const sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    const tunnel = {
      entry: { x: 2, y: 3, z: 4, dirKey: 'PZ' },
      exit: { x: 2, y: 1, z: 0, dirKey: 'NZ' },
    };
    const ctx = makeCtx({
      getSpeed: () => speed,
      getCubies: () => makeCubies(size),
      getActiveTunnels: () => [{ tunnel, tunnelKey: 'ring' }],
      isStoryMode: () => true,
    });
    stepWormSim(sim, 0, size, ctx);
    sim.moveDir = 'right';
    sim.tailLength = 100;
    const next = getNextSurfacePosition(sim.pos, sim.moveDir, size);
    const body = [...getWormholeHealRing(tunnel.entry, size)]
      .filter(key => key !== tileKey(sim.pos) && key !== tileKey(next));
    ttReset(sim.tileTrail, body[0]);
    body.slice(1).forEach(key => ttPush(sim.tileTrail, key));
    ttPush(sim.tileTrail, tileKey(sim.pos));
    sim.stepAcc = 1 / speed;
    stepWormSim(sim, 0, size, ctx);
    const advance = fraction => {
      for (let i = 0; i < Math.round(fraction * 100); i++) stepWormSim(sim, 0.01 / speed, size, ctx);
    };
    return { sim, ctx, next, advance };
  }

  it.each([1, 4])('heals at the tile center, not logical entry or the border, at speed %s', speed => {
    const { sim, ctx, next, advance } = setup(speed);
    expect(tileKey(sim.pos)).toBe(tileKey(next));
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    advance(0.55);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    advance(0.44);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    advance(0.02);
    expect(eventsOf(ctx, 'heal')).toHaveLength(1);
    expect(sim.interpT).toBe(0);
    expect(sim.headInterpPos.distanceTo(sim.prevWorldPos)).toBeLessThan(1e-9);
    expect(sim.healPauseT).toBeGreaterThan(0);
    advance(0.1);
    expect(eventsOf(ctx, 'heal')).toHaveLength(1);
  });

  it('rechecks coverage if the tail is shortened before contact', () => {
    const { sim, ctx, advance } = setup();
    advance(0.55);
    sim.tailLength = 20;
    advance(0.46);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
  });

  it.each([[1, 60], [4, 15], [10, 15]])(
    'consumes the healed step and resumes in sync at speed %s and %s fps', (speed, fps) => {
      const { sim, ctx, advance } = setup(speed);
      advance(0.93);
      const contact = sim.curWorldPos.clone();
      const dt = Math.min(1 / fps, MAX_TICK_DELTA);
      for (let i = 0; i < 20 && !sim.healPauseT; i++) stepWormSim(sim, dt, 5, ctx);
      expect(eventsOf(ctx, 'heal')).toHaveLength(1);
      expect(sim.stepAcc).toBe(0);
      expect(sim.interpT).toBe(0);
      expect(sim.headInterpPos.distanceTo(contact)).toBeLessThan(1e-9);
      for (let i = 0; i < 100 && sim.healPauseT > 0; i++) {
        stepWormSim(sim, dt, 5, ctx);
        expect(sim.headInterpPos.distanceTo(contact)).toBeLessThan(1e-9);
        expect(sim.stepAcc).toBe(0);
      }
      expect(sim.healPauseT).toBe(0);
      const destination = sim.curWorldPos.clone();
      const steps = Math.max(1, Math.floor(0.9 / (dt * speed)));
      for (let i = 1; i <= steps; i++) {
        stepWormSim(sim, dt, 5, ctx);
        const progress = i * dt * speed;
        expect(sim.interpT).toBeCloseTo(progress, 10);
        expect(sim.stepAcc * speed).toBeCloseTo(progress, 10);
        const expected = contact.clone().lerp(destination, progress);
        expect(sim.headInterpPos.distanceTo(expected)).toBeLessThan(1e-9);
      }
      expect(eventsOf(ctx, 'heal')).toHaveLength(1);
    }
  );

  it('holds contact progress while the game is paused', () => {
    const { sim, ctx, advance } = setup();
    advance(0.55);
    const progress = sim.interpT;
    ctx.isPaused = () => true;
    advance(1);
    expect(sim.interpT).toBe(progress);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    ctx.isPaused = () => false;
    advance(0.46);
    expect(eventsOf(ctx, 'heal')).toHaveLength(1);
  });
});

describe('jump rescue window', () => {
  function setup(overrides = {}, size = 5) {
    const sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    const ctx = makeCtx({ isJumpRescueEnabled: () => true, ...overrides });
    ctx.onJumpRescue = active => ctx.events.push({ type: 'rescue', active });
    stepWormSim(sim, 0, size, ctx);
    sim.moveDir = 'right';
    const key = tileKey(getNextSurfacePosition(sim.pos, sim.moveDir, size));
    sim.tailLength = 100;
    ttReset(sim.tileTrail, key);
    ttPush(sim.tileTrail, '0,0,4,PZ');
    ttPush(sim.tileTrail, tileKey(sim.pos));
    sim.stepAcc = 100; // start the next step now, then restore its accumulator
    stepWormSim(sim, 0, size, ctx);
    sim.stepAcc = 0;
    // Supply an occupied crossing, not only a tile-trail label.
    const center = new THREE.Vector3();
    const normal = evaluatePosAndNormal(sim, 0.6, center).clone();
    center.addScaledVector(normal, 0.08);
    const side = new THREE.Vector3(0, 1, 0);
    shReset(sim.stepHistory);
    shPush(sim.stepHistory, center.clone().addScaledVector(side, -1), normal, 0, 0, 0);
    shPush(sim.stepHistory, center.clone().addScaledVector(side, 1), normal, 0, 0, 0);
    expect(sim.pendingSelfCollision?.key).toBe(key);
    return { sim, ctx };
  }

  it('freezes all sim clocks and the body trail for exactly one second', () => {
    const { sim, ctx } = setup();
    sim.boostActiveT = 1; sim.magnetT = 2; sim.elementalT = 3;
    const snapshot = () => [sim.interpT, sim.stepAcc, sim.timeAlive, sim.survivalTick,
      sim.wormholeTimer, sim.boostActiveT, sim.magnetT, sim.elementalT, sim.stepHistory.distance];
    const before = snapshot();
    stepWormSim(sim, 0.02, 5, ctx);
    expect(sim.jumpRescueT).toBe(1);
    expect(snapshot()).toEqual(before);
    stepWormSim(sim, 0.99, 5, ctx);
    expect(sim.jumpRescueT).toBeCloseTo(0.01);
    expect(snapshot()).toEqual(before);
    stepWormSim(sim, 0.01, 5, ctx);
    expect(sim.jumpRescueT).toBe(0);
    expect(snapshot()).toEqual(before);
    for (let i = 0; i < 50 && sim.alive; i++) stepWormSim(sim, 0.02, 5, ctx);
    expect(sim.alive).toBe(false);
    expect(eventsOf(ctx, 'death')).toHaveLength(1);
    expect(eventsOf(ctx, 'death')[0].args[0].reason).toBe('self-collision');
    expect(eventsOf(ctx, 'rescue').map(e => e.active)).toEqual([true, false]);
  });

  it.each([
    [5, 0.5, 60, false], [5, 1, 60, false], [5, 3.5, 60, false],
    [2, 3.5, 30, true], [3, 3.5, 60, true], [15, 3.5, 120, true],
  ])('clears the body on size %s, speed %s, %s Hz, boost %s', (size, speed, hz, boost) => {
    const { sim, ctx } = setup({ getSpeed: () => speed }, size);
    if (boost) sim.boostActiveT = 2;
    const hitKey = sim.pendingSelfCollision.key;
    stepWormSim(sim, 0.01, size, ctx);
    stepWormSim(sim, 0.999, size, ctx);
    queueTurn(sim, 'boost'); queueTurn(sim, 'signature'); queueTurn(sim, 'left');
    expect(sim.pendingTurns).toEqual([]);
    queueTurn(sim, 'jump');
    stepWormSim(sim, 0.001, size, ctx);
    expect(sim.isJumping).toBe(true);
    expect(sim.jumpRescueT).toBe(0);
    expect(sim.signatureRequested).toBe(false);
    let crossed = false;
    for (let i = 0; i < 400 && (sim.isJumping || !crossed) && sim.alive; i++) {
      stepWormSim(sim, 1 / hz, size, ctx);
      crossed ||= tileKey(sim.pos) !== hitKey;
    }
    expect(crossed).toBe(true);
    expect(sim.alive).toBe(true);
    expect(sim.isJumping).toBe(false);
    expect(eventsOf(ctx, 'feel').filter(e => e.args[0] === 'jump')).toHaveLength(1);
  });

  it('holds the window during manual pause, then resumes its remaining time', () => {
    let paused = false;
    const { sim, ctx } = setup({ isPaused: () => paused });
    stepWormSim(sim, 0.01, 5, ctx);
    stepWormSim(sim, 0.2, 5, ctx);
    paused = true;
    stepWormSim(sim, 10, 5, ctx);
    expect(sim.jumpRescueT).toBeCloseTo(0.8);
    paused = false;
    stepWormSim(sim, 0.8, 5, ctx);
    expect(sim.jumpRescueT).toBe(0);
  });

  it('revalidates a cut body and cleans up on death and reset', () => {
    const { sim, ctx } = setup();
    stepWormSim(sim, 0.01, 5, ctx);
    ttReset(sim.tileTrail, tileKey(sim.pos));
    stepWormSim(sim, 0.01, 5, ctx);
    expect(sim.jumpRescueT).toBe(0);
    expect(sim.alive).toBe(true);
    const next = setup();
    stepWormSim(next.sim, 0.01, 5, next.ctx);
    killWormSim(next.sim, next.ctx, { reason: 'slice-rotation' });
    expect(next.sim.jumpRescueT).toBe(0);
    expect(eventsOf(next.ctx, 'rescue').map(e => e.active)).toEqual([true, false]);
    resetWormSim(next.sim, 5, { orbCount: 0, wormholeInterval: 9999 });
    expect(next.sim.jumpRescueCollision).toBeNull();
    expect(next.sim.jumpRescueRequested).toBe(false);
  });

  it('still offers a rescue while Classic is using Orb Call', () => {
    const { sim, ctx } = setup();
    sim.signature.character = 'classic'; sim.signature.active = 6; sim.magnetT = 6;
    stepWormSim(sim, 0.01, 5, ctx);
    expect(sim.jumpRescueT).toBeGreaterThan(0);
  });

  it.each(['queued', 'airborne', 'grace', 'tunnel', 'disabled', 'spent'])('does not interrupt %s movement', kind => {
    const { sim, ctx } = setup();
    if (kind === 'queued') { queueTurn(sim, 'left'); queueTurn(sim, 'jump'); }
    if (kind === 'airborne') startJump(sim, ctx, 5);
    if (kind === 'grace') sim.selfCollisionGraceSteps = 3;
    if (kind === 'tunnel') sim.pendingTunnelTrigger = { ...sim.pos };
    if (kind === 'disabled') ctx.isJumpRescueEnabled = () => false;
    if (kind === 'spent') sim.jumpCount = MAX_JUMPS;
    stepWormSim(sim, 0.01, 5, ctx);
    expect(sim.jumpRescueT).toBe(0);
    if (kind === 'queued') expect(sim.isJumping).toBe(true);
  });
});

describe('terminal death ordering', () => {
  it('does not heal or reward a cleared tunnel after a death in the same tick', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const tunnel = { entry: { ...sim.pos }, exit: { ...sim.pos, x: 0 } };
    sim.activeTunnel = tunnel;
    sim.currentTunnelKey = 'fatal';
    sim.pendingVoidKill = { tunnelKey: 'fatal', traversals: 4 };
    sim.phase = sim.prevPhase = 'tunnel';
    sim.tunnelProgress = 0.499;
    sim.stepHistory.distance = 100;
    sim.tunnelPassages.push({
      tunnel, tunnelKey: 'healing', exitDistance: 0, clearFrame: true,
      heal: { tunnel, tunnelKey: 'healing', stableKey: 'stable' },
    });
    stepWormSim(sim, 0.01, SIZE, ctx);
    expect(sim.phase).toBe('dead');
    expect(eventsOf(ctx, 'death')).toHaveLength(1);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    expect(eventsOf(ctx, 'specialSpawned')).toHaveLength(0);
    expect(sim.healed).toBe(0);
    const eventCount = ctx.events.length;
    killWormSim(sim, ctx, { reason: 'slice-rotation' });
    run(sim, ctx, 1);
    expect(ctx.events).toHaveLength(eventCount);
    expect(eventsOf(ctx, 'death')[0].args[0].reason).toBe('void-tunnel-exhausted');
  });
});

beforeEach(() => {
  liveRotation.active = false;
});

describe('makeWormSim / resetWormSim', () => {
  it('starts at the face-centre spawn tile, crawling, alive', () => {
    const sim = makeSim();
    expect(sim.pos).toEqual({ x: 1, y: 1, z: 2, dirKey: 'PZ' });
    expect(sim.moveDir).toBe('up');
    expect(sim.phase).toBe('crawling');
    expect(sim.alive).toBe(true);
    expect(sim.tailLength).toBe(BASE_TAIL_LENGTH);
    expect(sim.tileTrail.count).toBe(1);
    expect(ttAt(sim.tileTrail, 0)).toBe(tileKey(sim.pos));
  });

  it('spawns the requested number of powerups on reset', () => {
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 4, wormholeInterval: 9999 });
    expect(sim.powerups).toHaveLength(4);
    for (const p of sim.powerups) expect(p.type).toBe('apple');
  });
});

describe('crawling movement', () => {
  it('advances one tile per STEP_SEC at speed 1', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    run(sim, ctx, 1.05);
    // 'up' on PZ is +y
    expect(sim.pos).toEqual({ x: 1, y: 2, z: 2, dirKey: 'PZ' });
    expect(sim.tileTrail.count).toBe(2);
  });

  it('crosses onto the adjacent face at the edge and keeps crawling', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    run(sim, ctx, 2.1); // two tile commits: y1→y2 on PZ, then over the edge onto PY
    expect(sim.pos.dirKey).toBe('PY');
    expect(sim.crossingCorner).toBe(true);
  });

  it('applies a queued relative turn at the next tile commit (non-oriented)', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    queueTurn(sim, 'right');
    run(sim, ctx, 1.05);
    // heading was 'up'; 'right' rotates to 'right' → +x on PZ
    expect(sim.moveDir).toBe('right');
    expect(sim.pos).toEqual({ x: 2, y: 1, z: 2, dirKey: 'PZ' });
  });

  it('sets heading directly in oriented control mode', () => {
    const sim = makeSim();
    const ctx = makeCtx({ getControlMode: () => 'oriented' });
    queueTurn(sim, 'left');
    run(sim, ctx, 1.05);
    expect(sim.moveDir).toBe('left');
    expect(sim.pos).toEqual({ x: 0, y: 1, z: 2, dirKey: 'PZ' });
  });

  it('turns relative to the heading in EITHER control mode (the thumb tray)', () => {
    // The touch tray has two steering keys and no way to name a compass point, so
    // it sends turnLeft/turnRight rather than left/right. In relative steering that
    // is the same turn; in oriented mode it is the difference between steering and
    // being stuck on two of the four directions.
    for (const mode of ['non-oriented', 'oriented']) {
      const sim = makeSim();
      const ctx = makeCtx({ getControlMode: () => mode });
      expect(sim.moveDir).toBe('up');
      queueTurn(sim, 'turnRight');
      run(sim, ctx, 1.05);
      expect(sim.moveDir, mode).toBe('right');
      queueTurn(sim, 'turnRight');
      run(sim, ctx, 1.05);
      expect(sim.moveDir, mode).toBe('down'); // ...and again, a quarter at a time
    }
  });

  it('applies same-way tray turns one tile at a time, never both at once', () => {
    // Two rights landing inside one tile is a 180 into your own neck. The relative
    // turn goes through the same hold the keyboard's left/right has, so a fast
    // double-tap becomes the staircase the player meant rather than a self-kill or
    // a dropped input.
    const sim = makeSim();
    const ctx = makeCtx();
    queueTurn(sim, 'turnRight');
    run(sim, ctx, 1.05);
    expect(sim.moveDir).toBe('right');

    queueTurn(sim, 'turnRight');
    const headings = new Set([sim.moveDir]);
    for (let i = 0; i < 40; i++) {
      run(sim, ctx, 0.05);
      headings.add(sim.moveDir);
    }
    // It got there — and only ever a quarter turn at a time on the way.
    expect(sim.moveDir).toBe('down');
    expect([...headings].sort()).toEqual(['down', 'right']);
  });

  it('records framerate-independent step history while moving', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    run(sim, ctx, 1.0);
    // ~50 sub-steps per tile plus the initial fill
    expect(sim.stepHistory.count).toBeGreaterThan(40);
  });
});

describe('tick clamping and pause', () => {
  it('clamps a huge frame delta to MAX_TICK_DELTA', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    stepWormSim(sim, 10, SIZE, ctx); // one monster frame
    expect(sim.timeAlive).toBeCloseTo(MAX_TICK_DELTA, 5);
    expect(sim.pos).toEqual({ x: 1, y: 1, z: 2, dirKey: 'PZ' }); // no teleport
  });

  it('does nothing while paused or dead', () => {
    const sim = makeSim();
    const paused = makeCtx({ isPaused: () => true });
    run(sim, paused, 2);
    expect(sim.timeAlive).toBe(0);
    expect(sim.pos).toEqual({ x: 1, y: 1, z: 2, dirKey: 'PZ' });

    const ctx = makeCtx();
    killWormSim(sim, ctx, { reason: 'test' });
    expect(sim.alive).toBe(false);
    expect(sim.phase).toBe('dead');
    expect(eventsOf(ctx, 'death')).toHaveLength(1);
    run(sim, ctx, 2);
    expect(sim.timeAlive).toBe(0);
  });
});

describe('jump and boost', () => {
  it('jumps on command, capped at MAX_JUMPS before landing', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    queueTurn(sim, 'jump');
    run(sim, ctx, 0.1);
    expect(sim.isJumping).toBe(true);
    expect(sim.jumpCount).toBe(1);
    expect(jumpLiftOf(sim)).toBeGreaterThan(0);
    // Exhaust the double-jump budget mid-air
    for (let i = 0; i < MAX_JUMPS + 2; i++) {
      queueTurn(sim, 'jump');
      run(sim, ctx, 0.1);
    }
    expect(sim.jumpCount).toBeLessThanOrEqual(MAX_JUMPS);
    // Jump spans two tiles of travel, then lands and resets the counter
    run(sim, ctx, 2.5);
    expect(sim.isJumping).toBe(false);
    expect(sim.jumpCount).toBe(0);
  });

  it('runs the boost lifecycle: active → cooldown → ready', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    queueTurn(sim, 'boost');
    run(sim, ctx, 0.1);
    expect(eventsOf(ctx, 'boost').map(e => e.args[0])).toEqual(['active']);
    expect(sim.boostActiveT).toBeGreaterThan(0);
    run(sim, ctx, BOOST_DURATION);
    expect(eventsOf(ctx, 'boost').map(e => e.args[0])).toEqual(['active', 'cooldown']);
    run(sim, ctx, BOOST_COOLDOWN);
    expect(eventsOf(ctx, 'boost').map(e => e.args[0])).toEqual(['active', 'cooldown', 'ready']);
  });

  it('boost speeds up tile crossing', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    queueTurn(sim, 'boost');
    run(sim, ctx, 0.5); // at 2.4× speed, STEP_SEC ≈ 0.42s → already crossed a tile
    expect(sim.pos.y).toBe(2);
  });
});

describe('wormhole spawn clock', () => {
  it('asks ctx to spawn a pair when the timer elapses', () => {
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 0.5 });
    const cubies = makeCubies(SIZE);
    const ctx = makeCtx({ getCubies: () => cubies, getWormholeInterval: () => 0.5 });
    run(sim, ctx, 1.2);
    expect(eventsOf(ctx, 'spawn').length).toBeGreaterThanOrEqual(2);
    const tile = eventsOf(ctx, 'spawn')[0].args[0];
    expect(tile).toHaveProperty('dirKey');
  });

  it('stops spawning and zeroes the countdown in finalHealing', () => {
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 0.5 });
    const ctx = makeCtx({ getGamePhase: () => 'finalHealing', getWormholeInterval: () => 0.5 });
    run(sim, ctx, 1.2);
    expect(eventsOf(ctx, 'spawn')).toHaveLength(0);
    expect(sim.wormholeCountdown).toBe(0);
  });

  it('awards a survival tick through ctx', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    run(sim, ctx, 10.5);
    expect(eventsOf(ctx, 'survival').length).toBeGreaterThanOrEqual(1);
  });
});

describe('heal pause', () => {
  it('freezes the crawl while the healed tile pops, then resumes', () => {
    const sim = makeSim();
    const ctx = makeCtx({ getSpeed: () => 20 }); // fast, so a resumed crawl moves at once
    const start = tileKey(sim.pos);
    sim.healPauseT = 0.2;
    run(sim, ctx, 0.15); // still inside the pause
    expect(tileKey(sim.pos)).toBe(start); // frozen — the worm did not move
    expect(sim.healPauseT).toBeCloseTo(0.05, 5);
    run(sim, ctx, 0.3); // pause elapses, crawl resumes
    expect(sim.healPauseT).toBe(0);
    expect(tileKey(sim.pos)).not.toBe(start); // it crawled again
  });
});

describe('body-cut freeze', () => {
  it('freezes the crawl while the camera swings to the cut, then resumes', () => {
    const sim = makeSim();
    const ctx = makeCtx({ getSpeed: () => 20 }); // fast, so a resumed crawl moves at once
    const start = tileKey(sim.pos);
    sim.cutFocusT = 0.2;
    sim.cutFocusPos = [1, 2, 3];
    run(sim, ctx, 0.15); // still inside the freeze
    expect(tileKey(sim.pos)).toBe(start); // frozen — the worm did not move
    expect(sim.cutFocusT).toBeCloseTo(0.05, 5);
    expect(sim.cutFocusPos).toEqual([1, 2, 3]); // impact point held for the camera
    run(sim, ctx, 0.3); // freeze elapses, crawl resumes
    expect(sim.cutFocusT).toBe(0);
    expect(sim.cutFocusPos).toBe(null); // released when the beat ends
    expect(tileKey(sim.pos)).not.toBe(start); // it crawled again
  });
});

describe('active tunnel pair cap', () => {
  it('scales down for smaller boards and clamps mega to the ceiling', () => {
    expect(activeTunnelCap(2)).toBe(1);
    expect(activeTunnelCap(3)).toBe(2);
    expect(activeTunnelCap(4)).toBe(3);
    expect(activeTunnelCap(5)).toBe(3);
    expect(activeTunnelCap(7)).toBe(5);
    expect(activeTunnelCap(15)).toBe(10);
    expect(activeTunnelCap(15)).toBe(MAX_ACTIVE_TUNNEL_PAIRS);
    // The proportional scale-down must never round a board to zero holes, which
    // would leave it with no wormholes at all to heal.
    expect(activeTunnelCap(1)).toBeGreaterThanOrEqual(1);
  });

  it('holds spawning while the board is at the cap, then refills after a heal', () => {
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 0.5 });
    const cubies = makeCubies(SIZE);
    // Report the board as already at its cap (5 pairs at SIZE 3).
    let activeCount = activeTunnelCap(SIZE);
    const ctx = makeCtx({
      getCubies: () => cubies,
      getWormholeInterval: () => 0.5,
      getActiveTunnels: () => new Array(activeCount).fill({ tunnelKey: 'x' }),
    });
    run(sim, ctx, 1.2);
    expect(eventsOf(ctx, 'spawn')).toHaveLength(0);

    // A heal drops the count below the cap — the next interval refills the slot.
    activeCount = activeTunnelCap(SIZE) - 1;
    run(sim, ctx, 1.2);
    expect(eventsOf(ctx, 'spawn').length).toBeGreaterThanOrEqual(1);
  });
});

describe('flipped tiles and tunnel traversal', () => {
  it('keeps the head flourish independent of body length', () => {
    for (const count of [10, 40, 100, 1200]) {
      expect(windoutHeadS(0.5, count)).toBe(0.5);
      expect(windoutHeadS(1, count)).toBe(0);
    }
  });

  // Flip the tile directly above the spawn point (the first tile the worm reaches)
  // and give it an antipodal partner on the back face.
  function makeFlippedWorld() {
    const cubies = makeCubies(SIZE);
    const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
    const exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
    cubies[entry.x][entry.y][entry.z].stickers[entry.dirKey].curr = 4; // flipped: curr ≠ orig(1)
    cubies[exit.x][exit.y][exit.z].stickers[exit.dirKey].curr = 1;
    const tunnel = { entry, exit, entryColor: 4, exitColor: 1 };
    const tunnelKey = 'test-tunnel';
    return { cubies, tunnel, tunnelKey };
  }

  it('enters windup when fully stepping onto a flipped tile', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: () => ({ tunnel, tunnelKey }),
    });
    run(sim, ctx, 1.5);
    expect(sim.phase).toBe('windup');
    expect(sim.activeTunnel).toBe(tunnel);
    expect(eventsOf(ctx, 'tunnelEnter')).toHaveLength(1);
    expect(eventsOf(ctx, 'feel').some(e => e.args[0] === 'dive')).toBe(true);
    expect(sim.tunnelUseCounts.get(tunnelKey)).toBe(1);
  });

  it('rides the full phase sequence back to crawling on the exit tile', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: () => ({ tunnel, tunnelKey }),
    });
    // Step until the first traversal completes (the tunnel tiles stay flipped in
    // this stub world, so a fixed long run would let the worm wander back in).
    const resumed = runUntil(sim, ctx, () => eventsOf(ctx, 'crawlResume').length > 0);
    expect(resumed).toBe(true);
    expect(sim.phase).toBe('crawling');
    const phases = eventsOf(ctx, 'phase').map(e => e.args[0]);
    expect(phases).toEqual(['entering', 'tunnel', 'exiting', 'windout']);
    expect(eventsOf(ctx, 'crawlResume')).toHaveLength(1);
    // No orbs deposited → no heal; the exit cue is the plain pop
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    expect(eventsOf(ctx, 'feel').some(e => e.args[0] === 'exit')).toBe(true);
    // Worm resumed from the exit tile's face
    expect(sim.pos.dirKey).toBe('NZ');
  });

  it('gives the interior ride time to read while keeping surface flourishes short', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: () => ({ tunnel, tunnelKey }),
    });
    expect(runUntil(sim, ctx, () => sim.phase === 'windup')).toBe(true);
    const elapsed = {};
    for (let frame = 0; frame < 1200 && sim.phase !== 'crawling'; frame++) {
      elapsed[sim.phase] = (elapsed[sim.phase] ?? 0) + 1 / 60;
      stepWormSim(sim, 1 / 60, SIZE, ctx);
    }
    expect(sim.phase).toBe('crawling');
    expect(elapsed.entering + elapsed.tunnel + elapsed.exiting).toBeGreaterThan(5.5);
    expect(elapsed.entering + elapsed.tunnel + elapsed.exiting).toBeLessThan(6.1);
    expect(elapsed.tunnel).toBeGreaterThan(2.5);
    expect(elapsed.windup).toBeLessThan(0.21);
    expect(elapsed.windout).toBeLessThan(0.21);
    expect(sim.pos.dirKey).toBe('NZ');
  });

  it('resumes crawling with a long tail inside and heals only after it clears', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    sim.tailLength = 100;
    const stableKey = 'PZ-1-2-2';
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: () => ({ tunnel, tunnelKey }),
      getHealingProgress: () => ({ [stableKey]: { deposited: 4, faceId: 4 } }),
    });
    const reachedWindout = runUntil(sim, ctx, () => sim.phase === 'windout');
    expect(reachedWindout).toBe(true);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    expect(sim.tunnelPassages[0]?.heal?.tunnel).toBe(tunnel);

    // The head regains control while the body keeps following the tunnel history.
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling')).toBe(true);
    // Remove flipped navigation tiles from the stub so a full body's worth of
    // crawling can continue without arming an unresolvable second entry.
    ctx.getCubies = () => null;
    ctx.resolveTunnel = () => null;
    expect(sim.tunnelPassages).toHaveLength(1);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    const passage = sim.tunnelPassages[0];
    const cleared = runUntil(sim, ctx, () => passage.clearFrame);
    expect(cleared, JSON.stringify({ phase: sim.phase, pos: sim.pos, distance: sim.stepHistory.distance - passage.exitDistance,
      deaths: eventsOf(ctx, 'death') })).toBe(true);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    stepWormSim(sim, 0.05, SIZE, ctx);

    expect(eventsOf(ctx, 'heal')).toHaveLength(1);
    expect(sim.healed).toBe(1);
    expect(sim.healFired).toBe(true);
    expect(sim.pendingHealBurst).toEqual({ exitTile: tunnel.exit, entryTile: tunnel.entry });
    // Healed tunnel's traversal bookkeeping is dropped
    expect(sim.tunnelUseCounts.has(tunnelKey)).toBe(false);
  });

  it.each([4, 40, 100])('feeds a %i-segment tail out by distance and holds it during pause', count => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    sim.tailLength = count;
    let paused = false;
    const ctx = makeCtx({ getCubies: () => cubies, resolveTunnel: () => ({ tunnel, tunnelKey }), isPaused: () => paused });
    expect(runUntil(sim, ctx, () => sim.phase === 'windout')).toBe(true);
    const passage = sim.tunnelPassages[0];
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling')).toBe(true);
    expect(sim.stepHistory.distance - passage.exitDistance).toBeCloseTo(0.1, 6);
    expect(sim.tunnelPassages).toContain(passage);
    const distance = sim.stepHistory.distance;
    const recorded = sim.stepHistory.count;
    paused = true;
    run(sim, ctx, 3);
    expect(sim.stepHistory.distance).toBe(distance);
    expect(sim.stepHistory.count).toBe(recorded);
    expect(sim.tunnelPassages).toContain(passage);
    paused = false;
    ctx.getCubies = () => null;
    for (let i = 0; i < 1200 && sim.tunnelPassages.includes(passage); i++) {
      stepWormSim(sim, 1 / 60, SIZE, ctx);
      if (sim.stepHistory.distance - passage.exitDistance < tunnelTailReach(count)) {
        expect(sim.tunnelPassages).toContain(passage);
      }
    }
    expect(sim.alive).toBe(true);
    expect(sim.tunnelPassages).not.toContain(passage);
    expect(sim.stepHistory.distance - passage.exitDistance).toBeGreaterThanOrEqual(tunnelTailReach(count));
  });

  it('re-enters an occupied pair in reverse without discarding the outgoing body or healing around it', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const reverse = { ...tunnel, entry: tunnel.exit, exit: tunnel.entry };
    const sim = makeSim();
    sim.tailLength = 200;
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: (_x, _y, _z, dirKey) => ({ tunnel: dirKey === tunnel.exit.dirKey ? reverse : tunnel, tunnelKey }),
      getHealingProgress: () => ({ 'PZ-1-2-2': { deposited: 4, faceId: 4 }, 'NZ-1-0-0': { deposited: 4, faceId: 1 } }),
    });
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling' && sim.tunnelPassages.length > 0)).toBe(true);
    const firstPassage = sim.tunnelPassages[0];
    const firstCount = sim.stepHistory.count;
    const oldInterior = Array.from({ length: firstCount }, (_, i) => shAt(sim.stepHistory, i))
      .filter(point => point.transit && Math.abs(point.pos.z) < 1.3)
      .map(point => ({ point, position: point.pos.clone() }));
    expect(oldInterior.length).toBeGreaterThan(10);
    // Jump on a settled flipped mouth is the existing deliberate-dive action.
    queueTurn(sim, 'jump');
    stepWormSim(sim, 1 / 60, SIZE, ctx);
    expect(sim.activeTunnel).toBe(reverse);
    expect(sim.tunnelUseCounts.get(tunnelKey)).toBe(2);
    expect(runUntil(sim, ctx, () => sim.phase === 'tunnel' && sim.tunnelProgress > 0.5)).toBe(true);
    expect(sim.tunnelPassages).toContain(firstPassage);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    for (const { point, position } of oldInterior) expect(point.pos.distanceTo(position)).toBe(0);
    expect(sim.stepHistory.count).toBeGreaterThan(firstCount);
    // The new trip traverses the same physical interior occupied by the older
    // outgoing stream. Both visits remain in the history used by the body renderer.
    const recent = Array.from({ length: sim.stepHistory.count - firstCount }, (_, i) => shAt(sim.stepHistory, i));
    expect(recent.some(point => point.transit && oldInterior.some(old => old.position.distanceTo(point.pos) < 0.02))).toBe(true);
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling')).toBe(true);
    expect(sim.tunnelPassages).toHaveLength(2);
    expect(sim.tunnelPassages.filter(p => p.heal)).toHaveLength(1);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    expect(sim.alive).toBe(true);
  });

  it.each([1 / 120, 1 / 30, 0.1])('collapses the fourth trip inside the tunnel at dt %s, never after exit', dt => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    let paused = false;
    const ctx = makeCtx({ getCubies: () => cubies, resolveTunnel: () => ({ tunnel, tunnelKey }), isPaused: () => paused });
    sim.tunnelUseCounts.set(tunnelKey, 3);
    expect(runUntil(sim, ctx, () => sim.phase === 'tunnel', 30, dt)).toBe(true);
    expect(sim.alive).toBe(true);
    const progress = sim.tunnelProgress;
    paused = true;
    run(sim, ctx, 3, dt);
    expect(sim.tunnelProgress).toBe(progress);
    expect(sim.alive).toBe(true);
    paused = false;
    expect(runUntil(sim, ctx, () => !sim.alive, 30, dt)).toBe(true);
    expect(sim.tunnelProgress).toBe(0.5);
    expect(eventsOf(ctx, 'death')[0].args[0]).toMatchObject({ reason: 'void-tunnel-exhausted', traversals: 4 });
    expect(eventsOf(ctx, 'crawlResume')).toHaveLength(0);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
  });

  it('allows the third trip to exit without a delayed void death', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    const ctx = makeCtx({ getCubies: () => cubies, resolveTunnel: () => ({ tunnel, tunnelKey }) });
    sim.tunnelUseCounts.set(tunnelKey, 2);
    expect(runUntil(sim, ctx, () => sim.phase === 'tunnel')).toBe(true);
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling')).toBe(true);
    expect(sim.pendingVoidKill).toBeNull();
    expect(sim.alive).toBe(true);
  });

  it('collapses the tunnel into a void kill past the traversal cap', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: () => ({ tunnel, tunnelKey }),
    });
    sim.tunnelUseCounts.set(tunnelKey, 4); // next traversal is the 5th → collapse
    run(sim, ctx, 1.5);
    expect(sim.alive).toBe(false);
    expect(eventsOf(ctx, 'death')[0].args[0].reason).toBe('voided');
    expect(sim.voidTunnelKeys.has(tunnelKey)).toBe(true);
  });
});

describe('orb pickup', () => {
  it('grows the tail and reports the pickup when crawling over an orb', () => {
    const cubies = makeCubies(SIZE);
    const sim = makeSim();
    sim.powerups = [{ x: 1, y: 2, z: 2, dirKey: 'PZ', type: 'apple' }]; // first tile ahead
    const ctx = makeCtx({ getCubies: () => cubies });
    run(sim, ctx, 1.1);
    expect(sim.tailLength).toBe(BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH);
    expect(sim.orbPickupColors).toHaveLength(1);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
    expect(eventsOf(ctx, 'powerups')).toHaveLength(1); // replacement orb published
    expect(sim.powerups).toHaveLength(1); // respawned elsewhere
  });
});

describe('applyRotationToSim', () => {
  it('carries the worm, its heading, and its trail through a slice turn', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // Worm at {1,1,2,PZ} sits in the depth slice z=2. Rotate it.
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 2, dir: 1 }, {
      inOpeningScramble: false,
      paused: false,
    });
    // depth rotation dir=1 maps (x-1, y-1) → (-(y-1), (x-1)): centre tile stays put,
    // face stays PZ, but the heading must be re-expressed in the rotated frame.
    expect(sim.pos.dirKey).toBe('PZ');
    expect(sim.moveDir).toBe('left'); // world 'up' rotated 90° about +Z
    expect(ttAt(sim.tileTrail, 0)).toBe(tileKey(sim.pos));
  });

  it('leaves the worm untouched when its slice did not rotate, but rotates riding powerups', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [{ x: 0, y: 0, z: 0, dirKey: 'NZ', type: 'apple' }];
    const before = sim.pos;
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 0, dir: 1 }, {
      inOpeningScramble: false,
      paused: false,
    });
    expect(sim.pos).toBe(before); // not in slice z=0
    expect(sim.moveDir).toBe('up');
    expect(eventsOf(ctx, 'powerups')).toHaveLength(1);
    const rotated = eventsOf(ctx, 'powerups')[0].args[0][0];
    expect(rotated.dirKey).not.toBe(undefined);
  });

  it('carries a pending heal through the turn, so it heals the pair it traversed', () => {
    // The heal is applied by GRID POSITION at the end of the wind-out spiral, and a
    // hazard turn can land in that window. Left behind, it resets two bystander
    // tiles to unflipped instead of the pair the worm actually went through — and a
    // bystander that was half of another wormhole is orphaned from its partner,
    // after which the two ends' flip counts drift and the orphan can be re-flipped
    // over and over until it hits the cap and is permanently dead.
    const sim = makeSim();
    const ctx = makeCtx();
    const tunnel = {
      entry: { x: 0, y: 1, z: 2, dirKey: 'PZ' },
      exit: { x: 2, y: 1, z: 0, dirKey: 'NZ' },
    };
    sim.activeTunnel = tunnel;
    sim.pendingTunnelHeal = { tunnel, stableKey: 'PZ-0-1-2', tunnelKey: 'k' };

    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 2, dir: 1 }, {
      inOpeningScramble: false,
      paused: false,
    });

    // The entry tile rode the z=2 slice; the pending heal must point at where it
    // landed, which is exactly where the active tunnel now points.
    expect(sim.pendingTunnelHeal.tunnel.entry).toEqual(sim.activeTunnel.entry);
    expect(sim.pendingTunnelHeal.tunnel.entry).not.toEqual(tunnel.entry);
    // …and the far endpoint, which sat outside the slice, must NOT have moved.
    expect(sim.pendingTunnelHeal.tunnel.exit).toEqual(tunnel.exit);
  });

  it('rotates a pending heal that no longer aliases the active tunnel', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.activeTunnel = null;
    sim.pendingTunnelHeal = {
      tunnel: { entry: { x: 0, y: 1, z: 2, dirKey: 'PZ' }, exit: { x: 2, y: 1, z: 0, dirKey: 'NZ' } },
      stableKey: 'PZ-0-1-2',
      tunnelKey: 'k',
    };
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 2, dir: 1 }, {
      inOpeningScramble: false,
      paused: false,
    });
    expect(sim.pendingTunnelHeal.tunnel.entry).not.toEqual({ x: 0, y: 1, z: 2, dirKey: 'PZ' });
  });

  it('preserves the pre-game heading during the opening scramble', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 2, dir: 1 }, {
      inOpeningScramble: true,
      paused: true,
    });
    expect(sim.moveDir).toBe('up'); // untouched during scramble
    // Paused snap: render head position matches the (rotated) logical tile
    expect(sim.headInterpPos.distanceTo(sim.curWorldPos)).toBeLessThan(1e-9);
  });
});

describe('crawl distance the Inch Worm gait rides on', () => {
  // The gait pins its loops to spots on the cube, so it needs the distance the head
  // has actually TRAVELLED. WormBody derives that from interpT — the sim's own
  // progress through the current step — rather than from how far headInterpPos
  // moved, because plenty of things move the head without it travelling. These
  // tests hold the two properties that makes rest on: the sim's progress is
  // untouched by anything that is not crawling, and scaling it by the step's world
  // length recovers the real path length.

  // The few lines WormBody runs each frame, kept in step with it.
  function makeDriver() {
    let prevInterpT = 0;
    let phase = 0;
    return {
      get phase() { return phase; },
      frame(sim) {
        const stepLen = sim.crossingCorner || !sim.prevWorldPos
          ? CORNER_STEP_LENGTH
          : sim.prevWorldPos.distanceTo(sim.curWorldPos);
        const d = sim.phase === 'crawling' ? inchCrawlAdvance(sim.interpT, prevInterpT, stepLen) : 0;
        prevInterpT = sim.interpT;
        phase += d;
        return d;
      }
    };
  }

  it('stays at zero while the head bobs but the simulation is frozen', () => {
    // HealerWormMode's spawn bounce and countdown breathing write headInterpPos
    // along the face normal and return before ticking the sim. sim.phase reads
    // 'crawling' throughout, so only the frozen interpT keeps the gait flat.
    const sim = makeSim();
    const driver = makeDriver();
    driver.frame(sim); // settle the driver's previous-interpT
    const norm = sim.currentNormal.clone();
    for (let frame = 0; frame < 240; frame++) {
      const breathe = Math.sin(frame * 0.06) * 0.03;
      sim.headInterpPos.copy(sim.curWorldPos).addScaledVector(norm, 0.08 + breathe);
      expect(driver.frame(sim)).toBe(0);
    }
    expect(driver.phase).toBe(0);
  });

  it('stays at zero for a stationary worm riding a turning slice', () => {
    // A live rotation moves the head through the world without the worm crawling —
    // and the body's path points ride the same turn, so the loops travel with the
    // cube already. Counting the ride as travel would slide them along the body.
    const sim = makeSim();
    const driver = makeDriver();
    driver.frame(sim);
    const before = sim.interpT;
    liveRotation.active = true;
    liveRotation.axis = 'row';
    liveRotation.sliceIndex = 1;
    for (let frame = 0; frame < 60; frame++) {
      liveRotation.angle = (frame / 60) * (Math.PI / 2);
      sim.headInterpPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.01);
      expect(driver.frame(sim)).toBe(0);
    }
    expect(sim.interpT).toBe(before); // nothing but stepWormSim writes it
    expect(driver.phase).toBe(0);
  });

  it('matches the distance the head really travelled while crawling', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const driver = makeDriver();
    driver.frame(sim);
    // Trace the head's own path, sampling finely enough that the polyline is a fair
    // stand-in for the curve — including the pivot around a cube edge.
    let traced = 0;
    let sawCorner = false;
    const prev = sim.headInterpPos.clone();
    const dt = 1 / 240;
    for (let i = 0; i < 240 * 6; i++) {
      stepWormSim(sim, dt, SIZE, ctx);
      if (sim.phase !== 'crawling') break;
      if (sim.crossingCorner) sawCorner = true;
      traced += prev.distanceTo(sim.headInterpPos);
      prev.copy(sim.headInterpPos);
      driver.frame(sim);
    }
    expect(sawCorner).toBe(true);          // the run really did round an edge
    expect(traced).toBeGreaterThan(2);     // ...and covered real ground
    expect(driver.phase).toBeCloseTo(traced, 1);
  });
});

describe('character crawl-distance driver', () => {
  it('counts travel across tile resets and corners without counting paused frames', () => {
    const sim = makeSim();
    sim.specialTimer = Infinity;
    sim.elementalSpawnTimer = Infinity;
    let paused = false;
    const ctx = makeCtx({ isPaused: () => paused });
    let sawCommit = false, sawCorner = false;
    for (let frame = 0; frame < 500; frame++) {
      const before = sim.crawlDistance;
      const t = sim.interpT;
      const corner = sim.crossingCorner;
      stepWormSim(sim, 1 / 30, SIZE, ctx);
      expect(sim.crawlDistance).toBeGreaterThanOrEqual(before);
      expect(sim.crawlDistance - before).toBeLessThan(0.2);
      if (t > sim.interpT) sawCommit = true;
      if (corner && sim.crawlDistance > before) sawCorner = true;
    }
    expect(sawCommit).toBe(true);
    expect(sawCorner).toBe(true);
    const before = sim.crawlDistance;
    paused = true;
    run(sim, ctx, 1);
    expect(sim.crawlDistance).toBe(before);
    resetWormSim(sim, SIZE, { orbCount: 0 });
    expect(sim.crawlDistance).toBe(0);
  });
});


describe('contextual jump mechanics', () => {
  it('deliberately dives on a settled flipped tile before automatic entry', () => {
    const sim = makeSim();
    const cubies = makeCubies(SIZE);
    const entry = { ...sim.pos };
    const exit = { x: 1, y: 1, z: 0, dirKey: 'NZ' };
    const sticker = cubies[entry.x][entry.y][entry.z].stickers[entry.dirKey];
    sticker.curr = sticker.orig === 4 ? 1 : 4;
    const tunnel = { entry, exit, entryColor: 4, exitColor: 1 };
    const ctx = makeCtx({ getCubies: () => cubies, resolveTunnel: () => ({ tunnel, tunnelKey: 'manual' }) });
    startJump(sim, ctx, SIZE);
    expect(sim.phase).toBe('windup');
    expect(sim.isJumping).toBe(false);
    expect(sim.activeTunnel).toBe(tunnel);
    expect(eventsOf(ctx, 'tunnelEnter')).toHaveLength(1);
  });

  it('does not dive into a sticker that is still rotating into place', () => {
    const sim = makeSim();
    const cubies = makeCubies(SIZE);
    const p = sim.pos;
    const sticker = cubies[p.x][p.y][p.z].stickers[p.dirKey];
    sticker.curr = sticker.orig === 4 ? 1 : 4;
    liveRotation.active = true;
    const ctx = makeCtx({ getCubies: () => cubies, resolveTunnel: () => { throw Error('premature lookup'); } });
    startJump(sim, ctx, SIZE);
    expect(sim.phase).toBe('crawling');
    expect(sim.isJumping).toBe(true);
    liveRotation.active = false;
  });

  it('extends an edge leap and samples a continuous corner path for head and body', () => {
    const sim = makeSim();
    sim.pos = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
    sim.moveDir = 'up';
    startJump(sim, makeCtx(), SIZE);
    expect(sim.jumpSpan).toBe(1.6);
    sim.crossingCorner = true;
    sim.cornerVault = true;
    sim.prevDirKey = 'PZ';
    sim.pos.dirKey = 'PY';
    sim.prevWorldPos = new THREE.Vector3(0, 1, 1.52);
    sim.curWorldPos = new THREE.Vector3(0, 1.52, 1);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    evaluatePosAndNormal(sim, 0.49, a);
    evaluatePosAndNormal(sim, 0.51, b);
    expect(Math.max(a.y, a.z)).toBeGreaterThanOrEqual(1.52);
    expect(a.distanceTo(b)).toBeGreaterThan(0.005);
    expect(a.distanceTo(b)).toBeLessThan(0.03);
    evaluatePosAndNormal(sim, 0, a);
    evaluatePosAndNormal(sim, 1, b);
    expect(a.distanceTo(sim.prevWorldPos)).toBeLessThan(1e-10);
    expect(b.distanceTo(sim.curWorldPos)).toBeLessThan(1e-10);
  });

  it.each(['classic', 'book', 'prism', 'wiggle', 'inch', 'glow', 'mobi'])(
    '%s can crawl beneath a raised jump arc, but not a low segment', character => {
      const sim = makeSim();
      sim.interpT = 1;
      sim.curWorldPos = new THREE.Vector3(0, 0, 1.52);
      sim.prevWorldPos = sim.curWorldPos.clone();
      sim.pos.dirKey = 'PZ';
      sim.tailLength = 100;
      sim.signature.character = character;
      const n = new THREE.Vector3(0, 0, 1);
      shReset(sim.stepHistory);
      shPush(sim.stepHistory, new THREE.Vector3(0, 0, 3), n, 1, 1, 2);
      shPush(sim.stepHistory, new THREE.Vector3(2, 0, 3), n, 2, 1, 2);
      expect(hasJumpClearance(sim)).toBe(true);
      sim.pendingSelfCollision = { key: tileKey(sim.pos) };
      ttReset(sim.tileTrail, tileKey(sim.pos));
      ttPush(sim.tileTrail, tileKey(sim.pos));
      const ctx = makeCtx({ getCharacter: () => character });
      stepWormSim(sim, 0, SIZE, ctx);
      expect(sim.alive).toBe(true);
      expect(eventsOf(ctx, 'death')).toHaveLength(0);
      // A low strand in the same column must still block the route.
      shReset(sim.stepHistory);
      shPush(sim.stepHistory, new THREE.Vector3(0, 0, 1.7), n, 1, 1, 2);
      shPush(sim.stepHistory, new THREE.Vector3(0, 0, 3), n, 1, 1, 2);
      shPush(sim.stepHistory, new THREE.Vector3(2, 0, 3), n, 2, 1, 2);
      expect(hasJumpClearance(sim)).toBe(false);
      stepWormSim(sim, 0, SIZE, ctx);
      expect(sim.alive).toBe(false);
    });

  it('allows the entire approach beneath an arch, including empty space before it', () => {
    const sim = makeSim();
    sim.prevWorldPos = new THREE.Vector3(-1, 0, 1.52);
    sim.curWorldPos = new THREE.Vector3(0, 0, 1.52);
    sim.pos.dirKey = 'PZ';
    sim.tailLength = 100;
    const normal = new THREE.Vector3(0, 0, 1);
    shReset(sim.stepHistory);
    shPush(sim.stepHistory, new THREE.Vector3(0, -1, 2.8), normal, 1, 1, 2);
    shPush(sim.stepHistory, new THREE.Vector3(0, 1, 2.8), normal, 1, 1, 2);
    for (let progress = 0; progress <= 1; progress += 0.05) {
      sim.interpT = progress;
      expect(hasJumpClearance(sim)).toBe(true);
    }
    // Sparse records still describe a continuous strand between their endpoints.
    shReset(sim.stepHistory);
    shPush(sim.stepHistory, new THREE.Vector3(0, -1, 1.6), normal, 1, 1, 2);
    shPush(sim.stepHistory, new THREE.Vector3(0, 1, 1.6), normal, 1, 1, 2);
    sim.interpT = 1;
    expect(hasJumpClearance(sim)).toBe(false);
  });

  it('includes the inch gait lift when checking a low raised strand', () => {
    const sim = makeSim();
    sim.interpT = 1;
    sim.curWorldPos = new THREE.Vector3(0, 0, 1.52);
    sim.pos.dirKey = 'PZ';
    sim.tailLength = 100;
    const normal = new THREE.Vector3(0, 0, 1);
    shReset(sim.stepHistory);
    shPush(sim.stepHistory, new THREE.Vector3(0, -1, 1.75), normal, 1, 1, 2);
    shPush(sim.stepHistory, new THREE.Vector3(0, 1, 1.75), normal, 1, 1, 2);
    expect(hasJumpClearance(sim)).toBe(false);
    advanceInchGaitState(sim.bodyGait, 1, 100, 10);
    Object.assign(sim.bodyGait, { enabled: true, move: 1, phase: 0 });
    expect(hasJumpClearance(sim)).toBe(true);
    sim.bodyGait.move = 0;
    expect(hasJumpClearance(sim)).toBe(false);
  });

  it('requires real clearance and detects an already airborne body underneath', () => {
    const sim = makeSim();
    sim.interpT = 1;
    sim.curWorldPos = new THREE.Vector3(0, 0, 1.52);
    sim.pos.dirKey = 'PZ';
    sim.isJumping = true;
    sim.jumpHeight = 1.5;
    sim.jumpT = 0.02;
    expect(hasJumpClearance(sim)).toBe(false);
    sim.jumpT = 0.5;
    expect(hasJumpClearance(sim)).toBe(true);
    shReset(sim.stepHistory);
    const n = new THREE.Vector3(0, 0, 1);
    shPush(sim.stepHistory, new THREE.Vector3(0, 0, 3), n, 1, 1, 2);
    shPush(sim.stepHistory, new THREE.Vector3(2, 0, 3), n, 2, 1, 2);
    sim.tailLength = 100;
    expect(hasJumpClearance(sim)).toBe(false);
  });
});


it('predicts a landing across an edge using transported steering', () => {
  const start = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
  const tile = jumpLandingTile(start, 'up', SIZE, 0.8, 0, 1.6);
  expect(tile.dirKey).toBe('PY');
  expect(tile.z).toBeLessThan(2);
  expect(jumpLandingTile(start, 'up', SIZE, 0.2, 0.95, 1)).toBe(start);
});


describe('elemental movement integration', () => {
  it('water accelerates while keeping tile interpolation and step time aligned', () => {
    const sim = makeSim();
    run(sim, makeCtx(), 1.2, 0.01);
    sim.elementalType = 'water';
    sim.elementalT = 10;
    run(sim, makeCtx(), 0.5, 0.01);
    expect(sim.prevStepSec).toBeLessThan(1);
    expect(sim.prevStepSec).toBeGreaterThanOrEqual(0.8);
    expect(sim.interpT).toBeCloseTo(sim.stepAcc / sim.prevStepSec, 2);
  });
  it('ice keeps a turn queued and releases it at the tile boundary', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    run(sim, ctx, 1.3);
    sim.elementalType = 'ice';
    sim.elementalT = 10;
    const before = sim.moveDir;
    queueTurn(sim, 'turnRight');
    run(sim, ctx, 0.05);
    expect(sim.moveDir).toBe(before);
    expect(sim.pendingTurns).toContain('turnRight');
    run(sim, ctx, 0.8);
    expect(sim.pendingTurns).not.toContain('turnRight');
  });
  it('a Nature landing creates a spring and fire movement leaves a hot route', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.elementalType = 'grass';
    sim.elementalT = 10;
    queueTurn(sim, 'jump');
    run(sim, ctx, 2.5);
    expect([...sim.elementalPatches.values()].some(p => p.type === 'grass')).toBe(true);
    sim.elementalType = 'fire';
    run(sim, ctx, 2);
    expect([...sim.elementalPatches.values()].some(p => p.type === 'fire')).toBe(true);
  });
});

it('reports a grass launch only after actually consuming the spring under the head', () => {
  liveRotation.active = false;
  const sim = makeSim(), launches = [];
  const ctx = makeCtx({ onStoryMechanic: key => launches.push(key) });
  startJump(sim, ctx, SIZE); expect(launches).toEqual([]);
  sim.isJumping = false; sim.jumpCount = 0;
  sim.elementalPatches.set(tileKey(sim.pos), { type: 'grass', ttl: 10 });
  startJump(sim, ctx, SIZE);
  expect(sim.elementalPatches.has(tileKey(sim.pos))).toBe(false);
  expect(launches).toEqual(['grassLaunch']);
  startJump(sim, ctx, SIZE); expect(launches).toEqual(['grassLaunch']);
});

describe('self-collision after a ring heal', () => {
  function followRing(tailLength, speed = 1, fps = 60, rescue = 'disabled', expanded = false, expectedHeals = 1) {
    const size = 5;
    const sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    sim.tailLength = tailLength;
    const tunnel = {
      entry: { x: 2, y: 3, z: 4, dirKey: 'PZ' },
      exit: { x: 2, y: 1, z: 0, dirKey: 'NZ' },
    };
    const ctx = makeCtx({
      isStoryMode: () => true,
      getSpeed: () => speed,
      isJumpRescueEnabled: () => rescue !== 'disabled',
      getActiveTunnels: () => sim.healed ? [] : [{ tunnel, tunnelKey: 'ring' }],
    });
    ctx.onJumpRescue = active => ctx.events.push({ type: 'rescue', active });
    if (expanded) {
      sim.explodeT = 9999;
      tickExpansion(sim, size, EXPLODE_TRANSITION, ctx);
      expect(sim.expansionAmount).toBe(EXPLODE_AMOUNT);
    }
    // Walk the actual eight-cell ring and then close the loop. Record the body
    // through the sim, including the heal pause: tile labels alone miss this bug.
    const directions = ['right', 'up', 'up', 'left', 'left', 'down', 'down', 'right', 'right'];
    sim.moveDir = directions[0];
    sim.stepAcc = 1 / speed;
    stepWormSim(sim, 0, size, ctx);
    let step = 1;
    sim.moveDir = directions[step];
    let last = tileKey(sim.pos);
    for (let i = 0; i < fps * 20 && sim.alive && step < directions.length; i++) {
      if (rescue === 'jump' && sim.jumpRescueT > 0) queueTurn(sim, 'jump');
      stepWormSim(sim, 1 / fps, size, ctx);
      const key = tileKey(sim.pos);
      if (key !== last) {
        last = key;
        step++;
        sim.moveDir = directions[step] ?? 'right';
      }
    }
    expect(eventsOf(ctx, 'heal')).toHaveLength(expectedHeals);
    return { sim, ctx };
  }

  it.each([
    [80, 1, 60, true], [88, 1, 60, false], [90, 1, 60, false], [100, 1, 60, false],
    [80, 4, 30, true], [88, 4, 30, false], [88, 4, 120, false],
  ])('resolves %s beads at speed %s, %s Hz (survives: %s)', (length, speed, fps, survives) => {
    const { sim, ctx } = followRing(length, speed, fps);
    expect(sim.alive).toBe(survives);
    expect(eventsOf(ctx, 'death')).toHaveLength(survives ? 0 : 1);
    if (!survives) expect(eventsOf(ctx, 'death')[0].args[0].reason).toBe('self-collision');
  });

  it.each([[1, 60], [4, 30], [4, 120]])('does not heal a logical ring beyond the expanded body at speed %s and %s Hz', (speed, fps) => {
    const { sim } = followRing(88, speed, fps, 'disabled', true, 0);
    expect(sim.healed).toBe(0);
    expect(sim.ringHealedTunnelKeys.size).toBe(0);
  });

  it('still heals an expanded ring when the physical body is long enough', () => {
    const { sim } = followRing(140, 1, 60, 'disabled', true);
    expect(sim.healed).toBe(1);
  });

  it.each(['jump', 'timeout'])('preserves the rescue %s for a tail-tip collision after healing', rescue => {
    const { sim, ctx } = followRing(88, 1, 60, rescue);
    expect(eventsOf(ctx, 'rescue').map(e => e.active)).toEqual([true, false]);
    expect(sim.alive).toBe(rescue === 'jump');
    expect(eventsOf(ctx, 'death')).toHaveLength(rescue === 'jump' ? 0 : 1);
  });
});

describe('crossing a moving slice after its initial hazard check', () => {
  it('dies at visible contact, emits one slice death, and holds the impact pose through commit', () => {
    const sim = makeSim(), ctx = makeCtx();
    expect(runUntil(sim,ctx,() => !!sim.prevTile && sim.interpT >= 0.35)).toBe(true);
    expect(sim.interpT).toBeLessThan(0.5);
    setLiveRotation('row',[sim.pos.y],[0.6],sim.pos.y,0.6);
    run(sim,ctx,0.05);
    expect(sim.alive).toBe(true);
    expect(runUntil(sim,ctx,() => !sim.alive)).toBe(true);
    expect(sim.interpT).toBe(0.5);
    expect(eventsOf(ctx,'death')).toHaveLength(1);
    expect(eventsOf(ctx,'death')[0].args[0]).toMatchObject({ reason:'slice-rotation', liveCrossing:true });
    const head = sim.headInterpPos.clone();
    applyRotationToSim(sim,SIZE,ctx,{axis:'row',sliceIndex:sim.pos.y,dir:1},{paused:false,inOpeningScramble:false});
    expect(sim.headInterpPos.equals(head)).toBe(true);
    resetLiveRotation();
  });
});

describe('raised WORM platforms', () => {
  function platformCtx(sim, flippedFace = sim.pos.dirKey) {
    const cubies = makeCubies(SIZE);
    const c = cubies[sim.pos.x][sim.pos.y][sim.pos.z];
    const s = c.stickers[flippedFace];
    s.flips = 1; s.curr = s.orig === 1 ? 4 : 1;
    const tunnel = { entry: { ...sim.pos }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' } };
    return makeCtx({ getCubies: () => cubies, getTunnelEntry: () => 'pad',
      resolveTunnel: () => ({ tunnel, tunnelKey: 'raised-test' }) });
  }
  it.each([30, 60, 120])('jumps to the raised mouth before entering at %s Hz', hz => {
    const sim = makeSim(), ctx = platformCtx(sim);
    const before = sim.headInterpPos.clone();
    startJump(sim, ctx, SIZE);
    expect(sim.phase).toBe('crawling');
    expect(sim.padFlight).toBeTruthy();
    stepWormSim(sim, 1 / hz, SIZE, ctx);
    expect(sim.headInterpPos.distanceTo(before)).toBeLessThan(0.2);
    for (let frame = 0; frame < hz && sim.padFlight; frame++) stepWormSim(sim, 1 / hz, SIZE, ctx);
    expect(sim.phase).toBe('windup');
    // The piece stays in its slot; only the tile hovers, a short hop off the surface.
    expect(sim.activeTunnel.padExpansion).toBe(0);
    expect(sim.activeTunnel.padHeight).toBe(WORM_PAD_HEIGHT);
    expect(sim.onRaisedPlatform).toBe(true);
    expect(sim.headInterpPos.z).toBeCloseTo(1.52 + WORM_PAD_HEIGHT + 0.08, 6);
    expect(sim.stepHistory.count).toBeGreaterThan(64);
    expect(shAt(sim.stepHistory, 0).pos.distanceTo(sim.headInterpPos)).toBeLessThan(1e-6);
  });
  it("treats a flipped piece's other faces as floor and aims at its pad", () => {
    const sim = makeSim();
    sim.pos = { x: 2, y: 2, z: 2, dirKey: 'PZ' };
    const ctx = platformCtx(sim, 'PY');
    // No piece rises in WORM, so the corner's unflipped front face is ordinary floor.
    expect(raisedPlatformPosition(sim.pos, SIZE, ctx)).toBeNull();
    expect(raisedPlatformPosition({ ...sim.pos, dirKey: 'PY' }, SIZE, ctx).toArray()).toEqual([1, 1.52 + WORM_PAD_HEIGHT, 1]);
    startJump(sim, ctx, SIZE, { allowDive: false });
    expect(sim.padFlight.target.dirKey).toBe('PY');
    for (let i = 0; i < 100 && sim.padFlight; i++) stepWormSim(sim, 1 / 60, SIZE, ctx);
    expect(sim.phase).toBe('crawling');
    expect(sim.onRaisedPlatform).toBe(true);
    expect(sim.curWorldPos.y).toBeCloseTo(1.52 + WORM_PAD_HEIGHT, 6);
    expect(ctx.events.some(e => e.type === 'tunnelEnter')).toBe(false);
  });
  it('does not enter from a crawl and preserves the jump across pause', () => {
    const sim = makeSim(), ctx = platformCtx(sim);
    sim.pendingTunnelTrigger = { ...sim.pos };
    stepWormSim(sim, 1 / 60, SIZE, ctx);
    expect(sim.phase).toBe('crawling');
    startJump(sim, ctx, SIZE);
    stepWormSim(sim, 0.05, SIZE, ctx);
    const pose = sim.headInterpPos.clone(), t = sim.padFlight.t;
    stepWormSim(sim, 0.05, SIZE, { ...ctx, isPaused: () => true });
    expect(sim.headInterpPos.equals(pose)).toBe(true);
    expect(sim.padFlight.t).toBe(t);
  });
  it('rescue jumps can land on a pad without triggering a ride', () => {
    const sim = makeSim(), ctx = platformCtx(sim);
    startJump(sim, ctx, SIZE, { allowDive: false });
    for (let i = 0; i < 40; i++) stepWormSim(sim, 1 / 60, SIZE, ctx);
    expect(sim.phase).toBe('crawling');
    expect(sim.onRaisedPlatform).toBe(true);
  });
});

it.each([3, 7, 15])('captures a pad one cell ahead and lands a short hop up on a %s cube', size => {
  resetLiveRotation();
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  sim.pos = { x: size - 2, y: size - 1, z: size - 1, dirKey: 'PZ' };
  sim.moveDir = 'right';
  const cubies = makeCubies(size);
  const target = cubies[size - 1][size - 1][size - 1];
  target.stickers.PZ.flips = 1; target.stickers.PZ.curr = 4;
  const ctx = makeCtx({ getCubies: () => cubies, getTunnelEntry: () => 'pad' });
  startJump(sim, ctx, size, { allowDive: false });
  expect(sim.padFlight.target.x).toBe(size - 1);
  while (sim.padFlight) stepWormSim(sim, 1 / 60, size, ctx);
  expect(sim.onRaisedPlatform).toBe(true);
  expect(sim.pos.x).toBe(size - 1);
  expect(sim.phase).toBe('crawling');
  // The same height on every board size: the surface plus the pad's hover.
  expect(sim.curWorldPos.z).toBeCloseTo((size - 1) / 2 + 0.52 + WORM_PAD_HEIGHT, 6);
});

it('keeps raised tunnel windout connected to subsequent crawl', () => {
  resetLiveRotation();
  const sim = makeSim();
  const cubies = makeCubies(SIZE);
  for (const [z, d] of [[2, 'PZ'], [0, 'NZ']]) {
    cubies[1][1][z].stickers[d].flips = 1;
    cubies[1][1][z].stickers[d].curr = z === 2 ? 4 : 1;
  }
  const tunnel = { entry: { ...sim.pos }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' } };
  const ctx = makeCtx({ getCubies: () => cubies, getTunnelEntry: () => 'pad',
    resolveTunnel: () => ({ tunnel, tunnelKey: 'raised-exit' }) });
  startJump(sim, ctx, SIZE);
  while (sim.padFlight) stepWormSim(sim, 1 / 60, SIZE, ctx);
  for (let i = 0; i < 1500 && sim.phase !== 'crawling'; i++) stepWormSim(sim, 1 / 60, SIZE, ctx);
  expect(sim.phase).toBe('crawling');
  // The exit pad hovers over its slot too.
  expect(sim.onRaisedPlatform).toBe(true);
  expect(sim.headInterpPos.z).toBeCloseTo(-(1.52 + WORM_PAD_HEIGHT));
  const exit = sim.headInterpPos.clone();
  stepWormSim(sim, 1 / 60, SIZE, ctx);
  expect(sim.headInterpPos.distanceTo(exit)).toBeLessThan(0.2);
});


it('puts a ride that started on the floor onto the exit pad, although no piece rises', () => {
  const sim = makeSim();
  const tunnel = { entry: { ...sim.pos }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' }, padExpansion: 0, padHeight: WORM_PAD_HEIGHT };
  sim.phase = 'windout'; sim.activeTunnel = tunnel; sim.tunnelProgress = 0;
  sim.pos = { ...tunnel.exit };
  // MOBI's elevator ride begins from the floor, so nothing else marks the pad.
  sim.onRaisedPlatform = false;
  const ctx = makeCtx({ isStoryMode: () => true });
  for (let i = 0; i < 200 && sim.phase === 'windout'; i++) stepWormSim(sim, 1 / 60, SIZE, ctx);
  expect(sim.phase).toBe('crawling');
  expect(sim.onRaisedPlatform).toBe(true);
  expect(sim.curWorldPos.z).toBeCloseTo(-(1.52 + WORM_PAD_HEIGHT), 6);
});

it('holds a raised tunnel open throughout the reverse orbit, including a short tail', () => {
  const sim = makeSim();
  const tunnel = { entry: { ...sim.pos }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' }, padExpansion: .5, padHeight: .5 };
  sim.phase = 'windout'; sim.activeTunnel = tunnel; sim.tunnelProgress = 0;
  sim.tailLength = 4;
  sim.tunnelPassages.push({ tunnel, tunnelKey: 'orbit', exitDistance: sim.stepHistory.distance,
    heal: { tunnel, stableKey: 'orbit', tunnelKey: 'orbit' }, clearFrame: false });
  const ctx = makeCtx({ isStoryMode: () => true });
  let frames = 0;
  while (sim.phase === 'windout' && frames++ < 100) {
    stepWormSim(sim, 1 / 60, SIZE, ctx);
    expect(ctx.events.some(e => e.type === 'heal')).toBe(false);
  }
  expect(frames / 60).toBeCloseTo(1.4, 1);
  expect(sim.phase).toBe('crawling');
  stepWormSim(sim, 1 / 60, SIZE, ctx);
  expect(ctx.events.filter(e => e.type === 'heal')).toHaveLength(1);
});
