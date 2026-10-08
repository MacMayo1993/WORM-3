// src/3d/cubieBodyGeometry.js
//
// The cubie body's rounded box, built once per size and shared by every cubie.
//
// It is drei's <RoundedBox> geometry (same shape, bevel and crease angle), but
// drei builds a fresh ExtrudeGeometry and re-creases its normals whenever the box
// size changes. A cubie's body changes size when its look does: the classic 0.96
// piece turns into the 0.98 neon body the moment one of its faces is flipped and
// back when it heals. In Chaos that happens to some piece every few frames, and
// each rebuild (toCreasedNormals walks every vertex) was a visible hitch.
// Cached geometries are never disposed: there are only a handful of sizes.

import * as THREE from 'three';
import { toCreasedNormals } from 'three-stdlib';

export const CUBIE_BODY_RADIUS = 0.08;
const SMOOTHNESS = 4;
const BEVEL_SEGMENTS = 4;
const CREASE_ANGLE = 0.4;
const EPS = 0.00001;

const cache = new Map();

function roundedShape(width, height, radius0) {
  const shape = new THREE.Shape();
  const radius = radius0 - EPS;
  shape.absarc(EPS, EPS, EPS, -Math.PI / 2, -Math.PI, true);
  shape.absarc(EPS, height - radius * 2, EPS, Math.PI, Math.PI / 2, true);
  shape.absarc(width - radius * 2, height - radius * 2, EPS, Math.PI / 2, 0, true);
  shape.absarc(width - radius * 2, EPS, EPS, 0, -Math.PI / 2, true);
  return shape;
}

/** A centred rounded cube of edge `size`, shared; never dispose the result. */
export function cubieBodyGeometry(size, radius = CUBIE_BODY_RADIUS) {
  const key = `${size}|${radius}`;
  let geo = cache.get(key);
  if (geo) return geo;
  geo = new THREE.ExtrudeGeometry(roundedShape(size, size, radius), {
    depth: size - radius * 2,
    bevelEnabled: true,
    bevelSegments: BEVEL_SEGMENTS * 2,
    steps: 1,
    bevelSize: radius - EPS,
    bevelThickness: radius,
    curveSegments: SMOOTHNESS
  });
  geo.center();
  geo = toCreasedNormals(geo, CREASE_ANGLE);
  geo.computeBoundingSphere();
  cache.set(key, geo);
  return geo;
}
