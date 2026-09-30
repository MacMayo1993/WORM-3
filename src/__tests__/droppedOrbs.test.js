import { describe, it, expect } from 'vitest';
import { makeWormSim, resetWormSim, stepWormSim, applyRotationToSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';
import { makeCubies } from '../game/cubeState.js';
import { collectManifoldRing } from '../worm/wormLogic.js';
import { seededRandom } from '../worm/healerWorm/wormdFx.js';
import {
  DROPPED_ORB_LIFETIME, DROPPED_ORB_BLINK, DROPPED_ORB_DISSOLVE, DROP_FLIGHT, MAX_DROPS_PER_CUT, MAX_DROPPED_ORBS,
  groupLostOrbs, chooseDropTiles, scatterDroppedOrbs, ageDroppedOrbs, takeDroppedOrbsAt,
  dropFlightInto, dropVisible, dropDissolveProgress
} from '../worm/healerWorm/droppedOrbs.js';

const SIZE = 5;

function makeCtx(overrides = {}) {
  const events = [];
  const log = type => (...args) => { events.push({ type, args }); };
  const cubies = makeCubies(SIZE);
  return {
    events, cubies,
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
    onExplodeState: log('explodeState'),
    onExpansionAmount: log('expansion'),
    onRocketState: log('rocketState'),
    onMagnetState: log('magnetState'),
    onOrbShowerState: log('showerState'),
    onSpecialSpawned: log('specialSpawned'),
    onSpecialExpired: log('specialExpired'),
    onElementalTheme: log('elemental'),
    onViewPower: log('viewPower'),
    onStoryMechanic: log('storyMechanic'),
    ...overrides
  };
}

function makeSim() {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  sim.rand = seededRandom(11);
  return sim;
}

function stepUntilCommit(sim, ctx, maxSeconds = 10, dt = 0.05) {
  const from = tileKey(sim.pos);
  for (let i = 0; i < Math.round(maxSeconds / dt); i++) {
    stepWormSim(sim, dt, SIZE, ctx);
    if (tileKey(sim.pos) !== from) return sim.pos;
  }
  return null;
}

const eventsOf = (ctx, type) => ctx.events.filter(e => e.type === type);
const lost = n => ({
  faceIds: Array.from({ length: n }, (_, i) => (i % 6) + 1),
  colors: Array.from({ length: n }, (_, i) => `#0000${String(10 + i).padStart(2, '0')}`)
});

describe('grouping lost orbs', () => {
  it('gives each lost orb its own drop when there are few', () => {
    const groups = groupLostOrbs([1, 2, 3], ['#a', '#b', '#c'], MAX_DROPS_PER_CUT, [1, 3, 3]);
    expect(groups).toEqual([
      [{ faceId: 1, color: '#a', segments: 1 }], [{ faceId: 2, color: '#b', segments: 3 }], [{ faceId: 3, color: '#c', segments: 3 }]
    ]);
  });

  it('defaults to a whole orb when the removed segments are unknown', () => {
    expect(groupLostOrbs([1], ['#a'])).toEqual([[{ faceId: 1, color: '#a', segments: ORB_SEGMENT_GROWTH }]]);
  });

  it('packs a long loss into the cap without losing an orb, keeping runs together', () => {
    const { faceIds, colors } = lost(30);
    const groups = groupLostOrbs(faceIds, colors);
    expect(groups).toHaveLength(MAX_DROPS_PER_CUT);
    expect(groups.flat().map(o => o.color)).toEqual(colors);
  });

  it('drops nothing when nothing was carried', () => {
    expect(groupLostOrbs([], [])).toEqual([]);
  });
});

describe('choosing drop tiles', () => {
  const origin = { x: 2, y: 2, z: 4, dirKey: 'PZ' };

  it('fans out over the nearest rings first, never on the cut tile or a blocked one', () => {
    const blocked = new Set(['1,2,4,PZ']);
    const tiles = chooseDropTiles(origin, SIZE, 6, key => blocked.has(key), seededRandom(3));
    expect(tiles).toHaveLength(6);
    const keys = tiles.map(t => `${t.x},${t.y},${t.z},${t.dirKey}`);
    expect(new Set(keys).size).toBe(6);
    expect(keys).not.toContain('2,2,4,PZ');
    expect(keys).not.toContain('1,2,4,PZ');
    const nearest = collectManifoldRing(2, 2, 4, 'PZ', SIZE, 1);
    // The first ring has four tiles; one is blocked, so the other three come first.
    expect(keys.slice(0, 3).every(k => nearest.has(k))).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = chooseDropTiles(origin, SIZE, 8, () => false, seededRandom(9));
    const b = chooseDropTiles(origin, SIZE, 8, () => false, seededRandom(9));
    expect(a).toEqual(b);
  });

  it('returns what fits on a crowded board', () => {
    expect(chooseDropTiles(origin, SIZE, 8, () => true, seededRandom(1))).toEqual([]);
  });
});

describe('scattering a cut', () => {
  it('lands every lost orb near the cut, off the body, orbs and flipped tiles', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const origin = { ...sim.pos };
    sim.powerups = [{ x: origin.x + 1, y: origin.y, z: origin.z, dirKey: origin.dirKey, type: 'apple' }];
    const flipped = ctx.cubies[origin.x][origin.y - 1][origin.z].stickers[origin.dirKey];
    flipped.curr = flipped.orig === 1 ? 4 : 1;
    const placed = scatterDroppedOrbs(sim, SIZE, ctx, { origin, ...lost(5), at: [0, 0, 3] });
    expect(placed).toBe(5);
    const keys = sim.droppedOrbs.map(tileKey);
    expect(new Set(keys).size).toBe(5);
    expect(keys).not.toContain(tileKey(sim.pos));
    expect(keys).not.toContain(tileKey(sim.powerups[0]));
    expect(keys).not.toContain(`${origin.x},${origin.y - 1},${origin.z},${origin.dirKey}`);
    for (const drop of sim.droppedOrbs) {
      expect(drop.ttl).toBe(DROPPED_ORB_LIFETIME);
      expect(drop.from).toEqual([0, 0, 3]);
      expect(drop.payload).toHaveLength(1);
    }
    expect(eventsOf(ctx, 'feel').map(e => e.args[0])).toContain('orbScatter');
  });

  it('bursts each orb out of its own severed bead', () => {
    const sim = makeSim();
    const froms = [[1, 0, 3], [2, 0, 3]];
    scatterDroppedOrbs(sim, SIZE, makeCtx(), { origin: { ...sim.pos }, ...lost(2), froms, at: [9, 9, 9] });
    expect(sim.droppedOrbs.map(d => d.from)).toEqual(froms);
  });

  it('does nothing for a dead worm', () => {
    const sim = makeSim();
    sim.alive = false;
    expect(scatterDroppedOrbs(sim, SIZE, makeCtx(), { origin: { ...sim.pos }, ...lost(3) })).toBe(0);
  });

  it('crumbles the oldest when the board is over its cap', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const origin = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
    for (let i = 0; i < 3; i++) scatterDroppedOrbs(sim, SIZE, ctx, { origin, ...lost(MAX_DROPS_PER_CUT) });
    expect(sim.droppedOrbs.length).toBeLessThanOrEqual(MAX_DROPPED_ORBS);
    expect(sim.pendingDropDissolves.length).toBeGreaterThan(0);
  });
});

