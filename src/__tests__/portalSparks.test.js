import { expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { portalSparkPose, PORTAL_SPARKS, DANGER_SPARKS } from '../worm/healerWorm/portalSparks.js';

it('keeps the full spark outside all six faces and points streaks along their flight', () => {
    const origin = [2, -3, 4];
    for (const n of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const normal = new Vector3(...n), out = new Object3D(), next = new Object3D();
        for (let i = 0; i < DANGER_SPARKS; i++) {
            for (let t = 0; t < 3; t += 0.047) {
                if (!portalSparkPose(out, origin, normal, t, 0.3, i, true)) continue;
                const offset = out.position.clone().sub(new Vector3(...origin));
                expect(offset.dot(normal) - out.scale.y / 2).toBeGreaterThan(0);
                expect(offset.addScaledVector(normal, -offset.dot(normal)).length()).toBeLessThan(1.1);
                expect(out.matrix.elements.every(Number.isFinite)).toBe(true);
                if (portalSparkPose(next, origin, normal, t + 0.00001, 0.3, i, true)) {
                    const velocity = next.position.clone().sub(out.position).normalize();
                    expect(new Vector3(0,1,0).applyQuaternion(out.quaternion).dot(velocity)).toBeGreaterThan(0.99);
                }
            }
        }
    }
});

it('varies repeated bursts, includes gaps, and strengthens danger jets', () => {
    const out = new Object3D(), n = new Vector3(0,0,1);
    expect(portalSparkPose(out, [0,0,0], n, 1.1, 0, 0, false)).toBe(false);
    expect(portalSparkPose(out, [0,0,0], n, 0.01, 0, 4, false)).toBe(false);
    portalSparkPose(out, [0,0,0], n, 0.35, 0, 0, false);
    const first = out.position.clone();
    portalSparkPose(out, [0,0,0], n, 0.35, 0, 0, true);
    expect(out.position.z).toBeGreaterThan(first.z);
    portalSparkPose(out, [0,0,0], n, 1.60, 0, 0, false);
    expect(out.position.distanceTo(first)).toBeGreaterThan(0.01);
    expect(DANGER_SPARKS).toBeGreaterThan(PORTAL_SPARKS);
});
