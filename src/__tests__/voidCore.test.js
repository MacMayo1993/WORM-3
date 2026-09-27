import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TUNNEL_MINI_FACE_R } from '../utils/tunnelPath.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import {
  CORE_DOCK, CORE_FACES, CORE_WINDOW, PORT_DEPTH, PORT_INNER, PLATE_DEPTH, HEART_R, HEART_MAX_SWELL,
  GYRO_RADII, GYRO_TUBE, GYRO_BEAD_R, GYRO_AXES,
  createVoidCoreParts, disposeVoidCoreParts, paintCoreColors, gyroColorAt,
  faceForDirKey, networkCharge, countFlippedStickers, interiorExposure
} from '../3d/voidCoreParts.js';

// The tunnels' own table (MobiusTunnel, RestingCords): a sticker's tunnel docks
// on the core face along its local dirKey.
const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0], PY: [0, 1, 0], NY: [0, -1, 0], PZ: [0, 0, 1], NZ: [0, 0, -1]
};

const parts = createVoidCoreParts({ performanceMode: true });
paintCoreColors(parts, COLOR_SCHEMES.standard);

// Vertices of a merged per-face geometry that belong to face index `i`.
function faceVertices(geometry, i, { front = false } = {}) {
  const pos = geometry.attributes.position, face = geometry.attributes.aFace, back = geometry.attributes.aBack;
  const out = [];
  for (let v = 0; v < pos.count; v++) {
    if (face.getX(v) !== i || (front && back.getX(v))) continue;
    out.push({ v, p: new THREE.Vector3().fromBufferAttribute(pos, v) });
  }
  return out;
}

const colorAt = (geometry, v) => new THREE.Color().fromBufferAttribute(geometry.attributes.color, v);
const expectColor = (actual, expected) => {
  expect(actual.r).toBeCloseTo(expected.r, 5);
  expect(actual.g).toBeCloseTo(expected.g, 5);
  expect(actual.b).toBeCloseTo(expected.b, 5);
};

describe('VoidCore docks', () => {
  it('puts every port where the tunnels already dock', () => {
    expect(CORE_DOCK).toBe(TUNNEL_MINI_FACE_R);
    CORE_FACES.forEach(({ dir }, i) => {
      const n = new THREE.Vector3(...dir);
      const ring = faceVertices(parts.ports, i);
      // The ring's front face is the dock plane, and the ring is centred on the dock.
      expect(Math.max(...ring.map(({ p }) => p.dot(n)))).toBeCloseTo(CORE_DOCK, 6);
      const centre = new THREE.Box3().setFromPoints(ring.map(({ p }) => p)).getCenter(new THREE.Vector3());
      expect(centre.clone().sub(n.clone().multiplyScalar(centre.dot(n))).length()).toBeLessThan(1e-5);
      // The mouth fills the ring's hole, just behind the ring face.
      for (const { p } of faceVertices(parts.mouths, i)) {
        expect(p.dot(n)).toBeCloseTo(CORE_DOCK - PORT_DEPTH / 2, 6);
        expect(p.clone().sub(n.clone().multiplyScalar(p.dot(n))).length()).toBeLessThanOrEqual(PORT_INNER + 0.0031);
      }
    });
  });

  it('routes each sticker dirKey to the core face its tunnel docks on', () => {
    for (const [dirKey, normal] of Object.entries(FACE_NORM_LOCAL)) {
      expect(CORE_FACES[faceForDirKey(dirKey) - 1].dir).toEqual(normal);
    }
    expect(faceForDirKey('nope')).toBeNull();
    // Face ids follow FACE_COLORS (1 = PZ red … 6 = NY yellow), so antipodal faces sit opposite.
    for (const { id, dir } of CORE_FACES) expect(CORE_FACES[ANTIPODAL_COLOR[id] - 1].dir).toEqual(dir.map(v => -v || 0));
  });
});

describe('VoidCore fit', () => {
  it('stays inside the hole a 3×3 leaves at its centre', () => {
    for (const key of ['cage', 'plates', 'ports', 'mouths']) {
      parts[key].computeBoundingBox();
      const { min, max } = parts[key].boundingBox;
      for (const v of [...min.toArray(), ...max.toArray()]) expect(Math.abs(v)).toBeLessThanOrEqual(CORE_DOCK + 1e-6);
    }
    expect(CORE_DOCK).toBeLessThan(0.52); // neighbouring bodies start 0.52 out
  });

  it('keeps the heart and gimbals clear of the shell and of each other', () => {
    const innerWall = CORE_DOCK - PORT_DEPTH - PLATE_DEPTH;
    const reach = GYRO_RADII[GYRO_RADII.length - 1] + GYRO_BEAD_R;
    expect(reach).toBeLessThan(innerWall);
    expect(reach).toBeLessThan(CORE_WINDOW * Math.SQRT2); // a beam needs two coordinates past the window
    expect(HEART_R * HEART_MAX_SWELL).toBeLessThan(GYRO_RADII[0] - GYRO_BEAD_R);
    for (let i = 1; i < GYRO_RADII.length; i++) {
      expect(GYRO_RADII[i] - GYRO_RADII[i - 1]).toBeGreaterThan(GYRO_BEAD_R + GYRO_TUBE);
    }
    // Plates close each window: the front (+Z) plate tucks under the beams on every side.
    const pos = parts.plates.attributes.position;
    let reachX = 0, reachY = 0;
    for (let v = 0; v < pos.count; v++) {
      if (pos.getZ(v) < CORE_DOCK - PORT_DEPTH - PLATE_DEPTH - 1e-6) continue;
      reachX = Math.max(reachX, Math.abs(pos.getX(v)));
      reachY = Math.max(reachY, Math.abs(pos.getY(v)));
    }
    expect(reachX).toBeGreaterThan(CORE_WINDOW);
    expect(reachY).toBeGreaterThan(CORE_WINDOW);
  });
});

