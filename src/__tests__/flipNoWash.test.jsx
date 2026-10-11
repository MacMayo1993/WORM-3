import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A flip is motion: the tile squeezes shut and re-opens in its new colour. None of
// its effects may lay one flat colour (or white) over the whole tile, which read
// as the sticker flashing and broke the action. Only the canvas alpha mask is stubbed.
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} })
  });
});
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('@react-three/drei', () => ({ Text: () => null, Line: () => null, Billboard: ({ children }) => <group>{children}</group> }));
vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
import StickerPlane from '../3d/StickerPlane.jsx';
import AntipodalGlowFill from '../3d/AntipodalGlowFill.jsx';
import { flashFragment, particleVertex } from '../3d/flipBurstShaders.js';
import { eyelidFragmentShader } from '../3d/stickerPortalShaders.js';
import { getFlipPortalMaterial } from '../3d/flipPortal.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { resolveColors } from '../utils/colorSchemes.js';

extend(THREE);

describe('flip effects light the tile without washing it', () => {
  it('places each flip chip by its own instance matrix, never as a plane over the whole tile', () => {
    // Twenty chips drawn without their instance matrices stacked into one solid
    // square of the new colour: the flat flash that hid every flip.
    expect(particleVertex).toContain('instanceMatrix * local');
  });

  it('flashes a glint at the crossing, not a bloom over the tile', () => {
    expect(flashFragment).toContain('glint(');
    expect(flashFragment).not.toContain('smoothstep(0.0, 0.58');
  });

  it('draws only light on the eyelid, never the new colour over the whole tile', () => {
    expect(eyelidFragmentShader).not.toContain('baseAlpha');
    expect(eyelidFragmentShader).not.toMatch(/0\.5\d* \* inDisc/);
  });

  it('opens the portal with a rim on its leading edge, its floor clear of the sticker', () => {
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    getFlipPortalMaterial().onBeforeCompile(shader);
    expect(shader.fragmentShader).not.toContain('vec3(1.0), 0.5) * sin(vOpen');
    expect(shader.fragmentShader).toContain('pLead');
    // Only the frame is flattened while it rises; the floor keeps its height above the sticker.
    expect(shader.vertexShader).toContain('if (aRegion < 0.5) transformed.z *=');
  });
});

let root, store, before, time;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ size: 5, chaosLevel: 0, wormHealerMode: false, perfReducedFX: true, faceTextures: {},
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: false, biomeMode: { enabled: false }, manifoldStyles: {} } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  time = 0;
});
afterEach(async () => {
  await act(async () => root.unmount());
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
async function advance(frames) {
  await act(async () => {
    for (let i = 0; i < frames; i++) {
      time += 1 / 60;
      runActiveStickers({ ...store.getState(), clock: { elapsedTime: time } }, 1 / 60);
      store.getState().advance(time);
    }
  });
}
const meshes = () => { const out = []; store.getState().scene.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
const named = name => { let n = 0; store.getState().scene.traverse(o => { if (o.name === name) n++; }); return n; };
const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

it('draws the crossing as thin rings, with no disc filling the tile', async () => {
  const ref = React.createRef();
  await act(async () => { store = root.render(<AntipodalGlowFill ref={ref} />); });
  ref.current.trigger('#ff2020');
  for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    ref.current.setProgress(p);
    for (const mesh of meshes().filter(shown)) {
      expect(mesh.geometry.type).toBe('RingGeometry');
      // Every ring stays a line: its hole is most of its width, at any scale.
      expect(mesh.geometry.parameters.innerRadius / mesh.geometry.parameters.outerRadius).toBeGreaterThan(0.8);
    }
  }
});

it('re-opens a flipped tile in its new colour while shut, with no snap at the end', async () => {
  const colors = resolveColors(useGameStore.getState().settings);
  const meta = makeCubies(5)[2][2][4].stickers.PZ;
  const draw = flips => <StickerPlane meta={{ ...meta, flips, curr: flips % 2 ? 4 : 1 }} pos={[0, 0, 0.51]} faceSize={5} mode="classic" />;
  await act(async () => { store = root.render(draw(0)); });
  await act(async () => root.render(draw(1)));
  const face = meshes().find(o => o.name === 'sticker-front');
  const hex = () => `#${(face.material.uniforms?.baseColor?.value ?? face.material.color).getHexString()}`;
  const same = (a, b) => new THREE.Color(a).getHexString() === new THREE.Color(b).getHexString();
  await advance(8);
  expect(same(hex(), colors[1])).toBe(true); // still the old colour, closing
  await advance(14);
  expect(same(hex(), colors[4])).toBe(true); // re-opening in the new colour, mid-flip
  await advance(40);
  expect(same(hex(), colors[4])).toBe(true);
});

it('closes the portal with a tile flipping home instead of dropping it as the flip begins', async () => {
  const meta = makeCubies(5)[2][2][4].stickers.PZ;
  const draw = flips => <StickerPlane meta={{ ...meta, flips, curr: flips % 2 ? 4 : 1 }} pos={[0, 0, 0.51]} faceSize={5} mode="classic" />;
  await act(async () => { store = root.render(draw(0)); });
  await act(async () => root.render(draw(1)));
  await advance(90);
  expect(named('FlipPortal')).toBe(1);
  await act(async () => root.render(draw(2)));
  // Still there as the tile squeezes shut...
  expect(named('FlipPortal')).toBe(1);
  await advance(8);
  expect(named('FlipPortal')).toBe(1);
  // ...and gone once it has shut and re-opened in its home colour.
  await advance(30);
  expect(named('FlipPortal')).toBe(0);
  await advance(60);
  expect(named('FlipPortal')).toBe(0);
});

it('closes the portal with a flip that lands home on the cap, though that flip kills the tile', async () => {
  const meta = makeCubies(5)[2][2][4].stickers.PZ;
  const cap = 6;
  const draw = flips => <StickerPlane meta={{ ...meta, flips, curr: flips % 2 ? 4 : 1 }} pos={[0, 0, 0.51]} faceSize={5} mode="classic" />;
  await act(async () => { store = root.render(draw(cap - 2)); });
  await act(async () => root.render(draw(cap - 1)));
  await advance(90);
  expect(named('FlipPortal')).toBe(1);
  await act(async () => root.render(draw(cap)));
  expect(named('FlipPortal')).toBe(1);
  await advance(8);
  expect(named('FlipPortal')).toBe(1);
  // The cap kills the tile: its portal implodes with it (0.5 s) and is gone with
  // the tile, never popping back full size beside the grave.
  await advance(26);
  expect(named('FlipPortal')).toBe(0);
  await advance(60);
  expect(named('FlipPortal')).toBe(0);
});