describe('dropped orb lifetime', () => {
  it('waits five seconds, then leaves to crumble', () => {
    const sim = makeSim();
    scatterDroppedOrbs(sim, SIZE, makeCtx(), { origin: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, ...lost(2) });
    ageDroppedOrbs(sim, DROPPED_ORB_LIFETIME - 0.01);
    expect(sim.droppedOrbs).toHaveLength(2);
    ageDroppedOrbs(sim, 0.02);
    expect(sim.droppedOrbs).toHaveLength(0);
    expect(sim.pendingDropDissolves).toHaveLength(2);
    expect(sim.pendingDropDissolves[0]).toMatchObject({ color: expect.any(String), dirKey: 'PZ' });
  });

  it('only ages while crawling: a paused sim keeps its drops', () => {
    const sim = makeSim();
    const ctx = makeCtx({ isPaused: () => true });
    scatterDroppedOrbs(sim, SIZE, ctx, { origin: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, ...lost(1) });
    sim.cutFocusT = 2; // the WORM'D beat freezes the sim
    for (let i = 0; i < 20; i++) stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.droppedOrbs[0].ttl).toBeGreaterThan(DROPPED_ORB_LIFETIME - 0.05);
  });

  it('is cleared by a new run', () => {
    const sim = makeSim();
    scatterDroppedOrbs(sim, SIZE, makeCtx(), { origin: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, ...lost(2) });
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.droppedOrbs).toEqual([]);
    expect(sim.pendingDropDissolves).toEqual([]);
  });
});

