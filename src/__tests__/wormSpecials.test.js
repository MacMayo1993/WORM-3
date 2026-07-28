// Deterministic tests for the special power-ups (rocket / magnet).
//
// Same approach as wormSim.test.js: the sim is driven with fixed dt values and a
// stubbed ctx port — no React, no store, no renderer. The rules under test are the
// ones a player would notice: a special has to be jumped for, a rocket is a long
// airborne arc that clears hazards, and the magnet's reach is measured in manifold
// steps so it wraps around face edges.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeWormSim,
  resetWormSim,
  stepWormSim,
  applyRotationToSim,
  startRocket,
  startMagnet,
  queueTurn,
  jumpLiftOf,
  tileKey,
} from '../worm/healerWorm/wormSim.js';
import {
  SPECIAL_SPAWN_INTERVAL,
  SPECIAL_LIFETIME,
  SPECIAL_MAX_ON_BOARD,
  SPECIAL_TYPES,
  SPECIAL_SPAWN_RADIUS,
  ROCKET_TILE_SPAN,
  ROCKET_JUMP_HEIGHT,
  MAGNET_DURATION,
  SURFACE_JUMP_HEIGHT,
  SURFACE_JUMP_TILE_SPAN,
  BASE_TAIL_LENGTH,
} from '../worm/healerWorm/constants.js';
import { collectManifoldRing } from '../worm/wormLogic.js';
import { makeCubies } from '../game/cubeState.js';
import { checkWormHitBySlice } from '../worm/wormHelpers.js';
import { makeTileTrail, ttReset, ttPush } from '../worm/circularBuffers.js';
import { liveRotation } from '../worm/liveRotation.js';

const SIZE = 5;

function makeCtx(overrides = {}) {
  const events = [];
  const log = (type) => (...args) => { events.push({ type, args }); };
  // A real solved cube — the pickup path reads the sticker under an orb to decide
  // its colour and whether it is hovering on a flipped tile.
  const cubies = makeCubies(SIZE);
  return {
    events,
    getCubies: () => cubies,
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
    ...overrides,
  };
}

function makeSim() {
  const sim = makeWormSim(SIZE);
  // No parity orbs and no wormhole spawns by default, so each test controls exactly
  // what is on the board.
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  return sim;
}

const run = (sim, ctx, seconds, dt = 0.05) => {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWormSim(sim, dt, SIZE, ctx);
};

// Step until the worm commits onto a new tile (or maxSeconds elapse). Returns the
// tile it landed on.
function stepUntilCommit(sim, ctx, maxSeconds = 10, dt = 0.05) {
  const from = tileKey(sim.pos);
  const steps = Math.round(maxSeconds / dt);
  for (let i = 0; i < steps; i++) {
    stepWormSim(sim, dt, SIZE, ctx);
    if (tileKey(sim.pos) !== from) return sim.pos;
  }
  return null;
}

const eventsOf = (ctx, type) => ctx.events.filter(e => e.type === type);
const apple = (x, y, z, dirKey) => ({ x, y, z, dirKey, type: 'apple' });
const special = (x, y, z, dirKey, type = 'rocket') =>
  ({ x, y, z, dirKey, type, ttl: SPECIAL_LIFETIME, id: 'test-special' });

beforeEach(() => {
  liveRotation.active = false;
});

// The worm spawns at the centre of PZ facing 'up' (+y), so on a 5×5 it walks
// (2,2,4) → (2,3,4) → (2,4,4) before crossing onto PY.
const START = { x: 2, y: 2, z: 4, dirKey: 'PZ' };

