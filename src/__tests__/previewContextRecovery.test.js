import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../3d/styles/TileStyleMaterials.jsx', () => ({
  sharedUniforms: { time: { value: 17 }, cellK: { value: 0 } },
  getTileStyleMaterial: (_style, color) => ({
    uniforms: { time: { value: 17 } },
    previewPixel: Number.parseInt(color.slice(1, 3), 16),
  }),
}));

function canvas() {
  const ctx = {
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: vi.fn(),
  };
  return { width: 64, height: 64, getContext: () => ctx, ctx };
}

// WebGL ignores draws/readbacks while lost: in particular it leaves the caller's
// pixel buffer untouched, which made every new level copy the last blue tile.
function renderer() {
  let lost = false, activeTarget = null, alpha = 0.8, pixel = 0;
  const gl = {
    domElement: document.createElement('canvas'),
    capabilities: { isWebGL2: false },
    extensions: { has: () => false },
    getContext: () => ({ isContextLost: () => lost }),
    autoClear: false,
    getRenderTarget: () => activeTarget,
    setRenderTarget: target => { activeTarget = target; },
    getClearAlpha: () => alpha,
    setClearAlpha: value => { alpha = value; },
    clear() {},
    render: vi.fn(scene => { if (!lost) pixel = scene.children[0]?.material?.previewPixel ?? 127; }),
    readRenderTargetPixels: vi.fn((_target, _x, _y, _w, _h, buffer) => {
      if (!lost) buffer.fill(pixel);
    }),
    lose: () => {
      lost = true;
      gl.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    },
    restore: () => {
      lost = false;
      gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    },
  };
  return gl;
}

async function preview(kind) {
  vi.resetModules();
  // Worm halo textures use a small 2D canvas; the render lifecycle uses real
  // Three scenes/targets but does not require a GPU in this unit test.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  });
  if (kind === 'tile') {
    const m = await import('../3d/TilePreviewRenderer.js');
    return { bind: m.setSharedRenderer, tick: m.tickPreviews,
      register: (c, color = '#110000') => m.registerTilePreview(c, 'bricks', color),
      unregister: m.unregisterTilePreview };
  }
  if (kind === 'worm') {
    const m = await import('../3d/WormPreviewRenderer.js');
    return { bind: m.setWormSharedRenderer, tick: m.tickWormPreviews,
      register: c => m.registerWormPreview(c, { characterId: 'classic', skinId: 'classic', animated: false }),
      unregister: m.unregisterWormPreview };
  }
  const m = await import('../3d/CubePreviewRenderer.js');
  return { bind: m.setCubeSharedRenderer, tick: m.tickCubePreviews,
    register: c => m.registerCubePreview(c, { size: 3, animated: false }),
    unregister: m.unregisterCubePreview };
}

afterEach(() => vi.restoreAllMocks());

describe.each(['tile', 'worm', 'cube'])('%s preview context recovery', kind => {
  it.each(['restore', 'replace'])('redraws existing and newly mounted previews after context %s', async recovery => {
    const p = await preview(kind), first = renderer(), existing = canvas(), next = canvas();
    p.bind(first);
    const existingId = p.register(existing);
    p.tick(1 / 60);
    expect(existing.ctx.putImageData).toHaveBeenCalledTimes(1);
    const oldTarget = first.readRenderTargetPixels.mock.calls[0][0];
    const disposed = vi.fn();
    oldTarget.addEventListener('dispose', disposed);

    first.lose();
    const nextId = p.register(next, '#220000');
    const readsBefore = first.readRenderTargetPixels.mock.calls.length;
    p.tick(1 / 60);
    expect(next.ctx.putImageData).not.toHaveBeenCalled();
    expect(first.readRenderTargetPixels).toHaveBeenCalledTimes(readsBefore);

    const current = recovery === 'replace' ? renderer() : first;
    if (recovery === 'replace') p.bind(current); else first.restore();
    p.tick(1 / 60);
    p.tick(1 / 60);
    expect(existing.ctx.putImageData).toHaveBeenCalledTimes(2);
    expect(next.ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(disposed).toHaveBeenCalled();
    expect(current.readRenderTargetPixels.mock.lastCall[0]).not.toBe(oldTarget);
    expect(current.getRenderTarget()).toBe(null);
    expect(current.getClearAlpha()).toBe(0.8);
    expect(current.autoClear).toBe(false);
    if (kind === 'tile') {
      expect(existing.ctx.putImageData.mock.lastCall[0].data[0]).toBe(0x11);
      expect(next.ctx.putImageData.mock.lastCall[0].data[0]).toBe(0x22);
    }
    if (recovery === 'replace') {
      const draws = current.render.mock.calls.length;
      first.restore(); // Events from the detached Canvas must not invalidate the new one.
      p.tick(1 / 60);
      expect(current.render).toHaveBeenCalledTimes(draws);
    }
    p.unregister(existingId); p.unregister(nextId);
  });

  it('rebinds an active preview when Canvas remounts before the old context is lost', async () => {
    const p = await preview(kind), old = renderer(), current = renderer(), c = canvas();
    p.bind(old);
    const id = p.register(c);
    p.tick(1 / 60);
    const draws = old.render.mock.calls.length;
    p.bind(current);
    p.tick(1 / 60);
    expect(current.render).toHaveBeenCalled();
    expect(old.render).toHaveBeenCalledTimes(draws);
    expect(c.ctx.putImageData).toHaveBeenCalledTimes(2);
    p.unregister(id);
  });

  it('retries a draw interrupted by context loss without reading a discarded target', async () => {
    const p = await preview(kind), gl = renderer(), c = canvas();
    p.bind(gl);
    const id = p.register(c);
    gl.render.mockImplementationOnce(() => gl.lose());
    p.tick(1 / 60);
    expect(gl.readRenderTargetPixels).not.toHaveBeenCalled();
    expect(c.ctx.putImageData).not.toHaveBeenCalled();
    gl.restore();
    p.tick(1 / 60);
    expect(c.ctx.putImageData).toHaveBeenCalledTimes(1);
    p.unregister(id);
  });
});

it('does not cache a readback interrupted by context loss under a new level', async () => {
  const p = await preview('tile'), gl = renderer(), first = canvas(), interrupted = canvas();
  p.bind(gl);
  let id = p.register(first);
  p.tick(1 / 60);
  p.unregister(id);
  gl.readRenderTargetPixels.mockImplementationOnce(() => gl.lose());
  id = p.register(interrupted, '#330000');
  p.tick(1 / 60);
  expect(interrupted.ctx.putImageData).not.toHaveBeenCalled();
  p.unregister(id);
  gl.restore();
  const remounted = canvas();
  id = p.register(remounted, '#330000');
  p.tick(1 / 60);
  expect(remounted.ctx.putImageData.mock.lastCall[0].data[0]).toBe(0x33);
  p.unregister(id);
});
