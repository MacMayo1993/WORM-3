// src/worm/healerWorm/rumbleBand.js
//
// How the Rumbler's crests are drawn (Rumbler.jsx): a band over the grout of one
// belt, darkest in the channels between tiles, its crest a·sech²(d/λ) over the
// wrapped belt distance (rumbler.js). One geometry per belt, built once and kept.

import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { DIR_FORWARD, FACE_NORMALS } from './constants.js';
import { beltRing } from './rumbler.js';

// Just proud of the stickers (SURFACE_OFFSET 0.52 puts the sticker face at 0.51).
const BAND_LIFT = 0.012;
// A shadow over the tiles, and a dim violet charge in the grout: the grout is near
// black in WORM, so a band that only darkened it would not show.
const BAND_SHADOW = new THREE.Color('#05030a');
const BAND_SEAM = new THREE.Color('#5a3d8f');

const _beltGeometry = new Map();
/**
 * One quad per belt cell, laid along the walk so `aAlong` runs continuously round
 * the belt (cell i spans i − 0.5 … i + 0.5). Cached per (size, axis, index) and
 * never disposed, like the slice rims (teach/layerGlow.js).
 */
export function getBeltGeometry(size, axis, index) {
  const cacheKey = `${size}:${axis}:${index}`;
  const hit = _beltGeometry.get(cacheKey);
  if (hit) return hit;
  const ring = beltRing(size, axis, index);
  const position = [], uv = [], along = [], indices = [];
  const n = new THREE.Vector3(), f = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  ring.tiles.forEach((tile, i) => {
    n.copy(FACE_NORMALS[tile.dirKey]);
    f.fromArray(DIR_FORWARD[tile.dirKey][ring.moves[i]]);
    v.crossVectors(n, f);
    c.fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0)).addScaledVector(n, BAND_LIFT);
    const base = i * 4;
    for (const [su, sv] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      p.copy(c).addScaledVector(f, su).addScaledVector(v, sv);
      position.push(p.x, p.y, p.z);
      uv.push(su + 0.5, sv + 0.5);
      along.push(i + su);
    }
    // Wind each quad to face out of the cube.
    if (f.clone().cross(v).dot(n) > 0) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geo.setIndex(indices);
  _beltGeometry.set(cacheKey, geo);
  return geo;
}

const vertexShader = /* glsl */ `
  attribute float aAlong;
  varying float vAlong;
  varying vec2 vUv;
  void main() {
    vAlong = aAlong;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The crest as a·sech²(d/λ) over the wrapped belt distance: a swell of shadow over
// the tiles, and a line of violet along the grout channels between them.
const fragmentShader = /* glsl */ `
  uniform vec3 uShadow;
  uniform vec3 uSeam;
  uniform float uCrest;
  uniform float uLength;
  uniform float uStrength;
  uniform float uStill;
  varying float vAlong;
  varying vec2 vUv;
  void main() {
    float d = abs(mod(vAlong - uCrest + 0.5 * uLength, uLength) - 0.5 * uLength);
    float e = exp(d / 0.9);
    float crest = 4.0 / ((e + 1.0 / e) * (e + 1.0 / e));
    float band = mix(crest, 1.0, uStill) * uStrength;
    vec2 edge = abs(vUv - 0.5);
    float groove = smoothstep(0.39, 0.47, max(edge.x, edge.y));
    float a = band * mix(0.34, 0.6, groove);
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uShadow, uSeam, groove), a);
  }
`;

export function makeBandMesh() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uShadow: { value: BAND_SHADOW },
      uSeam: { value: BAND_SEAM },
      uCrest: { value: 0 },
      uLength: { value: 12 },
      uStrength: { value: 0 },
      uStill: { value: 0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const mesh = new THREE.Mesh(getBeltGeometry(3, 'col', 1), material);
  mesh.name = 'rumbler-band';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 2;
  mesh.raycast = () => null;
  return mesh;
}
