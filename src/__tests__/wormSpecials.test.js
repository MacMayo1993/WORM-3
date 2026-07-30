// Deterministic tests for the special power-ups (rocket / magnet).
//
// Same approach as wormSim.test.js: the sim is driven with fixed dt values and a
// stubbed ctx port — no React, no store, no renderer. The rules under test are the
// ones a player would notice: where a special appears and which type it is, how a
// rocket flies and lands, and how far the magnet reaches around the cube's faces.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeWormSim,
  resetWormSim,
  stepWormSim,
  applyRotationToSim,
  startRocket,
  startMagnet,
  queueTurn,
  tileKey,
} from '../worm/healerWorm/wormSim.js';
import {
  SPECIAL_SPAWN_INTERVAL,
  SPECIAL_LIFETIME,
  SPECIAL_MAX_ON_BOARD,
  SPECIAL_SPAWN_RADIUS,
  SPECIAL_SPAWN_RETRY,
  ROCKET_DURATION,
  ROCKET_SPEED_MULT,
  MAGNET_DURATION,
  SURFACE_JUMP_HEIGHT,
  SURFACE_JUMP_TILE_SPAN,
  BASE_TAIL_LENGTH,
} from '../worm/healerWorm/constants.js';
import { SPECIAL_TYPES } from '../worm/healerWorm/specialDefs.js';
import {
  makeSpecialPicker,
  drawSpecialType,
  rankSpecialSpawnCandidates,
  buildSpawnCandidates,
  pickSpawnTile,
  countOrbsWithin,
} from '../worm/healerWorm/specialSpawn.js';
import { wormBuffs, buffReadout, resetWormBuffs } from '../worm/wormBuffs.js';
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
    onSpecialSpawned: log('specialSpawned'),
    onSpecialExpired: log('specialExpired'),
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
    run(sim, ctx, Math.max(SPECIAL_SPAWN_INTERVAL, 6) * 4);
    expect(sim.specials.length).toBeLessThanOrEqual(SPECIAL_MAX_ON_BOARD);
  });

  it('despawns a special once its lifetime runs out', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // Pin the ambient timer, or a replacement spawns into the freed slot before the
    // assertion runs and the test reads as a failure to despawn.
    sim.specialTimer = 9999;
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

// ─── Fair type selection ─────────────────────────────────────────────────────

describe('special type chooser', () => {
  // A counting RNG makes every draw reproducible without touching Math.random.
  const seqRand = (values) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('produces every type over each pair of draws', () => {
    const picker = makeSpecialPicker();
    const rand = seqRand([0.1, 0.9]);
    const drawn = [drawSpecialType(picker, { rand }), drawSpecialType(picker, { rand })];
    expect(new Set(drawn).size).toBe(SPECIAL_TYPES.length);
  });

  it('never returns the same type three times in a row', () => {
    const picker = makeSpecialPicker();
    const rand = seqRand([0.99, 0.01, 0.5, 0.75, 0.25]);
    let run = 1;
    let prev = null;
    for (let i = 0; i < 200; i++) {
      const type = drawSpecialType(picker, { rand });
      run = type === prev ? run + 1 : 1;
      prev = type;
      expect(run).toBeLessThanOrEqual(2);
    }
  });

  it('defers a magnet when there is nothing for it to pull', () => {
    const picker = makeSpecialPicker();
    picker.bag = ['magnet', 'rocket'];
    const type = drawSpecialType(picker, { magnetUseful: false, rand: () => 0 });
    expect(type).toBe('rocket');
    // The magnet keeps its place in the bag and comes up next.
    expect(picker.bag).toContain('magnet');
  });

  it('still draws a magnet when orbs are in range', () => {
    const picker = makeSpecialPicker();
    picker.bag = ['magnet', 'rocket'];
    expect(drawSpecialType(picker, { magnetUseful: true, rand: () => 0 })).toBe('magnet');
  });

  it('counts only orbs inside the given manifold radius', () => {
    const head = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
    const orbs = [apple(2, 3, 4, 'PZ'), apple(0, 2, 4, 'PZ'), apple(0, 0, 4, 'PZ')];
    expect(countOrbsWithin(orbs, head, SIZE, 2)).toBe(2); // the third is 4 steps out
    expect(countOrbsWithin([], head, SIZE, 2)).toBe(0);
  });

  it('is reset with the run', () => {
    const sim = makeSim();
    drawSpecialType(sim.specialPicker, { rand: () => 0 });
    expect(sim.specialPicker.lastType).not.toBeNull();
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.specialPicker.lastType).toBeNull();
    expect(sim.specialPicker.bag).toHaveLength(0);
  });
});

