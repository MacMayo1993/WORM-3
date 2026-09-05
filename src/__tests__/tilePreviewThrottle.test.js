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
  const canvas = { width: size, height: size };
  const ctx = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: img => { putCount++; canvas.lastFrame = img; }
  };
  canvas.getContext = () => ctx;
  return canvas;
}

// A stand-in for the main R3F renderer: the readback is the expensive part we
// are counting, and nothing here needs a real WebGL context.
const fakeGl = {
  getRenderTarget: () => null,
  setRenderTarget: () => {},
  clear: () => {},
  render: () => {},
  // A horizontal ramp: every column of the 64² target has a distinct red value,
  // which is what makes a mis-copied row visible in the test below.
  readRenderTargetPixels: (_rt, _x, _y, w, h, buf) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[i] = x * 4;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 255;
      }
    }
  }
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

  it('scales the readback across the whole canvas', () => {
    // A 56px thumbnail is not the 64² render target, so every frame is resampled
    // by hand. Getting the destination index wrong paints one column and leaves
    // the rest of the row transparent — which reads as a blank tile, not a crash.
    const canvas = fakeCanvas(56);
    const id = registerTilePreview(canvas, 'solid', '#ff0000');
    run(0.05);
    unregisterTilePreview(id);

    const { data } = canvas.lastFrame;
    const rowStart = data[0];
    const rowEnd = data[(56 - 1) * 4];
    expect(rowEnd).toBeGreaterThan(rowStart); // the ramp survived the resample
    expect(data[(56 - 1) * 4 + 3]).toBe(255); // and the last column was written
    // Every pixel of the last row, too — not just the first.
    const lastRow = (56 * 55) * 4;
    expect(data[lastRow + (30 * 4) + 3]).toBe(255);
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