describe('taking dropped orbs back', () => {
  it('restores the body and exactly the lost colours, as a recovery', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // Find the tile the worm is about to step onto and put a two-orb drop there.
    const probe = makeSim();
    stepUntilCommit(probe, makeCtx());
    const next = { ...probe.pos };
    sim.droppedOrbs.push({ ...next, id: 'drop-test', ttl: 3, color: '#ff0000', from: null, delay: 0,
      payload: [{ faceId: 1, color: '#ff0000' }, { faceId: 4, color: '#ff8800' }] });
    const before = sim.tailLength;
    stepUntilCommit(sim, ctx);
    expect(sim.droppedOrbs).toHaveLength(0);
    expect(sim.tailLength).toBe(before + 2 * ORB_SEGMENT_GROWTH);
    expect(sim.orbPickupColors.slice(-2)).toEqual(['#ff0000', '#ff8800']);
    expect(sim.orbPickupFaceIds.slice(-2)).toEqual([1, 4]);
    const pickups = eventsOf(ctx, 'pickup');
    expect(pickups).toHaveLength(2);
    for (const p of pickups) expect(p.args[5]).toBe(true); // recovered
    expect(sim.pendingOrbAttractions.some(fx => fx.color === '#ff0000')).toBe(true);
  });

  it('gives back only the segments a mid-orb cut removed: 13 cut to 12 recovers to 13, not 15', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    const probe = makeSim();
    stepUntilCommit(probe, makeCtx());
    // The state after a cut through the middle of the only orb's trio: two of its
    // three segments are still on the body, the orb itself (its colour) is lost.
    sim.tailLength = BASE_TAIL_LENGTH + 2;
    const [payload] = groupLostOrbs([1], ['#ff0000'], MAX_DROPS_PER_CUT, [1]);
    sim.droppedOrbs.push({ ...probe.pos, id: 'drop-partial', ttl: 3, color: '#ff0000', from: null, delay: 0, payload });
    stepUntilCommit(sim, ctx);
    expect(sim.tailLength).toBe(BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH);
    expect(sim.orbPickupColors).toEqual(['#ff0000']);
    const [pickup] = eventsOf(ctx, 'pickup');
    expect(pickup.args[4]).toBe(1); // segments restored, which the store adds to the reserve
  });

  it('carries each lost orb\'s removed segments into its drop', () => {
    const sim = makeSim();
    scatterDroppedOrbs(sim, SIZE, makeCtx(), { origin: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, ...lost(3), segments: [2, 3, 3] });
    expect(sim.droppedOrbs.flatMap(d => d.payload.map(o => o.segments)).sort()).toEqual([2, 3, 3]);
  });

  it('lets the magnet pull them in from a distance', () => {
    const sim = makeSim();
    sim.droppedOrbs.push({ x: 2, y: 2, z: 4, dirKey: 'PZ', id: 'a' }, { x: 0, y: 0, z: 4, dirKey: 'PZ', id: 'b' });
    const reach = collectManifoldRing(2, 3, 4, 'PZ', SIZE, 2);
    const taken = takeDroppedOrbsAt(sim, '2,3,4,PZ', reach);
    expect(taken.map(d => d.id)).toEqual(['a']);
    expect(sim.droppedOrbs.map(d => d.id)).toEqual(['b']);
  });

  it('rides a slice turn with the tile it sits on', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.pos = { x: 0, y: 0, z: 4, dirKey: 'PZ' };
    sim.droppedOrbs.push({ x: 4, y: 2, z: 4, dirKey: 'PZ', id: 'ride', ttl: 3, payload: [] });
    applyRotationToSim(sim, SIZE, ctx, { axis: 'col', dir: 1, sliceIndex: 4 }, { inOpeningScramble: false, paused: false });
    const moved = sim.droppedOrbs[0];
    expect(moved.id).toBe('ride');
    expect(moved.ttl).toBe(3);
    expect(tileKey(moved)).not.toBe('4,2,4,PZ');
  });
});

describe('dropped orb motion', () => {
  const from = [0, 0, 3], to = [1, 0, 3.3], n = [0, 0, 1];

  it('arcs off the surface and lands on the tile', () => {
    const out = [0, 0, 0];
    expect(dropFlightInto(out, from, to, n, 0)).toBe(0);
    expect(out).toEqual(from);
    dropFlightInto(out, from, to, n, DROP_FLIGHT * 0.36);
    expect(out[2]).toBeGreaterThan(to[2] + 0.2);
    expect(dropFlightInto(out, from, to, n, DROP_FLIGHT)).toBe(1);
    expect(out).toEqual(to);
  });

  it('bounces once on landing', () => {
    const out = [0, 0, 0];
    dropFlightInto(out, from, to, n, DROP_FLIGHT * 0.86);
    expect(out[0]).toBe(to[0]);
    expect(out[2]).toBeGreaterThan(to[2]);
  });

  it('blinks only in its last moments, faster as time runs out, and never under reduced motion', () => {
    for (let t = 0; t < 2; t += 0.01) expect(dropVisible(DROPPED_ORB_BLINK + 0.1, t)).toBe(true);
    const flips = ttl => {
      let n = 0, prev = dropVisible(ttl, 0);
      for (let t = 0.001; t < 1; t += 0.001) {
        const v = dropVisible(ttl, t);
        if (v !== prev) n++;
        prev = v;
      }
      return n;
    };
    expect(flips(0.1)).toBeGreaterThan(flips(DROPPED_ORB_BLINK - 0.1));
    expect(flips(0.1)).toBeGreaterThan(0);
    for (let t = 0; t < 1; t += 0.01) expect(dropVisible(0.1, t, true)).toBe(true);
  });

  it('crumbles linearly over the dissolve', () => {
    expect(dropDissolveProgress(0)).toBe(0);
    expect(dropDissolveProgress(DROPPED_ORB_DISSOLVE / 2)).toBeCloseTo(0.5);
    expect(dropDissolveProgress(DROPPED_ORB_DISSOLVE * 2)).toBe(1);
  });
});

it('keeps the base body out of the drop: only carried orbs come back', () => {
  expect(BASE_TAIL_LENGTH).toBeGreaterThan(0);
  expect(groupLostOrbs([], ['#a']).flat()).toEqual([{ faceId: 0, color: '#a', segments: ORB_SEGMENT_GROWTH }]);
});
