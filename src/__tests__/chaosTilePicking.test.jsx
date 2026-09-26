import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { getManifoldGridId } from '../game/gridIds.js';
import CubeAssembly from '../3d/CubeAssembly.jsx';
import Cubie from '../3d/Cubie.jsx';

const camera = new THREE.PerspectiveCamera();
vi.mock('../3d/Cubie.jsx', () => ({ default: () => null }));
vi.mock('@react-three/fiber', () => ({ useFrame: () => {}, useThree: () => ({ camera, gl: {} }) }));
vi.mock('../3d/styles/TileStyleMaterials.jsx', async original => ({ ...(await original()), warmUpDefaultStyles: () => {} }));
vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
let root, tree, before;
function Harness({ size }) {
  tree = CubeAssembly.type({ size, cubies: useGameStore.getState().cubies, animState: null });
  return null;
}
function findCubie(node) {
  for (const child of React.Children.toArray(node?.props?.children)) {
    if (child.type === Cubie) return child;
    const found = findCubie(child); if (found) return found;
  }
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  root = createRoot(document.createElement('div'));
  useGameStore.setState({ size: 3, cubies: makeCubies(3), wormHealerMode: false,
    wormJumpRescueActive: false, animState: null, chaosLevel: 0, chaosIgnitionPicking: true });
  act(() => root.render(<Harness size={3} />));
});
afterEach(() => {
  act(() => root.unmount());
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([2, 3, 4, 5])('aims at the tapped physical tile on every face after setup changes to size %i', size => {
  // Retain the initial mount's pointer listeners, as the persistent Canvas does.
  let cubies = rotateSliceCubies(makeCubies(size), size, 'col', size - 1, 1);
  cubies = rotateSliceCubies(cubies, size, 'depth', 0, -1);
  act(() => {
    useGameStore.setState({ size, cubies });
    root.render(<Harness size={size} />);
  });
  const max = size - 1;
  const faces = [
    ['PX', [max, max, max], [1, 0, 0]], ['NX', [0, max, max], [-1, 0, 0]],
    ['PY', [max, max, 0], [0, 1, 0]], ['NY', [max, 0, 0], [0, -1, 0]],
    ['PZ', [max, 0, max], [0, 0, 1]], ['NZ', [max, max, 0], [0, 0, -1]]
  ];
  for (const [dirKey, [x, y, z], normal] of faces) {
    const event = { clientX: 100, clientY: 100, point: new THREE.Vector3(),
      face: { normal: new THREE.Vector3(...normal) }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => {
      findCubie(tree).props.onPointerDown({ pos: { x, y, z }, worldPos: event.point, event });
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, clientY: 100 }));
    });
    expect(useGameStore.getState().chaosIgnition).toEqual({ x, y, z, dirKey,
      gridId: getManifoldGridId(cubies[x][y][z].stickers[dirKey], size) });
  }
});
