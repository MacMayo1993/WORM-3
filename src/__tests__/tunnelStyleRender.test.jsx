import { tunnelState } from '../worm/tunnelProgressBridge.js';
import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import VoidCore from '../3d/VoidCore.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import { TunnelInteriorView } from '../worm/healerWorm/TunnelInteriorView.jsx';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { FACE_COLORS } from '../utils/constants.js';
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));

extend(THREE);

it('renders a solid core, styled halves, and matching live antipodal backs inside and outside transit', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const bridge = { ...tunnelState };
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  let cubies = makeCubies(3);
  cubies = flipStickerPair(cubies, 3, 0, 1, 1, 'NX', buildManifoldGridMap(cubies, 3));
  useGameStore.setState({ cubies, size: 3, wormHealerMode: true, wormAlive: true, wormPaused: false, wormPhase: 'tunnel',
    demoMode: false, chaosLevel: 0, explosionT: 0, visualMode: 'solid', faceTextures: {},
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: false, flipPads: 'off', biomeMode: { enabled: false },
      manifoldStyles: { 5: 'checkerboard', 2: 'circuit' } } });
  const refs = [new THREE.Object3D(), new THREE.Object3D()];
  refs[0].position.set(-2, 0, 0); refs[1].position.set(2, 0, 0);
  const worm = { phase: { current: 'tunnel' } };
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas); root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 1] } });
  const draw = (style1, style2, raisedPresentation = false) => <>
    <VoidCore />
    <MobiusTunnel meshIdx1={0} meshIdx2={1} dirKey1="NX" dirKey2="PX" cubieRefs={refs} flips={1}
      color1="#3973e8" color2="#38c875" style1={style1} style2={style2} gridId1="a" gridId2="b" tunnelId="a|b" raisedPresentation={raisedPresentation} />
    <TunnelInteriorView worm={worm} size={3} />
    <PadProvider><StickerPlane meta={cubies[0][1][1].stickers.NX} pos={[0, 0, .52]} faceSize={3} /></PadProvider>
  </>;
  try {
    let store, time = 0;
    await act(async () => { store = root.render(draw('checkerboard', 'circuit')); });
    const frame = () => store.getState().advance(time += 1 / 60);
    frame();
    const scene = store.getState().scene;
    const body = scene.getObjectByName('antipodal-core-body');
    expect(body.material.transparent).toBe(false);
    expect(body.material.depthWrite).toBe(true);
    const halves = [0, 1].map(i => scene.getObjectByName(`tunnel-styled-half-${i}`));
    expect(halves.map(m => m.material.name)).toEqual(['tunnel-tile-0-checkerboard', 'tunnel-tile-1-circuit']);
    expect(halves[0].geometry).toBe(halves[1].geometry);
    expect(halves[0].geometry.attributes.normal.count).toBe(halves[0].geometry.attributes.position.count);
    expect(halves[0].material.uniforms.uPatternRepeats.value).toBeGreaterThan(5);
    expect(halves[0].material.uniforms.baseColor.value.getHexString()).toBe('3973e8');
    expect(halves[1].material.uniforms.baseColor.value.getHexString()).toBe('38c875');
    const cached = getTileStyleMaterial('circuit', FACE_COLORS[2], false, null, FACE_COLORS[5]);
    expect(cached.side).toBe(THREE.FrontSide); // Band customization must not mutate tiles.
    const back = scene.getObjectByName('sticker-antipodal-back');
    const inner = scene.getObjectByName('tunnel-interior-0-1-1-NX');
    expect(back.material).toBe(cached);
    expect(inner.material).toBe(cached);
    expect(inner.visible).toBe(true);

    tunnelState.active = true; tunnelState.activeTunnelId = 'a|b'; frame();
    const clearance = halves[0].material.uniforms.uCameraClearance;
    expect(clearance.value).toBe(1);
    for (const part of halves[0].parent.children) {
      expect(part.material.uniforms.uCameraClearance).toBe(clearance);
    }
    const intact = halves[0].geometry.attributes.position.version;
    tunnelState.active = false; frame();
    expect(clearance.value).toBe(0);
    expect(halves[0].geometry.attributes.position.version).toBe(intact);

    const sharedTime = halves[0].material.uniforms.time;
    expect(sharedTime).toBe(halves[1].material.uniforms.time);
    const held = sharedTime.value;
    await act(async () => useGameStore.setState({ wormPaused: true })); frame();
    expect(sharedTime.value).toBe(held);
    const version = halves[0].geometry.attributes.position.version;
    const disposed = vi.spyOn(halves[0].material, 'dispose');
    await act(async () => {
      useGameStore.setState({ settings: { ...useGameStore.getState().settings, manifoldStyles: { 5: 'polkaDots', 2: 'wood' } } });
      root.render(draw('polkaDots', 'wood'));
    }); frame();
    expect(disposed).toHaveBeenCalledOnce();
    expect(halves[0].geometry.attributes.position.version).toBe(version);
    expect(back.material).toBe(getTileStyleMaterial('wood', FACE_COLORS[2], false, null, FACE_COLORS[5]));
    expect(inner.material).toBe(back.material);
    expect(scene.getObjectByName('tunnel-styled-half-0').material.name).toBe('tunnel-tile-0-polkaDots');

    cubies = flipStickerPair(cubies, 3, 0, 1, 1, 'NX', buildManifoldGridMap(cubies, 3));
    await act(async () => { useGameStore.setState({ cubies }); root.render(draw('wood', 'polkaDots')); }); frame();
    expect(back.material.uniforms.baseColor.value.getHexString()).toBe(FACE_COLORS[5].slice(1).toLowerCase());
    expect(inner.material).toBe(back.material); // Healing refreshes the current back during transit too.

    await act(async () => {
      useGameStore.setState({ wormHealerMode: false });
      root.render(draw('wood', 'polkaDots', true));
    }); frame();
    const raised = scene.getObjectByName('tunnel-styled-half-0');
    expect(raised.material.transparent).toBe(false);
    expect(raised.material.depthWrite).toBe(true);
    expect(raised.material.uniforms.uCameraClearance.value).toBe(0);
    expect(raised.material.uniforms.uRideMode.value).toBe(1); // FLIP CUBE keeps its raised, opaque bands too.
    const veil = scene.getObjectByName('tunnel-open-veil');
    expect(veil.material.transparent).toBe(true);
    expect(veil.material.depthWrite).toBe(false);
    expect(veil.material.uniforms.uTime).toBe(raised.material.uniforms.uTime);
    await act(async () => useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } }));
    const frozen = veil.material.uniforms.uTime.value;
    frame(); frame();
    expect(veil.material.uniforms.uTime.value).toBe(frozen);
    const disposedVeil = vi.spyOn(veil.geometry, 'dispose');
    await act(async () => useGameStore.setState({ perfReducedFX: true })); frame();
    expect(scene.getObjectByName('tunnel-open-veil')).toBeUndefined();
    expect(disposedVeil).toHaveBeenCalledOnce();
    expect(scene.getObjectByName('tunnel-styled-half-0').geometry).toBe(raised.geometry);
    await act(async () => useGameStore.setState({ perfReducedFX: false })); frame();
    expect(scene.getObjectByName('tunnel-open-veil').geometry.attributes.position.array.some(v => v !== 0)).toBe(true);
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    Object.assign(tunnelState, bridge);
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
