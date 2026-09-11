import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { blendSurfaceFrame, dampingAlpha } from '../worm/cameraMotion.js';

describe('camera motion', () => {
    it('has the same follow response at 30, 60 and 144 Hz', () => {
        const results = [30, 60, 144].map(hz => {
            let position = 0;
            for (let i = 0; i < hz; i++) position += (10 - position) * dampingAlpha(8, 1 / hz);
            return position;
        });
        results.forEach(value => expect(value).toBeCloseTo(10 * (1 - Math.exp(-8)), 12));
        expect(dampingAlpha(8, 0)).toBe(0);
        expect(dampingAlpha(8, 0.2)).toBeLessThan(1);
    });

    it('keeps height and setback orthogonal across every adjacent cube face', () => {
        const normals = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v => new Vector3(...v));
        const n = new Vector3(), f = new Vector3();
        for (const old of normals) for (const next of normals) {
            if (old.dot(next) !== 0) continue;
            const oldHeading = next.clone();
            const nextHeading = old.clone().negate();
            for (let step = 0; step <= 20; step++) {
                blendSurfaceFrame(n, f, old, oldHeading, next, nextHeading, step / 20);
                expect(n.length()).toBeCloseTo(1, 12);
                expect(f.length()).toBeCloseTo(1, 12);
                expect(n.dot(f)).toBeCloseTo(0, 12);
            }
            expect(n.distanceTo(next)).toBeLessThan(1e-10);
            expect(f.distanceTo(nextHeading)).toBeLessThan(1e-10);
        }
    });

    it('does not collapse at the midpoint of a heading reversal', () => {
        const n = new Vector3(), f = new Vector3();
        blendSurfaceFrame(n, f, new Vector3(0,1,0), new Vector3(0,0,1),
            new Vector3(0,1,0), new Vector3(0,0,-1), 0.5);
        expect(f.length()).toBeCloseTo(1, 12);
        expect(n.dot(f)).toBeCloseTo(0, 12);
    });
});
