import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { keepInFrame, frameRide, RIDE_FRAME, CLOSE_UP_FRAME, RIDE_FRAME_LIMIT } from '../worm/rideFraming.js';
import { makeTunnelCamPose, tunnelCamPoseInto, tunnelEntryPoseInto, cameraArcForHead, makeCrossingCloseUp,
  crossingCloseUpInto, crossingFov, CROSSING_FILL, CROSSING_FOV_MIN } from '../worm/tunnelCameraRails.js';
import { coreOpeningRadius } from '../3d/corePassage.js';
import { makeTunnelPath, tunnelPathTToArc, tunnelPathArcToT, tunnelTraversalT, ARM_A_END } from '../utils/tunnelPath.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';

const camera = (fov = 60, aspect = 0.45) => {
  const c = new THREE.PerspectiveCamera(fov, aspect, 0.01, 100);
  c.position.set(0, 0, 0);
  return c;
};
const screen = (cam, point) => {
  cam.updateMatrixWorld(true);
  return point.clone().project(cam);
};

describe('keepInFrame', () => {
  it('leaves the lens alone while the point is inside the box', () => {
    const cam = camera(), before = cam.quaternion.clone();
    expect(keepInFrame(cam, new THREE.Vector3(0.05, -0.1, -2), 0.5, 0.5)).toBe(0);
    expect(cam.quaternion.equals(before)).toBe(true);
  });

  it('turns the least it takes to put an outside point on the box edge, on either axis', () => {
    for (const point of [new THREE.Vector3(3, 0.2, -2), new THREE.Vector3(-0.4, -4, -2), new THREE.Vector3(-5, 5, -1)]) {
      const cam = camera();
      const turned = keepInFrame(cam, point, 0.5, 0.5);
      expect(turned).toBeGreaterThan(0);
      const ndc = screen(cam, point);
      expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y))).toBeCloseTo(0.5, 5);
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.5 + 1e-6);
      // Minimal: the view axis moves no further than the turn that was needed.
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      expect(forward.angleTo(new THREE.Vector3(0, 0, -1))).toBeLessThanOrEqual(turned + 1e-9);
    }
  });

  it('brings a point behind the lens to the centre only when asked', () => {
    const behind = new THREE.Vector3(0.3, 0.1, 2);
    const kept = camera();
    expect(keepInFrame(kept, behind, 0.5, 0.5)).toBe(0);
    const turned = camera();
    expect(keepInFrame(turned, behind, 0.5, 0.5, true)).toBeGreaterThan(Math.PI / 2);
    const ndc = screen(turned, behind);
    expect(Math.abs(ndc.x)).toBeLessThan(1e-6);
    expect(Math.abs(ndc.y)).toBeLessThan(1e-6);
  });
});

describe('frameRide', () => {
  const pose = () => {
    const p = makeTunnelCamPose();
    p.cam.set(0, 0, 0); p.look.set(0, 0, -1.6); p.up.set(0, 1, 0);
    return p;
  };

  it('is the rail itself whenever the head is already well framed', () => {
    const cam = camera(), rail = pose();
    frameRide(cam, rail, new THREE.Vector3(0.1, -0.2, -2), 1);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    expect(forward.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-9);
    expect(cam.up.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-9);
  });

  it('holds the head inside the ride box, only on screen in the close-up, and never past the limit while smoothing lags', () => {
    const head = new THREE.Vector3(2.5, 0, -2);
    for (const [closeUp, box] of [[0, RIDE_FRAME], [1, CLOSE_UP_FRAME]]) {
      const cam = camera();
      frameRide(cam, pose(), head, 1, closeUp);
      expect(Math.abs(screen(cam, head).x)).toBeCloseTo(box, 4);
    }
    // A lens that only moves a little toward its target each frame.
    const lagging = camera();
    frameRide(lagging, pose(), head, 0.05);
    expect(Math.abs(screen(lagging, head).x)).toBeLessThanOrEqual(RIDE_FRAME_LIMIT + 1e-6);
  });
});

