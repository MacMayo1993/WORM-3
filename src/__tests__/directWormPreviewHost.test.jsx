import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
const state = vi.hoisted(() => ({ frame: null, three: null }));
vi.mock('@react-three/fiber', () => ({ useThree: () => state.three, useFrame: fn => { state.frame = fn; } }));
vi.mock('../3d/WormPreviewRenderer.js', () => ({ drawDirectWormPreview: vi.fn() }));
import DirectWormPreviewHost from '../3d/DirectWormPreviewHost.jsx';
import { registerDirectWormPreview, unregisterDirectWormPreview } from '../3d/directWormPreview.js';
import { drawDirectWormPreview } from '../3d/WormPreviewRenderer.js';

it('restores canvas ownership and size through strict mount, adaptive resize and exit', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const original = document.createElement('div'), hero = document.createElement('div');
  const canvas = document.createElement('canvas'); original.append(canvas);
  hero.getBoundingClientRect = () => ({ width: 360, height: 360 });
  let ratio = 1; const size = new THREE.Vector2(900, 700);
  const gl = { domElement: canvas, getPixelRatio: () => ratio, setPixelRatio: v => { ratio = v; },
    getSize: v => v.copy(size), setSize: (w, h) => size.set(w, h), setViewport: vi.fn() };
  state.three = { gl, get: () => ({ size: { width: 900, height: 700 }, viewport: { dpr: 1 }, invalidate: vi.fn() }) };
  const root = createRoot(document.createElement('div'));
  const entry = registerDirectWormPreview(hero, { framing: 'character' });
  act(() => root.render(<React.StrictMode><DirectWormPreviewHost /></React.StrictMode>));
  expect(canvas.parentNode).toBe(hero); expect(size.x).toBe(360);
  size.set(900, 700); ratio = 0.5;
  act(() => state.frame({}, 1 / 60));
  expect(size.x).toBe(360); expect(drawDirectWormPreview).toHaveBeenCalledWith(gl, entry.opts, entry.age);
  act(() => unregisterDirectWormPreview(entry));
  expect(canvas.parentNode).toBe(original); expect(size.toArray()).toEqual([900, 700]);
  act(() => root.unmount());
  vi.unstubAllGlobals();
});
