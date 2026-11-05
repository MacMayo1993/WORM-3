import { afterEach, expect, it, vi } from 'vitest';
import { registerTilePreview, renderTileImage, setSharedRenderer, setTilePreviewActive, tickPreviews, unregisterTilePreview } from '../3d/TilePreviewRenderer.js';

afterEach(() => vi.restoreAllMocks());

it('shows a real Constellation tile in the catalog but binds face zero for HUD color samples', () => {
  const drawnFaces = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: () => {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,sample');
  const renderer = {
    domElement: document.createElement('canvas'),
    getContext: () => ({ isContextLost: () => false }),
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    clear: () => {},
    render: (scene, camera) => {
      const mesh = scene.children[0];
      mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, mesh.material);
      drawnFaces.push(mesh.material.uniforms.tileFace.value);
    },
    readRenderTargetPixels: (_target, _x, _y, _width, _height, buffer) => buffer.fill(255)
  };
  setSharedRenderer(renderer);
  const ids = [];
  try {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 64;
    ids.push(registerTilePreview(tile, 'constellation', '#1FEA78'));
    tickPreviews(1 / 60);
    expect(drawnFaces).toEqual([1]);

    expect(renderTileImage('constellation', '#1FEA78', 64)).toBe('data:image/png;base64,sample');
    expect(drawnFaces).toEqual([1, 0]);
    setTilePreviewActive(ids[0], true);
    tickPreviews(0.1);
    expect(drawnFaces).toEqual([1, 0, 1]);
    setTilePreviewActive(ids[0], false);

    // Other styles keep their established preview identity. No global preview
    // seed or face-slab change is needed for the Constellation-specific guard.
    ids.push(registerTilePreview(document.createElement('canvas'), 'solid', '#1FEA78'));
    tickPreviews(1 / 60);
    expect(drawnFaces).toEqual([1, 0, 1, 0]);
  } finally {
    ids.forEach(unregisterTilePreview);
  }
});
