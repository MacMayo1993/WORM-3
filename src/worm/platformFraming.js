import * as THREE from 'three';
import { findRaisedPlatform } from './healerWorm/raisedPlatforms.js';
import { selectEffectiveFlipCap } from '../hooks/useGameStore.js';

export function nearbyPlatform(worm, size, state) {
  if (!state.wormHealerMode || worm.rocketActive?.current) return null;
  if (worm.padFlight?.current) return worm.padFlight.current.end.toArray();
  const aim = findRaisedPlatform(worm.pos.current, worm.moveDir.current, size,
    { getCubies: () => state.cubies, getFlipCap: () => selectEffectiveFlipCap(state) }, worm.onRaisedPlatform?.current);
  return aim?.destination.toArray() ?? null;
}
export function makePlatformFrame() {
  return { weight: 0, rate: 0, probe: new THREE.Vector3(), target: new THREE.Vector3(), center: new THREE.Vector3(), cam: new THREE.Vector3(), direction: new THREE.Vector3(), rotation: new THREE.Quaternion() };
}
export function resetPlatformFrame(frame) {
  frame.weight = 0;
  frame.rate = 0;
}
// Critically damped: the lens eases into and out of the framing without a kick.
const FRAME_RESPONSE = 7;
// Fit the entire jump span in the narrower viewport dimension. Keep a tile-sized
// margin so a portrait camera sees the cubie itself, not just its centre point.
// Crawling up to a platform, the framing hands back to the chase by distance as
// the head closes on it. A jump in flight keeps the worm and its landing framed
// until touchdown: the chase alone lags a flying head out of the top of the view.
export function framePlatform(camera, frame, target, head, normal, forward, delta, inFlight = false) {
  const reach = !target ? 0 : inFlight ? 1 : THREE.MathUtils.smoothstep(head.distanceTo(frame.probe.fromArray(target)), 0.8, 1.5);
  if (reach > 0) frame.target.fromArray(target);
  const dt = Math.min(delta, 0.05);
  frame.rate += (FRAME_RESPONSE * FRAME_RESPONSE * (reach - frame.weight) - 2 * FRAME_RESPONSE * frame.rate) * dt;
  frame.weight += frame.rate * dt;
  if (frame.weight <= 0 || frame.weight >= 1) {
    frame.weight = THREE.MathUtils.clamp(frame.weight, 0, 1);
    frame.rate = 0;
  }
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