describe('VoidCore colours', () => {
  const standard = CORE_FACES.map(({ id }) => new THREE.Color(COLOR_SCHEMES.standard[id]));

  it('paints each ring in its own face colour with a black-plastic back', () => {
    CORE_FACES.forEach((_, i) => {
      const verts = faceVertices(parts.ports, i);
      const front = verts.filter(({ v }) => !parts.ports.attributes.aBack.getX(v));
      const back = verts.filter(({ v }) => parts.ports.attributes.aBack.getX(v));
      expect(front.length).toBeGreaterThan(0);
      expect(back.length).toBeGreaterThan(0);
      expectColor(colorAt(parts.ports, front[0].v), standard[i]);
      expectColor(colorAt(parts.ports, back[0].v), new THREE.Color('#141416'));
    });
  });

  it("fills each mouth with the antipode's colour", () => {
    CORE_FACES.forEach(({ id }, i) => {
      const [{ v }] = faceVertices(parts.mouths, i);
      expectColor(colorAt(parts.mouths, v), standard[ANTIPODAL_COLOR[id] - 1]);
    });
  });

  it('hands the heart all six faces', () => {
    parts.heartUniforms.uFace.value.forEach((c, i) => expectColor(c, standard[i]));
  });

  it('gives each gimbal an antipodal pair of beads in its axis colours', () => {
    GYRO_AXES.forEach(({ faces }, i) => {
      const geometry = parts.gyro[i];
      const side = geometry.userData.side;
      const pos = geometry.attributes.position;
      const centre = (flag) => {
        const box = new THREE.Box3();
        for (let v = 0; v < side.length; v++) if (side[v] === flag) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, v));
        return box.getCenter(new THREE.Vector3());
      };
      const a = centre(2), b = centre(-2);
      expect(a.x).toBeCloseTo(GYRO_RADII[i], 5);
      expect(a.clone().add(b).length()).toBeLessThan(1e-6); // x and −x
      const colorA = standard[faces[0] - 1], colorB = standard[faces[1] - 1];
      expectColor(colorAt(geometry, side.indexOf(2)), gyroColorAt(2, colorA, colorB));
      expectColor(colorAt(geometry, side.indexOf(-2)), gyroColorAt(-2, colorA, colorB));
    });
    // The pairs are the cube's three antipodal pairs, positive face first.
    for (const { axis, faces } of GYRO_AXES) {
      const k = 'xyz'.indexOf(axis);
      expect(CORE_FACES[faces[0] - 1].dir[k]).toBe(1);
      expect(ANTIPODAL_COLOR[faces[0]]).toBe(faces[1]);
    }
  });
});

describe('VoidCore state helpers', () => {
  it('charges up with the live network without ever saturating', () => {
    expect(networkCharge(0)).toBe(0);
    expect(networkCharge(-3)).toBe(0);
    expect(networkCharge(2)).toBeGreaterThan(0);
    expect(networkCharge(20)).toBeGreaterThan(networkCharge(2));
    expect(networkCharge(1000)).toBeLessThanOrEqual(1);
  });

  it('counts flipped stickers across a pair flip', () => {
    let cubies = makeCubies(3);
    expect(countFlippedStickers(cubies)).toBe(0);
    cubies = flipStickerPair(cubies, 3, 0, 1, 1, 'NX', buildManifoldGridMap(cubies, 3));
    expect(countFlippedStickers(cubies)).toBe(2);
    expect(countFlippedStickers(undefined)).toBe(0);
  });

  it('lights the surroundings only once the inside can be seen', () => {
    expect(interiorExposure({})).toBe(0);
    expect(interiorExposure({ visualMode: 'classic', explosionT: 0 })).toBe(0);
    expect(interiorExposure({ explosionT: 0.4 })).toBe(0.4);
    expect(interiorExposure({ visualMode: 'glass' })).toBe(1);
    expect(interiorExposure({ hollowMode: true })).toBe(1);
    expect(interiorExposure({ visualMode: 'gap' })).toBe(0.6);
    expect(interiorExposure({ visualMode: 'gap', explosionT: 1 })).toBe(1);
  });

  it('disposes everything it built', () => {
    const own = createVoidCoreParts();
    expect(own.materials.port).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(parts.materials.port).not.toBeInstanceOf(THREE.MeshPhysicalMaterial); // performance mode
    const spy = [];
    for (const g of [own.cage, own.plates, own.ports, own.mouths, own.heart, own.halo, ...own.gyro]) g.addEventListener('dispose', () => spy.push(g));
    disposeVoidCoreParts(own);
    expect(spy).toHaveLength(6 + own.gyro.length);
  });
});
