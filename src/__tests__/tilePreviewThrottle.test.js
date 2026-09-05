// The style grid mounts one live canvas per tile style — dozens at once, most of
// them animated — and every drawn frame costs a synchronous GPU readback. These
// tests pin the two things that keep that bounded: the redraw budget, and the
// fact that an off-screen tile stops redrawing at all.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../3d/styles/TileStyleMaterials.jsx', () => ({
  getTileStyleMaterial: () => ({ uniforms: { time: { value: 0 } } })
}));

import {
  setSharedRenderer,
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
  setTilePreviewVisible,
  tickPreviews,
  isAnimatedPreviewStyle
} from '../3d/TilePreviewRenderer.js';

let putCount = 0;

function fakeCanvas(size = 56) {
  const ctx = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => { putCount++; }
  };
  return { width: size, height: size, getContext: () => ctx };
}

// A stand-in for the main R3F renderer: the readback is the expensive part we
// are counting, and nothing here needs a real WebGL context.
const fakeGl = {
  getRenderTarget: () => null,
  setRenderTarget: () => {},
  clear: () => {},
  render: () => {},
  readRenderTargetPixels: () => {}
};

setSharedRenderer(fakeGl);

/** Runs `seconds` of main-loop time at 60fps and returns the draws it caused. */
function run(seconds) {
  const before = putCount;
  for (let i = 0; i < Math.round(seconds * 60); i++) tickPreviews(1 / 60);
  return putCount - before;
}

describe('tile preview redraw budget', () => {
  beforeEach(() => { putCount = 0; });

  it('treats a shader style as animated and a flat one as static', () => {
    expect(isAnimatedPreviewStyle('lava')).toBe(true);
    expect(isAnimatedPreviewStyle('solid')).toBe(false);
  });

  it('redraws an animated preview on its own budget, not every frame', () => {
    const id = registerTilePreview(fakeCanvas(), 'lava', '#ff0000');
    const drawn = run(1);
    unregisterTilePreview(id);
    // 20fps plus the mount's immediate first frame — nowhere near the 60 a
    // per-frame redraw would cost.
    expect(drawn).toBeGreaterThan(15);
    expect(drawn).toBeLessThanOrEqual(22);
  });

  it('never redraws a static style after its first frame', () => {
    const id = registerTilePreview(fakeCanvas(), 'solid', '#ff0000');
    const drawn = run(1);
    unregisterTilePreview(id);
    expect(drawn).toBe(1);
  });

  it('stops redrawing an off-screen preview', () => {
    const id = registerTilePreview(fakeCanvas(), 'lava', '#ff0000');
    setTilePreviewVisible(id, false);
    const hidden = run(1);
    expect(hidden).toBe(1); // the mount frame only

    setTilePreviewVisible(id, true);
    const shown = run(1);
    unregisterTilePreview(id);
    expect(shown).toBeGreaterThan(15);
  });

  it('redraws an off-screen preview when its style changes', () => {
    const id = registerTilePreview(fakeCanvas(), 'lava', '#ff0000');
    setTilePreviewVisible(id, false);
    run(0.5);
    putCount = 0;
    updateTilePreview(id, 'galaxy', '#00ff00');
    const drawn = run(0.5);
    unregisterTilePreview(id);
    expect(drawn).toBe(1);
  });

  it('spreads the redraws of a grid mounted on one frame across the interval', () => {
    const ids = Array.from({ length: 10 }, () => registerTilePreview(fakeCanvas(), 'lava', '#ff0000'));
    run(0.1); // clear the shared mount frame
    // Count how many distinct frames carry a draw over the next second: with a
    // single phase every tile would land on the same 20 frames.
    const frames = new Set();
    for (let i = 0; i < 60; i++) {
      const before = putCount;
      tickPreviews(1 / 60);
      if (putCount > before) frames.add(i);
    }
    ids.forEach(unregisterTilePreview);
    expect(frames.size).toBeGreaterThan(20);
  });
});