describe('collectManifoldRing', () => {
  it('returns only the centre tile at depth 0', () => {
    const ring = collectManifoldRing(2, 2, 4, 'PZ', SIZE, 0);
    expect([...ring]).toEqual(['2,2,4,PZ']);
  });

  it('returns the 4 orthogonal neighbours at depth 1 on a face interior', () => {
    const ring = collectManifoldRing(2, 2, 4, 'PZ', SIZE, 1);
    expect(ring.size).toBe(5); // centre + 4
    expect(ring.has('1,2,4,PZ')).toBe(true);
    expect(ring.has('3,2,4,PZ')).toBe(true);
    expect(ring.has('2,1,4,PZ')).toBe(true);
    expect(ring.has('2,3,4,PZ')).toBe(true);
  });

  it('expands to the full diamond at depth 2', () => {
    const ring = collectManifoldRing(2, 2, 4, 'PZ', SIZE, 2);
    // centre + 4 at distance 1 + 8 at distance 2
    expect(ring.size).toBe(13);
    expect(ring.has('0,2,4,PZ')).toBe(true); // two steps left
    expect(ring.has('1,3,4,PZ')).toBe(true); // diagonal = two steps
    expect(ring.has('2,0,4,PZ')).toBe(true); // two steps down
    expect(ring.has('0,1,4,PZ')).toBe(false); // three steps (two left, one down)
  });

  it('wraps around a face edge — the reach is manifold steps, not grid distance', () => {
    // (2,4,4) sits on the PZ/PY edge, so its neighbourhood spills onto PY.
    const ring = collectManifoldRing(2, 4, 4, 'PZ', SIZE, 1);
    const faces = new Set([...ring].map(k => k.split(',')[3]));
    expect(faces.has('PZ')).toBe(true);
    expect(faces.has('PY')).toBe(true);
  });

  it('clears and reuses a caller-supplied set', () => {
    const reused = new Set(['stale']);
    const ring = collectManifoldRing(2, 2, 4, 'PZ', SIZE, 1, reused);
    expect(ring).toBe(reused);
    expect(ring.has('stale')).toBe(false);
  });
});

describe('special orb spawning', () => {
  it('spawns a special on the ambient timer and publishes it', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    expect(sim.specials).toHaveLength(0);
    // Step one at a time so the board can be inspected on the exact spawn frame,
    // before the worm has crawled away from it.
    // The spawn runs before the movement commit inside a frame, so the head it
    // anchored to is the position from the START of that frame.
    let spawned = null;
    for (let i = 0; i < 2000 && !spawned; i++) {
      const headBefore = { ...sim.pos };
      stepWormSim(sim, 0.05, SIZE, ctx);
      if (sim.specials.length) spawned = { orb: sim.specials[0], head: headBefore };
    }
    expect(spawned).not.toBeNull();
    expect(SPECIAL_TYPES).toContain(spawned.orb.type);
    expect(eventsOf(ctx, 'specials').length).toBeGreaterThan(0);

    // It landed near the worm, not on the far side of the cube where the player
    // would never see it before it timed out.
    const { head } = spawned;
    const reachable = collectManifoldRing(head.x, head.y, head.z, head.dirKey, SIZE, SPECIAL_SPAWN_RADIUS);
    expect(reachable.has(tileKey(spawned.orb))).toBe(true);
  });

  it('never exceeds the on-board cap', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    run(sim, ctx, SPECIAL_SPAWN_INTERVAL * 4);
    expect(sim.specials.length).toBeLessThanOrEqual(SPECIAL_MAX_ON_BOARD);
  });

  it('despawns a special once its lifetime runs out', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specials = [special(0, 0, 4, 'PZ', 'magnet')];
    run(sim, ctx, SPECIAL_LIFETIME + 0.5);
    expect(sim.specials).toHaveLength(0);
    expect(eventsOf(ctx, 'specials').length).toBeGreaterThan(0);
  });

  it('does not spawn or age specials while the sim is paused', () => {
    const sim = makeSim();
    const ctx = makeCtx({ isPaused: () => true });
    sim.specials = [special(0, 0, 4, 'PZ')];
    run(sim, ctx, SPECIAL_LIFETIME + SPECIAL_SPAWN_INTERVAL);
    expect(sim.specials).toHaveLength(1);
    expect(sim.specials[0].ttl).toBe(SPECIAL_LIFETIME);
  });
});

