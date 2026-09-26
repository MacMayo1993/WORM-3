import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { WormholeRings } from '../worm/healerWorm/WormholeRings.jsx';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { WORM_CAUTION_TAPE_TOP } from '../game/raisedCubie.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { getWormTunnelSnapshot } from '../worm/tunnelSnapshot.js';
import { raisedPlatformPosition } from '../worm/healerWorm/raisedPlatforms.js';
import { liveCubies } from '../worm/liveCubies.js';
import { wormExpansion } from '../worm/wormExpansion.js';

vi.mock('../worm/healerWorm/TunnelSafetyMarkers.jsx', () => ({ default: () => null }));
extend(THREE);

it.each([3, 7, 15])('anchors actual warning posts to the floor and lands at tape height on all %i faces', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), liveBefore = { ...liveCubies }, expansionBefore = wormExpansion.amount;
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, fill() {}
  });
  let cubies = makeCubies(size);
  const mid = Math.floor(size / 2), edge = size - 1;
  for (const [x, y, z, dir] of [[edge, mid, mid, 'PX'], [mid, edge, mid, 'PY'], [mid, mid, edge, 'PZ']]) {
    cubies = flipStickerPair(cubies, size, x, y, z, dir, buildManifoldGridMap(cubies, size));
  }
  const refs = [], spring = { lift: 0 };
  liveCubies.size = size; liveCubies.refs = refs;
  wormExpansion.amount = 0;
  useGameStore.setState({ cubies, size, rotationEpoch: 0, wormHealerMode: true, demoMode: false, chaosLevel: 0,
    settings: { ...before.settings, reducedMotion: true, flipPads: 'off' } });
  const positions = getWormTunnelSnapshot(cubies, size, 0).positions;
  for (const p of positions) refs[(p.x * size + p.y) * size + p.z] = { userData: { wormPlatformFormation: spring } };
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  const uses = { current: new Map() }, voids = { current: new Set() };
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<WormholeRings cubies={cubies} size={size} tunnelUseCountsRef={uses} voidTunnelKeysRef={voids} />); });
    const scene = store.getState().scene, matrix = new THREE.Matrix4();
    const poles = scene.getObjectByName('worm-caution-poles'), tape = scene.getObjectByName('worm-caution-tape');
    expect(positions).toHaveLength(6);
    let original;
    for (const [lift, danger] of [[0, false], [0.5, false], [1, false], [1, true]]) {
      spring.lift = lift;
      if (danger) for (const p of positions) voids.current.add(p.tunnelKey);
      time += 1 / 30; store.getState().advance(time);
      expect(poles.count).toBe(24); expect(tape.count).toBe(24);
      positions.forEach((tile, index) => {
        const floor = new THREE.Vector3().fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0));
        const landing = raisedPlatformPosition(tile, size, { getCubies: () => cubies });
        expect(landing.clone().sub(floor).dot(tile.normal)).toBeCloseTo(WORM_CAUTION_TAPE_TOP, 10);
        for (let edge = 0; edge < 4; edge++) {
          poles.getMatrixAt(index * 4 + edge, matrix);
          const foot = new THREE.Vector3(0, -0.5, 0).applyMatrix4(matrix);
          expect(foot.sub(floor).dot(tile.normal)).toBeCloseTo(0.01, 6);
          tape.getMatrixAt(index * 4 + edge, matrix);
          const top = new THREE.Vector3(0, 0.5, 0).applyMatrix4(matrix);
          expect(top.sub(landing).dot(tile.normal)).toBeCloseTo(0, 6);
        }
      });
      const matrices = poles.instanceMatrix.array.slice(0, poles.count * 16);
      if (!original) original = matrices;
      else expect(matrices).toEqual(original); // Formation and danger never lift the posts.
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); Object.assign(liveCubies, liveBefore); wormExpansion.amount = expansionBefore;
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