describe('where the lens is, in the head\'s t', () => {
  const tunnel = { entry: { x: 0, y: 2, z: 2, dirKey: 'PZ' }, exit: { x: 2, y: 0, z: 0, dirKey: 'PX' } };

  it('inverts the traversal pacing', () => {
    const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, 3);
    for (let t = 0; t <= 1; t += 0.01) expect(tunnelPathArcToT(path, tunnelPathTToArc(path, t))).toBeCloseTo(t, 6);
    expect(tunnelPathArcToT(path, -1)).toBe(0);
    expect(tunnelPathArcToT(path, path.total + 1)).toBe(1);
  });

  it('puts the lens behind the head on every pose, through the dive and the ride', () => {
    const size = 3, pose = makeTunnelCamPose(), from = makeTunnelCamPose();
    from.cam.set(-1, 2, 3); from.look.set(-1, 1, 1.5); from.up.set(0, 1, 0);
    const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, size);
    for (let p = 0.2; p <= 1; p += 0.1) {
      tunnelEntryPoseInto(pose, tunnel, p, size, from);
      expect(pose.lensT).toBeLessThan(tunnelTraversalT('entering', p));
    }
    for (let t = ARM_A_END; t <= 1; t += 0.02) {
      tunnelCamPoseInto(pose, tunnel, t, size);
      expect(pose.lensT).toBeCloseTo(tunnelPathArcToT(path, cameraArcForHead(path, t, size)), 9);
      expect(pose.lensT).toBeLessThan(t);
    }
  });
});

describe('crossing close-up', () => {
  it('is on while the head crosses the core and the lens is short of its opening, off along both arms', () => {
    const closeUp = makeCrossingCloseUp();
    for (const size of [3, 5, 15]) {
      const m = Math.floor(size / 2), n = size - 1;
      for (const tunnel of [
        { entry: { x: m, y: n, z: m, dirKey: 'PY' }, exit: { x: m, y: 0, z: m, dirKey: 'NY' } },
        { entry: { x: 0, y: n, z: n, dirKey: 'PZ' }, exit: { x: n, y: 0, z: 0, dirKey: 'PX' } },
      ]) {
        const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, size);
        // Head at the centre of the crossing: fully on, framing the entry opening.
        expect(crossingCloseUpInto(closeUp, tunnel, 0.5, size, 3).weight).toBeCloseTo(1, 6);
        expect(closeUp.center.distanceTo(path.midA)).toBeLessThan(1e-12);
        expect(closeUp.radius).toBeCloseTo(coreOpeningRadius(size, 3), 12);
        expect(closeUp.distance).toBeGreaterThan(closeUp.radius);
        // Down the entry arm, and once the lens is through the core: off.
        expect(crossingCloseUpInto(closeUp, tunnel, tunnelTraversalT('entering', 0.5), size).weight).toBe(0);
        let lensThrough = null;
        for (let t = 0.5; t <= 1 && lensThrough === null; t += 0.001) {
          if (cameraArcForHead(path, t, size) >= path.armALen) lensThrough = t;
        }
        expect(crossingCloseUpInto(closeUp, tunnel, lensThrough, size).weight).toBe(0);
        // Continuous: no frame-to-frame jump at 60 Hz through the whole ride.
        let previous = 0;
        for (let t = 0; t <= 1; t += 0.4 / (3.6 * 60)) {
          const now = crossingCloseUpInto(closeUp, tunnel, t, size).weight;
          expect(Math.abs(now - previous)).toBeLessThan(0.2);
          previous = now;
        }
      }
    }
  });

  it('narrows until the opening fills the same share of the narrower side, portrait or landscape', () => {
    const closeUp = { radius: 0.3, distance: 1 };
    for (const aspect of [0.45, 1, 1.6]) {
      const fov = crossingFov(closeUp, aspect, 100);
      const tanY = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
      expect((closeUp.radius / closeUp.distance) / (tanY * Math.min(1, aspect))).toBeCloseTo(CROSSING_FILL, 9);
    }
    // Never past the ride's own lens, and never a telephoto.
    expect(crossingFov({ radius: 1, distance: 0.1 }, 0.45, 90)).toBe(90);
    expect(crossingFov({ radius: 0.001, distance: 5 }, 1.6, 90)).toBe(CROSSING_FOV_MIN);
  });
});
