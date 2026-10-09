import React, { act, useLayoutEffect } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { DEMO_LEVEL_CONFIGS } from '../components/screens/DemoFlowController.jsx';
import { TileSurfaceProvider, useTileSurfaceInstances } from '../3d/TileSurfaceInstances.jsx';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('../utils/device.js', () => ({ get isMobile() { return device.mobile; }, prefersReducedMotion: () => false }));
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
const textRender = vi.hoisted(() => vi.fn(() => null));
vi.mock('@react-three/drei', async original => ({ ...await original(), Text: textRender }));
extend(THREE);

it.each([false, true])('renders demo Chaos through the first deaths and final pair without asynchronous fonts (mobile=%s)', async mobile => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  device.mobile = mobile;
  textRender.mockClear();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, clearRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  });
  const before = useGameStore.getState();
  const { default: Cubie } = await import('../3d/Cubie.jsx');
  const config = DEMO_LEVEL_CONFIGS['chaos-forecast'];
  const size = config.cubeSize;
  useGameStore.setState({ size, cubies: makeCubies(size), demoMode: true, demoStep: 'chaos-forecast',
    wormHealerMode: false, chaosLevel: 0, randomMode: false, hollowMode: false, mirrorMode: false,
    visualMode: 'classic', perfReducedFX: false, explosionT: 0, faceTextures: {},
    disparityFlipCap: config.flipCap, disparityDeathByGridId: {}, disparityWinner: null,
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
    let store, time = 0;
    await act(async () => { store = root.render(<TileSurfaceProvider><Cube /></TileSurfaceProvider>); });
    const scene = store.getState().scene;
    const labels = () => { const values = []; scene.traverse(o => { if (o.name.startsWith('CanvasLabel:')) values.push(o.name.slice(12)); }); return values; };
    const settle = async () => {
      await act(async () => {
        for (let i = 0; i < 90; i++) {
          time += 1 / 60;
          runActiveStickers({ ...store.getState(), clock: { elapsedTime: time } }, 1 / 60);
          store.getState().advance(time);
        }
      });
      pool.update();
    };
    const damage = async (flips, survives = () => false) => {
      const cubies = useGameStore.getState().cubies.map(plane => plane.map(row => row.map(c => ({ ...c,
        stickers: Object.fromEntries(Object.entries(c.stickers).map(([dir, st]) => [dir,
          survives(st) ? st : { ...st, flips, curr: flips % 2 ? ({ 1: 4, 4: 1, 2: 5, 5: 2, 3: 6, 6: 3 })[st.orig] : st.orig }]))
      }))));
      await act(async () => useGameStore.setState({ cubies }));
      await settle();
    };
    // GO raises Chaos pads, then the first flips occur, before any tombstone.
    await act(async () => useGameStore.getState().setChaosLevel(config.disparityLevel));
    await damage(1);
    await damage(config.flipCap - 1);
    expect(labels()).toHaveLength(0);
    expect(textRender).not.toHaveBeenCalled();
    // The first deaths used to mount three Troika Text objects per tile here.
    const pair = ['M1-005', 'M4-005'];
    const deaths = Object.fromEntries(useGameStore.getState().cubies.flat(2).flatMap(c => Object.values(c.stickers))
      .map(st => getManifoldGridId(st, size)).filter(id => !pair.includes(id)).map((id, i) => [id, { rank: i + 1 }]));
    await act(async () => useGameStore.setState({ disparityDeathByGridId: deaths }));
    await damage(config.flipCap, st => pair.includes(getManifoldGridId(st, size)));
    expect(textRender).not.toHaveBeenCalled();
    expect(labels().filter(value => value === 'RIP')).toHaveLength(52);
    expect(labels().filter(value => value.startsWith('M')).sort()).toEqual(Object.keys(deaths).sort());
    expect(labels()).toContain('#52');
    expect(textRender).not.toHaveBeenCalled();
    const batches = pool.group.children.filter(o => o.count > 0 && o.material.map?.isCanvasTexture);
    // Epitaphs are engraved on the plaque and depth-tested like the stone, not drawn
    // over the cube from behind it.
    expect(batches.every(o => o.material.depthTest === true)).toBe(true);
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.length).toBeLessThanOrEqual(17);
    // Every grave on the cube is one instanced draw of the shared tombstone.
    const graves = pool.group.children.filter(o => o.count > 0 && o.name === 'TileSurfaceBatch:Tombstone');
    expect(graves).toHaveLength(1);
    expect(graves[0].count).toBe(52);
    // Every grave carries its own animation seed, not one hashed from its moving matrix.
    const seeds = graves[0].geometry.attributes.aInstanceSeed.array.slice(0, 52);
    expect(new Set(seeds).size).toBeGreaterThan(40);
    await act(async () => useGameStore.getState().setDisparityWinner({ pair }));
    await settle();
    expect(store.getState().scene).toBe(scene);
    expect(textRender).not.toHaveBeenCalled();
    // A fresh round clears the epitaphs. Higher live-round flip caps also use
    // synchronous tally labels, so the font path cannot reappear at flip seven.
    await act(async () => useGameStore.setState({ cubies: makeCubies(size), disparityWinner: null,
      disparityDeathByGridId: {}, disparityFlipCap: 8 }));
    await damage(7);
    // White original stickers suppress tallies after an odd flip (9 tiles).
    expect(labels()).toHaveLength(45);
    expect(labels().every(value => value === '×7')).toBe(true);
    expect(textRender).not.toHaveBeenCalled();
    // Deaths without a ledger rank keep both RIP and the piece address.
    await damage(8);
    expect(labels().filter(value => value === 'RIP')).toHaveLength(54);
    expect(labels().filter(value => value.startsWith('#'))).toHaveLength(0);
    expect(textRender).not.toHaveBeenCalled();
    await act(async () => useGameStore.setState({ cubies: makeCubies(size), chaosLevel: 0 }));
    await settle();
    expect(labels()).toHaveLength(0);
    expect(pool.group.children.filter(o => o.material.map?.isCanvasTexture).every(o => o.count === 0)).toBe(true);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