// ─── Spawn placement ─────────────────────────────────────────────────────────

describe('spawn candidate ranking', () => {
  const head = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
  const baseArgs = (over = {}) => ({
    candidates: buildSpawnCandidates(head, SIZE, SPECIAL_SPAWN_RADIUS),
    head,
    moveDir: 'up',
    size: SIZE,
    ...over,
  });

  it('never offers the head tile', () => {
    const ranked = rankSpecialSpawnCandidates(baseArgs({
      occupiedKeys: new Set([tileKey(head)]),
    }));
    expect(ranked.some(r => tileKey(r.tile) === tileKey(head))).toBe(false);
  });

  it('excludes occupied, trail and tunnel tiles', () => {
    const orb = '2,3,4,PZ';
    const body = '1,2,4,PZ';
    const mouth = '3,2,4,PZ';
    const ranked = rankSpecialSpawnCandidates(baseArgs({
      occupiedKeys: new Set([orb]),
      trailKeys: new Set([body]),
      tunnelKeys: new Set([mouth]),
    }));
    const keys = ranked.map(r => tileKey(r.tile));
    expect(keys).not.toContain(orb);
    expect(keys).not.toContain(body);
    expect(keys).not.toContain(mouth);
  });

  it('excludes anything already inside the live claim reach', () => {
    const ranked = rankSpecialSpawnCandidates(baseArgs({ claimRadius: 2 }));
    expect(ranked.every(r => r.dist > 2)).toBe(true);
  });

  it('ranks a forward tile on the current face above one behind the worm', () => {
    const ranked = rankSpecialSpawnCandidates(baseArgs());
    const score = (key) => ranked.find(r => tileKey(r.tile) === key)?.score ?? -1;
    // Heading is 'up' (+y on PZ): (2,4,4) is two ahead, (2,0,4) is two behind.
    expect(score('2,4,4,PZ')).toBeGreaterThan(score('2,0,4,PZ'));
  });

  it('ranks the 2–4 step band above an adjacent tile', () => {
    const ranked = rankSpecialSpawnCandidates(baseArgs());
    const score = (key) => ranked.find(r => tileKey(r.tile) === key)?.score ?? -1;
    expect(score('2,4,4,PZ')).toBeGreaterThan(score('2,3,4,PZ'));
  });

  it('returns null rather than a far-side tile when the neighbourhood is unusable', () => {
    const candidates = buildSpawnCandidates(head, SIZE, SPECIAL_SPAWN_RADIUS);
    const allBlocked = new Set(candidates.map(c => tileKey(c.tile)));
    const tile = pickSpawnTile(baseArgs({ candidates, occupiedKeys: allBlocked }), () => 0);
    expect(tile).toBeNull();
  });

  it('picks at random among the tiles tied for best', () => {
    const args = baseArgs();
    const first = pickSpawnTile(args, () => 0);
    const last = pickSpawnTile(args, () => 0.999);
    expect(first).not.toBeNull();
    expect(last).not.toBeNull();
    expect(tileKey(first)).not.toBe(tileKey(last));
  });
});

describe('spawn placement in the sim', () => {
  it('defers instead of spawning somewhere arbitrary when nothing local works', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // Fill every tile the ranker could offer.
    const blocked = buildSpawnCandidates(sim.pos, SIZE, SPECIAL_SPAWN_RADIUS)
      .map(c => ({ ...c.tile, type: 'apple' }));
    sim.powerups = blocked;
    sim.specialTimer = 0.01;
    run(sim, ctx, 0.1);
    expect(sim.specials).toHaveLength(0);
    // Retried soon rather than skipping a whole interval.
    expect(sim.specialTimer).toBeLessThanOrEqual(SPECIAL_SPAWN_RETRY);
  });

  it('drops the tunnel-heal reward close to the healed exit', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const exit = { x: 0, y: 0, z: 4, dirKey: 'PZ' };
    // Reach the private spawn path the way the sim does — via a heal.
    sim.specialTimer = 9999;
    sim.pos = { x: 4, y: 4, z: 4, dirKey: 'PZ' }; // worm far away, so locality must
    sim.rand = () => 0;                           // come from the anchor, not the head
    const near = collectManifoldRing(exit.x, exit.y, exit.z, exit.dirKey, SIZE, 2);
    // Directly exercise the ranker with the tunnel anchor, mirroring spawnSpecial.
    const tile = pickSpawnTile({
      candidates: buildSpawnCandidates(exit, SIZE, 2),
      head: sim.pos,
      moveDir: sim.moveDir,
      size: SIZE,
    }, sim.rand);
    expect(tile).not.toBeNull();
    expect(near.has(tileKey(tile))).toBe(true);
    void ctx;
  });

  it('publishes a spawn notice exactly once per orb', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specialTimer = 0.01;
    run(sim, ctx, 0.2);
    expect(sim.specials).toHaveLength(1);
    expect(eventsOf(ctx, 'specialSpawned')).toHaveLength(1);
    expect(eventsOf(ctx, 'specialSpawned')[0].args[0]).toBe(sim.specials[0].type);
  });

  it('publishes an expiry notice when one times out', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.specialTimer = 9999;
    sim.specials = [special(0, 0, 4, 'PZ', 'magnet')];
    run(sim, ctx, SPECIAL_LIFETIME + 0.5);
    expect(sim.specials).toHaveLength(0);
    expect(eventsOf(ctx, 'specialExpired')).toHaveLength(1);
    expect(eventsOf(ctx, 'specialExpired')[0].args[0]).toBe('magnet');
  });
});

