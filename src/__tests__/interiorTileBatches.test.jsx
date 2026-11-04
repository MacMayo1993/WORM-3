import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { makeInteriorPortals } from '../worm/healerWorm/interiorPortals.js';
import { CHROME_TILE_FINISH } from '../3d/cubeViewStyles.js';
import { ANTIPODAL_COLOR, RUBIKS_FACE_COLORS } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
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

it.each([3, 10, 15])('renders every tile in one chrome batch on size %i, preserving each frame and physical pattern seed', size => {
  const cubies = makeCubies(size), layout = layoutFor(cubies), portals = makeInteriorPortals();
  const batches = makeInteriorTileBatches(portals.uniforms);
  try {
    batches.sync(layout, cubies, { manifoldStyles: { 1: 'circuit', 2: 'checkerboard' } }, 9999);
    expect(batches.group.children).toHaveLength(1);
    expect(batches.group.children.reduce((n, mesh) => n + mesh.count, 0)).toBe(6 * size * size);
    const byKey = new Map(layout.map(t => [`${t.sx}-${t.sy}-${t.sz}-${t.dirKey}`, t]));
    const actual = new THREE.Matrix4(), pose = new THREE.Object3D();
    for (const mesh of batches.group.children) {
      expect(mesh.isInstancedMesh).toBe(true);
      expect(mesh.material.isMeshStandardMaterial).toBe(true);
      expect(mesh.material).toMatchObject(CHROME_TILE_FINISH);
      expect(mesh.geometry.type).toBe('ExtrudeGeometry');
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
    const mesh = batches.group.children[0], color = new THREE.Color();
    mesh.getColorAt(mesh.userData.tileKeys.indexOf(`${t.sx}-${t.sy}-${t.sz}-${t.dirKey}`), color);
    expect(color.getHexString()).toBe('555555');
    expect(original.every(m => batches.group.children.includes(m))).toBe(true);
    expect(materialDisposals.every(spy => spy.mock.calls.length === 0)).toBe(true);
    batches.dispose();
    expect(materialDisposals.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(geometryDisposals.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(batches.group.children).toHaveLength(0);
  } finally { batches.dispose(); portals.dispose(); }
});


it('keeps antipodal palette and flips live through turns, and restores chrome after a Classic pickup', () => {
  let cubies = makeCubies(3);
  const layout = layoutFor(cubies), portals = makeInteriorPortals(), batches = makeInteriorTileBatches(portals.uniforms);
  const settings = { colorScheme: 'cyberpunk', manifoldStyles: { 1: 'circuit', 2: 'lava' } };
  const colors = resolveColors(settings), actual = new THREE.Color();
  const check = () => {
    const mesh = batches.group.children[0];
    expect(batches.group.children).toHaveLength(1);
    for (const [index, key] of mesh.userData.tileKeys.entries()) {
      const [x, y, z, dir] = key.split('-'), sticker = cubies[x][y][z].stickers[dir];
      mesh.getColorAt(index, actual);
      expect(actual.getHexString()).toBe(new THREE.Color(colors[ANTIPODAL_COLOR[sticker.curr]]).getHexString());
    }
  };
  try {
    batches.sync(layout, cubies, settings, 9999); check();
    const original = batches.group.children[0];
    cubies = rotateSliceCubies(cubies, 3, 'col', 1, 1);
    cubies[1][1][2].stickers.PZ.curr = ANTIPODAL_COLOR[cubies[1][1][2].stickers.PZ.curr];
    batches.sync(layout, cubies, settings, 9999); check();
    expect(batches.group.children[0]).toBe(original);
    const disposed = vi.spyOn(original.material, 'dispose');
    batches.sync(layout, cubies, settings, 9999, 'view-classic');
    expect(disposed).toHaveBeenCalledOnce();
    for (const mesh of batches.group.children) {
      expect(mesh.material.isShaderMaterial).toBe(true);
      expect(Object.values(RUBIKS_FACE_COLORS).map(color => color.toLowerCase())).toContain('#' + mesh.material.uniforms.baseColor.value.getHexString());
    }
    batches.sync(layout, cubies, settings, 9999); check();
    expect(settings.manifoldStyles[1]).toBe('circuit');
  } finally { batches.dispose(); portals.dispose(); }
});

it('resizes and disposes the chrome allocation when the cube grows', () => {
  const portals = makeInteriorPortals(), batches = makeInteriorTileBatches(portals.uniforms);
  try {
    const small = makeCubies(2), large = makeCubies(15);
    batches.sync(layoutFor(small), small, {}, 9999);
    const mesh = batches.group.children[0], disposed = vi.spyOn(mesh.material, 'dispose');
    batches.sync(layoutFor(large), large, {}, 9999);
    expect(disposed).toHaveBeenCalledOnce();
    expect(batches.group.children).toHaveLength(1);
    expect(batches.group.children[0].count).toBe(1350);
  } finally { batches.dispose(); portals.dispose(); }
});
