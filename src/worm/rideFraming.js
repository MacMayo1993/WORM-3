// src/worm/rideFraming.js
//
// Keeps the worm's head on screen during a tunnel ride.
//
// The rail (tunnelCameraRails.js) aims down the route: mostly along the lens's
// own direction of travel, leaned toward where the route goes next. That is the
// right shot down a straight arm, but on a bent or corner route the head is
// round the bend from the lens, and on a portrait phone (a half-width under 30°
// in the tunnel) the exit arm put it past the edge of the frame. Where slice
// turns had put both mouths on one face, the route doubles back and the head
// went behind the lens altogether.
//
// So the rail's aim is a composition, not a constraint: the ride turns its
// target the least it takes to hold the head inside a box of the frame (and
// back toward it when it is behind), the usual smoothing then follows that
// target, and a wider box is enforced on the smoothed lens as a last resort.
// While the head is already inside, nothing changes. Pure: no React, no r3f.

import * as THREE from 'three';

/** Where the rail may leave the head: this share of each half-extent from the centre. */
export const RIDE_FRAME = 0.5;
/** In the crossing close-up the subject is the core's opening, which the lens
 *  centres: a head the lens can see is inside it by construction, and one it
 *  cannot is behind the core's wall, so there the head is only kept on screen. */
export const CLOSE_UP_FRAME = 0.92;
/** The smoothed lens never lets the head past this share, whatever it lags. */
export const RIDE_FRAME_LIMIT = 0.8;

const _rel = new THREE.Vector3();
const _seen = new THREE.Vector3();
const _wanted = new THREE.Vector3();
const _inverse = new THREE.Quaternion();
const _turn = new THREE.Quaternion();

/**
 * Turn `camera` ({ position, quaternion, fov, aspect }, an optional `up` kept in
 * step) the least it takes to put `point` inside the box ±x by ±y of its frame,
 * in shares of the half-width and half-height. A point behind the lens is
 * turned to the centre when `behind` is set and left alone otherwise. Returns
 * the turn in radians (0 when the point was already inside).
 */
export function keepInFrame(camera, point, x, y, behind = false) {
  _rel.subVectors(point, camera.position).applyQuaternion(_inverse.copy(camera.quaternion).invert());
  const depth = -_rel.z;
  if (depth > 1e-4) {
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanX = tanY * camera.aspect;
    const px = _rel.x / depth, py = _rel.y / depth;
    const cx = THREE.MathUtils.clamp(px, -x * tanX, x * tanX);
    const cy = THREE.MathUtils.clamp(py, -y * tanY, y * tanY);
    if (cx === px && cy === py) return 0;
    _wanted.set(cx, cy, -1).normalize();
    _seen.set(px, py, -1).normalize();
  } else {
    if (!behind || _rel.lengthSq() < 1e-12) return 0;
    _wanted.set(0, 0, -1);
    _seen.copy(_rel).normalize();
  }
  // The turn that carries where the point should be onto where it is: applied
  // to the camera, the point then sits on the box's edge.
  _turn.setFromUnitVectors(_wanted, _seen);
  camera.quaternion.multiply(_turn);
  camera.up?.set(0, 1, 0).applyQuaternion(camera.quaternion);
  return _wanted.angleTo(_seen);
}

const _basis = new THREE.Matrix4();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _target = { position: null, quaternion: new THREE.Quaternion(), fov: 60, aspect: 1 };

/**
 * Point `camera` along a rail pose ({ cam, look, up }) with its head framed:
 * the pose's orientation turned to hold `head` inside RIDE_FRAME, slerped by
 * `alpha` from where the lens was, then held inside RIDE_FRAME_LIMIT; both relax
 * toward CLOSE_UP_FRAME with `closeUp`. Writes position, quaternion and up.
 */
export function frameRide(camera, pose, head, alpha = 1, closeUp = 0) {
  _dir.subVectors(pose.look, pose.cam);
  if (_dir.lengthSq() < 1e-12) _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _dir.normalize();
  _up.copy(pose.up).addScaledVector(_dir, -pose.up.dot(_dir));
  if (_up.lengthSq() < 1e-8) _up.copy(camera.up).addScaledVector(_dir, -camera.up.dot(_dir));
  if (_up.lengthSq() < 1e-8) _up.set(Math.abs(_dir.y) > 0.9 ? 1 : 0, Math.abs(_dir.y) > 0.9 ? 0 : 1, 0).addScaledVector(_dir, -_dir.y);
  _target.quaternion.setFromRotationMatrix(_basis.lookAt(pose.cam, _dir.add(pose.cam), _up.normalize()));
  _target.position = pose.cam;
  _target.fov = camera.fov;
  _target.aspect = camera.aspect;
  const box = THREE.MathUtils.lerp(RIDE_FRAME, CLOSE_UP_FRAME, closeUp);
  keepInFrame(_target, head, box, box, true);
  camera.position.copy(pose.cam);
  camera.quaternion.slerp(_target.quaternion, alpha);
  // No turn-rate cap: where a route doubles back (both mouths on one face) the
  // head sweeps past the lens at under half a unit, and any cap loses it behind.
  const limit = THREE.MathUtils.lerp(RIDE_FRAME_LIMIT, CLOSE_UP_FRAME, closeUp);
  keepInFrame(camera, head, limit, limit);
  camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  return camera;
}
