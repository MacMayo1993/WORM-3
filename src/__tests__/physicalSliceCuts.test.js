import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { checkWormHitBySlice, cutWormTail, resolveSliceHits } from '../worm/wormHelpers.js';
import { bodyDistanceAt } from '../worm/healerWorm/sliceBodyPath.js';
import { advanceInchGaitState } from '../worm/healerWorm/inchGait.js';
import { shAt, shPush, shReset, ttPush, ttReset } from '../worm/circularBuffers.js';
import { useGameStore } from '../hooks/useGameStore.js';

function fixture(points, size = 7, count = 100, normal = new THREE.Vector3(0, 0, 1)) {
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  sim.tailLength = count;
  sim.currentNormal.copy(normal);
  const k = (size - 1) / 2;
  const cell = value => Math.max(0, Math.min(size - 1, Math.round(value + k)));
  sim.headInterpPos.copy(points[0]).addScaledVector(sim.currentNormal, -0.08);
  sim.pos = { x: cell(points[0].x), y: cell(points[0].y), z: cell(points[0].z), dirKey: normal.x ? 'PX' : 'PZ' };
  sim.interpT = 1;
  shReset(sim.stepHistory);
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    shPush(sim.stepHistory, p, sim.currentNormal, cell(p.x), cell(p.y), cell(p.z));
  }
  // Deliberately coarser than the rendered path: this used to control cut length.
  ttReset(sim.tileTrail, `5,3,${size - 1},PZ`);
  ttPush(sim.tileTrail, `3,3,${size - 1},PZ`);
  ttPush(sim.tileTrail, `2,3,${size - 1},PZ`);
  ttPush(sim.tileTrail, `${sim.pos.x},${sim.pos.y},${size - 1},PZ`);
  sim.orbPickupColors = Array(32).fill('#ffdd44');
  sim.orbPickupFaceIds = Array(32).fill(1);
  const worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
    get current() { return sim[key]; }, set current(value) { sim[key] = value; },
  }]));
  for (const key of ['orbPickupColors', 'orbPickupFaceIds', 'colorEpoch']) worm[`${key}Ref`] = worm[key];
  return { sim, worm };
}
const line = n => Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3(-2 + i * 5 / n, 0, 3.6));
beforeEach(() => useGameStore.setState({ wormOrbInventory: { 1: 96, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } }));

