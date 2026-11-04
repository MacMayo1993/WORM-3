// src/worm/healerWorm/elementalOrbShapes.js
//
// The sculpture at the heart of each elemental pickup. Six glass spheres that
// differed only in tint read as one pickup in six colours (Water, Ice and Air are
// all pale blues), and flat billboarded cut-outs read as clip art. So every element
// is a small 3D relic whose silhouette IS its HUD icon, solid enough to turn on its
// axis and still read:
//
//   water     — a droplet, point up
//   fire      — a crown of flame: a tall tongue ringed by four shorter ones
//   grass     — a floating island: rock underside, grass top, a peak and a tree
//               (Earth's icon is a mountain)
//   ice       — a cluster of hexagonal crystals
//   lightning — the HUD's own bolt, extruded and bevelled
//   air       — a tornado with a helical ridge winding up it, wide end up
//
// Every geometry carries two extra attributes for the body shader
// (elementalOrbShader.js):
//
//   aPart   — which piece a vertex belongs to (the island's rock / grass / trunk /
//             leaves, the cluster's main crystal / side crystals), so one draw can
//             paint several materials;
//   aSmooth — the vertex normal averaged over every vertex at the same position.
//             The ink hull is pushed out along it, so a faceted relic still gets a
//             closed outline instead of one split open at every hard edge.
//
// Every shape is authored in the relic's local frame (+Y is screen-up once the
// pickup billboards) inside a 0.7 radius. Built once per element at first use and
// never disposed: at most six exist, shared by every pickup ever spawned.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const lathe = (points, segments) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);

// Teardrop profile: x = sin t · sin^m(t/2), y = cos t, t ∈ [0, π]. Point at the top,
// round at the bottom; a larger `m` draws the tip out longer and thinner.
function teardrop(m, width, height, steps = 32) {
  const pts = [];
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * Math.PI;
    pts.push([Math.sin(t) * Math.pow(Math.sin(t / 2), m) * width, Math.cos(t) * height]);
  }
  return pts;
}

// A small deterministic hash of a position, so a vertex shared by several faces of
// a non-indexed solid moves the same way in each and the solid stays closed.
const hash3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const hashOf = (x, y, z) => hash3(Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000));

/** Keep only position and normal, so pieces built by different three helpers merge. */
function bare(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
  }
  geometry.clearGroups();
  return geometry;
}

/** Smooth shading: weld the seams a lathe leaves, then average normals. */
function smooth(geometry) {
  bare(geometry);
  geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry, 1e-4);
  if (welded !== geometry) geometry.dispose();
  welded.computeVertexNormals();
  return welded;
}

/** Flat shading: every facet lit on its own, so crystal and rock glint face by face. */
function faceted(geometry) {
  bare(geometry);
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** Tag every vertex of `geometry` as piece `id`; non-indexed so pieces can merge. */
function part(geometry, id) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(flat.attributes.position.count).fill(id), 1));
  return flat;
}

function merge(parts) {
  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return geo;
}

/** The outline direction: normals averaged over every vertex sharing a position. */
function addSmoothNormals(geometry) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const sums = new Map();
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    keys[i] = key;
    const s = sums.get(key) ?? [0, 0, 0];
    s[0] += nrm.getX(i);
    s[1] += nrm.getY(i);
    s[2] += nrm.getZ(i);
    sums.set(key, s);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let [x, y, z] = sums.get(keys[i]);
    // A lathe's needle tip can be all degenerate triangles: point it outward.
    if (Math.hypot(x, y, z) < 1e-6) [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const len = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / len;
    out[i * 3 + 1] = y / len;
    out[i * 3 + 2] = z / len;
  }
  geometry.setAttribute('aSmooth', new THREE.Float32BufferAttribute(out, 3));
  return geometry;
}

// ── Water ────────────────────────────────────────────────────────────────────
function droplet() {
  const geo = smooth(lathe(teardrop(1.25, 0.66, 0.52), 40));
  geo.translate(0, 0.02, 0);
  return part(geo, 0);
}

// ── Fire ─────────────────────────────────────────────────────────────────────
// One teardrop alone reads as Water's droplet in red. A crown of tongues keeps
// several tips in the outline from any side, which is what says "flame".
function flame() {
  const main = smooth(lathe(teardrop(2.2, 0.6, 0.56), 32));
  main.translate(0, 0.04, 0);
  const parts = [part(main, 0)];
  for (let i = 0; i < 4; i++) {
    const tall = i % 2 === 0;
    const tongue = smooth(lathe(teardrop(2.4, tall ? 0.42 : 0.36, tall ? 0.36 : 0.28), 20));
    tongue.rotateZ(tall ? -0.5 : -0.7); // lean outward (+X), then swing round the axis
    tongue.translate(0.22, tall ? -0.06 : -0.14, 0);
    tongue.rotateY((i / 4) * Math.PI * 2 + 0.4);
    parts.push(part(tongue, 1));
  }
  return merge(parts);
}

