import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { getOrbColor } from '../worm/wormHelpers.js';

extend(THREE);

// The tunnel heal's shockwave: both mouths of the pair ring at once, each in the
// colour it goes home to, from a fixed pool (nothing mounts on the heal frame).
let before, root, store;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; before = useGameStore.getState(); });
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function mount(worm) {
  const { HealBurstSystem } = await import('../worm/healerWorm/healFx.jsx');
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 400, height: 300 } });
  await act(async () => { store = root.render(<HealBurstSystem worm={worm} size={3} />); });
}
const rigs = () => store.getState().scene.getObjectsByProperty('name', 'heal-burst');
const objectCount = () => { let n = 0; store.getState().scene.traverse(() => { n++; }); return n; };

it('rings both mouths of a healed pair in their home colours, from a fixed pool', async () => {
  const cubies = makeCubies(3);
  useGameStore.setState({ cubies, wormPaused: false });
  const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' }, exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
  const worm = { pendingHealBurstRef: { current: null } };
  await mount(worm);
  expect(rigs()).toHaveLength(4);
  expect(rigs().every(r => !r.visible)).toBe(true);
  // A Suspense resume unhides every instance without visible={false}; idle rigs hide again.
  for (const rig of rigs()) rig.visible = true;
  await act(async () => { store.getState().advance(1 / 60); });
  expect(rigs().every(r => !r.visible)).toBe(true);
  const count = objectCount();

  let t = 1 / 60;
  worm.pendingHealBurstRef.current = { exitTile: exit, entryTile: entry, tier: 1 };
  await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(worm.pendingHealBurstRef.current).toBeNull();
  const live = rigs().filter(r => r.visible);
  expect(live).toHaveLength(2);
  expect(objectCount()).toBe(count); // nothing mounted for the heal
  const colors = resolveColors(useGameStore.getState().settings);
  const want = [exit, entry].map(tile => new THREE.Color(getOrbColor(cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey].orig, colors))
    .lerp(new THREE.Color('#ffffff'), 0.4).getHexString());
  const got = live.map(r => r.children[0].material.color.getHexString());
  expect(got.sort()).toEqual(want.sort());
  expect(want[0]).not.toBe(want[1]); // antipodal tiles, two different home colours
  // Each rig lies flat on its own face: +Z turned onto the tile normal.
  const normals = live.map(r => new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion).round().toArray());
  expect(normals).toEqual(expect.arrayContaining([[0, 0, 1], [0, 0, -1]]));

  // Paused, the rings hold; afterwards they finish and the pool is released.
  useGameStore.setState({ wormPaused: true });
  const scale = live[0].children[0].scale.x;
  for (let f = 0; f < 30; f++) await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(live[0].children[0].scale.x).toBe(scale);
  useGameStore.setState({ wormPaused: false });
  for (let f = 0; f < 70; f++) await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(rigs().every(r => !r.visible)).toBe(true);
});

it('gives a double heal a bigger ring and a second wave', async () => {
  const { poseBurstRig } = await import('../worm/healerWorm/healBurstRig.js');
  const rig = tier => {
    const mat = () => new THREE.MeshBasicMaterial();
    const mesh = () => new THREE.Mesh(undefined, mat());
    return { outer: mesh(), wave: mesh(), core: mesh(), flash: mesh(), tier };
  };
  const one = rig(1), two = rig(2);
  poseBurstRig(one, 0.4); poseBurstRig(two, 0.4);
  expect(two.outer.scale.x).toBeGreaterThan(one.outer.scale.x);
  expect(one.wave.visible).toBe(false);
  expect(two.wave.visible).toBe(true);
  expect(poseBurstRig(one, 1)).toBe(false);
  expect(poseBurstRig(two, 1)).toBe(true); // the second wave is still out
  expect(poseBurstRig(two, 1.2)).toBe(false);
});

it('cues the seal on both mouths under the ids the stickers listen on', async () => {
  const { queueHealSeal } = await import('../worm/healSeal.js');
  const { healBurstMap } = await import('../3d/healBurstBridge.js');
  const { getManifoldGridId } = await import('../game/coordinates.js');
  healBurstMap.clear();
  const cubies = makeCubies(3);
  const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' }, exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
  queueHealSeal(cubies, 3, [entry, exit, { x: 9, y: 9, z: 9, dirKey: 'PZ' }]);
  const ids = [entry, exit].map(t => getManifoldGridId(cubies[t.x][t.y][t.z].stickers[t.dirKey], 3));
  expect([...healBurstMap.keys()].sort()).toEqual(ids.sort());
  expect(ids[0]).not.toBe(ids[1]);
  healBurstMap.clear();
});
