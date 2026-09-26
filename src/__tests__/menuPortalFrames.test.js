import { describe, expect, it } from 'vitest';
import { Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { createMenuPortalFrames, deformMenuWormPoint, createRaisedMenuTrail, updateRaisedMenuTrail, raisedMenuDistance, updateMenuPortalFrames } from '../components/menus/menuPortalFrames.js';
import { makeMenuTunnelWormPath, sampleMenuTunnelWorm, MENU_WORM_SPACING } from '../components/menus/menuTunnelWormPath.js';
import { MENU_FLIP_PAIRS, MENU_PORTAL_OVERLAY_Z, MENU_SURFACE_HALF } from '../components/menus/menuCenterPortals.js';

function fixture(turn = 0) {
  const world = new Group(), root = new Group();
  world.rotation.set(0.3, -0.8, 0.5);
  world.scale.setScalar(1.8);
  world.position.set(3, -2, 1);
  world.add(root);
  const frames = createMenuPortalFrames();
  frames.forEach((frame, i) => {
    const face = MENU_FLIP_PAIRS.flat()[i];
    const pad = new Group(), flip = new Group(), mouth = new Group();
    pad.quaternion.setFromEuler(new Euler(...face.rot));
    pad.position.fromArray(face.pos).addScaledVector(new Vector3(...face.pos).normalize(), 0.35 + i * 0.012 - MENU_PORTAL_OVERLAY_Z);
    flip.position.z = Math.sin(turn) * 0.32;
    flip.rotation.x = turn;
    mouth.position.z = MENU_PORTAL_OVERLAY_Z;
    pad.add(flip); flip.add(mouth); root.add(pad);
    frame.node = mouth;
  });
  updateMenuPortalFrames(root, frames);
  return { root, frames };
}

describe('rendered menu portal coordinates', () => {
  it.each([0, 0.3, Math.PI / 2, Math.PI * 0.8])('lands exactly on every moving mouth at flip angle %s', angle => {
    const { root, frames } = fixture(angle);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();
    for (const frame of frames) {
      const base = new Vector3().setFromMatrixPosition(frame.base);
      const expected = frame.node.getWorldPosition(new Vector3()).applyMatrix4(inverse);
      const actual = deformMenuWormPoint(base.clone(), frames);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-10);
      expect(actual.distanceTo(base)).toBeGreaterThan(0.3);
      // Points in the mouth's plane follow its orientation as well as height.
      const point = new Vector3(0.08, -0.04, 0).applyMatrix4(frame.base);
      const target = new Vector3(0.08, -0.04, 0).applyMatrix4(frame.matrix);
      expect(deformMenuWormPoint(point, frames).distanceTo(target)).toBeLessThan(1e-10);
    }
  });

  it.each([0, Math.PI / 2, Math.PI * 0.8])('samples both worms through all four actual mouths at angle %s, without reusing the opposite lift', angle => {
    const { frames } = fixture(angle);
    const p = new Vector3(), n = new Vector3(), f = new Vector3();
    for (const pair of MENU_FLIP_PAIRS) {
      for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const path = makeMenuTunnelWormPath(pair[0].pos, phase);
        for (const antipodal of [false, true]) {
          const trail = createRaisedMenuTrail(path);
          updateRaisedMenuTrail(path, trail, frames, antipodal);
          for (const portal of Object.values(path.portals)) {
            // Find the exact distance where the canonical trail crosses this
            // portal plane. The axial throat must cross at its center.
            const axis = portal.clone().normalize();
            let distance = null;
            for (let i = 1; i < path.points.length; i++) {
              const a = path.points[i - 1].dot(axis) - MENU_SURFACE_HALF;
              const b = path.points[i].dot(axis) - MENU_SURFACE_HALF;
              if (a * b > 0 || a === b) continue;
              const fraction = -a / (b - a);
              const crossing = path.points[i - 1].clone().lerp(path.points[i], fraction);
              if (crossing.distanceTo(portal) > 0.001) continue;
              distance = path.lengths[i - 1] + fraction * (path.lengths[i] - path.lengths[i - 1]);
              break;
            }
            expect(distance).not.toBeNull();
            const targetBase = portal.clone().multiplyScalar(antipodal ? -1 : 1);
            const frame = frames.find(item => new Vector3().setFromMatrixPosition(item.base).distanceTo(targetBase) < 1e-6);
            sampleMenuTunnelWorm(trail, raisedMenuDistance(trail, distance), p, n, f);
            expect(p.distanceTo(new Vector3().setFromMatrixPosition(frame.matrix))).toBeLessThan(1e-6);
            expect(n.length()).toBeCloseTo(1, 8);
            expect(n.dot(f)).toBeCloseTo(0, 8);
            const facing = new Vector3(0, 0, 1).applyQuaternion(new Quaternion().setFromRotationMatrix(frame.matrix));
            expect(Math.abs(f.dot(facing))).toBeGreaterThan(0.999);
          }
        }
      }
    }
  });

  it('keeps the deformed body continuous and restores removed anchors after a shuffle', () => {
    const { root, frames } = fixture(0.4);
    const path = makeMenuTunnelWormPath(MENU_FLIP_PAIRS[0][0].pos);
    const trail = createRaisedMenuTrail(path);
    updateRaisedMenuTrail(path, trail, frames);
    const p = new Vector3(), n = new Vector3(), f = new Vector3(), previous = new Vector3();
    sampleMenuTunnelWorm(trail, 0, previous, n, f);
    for (let s = 0.01; s < trail.length; s += 0.01) {
      sampleMenuTunnelWorm(trail, s, p, n, f);
      expect(p.distanceTo(previous)).toBeLessThanOrEqual(0.01001);
      expect(n.dot(f)).toBeCloseTo(0, 7);
      if (s > MENU_WORM_SPACING) {
        const tail = new Vector3();
        sampleMenuTunnelWorm(trail, s - MENU_WORM_SPACING, tail, n, f);
        expect(p.distanceTo(tail)).toBeLessThanOrEqual(MENU_WORM_SPACING + 1e-8);
      }
      previous.copy(p);
    }
    for (const frame of frames) frame.node = null;
    updateMenuPortalFrames(root, frames);
    expect(frames.every(frame => !frame.active)).toBe(true);
    const base = new Vector3(...MENU_FLIP_PAIRS[0][0].pos);
    expect(deformMenuWormPoint(base.clone(), frames).equals(base)).toBe(true);
  });
});
