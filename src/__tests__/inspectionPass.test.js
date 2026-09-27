import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderInspectionPass, createInspectionTarget } from '../3d/inspectionPass.js';

it.each([false, true])('restores all borrowed render state and visibility (failure: %s)', throws => {
  const oldTarget = {}, nextTarget = createInspectionTarget(128);
  const hidden = new THREE.Group(), alreadyHidden = new THREE.Group(), shown = new THREE.Group();
  alreadyHidden.visible = shown.visible = false;
  let target = oldTarget, viewport = new THREE.Vector4(3, 7, 800, 600), scissor = new THREE.Vector4(6, 9, 220, 180);
  let scissorTest = true, color = new THREE.Color('#ff5500'), alpha = 0.4;
  const renderer = {
    xr: { enabled: true }, shadowMap: { autoUpdate: true }, autoClear: false,
    getRenderTarget: () => target, getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    setRenderTarget: vi.fn(value => { target = value; viewport.set(0, 0, 128, 128); }),
    getViewport: out => out.copy(viewport), setViewport: value => { viewport = value.clone(); },
    getScissor: out => out.copy(scissor), setScissor: value => { scissor = value.clone(); },
    getScissorTest: () => scissorTest, setScissorTest: value => { scissorTest = value; },
    getClearColor: out => out.copy(color), getClearAlpha: () => alpha,
    setClearColor: (value, a) => { color = new THREE.Color(value); alpha = a; }, clear: vi.fn(),
    render: () => {
      expect(target).toBe(nextTarget); expect(hidden.visible).toBe(false); expect(shown.visible).toBe(true);
      expect(renderer.shadowMap.autoUpdate).toBe(false); expect(scissorTest).toBe(false);
      if (throws) throw new Error('GPU failure');
    },
  };
  const run = () => renderInspectionPass(renderer, {}, {}, nextTarget, [hidden, alreadyHidden], [shown]);
  if (throws) expect(run).toThrow('GPU failure'); else run();
  expect(target).toBe(oldTarget);
  expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(oldTarget, 2, 1);
  expect(viewport.toArray()).toEqual([3, 7, 800, 600]); expect(scissor.toArray()).toEqual([6, 9, 220, 180]);
  expect(scissorTest).toBe(true); expect(alpha).toBe(0.4); expect(color.getHexString()).toBe('ff5500');
  expect(renderer.xr.enabled).toBe(true); expect(renderer.autoClear).toBe(false); expect(renderer.shadowMap.autoUpdate).toBe(true);
  expect(hidden.visible).toBe(true); expect(alreadyHidden.visible).toBe(false); expect(shown.visible).toBe(false);
  nextTarget.dispose();
});
