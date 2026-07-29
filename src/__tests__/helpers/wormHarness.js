// Shared headless driver for the worm simulation.
//
// The sim is deliberately free of React, Zustand, Three and audio — everything
// it needs from the outside world arrives through a `ctx` port. That makes it
// drivable from a plain Node process, which is what this module packages up:
// a stubbed ctx that records every effect the sim requests, plus fixed-dt
// runners.
//
// This started as three near-identical copies inlined in wormSim.test.js,
// wormSpecials.test.js and (later) the Mega Worm soak. They drifted — different
// default cubies, different SIZE — which is exactly the kind of divergence that
// makes a "same test, different file" failure hard to read. One copy now.
//
// Not a *.test.js file, so vitest's `include` (src/**/*.{test,spec}.*) does not
// collect it. It is also imported by scripts/megaBench.mjs, which is why it
// stays free of anything a bare Node run cannot resolve.

import { makeWormSim, resetWormSim, stepWormSim, tileKey } from '../../worm/healerWorm/wormSim.js';

/**
 * Stubbed ctx port. Every read has a neutral default; every effect records an
 * event so a test can assert on what the sim asked the world to do.
 *
 * @param {object} overrides - any ctx field, replacing the default
 * @returns {object} ctx with an `events` array attached
 */
export function makeWormCtx(overrides = {}) {
  const events = [];
  const log = (type) => (...args) => { events.push({ type, args }); };
  return {
    events,
    // ── Reads ────────────────────────────────────────────────────────────────
    getCubies: () => null,
    getGamePhase: () => 'active',
    isPaused: () => false,
    getSpeed: () => 1.0,
    getControlMode: () => 'non-oriented',
    // Wormhole spawns are off by default so each test controls the board.
    getWormholeInterval: () => 9999,
    isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
    getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88',
    resolveTunnel: () => null,
    // ── Effects ──────────────────────────────────────────────────────────────
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

/** Build a reset sim with no orbs and no ambient wormhole spawns. */
export function makeWormSimFor(size, resetOpts = {}) {
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999, ...resetOpts });
  return sim;
}

/**
 * Fixed-dt runners bound to one cube size.
 *
 * dt defaults to 0.05 — comfortably under the sim's MAX_TICK_DELTA clamp of 0.1,
 * so no step is silently truncated and a run of N steps really is N×dt of
 * simulated time.
 */
export function makeWormRunner(size) {
  /** Advance by `seconds` of simulated time. */
  const run = (sim, ctx, seconds, dt = 0.05) => {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) stepWormSim(sim, dt, size, ctx);
  };

  /** Step until `predicate()` holds (checked after each step), or give up. */
  const runUntil = (sim, ctx, predicate, maxSeconds = 30, dt = 0.05) => {
    const steps = Math.round(maxSeconds / dt);
    for (let i = 0; i < steps; i++) {
      stepWormSim(sim, dt, size, ctx);
      if (predicate()) return true;
    }
    return false;
  };

  /** Step until the worm commits onto a new tile. Returns that tile, or null. */
  const stepUntilCommit = (sim, ctx, maxSeconds = 10, dt = 0.05) => {
    const from = tileKey(sim.pos);
    const steps = Math.round(maxSeconds / dt);
    for (let i = 0; i < steps; i++) {
      stepWormSim(sim, dt, size, ctx);
      if (tileKey(sim.pos) !== from) return sim.pos;
    }
    return null;
  };

  /** Advance exactly `count` sim steps. Used by soaks that count work, not time. */
  const runSteps = (sim, ctx, count, dt = 0.05) => {
    for (let i = 0; i < count; i++) stepWormSim(sim, dt, size, ctx);
  };

  return { run, runUntil, stepUntilCommit, runSteps };
}

export const eventsOf = (ctx, type) => ctx.events.filter(e => e.type === type);

/**
 * Deterministic RNG (mulberry32) for soaks and benches.
 *
 * `resetWormSim` deliberately leaves `sim.rand` alone, so assigning one of these
 * to it makes special spawns and every other draw reproducible across runs.
 */
export function makeSeededRand(seed = 0x9e3779b9) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
