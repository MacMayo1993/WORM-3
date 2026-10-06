import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { craftedShaders, CRAFTED_ANTIPODAL_KEYS, CRAFTED_ANIMATED_KEYS } from '../3d/styles/shaders/craftedShaders.js';
import { CRAFT_GLSL, FACE_PLANE_AXES } from '../3d/styles/shaders/craftGlsl.js';
import { ANTIPODAL_STYLES, isAnimatedStyle } from '../3d/styles/TileStyleMaterials.jsx';
import { CRAFTED_STYLE_KEYS, TILE_STYLE_SECTIONS } from '../utils/tileStyleCatalog.js';
import { TILE_STYLES } from '../utils/colorSchemes.js';
import { STORE_TILES } from '../utils/storeCatalog.js';
import { COLOR_TO_DIR, DIR_TO_VEC } from '../utils/constants.js';
import { STICKER_ROT } from '../3d/stickerFrames.js';
import { makeCubies } from '../game/cubeState.js';

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const axisVector = (axis) => AXES[axis[1]].clone().multiplyScalar(axis[0] === '-' ? -1 : 1);

// JS twin of crFacePlane at a sticker's centre (vUv = 0.5).
function facePlane(home, faceId, size) {
  const k = (size - 1) / 2;
  const h = { x: home.x - k, y: home.y - k, z: home.z - k };
  return FACE_PLANE_AXES[faceId].map((axis) => (axis[0] === '-' ? -1 : 1) * h[axis[1]]);
}

describe('Crafted tile family', () => {
  it('is a catalogue section whose keys are exactly the shader module', () => {
    expect(TILE_STYLE_SECTIONS.find((s) => s.key === 'crafted')?.keys).toBe(CRAFTED_STYLE_KEYS);
    expect(Object.keys(craftedShaders).sort()).toEqual([...CRAFTED_STYLE_KEYS].sort());
  });

  it('labels, prices and registers every style', () => {
    const store = new Map(STORE_TILES.map((t) => [t.tileKey, t]));
    for (const key of CRAFTED_STYLE_KEYS) {
      expect(TILE_STYLES[key]?.label, key).toBeTruthy();
      expect(store.get(key)?.price, `${key} has no explicit price`).toBeGreaterThan(0);
      expect(ANTIPODAL_STYLES.has(key), `${key} antipodal registration`).toBe(CRAFTED_ANTIPODAL_KEYS.includes(key));
      expect(isAnimatedStyle(key), `${key} animation registration`).toBe(CRAFTED_ANIMATED_KEYS.includes(key));
    }
  });

  it('are opaque and dyed by the face colour', () => {
    for (const [key, shader] of Object.entries(craftedShaders)) {
      expect(shader, key).toContain('uniform vec3 baseColor');
      expect(shader, `${key} must stay opaque`).not.toContain('discard');
      expect(shader.match(/void main\(\)/g), `${key} needs exactly one main()`).toHaveLength(1);
    }
  });
});

describe('face-slab coordinates', () => {
  it('run along each face the way its sticker plane is turned', () => {
    // A solved face only reads as one slab if a step along a sticker's own u
    // (or v) is a step of +1 in the slab's u (or v) — on every face.
    for (const [faceId, [u, v]] of Object.entries(FACE_PLANE_AXES)) {
      const dir = COLOR_TO_DIR[faceId];
      const euler = new THREE.Euler(...STICKER_ROT[dir]);
      const normal = new THREE.Vector3(0, 0, 1).applyEuler(euler);
      expect(normal.distanceTo(new THREE.Vector3(...DIR_TO_VEC[dir])), `${dir} normal`).toBeLessThan(1e-9);
      expect(new THREE.Vector3(1, 0, 0).applyEuler(euler).distanceTo(axisVector(u)), `${dir} u`).toBeLessThan(1e-9);
      expect(new THREE.Vector3(0, 1, 0).applyEuler(euler).distanceTo(axisVector(v)), `${dir} v`).toBeLessThan(1e-9);
    }
  });

  it('lays every solved face out as one centred grid', () => {
    for (const size of [2, 3, 5]) {
      const cubies = makeCubies(size);
      const byFace = {};
      for (const plane of cubies) for (const row of plane) for (const cubie of row) {
        for (const sticker of Object.values(cubie.stickers)) {
          (byFace[sticker.orig] ??= []).push(facePlane(sticker.origPos, sticker.orig, size));
        }
      }
      const half = (size - 1) / 2;
      const expected = [];
      for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) expected.push(`${a - half},${b - half}`);
      for (let faceId = 1; faceId <= 6; faceId++) {
        expect(byFace[faceId].map((p) => p.join(',')).sort(), `size ${size} face ${faceId}`).toEqual(expected.sort());
      }
    }
  });

  it('builds its GLSL from the same table', () => {
    for (const [faceId, [u, v]] of Object.entries(FACE_PLANE_AXES)) {
      const glsl = (axis) => `${axis[0] === '-' ? '-' : ''}h.${axis[1]}`;
      expect(CRAFT_GLSL).toContain(`if (tileFace < ${faceId}.5) p = vec2(${glsl(u)}, ${glsl(v)});`);
    }
  });
});
