import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { makeCubies } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/coordinates.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { runActiveStickers, activateSticker } from '../3d/StickerAnimationManager.js';
import { createTileFrameHost, adoptTileFrames } from '../3d/tileFrames.js';
import { pressTile, tickWormPress, resetWormPress } from '../worm/tilePressBridge.js';
import { healBurstMap } from '../3d/healBurstBridge.js';
import { PRESS_DEPTH } from '../worm/tilePressVisual.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

// A WORM tile at rest mounts no scene objects (tileFrames.js): the batches draw it
// from detached frames whose parent is the cubie's content group. It mounts its
// subtree for a flip or a heal and goes back to rest when they have played.
describe('resting WORM tiles', () => {
  let before, context, root, store, time, StickerPlane;
  const SIZE = 5, POS = [0, 0, 0.51], ROT = [0, 0, 0], KEY = '2,2,4,PZ';
  const gl = canvas => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() });

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    before = useGameStore.getState();
    context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} })
    });
    ({ default: StickerPlane } = await import('../3d/StickerPlane.jsx'));
    const canvas = document.createElement('canvas');
    root = createRoot(canvas);
    root.configure({ gl: gl(canvas), frameloop: 'never', size: { width: 1280, height: 800 } });
    time = 0;
    resetWormPress();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    context.mockRestore();
    resetWormPress();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  const setup = (styles = null) => {
    const cubies = makeCubies(SIZE);
    const settings = { ...before.settings, flipPads: 'off', soundEnabled: false, hapticsEnabled: false,
      ...(styles ? { manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, styles])) } : {}) };
    useGameStore.setState({ size: SIZE, cubies, wormHealerMode: true, chaosLevel: 0, settings });
    return cubies[2][2][4].stickers.PZ;
  };
  // A stand-in for Cubie: its content group, turned off the axes, adopts the frames.
  const host = createTileFrameHost();
  let content = null;
  const render = meta => act(async () => {
    store = root.render(<StickerInstanceProvider>
      <group position={[0.4, -0.2, 0.1]} rotation={[0.2, 0.5, 0]} ref={node => { content = node; adoptTileFrames(host, node); }}>
        <StickerPlane meta={meta} pos={POS} rot={ROT} mode="classic" faceSize={SIZE} surfaceTileKey={KEY} frameHost={host} />
      </group>
    </StickerInstanceProvider>);
  });
  const frame = () => act(async () => {
    runActiveStickers({ clock: { elapsedTime: time } }, 1 / 60);
    store.getState().advance(time += 1 / 60);
  });
  // The frame loop asks for a re-render outside the frame (a zero-delay timer).
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const scene = () => store.getState().scene;
  const batch = name => scene().getObjectByName(`TileSurfaceBatch:${name}`);
  const drawn = name => { const mesh = batch(name); return mesh?.visible ? mesh.count : 0; };
  // Where a tile at `pos`/`rot` would be, built from real groups.
  const expected = (z = 0, shrink = 1) => {
    content.updateWorldMatrix(true, false);
    const tile = new THREE.Object3D(), front = new THREE.Object3D();
    tile.position.fromArray(POS); tile.rotation.fromArray(ROT); front.position.z = z; front.scale.set(shrink, shrink, 1);
    tile.updateMatrix(); front.updateMatrix();
    return new THREE.Matrix4().multiplyMatrices(content.matrixWorld, tile.matrix).multiply(front.matrix);
  };
  const plainFront = () => {
    const mesh = scene().getObjectByName('StickerInstanceMesh'), out = new THREE.Matrix4();
    mesh.getMatrixAt(0, out);
    return out;
  };
  const expectMatrix = (actual, wanted) => actual.elements.forEach((value, i) => expect(value).toBeCloseTo(wanted.elements[i], 6));

  it('mounts nothing and is drawn by the batches, following its cubie without a render', async () => {
    const meta = setup();
    await render(meta); await frame();
    expect(content.children).toHaveLength(0);
    expectMatrix(plainFront(), expected());
    expect(drawn('sticker-antipodal-back')).toBe(1);
    expect(drawn('tile-border')).toBe(1);
    expect(drawn('tile-footprint')).toBe(0);
    // A slice turn moves the cubie; the batches follow through the frames' parent.
    content.rotation.y += 0.7;
    await frame();
    expectMatrix(plainFront(), expected());
  });

  it('draws a styled tile at rest from its frame too', async () => {
    setup('eyeball');
    const meta = useGameStore.getState().cubies[2][2][4].stickers.PZ;
    await render(meta); await frame();
    expect(content.children).toHaveLength(0);
    expect(drawn('sticker-front')).toBe(1);
    const front = batch('sticker-front'), out = new THREE.Matrix4();
    front.getMatrixAt(0, out); out.premultiply(front.matrixWorld);
    expectMatrix(out, expected());
  });

  it('lights its footprint as one decal instance and sinks under the worm, still mounting nothing', async () => {
    const meta = setup();
    await render(meta); await frame();
    const gridId = getManifoldGridId(meta, SIZE);
    for (let i = 0; i < 30; i++) { pressTile(KEY, 1); tickWormPress(1 / 60); activateSticker(gridId); await frame(); }
    expect(content.children).toHaveLength(0);
    expect(drawn('tile-footprint')).toBe(1);
    const press = batch('tile-footprint').geometry.attributes.aInstanceData.getX(0);
    expect(press).toBeGreaterThan(0.8);
    // The sticker sinks and narrows with the press, as its inner group did.
    expectMatrix(plainFront(), expected(-press * PRESS_DEPTH, 1 - press * 0.2));
    // Released: the square goes out on the first frame, the tile springs back flat.
    for (let i = 0; i < 120; i++) { tickWormPress(1 / 60); await frame(); }
    expect(drawn('tile-footprint')).toBe(0);
    expectMatrix(plainFront(), expected());
  });

  it('mounts its subtree for a flip and rests again once the heal has played', async () => {
    const home = setup();
    await render(home); await frame();
    expect(content.children).toHaveLength(0);
    const flipped = { ...home, curr: ANTIPODAL_COLOR[home.curr], flips: 1 };
    await render(flipped); await frame();
    expect(content.children.length).toBeGreaterThan(0);
    expect(drawn('FlipPortal')).toBe(1);
    for (let i = 0; i < 90; i++) await frame();
    expect(content.children.length).toBeGreaterThan(0);
    // Healed home: the flip plays back on the mounted tile, then it goes to rest.
    await render({ ...home, flips: 0 }); await frame();
    expect(content.children.length).toBeGreaterThan(0);
    for (let i = 0; i < 150; i++) await frame();
    await flush();
    expect(content.children).toHaveLength(0);
    expect(drawn('FlipPortal')).toBe(0);
    expectMatrix(plainFront(), expected());
  });

  it('mounts its seal for a heal cue that reaches it at rest, then rests again', async () => {
    const meta = setup();
    await render(meta); await frame();
    const gridId = getManifoldGridId(meta, SIZE);
    healBurstMap.set(gridId, 1);
    activateSticker(gridId);
    await frame(); await flush(); await frame();
    let seal = null;
    content.traverse(o => { if (o.material?.uniforms?.uHealProgress) seal = o; });
    expect(seal?.visible).toBe(true);
    expect(healBurstMap.has(gridId)).toBe(false);
    for (let i = 0; i < 90; i++) await frame();
    await flush();
    expect(content.children).toHaveLength(0);
  });
});
