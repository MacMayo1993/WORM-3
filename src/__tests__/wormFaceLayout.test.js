// The worm's face and its hat used to share the crown of its head: the face was
// placed along the surface normal because the game camera looks down at it, and
// hats go on top for the same reason. Once hats were drawn large enough to read
// on a phone, a wide brim (wizard, top hat, beanie, grad cap) covered the eyes
// completely. These tests pin the geometry that fixed it.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { layoutWormFace, FACE_LAYOUT } from '../worm/wormFaceLayout.js';

const RADIUS = 0.092;

function layout({ center = [0, 0, 0], forward = [1, 0, 0], up = [0, 1, 0] } = {}) {
  const parts = {
    eyes: [new THREE.Object3D(), new THREE.Object3D()],
    pupils: [new THREE.Object3D(), new THREE.Object3D()],
    glasses: [new THREE.Object3D(), new THREE.Object3D()],
    mouth: new THREE.Object3D(),
    hat: new THREE.Object3D()
  };
  layoutWormFace(
    new THREE.Vector3(...center),
    new THREE.Vector3(...forward),
    new THREE.Vector3(...up),
    RADIUS,
    parts
  );
  return parts;
}

describe('worm face layout', () => {
  it('puts every feature on the head, not inside it or floating off it', () => {
    const { eyes, mouth } = layout();
    for (const feature of [...eyes, mouth]) {
      const d = feature.position.length();
      expect(d).toBeLessThanOrEqual(RADIUS + 1e-9);
      expect(d).toBeGreaterThan(RADIUS * 0.5);
    }
  });

  it('keeps the face off the crown, where hats sit', () => {
    // The regression: the face was placed straight up the surface normal, the
    // same spot a hat lands on, so a wide brim covered the eyes. The face has to
    // stay tilted well off that axis — well over 40° — for anything worn on the
    // crown to clear it.
    const up = new THREE.Vector3(0, 1, 0);
    const { eyes, mouth, hat } = layout();
    expect(hat.position.y).toBeCloseTo(RADIUS * FACE_LAYOUT.hatSeat, 6);

    for (const feature of [...eyes, mouth]) {
      const tilt = feature.position.clone().normalize().angleTo(up);
      expect(tilt).toBeGreaterThan(Math.PI / 4.5); // > 40°
      // And nothing reaches the top of the head, which the hat needs.
      expect(feature.position.y).toBeLessThan(RADIUS * 0.8);
    }
  });

  it('faces the way the worm is travelling', () => {
    const { eyes, mouth } = layout();
    // Forward is +X here, so the face leans that way rather than straight up.
    for (const feature of [...eyes, mouth]) {
      expect(feature.position.x).toBeGreaterThan(0);
    }
    // Eyes above the mouth, on the face.
    expect(eyes[0].position.y).toBeGreaterThan(mouth.position.y);
  });

  it('mirrors the eyes across the worm\'s centre line', () => {
    const { eyes, pupils } = layout();
    expect(eyes[0].position.x).toBeCloseTo(eyes[1].position.x, 9);
    expect(eyes[0].position.y).toBeCloseTo(eyes[1].position.y, 9);
    expect(eyes[0].position.z).toBeCloseTo(-eyes[1].position.z, 9);
    // Pupils stand off their own eye, towards the viewer.
    for (let i = 0; i < 2; i++) {
      const offset = pupils[i].position.distanceTo(eyes[i].position);
      expect(offset).toBeCloseTo(RADIUS * FACE_LAYOUT.pupilOut, 6);
    }
  });

  it('follows the head wherever it is and whichever way it points', () => {
    const moved = layout({ center: [3, -2, 5], forward: [0, 0, -1], up: [0, 1, 0] });
    const center = new THREE.Vector3(3, -2, 5);
    for (const feature of [...moved.eyes, moved.mouth]) {
      expect(feature.position.distanceTo(center)).toBeLessThanOrEqual(RADIUS + 1e-9);
      // Facing -Z now, so the face leads that way.
      expect(feature.position.z).toBeLessThan(5);
    }
  });

  it('scales every feature with the head', () => {
    const { eyes, mouth } = layout();
    expect(eyes[0].scale.x).toBeCloseTo(RADIUS * FACE_LAYOUT.eyeRadius, 9);
    expect(mouth.scale.x).toBeCloseTo(RADIUS * FACE_LAYOUT.mouthRadius, 9);
  });
});
