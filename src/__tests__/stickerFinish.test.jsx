import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { withStickerFinish } from '../3d/styles/shaders/stickerFinish.js';
import { baseVertexShader, eyeballBulgeVertexShader } from '../3d/styles/shaders/shaderBase.js';
import { getTileStyleMaterial, getGlassMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { CUBE_LIGHT_RIG } from '../3d/cubeLighting.js';
import { TILE_STYLES } from '../utils/colorSchemes.js';
import { PadProvider } from '../3d/PadSprings.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

const STYLES = Object.keys(TILE_STYLES);
const count = (src, re) => (src.match(re) || []).length;

describe('sticker finish', () => {
  it('wraps every tile style around one main() that runs the style and then finishes it', () => {
    for (const style of STYLES) {
      const { fragmentShader: src, userData } = getTileStyleMaterial(style, '#3973E8', false, null, '#E98D06');
      expect(count(src, /void\s+main\s*\(/g), style).toBe(1);
      expect(count(src, /void\s+tileStyleMain\s*\(/g), style).toBe(1);
      expect(src, style).toContain('gl_FragColor.rgb = stickerFinish(gl_FragColor.rgb);');
      // The JS side still finds its uniform by name, declared once.
      expect(count(src, /uniform\s+vec3\s+baseColor\s*;/g), style).toBe(1);
      // Past its declaration and conversion, the style reads only the display-space copy.
      const rest = src.replace(/uniform\s+vec3\s+baseColor\s*;/, '').replace('stickerToDisplay(baseColor)', '');
      expect(/\bbaseColor\b/.test(rest), style).toBe(false);
      // Surfaces with their own vertex shader get the bare style.
      expect(userData.styleFragmentShader, style).not.toContain('stickerFinish');
      expect(count(userData.styleFragmentShader, /void\s+main\s*\(/g), style).toBe(1);
    }
  });

  it('redirects antipodalColor only in the styles that read it', () => {
    const anti = getTileStyleMaterial('opConcentric', '#DC3154', false, null, '#E98D06').fragmentShader;
    const solid = getTileStyleMaterial('solid', '#DC3154').fragmentShader;
    if (/uniform vec3 antipodalColor;/.test(anti)) expect(anti).toContain('antipodalColorShown = stickerToDisplay(antipodalColor);');
    expect(solid).not.toContain('antipodalColorShown');
  });

  it('finishes glass too, and leaves any shader without exactly one main() as it was', () => {
    expect(getGlassMaterial('#888888').fragmentShader).toContain('stickerFinish');
    const odd = 'void helper() {}';
    expect(withStickerFinish(odd)).toBe(odd);
  });

  it('lights the finish from the studio rig the plain stickers use', () => {
    const src = withStickerFinish('uniform vec3 baseColor;\nvoid main() { gl_FragColor = vec4(baseColor, 1.0); }');
    const [x, y, z] = CUBE_LIGHT_RIG.key.position;
    const l = Math.hypot(x, y, z);
    expect(src).toContain(`const vec3 KEY = vec3(${+(x / l).toFixed(4)}, ${+(y / l).toFixed(4)}, ${+(z / l).toFixed(4)});`);
  });

  it('feeds the finish from both tile vertex shaders', () => {
    for (const vs of [baseVertexShader, eyeballBulgeVertexShader]) {
      expect(vs).toContain('varying vec3 vStickerPos;');
      expect(vs).toContain('vStickerPos = (modelMatrix');
      expect(vs).toContain('vStickerNormal = normalize(mat3(modelMatrix) * normal);');
    }
    expect(eyeballBulgeVertexShader).toContain('vec4(displaced, 1.0)).xyz;');
  });
});

// Every view mode that draws stickers (wireframe and mirror draw none) puts them on
// the menu cube's rounded sticker, plain ones clear-coated, styled ones finished.
const PLAIN = 'plain', FINISHED = 'finished';
const VIEW_CASES = [
  ...['classic', 'grid', 'chrome', 'neon', 'gap', 'lego'].flatMap((mode) => [
    [mode, 'solid', false, THREE.ExtrudeGeometry, PLAIN],
    [mode, 'carbonFiber', false, THREE.ExtrudeGeometry, FINISHED]
  ]),
  ['classic', 'eyeball', false, THREE.PlaneGeometry, FINISHED],
  ['glass', 'solid', false, THREE.ExtrudeGeometry, FINISHED],
  ['glass', 'carbonFiber', false, THREE.ExtrudeGeometry, FINISHED],
  ['sudokube', 'carbonFiber', false, THREE.ExtrudeGeometry, PLAIN],
  ['classic', 'solid', true, THREE.ExtrudeGeometry, PLAIN],
  ['classic', 'carbonFiber', true, THREE.ExtrudeGeometry, FINISHED]
];

it.each(VIEW_CASES)('%s view, %s tile (hollow: %s) wears the play cube\'s sticker', async (mode, style, hollow, Geometry, finish) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const manifoldStyles = Object.fromEntries([1, 2, 3, 4, 5, 6].map((id) => [id, style]));
  useGameStore.setState({ size: 3, settings: { ...before.settings, manifoldStyles, flipPads: 'off' } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  const meta = makeCubies(3)[1][1][2].stickers.PZ;
  let store;
  try {
    await act(async () => {
      store = root.render(<PadProvider>
        <StickerPlane meta={meta} pos={[0, 0, 0.51]} mode={mode} hollow={hollow} faceRow={1} faceCol={1} faceSize={3} />
      </PadProvider>);
    });
    const front = store.getState().scene.getObjectByName('sticker-front');
    expect(front.geometry).toBeInstanceOf(Geometry);
    if (finish === FINISHED) expect(front.material.fragmentShader).toContain('stickerFinish');
    else expect(front.material.roughness).toBe(0.24); // rubiksFinish's sticker coat
    // Hollow's frame keeps its window: no front-face vertex near the centre.
    if (hollow) {
      const p = front.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) expect(Math.max(Math.abs(p.getX(i)), Math.abs(p.getY(i)))).toBeGreaterThan(0.33);
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    context.mockRestore();
  }
});
