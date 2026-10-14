import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { makeInteriorPortals } from '../worm/healerWorm/interiorPortals.js';
import { makeInteriorTileBatches } from '../worm/healerWorm/interiorTileBatches.js';

function layoutFor(cubies) {
  const layout = [];
  for (let sx = 0; sx < cubies.length; sx++) for (let sy = 0; sy < cubies.length; sy++) for (let sz = 0; sz < cubies.length; sz++) {
    for (const dirKey of Object.keys(cubies[sx][sy][sz].stickers)) {
      layout.push({ sx, sy, sz, dirKey, px: sx, py: sy, pz: sz, rx: .3, ry: .2, rz: .1 });
    }
  }
  return layout;
}

it.each([3, 10, 15])('renders every tile in six batches on size %i, preserving each frame and physical pattern seed', size => {
  const cubies = makeCubies(size), layout = layoutFor(cubies), portals = makeInteriorPortals();
  const batches = makeInteriorTileBatches(portals.uniforms);
  try {
    batches.sync(layout, cubies, { manifoldStyles: { 1: 'circuit', 2: 'checkerboard' } }, 9999);
    expect(batches.group.children).toHaveLength(6);
    expect(batches.group.children.reduce((n, mesh) => n + mesh.count, 0)).toBe(6 * size * size);
    const byKey = new Map(layout.map(t => [`${t.sx}-${t.sy}-${t.sz}-${t.dirKey}`, t]));
    const actual = new THREE.Matrix4(), pose = new THREE.Object3D();
    for (const mesh of batches.group.children) {
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.material.userData.portalCutout).toBe(portals.uniforms);
      expect(mesh.boundingSphere.radius).toBeGreaterThan(0);
      mesh.userData.tileKeys.forEach((key, index) => {
        const t = byKey.get(key), sticker = cubies[t.sx][t.sy][t.sz].stickers[t.dirKey];
        pose.position.set(t.px, t.py, t.pz); pose.rotation.set(t.rx, t.ry, t.rz); pose.updateMatrix();
        mesh.getMatrixAt(index, actual);
        actual.elements.forEach((value, i) => expect(value).toBeCloseTo(pose.matrix.elements[i]));
        const identity = mesh.geometry.attributes.aTileIdentity;
        expect([identity.getX(index), identity.getY(index), identity.getZ(index), identity.getW(index)])
          .toEqual([sticker.origPos.x, sticker.origPos.y, sticker.origPos.z, sticker.orig]);
      });
    }
  } finally { batches.dispose(); portals.dispose(); }
});

it('refreshes healed/dead/missing tiles, reuses resident batches, and releases retired GPU resources', () => {
  const cubies = makeCubies(3), layout = layoutFor(cubies), portals = makeInteriorPortals();
  const batches = makeInteriorTileBatches(portals.uniforms);
  try {
    batches.sync(layout, cubies, {}, 4);
    const original = [...batches.group.children];
    const materialDisposals = original.map(m => vi.spyOn(m.material, 'dispose'));
    const geometryDisposals = original.map(m => vi.spyOn(m.geometry, 'dispose'));
    const t = layout[0], sticker = cubies[t.sx][t.sy][t.sz].stickers[t.dirKey];
    sticker.flips = 4;
    const missing = layout[1]; delete cubies[missing.sx][missing.sy][missing.sz].stickers[missing.dirKey];
    batches.sync(layout, cubies, {}, 4);
    expect(batches.group.children.reduce((n, m) => n + m.count, 0)).toBe(53);
    expect(batches.group.children.some(m => m.material.uniforms.baseColor.value.getHexString() === '555555')).toBe(true);
    expect(original.every(m => batches.group.children.includes(m))).toBe(true);
    expect(materialDisposals.every(spy => spy.mock.calls.length === 0)).toBe(true);
    batches.dispose();
    expect(materialDisposals.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(geometryDisposals.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(batches.group.children).toHaveLength(0);
  } finally { batches.dispose(); portals.dispose(); }
});