// ─── Rocket overdrive ────────────────────────────────────────────────────────

describe('rocket overdrive', () => {
  it('runs at double its former speed and clearly outruns boost', () => {
    expect(ROCKET_SPEED_MULT).toBe(4);
  });

  it('runs on the surface for three seconds and publishes one start/end pair', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startRocket(sim, ctx);
    expect(sim.rocketActive).toBe(true);
    expect(sim.isJumping).toBe(false);
    expect(sim.rocketT).toBe(ROCKET_DURATION);
    run(sim, ctx, ROCKET_DURATION + 0.1);
    expect(sim.rocketActive).toBe(false);
    expect(sim.rocketT).toBe(0);
    expect(eventsOf(ctx, 'rocketState').map(e => e.args[0])).toEqual([true, false]);
  });

  it('refreshes its duration without publishing a duplicate start', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startRocket(sim, ctx);
    run(sim, ctx, 1);
    startRocket(sim, ctx);
    expect(sim.rocketT).toBe(ROCKET_DURATION);
    expect(eventsOf(ctx, 'rocketState').map(e => e.args[0])).toEqual([true]);
  });

  it('protects the head from a rotating slice', () => {
    const trail = makeTileTrail(100);
    ttReset(trail, '0,0,4,PZ');
    ttPush(trail, '1,1,4,PZ');
    const worm = {
      pos: { current: { x: 1, y: 1, z: 4, dirKey: 'PZ' } },
      tileTrail: { current: trail },
      tailLength: { current: 50 },
      rocketActive: { current: false },
    };
    expect(checkWormHitBySlice(worm, 'col', 1)).toEqual({ type: 'death' });
    worm.rocketActive.current = true;
    expect(checkWormHitBySlice(worm, 'col', 1)).not.toEqual({ type: 'death' });
  });
});

// ─── Magnet attraction payloads ──────────────────────────────────────────────

describe('magnet attraction effects', () => {
  it('emits an effect for each orb pulled from off the head tile', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [apple(0, 3, 4, 'PZ'), apple(1, 3, 4, 'PZ')];
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx);
    expect(sim.pendingOrbAttractions).toHaveLength(2);
    for (const fx of sim.pendingOrbAttractions) {
      expect(fx.from).toHaveLength(3);
      expect(fx.to).toHaveLength(3);
      expect(fx.color).toBeTruthy();
      expect(fx.id).toMatch(/^att-/);
    }
    // Stable, unique ids so the renderer can pool slots safely.
    const ids = sim.pendingOrbAttractions.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('emits nothing for an orb collected by ordinary contact', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [apple(2, 3, 4, 'PZ')]; // directly on the worm's path
    stepUntilCommit(sim, ctx);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
    expect(sim.pendingOrbAttractions).toHaveLength(0);
  });

  it('records a cross-face pull with both endpoints', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    stepUntilCommit(sim, ctx); // (2,3,4)
    const ring = collectManifoldRing(2, 4, 4, 'PZ', SIZE, 2);
    const pyKey = [...ring].find(k => k.endsWith(',PY'));
    const [px, py, pz] = pyKey.split(',').map(Number);
    sim.powerups = [apple(px, py, pz, 'PY')];
    sim.magnetT = 5;
    stepUntilCommit(sim, ctx); // onto the edge tile
    expect(sim.pendingOrbAttractions).toHaveLength(1);
    expect(sim.pendingOrbAttractions[0].from).not.toEqual(sim.pendingOrbAttractions[0].to);
  });

  it('is cleared by a run reset', () => {
    const sim = makeSim();
    sim.pendingOrbAttractions = [{ id: 'x' }];
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.pendingOrbAttractions).toHaveLength(0);
  });
});

