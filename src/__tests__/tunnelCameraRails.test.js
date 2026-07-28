import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  backForHead,
  cameraUpForHead,
  diveEase,
  tunnelCamPoseInto,
  makeTunnelCamPose,
  portalDist,
  portalUp,
  ENTER_END_T,
  projectToTileCenterAxisInto
} from '../worm/tunnelCameraRails.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

// A tunnel joining the middle tile of +Y to the middle tile of −Y on an n×n
// cube: the antipodal pair with the longest, straightest path, so distances
// along it are easy to reason about.
const straightTunnel = (size) => {
  const m = Math.floor(size / 2);
  const n = size - 1;
  return {
    entry: { x: m, y: n, z: m, dirKey: 'PY' },
    exit: { x: m, y: 0, z: m, dirKey: 'NY' }
  };
};

// A tunnel between tiles on different axes — the case where the centerline
// turns a corner at the core.
const bentTunnel = (size) => {
  const m = Math.floor(size / 2);
  const n = size - 1;
  return {
    entry: { x: m, y: n, z: m, dirKey: 'PY' },
    exit: { x: 0, y: m, z: m, dirKey: 'NX' }
  };
};

// The worst case for a route that heads straight for the core: a corner tile,
// whose docking point is two tiles laterally away from the tile's own axis.
const cornerTunnel = (size) => {
  const n = size - 1;
  return {
    entry: { x: 0, y: n, z: 0, dirKey: 'PY' },
    exit: { x: n, y: 0, z: n, dirKey: 'NY' }
  };
};

/** World-space distance from the cube's surface plane on the entry face. */
const heightAboveEntryFace = (pos, size) => pos.y - ((size - 1) / 2 + SURFACE_OFFSET);

describe('diveEase', () => {
  it('is a back-loaded cubic pinned at both ends', () => {
    expect(diveEase(0)).toBe(0);
    expect(diveEase(1)).toBe(1);
    // Half way through the phase the camera has covered only an eighth of the
    // distance — that back-loading is what makes it read as a rush rather than
    // a drift, and is what keeps the camera outside the cube until the handoff.
    expect(diveEase(0.5)).toBeCloseTo(0.125, 6);
  });

  it('clamps out-of-range progress', () => {
    expect(diveEase(-3)).toBe(0);
    expect(diveEase(4)).toBe(1);
  });
});

describe('backForHead', () => {
  it('holds the short mouth trail through the whole entry arm', () => {
    for (const size of [2, 3, 4, 5]) {
      const near = 0.62 + size * 0.1;
      expect(backForHead(0, size)).toBeCloseTo(near, 6);
      expect(backForHead(ENTER_END_T, size)).toBeCloseTo(near, 6);
    }
  });

  it('reaches the settled deep-ride trail by the exit arm', () => {
    for (const size of [2, 3, 4, 5]) {
      expect(backForHead(0.9, size)).toBeCloseTo(1.15 + size * 0.1, 6);
    }
  });

  it('never grows faster than the head advances, so the camera cannot drift backwards', () => {
    // The centerline's slowest leg is the core crossing, 0.5 world units over
    // a 0.2 span of t (getTunnelWorldPosInto) = 2.5 units of arc per unit t.
    // The trail must grow more slowly than that or the camera loses ground.
    const SLOWEST_HEAD_RATE = 2.5;
    for (const size of [2, 3, 4, 5]) {
      for (let t = 0; t < 1; t += 0.01) {
        const rate = (backForHead(t + 0.01, size) - backForHead(t, size)) / 0.01;
        expect(rate).toBeLessThan(SLOWEST_HEAD_RATE);
      }
    }
  });
});

