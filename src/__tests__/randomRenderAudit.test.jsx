import React, { act, useLayoutEffect } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { useTileSurfaceInstances } from '../3d/TileSurfaceInstances.jsx';

import { pickCubeletViewStyle, LIGHT_CUBELET_VIEW_STYLES, PER_CUBELET_VIEW_STYLES } from '../3d/cubeViewStyles.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('../utils/device.js', () => ({ get isMobile() { return device.mobile; }, prefersReducedMotion: () => false }));
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
const textRender = vi.hoisted(() => vi.fn(() => null));
vi.mock('@react-three/drei', async original => ({ ...await original(), Text: textRender }));
extend(THREE);

it.each([false, true])('keeps Random surfaces correct across remixes and turns (mobile=%s)', async mobile => {
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
  useGameStore.setState({ size, cubies: makeCubies(size), demoMode: true, demoStep: 'random-showcase',
    wormHealerMode: false, chaosLevel: 0, randomMode: true, hollowMode: false, mirrorMode: false,
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
    await act(async () => { store = root.render(<StickerInstanceProvider><Cube /></StickerInstanceProvider>); });
    const scene = store.getState().scene;
    for (let tick = 1; tick <= 24; tick++) {
      const styles = ['solid', 'carbonFiber', 'hexGrid', 'metallic', 'matte', 'glossy'];
      const manifoldStyles = Object.fromEntries([1, 2, 3, 4, 5, 6].map(face => [face, styles[(face + tick) % styles.length]]));
      await act(async () => useGameStore.setState(s => ({randomStyleTick: tick,
        cubies: rotateSliceCubies(s.cubies, size, ['row', 'col', 'depth'][tick % 3], tick % 3, tick % 2 ? 1 : -1),
        settings: {...s.settings, colorScheme: tick % 2 ? 'classic' : 'pastel',
          manifoldStyles: manifoldStyles}
      })));
      await act(async () => store.getState().advance(tick / 60));
      pool.update();
      scene.updateMatrixWorld(true);
      const positions = new Set();
      const addPosition = matrix => {
        const e = matrix.elements;
        if (Math.hypot(e[0], e[1], e[2]) < 1e-6) return;
        const key = e.slice(12, 15).map(n => n.toFixed(4)).join(',');
        expect(positions.has(key), `overlapping front at ${key}, tick ${tick}`).toBe(false);
        positions.add(key);
      };
      const batch = scene.getObjectByName('StickerInstanceMesh');
      const matrix = new THREE.Matrix4();
      for (let slot = 0; slot < batch.count; slot++) { batch.getMatrixAt(slot, matrix); addPosition(matrix); }

      const colors = resolveColors(useGameStore.getState().settings);
      scene.traverse(mesh => {
        if (mesh.name !== 'sticker-front') return;
        addPosition(mesh.matrixWorld);
        expect(mesh.geometry.type).toBe('ExtrudeGeometry');
        expect(mesh.geometry.attributes.position.count).toBeGreaterThan(4);
        // All front surfaces must retain the requested finish after another tile
        // leaves the shared shader or geometry during the same commit.
        const mat = mesh.material;
        if (mat.isShaderMaterial && mat.transparent !== true) {
          expect(styles.map(style => getTileStyleMaterial(style, '#ffffff').fragmentShader)).toContain(mat.fragmentShader);
          expect(Object.values(colors).map(c => new THREE.Color(c).getHexString())).toContain(mat.uniforms.baseColor.value.getHexString());
        }
      });
      let expectedFaces = 0, expectedNumbers = 0;
      const expectedGrid = [];
      for (const cubie of useGameStore.getState().cubies.flat(2)) {
        const stickers = Object.values(cubie.stickers), home = stickers[0]?.origPos ?? cubie;
        const view = pickCubeletViewStyle(home.x, home.y, home.z, tick,
          mobile ? LIGHT_CUBELET_VIEW_STYLES : PER_CUBELET_VIEW_STYLES);
        if (view !== 'wireframe') expectedFaces += stickers.length;
        if (view === 'sudokube') expectedNumbers += stickers.length;
        if (view === 'grid') expectedGrid.push(...stickers.map(sticker => getManifoldGridId(sticker, size)));
      }
      expect(positions.size).toBe(expectedFaces);
      const grid = [], numbers = [];
      scene.traverse(object => {
        if (object.name.startsWith('GridLabel:')) grid.push(object.name.slice(10));
        if (object.name.startsWith('NumberLabel:')) numbers.push(object.name);
      });
      expect(grid.sort()).toEqual(expectedGrid.sort());
      expect(numbers).toHaveLength(expectedNumbers);
    }
    expect(textRender).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
