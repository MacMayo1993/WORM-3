import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import MenuPaperBackdrop from '../3d/MenuPaperBackdrop.jsx';
import { INTRO_PAPER_COLORS, introPaperTintInto } from '../components/intro/introPaper.js';

extend(THREE);
it('updates the existing backdrop uniform on intro time, replay and reduced-motion changes', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let reduced = false, changed;
  const media = { get matches() { return reduced; }, addEventListener: (_, fn) => { changed = fn; }, removeEventListener: vi.fn() };
  const oldMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn(() => media);
  const canvas = document.createElement('canvas'), root = createRoot(canvas);
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  await root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  let store, frames = 0, firstUniform;
  try {
    for (const time of [0, 2, 4, 6, 8, 10, 12, 0]) {
      await act(async () => { store = root.render(<MenuPaperBackdrop opening openingTime={time} />); });
      store.getState().advance(++frames / 60);
      const scene = store.getState().scene;
      expect(scene.children).toHaveLength(1);
      const material = scene.children[0].material;
      expect(material.defines).toEqual({ OPENING: 1 });
      const tint = material.uniforms.uOpeningTint;
      firstUniform ??= tint;
      expect(tint).toBe(firstUniform);
      expect(tint.value).toMatchObject(introPaperTintInto({}, time));
    }
    reduced = true;
    act(() => changed());
    store.getState().advance(++frames / 60);
    expect(firstUniform.value).toMatchObject(introPaperTintInto({}, 0, true));
    expect(INTRO_PAPER_COLORS).toHaveLength(6);
  } finally {
    await act(async () => root.unmount());
    window.matchMedia = oldMatchMedia;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
