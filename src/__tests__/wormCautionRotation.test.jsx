import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import RaisedCautionPerimeter from '../worm/healerWorm/RaisedCautionPerimeter.jsx';
import { WormholeRings } from '../worm/healerWorm/WormholeRings.jsx';
import { buildCautionPerimeter, cautionPointInto } from '../worm/healerWorm/cautionPerimeter.js';
import { liveRotation, setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { rotateTilePosition } from '../worm/wormHelpers.js';
import { WORM_CAUTION_TAPE_TOP, WORM_CAUTION_POLE_HEIGHT } from '../game/raisedCubie.js';
import { useGameStore } from '../hooks/useGameStore.js';

vi.mock('../worm/healerWorm/TunnelSafetyMarkers.jsx', () => ({ default: () => null }));
extend(THREE);
async function sceneTest(check) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), expansion = wormExpansion.amount;
  resetLiveRotation(); wormExpansion.amount = 0;
  useGameStore.setState({ rotationEpoch: 0 });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  try { await check(root); }
  finally {
    await act(async () => root.unmount()); resetLiveRotation();
    useGameStore.setState(before, true); wormExpansion.amount = expansion;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
}

it.each(['col', 'row', 'depth'].flatMap(axis => [0, 0.35].map(expansion => ({ axis, expansion }))))(
  'moves poles and tape with opposite $axis layers at expansion $expansion, leaving the middle layer still',
  ({ axis, expansion }) => sceneTest(async root => {
    const size = 5, cubies = makeCubies(size), dimension = ['col', 'row', 'depth'].indexOf(axis);
    const direction = new THREE.Vector3().setComponent(dimension, 1);
    const positions = [1, 2, 3, 1].map((layer, i) => {
      const cell = [2, 2, 2]; cell[dimension] = layer;
      cell[(dimension + 2) % 3] = 4;
      if (i === 3) cell[(dimension + 1) % 3] = 3;
      return { x: cell[0], y: cell[1], z: cell[2], dirKey: ['PX', 'PY', 'PZ'][(dimension + 2) % 3] };
    });
    wormExpansion.amount = expansion;
    let store;
    await act(async () => { store = root.render(<RaisedCautionPerimeter positions={positions} cubies={cubies} size={size} rotationEpoch={0} />); });
    const state = store.getState(), poles = state.scene.getObjectByName('worm-caution-poles');
    const geometry = state.scene.getObjectByName('worm-caution-tape').geometry;
    const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), expected = new THREE.Vector3();
    let time = 0;
    for (const angle of [0, 0.2, 0.7, Math.PI / 2, 0.3]) {
      setLiveRotation(axis, [1, 3], [angle, -angle], 1, angle);
      state.advance(time += 1 / 60);
      const perimeter = buildCautionPerimeter(positions, cubies, size, 6, expansion > 0, liveRotation);
      expect(poles.count).toBe(perimeter.posts.length);
      expect(geometry.drawRange.count).toBe(perimeter.edges.length * 6);
      for (const [i, edge] of perimeter.edges.entries()) {
        const layer = edge.face[['x', 'y', 'z'][dimension]];
        const turn = layer === 1 ? angle : layer === 3 ? -angle : 0;
        for (let j = 0; j < 4; j++) {
          cautionPointInto(expected, j < 2 ? edge.a : edge.b, size, expansion, WORM_CAUTION_TAPE_TOP - (j % 2) * 0.12);
          expected.applyAxisAngle(direction, turn);
          point.fromBufferAttribute(geometry.attributes.position, i * 4 + j);
          expect(point.distanceTo(expected)).toBeLessThan(1e-6);
        }
        point.fromBufferAttribute(geometry.attributes.position, i * 4);
        expected.fromBufferAttribute(geometry.attributes.position, i * 4 + 2);
        expect(point.distanceTo(expected)).toBeCloseTo(1, 6); // No tape stretches between layers.
      }
      for (const [i, vertex] of perimeter.posts.entries()) {
        const layer = vertex.center[dimension], turn = layer === 1 ? angle : layer === 3 ? -angle : 0;
        poles.getMatrixAt(i, matrix);
        for (const end of [-0.5, 0.5]) {
          point.set(0, end, 0).applyMatrix4(matrix);
          cautionPointInto(expected, vertex, size, expansion, 0.01 + (end + 0.5) * WORM_CAUTION_POLE_HEIGHT);
          expected.applyAxisAngle(direction, turn);
          expect(point.distanceTo(expected)).toBeLessThan(1e-6);
        }
      }
    }
    resetLiveRotation(); state.advance(time += 1 / 60);
    expect(geometry.drawRange.count).toBe(buildCautionPerimeter(positions, cubies, size, 6, expansion > 0).edges.length * 6);
    // Idle frames no longer need buffer uploads.
    const version = geometry.attributes.position.version;
    state.advance(time += 1 / 60);
    expect(geometry.attributes.position.version).toBe(version);
  })
);

