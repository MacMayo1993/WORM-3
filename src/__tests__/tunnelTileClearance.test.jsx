import { expect, it } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { makeInteriorPortals } from '../worm/healerWorm/interiorPortals.js';
import { makeInteriorTileBatches, INTERIOR_TILE_INSET } from '../worm/healerWorm/interiorTileBatches.js';
import { updateTilePressVisual } from '../worm/tilePressVisual.js';
import { createPlayStickerGeometry } from '../3d/rubiksPiece.js';

// The patterned outer walls stay visible while a recorded tail passage clears.
// They must never replace depressed exterior tiles in the depth buffer.
it.each([3, 10, 15])('keeps occupied exterior tiles ahead of the tunnel room on all faces (size %i)', size => {
  const cubies = makeCubies(size), portals = makeInteriorPortals();
  const tiles = makeInteriorTileBatches(portals.uniforms);
  const geometry = createPlayStickerGeometry(), material = new THREE.MeshBasicMaterial();
  const exterior = new THREE.Mesh(geometry, material);
  const inner = new THREE.Group(), footprint = new THREE.Group();
  const uniforms = { uPress: { value: 0 }, uColor: { value: new THREE.Color() } };
  const ray = new THREE.Raycaster(), matrix = new THREE.Matrix4();
  try {
    for (const dirKey of ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']) {
      const axis = 'XYZ'.indexOf(dirKey[1]), sign = dirKey[0] === 'P' ? 1 : -1;
      const cell = [Math.floor(size / 2), Math.floor(size / 2), Math.floor(size / 2)];
      cell[axis] = sign > 0 ? size - 1 : 0;
      const center = new THREE.Vector3(...cell).addScalar(-(size - 1) / 2);
      const normal = new THREE.Vector3().setComponent(axis, sign);
      const position = center.clone().addScaledVector(normal, SURFACE_OFFSET - INTERIOR_TILE_INSET);
      const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), normal.clone().negate()));
      tiles.sync([{ sx: cell[0], sy: cell[1], sz: cell[2], dirKey,
        px: position.x, py: position.y, pz: position.z, rx: rotation.x, ry: rotation.y, rz: rotation.z }], cubies, {}, 9999);
      const wall = tiles.group.children[0];
      wall.getMatrixAt(0, matrix);
      wall.updateMatrixWorld(true);
      exterior.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      for (const press of [0, 0.5, 1, 2]) {
        const z = updateTilePressVisual(inner, footprint, uniforms, press, 1, '#ff6688');
        exterior.position.copy(center).addScaledVector(normal, 0.51 + z);
        exterior.scale.copy(inner.scale);
        exterior.updateMatrixWorld(true);
        ray.set(center.clone().addScaledVector(normal, 2), normal.clone().negate());
        const hits = ray.intersectObjects([wall, exterior], false);
        expect(hits[0]?.object, `${dirKey}, press ${press}`).toBe(exterior);
        // Include the room's entire bevel/back thickness, not only its front plane.
        const points = wall.geometry.attributes.position;
        for (let i = 0; i < points.count; i++) {
          const depth = new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(matrix).sub(center).dot(normal);
          expect(depth).toBeLessThan(0.51 + z);
        }
      }
    }
  } finally { tiles.dispose(); portals.dispose(); geometry.dispose(); material.dispose(); }
});
