import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { wormPreviewTargetOptions } from '../3d/wormPreviewTargets.js';

const pmrem = vi.hoisted(() => ({ builds: 0 }));
vi.mock('three', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    PMREMGenerator: class {
      fromScene() { pmrem.builds++; return { texture: new actual.Texture() }; }
      dispose() {}
    },
  };
});

function device({ webgl2 = false, extensions = [], color = [4, 2], depth = [4, 2], maxSamples = 4 } = {}) {
  const gl = {
    RENDERBUFFER: 0x8d41, RGBA16F: 0x881a, RGBA8: 0x8058, DEPTH_COMPONENT24: 0x81a6, SAMPLES: 0x80a9,
    isContextLost: () => false,
    getInternalformatParameter: vi.fn((_target, format) => new Int32Array(format === gl.DEPTH_COMPONENT24 ? depth : color)),
  };
  return {
    capabilities: { isWebGL2: webgl2, maxSamples },
    extensions: { has: name => extensions.includes(name) },
    getContext: () => gl,
  };
}

const halfFloat1 = ['OES_texture_half_float', 'EXT_color_buffer_half_float'];
const halfFloat2 = ['EXT_color_buffer_float'];

describe('worm preview target capabilities', () => {
  it.each([
    ['WebGL1 renderable half-float without linear filtering', { extensions: halfFloat1 }, THREE.HalfFloatType, THREE.NearestFilter, 0],
    ['WebGL1 filterable half-float', { extensions: [...halfFloat1, 'OES_texture_half_float_linear'] }, THREE.HalfFloatType, THREE.LinearFilter, 0],
    ['WebGL1 half-float textures without renderability', { extensions: ['OES_texture_half_float', 'OES_texture_half_float_linear'] }, THREE.UnsignedByteType, THREE.LinearFilter, 0],
    ['WebGL1 missing half-float texture support', { extensions: ['EXT_color_buffer_half_float'] }, THREE.UnsignedByteType, THREE.LinearFilter, 0],
    ['WebGL1 without extensions', {}, THREE.UnsignedByteType, THREE.LinearFilter, 0],
    ['WebGL2 core half-float filtering and four samples', { webgl2: true, extensions: halfFloat2 }, THREE.HalfFloatType, THREE.LinearFilter, 4],
    ['WebGL2 with only the half-float color extension', { webgl2: true, extensions: ['EXT_color_buffer_half_float'] }, THREE.HalfFloatType, THREE.LinearFilter, 4],
    ['WebGL2 half-float without MSAA', { webgl2: true, extensions: halfFloat2, color: [] }, THREE.HalfFloatType, THREE.LinearFilter, 0],
    ['WebGL2 half-float with two samples', { webgl2: true, extensions: halfFloat2, color: [2] }, THREE.HalfFloatType, THREE.LinearFilter, 2],
    ['WebGL2 limited depth samples', { webgl2: true, extensions: halfFloat2, depth: [2] }, THREE.HalfFloatType, THREE.LinearFilter, 2],
    ['WebGL2 mismatched attachment samples', { webgl2: true, extensions: halfFloat2, color: [4], depth: [2] }, THREE.HalfFloatType, THREE.LinearFilter, 0],
    ['WebGL2 renderer sample limit', { webgl2: true, extensions: halfFloat2, maxSamples: 2 }, THREE.HalfFloatType, THREE.LinearFilter, 2],
    ['WebGL2 RGBA8 fallback', { webgl2: true }, THREE.UnsignedByteType, THREE.LinearFilter, 4],
  ])('%s', (_name, config, type, filter, samples) => {
    const renderer = device(config);
    const options = wormPreviewTargetOptions(renderer);
    expect(options).toEqual({ format: THREE.RGBAFormat, type, minFilter: filter, magFilter: filter, samples });
    const gl = renderer.getContext();
    if (config.webgl2) {
      expect(gl.getInternalformatParameter).toHaveBeenCalledWith(gl.RENDERBUFFER, type === THREE.HalfFloatType ? gl.RGBA16F : gl.RGBA8, gl.SAMPLES);
      expect(gl.getInternalformatParameter).toHaveBeenCalledWith(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES);
    } else {
      expect(gl.getInternalformatParameter).not.toHaveBeenCalled();
    }
  });

  it.each(['missing', 'throws', 'null'])('disables MSAA when the sample query is %s', mode => {
    const renderer = device({ webgl2: true, extensions: halfFloat2 });
    renderer.getContext().getInternalformatParameter = mode === 'missing' ? undefined : () => {
      if (mode === 'throws') throw new Error('unavailable');
      return null;
    };
    expect(wormPreviewTargetOptions(renderer)).toMatchObject({ type: THREE.HalfFloatType, samples: 0 });
  });
});

