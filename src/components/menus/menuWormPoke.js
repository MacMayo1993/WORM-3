import * as THREE from 'three';
import { menuPointer, pointerIsFresh } from './menuPointer.js';

const _p = new THREE.Vector3(), _center = new THREE.Vector3(), _toCamera = new THREE.Vector3(), _out = new THREE.Vector3();
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();

/**
 * Refresh a poke target from a rig: segments `indices` projected to client
 * pixels. A worm round the back of the cube (head facing away from the
 * camera) can't be poked through it.
 */
export function updatePokeTarget(target, rig, camera, size, indices, reach = 36) {
  target.reach = reach;
  target.count = 0;
  target.visible = false;
  if (!rig.group.visible || !rig.segments[0].holder.visible) return target;
  rig.group.getWorldPosition(_center);
  rig.segmentWorldInto(0, _p);
  _out.subVectors(_p, _center);
  _toCamera.subVectors(camera.position, _p);
  if (_out.dot(_toCamera) <= 0) return target;
  for (const i of indices) {
    if (!rig.segments[i]?.holder.visible) continue;
    rig.segmentWorldInto(i, _p).project(camera);
    if (_p.z > 1) continue;
    target.points[target.count * 2] = (size.left ?? 0) + (_p.x + 1) * 0.5 * size.width;
    target.points[target.count * 2 + 1] = (size.top ?? 0) + (1 - _p.y) * 0.5 * size.height;
    target.count++;
  }
  target.visible = target.count > 0;
  return target;
}

/**
 * The point the worms look at: along the pointer's ray, level with the cube
 * (a little in front, so a worm on a side face turns to face the player).
 * Null when the pointer has been still too long.
 */
export function pointerLookPoint(out, camera, cubeCenter) {
  if (!pointerIsFresh()) return null;
  _ndc.set(menuPointer.x, menuPointer.y);
  _ray.setFromCamera(_ndc, camera);
  const depth = camera.position.distanceTo(cubeCenter) * 0.8;
  return out.copy(_ray.ray.origin).addScaledVector(_ray.ray.direction, depth);
}