describe('claiming a special', () => {
  it('is claimed by crawling onto it — contact is enough', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specials = [special(2, 3, 4, 'PZ')];
    stepUntilCommit(sim, ctx); // lands on (2,3,4)
    expect(sim.pos).toMatchObject({ x: 2, y: 3, z: 4, dirKey: 'PZ' });
    expect(sim.specials).toHaveLength(0);
    expect(sim.rocketActive).toBe(true);
    expect(sim.pendingSpecialFlash).toMatchObject({ type: 'rocket' });
  });

  it('is claimed from an adjacent tile while airborne', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // One tile to the side of the worm's path — a grounded worm walks straight past.
    sim.specials = [special(1, 3, 4, 'PZ', 'magnet')];
    run(sim, ctx, 0.5);
    queueTurn(sim, 'jump');
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.isJumping).toBe(true);

    stepUntilCommit(sim, ctx);
    expect(sim.pos).toMatchObject({ x: 2, y: 3, z: 4, dirKey: 'PZ' });
    expect(sim.specials).toHaveLength(0);
    expect(sim.magnetT).toBeGreaterThan(0);
  });

  it('is left alone one tile off the path when grounded', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specials = [special(1, 3, 4, 'PZ', 'magnet')];
    stepUntilCommit(sim, ctx);
    expect(sim.specials).toHaveLength(1);
    expect(sim.magnetT).toBe(0);
  });

  it('is pulled in by an active magnet', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specials = [special(0, 3, 4, 'PZ', 'rocket')]; // two steps away
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx);
    expect(sim.specials).toHaveLength(0);
    expect(sim.rocketActive).toBe(true);
  });

  it('carries specials through a committed slice rotation', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specials = [special(0, 0, 4, 'PZ', 'rocket')];
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', dir: 1, sliceIndex: 4 }, {
      inOpeningScramble: false, paused: false,
    });
    const moved = sim.specials[0];
    // The tile rode the slice, and the orb's identity travelled with it.
    expect(tileKey(moved)).not.toBe('0,0,4,PZ');
    expect(moved.type).toBe('rocket');
    expect(moved.ttl).toBe(SPECIAL_LIFETIME);
    expect(eventsOf(ctx, 'specials').length).toBeGreaterThan(0);
  });
});

describe('rocket', () => {
  it('launches a long, tall arc and reports the state change', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startRocket(sim, ctx);
    expect(sim.rocketActive).toBe(true);
    expect(sim.isJumping).toBe(true);
    expect(sim.jumpSpan).toBe(ROCKET_TILE_SPAN);
    expect(sim.jumpHeight).toBe(ROCKET_JUMP_HEIGHT);
    expect(eventsOf(ctx, 'rocketState')[0].args[0]).toBe(true);
  });

  it('crosses about ROCKET_TILE_SPAN tiles before landing, then restores jump defaults', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    stepUntilCommit(sim, ctx); // start the flight from a fresh step boundary
    startRocket(sim, ctx);

    let commits = 0;
    let lastKey = tileKey(sim.pos);
    let peakLift = 0;
    for (let i = 0; i < 400 && sim.rocketActive; i++) {
      stepWormSim(sim, 0.05, SIZE, ctx);
      peakLift = Math.max(peakLift, jumpLiftOf(sim));
      const key = tileKey(sim.pos);
      if (key !== lastKey) { commits++; lastKey = key; }
    }

    expect(sim.rocketActive).toBe(false);
    expect(commits).toBeGreaterThanOrEqual(ROCKET_TILE_SPAN - 1);
    expect(commits).toBeLessThanOrEqual(ROCKET_TILE_SPAN + 1);
    // The arc peaks near the rocket's apex, well above a normal jump.
    expect(peakLift).toBeGreaterThan(SURFACE_JUMP_HEIGHT);
    expect(peakLift).toBeLessThanOrEqual(ROCKET_JUMP_HEIGHT + 1e-6);
    // Back to a normal jump for the next press.
    expect(sim.isJumping).toBe(false);
    expect(sim.jumpSpan).toBe(SURFACE_JUMP_TILE_SPAN);
    expect(sim.jumpHeight).toBe(SURFACE_JUMP_HEIGHT);
    expect(eventsOf(ctx, 'rocketState').map(e => e.args[0])).toEqual([true, false]);
  });

  it('cannot be cut short by a jump press mid-flight', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startRocket(sim, ctx);
    run(sim, ctx, 0.3);
    const airborneT = sim.jumpT;
    queueTurn(sim, 'jump');
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.rocketActive).toBe(true);
    expect(sim.jumpSpan).toBe(ROCKET_TILE_SPAN);
    expect(sim.jumpT).toBeGreaterThan(airborneT); // kept advancing, was not reset
  });

  it('flies over a rotating slice that would otherwise kill the worm', () => {
    const head = { x: 1, y: 1, z: 4, dirKey: 'PZ' };
    const trail = makeTileTrail(100);
    // Body entirely off the slice, head on it → a grounded worm is sliced in half.
    ttReset(trail, '0,0,4,PZ');
    ttPush(trail, head.x + ',' + head.y + ',' + head.z + ',' + head.dirKey);
    const worm = {
      pos: { current: head },
      tileTrail: { current: trail },
      tailLength: { current: 50 },
      rocketActive: { current: false },
    };
    expect(checkWormHitBySlice(worm, 'col', 1)).toEqual({ type: 'death' });

    worm.rocketActive.current = true;
    // Airborne: the head is clear, so the turn no longer kills.
    expect(checkWormHitBySlice(worm, 'col', 1)).not.toEqual({ type: 'death' });
  });
});

