import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { makeCubies } from '../game/cubeState.js';
import { liveRotation, resetLiveRotation } from '../worm/liveRotation.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('../3d/PuzzleOrbitControls.jsx', () => ({ default: () => null }));
vi.mock('../3d/InspectionViews.jsx', () => ({ default: () => null }));
vi.mock('../3d/VoidCore.jsx', () => ({ default: () => null }));
vi.mock('../3d/CameraFlipKick.jsx', () => ({ default: () => null }));
vi.mock('../manifold/WormholeNetwork.jsx', () => ({ default: () => null }));
vi.mock('../3d/styles/TileStyleMaterials.jsx', async original => ({ ...(await original()), warmUpDefaultStyles: () => {} }));
extend(THREE);

// Keep the real Cubie, StickerPlane, shared style materials, and R3F commit/frame
// scheduling. Sampling after act() would miss the bad frame rendered BEFORE
// React commits the new stickers, which is exactly the flash in the recording.
it.each([
  [8, 'col', [2], [1], false],
  [8, 'row', [1, 6], [1, -1], false],
  [8, 'depth', [3], [-1], false],
  [8, 'row', [1, 6], [1, -1], true],
  [15, 'row', [0, 14], [1, -1], false],
])('preserves size-%i %s layers %j directions %j through commit (queued=%s)', async (size, axis, layers, dirs, queued) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: CubeAssembly } = await import('../3d/CubeAssembly.jsx');
  const settings = { ...before.settings, flipPads: 'off', biomeMode: { enabled: false },
    manifoldStyles: { 1: 'carbonFiber', 2: 'grass', 3: 'circuit', 4: 'carbonFiber', 5: 'grass', 6: 'circuit' } };
  const move = { axis, sliceIndex: layers[0], dir: dirs[0], sliceIndices: layers, sliceDirs: dirs,
    isShuffle: true, wormScramble: true };
  const nextMove = { axis: 'col', sliceIndex: 0, dir: -1, isShuffle: true, wormScramble: true };
  useGameStore.setState({ size, cubies: makeCubies(size), settings, faceTextures: {},
    animState: move, pendingMove: move, rotationEpoch: 0, explosionT: 0,
    wormHealerMode: true, wormPhase: 'scramble', wormJumpRescueActive: false,
    chaosLevel: 0, randomMode: false, hollowMode: false, mirrorMode: false,
    visualMode: 'classic', wormViewPower: null, perfReducedFX: false, showCursor: false });
  function Harness() {
    const cubies = useGameStore(s => s.cubies);
    const animation = useAnimation();
    return <CubeAssembly size={size} cubies={cubies} animState={animation.animState}
      onAnimComplete={() => {
        animation.handleAnimComplete();
        // Model a slow render batching the queue's idle state and next move.
        if (queued) useGameStore.setState({ animState: nextMove, pendingMove: nextMove });
      }} />;
  }
  let rendered;
  const canvas = document.createElement('canvas');
  const gl = { render: scene => {
    scene.updateMatrixWorld(true);
    rendered = new Map();
    scene.traverse(mesh => {
      if (mesh.name !== 'sticker-front') return;
      const material = mesh.material;
      mesh.onBeforeRender(null, scene, null, mesh.geometry, material);
      const id = `${material.uniforms.tileHome.value.toArray()}:${material.uniforms.tileFace.value}`;
      rendered.set(id, { matrix: mesh.matrixWorld.clone(), material });
    });
  }, setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
  xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
  renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [15, 15, 15] } });
  let store, time = 0;
  const frame = async (count = 1, inspect) => act(async () => {
    for (let i = 0; i < count; i++) {
      store.getState().advance(time += 1 / 60);
      inspect?.();
    }
  });
  const expectSameTiles = expected => {
    expect(rendered.size).toBe(6 * size * size);
    for (const [id, tile] of expected) {
      const current = rendered.get(id);
      expect(current, `missing sticker ${id}`).toBeDefined();
      const error = Math.max(...current.matrix.elements.map((value, i) => Math.abs(value - tile.matrix.elements[i])));
      expect(error, `sticker ${id} jumped during the commit`).toBeLessThan(1e-8);
      expect(current.material.uuid, `sticker ${id} changed style during the commit`).toBe(tile.material.uuid);
    }
  };
  try {
    await act(async () => { store = root.render(<Harness />); });
    for (let i = 0; i < 90 && Math.abs(liveRotation.angle) < Math.PI / 2; i++) await frame();
    expect(Math.abs(liveRotation.angle)).toBe(Math.PI / 2);
    const finalPose = rendered;
    // This frame completes the move in useFrame(-2). gl.render still observes
    // the previous React scene until the enclosing act flushes the commit.
    await frame(3, () => expectSameTiles(finalPose));
    expect(useGameStore.getState().animState).toBe(queued ? nextMove : null);
    await frame(); // The committed grid/material representation is equivalent.
    expectSameTiles(finalPose);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); resetLiveRotation();
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
