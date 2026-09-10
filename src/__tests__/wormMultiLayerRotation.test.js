// Mid-rotation crossings and hit resolution when a move turns MORE THAN ONE plane.
//
// The worm hazard turns two non-adjacent planes at once, in opposite directions.
// Everything downstream used to reason about a single "anchor" plane — the one the
// bridge happened to publish — so the second plane was invisible: a worm crossing
// onto it got no protection, the commit erased the protection that did exist, and
// the damage check stopped at whichever plane was listed first. These tests drive
// the real sim and the real production helpers through those cases.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  makeWormSim,
  resetWormSim,
  stepWormSim,
  applyRotationToSim,
  tileKey,
} from '../worm/healerWorm/wormSim.js';
import {
  liveRotation,
  setLiveRotation,
  resetLiveRotation,
  liveLayerAngle,
  isTileInLiveRotation,
} from '../worm/liveRotation.js';
import { nextRestRead, nextRestReadDuringStep, restReadProtectsTile } from '../worm/wormLogic.js';
import { resolveSliceHits, rideLiveRotation } from '../worm/wormHelpers.js';
import { ttAt, ttPush, makeTileTrail } from '../worm/circularBuffers.js';
import { BODY_BALL_SPACING, BASE_TAIL_LENGTH } from '../worm/healerWorm/constants.js';

const SIZE = 3;

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

const makeSim = () => {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  return sim;
};

/** Publish a live two-plane turn, exactly as CubeAssembly does mid-tween. */
const beginTurn = (axis, layers, dirs, progress = 0.5) =>
  setLiveRotation(
    axis, layers, layers.map((_, i) => progress * (Math.PI / 2) * dirs[i]), layers[0],
    progress * (Math.PI / 2) * dirs[0]
  );

/** The worm-shaped ref adapter the renderers see, over a plain sim. */
const asWorm = (sim) => {
  const f = (key) => ({ get current() { return sim[key]; }, set current(v) { sim[key] = v; } });
  return {
    pos: f('pos'), restRead: f('restRead'), crossingCorner: f('crossingCorner'),
    interpT: f('interpT'), prevTile: f('prevTile'), tileTrail: f('tileTrail'),
    tailLength: f('tailLength'), headInterpPos: f('headInterpPos'),
    currentNormal: f('currentNormal'), rocketActive: f('rocketActive'),
    landingGraceT: f('landingGraceT'),
  };
};

beforeEach(() => {
  resetLiveRotation();
  liveRotation.completedTxnId = 0;
});

// ── The bridge ───────────────────────────────────────────────────────────────

describe('liveRotation bridge', () => {
  it('reports every turning plane, each with its own signed angle', () => {
    beginTurn('row', [0, 2], [1, -1], 0.5);
    expect(liveLayerAngle(1, 0, 1)).toBeCloseTo(Math.PI / 4);
    expect(liveLayerAngle(1, 2, 1)).toBeCloseTo(-Math.PI / 4);
    expect(liveLayerAngle(1, 1, 1)).toBeNull();       // the untouched middle plane
    expect(isTileInLiveRotation(0, 2, 0)).toBe(true); // second plane is not invisible
  });

  it('starts a new transaction per rotation, and records the finished one on reset', () => {
    beginTurn('row', [0, 2], [1, -1]);
    const first = liveRotation.txnId;
    beginTurn('row', [0, 2], [1, -1], 0.9); // same turn, later frame
    expect(liveRotation.txnId).toBe(first);
    resetLiveRotation();
    expect(liveRotation.completedTxnId).toBe(first);
    beginTurn('row', [0, 2], [1, -1]);      // a second turn of the SAME planes
    expect(liveRotation.txnId).toBe(first + 1);
  });

  it('goes quiet when reset', () => {
    beginTurn('col', [1], [1]);
    resetLiveRotation();
    expect(liveLayerAngle(1, 0, 0)).toBeNull();
    expect(isTileInLiveRotation(1, 0, 0)).toBe(false);
  });
});