describe('magnet', () => {
  it('sets the reach window and publishes its duration', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startMagnet(sim, ctx);
    expect(sim.magnetT).toBe(MAGNET_DURATION);
    expect(eventsOf(ctx, 'magnetState')[0].args[0]).toBe(MAGNET_DURATION);
  });

  it('collects an orb two manifold steps away', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // (0,3,4) is two steps left of the tile the worm is about to land on.
    sim.powerups = [apple(0, 3, 4, 'PZ')];
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx);
    expect(sim.pos).toMatchObject({ x: 2, y: 3, z: 4, dirKey: 'PZ' });
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
    expect(sim.tailLength).toBeGreaterThan(BASE_TAIL_LENGTH);
  });

  it('leaves that same orb alone without the magnet', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [apple(0, 3, 4, 'PZ')];
    stepUntilCommit(sim, ctx);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(0);
    expect(sim.powerups[0]).toMatchObject({ x: 0, y: 3, z: 4, dirKey: 'PZ' });
    expect(sim.tailLength).toBe(BASE_TAIL_LENGTH);
  });

  it('does not reach three steps away', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [apple(0, 4, 4, 'PZ')]; // three steps from (2,3,4)
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(0);
  });

  it('reports the pickup colour and combo so the HUD can flash', () => {
    const sim = makeSim();
    const ctx = makeCtx({ getOrbColor: () => '#ff00aa' });
    sim.powerups = [apple(2, 3, 4, 'PZ'), apple(2, 4, 4, 'PZ')];
    stepUntilCommit(sim, ctx); // first orb
    stepUntilCommit(sim, ctx); // second orb, within the 2s combo window
    const picks = eventsOf(ctx, 'pickup');
    expect(picks).toHaveLength(2);
    // args are (faceId, orbCount, color, combo)
    expect(picks[0].args[2]).toBe('#ff00aa');
    expect(picks[0].args[3]).toBe(0);
    expect(picks[1].args[3]).toBe(1); // combo climbed on the quick second pickup
  });

  it('sweeps up several orbs in one step', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [apple(0, 3, 4, 'PZ'), apple(1, 3, 4, 'PZ'), apple(2, 4, 4, 'PZ')];
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(3);
  });

  it('expires after MAGNET_DURATION and publishes the end', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startMagnet(sim, ctx);
    run(sim, ctx, MAGNET_DURATION + 0.5);
    expect(sim.magnetT).toBe(0);
    expect(eventsOf(ctx, 'magnetState').map(e => e.args[0])).toEqual([MAGNET_DURATION, 0]);
  });

  it('reaches an orb around a face edge, not just across the grid', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // Walk to the PZ/PY edge tile (2,4,4), then park an orb on the PY side of the edge.
    stepUntilCommit(sim, ctx); // (2,3,4)
    const edgeRing = collectManifoldRing(2, 4, 4, 'PZ', SIZE, 2);
    const pyKey = [...edgeRing].find(k => k.endsWith(',PY'));
    expect(pyKey).toBeDefined();
    const [px, py, pz] = pyKey.split(',').map(Number);
    sim.powerups = [apple(px, py, pz, 'PY')];
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx); // (2,4,4) — the edge tile
    expect(sim.pos).toMatchObject({ x: 2, y: 4, z: 4, dirKey: 'PZ' });
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
  });
});
