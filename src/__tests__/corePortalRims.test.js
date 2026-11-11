import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCorePassage, updateCorePassage, coreOpeningRadius, CORE_MIRROR_HALF } from '../3d/corePassage.js';
import { createCorePortalRims, coreWallCrossingsInto, CORE_PORTAL_RIM_OUTER } from '../3d/corePortalRims.js';
import { createCoreMirrorRoom } from '../3d/coreMirrorRoom.js';
import { mirrorPanelIntervals } from '../3d/coreMirrorPanels.js';
import { tunnelDockWidth } from '../utils/tunnelPath.js';

const bent = size => ({
  entry: { x: Math.floor(size / 2), y: size - 1, z: Math.floor(size / 2), dirKey: 'PY' },
  exit: { x: 0, y: Math.floor(size / 2), z: Math.floor(size / 2), dirKey: 'NX' }
});
const setPose = (passage, size, zoom) => {
  passage.uniforms.uCoreRoomCenter.value.copy(passage.path.midA).multiplyScalar(1 - zoom);
  passage.uniforms.uPassageRadius.value = coreOpeningRadius(size, zoom);
};

it('builds symmetric port panels and combines close ports instead of slicing an aperture with a seam', () => {
  const radius = .025, half = .3;
  const single = mirrorPanelIntervals(half, 5, [.043], radius);
  const port = single.find(p => Math.abs(p.center - .043) < 1e-9);
  expect(port).toBeDefined();
  expect(port.width * .95 / 2).toBeGreaterThan(radius * CORE_PORTAL_RIM_OUTER);
  const paired = mirrorPanelIntervals(half, 5, [-.02, .02], radius);
  const combined = paired.find(p => Math.abs(p.center) < 1e-9);
  expect(combined.width * .95 / 2).toBeGreaterThan(.02 + radius);
  for (const panels of [single, paired]) for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    expect(panel.width).toBeGreaterThan(0);
    expect(panel.center - panel.width / 2).toBeGreaterThanOrEqual(-half - 1e-10);
    expect(panel.center + panel.width / 2).toBeLessThanOrEqual(half + 1e-10);
    if (i) expect(panels[i - 1].center + panels[i - 1].width / 2).toBeLessThanOrEqual(panel.center - panel.width / 2 + 1e-10);
  }
});

it('centres the mirror panel on the bent 3x3 exit that formerly cut a tile seam at 1.5x zoom', () => {
  const passage = makeCorePassage(), size = 3, zoom = 1.5;
  updateCorePassage(passage, bent(size), size, 0); setPose(passage, size, zoom);
  const room = createCoreMirrorRoom(size, passage.uniforms);
  try {
    room.updateLayout(passage, zoom);
    const crossings = [], count = coreWallCrossingsInto(crossings, passage.uniforms.uPassagePoints.value,
      passage.uniforms.uCoreRoomCenter.value, CORE_MIRROR_HALF * zoom);
    const exit = crossings.slice(0, count).find(c => c.axis === 0 && c.sign === -1);
    expect(exit).toBeDefined();
    const center = exit.center.clone().sub(passage.uniforms.uCoreRoomCenter.value).divideScalar(zoom);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    let nearest = Infinity;
    for (let i = 0; i < room.tiles.count; i++) {
      room.tiles.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      if (Math.abs(position.x + CORE_MIRROR_HALF) < 1e-7) nearest = Math.min(nearest, position.distanceTo(center));
    }
    expect(nearest).toBeLessThan(1e-7);
    expect(room.passageEnds.active).toBe(true);
    expect(room.passageEnds.exit.distanceTo(center)).toBeLessThan(1e-8);
  } finally { room.dispose(); }
});

describe('continuous core port rims', () => {
  it('follows the exact shader crossings and stays within the original tile-width budget', () => {
    const passage = makeCorePassage(), rims = createCorePortalRims(passage.uniforms);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    try {
      for (let size = 2; size <= 15; size++) for (const zoom of [1, 1.5, 2, 4, 6]) {
        updateCorePassage(passage, bent(size), size, 0); setPose(passage, size, zoom); rims.update(passage, size, zoom);
        expect(coreOpeningRadius(size, zoom) * CORE_PORTAL_RIM_OUTER * 2).toBeLessThan(tunnelDockWidth(size) * zoom);
        for (const { mesh, crossings } of rims.layers) {
          expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
            const crossing = crossings[i];
            for (const axis of [0, 1, 2].filter(axis => axis !== crossing.axis))
              expect(position.getComponent(axis)).toBeCloseTo(crossing.center.getComponent(axis), 6);
          }
        }
        const version = rims.layers[0].mesh.instanceMatrix.version;
        rims.update(passage, size, zoom);
        expect(rims.layers[0].mesh.instanceMatrix.version).toBe(version);
      }
      updateCorePassage(passage, null, 3, 0); rims.update(passage, 3, 1);
      expect(rims.group.visible).toBe(false);
    } finally { rims.dispose(); }
  });
});

it('keeps adaptive layouts inside the room and reuses the pool for sizes 2–15, bent and same-face routes', () => {
  const passage = makeCorePassage();
  const matrix = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let size = 2; size <= 15; size++) {
    const room = createCoreMirrorRoom(size, passage.uniforms), buffer = room.tiles.instanceMatrix;
    try {
      for (const sameFace of [false, true]) for (const zoom of [1, 1.5, 2, 4, 6]) {
        const route = bent(size);
        if (sameFace) { route.entry = { x: 0, y: size - 1, z: 0, dirKey: 'PY' }; route.exit = { x: size - 1, y: size - 1, z: size - 1, dirKey: 'PY' }; }
        updateCorePassage(passage, route, size, 0); setPose(passage, size, zoom); room.updateLayout(passage, zoom);
        expect(room.tiles.instanceMatrix).toBe(buffer);
        expect(room.tiles.count).toBeLessThanOrEqual(buffer.count);
        for (let i = 0; i < room.tiles.count; i++) {
          room.tiles.getMatrixAt(i, matrix); matrix.decompose(p, q, s);
          for (const axis of ['x', 'y', 'z']) expect(Math.abs(p[axis])).toBeLessThanOrEqual(CORE_MIRROR_HALF + 1e-7);
          expect(s.x).toBeGreaterThan(0); expect(s.y).toBeGreaterThan(0);
        }
        const version = buffer.version; room.updateLayout(passage, zoom); expect(buffer.version).toBe(version);
      }
    } finally { room.dispose(); }
  }
});