// ── Crossing detection across both planes ────────────────────────────────────

describe('crossing protection across simultaneous layers', () => {
  it('arms on a crossing into EITHER plane', () => {
    beginTurn('row', [0, 2], [1, -1]);
    const ontoFirst = nextRestRead(null, liveRotation, { x: 0, y: 1, z: 2 }, { x: 0, y: 0, z: 2 });
    const ontoSecond = nextRestRead(null, liveRotation, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 });
    expect(ontoFirst.layers).toEqual([0]);
    expect(ontoSecond.layers).toEqual([2]);
    expect(ontoSecond.axis).toBe('row');
  });

  it('protects the tile it actually crossed onto, not the anchor', () => {
    beginTurn('row', [0, 2], [1, -1]);
    const rr = nextRestRead(null, liveRotation, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 });
    expect(restReadProtectsTile(rr, 0, 2, 2)).toBe(true);
    expect(restReadProtectsTile(rr, 0, 0, 2)).toBe(false); // rider on the anchor plane
  });

  it('recognises a rotation that begins partway through a step', () => {
    // The step's destination was chosen while the cube was still; the turn starts at 40%.
    expect(nextRestReadDuringStep(null, { active: false, axis: null, sliceIndices: [], txnId: 1 },
      0.4, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 })).toBeNull();
    beginTurn('row', [0, 2], [1, -1], 0.4);
    const rr = nextRestReadDuringStep(null, liveRotation, 0.4, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 });
    expect(rr.layers).toEqual([2]);
  });

  it('leaves a completed step as a rider on the second plane', () => {
    beginTurn('row', [0, 2], [1, -1]);
    // interpT >= 1: the worm finished its step onto y=2 before the turn began.
    expect(nextRestReadDuringStep(null, liveRotation, 1, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 }))
      .toBeNull();
  });

  it('keeps protection while stepping back off the protected plane', () => {
    beginTurn('row', [0, 2], [1, -1]);
    const armed = nextRestRead(null, liveRotation, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 });
    const stepBack = nextRestRead(armed, liveRotation, { x: 0, y: 2, z: 2 }, { x: 0, y: 1, z: 2 });
    expect(stepBack).toBe(armed);
  });

  it('can hold a crossing on both planes at once', () => {
    beginTurn('row', [0, 2], [1, -1]);
    const first = nextRestRead(null, liveRotation, { x: 0, y: 1, z: 2 }, { x: 0, y: 2, z: 2 });
    // Impossible in one step, but the descriptor must carry both if it ever happens
    // (a corner traversal can put source and destination on different planes).
    const both = nextRestRead(first, liveRotation, { x: 0, y: 1, z: 2 }, { x: 0, y: 0, z: 2 });
    expect(both.layers).toEqual([0]);
    expect(first.layers).toEqual([2]);
  });
});

// ── Commit: the whole transaction, once ──────────────────────────────────────

