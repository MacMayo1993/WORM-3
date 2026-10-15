// src/worm/healerWorm/elementalOrbShapes.js
//
// The silhouette of each elemental pickup. Six glass spheres that differed only in
// tint read as one pickup in six colours, and Water, Ice and Air are all pale blues,
// so on a busy cube they were a guess. Each element now has its own body shape,
// echoing its HUD icon so the orb and the chip read as the same thing:
//
//   water     — a droplet, point up
//   fire      — a crown of flame: a tall tongue ringed by three shorter ones
//   grass     — a faceted boulder (Earth's icon is a mountain)
//   ice       — a hexagonal crystal with pyramid ends
//   lightning — a spiked charge star
//   air       — a funnel tornado, wide end up
//
// Every shape is authored in the orb's local frame (+Y is screen-up once the orb
// billboards) inside roughly the old 0.42 shell radius, so the orb's furniture
// still fits round it. Built once per element at first use and never disposed:
// at most six exist, shared by every orb ever spawned.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const lathe = (points, segments) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);

// Teardrop profile: x = sin t · sin^m(t/2), y = cos t, t ∈ [0, π]. Point at the top,
// round at the bottom; a larger `m` draws the tip out longer and thinner.
function teardrop(m, width, height, steps = 28) {
  const pts = [];
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * Math.PI;
    pts.push([Math.sin(t) * Math.pow(Math.sin(t / 2), m) * width, Math.cos(t) * height]);
  }
  return pts;
}

// Flat-shaded facets: the crystal and the rock should glint face by face.
function faceted(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

// A small deterministic hash of a position, so a vertex shared by several faces of
// a non-indexed polyhedron moves the same way in each and the rock stays closed.
const hash3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

function boulder() {
  const geo = new THREE.IcosahedronGeometry(0.4, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 0.8 + 0.32 * hash3(Math.round(v.x * 1000), Math.round(v.y * 1000), Math.round(v.z * 1000));
    // Squat: a boulder sits, it does not stand.
    pos.setXYZ(i, v.x * k * 1.08, v.y * k * 0.88, v.z * k * 1.08);
  }
  return faceted(geo);
}

function crystal() {
  // Six lathe segments make a hexagonal prism; the profile caps it with pyramids.
  return faceted(lathe([[0, -0.54], [0.27, -0.2], [0.27, 0.22], [0, 0.6]], 6));
}

function chargeStar() {
  const base = new THREE.IcosahedronGeometry(0.29, 0);
  const src = base.attributes.position;
  const out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), apex = new THREE.Vector3();
  for (let i = 0; i < src.count; i += 3) {
    a.fromBufferAttribute(src, i);
    b.fromBufferAttribute(src, i + 1);
    c.fromBufferAttribute(src, i + 2);
    // Each face raised into a spike: three triangles meeting at an apex pushed out
    // along the face's centroid. Winding stays outward because the apex is.
    apex.copy(a).add(b).add(c).normalize().multiplyScalar(0.52);
    for (const [p, q] of [[a, b], [b, c], [c, a]]) out.push(p.x, p.y, p.z, q.x, q.y, q.z, apex.x, apex.y, apex.z);
  }
  base.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  return geo;
}

// One teardrop alone reads as Water's droplet in red. A crown of tongues keeps
// several tips in the outline from any side, which is what says "flame".
function flame() {
  const parts = [lathe(teardrop(2, 0.56, 0.52), 28)];
  parts[0].translate(0, 0.04, 0);
  for (let i = 0; i < 3; i++) {
    const tongue = lathe(teardrop(2.2, 0.46, 0.36), 18);
    tongue.rotateZ(-0.55); // lean outward (+X), then swing round the axis
    tongue.translate(0.22, -0.08, 0);
    tongue.rotateY((i / 3) * Math.PI * 2 + 0.5);
    parts.push(tongue);
  }
  const geo = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geo;
}

function tornado() {
  const pts = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    pts.push([0.05 + 0.37 * Math.pow(s, 1.5), -0.5 + s * 1.0]);
  }
  // Close the mouth of the funnel so the body is a solid, not a cup.
  pts.push([0, 0.5]);
  const geo = lathe(pts, 28);
  geo.computeVertexNormals();
  return geo;
}

const BUILDERS = {
  water: () => lathe(teardrop(1, 0.6, 0.5), 28),
  fire: flame,
  grass: boulder,
  ice: crystal,
  lightning: chargeStar,
  air: tornado
};

/** Elements with a body shape of their own; anything else falls back to a sphere. */
export const ORB_SHAPE_TYPES = Object.keys(BUILDERS);

const _shapes = new Map();
let _sphere = null;

/** The body geometry for `element`, built once and shared. */
export function getElementalOrbShape(element) {
  const hit = _shapes.get(element);
  if (hit) return hit;
  const build = BUILDERS[element];
  if (!build) return (_sphere ??= new THREE.SphereGeometry(0.42, 28, 20));
  const geo = build();
  geo.computeBoundingSphere();
  _shapes.set(element, geo);
  return geo;
}