// ── Earth ────────────────────────────────────────────────────────────────────
// Pieces: 0 rock, 1 grass, 2 trunk, 3 leaves. Low-poly and faceted on purpose:
// the whole island reads as one crafted piece, like the worm's handmade hats.
function floatingIsland() {
  // Rock underside: a jagged inverted cone hanging from the grass rim.
  const rockPts = [[0, -0.5], [0.12, -0.36], [0.27, -0.2], [0.4, -0.05], [0.43, 0.01]];
  const rock = lathe(rockPts, 9);
  const pos = rock.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > -0.02) continue; // keep the rim true so the grass cap seals it
    const k = 0.82 + 0.3 * hashOf(x, y, z);
    pos.setXYZ(i, x * k, y + (hashOf(z, x, y) - 0.5) * 0.06, z * k);
  }
  const grass = new THREE.CylinderGeometry(0.45, 0.43, 0.09, 9, 1);
  grass.translate(0, 0.05, 0);
  const peak = new THREE.ConeGeometry(0.19, 0.36, 5, 1);
  peak.translate(-0.13, 0.27, -0.06);
  const knoll = new THREE.ConeGeometry(0.12, 0.2, 5, 1);
  knoll.translate(-0.28, 0.19, 0.1);
  const trunk = new THREE.CylinderGeometry(0.026, 0.04, 0.2, 5, 1);
  trunk.translate(0.17, 0.19, 0.08);
  const crown = new THREE.IcosahedronGeometry(0.13, 0);
  crown.translate(0.17, 0.36, 0.08);
  const bush = new THREE.IcosahedronGeometry(0.075, 0);
  bush.translate(0.3, 0.14, -0.12);
  // A pebble breaking off below, so the island reads as floating, not sitting.
  const pebble = new THREE.IcosahedronGeometry(0.06, 0);
  pebble.translate(0.06, -0.6, 0.03);
  return merge([
    part(faceted(rock), 0), part(faceted(peak), 0), part(faceted(knoll), 0), part(faceted(pebble), 0),
    part(faceted(grass), 1),
    part(faceted(trunk), 2),
    part(faceted(crown), 3), part(faceted(bush), 3)
  ]);
}

// ── Ice ──────────────────────────────────────────────────────────────────────
// Pieces: 0 the tall central crystal, 1 the shorter ones leaning off its foot.
const crystalProfile = (r, bottom, shoulder, top) => [[0, bottom], [r, bottom + 0.1], [r, shoulder], [0, top]];
function crystalCluster() {
  const main = faceted(lathe(crystalProfile(0.19, -0.5, 0.26, 0.62), 6));
  const sides = [
    { r: 0.13, h: 0.42, x: 0.2, z: 0.06, lean: -0.55, spin: 0.3 },
    { r: 0.11, h: 0.32, x: -0.21, z: 0.04, lean: 0.6, spin: 0.9 },
    { r: 0.09, h: 0.26, x: 0.02, z: -0.2, lean: 0.5, spin: 2.2, tilt: true }
  ].map(({ r, h, x, z, lean, spin, tilt }) => {
    const g = faceted(lathe(crystalProfile(r, -0.2, -0.2 + h * 0.6, -0.2 + h), 6));
    g.rotateY(spin);
    if (tilt) g.rotateX(lean);
    else g.rotateZ(lean);
    g.translate(x, -0.28, z);
    return part(g, 1);
  });
  return merge([part(main, 0), ...sides]);
}

// ── Lightning ────────────────────────────────────────────────────────────────
// The HUD's bolt (elementalDefs' iconPath, a 24×24 viewBox with y down), extruded
// and bevelled so it has a body to turn and catch light.
const BOLT = [[13.6, 1.8], [4.2, 13.4], [9.6, 13.4], [8.4, 22.2], [17.8, 10.6], [12.4, 10.6]];
function bolt() {
  const s = 0.054;
  const shape = new THREE.Shape(BOLT.map(([x, y]) => new THREE.Vector2((x - 11) * s, (12 - y) * s)).reverse());
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 1
  });
  geo.translate(0, 0, -0.07);
  return part(faceted(geo), 0);
}

// ── Air ──────────────────────────────────────────────────────────────────────
// A funnel whose wall winds a three-start helical ridge up to its mouth, so it
// reads as spinning air from the side rather than as a plain cone.
function tornado() {
  const pts = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    pts.push([0.05 + 0.37 * Math.pow(s, 1.6), -0.54 + s * 1.04]);
  }
  pts.push([0.3, 0.5], [0, 0.47]); // a shallow lid, so the body is a solid, not a cup
  const geo = lathe(pts, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 0.49) continue;
    const a = Math.atan2(z, x);
    const k = 1 + 0.16 * Math.sin(3 * a + (y + 0.54) * 11);
    pos.setXYZ(i, x * k, y, z * k);
  }
  return part(smooth(geo), 0);
}

const BUILDERS = {
  water: droplet,
  fire: flame,
  grass: floatingIsland,
  ice: crystalCluster,
  lightning: bolt,
  air: tornado
};

/** Elements with a body shape of their own; anything else falls back to a sphere. */
export const ORB_SHAPE_TYPES = Object.keys(BUILDERS);

const _shapes = new Map();
let _sphere = null;

function finish(geometry) {
  addSmoothNormals(geometry);
  geometry.computeBoundingSphere();
  return geometry;
}

/** The body geometry for `element`, built once and shared. */
export function getElementalOrbShape(element) {
  const hit = _shapes.get(element);
  if (hit) return hit;
  const build = BUILDERS[element];
  if (!build) return (_sphere ??= finish(part(bare(new THREE.SphereGeometry(0.42, 28, 20)), 0)));
  const geo = finish(build());
  _shapes.set(element, geo);
  return geo;
}