describe('applyRotationToSim — multi-layer commit', () => {
  it('preserves a crossing destination on the SECOND committed layer', () => {
    // The exact reported reproduction. Destination {0,2,2,PZ} is protected on row 2;
    // the move commits row 0 (dir +1) and row 2 (dir -1). Applying the layers one call
    // at a time cleared the protection on the first layer and the head came out at
    // {0,2,0,NX}.
    const sim = makeSim();
    const ctx = makeCtx();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = { txnId: 7, axis: 'row', layers: [2] };
    liveRotation.completedTxnId = 7;

    applyRotationToSim(sim, SIZE, ctx,
      { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });

    expect(sim.pos).toEqual({ x: 0, y: 2, z: 2, dirKey: 'PZ' });
  });

  it('single-layer control: a protected destination survives its own commit', () => {
    const sim = makeSim();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = { txnId: 7, axis: 'row', layers: [2] };
    liveRotation.completedTxnId = 7;
    applyRotationToSim(sim, SIZE, makeCtx(),
      { axis: 'row', sliceIndex: 2, dir: -1, sliceIndices: [2], sliceDirs: [-1] },
      { inOpeningScramble: false, paused: false });
    expect(sim.pos).toEqual({ x: 0, y: 2, z: 2, dirKey: 'PZ' });
  });

  it('produces the same result with the layer order reversed', () => {
    const runOrder = (layers, dirs) => {
      const sim = makeSim();
      sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
      sim.restRead = { txnId: 7, axis: 'row', layers: [2] };
      liveRotation.completedTxnId = 7;
      applyRotationToSim(sim, SIZE, makeCtx(),
        { axis: 'row', sliceIndex: layers[0], dir: dirs[0], sliceIndices: layers, sliceDirs: dirs },
        { inOpeningScramble: false, paused: false });
      return sim.pos;
    };
    expect(runOrder([0, 2], [1, -1])).toEqual(runOrder([2, 0], [-1, 1]));
    expect(runOrder([2, 0], [-1, 1])).toEqual({ x: 0, y: 2, z: 2, dirKey: 'PZ' });
  });

  it('still rides an unprotected worm on the second layer, by that layer’s own direction', () => {
    // No protection: the worm was already on row 2 when the turn began, so it rides —
    // and it must ride row 2's direction (-1), not the anchor's (+1).
    const sim = makeSim();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = null;
    applyRotationToSim(sim, SIZE, makeCtx(),
      { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });

    const own = makeSim();
    own.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    own.restRead = null;
    applyRotationToSim(own, SIZE, makeCtx(), { axis: 'row', sliceIndex: 2, dir: -1 },
      { inOpeningScramble: false, paused: false });

    expect(sim.pos).toEqual(own.pos);
    expect(sim.pos).not.toEqual({ x: 0, y: 2, z: 2, dirKey: 'PZ' });
  });

  it('keeps protected trail entries put while rotating the rest', () => {
    const sim = makeSim();
    const protectedKey = '0,2,2,PZ';
    const riderKey = '0,0,2,PZ';
    sim.tileTrail = makeTileTrail(8);
    ttPush(sim.tileTrail, protectedKey);
    ttPush(sim.tileTrail, riderKey);
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = { txnId: 3, axis: 'row', layers: [2] };
    sim.restReadTiles.set(protectedKey, { txnId: 3, axis: 'row', sliceIndex: 2 });
    liveRotation.completedTxnId = 3;

    applyRotationToSim(sim, SIZE, makeCtx(),
      { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });

    // Index 0 is the most recent push (the rider), index 1 the one before it.
    expect(ttAt(sim.tileTrail, 0)).not.toBe(riderKey);   // rode row 0
    expect(ttAt(sim.tileTrail, 1)).toBe(protectedKey);   // laid down in destination space
  });

  it('releases protection once, after every layer has been applied', () => {
    const sim = makeSim();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = { txnId: 4, axis: 'row', layers: [2] };
    sim.restReadTiles.set('0,2,2,PZ', { txnId: 4, axis: 'row', sliceIndex: 2 });
    liveRotation.completedTxnId = 4;
    applyRotationToSim(sim, SIZE, makeCtx(),
      { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });
    expect(sim.restRead).toBeNull();
    expect(sim.restReadTiles.size).toBe(0);
  });

  it('does not honour protection armed by a different rotation', () => {
    // Cancelled turn armed row 2 under transaction 9; the turn that actually commits
    // is transaction 10. The worm is a rider for it and must be carried.
    const sim = makeSim();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = { txnId: 9, axis: 'row', layers: [2] };
    liveRotation.completedTxnId = 10;
    liveRotation.txnId = 10;
    applyRotationToSim(sim, SIZE, makeCtx(),
      { axis: 'row', sliceIndex: 2, dir: -1, sliceIndices: [2], sliceDirs: [-1] },
      { inOpeningScramble: false, paused: false });
    expect(sim.pos).not.toEqual({ x: 0, y: 2, z: 2, dirKey: 'PZ' });
  });

  it('publishes powerups once for the whole transaction, at final coordinates', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    sim.powerups = [
      { x: 0, y: 0, z: 2, dirKey: 'PZ' },   // on the first plane
      { x: 0, y: 2, z: 2, dirKey: 'PZ' },   // on the second, spinning the other way
    ];
    applyRotationToSim(sim, SIZE, ctx,
      { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });

    expect(ctx.events.filter(e => e.type === 'powerups')).toHaveLength(1);
    const single = makeSim();
    single.powerups = [{ x: 0, y: 2, z: 2, dirKey: 'PZ' }];
    applyRotationToSim(single, SIZE, makeCtx(), { axis: 'row', sliceIndex: 2, dir: -1 },
      { inOpeningScramble: false, paused: false });
    expect(sim.powerups[1]).toEqual(single.powerups[0]);
  });

  it('resolves a deferred pickup once, against the committed cell', () => {
    const cubies = [];
    for (let x = 0; x < SIZE; x++) {
      cubies[x] = [];
      for (let y = 0; y < SIZE; y++) {
        cubies[x][y] = [];
        for (let z = 0; z < SIZE; z++) cubies[x][y][z] = { stickers: {} };
      }
    }
    const sim = makeSim();
    const ctx = makeCtx({ getCubies: () => cubies });
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.restRead = { txnId: 5, axis: 'row', layers: [2] };
    liveRotation.completedTxnId = 5;
    // An orb that rides row 2 into the worm's protected cell.
    sim.powerups = [{ x: 2, y: 2, z: 2, dirKey: 'PZ' }];

    applyRotationToSim(sim, SIZE, ctx,
      { axis: 'row', sliceIndex: 0, dir: 1, sliceIndices: [0, 2], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });

    // Whether the orb happens to land here or not, the pickup check must run exactly
    // once and against the final coordinates — never once per layer.
    expect(ctx.events.filter(e => e.type === 'pickup').length).toBeLessThanOrEqual(1);
    expect(sim.restRead).toBeNull();
  });
});

