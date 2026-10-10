import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { ANTIPODAL_COLOR, FLIP_CAP } from '../utils/constants.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { getFlipPortalGeometry, getFlipPortalMaterial, flipPortalData, PORTAL_OPEN_DELAY, resetFlipPortalOpenings } from '../3d/flipPortal.js';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { createExteriorPortals } from '../3d/exteriorPortals.js';
import { burrowBridge } from '../worm/burrowBridge.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

it.each([3, 15])('shares Flip Cube portals in size-%s Worm, through burrows, turns and healing', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), oldBurrow = burrowBridge.current, oldTime = sharedUniforms.time.value;
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, clearRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const settings = { ...before.settings, reducedMotion: false, biomeMode: { enabled: false }, colorScheme: 'classic',
    manifoldStyles: {}, flipPads: 'full', soundEnabled: false, hapticsEnabled: false };
  useGameStore.setState({ size, wormHealerMode: true, wormPaused: false, chaosLevel: 0, faceTextures: {}, settings });
  const colors = resolveColors(settings), base = makeCubies(size)[0][0][size - 1].stickers.PZ;
  let meta = { ...base, flips: 1, curr: ANTIPODAL_COLOR[base.orig] };
  const id = getManifoldGridId(meta, size), pair = { openness: 1, phase: 'open' };
  burrowBridge.current = { pairs: new Map(), bySticker: new Map([[id, pair]]) };
  const exterior = createExteriorPortals();
  resetFlipPortalOpenings(); sharedUniforms.time.value = 10;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  await root.configure({ gl, frameloop: 'never', size: { width: 430, height: 800 } });
  let store, time = 0;
  const render = async (key = 'slot', mode = 'classic') => act(async () => {
    store = root.render(<StickerInstanceProvider exteriorPortals={exterior}>
      <StickerPlane key={key} meta={meta} pos={[0, 0, .51]} mode={mode} faceSize={size} />
    </StickerInstanceProvider>);
  });
  const frame = async () => act(async () => {
    runActiveStickers({ ...store.getState(), clock: { elapsedTime: time += 1 / 60 } }, 1 / 60);
    store.getState().advance(time);
  });
  const portalBatches = () => {
    const found = [];
    store.getState().scene.traverse(o => { if (o.isInstancedMesh && o.name === 'TileSurfaceBatch:FlipPortal' && o.count) found.push(o); });
    return found;
  };
  try {
    await render(); await frame();
    const scene = store.getState().scene, batch = portalBatches()[0];
    expect(portalBatches()).toHaveLength(1);
    expect(batch.count).toBe(1);
    expect(batch.geometry.attributes.position).toBe(getFlipPortalGeometry().attributes.position);
    expect(batch.material).toBe(getFlipPortalMaterial());
    const seed = batch.geometry.attributes.aInstanceSeed.array[0];
    expect(seed).toBeCloseTo(10 + PORTAL_OPEN_DELAY);
    expect(Array.from(batch.geometry.attributes.aInstanceData.array.slice(0, 4))).toEqual(
      flipPortalData(colors[base.orig], 1, FLIP_CAP).map(Math.fround));
    expect(scene.getObjectByName('flipped-tile-border')).toBeDefined();
    // The exact portal program retains the bore that clears traversal/death mouths.
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    batch.material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('aInstanceSeed');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance = pE');
    expect(shader.fragmentShader).toContain('portalDistance');
    expect(shader.uniforms.uExteriorOpen).toBe(exterior.uniforms.uExteriorOpen);
    const forbidden = ['uIntensity', 'uLens'];
    scene.traverse(o => { if (o.material?.uniforms) for (const name of forbidden) expect(o.material.uniforms[name]).toBeUndefined(); });
    // Below-surface burrows suppress the entire face until their mouth opens.
    pair.openness = 0; await frame(); expect(portalBatches()).toHaveLength(0);
    pair.openness = 1; await frame(); expect(portalBatches()).toHaveLength(1);
    // A remount and a view change must not replay an already-open portal.
    sharedUniforms.time.value = 20;
    await render('turned-slot', 'glass'); await frame();
    expect(portalBatches()[0].geometry.attributes.aInstanceSeed.array[0]).toBe(seed);
    // Numbers retains its white numbered surface, just as Flip Cube does.
    await render('turned-slot', 'sudokube'); await frame(); expect(portalBatches()).toHaveLength(0);
    await render('turned-slot'); await frame(); expect(portalBatches()[0].geometry.attributes.aInstanceSeed.array[0]).toBe(seed);
    // Healing retires the face; the next count-one flip pops open afresh.
    meta = { ...base, flips: 0, curr: base.orig };
    await render('turned-slot'); await frame(); expect(portalBatches()).toHaveLength(0);
    sharedUniforms.time.value = 30;
    meta = { ...base, flips: 1, curr: ANTIPODAL_COLOR[base.orig] };
    await render('turned-slot'); await frame();
    expect(portalBatches()[0].geometry.attributes.aInstanceSeed.array[0]).toBeCloseTo(30 + PORTAL_OPEN_DELAY);
    await act(async () => useGameStore.setState({ wormHealerMode: false })); await frame();
    expect(portalBatches()[0].material).toBe(batch.material);
    meta = { ...meta, flips: FLIP_CAP };
    await render('turned-slot'); await frame(); expect(portalBatches()).toHaveLength(0);
  } finally {
    await act(async () => root.unmount()); exterior.dispose(); resetFlipPortalOpenings();
    useGameStore.setState(before, true); burrowBridge.current = oldBurrow; sharedUniforms.time.value = oldTime;
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
