import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, it, expect, vi, afterEach } from 'vitest';
import IntroScene from '../components/intro/IntroScene.jsx';
import { introDive, introOutro, DIVE_SINK, DIVE_CLOSE } from '../components/intro/introOutro.js';
import { TWIN_OF, createTaps, tapTile, tapFlip, TAP_UNTIL, TWIN_DELAY, TAP_FLIP_TIME } from '../components/intro/introTouch.js';
import { TILES } from '../components/intro/introTopology.js';
import { INTRO_FINISH, DISSOLVE_START } from '../components/intro/introTiming.js';

vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
extend(THREE);

describe('the dive', () => {
  it('opens the portal, hops, then sinks the cube all the way through', () => {
    expect(introDive(DISSOLVE_START - 0.2).portal).toBe(0);
    const sinking = introDive((DIVE_SINK[0] + DIVE_SINK[1]) / 2);
    expect(sinking.portal).toBe(1);
    expect(sinking.lift).toBeLessThan(0);
    expect(sinking.narrow).toBeLessThan(1);
    const through = introDive(DIVE_SINK[1]);
    expect(through.gone).toBe(true);
    // The portal waits under the last phrase and shuts as the intro ends.
    expect(introDive(DIVE_CLOSE[0] - 0.1).portal).toBe(1);
    expect(introDive(INTRO_FINISH).portal).toBe(0);
  });

  it('keeps the dissolve for reduced motion: no portal, no movement', () => {
    for (const t of [9, 10, 12]) expect(introDive(t, true)).toEqual({ portal: 0, lift: 0, spin: 0, narrow: 1, sink: 0, gone: false });
  });

  it('sinks steadily, never bouncing back up', () => {
    let last = Infinity;
    for (let t = DIVE_SINK[0]; t <= DIVE_SINK[1]; t += 0.05) {
      const { lift } = introDive(t);
      expect(lift).toBeLessThanOrEqual(last + 1e-9);
      last = lift;
    }
  });
});

describe('tapping the opening cube', () => {
  it('pairs every sticker with its antipode: the opposite cell, the opposite face', () => {
    TILES.forEach((tile, i) => {
      const twin = TILES[TWIN_OF[i]];
      expect(twin.position).toEqual(tile.position.map(v => -v || 0));
      expect(twin.faceIndex).toBe(tile.faceIndex ^ 1);
      expect(TWIN_OF[TWIN_OF[i]]).toBe(i);
    });
  });

  it('flips the tapped tile, then its twin a beat later, and stops taking taps at the ending', () => {
    const taps = createTaps();
    expect(tapTile(taps, 0, 4)).toEqual([0, TWIN_OF[0]]);
    // Past the tapped tile's midpoint, before the twin's.
    const mid = 4 + TAP_FLIP_TIME * 0.6;
    expect(tapFlip(taps[0], mid).halves).toBe(1);
    expect(tapFlip(taps[TWIN_OF[0]], mid).halves).toBe(0);
    expect(tapFlip(taps[TWIN_OF[0]], 4 + TWIN_DELAY + TAP_FLIP_TIME).halves).toBe(1);
    expect(tapTile(taps, 1, TAP_UNTIL)).toEqual([]);
  });

  it('flips the colour at once, without the turn, for reduced motion', () => {
    const taps = createTaps();
    tapTile(taps, 3, 2);
    expect(tapFlip(taps[3], 2, true)).toMatchObject({ angle: 0, halves: 1 });
  });
});

describe('IntroScene', () => {
  let root;
  afterEach(() => { root?.unmount(); });
  async function mount(time, reducedMotion = false) {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const canvas = document.createElement('canvas');
    root = createRoot(canvas);
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
      xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
      renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    await root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
    let store;
    const render = async (t) => {
      await act(async () => { store = root.render(<IntroScene time={t} reducedMotion={reducedMotion} />); });
      store.getState().advance(t);
      return store.getState().scene;
    };
    return { render, scene: await render(time) };
  }
  const find = (scene, test) => { let hit = null; scene.traverse(o => { if (!hit && test(o)) hit = o; }); return hit; };
  const colorOf = (mesh, i) => Array.from(mesh.instanceColor.array.slice(i * 3, i * 3 + 3));

  it('flips a tapped sticker and its twin to their antipodal colours', async () => {
    const at = 7.6; // the shut cube under the title card
    const { render, scene } = await mount(at);
    const stickers = find(scene, o => o.isInstancedMesh && o.count === TILES.length && o.__r3f?.handlers?.onPointerDown);
    expect(stickers).toBeTruthy();
    const i = TILES.findIndex(tile => tile.face.axis === 2 && tile.face.sign === 1);
    const twin = TWIN_OF[i];
    const before = [colorOf(stickers, i), colorOf(stickers, twin)];
    const stop = vi.fn();
    stickers.__r3f.handlers.onPointerDown({ instanceId: i, stopPropagation: stop });
    expect(stop).toHaveBeenCalled();
    await render(at + TWIN_DELAY + TAP_FLIP_TIME + 0.05);
    expect(colorOf(stickers, i)).not.toEqual(before[0]);
    expect(colorOf(stickers, twin)).not.toEqual(before[1]);
  });

  it('sinks the cube through an open portal at the ending, and hides it once through', async () => {
    const { render, scene } = await mount(DIVE_SINK[0] + 0.3);
    const disc = find(scene, o => o.name === 'IntroDivePortal');
    const mask = find(scene, o => o.name === 'IntroDiveMask');
    expect(disc.visible).toBe(true);
    expect(mask.visible).toBe(true);
    // The mask writes depth only, between the paper and the cube.
    expect(mask.material.colorWrite).toBe(false);
    expect(mask.renderOrder).toBeGreaterThan(-0.5);
    expect(mask.renderOrder).toBeLessThan(0);
    await render(DIVE_SINK[1] + 0.1);
    const cube = find(scene, o => o.isInstancedMesh && o.__r3f?.handlers?.onPointerDown)?.parent;
    expect(cube.visible).toBe(false);
    expect(disc.visible).toBe(true);
  });

  it('dissolves instead of diving for reduced motion', async () => {
    const t = DIVE_SINK[0] + 0.3;
    const { scene } = await mount(t, true);
    expect(find(scene, o => o.name === 'IntroDivePortal').visible).toBe(false);
    expect(introOutro(t, true).cube).toBeGreaterThan(0);
  });
});
