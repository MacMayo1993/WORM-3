// src/worm/wormFaceLayout.js
// Where the worm's face goes, shared by the in-game healer worm (WormFace) and
// the preview renderer, so the two can't drift.
//
// The face used to sit on the crown of the head — the worm is normally seen from
// above, so that was the side pointing at the camera. Hats go on the crown too,
// and once hats were drawn at a size that reads on a phone, a wide brim (wizard,
// top hat, beanie, grad cap) covered the eyes completely. The face now sits on
// the upper *front* of the head, tilted towards the direction of travel, which
// is both still visible from above and clear of anything worn on top.
//
// Every measurement is a fraction of the head's radius, so one set of numbers
// works at whatever scale the head is drawn.

import * as THREE from 'three';

export const FACE_LAYOUT = {
  // Direction the face points, blended from the surface normal ("up") and the
  // way the worm is travelling ("forward").
  dirUp: 0.62,
  dirFwd: 0.79,

  eyeSide: 0.33,     // sideways offset of each eye
  eyeUp: 0.20,       // offset up the face
  eyeRadius: 0.27,
  pupilRadius: 0.13,
  pupilOut: 0.20,    // how far the pupil stands off the eye

  mouthDown: 0.30,   // offset down the face
  mouthRadius: 0.30, // the smile's arc radius
  mouthTube: 0.075,

  glassRadius: 0.33, // book worm lenses, drawn around the eyes
  glassTube: 0.055,

  // Hats sit on the crown. With the face off the crown this can be a seat
  // rather than the hover the old layout needed to keep the brim off the eyes.
  hatSeat: 0.62,
  hatScale: 0.78     // hat "head radius" argument, relative to the real one
};

// The smile is a half-torus: a real curved mouth instead of the three dots that
// vanished at thumbnail size. Its arc is the top half of the ring, so the basis
// below flips it to open upward.
export const MOUTH_ARC = Math.PI;

const _faceDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _faceUp = new THREE.Vector3();
const _basisY = new THREE.Vector3();
const _basisZ = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();

/**
 * Places the face features of one worm head.
 *
 * @param center   head centre, world space
 * @param forward  unit vector the worm is heading along
 * @param up       unit surface normal (the worm's "up")
 * @param radius   head radius in world units
 * @param parts    { eyes: [Object3D, Object3D], pupils, mouth, glasses, hat }
 *                 — any of them may be omitted
 */
export function layoutWormFace(center, forward, up, radius, parts) {
  const L = FACE_LAYOUT;

  _faceDir.copy(up).multiplyScalar(L.dirUp).addScaledVector(forward, L.dirFwd).normalize();
  _right.crossVectors(forward, up);
  if (_right.lengthSq() < 1e-6) _right.set(0, 0, 1);
  _right.normalize();
  _faceUp.crossVectors(_right, _faceDir).normalize();

  // A feature at (side, up) on the face plane, pushed out to the head's surface
  // so it sits on the sphere rather than inside or floating off it.
  const place = (side, upOff, extraLateral = 0) => {
    const lateral = Math.sqrt(side * side + upOff * upOff + extraLateral * extraLateral);
    const depth = Math.sqrt(Math.max(0.0001, radius * radius - lateral * lateral));
    return _pos.copy(center)
      .addScaledVector(_faceDir, depth)
      .addScaledVector(_right, side)
      .addScaledVector(_faceUp, upOff);
  };

  const eyeSide = radius * L.eyeSide;
  const eyeUp = radius * L.eyeUp;

  if (parts.eyes) {
    for (let i = 0; i < 2; i++) {
      const eye = parts.eyes[i];
      if (!eye) continue;
      eye.position.copy(place(i === 0 ? eyeSide : -eyeSide, eyeUp));
      eye.scale.setScalar(radius * L.eyeRadius);
      if (parts.pupils?.[i]) {
        const pupil = parts.pupils[i];
        pupil.position.copy(eye.position).addScaledVector(_faceDir, radius * L.pupilOut);
        pupil.scale.setScalar(radius * L.pupilRadius);
      }
    }
  }

  if (parts.glasses) {
    // Lens rings share the eye positions; the torus lies in the face plane.
    _basisY.copy(_faceUp);
    _basisZ.copy(_faceDir);
    _matrix.makeBasis(_right, _basisY, _basisZ);
    _quat.setFromRotationMatrix(_matrix);
    for (let i = 0; i < 2; i++) {
      const glass = parts.glasses[i];
      if (!glass) continue;
      glass.position.copy(place(i === 0 ? eyeSide : -eyeSide, eyeUp, radius * L.glassRadius));
      glass.quaternion.copy(_quat);
      glass.scale.setScalar(radius * L.glassRadius);
    }
  }

  if (parts.mouth) {
    // Flip the arc so its drawn half curves downward — a smile, not a frown.
    _basisY.copy(_faceUp).negate();
    _basisZ.crossVectors(_right, _basisY);
    _matrix.makeBasis(_right, _basisY, _basisZ);
    _quat.setFromRotationMatrix(_matrix);
    parts.mouth.position.copy(place(0, -radius * L.mouthDown, radius * L.mouthRadius));
    parts.mouth.quaternion.copy(_quat);
    parts.mouth.scale.setScalar(radius * L.mouthRadius);
  }

  if (parts.hat) {
    parts.hat.position.copy(center).addScaledVector(up, radius * L.hatSeat);
  }
}
