import React, { act, useLayoutEffect } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { storyAppearance } from '../worm/story/worlds.js';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { useTileSurfaceInstances } from '../3d/TileSurfaceInstances.jsx';
import { createExteriorPortals } from '../3d/exteriorPortals.js';
const device = vi.hoisted(() => ({ mobile: true }));
vi.mock('../utils/device.js', () => ({ get isMobile() { return device.mobile; }, prefersReducedMotion: () => false }));
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
const textRender = vi.hoisted(() => vi.fn(() => null));
vi.mock('@react-three/drei', async original => ({ ...await original(), Text: textRender }));
extend(THREE);

it.each([[13, 4, true, false], [29, 7, true, false], [38, 7, false, true]])(
  'batches Numbers level %s without starting font workers', async (level, size, mobile, reduced) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    device.mobile = mobile;
    textRender.mockClear();
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {}, clearRect() {}, fillText() {}, strokeText() {}, beginPath() {}, arc() {}, fill() {},
      createRadialGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }),
    });
    const { default: Cubie } = await import('../3d/Cubie.jsx');
    const before = useGameStore.getState(), cubies = makeCubies(size), portals = createExteriorPortals();
    useGameStore.setState({ size, cubies, wormHealerMode: true, randomMode: false, visualMode: 'sudokube',
      perfReducedFX: reduced, chaosLevel: 0, settings: { ...before.settings, ...storyAppearance(level, reduced) } });
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
      xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas);
    await root.configure({ gl, frameloop: 'never', size: { width: 400, height: 800 } });
    let pool, store;
    function Probe() {
      const current = useTileSurfaceInstances();
      useLayoutEffect(() => { pool = current; }, [current]);
      return null;
    }
    const half = (size - 1) / 2;
    try {
      await act(async () => { store = root.render(<StickerInstanceProvider exteriorPortals={portals}>
        <Probe />
        {cubies.flat(2).filter(c => [c.x, c.y, c.z].some(v => v === 0 || v === size - 1)).map(c =>
          <Cubie key={`${c.x},${c.y},${c.z}`} cubie={c} position={[c.x-half,c.y-half,c.z-half]} size={size} wormMode />)}
      </StickerInstanceProvider>); });
      const scene = store.getState().scene;
      portals.apply(scene);
      const objects = prefix => { const result = []; scene.traverse(o => { if (o.name.startsWith(prefix)) result.push(o); }); return result; };
      const labels = objects('NumberLabel:');
      expect(labels).toHaveLength(6 * size * size);
      for (let value = 1; value <= size * size; value++) {
        expect(labels.filter(o => o.name === `NumberLabel:${value}`)).toHaveLength(6);
      }
      expect(textRender).not.toHaveBeenCalled();
      expect(objects('sticker-front')).toHaveLength(0);
      expect(objects('sticker-antipodal-back').every(o => !o.isMesh)).toBe(true);
      expect(scene.getObjectByName('StickerInstanceMesh').count).toBe(6 * size * size);
      pool.update();
      const batches = pool.group.children.filter(o => o.name.startsWith('TileSurfaceBatch:NumberDigit:'));
      expect(batches).toHaveLength(10);
      expect(new Set(batches.map(o => o.material)).size).toBe(1);
      expect(batches.reduce((sum, o) => sum + o.count, 0)).toBe(
        6 * Array.from({ length: size * size }, (_, i) => String(i + 1).length).reduce((a, b) => a + b));
      expect(batches[0].material.userData.portalCutout).toBe(portals.uniforms);
      // Labels follow moving/raised/rotating stickers through the same live anchors.
      const anchor = objects('NumberDigit:1')[0], label = anchor.parent;
      for (const angle of [0.4, Math.PI / 2]) {
        label.parent.rotation.y = angle;
        label.parent.position.z += 0.5;
        pool.update();
        const batch = batches.find(o => o.name === 'TileSurfaceBatch:NumberDigit:1');
        const matrix = new THREE.Matrix4(); batch.getMatrixAt(0, matrix);
        anchor.updateWorldMatrix(true, false);
        matrix.elements.forEach((v, i) => expect(v).toBeCloseTo(anchor.matrixWorld.elements[i], 5));
      }
      // Switching away and back (a view powerup/retry) reuses the atlas and clears slots.
      const material = batches[0].material;
      await act(async () => useGameStore.setState({ visualMode: 'classic' }));
      pool.update(); expect(batches.every(o => o.count === 0)).toBe(true);
      await act(async () => useGameStore.setState({ visualMode: 'sudokube' }));
      pool.update(); expect(objects('NumberLabel:')).toHaveLength(6 * size * size);
      expect(batches[0].material).toBe(material);
      expect(textRender).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount()); portals.dispose(); useGameStore.setState(before);
      context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
  });
