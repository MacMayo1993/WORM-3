import React, { act, useLayoutEffect } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { VIEW_SHOWCASE_SEQUENCE } from '../components/screens/DemoFlowController.jsx';
import { TileSurfaceProvider, useTileSurfaceInstances } from '../3d/TileSurfaceInstances.jsx';

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('../utils/device.js', () => ({ get isMobile() { return device.mobile; }, prefersReducedMotion: () => false }));
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
const textRender = vi.hoisted(() => vi.fn(() => null));
vi.mock('@react-three/drei', async original => ({ ...await original(), Text: textRender }));
extend(THREE);

it.each([false, true])('keeps the demo Grid → Sudoku → Classic scene mounted without font workers (mobile=%s)', async mobile => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  device.mobile = mobile;
  textRender.mockClear();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, clearRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  });
  const before = useGameStore.getState();
  const { default: Cubie } = await import('../3d/Cubie.jsx');
  const size = 3;
  useGameStore.setState({ size, cubies: makeCubies(size), demoMode: true, demoStep: 'view-showcase',
    wormHealerMode: false, chaosLevel: 0, randomMode: false, hollowMode: false, mirrorMode: false,
    visualMode: 'classic', perfReducedFX: false, explosionT: 0, faceTextures: {},
    settings: { ...before.settings, flipPads: 'off', biomeMode: { enabled: false },
      manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(face => [face, 'solid'])) } });
  let pool;
  function Cube() {
    const cubies = useGameStore(s => s.cubies);
    const current = useTileSurfaceInstances();
    useLayoutEffect(() => { pool = current; }, [current]);
    return cubies.flat(2).map(c => <Cubie key={`${c.x},${c.y},${c.z}`} cubie={c}
      position={[c.x - 1, c.y - 1, c.z - 1]} size={size} />);
  }
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  await root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  try {
    let store;
    await act(async () => { store = root.render(<TileSurfaceProvider><Cube /></TileSurfaceProvider>); });
    const scene = store.getState().scene;
    const labels = prefix => { const names = []; scene.traverse(o => { if (o.name.startsWith(prefix)) names.push(o.name.slice(prefix.length)); }); return names.sort(); };
    const ids = () => useGameStore.getState().cubies.flat(2).flatMap(c => Object.values(c.stickers).map(s => getManifoldGridId(s, size))).sort();
    await act(async () => VIEW_SHOWCASE_SEQUENCE[0].apply(useGameStore.getState()));
    expect(labels('GridLabel:')).toEqual(ids());
    expect(textRender).not.toHaveBeenCalled();
    pool.update();
    const batches = pool.group.children.filter(o => o.count > 0);
    expect(batches.length).toBeLessThanOrEqual(12);
    expect(new Set(batches.map(o => o.material)).size).toBe(1);
    expect(batches.reduce((sum, o) => sum + o.count, 0)).toBe(54 * 6);
    // The address is a piece identity: it must survive a turn and still track its tile.
    await act(async () => useGameStore.setState({ cubies: rotateSliceCubies(useGameStore.getState().cubies, size, 'row', 0, 1) }));
    expect(labels('GridLabel:')).toEqual(ids());
    await act(async () => { VIEW_SHOWCASE_SEQUENCE[0].cleanup(useGameStore.getState()); VIEW_SHOWCASE_SEQUENCE[1].apply(useGameStore.getState()); });
    expect(labels('GridLabel:')).toHaveLength(0);
    expect(labels('NumberLabel:')).toHaveLength(54);
    for (let value = 1; value <= 9; value++) expect(labels('NumberLabel:').filter(label => label === String(value))).toHaveLength(6);
    expect(textRender).not.toHaveBeenCalled();
    await act(async () => VIEW_SHOWCASE_SEQUENCE[1].cleanup(useGameStore.getState()));
    pool.update();
    expect(labels('NumberLabel:')).toHaveLength(0);
    expect(pool.group.children.every(o => o.count === 0)).toBe(true);
    // An explicit retry reuses the atlas without blanking the surrounding scene.
    await act(async () => VIEW_SHOWCASE_SEQUENCE[0].apply(useGameStore.getState()));
    expect(labels('GridLabel:')).toEqual(ids());
    expect(textRender).not.toHaveBeenCalled();
    expect(store.getState().scene).toBe(scene);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