describe('tunnelCamPoseInto', () => {
  it('projects inherited camera drift onto the physical tile-centre axis', () => {
    const center = new THREE.Vector3(2, -1, 4);
    const normal = new THREE.Vector3(0, 0, -1);
    const projected = new THREE.Vector3();
    projectToTileCenterAxisInto(projected, new THREE.Vector3(99, 23, -5), center, normal);
    expect(projected.x).toBe(center.x);
    expect(projected.y).toBe(center.y);
    expect(projected.z).toBe(-5);
  });

  it('drives the lens through the dead centre of the entry tile', () => {
    // The regression this pins: a camera that trails the head along its current
    // TANGENT leaves the tile's axis the moment the route bends toward the core,
    // and so crosses the cube's surface a tile or more to the side of the hole it
    // is diving into. Trailing along the ROUTE (and opening each mouth with a
    // straight throat) means every pose taken while the lens is still outside the
    // cube sits on the entry tile's own centre axis.
    for (const size of [2, 3, 4, 5]) {
      for (const tunnel of [straightTunnel(size), bentTunnel(size), cornerTunnel(size)]) {
        const pose = makeTunnelCamPose();
        const entry = new THREE.Vector3();
        const normal = new THREE.Vector3(0, 1, 0);
        const lateral = new THREE.Vector3();
        entry.set(
          tunnel.entry.x - (size - 1) / 2,
          tunnel.entry.y - (size - 1) / 2 + SURFACE_OFFSET,
          tunnel.entry.z - (size - 1) / 2
        );

        let sawOutside = false;
        for (let t = 0; t <= ENTER_END_T + 1e-9; t += 0.005) {
          tunnelCamPoseInto(pose, tunnel, t, size);
          if (heightAboveEntryFace(pose.cam, size) < 0) continue;
          sawOutside = true;
          lateral.subVectors(pose.cam, entry);
          lateral.addScaledVector(normal, -lateral.dot(normal));
          expect(lateral.length()).toBeLessThan(1e-6);
        }
        expect(sawOutside).toBe(true);
      }
    }
  });

  it('keeps the riding height off the lens until it is well inside', () => {
    // Any lateral offset applied while the camera is still in the mouth walks it
    // across the face of the entry sticker instead of through its centre.
    expect(cameraUpForHead(0)).toBe(0);
    expect(cameraUpForHead(ENTER_END_T)).toBe(0);
  });

  it('carries the camera through the entry face during the dive', () => {
    for (const size of [3, 4, 5]) {
      const tunnel = straightTunnel(size);
      const pose = makeTunnelCamPose();

      // Start of the dive: still outside, watching the mouth.
      tunnelCamPoseInto(pose, tunnel, 0, size);
      expect(heightAboveEntryFace(pose.cam, size)).toBeGreaterThan(0);

      // By the handoff to the ride the camera is through the aperture. This is
      // the regression that motivated backForHead: with the old flat trail of
      // 1.15 + size·0.1 this was still positive — the whole "ride" was watched
      // from outside a cube that is hidden during those phases.
      tunnelCamPoseInto(pose, tunnel, ENTER_END_T, size);
      expect(heightAboveEntryFace(pose.cam, size)).toBeLessThan(0);
    }
  });

  it('advances monotonically into the cube across the entry arm', () => {
    const size = 3;
    const tunnel = straightTunnel(size);
    const pose = makeTunnelCamPose();
    let prev = Infinity;
    for (let t = 0; t <= ENTER_END_T + 1e-9; t += 0.01) {
      tunnelCamPoseInto(pose, tunnel, t, size);
      const h = heightAboveEntryFace(pose.cam, size);
      expect(h).toBeLessThan(prev);
      prev = h;
    }
  });

  it('produces one continuous path — no jump at the entering→tunnel boundary', () => {
    for (const size of [2, 3, 5]) {
      for (const tunnel of [straightTunnel(size), bentTunnel(size)]) {
        const before = makeTunnelCamPose();
        const after = makeTunnelCamPose();
        tunnelCamPoseInto(before, tunnel, ENTER_END_T - 1e-4, size);
        tunnelCamPoseInto(after, tunnel, ENTER_END_T + 1e-4, size);
        // Both phases call this one function, so the seam is only as wide as
        // the parameter step itself.
        expect(before.cam.distanceTo(after.cam)).toBeLessThan(0.02);
        expect(before.look.distanceTo(after.look)).toBeLessThan(0.02);
        expect(before.up.angleTo(after.up)).toBeLessThan(0.01);
      }
    }
  });

  it('rolls the up-vector through a half turn across the traversal', () => {
    const size = 3;
    const tunnel = straightTunnel(size);
    const start = makeTunnelCamPose();
    const end = makeTunnelCamPose();
    tunnelCamPoseInto(start, tunnel, 0, size);
    tunnelCamPoseInto(end, tunnel, 1, size);
    // π of roll about a tangent that is itself constant on this straight path:
    // the camera comes out inverted, which is the Möbius identification.
    expect(start.up.angleTo(end.up)).toBeCloseTo(Math.PI, 2);
  });

  it('keeps the up-vector perpendicular to the direction of travel', () => {
    const size = 4;
    const pose = makeTunnelCamPose();
    for (const tunnel of [straightTunnel(size), bentTunnel(size)]) {
      for (let t = 0; t <= 1.0001; t += 0.05) {
        tunnelCamPoseInto(pose, tunnel, Math.min(1, t), size);
        expect(Math.abs(pose.up.dot(pose.tangent))).toBeLessThan(1e-5);
        expect(pose.up.length()).toBeCloseTo(1, 6);
      }
    }
  });

  it('looks ahead of the camera, down the tunnel', () => {
    const size = 3;
    const pose = makeTunnelCamPose();
    const view = new THREE.Vector3();
    // Bent route: the aim point sits further along the ROUTE, so where the route
    // turns the shot leads into the bend rather than staying pinned to the local
    // tangent and staring at the wall beside the corner. It still always faces
    // forward — the camera never ends up looking back the way it came.
    for (let t = 0; t <= 1.0001; t += 0.05) {
      tunnelCamPoseInto(pose, bentTunnel(size), Math.min(1, t), size);
      view.subVectors(pose.look, pose.cam).normalize();
      expect(view.dot(pose.tangent)).toBeGreaterThan(0.5);
    }
    // Straight route through the middle of two faces: nothing to lead into, so
    // the aim lies exactly down the direction of travel.
    for (let t = 0; t <= 1.0001; t += 0.05) {
      tunnelCamPoseInto(pose, straightTunnel(size), Math.min(1, t), size);
      view.subVectors(pose.look, pose.cam).normalize();
      expect(view.dot(pose.tangent)).toBeGreaterThan(0.999);
    }
  });
});

describe('exterior portal framing', () => {
  it('sits outside the cube for every supported size', () => {
    for (let size = 2; size <= 5; size++) {
      expect(portalDist(size)).toBeGreaterThan((size - 1) / 2 + SURFACE_OFFSET);
      expect(portalUp(size)).toBeGreaterThan(0);
    }
  });
});
