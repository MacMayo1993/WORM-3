import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

it('keeps tile accessory batches on the raised/rotating tile and restores glass/patterned backs', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} })
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const cubies = makeCubies(6), settings = { ...before.settings, tileStyle: 'solid',
    manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 'solid'])), flipPads: 'off' };
  useGameStore.setState({ size: 6, cubies, wormHealerMode: true, chaosLevel: 0, settings });
  let meta = cubies[2][2][5].stickers.PZ, store, time = 0;
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 1280, height: 800 } });
  const render = async (mode = 'classic') => act(async () => {
    store = root.render(<StickerInstanceProvider><group name="layer"><group name="raised" position={[0, 0, 2.5]}>
      <StickerPlane meta={meta} pos={[0, 0, .51]} mode={mode} faceSize={6} />
    </group></group></StickerInstanceProvider>);
  });
  const frame = async () => act(async () => { runActiveStickers({ clock: { elapsedTime: time } }, 1 / 60); store.getState().advance(time += 1 / 60); });
  const batch = name => store.getState().scene.getObjectByName(`TileSurfaceBatch:${name}`);
  const check = name => {
    const scene = store.getState().scene, mesh = batch(name);
    // The border draws from the tile's own group (the back wrapper's parent).
    const source = name.endsWith('tile-border') ? scene.getObjectByName('sticker-antipodal-back').parent : scene.getObjectByName(name);
    expect(source.isMesh).not.toBe(true); expect(mesh.count).toBe(1); expect(mesh.visible).toBe(true);
    scene.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix); matrix.premultiply(mesh.matrixWorld);
    matrix.elements.forEach((x, i) => expect(x).toBeCloseTo(source.matrixWorld.elements[i], 6));
    return mesh;
  };
  try {
    await render(); await frame();
    const scene = store.getState().scene, layer = scene.getObjectByName('layer'), raised = scene.getObjectByName('raised');
    check('tile-border');
    const back = check('sticker-antipodal-back'), color = new THREE.Color();
    back.getColorAt(0, color);
    expect(color.getHex()).toBe(new THREE.Color(resolveColors(settings)[ANTIPODAL_COLOR[meta.curr]]).getHex());
    for (const [angle, distance] of [[.4, 2.7], [1.1, 3.1], [Math.PI / 2, 3.5], [0, 2.5]]) {
      layer.rotation.y = angle; raised.position.z = distance;
      await frame(); check('tile-border'); check('sticker-antipodal-back');
    }
    meta = { ...meta, curr: ANTIPODAL_COLOR[meta.curr], flips: 1 };
    await render(); await frame(); check('flipped-tile-border'); expect(batch('tile-border').visible).toBe(false);
    for (let i = 0; i < 80; i++) await frame();
    check('sticker-antipodal-back');
    // Glass needs individual alpha sorting; a style shader needs its own finish.
    await render('glass'); await frame();
    expect(scene.getObjectByName('sticker-antipodal-back').isMesh).toBe(true); expect(back.visible).toBe(false);
    expect(scene.getObjectByName('sticker-antipodal-back').material.transparent).toBe(true);
    await act(async () => useGameStore.setState({ settings: { ...settings, manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 'carbonFiber'])) } }));
    await render(); await frame();
    // A styled back is batched too, through its style's instanced twin, so every
    // back of one style and colour is a single draw.
    const styledBack = () => scene.getObjectsByProperty('name', 'TileSurfaceBatch:sticker-antipodal-back')
      .find(mesh => mesh.material.isShaderMaterial);
    expect(styledBack().count).toBe(1);
    expect(styledBack().material.userData.styleFragmentShader).toBeTruthy();
    // A same-color sticker can change orientation without changing its identity.
    // Both faces bind their own identity even when materials are shared/patched:
    // the flipped front through its own mesh, the batched back per instance.
    meta = { ...meta, uvTurns: 1 };
    await render(); await frame();
    const front = scene.getObjectByName('sticker-front');
    expect(front.parent.rotation.z).toBeCloseTo(Math.PI / 2);
    front.onBeforeRender(null, scene, null, front.geometry, front.material);
    expect(front.material.uniforms.tileHome.value.toArray()).toEqual([2, 2, 5]);
    expect(front.material.uniforms.tileFace.value).toBe(meta.orig);
    expect(front.material.uniformsNeedUpdate).toBe(true);
    const identity = styledBack().geometry.attributes.aInstanceData;
    expect([identity.getX(0), identity.getY(0), identity.getZ(0), identity.getW(0)]).toEqual([2, 2, 5, meta.orig]);
    // Artwork rotation lives on the shared back wrapper, which is the batch's anchor.
    // Check the composed transform so this catches a missing/doubled rotation.
    const expectedBack = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, -0.018),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, -Math.PI / 2)),
      new THREE.Vector3(0.8, 0.8, 1),
    );
    scene.updateMatrixWorld(true);
    const backAnchor = scene.getObjectByName('sticker-antipodal-back');
    expect(backAnchor.isMesh).not.toBe(true);
    backAnchor.matrix.elements.forEach((value, i) => expect(value).toBeCloseTo(expectedBack.elements[i], 8));
    const drawn = new THREE.Matrix4(); styledBack().getMatrixAt(0, drawn); drawn.premultiply(styledBack().matrixWorld);
    drawn.elements.forEach((value, i) => expect(value).toBeCloseTo(backAnchor.matrixWorld.elements[i], 6));

    await act(async () => useGameStore.setState({ settings }));
    await render(); await frame(); check('sticker-antipodal-back');
    layer.visible = false; await frame(); expect(back.visible).toBe(false);
    layer.visible = true; await frame(); check('sticker-antipodal-back');
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
