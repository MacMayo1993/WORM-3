import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Small, cached models: no miniature game scene, sticker shaders or per-cubie
// subscriptions. Every coloured surface (including LEGO studs) is one draw.
const cache = new Map();
const FACE_COLORS = ['#ef4444', '#fb923c', '#ffffff', '#facc15', '#2563eb', '#22c55e'];
const FACE_ROTATIONS = [[0, Math.PI / 2, 0], [0, -Math.PI / 2, 0],
  [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, 0], [0, Math.PI, 0]];
const DIGITS = ['abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg', 'bc'];
const SEGMENTS = {
  a: [0, 0.04, 0.052, 0.012], b: [0.026, 0.02, 0.012, 0.04],
  c: [0.026, -0.02, 0.012, 0.04], d: [0, -0.04, 0.052, 0.012],
  e: [-0.026, -0.02, 0.012, 0.04], f: [-0.026, 0.02, 0.012, 0.04],
  g: [0, 0, 0.052, 0.012],
};

function merge(parts) {
  if (!parts.length) return null;
  const result = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return result;
}

export function getViewPickupGeometry(view) {
  if (cache.has(view)) return cache.get(view);
  const panels = [], details = [], frames = [], bodies = [];
  const pitch = view === 'gap' ? 0.20 : 0.16;
  const width = view === 'gap' ? 0.12 : 0.148;
  const outer = pitch + width / 2;
  const put = (parts, geometry, color, x, y, z, rotation) => {
    geometry.translate(x, y, z);
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    if (color) {
      const c = new THREE.Color(color), count = geometry.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    parts.push(geometry);
  };
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (x === 0 && y === 0 && z === 0) continue;
    put(bodies, new THREE.BoxGeometry(width, width, width), null, x * pitch, y * pitch, z * pitch);
  }
  FACE_ROTATIONS.forEach((rotation, face) => {
    for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) {
      const x = col * pitch, y = row * pitch;
      const color = view === 'sudokube' ? '#f8fafc'
        : view === 'grid' ? ((row + col) % 2 ? '#38bdf8' : '#dff5ff')
          : view === 'glass' ? '#a5f3fc' : FACE_COLORS[face];
      if (!['wireframe', 'chrome'].includes(view)) {
        put(panels, new THREE.BoxGeometry(width * 0.88, width * 0.88, 0.008), color, x, y, outer + 0.005, rotation);
      }
      if (view === 'lego') {
        const stud = new THREE.CylinderGeometry(0.039, 0.043, 0.035, 12);
        stud.rotateX(Math.PI / 2);
        put(panels, stud, color, x, y, outer + 0.025, rotation);
      }
      if (view === 'sudokube') {
        for (const segment of DIGITS[(row + 1) * 3 + col + 1]) {
          const [dx, dy, w, h] = SEGMENTS[segment];
          put(details, new THREE.BoxGeometry(w, h, 0.004), '#172033', x + dx, y + dy, outer + 0.013, rotation);
        }
      }
      if (['wireframe', 'neon', 'glass'].includes(view)) {
        const tint = view === 'glass' ? '#c9fbff' : view === 'neon' ? '#f075ff' : '#b6ff5c';
        const w = width * 0.95, thickness = view === 'glass' ? 0.006 : 0.009;
        for (const sign of [-1, 1]) {
          put(frames, new THREE.BoxGeometry(w, thickness, thickness), tint, x, y + sign * w / 2, outer + 0.012, rotation);
          put(frames, new THREE.BoxGeometry(thickness, w, thickness), tint, x + sign * w / 2, y, outer + 0.012, rotation);
        }
      }
      // A tiny studio-reflection gradient makes the metal readable even in scenes
      // without an environment map. Vertex colours cost no texture or extra draw.
      if (view === 'chrome') {
        const panel = new THREE.PlaneGeometry(width * 0.96, width * 0.96, 1, 8);
        const shades = ['#d2e4ef', '#ffffff', '#879bad', '#273644', '#526777', '#f2fbff', '#ffffff', '#a7bac9', '#6c8092'];
        const colors = new Float32Array(panel.attributes.position.count * 3);
        for (let i = 0; i < panel.attributes.position.count; i++) {
          new THREE.Color(shades[Math.floor(i / 2)]).toArray(colors, i * 3);
        }
        panel.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        put(details, panel, null, x, y, outer + 0.005, rotation);
      }
    }
  });
  const result = { body: merge(bodies), panels: merge(panels), details: merge(details), frames: merge(frames) };
  cache.set(view, result);
  return result;
}
