import * as THREE from 'three';
import { findRaisedPlatform } from './healerWorm/raisedPlatforms.js';

export function nearbyPlatform(worm, size, state) {
  if (!state.wormHealerMode || state.demoMode || worm.rocketActive?.current) return null;
  if (worm.padFlight?.current) return worm.padFlight.current.end.toArray();
  const aim = findRaisedPlatform(worm.pos.current, worm.moveDir.current, size,
    { getCubies: () => state.cubies, getFlipCap: () => 6 }, worm.onRaisedPlatform?.current);
  return aim?.destination.toArray() ?? null;
}
export function makePlatformFrame() {
  return { weight: 0, probe: new THREE.Vector3(), target: new THREE.Vector3(), center: new THREE.Vector3(), cam: new THREE.Vector3(), direction: new THREE.Vector3(), rotation: new THREE.Quaternion() };
}
// Fit the entire jump span in the narrower viewport dimension. Keep a tile-sized
// margin so a portrait camera sees the cubie itself, not just its centre point.
export function framePlatform(camera, frame, target, head, normal, forward, delta) {
  const active = target && head.distanceTo(frame.probe.fromArray(target)) > 0.8;
  if (active) frame.target.fromArray(target);
  frame.weight += ((active ? 1 : 0) - frame.weight) * (1 - Math.exp(-8 * Math.min(delta, 0.05)));
  if (frame.weight < 0.001) return;
  frame.center.lerpVectors(head, frame.target, 0.5);
  const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const narrow = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
  const distance = (head.distanceTo(frame.target) / 2 + 1.15) / Math.sin(narrow);
  frame.direction.copy(normal).multiplyScalar(0.8).addScaledVector(forward, -0.7).normalize();
  frame.cam.copy(frame.center).addScaledVector(frame.direction, distance);
  frame.rotation.copy(camera.quaternion);
  camera.position.lerp(frame.cam, frame.weight);
  camera.lookAt(frame.center);
  camera.quaternion.slerp(frame.rotation, 1 - frame.weight);
  camera.updateMatrixWorld();
}