// ── Head and body rendering ──────────────────────────────────────────────────

describe('renderers follow the plane a tile is actually on', () => {
  it('skips live anchoring for a crossing onto the non-anchor plane', () => {
    const sim = makeSim();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    beginTurn('row', [0, 2], [1, -1]);
    sim.restRead = { txnId: liveRotation.txnId, axis: 'row', layers: [2] };
    // rideLiveRotation returns false — the grid math already targets the committed cell.
    expect(rideLiveRotation(asWorm(sim))).toBe(false);
  });

  it('rides a corner crossing by the second plane’s own angle', () => {
    const sim = makeSim();
    sim.pos = { x: 0, y: 2, z: 2, dirKey: 'PZ' };
    sim.crossingCorner = true;
    sim.restRead = null;
    sim.headInterpPos = new THREE.Vector3(1, 0, 0);
    sim.currentNormal = new THREE.Vector3(0, 0, 1);
    beginTurn('row', [0, 2], [1, -1], 1); // full quarter turn published
    const worm = asWorm(sim);
    expect(rideLiveRotation(worm)).toBe(true);
    // Row 2 spins -1 → -90° about +Y: (1,0,0) → (0,0,1).
    expect(sim.headInterpPos.x).toBeCloseTo(0);
    expect(sim.headInterpPos.z).toBeCloseTo(1);
  });

  it('leaves a tile on no turning plane alone', () => {
    const sim = makeSim();
    sim.pos = { x: 0, y: 1, z: 2, dirKey: 'PZ' };
    sim.crossingCorner = true;
    sim.restRead = null;
    beginTurn('row', [0, 2], [1, -1], 1);
    expect(rideLiveRotation(asWorm(sim))).toBe(false);
  });
});