describe('physical slice cuts', () => {
  it.each([2, 3, 5, 7, 15].flatMap(size => ['col', 'row', 'depth'].map(axis => [size, axis])))('locates the seam on size %s / %s', (size, axis) => {
    const k = (size - 1) / 2;
    const coord = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
    const a = new THREE.Vector3(0, 0, k + 0.6), normal = new THREE.Vector3(0, 0, 1);
    if (axis === 'depth') { a.set(k + 0.6, 0, 0); normal.set(1, 0, 0); }
    a[coord] = -k;
    const b = a.clone(); b[coord] += 1;
    const { worm } = fixture([a, b], size, 10, normal);
    const hit = checkWormHitBySlice(worm, axis, 1, size);
    expect(hit.type).toBe('cut');
    expect(hit.cutDistance).toBeCloseTo(0.5);
    expect(hit.cutPosition[{ x: 0, y: 1, z: 2 }[coord]]).toBeCloseTo(-k + 0.5);
  });
  it.each([1, 10, 500, 6000])('severs at the same seam with %s path intervals', n => {
    const { sim, worm } = fixture(line(n));
    const hit = checkWormHitBySlice(worm, 'col', 3, 7);
    expect(hit.type).toBe('cut');
    expect(hit.cutDistance).toBeCloseTo(1.5, 8);
    expect(hit.cutPosition).toEqual([-0.5, 0, 3.6]);
    expect(hit.keepCount).toBe(16);
    const traveled = sim.stepHistory.distance;
    cutWormTail(worm, hit);
    expect(sim.tailLength).toBe(16);
    expect(shAt(sim.stepHistory, sim.stepHistory.count - 1).pos.x).toBeCloseTo(-0.5);
    expect(shAt(sim.stepHistory, sim.stepHistory.count - 1).tx).toBeLessThan(3);
    expect(sim.stepHistory.distance).toBe(traveled);
    expect(sim.orbPickupColors).toHaveLength(4);
    expect(useGameStore.getState().wormOrbInventory[1]).toBe(12);
    // There is no remaining centre-line across the rotating/static boundary.
    expect(checkWormHitBySlice(worm, 'col', 3, 7)).toBeNull();
  });

  it('accounts for a bend before the separating plane', () => {
    const { worm } = fixture([
      new THREE.Vector3(-2, 0, 3.6), new THREE.Vector3(-2, 1, 3.6),
      new THREE.Vector3(-1, 1, 3.6), new THREE.Vector3(1, 1, 3.6),
    ]);
    const hit = checkWormHitBySlice(worm, 'col', 3, 7);
    expect(hit.cutDistance).toBeCloseTo(2.5);
    expect(hit.cutPosition).toEqual([-0.5, 1, 3.6]);
    expect(hit.keepCount).toBe(27);
  });

  it('finds a cut beyond the capped visual-effects segment feed', () => {
    const points = [[-2, -2], [-2, 2], [-1.5, 2], [-1.5, -2], [-1, -2], [-1, 2], [1, 2]];
    const { worm } = fixture(points.map(([x, y]) => new THREE.Vector3(x, y, 3.6)), 7, 300);
    const hit = checkWormHitBySlice(worm, 'col', 3, 7);
    expect(hit.cutDistance).toBeCloseTo(13.5);
    expect(hit.keepCount).toBe(150);
  });

  it('uses the occupied body only, not older history beyond the tail', () => {
    const { worm } = fixture(line(500), 7, 10);
    expect(checkWormHitBySlice(worm, 'col', 3, 7)).toBeNull();
  });

  it('uses the physical head position during a partially completed tile step', () => {
    const { sim, worm } = fixture(line(500));
    sim.pos.x = 3; sim.prevTile = { x: 2, y: 3, z: 6, dirKey: 'PZ' }; sim.interpT = 0.8;
    expect(checkWormHitBySlice(worm, 'col', 3, 7).type).toBe('cut');
  });

  it('retains death priority while locating the sever on the trapped head layer', () => {
    const { worm } = fixture(line(500));
    const a = resolveSliceHits(worm, 'col', [3, 1], 7);
    const b = resolveSliceHits(worm, 'col', [1, 3], 7);
    expect(a).toEqual(b);
    expect(a.type).toBe('death');
    expect(a.cutPosition[0]).toBeCloseTo(-1.5);
  });

  it('does not manufacture a minimum-length body across a neck cut', () => {
    const { sim, worm } = fixture([new THREE.Vector3(-0.6, 0, 3.6), new THREE.Vector3(1, 0, 3.6)]);
    const hit = checkWormHitBySlice(worm, 'col', 3, 7);
    expect(hit.type).toBe('death');
    cutWormTail(worm, hit);
    expect(sim.tailLength).toBe(1);
  });

  it('uses Inch contraction to retain the actual bead prefix and holds its cut-frame layout', () => {
    const { sim, worm } = fixture(line(500));
    sim.bodyGait.enabled = true;
    advanceInchGaitState(sim.bodyGait, 3, 100, 1);
    const before = Array.from({ length: 100 }, (_, i) => bodyDistanceAt(worm, i));
    const hit = checkWormHitBySlice(worm, 'col', 3, 7);
    const expected = before.filter(distance => distance <= 1.41 + 1e-9).length;
    expect(hit.keepCount).toBe(expected);
    cutWormTail(worm, hit);
    for (let i = 0; i < expected; i++) expect(bodyDistanceAt(worm, i)).toBeCloseTo(before[i], 8);
  });

  it('preserves whole-layer riding and rocket protection', () => {
    const { worm } = fixture([new THREE.Vector3(-2, 0, 3.6), new THREE.Vector3(-2, 2, 3.6)]);
    expect(checkWormHitBySlice(worm, 'col', 1, 7)).toBeNull();
    const rocket = fixture(line(500));
    rocket.sim.rocketActive = true;
    expect(resolveSliceHits(rocket.worm, 'col', [1, 3], 7)).toBeNull();
  });
});
