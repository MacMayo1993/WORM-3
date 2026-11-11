import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CORE_MIRROR_HALF, coreOpeningRadius, makeCorePassage, updateCorePassage } from '../3d/corePassage.js';
import { createCoreMirrorRoom, createCoreMirrorProbe } from '../3d/coreMirrorRoom.js';
import { createCorePortalRims } from '../3d/corePortalRims.js';
import { updateCoreMirrorCharge } from '../3d/coreMirrorCharge.js';
import { addMirrorSubject, mirrorSubjects } from '../3d/mirrorSubjects.js';

const palette = { 1: '#2abaff', 2: '#ff7a45' };
const routeFor = size => ({ entry: { x: Math.floor(size / 2), y: size - 1, z: Math.floor(size / 2), dirKey: 'PY' },
  exit: { x: 0, y: Math.floor(size / 2), z: Math.floor(size / 2), dirKey: 'NX' }, entryColor: 1, exitColor: 2 });
const pose = (passage, room, rims, route, size, zoom) => {
  updateCorePassage(passage, route, size, 0);
  const center = passage.uniforms.uCoreRoomCenter.value;
  center.copy(passage.path.midA).multiplyScalar(1 - zoom);
  passage.uniforms.uPassageRadius.value = coreOpeningRadius(size, zoom);
  room.group.position.copy(center); room.group.scale.setScalar(zoom);
  rims.update(passage, size, zoom); room.updateLayout(passage, zoom);
};

it('corrects stretched bevel normals so adaptive panels retain the proper reflection direction', () => {
  const passage = makeCorePassage(), room = createCoreMirrorRoom(3, passage.uniforms);
  const rims = createCorePortalRims(passage.uniforms);
  const matrix = new THREE.Matrix4(), world = new THREE.Matrix4(), expectedMatrix = new THREE.Matrix3();
  const basis = new THREE.Matrix3(), scale = new THREE.Vector3(), normal = new THREE.Vector3();
  try {
    pose(passage, room, rims, routeFor(3), 3, 1.5); room.group.updateMatrixWorld(true);
    const normals = room.tiles.geometry.getAttribute('normal');
    let stretched = 0;
    for (let i = 0; i < room.tiles.count; i++) {
      room.tiles.getMatrixAt(i, matrix); world.multiplyMatrices(room.group.matrixWorld, matrix);
      basis.setFromMatrix4(world); expectedMatrix.getNormalMatrix(world);
      const e = basis.elements;
      scale.set(e[0] ** 2 + e[1] ** 2 + e[2] ** 2, e[3] ** 2 + e[4] ** 2 + e[5] ** 2, e[6] ** 2 + e[7] ** 2 + e[8] ** 2);
      if (Math.abs(scale.x - scale.y) > 1e-4) stretched++;
      for (let j = 0; j < normals.count; j++) {
        normal.fromBufferAttribute(normals, j);
        if (normal.lengthSq() < 1e-12) continue;
        const expected = normal.clone().applyMatrix3(expectedMatrix).normalize();
        const corrected = normal.clone().divide(scale).applyMatrix3(basis).normalize();
        expect(corrected.distanceTo(expected)).toBeLessThan(1e-7);
      }
    }
    expect(stretched).toBeGreaterThan(0);
    expect(room.material.vertexShader).toContain('toWorld * (normal / normalScale)');
  } finally { room.dispose(); rims.dispose(); }
});

it('anchors charge to the adaptive openings across zoom, route reversal and board sizes', () => {
  for (const size of [2, 3, 5, 15]) {
    const passage = makeCorePassage(), room = createCoreMirrorRoom(size, passage.uniforms);
    const rims = createCorePortalRims(passage.uniforms), route = routeFor(size);
    const buffer = room.tiles.instanceMatrix, uniforms = Object.values(room.charge.uniforms);
    try {
      for (const tunnel of [route, { ...route, entry: route.exit, exit: route.entry, entryColor: 2, exitColor: 1 }]) {
        for (const zoom of [1, 1.5, 2, 4, 6]) {
          pose(passage, room, rims, tunnel, size, zoom);
          updateCoreMirrorCharge(room.charge, tunnel, size, palette, .5, { passageEnds: room.passageEnds });
          expect(Object.values(room.charge.uniforms)).toEqual(uniforms);
          expect(room.tiles.instanceMatrix).toBe(buffer);
          expect(room.material.uniforms.uChargeEntry).toBe(room.charge.uniforms.uChargeEntry);
          expect(room.material.uniforms.uCoreRoomCenter).toBe(passage.uniforms.uCoreRoomCenter);
          if (!room.passageEnds.active) continue; // A very large room can enclose a complete shoulder.
          for (const [uniform, endpoint] of [['uChargeEntry', 'entry'], ['uChargeExit', 'exit']]) {
            const world = room.charge.uniforms[uniform].value.clone().multiplyScalar(CORE_MIRROR_HALF * zoom).add(room.group.position);
            expect(room.charge.uniforms[uniform].value.distanceTo(room.passageEnds[endpoint].clone().divideScalar(CORE_MIRROR_HALF))).toBeLessThan(1e-10);
            const { mesh, crossings } = rims.layers[1];
            expect(Math.min(...crossings.slice(0, mesh.count).map(crossing => world.distanceTo(crossing.center)))).toBeLessThan(1e-10);
          }
        }
      }
    } finally { room.dispose(); rims.dispose(); }
  }
});

