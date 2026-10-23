import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';

vi.mock('../utils/device.js', () => ({ isMobile: true, prefersReducedMotion: () => false }));
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('@react-three/drei', async original => ({ ...await original(), Text: () => null }));
extend(THREE);

it.each([[8, false], [8, true], [90, false], [90, true]])(
  'restores a previously flipped mobile Sudoku tile on retry (frames=%i, moved=%s)', async (flipFrames, moved) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, clearRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: Cubie } = await import('../3d/Cubie.jsx');
  const size = 7, initialCubies = makeCubies(size), base = initialCubies[3][3][6];
  let cubie = base;
  useGameStore.setState({ size, cubies: initialCubies, demoMode: false, wormHealerMode: true, wormRunId: 1, wormPaused: false,
    chaosLevel: 0, randomMode: false, hollowMode: false, mirrorMode: false, visualMode: 'sudokube',
    wormViewPower: null, wormPitGrids: {}, perfReducedFX: false, explosionT: 0, faceTextures: {},
    settings: { ...before.settings, biomeMode: { enabled: false }, soundEnabled: false, hapticsEnabled: false } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  await root.configure({ gl, frameloop: 'never', size: { width: 430, height: 800 } });
  let store, time = 0;
  function Board() {
    const current = useGameStore(s => s.cubies[3][3][6]);
    return <StickerInstanceProvider><Cubie cubie={current} position={[0, 0, 3]} size={size} wormMode /></StickerInstanceProvider>;
  }
  const boardWith = piece => {
    const board = makeCubies(size);
    board[3][3][6] = piece;
    return board;
  };
  const render = async () => act(async () => {
    useGameStore.setState({ cubies: boardWith(cubie) });
    store = root.render(<Board />);
  });
  const frame = async (count = 1) => { for (let i = 0; i < count; i++) await act(async () => {
    runActiveStickers({ ...store.getState(), clock: { elapsedTime: time += 1 / 60 } }, 1 / 60);
    store.getState().advance(time);
  }); };
  const snapshot = () => {
    const mesh = store.getState().scene.getObjectByName('StickerInstanceMesh');
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    const items = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (!matrix.determinant()) continue;
      mesh.getColorAt(i, color);
      items.push({ matrix: matrix.toArray(), color: color.toArray() });
    }
    return items;
  };
  try {
    await render(); await frame(90);
    const clean = snapshot();
    expect(clean).toHaveLength(1);
    cubie = { ...base, stickers: { PZ: { ...base.stickers.PZ, flips: 1, curr: ANTIPODAL_COLOR[base.stickers.PZ.orig] } } };
    await render(); await frame(flipFrames);
    await act(async () => useGameStore.setState({ wormAlive: false, wormPaused: true }));
    cubie = moved ? { ...base, stickers: makeCubies(size)[2][3][6].stickers } : base;
    await act(async () => {
      useGameStore.setState({ cubies: boardWith(cubie), wormRunId: 2, wormAlive: true });
    });
    await frame();
    expect(snapshot()).toEqual(clean);
    await frame(120);
    expect(snapshot()).toEqual(clean);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
