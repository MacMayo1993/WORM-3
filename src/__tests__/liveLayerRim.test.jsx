import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { getSliceRimGeometry, FACE_DEFS, FACE_OFFSET, QUAD_HALF } from '../teach/layerGlow.js';
import { updateLiveLayerRim } from '../teach/liveLayerRim.js';
import LayerHighlight from '../teach/LayerHighlight.jsx';
import { SliceWarningLights } from '../worm/healerWorm/SliceWarningLights.jsx';
import { liveCubies } from '../worm/liveCubies.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

extend(THREE);
const vertex = (g, i) => new THREE.Vector3().fromBufferAttribute(g.attributes.position, i);
const center = (g, face) => vertex(g, face * 4).add(vertex(g, face * 4 + 2)).multiplyScalar(0.5);

describe('live rotation rims', () => {
  it.each([3, 6, 15])('follows Explode on all axes of size %i without stretching tiles or mutating the cache', size => {
    for (const axis of ['col', 'row', 'depth']) for (const slice of [0, Math.floor(size / 2), size - 1]) {
      const template = getSliceRimGeometry(size, axis, slice);
      const original = template.attributes.position.array.slice();
      const geometry = template.clone();
      for (const amount of [0, 0.1, 0.35, 0.18, 0]) {
        updateLiveLayerRim(geometry, template, null, size, amount, new THREE.Matrix4());
        template.userData.rimFaces.forEach((face, i) => {
          const { x, y, z, dirKey } = face;
          const expected = new THREE.Vector3().fromArray(getStickerWorldPos(x, y, z, dirKey, size, amount));
          expected.addScaledVector(new THREE.Vector3(...FACE_DEFS[dirKey].n), FACE_OFFSET - SURFACE_OFFSET);
          expect(center(geometry, i).distanceTo(expected)).toBeLessThan(2e-6);
          expect(vertex(geometry, i * 4).distanceTo(vertex(geometry, i * 4 + 1))).toBeCloseTo(QUAD_HALF * 2, 5);
          const index = geometry.index.array;
          const a = vertex(geometry, index[i * 6]), b = vertex(geometry, index[i * 6 + 1]), c = vertex(geometry, index[i * 6 + 2]);
          expect(b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3(...FACE_DEFS[dirKey].n))).toBeGreaterThan(0);
        });
      }
      expect(template.attributes.position.array).toEqual(original);
      expect(getSliceRimGeometry(size, axis, slice)).toBe(template);
      geometry.dispose();
    }
  });

  it('tracks a raised corner through a live slice turn, in the overlay parent space', () => {
    const template = getSliceRimGeometry(6, 'col', 5), geometry = template.clone();
    const parent = new THREE.Group(), piece = new THREE.Group();
    parent.position.set(0.2, 0.4, 0.3); // full-piece lift, outside its rotating child
    parent.add(piece);
    const overlay = new THREE.Group();
    overlay.position.set(-1, 2, 1);
    overlay.rotation.y = 0.2;
    overlay.updateMatrixWorld(true);
    const worldToRim = overlay.matrixWorld.clone().invert();
    const refs = [];
    refs[(5 * 6 + 5) * 6 + 5] = piece;
    for (const angle of [0, 0.3, Math.PI / 2]) {
      piece.position.set(3.5, 3.5, 3.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      piece.rotation.y = angle;
      updateLiveLayerRim(geometry, template, { size: 6, refs }, 6, 0, worldToRim);
      template.userData.rimFaces.forEach((face, i) => {
        if (face.x !== 5 || face.y !== 5 || face.z !== 5) return;
        const expected = new THREE.Vector3(...FACE_DEFS[face.dirKey].n).multiplyScalar(FACE_OFFSET);
        piece.localToWorld(expected);
        expect(center(geometry, i).applyMatrix4(overlay.matrixWorld).distanceTo(expected)).toBeLessThan(2e-6);
        expect(vertex(geometry, i * 4).distanceTo(vertex(geometry, i * 4 + 1))).toBeCloseTo(QUAD_HALF * 2, 5);
      });
    }
    geometry.dispose();
  });
});

async function sceneHarness(tree) {
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  let store, time = 0;
  await act(async () => { store = root.render(tree); });
  return { scene: store.getState().scene,
    tick: async () => { await act(async () => store.getState().advance(time += 1 / 60)); },
    unmount: async () => { await act(async () => root.unmount()); } };
}

it('hides the mounted WORM preview through every tunnel phase and restores current exploded rims on exit', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const previous = { ...liveCubies };
  liveCubies.refs = null; liveCubies.size = 0;
  const move = { axis: 'col', sliceIndex: 0, sliceIndices: [0, 5], sliceDirs: [1, -1], dir: 1 };
  const pending = { current: move };
  const worm = { phase: { current: 'crawling' }, expansionAmount: { current: 0 } };
  let h;
  try {
    h = await sceneHarness(<SliceWarningLights size={6} pendingRotRef={pending} warningProgressRef={{ current: 0 }} worm={worm} />);
    await h.tick(); await h.tick();
    const group = h.scene.getObjectByName('worm-slice-warning');
    const rims = [];
    group.traverse(o => { if (o.isMesh) rims.push(o); });
    expect(rims).toHaveLength(2); // no floating streamers or aura meshes
    const geometries = rims.map(r => r.geometry);
    for (const rim of rims) {
      expect(rim.material.side).toBe(THREE.FrontSide);
      expect(rim.material.depthTest).toBe(true);
      expect(rim.material.depthWrite).toBe(false);
      expect(rim.frustumCulled).toBe(false);
    }
    for (const phase of ['windup', 'entering', 'tunnel', 'exiting', 'windout']) {
      worm.phase.current = phase;
      await h.tick();
      expect(group.visible).toBe(false);
      expect(rims.map(r => r.geometry)).toEqual(geometries);
    }
    worm.expansionAmount.current = 0.35;
    worm.phase.current = 'crawling';
    await h.tick();
    expect(group.visible).toBe(true);
    for (let i = 0; i < rims.length; i++) {
      const template = getSliceRimGeometry(6, 'col', i ? 5 : 0);
      expect(rims[i].geometry).not.toBe(template);
      expect(center(rims[i].geometry, 0).distanceTo(center(template, 0))).toBeGreaterThan(1);
    }
    // A disarm must also hide immediately, before its React cleanup.
    pending.current = null;
    await h.tick();
    expect(h.scene.getObjectByName('worm-slice-warning')).toBeUndefined();
  } finally {
    await h?.unmount(); Object.assign(liveCubies, previous);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('preserves the teaching preview and never disposes its shared rim', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const template = getSliceRimGeometry(3, 'row', 1), disposed = vi.fn();
  template.addEventListener('dispose', disposed);
  let h;
  try {
    h = await sceneHarness(<LayerHighlight size={3} axis="row" sliceIndex={1} dir={1} />);
    const rim = h.scene.getObjectByName('layer-warning-rim');
    expect(rim.geometry).toBe(template);
    expect(rim.material.side).toBe(THREE.DoubleSide);
    let meshes = 0;
    h.scene.traverse(o => { if (o.isMesh) meshes++; });
    expect(meshes).toBe(7); // the original rim plus three streamers and their haze
  } finally {
    await h?.unmount();
    expect(disposed).not.toHaveBeenCalled();
    template.removeEventListener('dispose', disposed);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