it('holds the completed pose until committed grid coordinates arrive, without a snap back or double turn', () => sceneTest(async root => {
  const size = 5, cubies = makeCubies(size), positions = [{ x: 1, y: 2, z: 4, dirKey: 'PZ' }];
  let store;
  await act(async () => { store = root.render(<RaisedCautionPerimeter positions={positions} cubies={cubies} size={size} rotationEpoch={0} />); });
  const state = store.getState(), geometry = state.scene.getObjectByName('worm-caution-tape').geometry;
  setLiveRotation('row', [2], [Math.PI / 2], 2, Math.PI / 2);
  state.advance(1 / 60);
  const final = geometry.attributes.position.array.slice();
  resetLiveRotation(); useGameStore.setState({ rotationEpoch: 1 });
  state.advance(2 / 60);
  expect(geometry.attributes.position.array).toEqual(final);
  const moved = rotateSliceCubies(cubies, size, 'row', 2, 1);
  const destinations = positions.map(p => rotateTilePosition(p, 'row', 2, 1, size));
  await act(async () => root.render(<RaisedCautionPerimeter positions={destinations} cubies={moved} size={size} rotationEpoch={1} />));
  state.advance(3 / 60);
  const current = state.scene.getObjectByName('worm-caution-tape').geometry.attributes.position;
  const before = Array.from({ length: final.length / 3 }, (_, i) => new THREE.Vector3().fromArray(final, i * 3));
  for (let i = 0; i < current.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(current, i);
    expect(Math.min(...before.map(p => p.distanceTo(point)))).toBeLessThan(1e-6);
  }
}));

it('lowers legacy demo fences and carries them at display cadence through a drag and cancellation', () => sceneTest(async root => {
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, fill() {}
  });
  try {
    const size = 3, initial = makeCubies(size);
    const cubies = flipStickerPair(initial, size, 1, 1, 2, 'PZ', buildManifoldGridMap(initial, size));
    useGameStore.setState({ cubies, size, wormHealerMode: false, demoMode: true, chaosLevel: 0,
      settings: { ...useGameStore.getState().settings, reducedMotion: true } });
    let store;
    await act(async () => { store = root.render(<WormholeRings cubies={cubies} size={size} tunnelUseCountsRef={{ current: new Map() }} voidTunnelKeysRef={{ current: new Set() }} />); });
    const state = store.getState(), poles = state.scene.getObjectByName('worm-caution-poles');
    const tapes = state.scene.getObjectByName('worm-caution-tape');
    let time = 1 / 30; state.advance(time);
    expect(poles.count).toBe(8); expect(tapes.count).toBe(8);
    const rest = [poles, tapes].map(mesh => Array.from({ length: mesh.count }, (_, i) => {
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); return matrix;
    }));
    expect(new THREE.Vector3().setFromMatrixScale(rest[0][0]).y).toBeCloseTo(0.34, 6);
    for (const angle of [0.15, 0.6, -0.2, 0]) {
      if (angle) setLiveRotation('row', [1], [angle], 1, angle);
      else resetLiveRotation();
      state.advance(time += 1 / 120); // Shorter than either normal throttle interval.
      const turn = new THREE.Matrix4().makeRotationY(angle);
      [poles, tapes].forEach((mesh, which) => {
        for (let i = 0; i < mesh.count; i++) {
          const actual = new THREE.Matrix4(); mesh.getMatrixAt(i, actual);
          const expected = turn.clone().multiply(rest[which][i]);
          actual.elements.forEach((value, j) => expect(value).toBeCloseTo(expected.elements[j], 6));
        }
      });
    }
  } finally { context.mockRestore(); }
}));