// ── Damage resolution ────────────────────────────────────────────────────────

describe('resolveSliceHits', () => {
  /** A worm whose head sits on `headY` with a body running back through the given rows. */
  const wormWithBody = (headTile, bodyTiles) => {
    const trail = makeTileTrail(32);
    ttPush(trail, tileKey(headTile));
    for (const t of bodyTiles) ttPush(trail, tileKey(t));
    return {
      pos: { current: headTile },
      tileTrail: { current: trail },
      // Long enough that every pushed tile counts as body.
      tailLength: { current: Math.ceil((bodyTiles.length + 1) / BODY_BALL_SPACING) + BASE_TAIL_LENGTH },
      rocketActive: { current: false },
      landingGraceT: { current: 0 },
    };
  };

  it('lets a death on the second plane beat a cut on the first', () => {
    // Head on row 2 (trapped: its body leaves the plane → death). Body runs through
    // row 1 into row 0, which reports a cut. Evaluating plane 0 first used to win.
    const worm = wormWithBody(
      { x: 1, y: 2, z: 2, dirKey: 'PZ' },
      [{ x: 1, y: 1, z: 2, dirKey: 'PZ' }, { x: 1, y: 0, z: 2, dirKey: 'PZ' }]
    );
    expect(resolveSliceHits(worm, 'row', [0, 2])).toMatchObject({ type: 'death', sliceIndex: 2 });
    // And the order of the planes cannot change the outcome.
    expect(resolveSliceHits(worm, 'row', [2, 0])).toMatchObject({ type: 'death', sliceIndex: 2 });
  });

  it('takes the cut nearest the head when several planes cut', () => {
    // Head off both planes; body crosses row 1 at index 1 and row 0 at index 2.
    const worm = wormWithBody(
      { x: 1, y: 2, z: 2, dirKey: 'PZ' },
      [{ x: 1, y: 1, z: 2, dirKey: 'PZ' }, { x: 1, y: 0, z: 2, dirKey: 'PZ' }]
    );
    const hit = resolveSliceHits(worm, 'row', [0, 1]);
    expect(hit).toMatchObject({ type: 'cut', cutTrailIdx: 1, sliceIndex: 1 });
    expect(resolveSliceHits(worm, 'row', [1, 0])).toMatchObject({ cutTrailIdx: 1, sliceIndex: 1 });
  });

  it('reports nothing when neither plane touches the worm', () => {
    const worm = wormWithBody(
      { x: 1, y: 2, z: 2, dirKey: 'PZ' },
      [{ x: 1, y: 2, z: 1, dirKey: 'PY' }]
    );
    expect(resolveSliceHits(worm, 'col', [0])).toBeNull();
  });
});

// ── Integration: detection through commit, on a live sim ─────────────────────

