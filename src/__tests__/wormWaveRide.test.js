// A rotation wave commits up to three parallel planes at once. The claim that
// makes that safe is that the planes are disjoint and therefore commute — so
// applying them together must equal applying them one at a time, in any order,
// for the SIM as well as for the cube.
//
// These tests hold the sim to that claim, and check that each world object the
// worm interacts with (head, trail, orbs, specials, in-flight tunnel) rides the
// plane it is actually on rather than the wave's first plane.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyWaveToSim,
  applyRotationToSim,
  tileKey,
} from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { liveRotation } from '../worm/liveRotation.js';
import { setLiveWave, setPlaneAngle, resetLiveRotations, planeAngleFor, planeSliceForCell, liveRotations } from '../worm/liveRotations.js';
import { ttAt } from '../worm/circularBuffers.js';
import { makeWormCtx, makeWormSimFor, makeWormRunner } from './helpers/wormHarness.js';

const SIZE = 5;
const OPTS = { inOpeningScramble: false, paused: false };

const cubies = makeCubies(SIZE);
const makeCtx = (overrides = {}) => makeWormCtx({ getCubies: () => cubies, ...overrides });
const { run } = makeWormRunner(SIZE);

const wave = (axis, ...rotations) => ({ axis, rotations });
const plane = (sliceIndex, dir = 1, numTurns = 1) => ({ sliceIndex, dir, numTurns });

// Everything about the sim that a rotation is supposed to move.
function snapshot(sim) {
  const trail = [];
  for (let i = 0; i < sim.tileTrail.count; i++) trail.push(ttAt(sim.tileTrail, i));
  const path = [];
  for (let i = 0; i < sim.pathHistory.count; i++) path.push(ttAt(sim.pathHistory, i));
  return JSON.stringify({
    pos: sim.pos,
    moveDir: sim.moveDir,
    prevTile: sim.prevTile,
    powerups: sim.powerups,
    specials: sim.specials,
    activeTunnel: sim.activeTunnel,
    trail,
    path,
  });
}

// A sim that has actually crawled, so its rings hold real history rather than
// the synthetic seed.
function crawledSim() {
  const sim = makeWormSimFor(SIZE, { orbCount: 0, wormholeInterval: 9999 });
  run(sim, makeCtx(), 2.5);
  sim.powerups = [
    { x: 1, y: 0, z: 4, dirKey: 'PZ', type: 'apple' },
    { x: 3, y: 2, z: 4, dirKey: 'PZ', type: 'apple' },
    { x: 0, y: 4, z: 2, dirKey: 'NX', type: 'apple' },
  ];
  sim.specials = [{ x: 3, y: 1, z: 4, dirKey: 'PZ', type: 'rocket', ttl: 30, id: 's1' }];
  sim.activeTunnel = {
    entry: { x: 1, y: 1, z: 4, dirKey: 'PZ' },
    exit: { x: 3, y: 3, z: 0, dirKey: 'NZ' },
  };
  return sim;
}

const PERMUTATIONS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

beforeEach(() => {
  liveRotation.active = false;
  resetLiveRotations();
  liveRotations.completedFrames = 0;
});