it.each(['paused', 'reducedMotion', 'reduceFlashing'])('keeps the %s event steady while its aperture follows the zoom', setting => {
  const size = 3, passage = makeCorePassage(), room = createCoreMirrorRoom(size, passage.uniforms);
  const rims = createCorePortalRims(passage.uniforms), route = routeFor(size);
  const options = { [setting]: true, passageEnds: room.passageEnds };
  try {
    pose(passage, room, rims, route, size, 1);
    updateCoreMirrorCharge(room.charge, route, size, palette, .47, options);
    const event = ['uChargeLevel', 'uChargeProgress', 'uChargeExchange', 'uChargeDischarge'].map(key => room.uniforms[key].value);
    const firstEnd = room.uniforms.uChargeExit.value.clone();
    pose(passage, room, rims, route, size, 1.5);
    updateCoreMirrorCharge(room.charge, route, size, palette, .56, options);
    expect(['uChargeLevel', 'uChargeProgress', 'uChargeExchange', 'uChargeDischarge'].map(key => room.uniforms[key].value)).toEqual(event);
    expect(room.uniforms.uChargeExit.value.distanceTo(firstEnd)).toBeGreaterThan(.1);
    expect(room.uniforms.uChargeExit.value.distanceTo(room.passageEnds.exit.clone().divideScalar(CORE_MIRROR_HALF))).toBeLessThan(1e-10);
    updateCorePassage(passage, null, size, 0); rims.update(passage, size, 1); room.updateLayout(passage, 1);
    updateCoreMirrorCharge(room.charge, null, size, palette, .5, options);
    expect(rims.group.visible).toBe(false); expect(room.passageEnds.active).toBe(false);
    expect(room.uniforms.uChargeLevel.value).toBe(0);
    expect(room.tiles.count).toBe(6 * size * size);
  } finally { room.dispose(); rims.dispose(); }
});

it('captures only the inner rim with the existing face budget and releases every instance pool', () => {
  const passage = makeCorePassage(), room = createCoreMirrorRoom(3, passage.uniforms);
  const rims = createCorePortalRims(passage.uniforms), probe = createCoreMirrorProbe(16);
  const scene = new THREE.Scene(); scene.add(room.group, rims.group);
  pose(passage, room, rims, routeFor(3), 3, 1.5);
  const remove = addMirrorSubject(rims.layers[1].mesh);
  let draws = 0, disposals = 0;
  for (const mesh of [room.tiles, ...rims.layers.map(layer => layer.mesh)]) mesh.addEventListener('dispose', () => disposals++);
  const renderer = { coordinateSystem: THREE.WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget: () => null, setRenderTarget() {}, render(capture) {
      draws++;
      expect(capture.children).toContain(room.group);
      expect(capture.children).toContain(rims.layers[1].mesh);
      expect(capture.children).not.toContain(rims.layers[0].mesh);
      expect(room.uniforms.uChargeCapture.value).toBe(1);
    } };
  try {
    probe.capture(renderer, scene, room, { faces: 2 });
    expect(draws).toBe(2); expect(room.uniforms.uChargeCapture.value).toBe(0);
    expect(rims.group.children).toHaveLength(2); expect(room.group.children).toHaveLength(2);
    remove(); expect(mirrorSubjects().has(rims.layers[1].mesh)).toBe(false);
  } finally { remove(); room.dispose(); rims.dispose(); probe.dispose(); }
  expect(disposals).toBe(3);
});
