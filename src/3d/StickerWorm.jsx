// src/3d/StickerWorm.jsx
// Worm creature for disparity / wormhole visualization.
// Lies flat on the tile surface and undulates with a travelling sine wave.
//
// A worm is two draws: its five body beads merged into one mesh, bobbing in the
// vertex shader, and its five soft glows merged into another. It used to be ten
// meshes with a useFrame each, and Chaos puts up to four worms on every flipped
// tile plus two round every tombstone — on a 4×4 storm that was ~650 draws a
// frame, the largest single cost in the scene. Geometry is cached per look and
// both materials are shared, so a worm allocates nothing and is never disposed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stickerWormTime, stickerWormBodyMaterial as bodyMaterial, stickerWormGlowMaterial as glowMaterial, STICKER_WORM_AMP as AMP } from './stickerWormMaterials.js';

// Head → tail: bead radius, height off the tile, colour. Spacing scales with the
// worm; the beads themselves do not (as before).
const BEADS = [
  { r: 0.028, z: 0.026, color: '#f2c38b', seg: [10, 10] },
  { r: 0.024, z: 0.024, color: '#dda15e', seg: [8, 8] },
  { r: 0.022, z: 0.023, color: '#bc6c25', seg: [8, 8] },
  { r: 0.020, z: 0.022, color: '#a05c20', seg: [8, 8] },
  { r: 0.016, z: 0.021, color: '#8f4e1b', seg: [8, 8] }
];
const GLOW_R = 0.045;
const GLOW_Z = 0.018;
const GLOW_COLOR = '#ffe6c6';

function fill(geo, name, size, values) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = values[k];
  geo.setAttribute(name, new THREE.BufferAttribute(arr, size));
}

const _color = new THREE.Color();
const bodyCache = new Map();
const glowCache = new Map();

/** Five beads along local +X (head first), phase and amplitude baked per vertex. */
function bodyGeometry(scale, phase) {
  const key = `${scale}|${phase}`;
  let geo = bodyCache.get(key);
  if (geo) return geo;
  const sp = 0.034 * scale;
  geo = mergeGeometries(BEADS.map((b, i) => {
    const g = new THREE.SphereGeometry(b.r, b.seg[0], b.seg[1]);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g.translate(sp * (2 - i), 0, b.z);
    _color.set(b.color);
    fill(g, 'aColor', 3, [_color.r, _color.g, _color.b]);
    fill(g, 'aSeg', 1, [i]);
    fill(g, 'aPhase', 1, [phase]);
    fill(g, 'aAmp', 1, [AMP * scale]);
    return g;
  }));
  bodyCache.set(key, geo);
  return geo;
}

function glowGeometry(scale) {
  let geo = glowCache.get(scale);
  if (geo) return geo;
  const sp = 0.034 * scale;
  _color.set(GLOW_COLOR);
  geo = mergeGeometries(BEADS.map((_, i) => {
    const g = new THREE.SphereGeometry(GLOW_R, 10, 10);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g.translate(sp * (2 - i), 0, GLOW_Z);
    fill(g, 'color', 4, [_color.r, _color.g, _color.b, i === 0 ? 0.24 : 0.14]);
    return g;
  }));
  glowCache.set(scale, geo);
  return geo;
}

// Every worm reads one clock. Setting it from the first body drawn each frame is
// cheaper than a useFrame per worm, and nothing is spent on worms off screen.
function tickClock() {
  stickerWormTime.value = performance.now() / 1000;
}

const StickerWorm = ({ position, rotation, scale = 1 }) => (
  // rotation = angle of this worm's orbit position; +PI/2 = tangent direction.
  <group position={position} rotation={[0, 0, rotation + Math.PI / 2]}>
    <mesh geometry={bodyGeometry(scale, rotation)} material={bodyMaterial} renderOrder={4} onBeforeRender={tickClock}
      raycast={() => null} dispose={null} />
    <mesh geometry={glowGeometry(scale)} material={glowMaterial} renderOrder={3} raycast={() => null} dispose={null} />
  </group>
);

export default StickerWorm;