describe('applyWaveToSim', () => {
  it('equals the same planes applied one at a time, in every order', () => {
    const planes = [plane(0, 1), plane(2, -1), plane(4, 1)];

    const atomicSim = crawledSim();
    applyWaveToSim(atomicSim, SIZE, makeCtx(), wave('col', ...planes), OPTS);
    const atomic = snapshot(atomicSim);

    for (const order of PERMUTATIONS) {
      const seqSim = crawledSim();
      const ctx = makeCtx();
      for (const i of order) {
        applyRotationToSim(seqSim, SIZE, ctx, { axis: 'col', ...planes[i] }, OPTS);
      }
      expect(snapshot(seqSim), `order ${order.join('')}`).toBe(atomic);
    }
  });

  it('is exactly the old single-rotation path for a one-plane wave', () => {
    const a = crawledSim();
    const b = crawledSim();
    applyWaveToSim(a, SIZE, makeCtx(), wave('row', plane(1, -1)), OPTS);
    applyRotationToSim(b, SIZE, makeCtx(), { axis: 'row', sliceIndex: 1, dir: -1 }, OPTS);
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('restores the sim when a wave is followed by its inverse', () => {
    const sim = crawledSim();
    const before = snapshot(sim);
    const ctx = makeCtx();
    applyWaveToSim(sim, SIZE, ctx, wave('depth', plane(0, 1), plane(2, -1), plane(4, 1)), OPTS);
    expect(snapshot(sim)).not.toBe(before);
    applyWaveToSim(sim, SIZE, ctx, wave('depth', plane(0, -1), plane(2, 1), plane(4, -1)), OPTS);
    expect(snapshot(sim)).toBe(before);
  });

  it('carries a half turn as two quarter turns', () => {
    const a = crawledSim();
    const b = crawledSim();
    const ctx = makeCtx();
    applyWaveToSim(a, SIZE, ctx, wave('col', plane(0, 1, 2)), OPTS);
    applyRotationToSim(b, SIZE, ctx, { axis: 'col', sliceIndex: 0, dir: 1 }, OPTS);
    applyRotationToSim(b, SIZE, ctx, { axis: 'col', sliceIndex: 0, dir: 1 }, OPTS);
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('moves every object that sits on a plane and nothing that does not', () => {
    const sim = crawledSim();
    // One orb on plane 0, one on plane 4, one on neither.
    sim.powerups = [
      { x: 0, y: 1, z: 4, dirKey: 'PZ', type: 'apple' },
      { x: 4, y: 1, z: 4, dirKey: 'PZ', type: 'apple' },
      { x: 2, y: 1, z: 4, dirKey: 'PZ', type: 'apple' },
    ];
    const before = sim.powerups.map(tileKey);
    applyWaveToSim(sim, SIZE, makeCtx(), wave('col', plane(0, 1), plane(4, -1)), OPTS);
    const after = sim.powerups.map(tileKey);

    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    // The orb on no plane is untouched.
    expect(after[2]).toBe(before[2]);
    // A slice rotation maps its slice onto itself, so the ridden orbs stay on
    // the plane that carried them.
    expect(sim.powerups[0].x).toBe(0);
    expect(sim.powerups[1].x).toBe(4);
  });

  it('rides both endpoints of an in-flight tunnel independently', () => {
    const sim = crawledSim();
    sim.activeTunnel = {
      entry: { x: 0, y: 1, z: 4, dirKey: 'PZ' },
      exit: { x: 4, y: 3, z: 0, dirKey: 'NZ' },
    };
    applyWaveToSim(sim, SIZE, makeCtx(), wave('col', plane(0, 1), plane(4, -1)), OPTS);
    // Each endpoint stays on its own plane, having turned opposite ways.
    expect(sim.activeTunnel.entry.x).toBe(0);
    expect(sim.activeTunnel.exit.x).toBe(4);
    expect(tileKey(sim.activeTunnel.entry)).not.toBe('0,1,4,PZ');
    expect(tileKey(sim.activeTunnel.exit)).not.toBe('4,3,0,NZ');
  });
});

describe('liveRotations bridge', () => {
  it('gives each cell the angle of the plane it is actually on', () => {
    setLiveWave(7, 'col', [plane(0, 1), plane(2, -1), plane(4, 1)]);
    setPlaneAngle(0, 0.5);
    setPlaneAngle(1, -0.25);
    setPlaneAngle(2, 1.0);

    expect(planeAngleFor(0, 3, 3)).toBe(0.5);
    expect(planeAngleFor(2, 3, 3)).toBe(-0.25);
    expect(planeAngleFor(4, 3, 3)).toBe(1.0);
    // A cell on no plane is not riding.
    expect(planeAngleFor(1, 3, 3)).toBe(0);
    expect(planeAngleFor(3, 3, 3)).toBe(0);

    expect(planeSliceForCell(2, 0, 0)).toBe(2);
    expect(planeSliceForCell(1, 0, 0)).toBeNull();
  });

  it('clears the previous wave, so a narrower wave leaves no stale plane behind', () => {
    setLiveWave(1, 'col', [plane(0), plane(2), plane(4)]);
    setPlaneAngle(0, 0.4); setPlaneAngle(1, 0.4); setPlaneAngle(2, 0.4);
    // A worm segment on slice 4 riding a plane that stopped turning is exactly
    // how a body tears itself apart on screen.
    setLiveWave(2, 'col', [plane(0)]);
    setPlaneAngle(0, 0.2);
    expect(planeAngleFor(0, 0, 0)).toBe(0.2);
    expect(planeAngleFor(2, 0, 0)).toBe(0);
    expect(planeAngleFor(4, 0, 0)).toBe(0);
  });

  it('holds the completed wave for a couple of frames after reset', () => {
    setLiveWave(3, 'row', [plane(1, 1), plane(3, -1)]);
    setPlaneAngle(0, Math.PI / 2);
    setPlaneAngle(1, -Math.PI / 2);
    resetLiveRotations();

    expect(liveRotations.active).toBe(false);
    expect(liveRotations.completedFrames).toBe(2);
    expect(liveRotations.completedCount).toBe(2);
    // Nothing is riding live any more…
    expect(planeAngleFor(0, 1, 0)).toBe(0);
  });
});

describe('liveRotation compatibility adapter', () => {
  it('reports a one-plane wave exactly as before', () => {
    setLiveWave(4, 'depth', [plane(3, -1)]);
    setPlaneAngle(0, -0.7);
    expect(liveRotation.active).toBe(true);
    expect(liveRotation.axis).toBe('depth');
    expect(liveRotation.sliceIndex).toBe(3);
    expect(liveRotation.angle).toBeCloseTo(-0.7);
  });

  it('reports inactive for a multi-plane wave rather than a misleading first plane', () => {
    // A legacy reader that took plane 0 as "the" rotation would glue objects on
    // slices 2 and 4 to the wrong plane. Reporting inactive makes them fall back
    // to grid-math rest positions: stiffer for one turn, never wrong.
    setLiveWave(5, 'col', [plane(0), plane(2), plane(4)]);
    setPlaneAngle(0, 0.3);
    expect(liveRotation.active).toBe(false);
    expect(liveRotation.axis).toBeNull();
    expect(liveRotation.angle).toBe(0);
  });
});
