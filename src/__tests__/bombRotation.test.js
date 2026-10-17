import { afterEach, expect, it } from 'vitest';
import * as THREE from 'three';
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { makeCubies } from '../game/cubeState.js';
import { applyTileMove } from '../game/tileOrientation.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { subscribeBombRotations, createBombPose, updateBombPose } from '../worm/healerWorm/bombRotation.js';
import { bombDisarmRing, isBombDisarmed, computeBlastTiles, tileKeyOf } from '../worm/healerWorm/bombs.js';
import { setLiveRotation, resetLiveRotation, cancelLiveRotation } from '../worm/liveRotation.js';
import { wormExpansion } from '../worm/wormExpansion.js';

afterEach(() => { cancelLiveRotation(); wormExpansion.amount = 0; });

function scene(size = 5) {
  const cubies = makeCubies(size);
  const bombs = getAllSurfaceTiles(size).map((tile, id) => {
    cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey].bombTestId = id;
    return { id, tile, fuse: 3.7, maxFuse: 8 };
  });
  const store = createStore(subscribeWithSelector(() => ({ size, cubies, rotationEpoch: 0, lastRotation: null })));
  const stop = subscribeBombRotations(store, { current: bombs });
  const commit = rot => store.setState(s => ({ cubies: applyTileMove(s.cubies, size, rot).cubies,
    lastRotation: rot, rotationEpoch: s.rotationEpoch + 1 }));
  return { size, bombs, store, commit, stop };
}

function near(actual, expected) {
  actual.toArray().forEach((value, i) => expect(value).toBeCloseTo(expected.toArray()[i], 8));
}

it.each(['col', 'row', 'depth'])('keeps every bomb on its actual sticker through %s turns', axis => {
  const s = scene();
  for (const rot of [
    { axis, sliceIndex: 1, dir: 1 },
    { axis, sliceIndex: 1, dir: -1 },
    { axis, sliceIndex: 0, sliceIndices: [0, 4], sliceDirs: [1, -1], dir: 1 },
    { axis, sliceIndex: 2, dir: -1, numTurns: 2 },
  ]) {
    s.commit(rot);
    for (const bomb of s.bombs) {
      const { x, y, z, dirKey } = bomb.tile;
      expect(s.store.getState().cubies[x][y][z].stickers[dirKey].bombTestId).toBe(bomb.id);
      expect(bomb.fuse).toBe(3.7);
      expect(bomb.maxFuse).toBe(8);
    }
  }
  const before = s.bombs.map(b => b.tile);
  // Healing and other epoch updates must not replay the last turn.
  s.store.setState(state => ({ rotationEpoch: state.rotationEpoch + 1 }));
  s.bombs.forEach((bomb, i) => expect(bomb.tile).toBe(before[i]));
  s.stop();
});

it.each(['col', 'row', 'depth'])('rides both %s planes and lands without a positional or orientation snap', axis => {
  const s = scene();
  wormExpansion.amount = 0.35;
  const axisVector = new THREE.Vector3(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
  const rest = s.bombs.map(b => updateBombPose(createBombPose(), b, s.size));
  setLiveRotation(axis, [0, 4], [Math.PI / 4, -Math.PI / 4], 0, Math.PI / 4);
  for (const [i, bomb] of s.bombs.entries()) {
    const coordinate = bomb.tile[axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z'];
    const angle = coordinate === 0 ? Math.PI / 4 : coordinate === 4 ? -Math.PI / 4 : 0;
    const pose = updateBombPose(createBombPose(), bomb, s.size);
    near(pose.position, rest[i].position.clone().applyAxisAngle(axisVector, angle));
    // A second frame at the same total angle must not rotate again.
    updateBombPose(pose, bomb, s.size);
    near(pose.position, rest[i].position.clone().applyAxisAngle(axisVector, angle));
  }
  setLiveRotation(axis, [0, 4], [Math.PI / 2, -Math.PI / 2], 0, Math.PI / 2);
  const end = s.bombs.map(b => updateBombPose(createBombPose(), b, s.size));
  resetLiveRotation();
  s.commit({ axis, sliceIndex: 0, sliceIndices: [0, 4], sliceDirs: [1, -1], dir: 1 });
  s.bombs.forEach((bomb, i) => {
    const landed = updateBombPose(createBombPose(), bomb, s.size);
    near(landed.position, end[i].position);
    for (const field of ['flat', 'up']) {
      near(new THREE.Vector3(0, 1, 0).applyQuaternion(landed[field]),
        new THREE.Vector3(0, 1, 0).applyQuaternion(end[i][field]).applyQuaternion(end[i].rotation));
    }
    near(landed.label, end[i].label.clone().applyQuaternion(end[i].rotation));
  });
  s.stop();
});

it('moves the disarm ring and blast to the new face, and releases its subscription', () => {
  const s = scene();
  const bomb = s.bombs.find(b => tileKeyOf(b.tile) === '2,2,4,PZ');
  const oldRing = bombDisarmRing(bomb, s.size);
  s.commit({ axis: 'col', sliceIndex: 2, dir: 1 });
  expect(bomb.tile).toEqual({ x: 2, y: 0, z: 2, dirKey: 'NY' });
  expect(isBombDisarmed(bomb, oldRing, s.size)).toBe(false);
  expect(isBombDisarmed(bomb, bombDisarmRing(bomb, s.size), s.size)).toBe(true);
  expect(computeBlastTiles(bomb, s.size).center).toEqual(bomb.tile);
  const tile = bomb.tile;
  s.stop();
  s.commit({ axis: 'col', sliceIndex: 2, dir: -1 });
  expect(bomb.tile).toBe(tile);
});

it('returns to the original tile when a live drag is cancelled', () => {
  const bomb = { tile: { x: 2, y: 2, z: 4, dirKey: 'PZ' } };
  const pose = createBombPose();
  const original = updateBombPose(pose, bomb, 5).position.clone();
  setLiveRotation('col', [2], [0.7], 2, 0.7);
  expect(updateBombPose(pose, bomb, 5).position.distanceTo(original)).toBeGreaterThan(1);
  cancelLiveRotation();
  near(updateBombPose(pose, bomb, 5).position, original);
});
