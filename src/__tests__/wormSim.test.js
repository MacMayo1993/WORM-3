// Deterministic tests for the worm simulation core (healerWorm/wormSim.js).
// The sim is driven with fixed dt values and a stubbed ctx port — no React,
// no store, no renderer. This is the test surface the wormSim extraction exists
// to provide: crawl/turn/jump/boost/tunnel/rotation logic asserted directly on
// the plain state object.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeWormSim,
  resetWormSim,
  stepWormSim,
  applyRotationToSim,
  killWormSim,
  queueTurn,
  jumpLiftOf,
  tileKey,
} from '../worm/healerWorm/wormSim.js';
import {
  MAX_TICK_DELTA,
  BOOST_DURATION,
  BOOST_COOLDOWN,
  MAX_JUMPS,
  BASE_TAIL_LENGTH,
  ORB_SEGMENT_GROWTH,
  WINDOUT_SEGMENT_DT,
  windoutHeadS,
  activeTunnelCap,
  MAX_ACTIVE_TUNNEL_PAIRS,
} from '../worm/healerWorm/constants.js';
import { makeCubies } from '../game/cubeState.js';
import { liveRotation } from '../worm/liveRotation.js';
import { ttAt } from '../worm/circularBuffers.js';

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
    // Jump spans one tile of travel, then lands and resets the counter
    run(sim, ctx, 1.5);
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

describe('active tunnel pair cap', () => {
  it('scales down for smaller boards and clamps mega to the ceiling', () => {
    expect(activeTunnelCap(2)).toBe(4);
    expect(activeTunnelCap(3)).toBe(5);
    expect(activeTunnelCap(4)).toBe(6);
    expect(activeTunnelCap(5)).toBe(7);
    expect(activeTunnelCap(15)).toBe(10);
    expect(activeTunnelCap(15)).toBe(MAX_ACTIVE_TUNNEL_PAIRS);
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
  it('keeps windout active until the last body segment clears the portal', () => {
    const tailLength = 40;
    const finalHeadS = windoutHeadS(1, tailLength);
    const finalTailS = finalHeadS + (tailLength - 1) * WINDOUT_SEGMENT_DT;
    expect(finalTailS).toBeCloseTo(0, 10);
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

  it('heals on exit when enough orbs were deposited', () => {
    const { cubies, tunnel, tunnelKey } = makeFlippedWorld();
    const sim = makeSim();
    const stableKey = 'PZ-1-2-2';
    const ctx = makeCtx({
      getCubies: () => cubies,
      resolveTunnel: () => ({ tunnel, tunnelKey }),
      getHealingProgress: () => ({ [stableKey]: { deposited: 4, faceId: 4 } }),
    });
    const reachedWindout = runUntil(sim, ctx, () => sim.phase === 'windout');
    expect(reachedWindout).toBe(true);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    expect(sim.pendingTunnelHeal?.tunnel).toBe(tunnel);

    // Reaching full windout only exposes the last segment. The tunnel remains
    // flipped for that rendered frame; healing fires on the following sim tick.
    const tailCleared = runUntil(sim, ctx, () => sim.windoutTailCleared);
    expect(tailCleared).toBe(true);
    expect(sim.phase).toBe('windout');
    expect(sim.tunnelProgress).toBe(1);
    expect(eventsOf(ctx, 'heal')).toHaveLength(0);
    stepWormSim(sim, 0.05, SIZE, ctx);

    expect(eventsOf(ctx, 'heal')).toHaveLength(1);
    expect(sim.healed).toBe(1);
    expect(sim.healFired).toBe(true);
    expect(sim.pendingHealBurst).toEqual({ exitTile: tunnel.exit, entryTile: tunnel.entry });
    // Healed tunnel's traversal bookkeeping is dropped
    expect(sim.tunnelUseCounts.has(tunnelKey)).toBe(false);
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

  it('carries an armed void kill\'s exit tile through the turn', () => {
    // The collapse fires once the head steps OFF the exit tile; comparing against a
    // slot the exit no longer occupies fires it a step early or late.
    const sim = makeSim();
    const ctx = makeCtx();
    sim.pendingVoidKill = { tunnelKey: 'k', exitTileKey: tileKey({ x: 0, y: 1, z: 2, dirKey: 'PZ' }), armed: true };
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 2, dir: 1 }, {
      inOpeningScramble: false,
      paused: false,
    });
    expect(sim.pendingVoidKill.exitTileKey).not.toBe(tileKey({ x: 0, y: 1, z: 2, dirKey: 'PZ' }));
    expect(sim.pendingVoidKill.armed).toBe(true);
  });

  it('leaves an armed void kill alone when its exit tile was not in the slice', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const key = tileKey({ x: 0, y: 1, z: 0, dirKey: 'NZ' });
    sim.pendingVoidKill = { tunnelKey: 'k', exitTileKey: key, armed: true };
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 2, dir: 1 }, {
      inOpeningScramble: false,
      paused: false,
    });
    expect(sim.pendingVoidKill.exitTileKey).toBe(key);
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
