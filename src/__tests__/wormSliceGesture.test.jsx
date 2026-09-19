import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { liveCubies } from '../worm/liveCubies.js';
import CubeAssembly from '../3d/CubeAssembly.jsx';
import Cubie from '../3d/Cubie.jsx';

const camera = new THREE.PerspectiveCamera();
const frames = [];
vi.mock('../3d/Cubie.jsx', () => ({ default: () => null }));
vi.mock('@react-three/fiber', () => ({ useFrame: cb => frames.push(cb), useThree: () => ({ camera, gl: {} }) }));
vi.mock('../3d/styles/TileStyleMaterials.jsx', async original => ({ ...(await original()), warmUpDefaultStyles: () => {} }));
let root, host, tree;
const onMove = vi.fn();
function Harness({ size }) {
  tree = CubeAssembly.type({ size, cubies: useGameStore.getState().cubies, onMove, animState: null });
  return null;
}
function findElement(node, type) {
  for (const child of React.Children.toArray(node?.props?.children)) {
    if (child.type === type) return child;
    const found = findElement(child, type); if (found) return found;
  }
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  frames.length = 0;
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT; vi.clearAllMocks(); });

it.each([3, 15])('blocks live layer dragging before any size-%i mesh moves', size => {
  useGameStore.setState({ size, cubies: makeCubies(size), wormHealerMode: true, wormPhase: 'crawling',
    wormJumpRescueActive: false, animState: null, cubiePops: {}, chaosLevel: 0 });
  act(() => root.render(<Harness size={size} />));
  // Attach actual CPU scene objects to the live transform slots.
  const refs = liveCubies.refs;
  for (let i = 0; i < size ** 3; i++) {
    refs[i] = new THREE.Object3D();
    refs[i].position.set(Math.floor(i / (size * size)), Math.floor(i / size) % size, i % size);
  }
  const before = refs.map(obj => ({ position: obj.position.clone(), quaternion: obj.quaternion.clone() }));
  const element = size === 15 ? findElement(tree, 'mesh') : findElement(tree, Cubie);
  expect(element).toBeTruthy();
  const event = { clientX: 100, clientY: 100, point: new THREE.Vector3(0, 0, size / 2),
    face: { normal: new THREE.Vector3(0, 0, 1) }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  act(() => {
    if (size === 15) element.props.onPointerDown(event);
    else element.props.onPointerDown({ pos: { x: 1, y: 1, z: 2 }, worldPos: event.point, event });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 250, clientY: 110, bubbles: true }));
    // Live drag transforms run in useFrame before a committed move exists.
    for (const cb of frames) cb({ camera, clock: { elapsedTime: 1 } }, 1 / 60);
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 250, clientY: 110, bubbles: true }));
  });
  expect(onMove).not.toHaveBeenCalled();
  expect(event.preventDefault).not.toHaveBeenCalled();
  refs.forEach((obj, i) => {
    expect(obj.position).toEqual(before[i].position);
    expect(obj.quaternion.toArray()).toEqual(before[i].quaternion.toArray());
  });
});