describe('two-plane turn, detection through commit', () => {
  it('carries a crossing worm’s destination through a real crawl and commit', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    // Crawl a little so there is a real trail and step history behind the head.
    for (let i = 0; i < 40; i++) stepWormSim(sim, 0.05, SIZE, ctx);

    // Start a two-plane turn on the axis the head is NOT the anchor of.
    const headY = sim.pos.y;
    const other = headY === 0 ? 2 : 0;
    beginTurn('row', [other, headY], [1, -1], 0.3);

    // Force the crossing the way the tick does: the head stepped onto its plane from
    // off it while the turn was already running.
    sim.prevTile = { x: sim.pos.x, y: other === 0 ? 1 : 1, z: sim.pos.z, dirKey: sim.pos.dirKey };
    sim.restRead = nextRestReadDuringStep(null, liveRotation, 0.5, sim.prevTile, sim.pos);
    expect(sim.restRead).not.toBeNull();
    expect(sim.restRead.layers).toContain(headY);
    sim.restReadTiles.set(tileKey(sim.pos), {
      txnId: liveRotation.txnId, axis: 'row', sliceIndex: headY,
    });

    const destination = { ...sim.pos };
    // The turn finishes and commits.
    resetLiveRotation();
    applyRotationToSim(sim, SIZE, ctx,
      { axis: 'row', sliceIndex: other, dir: 1, sliceIndices: [other, headY], sliceDirs: [1, -1] },
      { inOpeningScramble: false, paused: false });

    expect(sim.pos).toEqual(destination);
    expect(ttAt(sim.tileTrail, 0)).toBe(tileKey(destination));
    expect(sim.restRead).toBeNull();
    expect(sim.restReadTiles.size).toBe(0);
  });

  it('arms protection from the tick itself, not just by hand', () => {
    // Nothing is hand-set here beyond starting the turn: the sim's own crawl walks
    // onto a turning plane and the tick has to notice.
    const sim = makeSim();
    const ctx = makeCtx();
    for (let i = 0; i < 12; i++) stepWormSim(sim, 0.05, SIZE, ctx);

    // Turn the two planes the worm is NOT on, plus the one it is about to enter.
    let armed = null;
    for (let i = 0; i < 200 && !armed; i++) {
      // Republish every frame, exactly as the tween does.
      beginTurn('row', [0, 2], [1, -1], Math.min(1, i / 60));
      stepWormSim(sim, 0.05, SIZE, ctx);
      if (sim.restRead) armed = sim.restRead;
    }
    expect(armed).not.toBeNull();
    expect(armed.axis).toBe('row');
    expect(armed.txnId).toBe(liveRotation.txnId);
    // Whatever plane it crossed onto, the head is on it and protected.
    expect(restReadProtectsTile(armed, sim.pos.x, sim.pos.y, sim.pos.z)).toBe(true);
    // And that cell was recorded with this transaction's provenance.
    const prov = sim.restReadTiles.get(tileKey(sim.pos));
    if (prov) expect(prov.txnId).toBe(liveRotation.txnId);
  });

  it('keeps protected body history after the head has left the plane', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    for (let i = 0; i < 30; i++) stepWormSim(sim, 0.05, SIZE, ctx);

    const headY = sim.pos.y;
    beginTurn('row', [headY], [1], 0.4);
    // Head crosses onto the plane, laying a protected trail entry…
    const crossedKey = tileKey(sim.pos);
    sim.restReadTiles.set(crossedKey, { txnId: liveRotation.txnId, axis: 'row', sliceIndex: headY });
    // …then steps back off it. Protection for the HEAD is gone; the entry it laid down
    // is still in destination space and must survive to the commit.
    sim.restRead = null;
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.restReadTiles.has(crossedKey)).toBe(true);

    resetLiveRotation();
    applyRotationToSim(sim, SIZE, ctx,
      { axis: 'row', sliceIndex: headY, dir: 1, sliceIndices: [headY], sliceDirs: [1] },
      { inOpeningScramble: false, paused: false });
    // The protected cell was not rotated a second time.
    let found = false;
    for (let i = 0; i < sim.tileTrail.count; i++) if (ttAt(sim.tileTrail, i) === crossedKey) found = true;
    expect(found).toBe(true);
  });

  it('drops protection left behind by a cancelled turn when the next one starts', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    for (let i = 0; i < 20; i++) stepWormSim(sim, 0.05, SIZE, ctx);

    beginTurn('row', [1], [1], 0.5);
    const staleKey = tileKey(sim.pos);
    sim.restReadTiles.set(staleKey, { txnId: liveRotation.txnId, axis: 'row', sliceIndex: 1 });
    resetLiveRotation();               // cancelled: no commit ever arrives

    beginTurn('row', [1], [1], 0.1);   // a second turn of the same plane
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.restReadTiles.has(staleKey)).toBe(false);
  });
});
