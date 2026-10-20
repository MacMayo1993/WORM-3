import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { TileSurfaceProvider } from '../3d/TileSurfaceInstances.jsx';

vi.mock('../utils/device.js', () => ({ isMobile: false, prefersReducedMotion: () => false }));
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('@react-three/drei', async original => ({ ...await original(), Text: () => null }));
extend(THREE);

// A Flip Cube piece carrying a live flip wears a neon chassis. That accent must not
// take the tile's own view away: Sudoku keeps its number and gains the portal, and
// Grid keeps its address.
it.each(['sudokube', 'grid', 'wireframe'])('keeps a flipped %s tile labelled and portalled', async view => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, clearRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  });
  const before = useGameStore.getState();
  const { default: Cubie } = await import('../3d/Cubie.jsx');
  const size = 3;
  let cubies = makeCubies(size);
  cubies = flipStickerPair(cubies, size, 1, 1, 2, 'PZ', buildManifoldGridMap(cubies, size));
  useGameStore.setState({ size, cubies, demoMode: false, wormHealerMode: false, chaosLevel: 0, randomMode: false,
    hollowMode: false, mirrorMode: false, visualMode: view, perfReducedFX: false, explosionT: 0, faceTextures: {},
    settings: { ...before.settings, flipPads: 'full', biomeMode: { enabled: false },
      manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(face => [face, 'solid'])) } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  await root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  try {
    let store;
    await act(async () => { store = root.render(<TileSurfaceProvider>
      {cubies.flat(2).map(c => <Cubie key={`${c.x},${c.y},${c.z}`} cubie={c} position={[c.x - 1, c.y - 1, c.z - 1]} size={size} />)}
    </TileSurfaceProvider>); });
    const scene = store.getState().scene;
    const named = prefix => { const names = []; scene.traverse(o => { if (o.name.startsWith(prefix)) names.push(o.name.slice(prefix.length)); }); return names.sort(); };
    // Both members of the β-pair are flipped, and each opens its portal.
    expect(named('FlipPortal')).toHaveLength(2);
    if (view === 'sudokube') {
      expect(named('NumberLabel:')).toHaveLength(54);
      for (let value = 1; value <= 9; value++) expect(named('NumberLabel:').filter(v => v === String(value))).toHaveLength(6);
    }
    if (view === 'grid') {
      expect(named('GridLabel:')).toEqual(cubies.flat(2).flatMap(c => Object.values(c.stickers).map(s => getManifoldGridId(s, size))).sort());
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