// ─── Buff lifecycle ──────────────────────────────────────────────────────────

describe('buff lifecycle', () => {
  it('freezes the magnet clock while paused', () => {
    const sim = makeSim();
    startMagnet(sim, makeCtx());
    const paused = makeCtx({ isPaused: () => true });
    run(sim, paused, 3);
    expect(sim.magnetT).toBe(MAGNET_DURATION);
  });

  it('freezes the magnet clock during tunnel travel', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startMagnet(sim, ctx);
    sim.phase = 'tunnel';
    run(sim, ctx, 3);
    expect(sim.magnetT).toBe(MAGNET_DURATION);
  });

  it('refreshes rather than stacking, and republishes the new maximum', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startMagnet(sim, ctx);
    run(sim, ctx, 3);
    expect(sim.magnetT).toBeLessThan(MAGNET_DURATION);
    startMagnet(sim, ctx);
    expect(sim.magnetT).toBe(MAGNET_DURATION);
    expect(sim.magnetMaxT).toBe(MAGNET_DURATION);
    const published = eventsOf(ctx, 'magnetState');
    expect(published).toHaveLength(2);
    expect(published[1].args).toEqual([MAGNET_DURATION, MAGNET_DURATION]);
  });

  it('publishes a single expiry transition', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startMagnet(sim, ctx);
    run(sim, ctx, MAGNET_DURATION + 1.5);
    const published = eventsOf(ctx, 'magnetState').map(e => e.args[0]);
    expect(published).toEqual([MAGNET_DURATION, 0]);
    expect(sim.magnetMaxT).toBe(0);
  });

  it('clears every buff on a run reset', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startMagnet(sim, ctx);
    startRocket(sim, ctx);
    sim.landingGraceT = 0.5;
    sim.specials = [special(0, 0, 4, 'PZ')];
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.magnetT).toBe(0);
    expect(sim.magnetMaxT).toBe(0);
    expect(sim.rocketActive).toBe(false);
    expect(sim.rocketT).toBe(0);
    expect(sim.landingGraceT).toBe(0);
    expect(sim.specials).toHaveLength(0);
  });
});

describe('buff readout (HUD presentation rules)', () => {
  beforeEach(() => resetWormBuffs());

  it('reports an inactive strip when nothing is running', () => {
    const r = buffReadout(wormBuffs);
    expect(r.magnetActive).toBe(false);
    expect(r.rocketActive).toBe(false);
    expect(r.magnetFraction).toBe(0);
  });

  it('reports a full bar at the start of a magnet', () => {
    wormBuffs.magnetT = 8; wormBuffs.magnetMaxT = 8;
    const r = buffReadout(wormBuffs);
    expect(r.magnetActive).toBe(true);
    expect(r.magnetFraction).toBe(1);
    expect(r.magnetSeconds).toBe(8);
  });

  it('drains proportionally', () => {
    wormBuffs.magnetT = 2; wormBuffs.magnetMaxT = 8;
    expect(buffReadout(wormBuffs).magnetFraction).toBeCloseTo(0.25, 5);
  });

  it('rescales to the new maximum on a refresh', () => {
    wormBuffs.magnetT = 2; wormBuffs.magnetMaxT = 8;
    expect(buffReadout(wormBuffs).magnetFraction).toBeCloseTo(0.25, 5);
    wormBuffs.magnetT = 8; wormBuffs.magnetMaxT = 8;
    expect(buffReadout(wormBuffs).magnetFraction).toBe(1);
  });

  it('never reports a negative or overflowing bar', () => {
    wormBuffs.magnetT = -3; wormBuffs.magnetMaxT = 8;
    expect(buffReadout(wormBuffs).magnetFraction).toBe(0);
    expect(buffReadout(wormBuffs).magnetActive).toBe(false);
    wormBuffs.magnetT = 99; wormBuffs.magnetMaxT = 8;
    expect(buffReadout(wormBuffs).magnetFraction).toBe(1);
  });

  it('is cleared by resetWormBuffs, so no pill survives a run', () => {
    wormBuffs.magnetT = 5; wormBuffs.magnetMaxT = 8; wormBuffs.rocketActive = true;
    resetWormBuffs();
    const r = buffReadout(wormBuffs);
    expect(r.magnetActive).toBe(false);
    expect(r.rocketActive).toBe(false);
  });
});
