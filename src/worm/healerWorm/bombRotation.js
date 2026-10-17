import * as THREE from 'three';
import { rotateTilePosition } from '../wormHelpers.js';
import { liveLayerAngle, liveRotation } from '../liveRotation.js';
import { getWormStickerWorldPos } from '../wormExpansion.js';
import { FACE_NORMALS, DIR_FORWARD } from './constants.js';

export const BOMB_LIFT = 0.34;
const UP = new THREE.Vector3(0, 1, 0);
const AXES = {
  col: new THREE.Vector3(1, 0, 0),
  row: new THREE.Vector3(0, 1, 0),
  depth: new THREE.Vector3(0, 0, 1),
};

// Bombs live outside the crawler sim. Commit their tile synchronously with the
// cubies so damage, disarming and rendering all read the same destination.
export function subscribeBombRotations(store, bombsRef) {
  let lastRotation = store.getState().lastRotation;
  return store.subscribe(s => s.rotationEpoch, () => {
    const { lastRotation: rot, size } = store.getState();
    if (!rot || rot === lastRotation) return;
    lastRotation = rot;
    const layers = rot.sliceIndices?.length ? rot.sliceIndices : [rot.sliceIndex];
    for (const bomb of bombsRef.current) {
      const tile = bomb.tile;
      const coordinate = rot.axis === 'col' ? tile.x : rot.axis === 'row' ? tile.y : tile.z;
      const index = layers.indexOf(coordinate);
      if (index === -1) continue;
      const dir = rot.sliceDirs?.[index] ?? rot.dir;
      const turns = rot.numTurns ?? 1;
      // Preserve the fuse's tangent direction across face changes too.
      bomb.up ??= new THREE.Vector3(...DIR_FORWARD[tile.dirKey].up);
      bomb.up.applyAxisAngle(AXES[rot.axis], dir * turns * Math.PI / 2);
      for (let turn = 0; turn < turns; turn++) {
        bomb.tile = rotateTilePosition(bomb.tile, rot.axis, coordinate, dir, size);
      }
    }
  });
}

export function createBombPose() {
  return { position: new THREE.Vector3(), rotation: new THREE.Quaternion(),
    flat: new THREE.Quaternion(), up: new THREE.Quaternion(), label: new THREE.Vector3() };
}

const tangent = new THREE.Vector3();
// Read mutable coordinates every frame: membership-only React updates do not
// rerender an existing bomb when its tile moves. Total angles never accumulate.
export function updateBombPose(pose, bomb, size) {
  const { x, y, z, dirKey } = bomb.tile;
  const normal = FACE_NORMALS[dirKey];
  if (bomb.up) tangent.copy(bomb.up);
  else tangent.fromArray(DIR_FORWARD[dirKey].up);
  pose.position.fromArray(getWormStickerWorldPos(x, y, z, dirKey, size)).addScaledVector(normal, BOMB_LIFT);
  pose.flat.setFromUnitVectors(UP, normal);
  pose.up.setFromUnitVectors(UP, tangent);
  pose.label.copy(tangent).multiplyScalar(1.15).addScaledVector(normal, 0.35);
  pose.rotation.identity();
  const angle = liveLayerAngle(x, y, z);
  if (angle !== null) {
    pose.rotation.setFromAxisAngle(AXES[liveRotation.axis], angle);
    pose.position.applyQuaternion(pose.rotation);
  }
  return pose;
}
