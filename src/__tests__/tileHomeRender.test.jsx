import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider } from '../3d/PadSprings.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { applyTileMove } from '../game/tileOrientation.js';
import { recordHomeAlignments, clearHomeAlignments, HOME_ALIGNMENT_MS } from '../3d/tileHomeAlignment.js';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

it('holds the transported pose through a slow commit, animates both faces, and settles before a queued move', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  useGameStore.setState({ size: 3, animState: null, wormHealerMode: false,
    settings: { ...before.settings, manifoldStyles: { 1: 'eyeball', 4: 'eyeball' }, flipPads: 'off' } });
  resetLiveRotation();
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  const home = makeCubies(3);
  const pos = [0, 0, 0.51], rot = [0, 0, 0];
  let store;
  const render = async meta => act(async () => {
    store = root.render(<PadProvider><StickerPlane meta={meta} pos={pos} rot={rot} mode="classic" faceRow={1} faceCol={1} faceSize={3} /></PadProvider>);
  });
  try {
    await render(home[1][1][2].stickers.PZ);
    const result = recordHomeAlignments(applyTileMove(home, 3, { axis: 'depth', sliceIndex: 2, dir: 1 }));
    clock.mockReturnValue(1000 + HOME_ALIGNMENT_MS * 10); // slow React commit
    await render(result.cubies[1][1][2].stickers.PZ);
    const front = store.getState().scene.getObjectByName('sticker-front');
    const back = store.getState().scene.getObjectByName('sticker-antipodal-back');
    expect(front.parent.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(back.parent.rotation.z).toBeCloseTo(-Math.PI / 2);
    const frontScale = front.parent.scale.clone();
    act(() => runActiveStickers({ clock: { elapsedTime: 10 } }, 0.016));
    expect(front.parent.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(back.parent.rotation.z).toBeCloseTo(-Math.PI / 2);
    act(() => runActiveStickers({ clock: { elapsedTime: 10 + HOME_ALIGNMENT_MS / 2000 } }, 0.11));
    expect(front.parent.rotation.z).toBeCloseTo(Math.PI / 16);
    expect(back.parent.rotation.z).toBeCloseTo(-Math.PI / 16);
    act(() => useGameStore.setState({ animState: { axis: 'row', sliceIndex: 2, dir: 1 } }));
    act(() => runActiveStickers({ clock: { elapsedTime: 10.15 } }, 0.016));
    expect(front.parent.rotation.z).toBe(0);
    expect(back.parent.rotation.z).toBeCloseTo(0);
    expect(front.parent.scale).toEqual(frontScale);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    clearHomeAlignments(); resetLiveRotation(); context.mockRestore(); clock.mockRestore();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
