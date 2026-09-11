import { expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { portalSparkPose } from '../worm/healerWorm/portalSparks.js';

it('launches outside all six faces with equal height and bounded tangent spread', () => {
    const origin = [2, -3, 4];
    for (const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const normal = new Vector3(...n), out = new Object3D();
        expect(portalSparkPose(out, origin, normal, 0.4, 0, 0, false)).toBe(true);
        const offset = out.position.clone().sub(new Vector3(...origin));
        expect(offset.dot(normal)).toBeCloseTo(0.08 + 1.55 * 0.75);
        expect(offset.addScaledVector(normal, -offset.dot(normal)).length()).toBeCloseTo(0.22);
        expect(new Vector3(0,1,0).applyQuaternion(out.quaternion).dot(normal)).toBeCloseTo(1);
        expect(out.matrix.elements.every(Number.isFinite)).toBe(true);
    }
});
it('has quiet gaps, staggered bursts, and a stronger danger fountain', () => {
    const out = new Object3D(), n = new Vector3(0,0,1);
    expect(portalSparkPose(out, [0,0,0], n, 1.2, 0, 0, false)).toBe(false);
    expect(portalSparkPose(out, [0,0,0], n, 1.2, 0.5, 0, false)).toBe(true);
    portalSparkPose(out, [0,0,0], n, 0.4, 0, 0, false);
    const safeHeight = out.position.z;
    portalSparkPose(out, [0,0,0], n, 0.475, 0, 0, true);
    expect(out.position.z).toBeGreaterThan(safeHeight);
    expect(portalSparkPose(out, [0,0,0], n, 0.01, 0, 4, false)).toBe(false);
});