afterEach(() => vi.restoreAllMocks());

it.each([
  ['nearest half-float', { extensions: halfFloat1 }, THREE.HalfFloatType, THREE.NearestFilter, 0, 0],
  ['half-float without MSAA', { webgl2: true, extensions: halfFloat2, color: [] }, THREE.HalfFloatType, THREE.LinearFilter, 0, 1],
  ['RGBA8 fallback', {}, THREE.UnsignedByteType, THREE.LinearFilter, 0, 0],
  ['fully supported half-float', { webgl2: true, extensions: halfFloat2 }, THREE.HalfFloatType, THREE.LinearFilter, 4, 1],
])('renders both preview passes using %s and preserves the shared renderer', async (_name, config, type, filter, samples, reflections) => {
  vi.resetModules();
  pmrem.builds = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
  });
  const { setWormSharedRenderer, registerWormPreview, tickWormPreviews, unregisterWormPreview } = await import('../3d/WormPreviewRenderer.js');
  const renderer = device(config);
  const previousTarget = new THREE.WebGLRenderTarget(8, 8);
  let activeTarget = previousTarget, alpha = 0.75;
  const draws = [];
  Object.assign(renderer, {
    autoClear: false,
    getRenderTarget: () => activeTarget,
    setRenderTarget: target => { activeTarget = target; },
    getClearAlpha: () => alpha,
    setClearAlpha: value => { alpha = value; },
    clear() {},
    render: scene => draws.push({ target: activeTarget, encodedTexture: scene.children[0]?.material?.uniforms?.tMap?.value }),
    readRenderTargetPixels: vi.fn((target, _x, _y, _w, _h, pixels) => {
      expect(target.texture.type).toBe(THREE.UnsignedByteType);
      expect(target.samples).toBe(0);
      pixels.fill(127);
    }),
  });
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  };
  setWormSharedRenderer(renderer);
  const ids = [];
  try {
    // Non-power-of-two, rectangular targets exercise the selector's real path.
    for (const width of [120, 180]) {
      ids.push(registerWormPreview({ width, height: 75, getContext: () => ctx }, { characterId: 'classic', skinId: 'classic', framing: 'body' }));
      tickWormPreviews(1 / 60);
    }
    expect(draws).toHaveLength(4);
    for (let i = 0; i < draws.length; i += 2) {
      const target = draws[i].target;
      expect(target.texture).toMatchObject({ type, minFilter: filter, magFilter: filter, generateMipmaps: false });
      expect(target.samples).toBe(samples);
      expect(target.width).toBe(i === 0 ? 120 : 180);
      expect(target.height).toBe(75);
      expect(draws[i + 1].encodedTexture).toBe(target.texture);
    }
    expect(ctx.putImageData).toHaveBeenCalledTimes(2);
    expect(ctx.putImageData.mock.calls[0][0].data.every(value => value === 127)).toBe(true);
    expect(activeTarget).toBe(previousTarget);
    expect(alpha).toBe(0.75);
    expect(renderer.autoClear).toBe(false);
    expect(pmrem.builds).toBe(reflections);
    // Capabilities are selected once, not re-queried for every size or frame.
    expect(renderer.getContext().getInternalformatParameter).toHaveBeenCalledTimes(config.webgl2 ? 2 : 0);
  } finally {
    ids.forEach(unregisterWormPreview);
    previousTarget.dispose();
  }
});
