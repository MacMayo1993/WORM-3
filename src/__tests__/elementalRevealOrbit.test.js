import { it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { makeElementalRevealOrbit, sampleElementalRevealOrbit } from '../worm/elementalRevealOrbit.js';

it('keeps distance fixed and returns to the original view on every cube face', () => {
    for (const start of [[10, 0, 0], [-10, 0, 0], [0, 10, 0], [0, -10, 0], [0, 0, 10], [0, 0, -10]]) {
        const camera = new PerspectiveCamera(78);
        camera.position.fromArray(start);
        camera.lookAt(0.2, 0.3, 0);
        const orbit = makeElementalRevealOrbit(camera, new Vector3(0.2, 0.3, 0));
        const eye = new Vector3(), look = new Vector3(), up = new Vector3();
        for (let i = 0; i <= 120; i++) {
            sampleElementalRevealOrbit(orbit, i / 120, eye, look, up);
            expect(eye.length()).toBeCloseTo(10, 10);
            expect(up.length()).toBeCloseTo(1, 10);
            expect(eye.distanceTo(look)).toBeGreaterThan(0.1);
            expect(Math.abs(up.dot(look.clone().sub(eye).normalize()))).toBeLessThan(0.999);
        }
        expect(eye.distanceTo(camera.position)).toBeLessThan(1e-9);
        expect(look.distanceTo(orbit.look)).toBeLessThan(1e-9);
        expect(up.distanceTo(orbit.viewUp)).toBeLessThan(1e-9);
        sampleElementalRevealOrbit(orbit, 0.5, eye, look, up);
        expect(eye.distanceTo(camera.position.clone().negate())).toBeLessThan(1e-9);
        expect(look.length()).toBeLessThan(1e-9);
        expect(orbit.fov).toBe(78);
    }
});
