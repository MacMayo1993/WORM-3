import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import CautionFallFX from '../worm/healerWorm/CautionFallFX.jsx';
import { makeCautionFall } from '../worm/healerWorm/cautionRescue.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';
import { CAUTION_OPENING_RADIUS } from '../worm/healerWorm/cautionOpening.js';
extend(THREE);

it('aligns an open shaft on every face and restores the body and opening on retry', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 430, height: 932 } });
  const source = new THREE.MeshStandardMaterial(), geo = new THREE.SphereGeometry(.15, 8, 8);
  const body = { current: new THREE.Mesh(geo, source) }, worm = { cautionFall: { current: null } };
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<CautionFallFX worm={worm} body={body} />); });
    const frame = () => store.getState().advance(time += 1 / 60);
    for (const [dirKey, normal] of Object.entries(FACE_NORMALS)) {
      const tile = { x: 2, y: 2, z: 2, dirKey };
      tile[dirKey[1].toLowerCase()] = dirKey[0] === 'P' ? 4 : 0;
      const fall = makeCautionFall({ headInterpPos: new THREE.Vector3(), currentNormal: normal, expansionAmount: 0 }, tile, 5);
      worm.cautionFall.current = fall;
      frame();
      const shaft = store.getState().scene.getObjectByName('caution-fall-shaft');
      expect(shaft.visible).toBe(true);
      expect(shaft.position.equals(fall.mouth)).toBe(true);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(shaft.quaternion).distanceTo(normal)).toBeLessThan(1e-8);
      expect(shaft.scale.y).toBeGreaterThan(fall.depth);
      expect(shaft.children[0].geometry.parameters.openEnded).toBe(true);
      expect(shaft.children[0].geometry.parameters.radiusTop).toBeLessThan(CAUTION_OPENING_RADIUS);
      expect(body.current.material).not.toBe(source);
      const copy = body.current.material, dispose = vi.spyOn(copy, 'dispose');
      const shader = { ...THREE.ShaderLib.standard, uniforms: {} };
      copy.onBeforeCompile(shader, {});
      expect(shader.uniforms.uDissolve.value).toBe(0);
      fall.dissolve = .4;
      frame();
      expect(shader.uniforms.uDissolve.value).toBe(.4);
      worm.cautionFall.current = null;
      frame();
      expect(shaft.visible).toBe(false);
      expect(body.current.material).toBe(source);
      expect(dispose).toHaveBeenCalledOnce();
    }
  } finally {
    await act(async () => root.unmount()); geo.dispose(); source.dispose();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
