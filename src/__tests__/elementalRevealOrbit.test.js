import { it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { makeElementalRevealOrbit, sampleElementalRevealOrbit } from '../worm/elementalRevealOrbit.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';

it('pulls out, completes the circle before zooming in, and returns to the captured view on every face', () => {
    for (const start of [[10, 0, 0], [-10, 0, 0], [0, 10, 0], [0, -10, 0], [0, 0, 10], [0, 0, -10]]) {
        const camera = new PerspectiveCamera(78);
        camera.position.fromArray(start);
        camera.lookAt(0.2, 0.3, 0);
        const orbit = makeElementalRevealOrbit(camera, new Vector3(0.2, 0.3, 0));
        const eye = new Vector3(), look = new Vector3(), up = new Vector3();
        for (let i = 0; i <= 120; i++) {
            const t = i / 120;
            sampleElementalRevealOrbit(orbit, t, eye, look, up);
            expect(eye.length()).toBeGreaterThanOrEqual(10 - 1e-9);
            expect(up.length()).toBeCloseTo(1, 10);
            expect(eye.distanceTo(look)).toBeGreaterThan(0.1);
            expect(Math.abs(up.dot(look.clone().sub(eye).normalize()))).toBeLessThan(0.999);
            if (t >= 0.18 && t <= 0.82) expect(eye.length()).toBeCloseTo(orbit.revealRadius, 8);
        }
        expect(eye.distanceTo(camera.position)).toBeLessThan(1e-9);
        expect(look.distanceTo(orbit.look)).toBeLessThan(1e-9);
        expect(up.distanceTo(orbit.viewUp)).toBeLessThan(1e-9);
        sampleElementalRevealOrbit(orbit, 0.5, eye, look, up);
        expect(eye.clone().normalize().distanceTo(camera.position.clone().normalize().negate())).toBeLessThan(1e-9);
        expect(look.length()).toBeLessThan(1e-9);
        sampleElementalRevealOrbit(orbit, 0.82, eye, look, up);
        expect(eye.clone().normalize().distanceTo(camera.position.clone().normalize())).toBeLessThan(1e-9);
        expect(orbit.fov).toBe(78);
    }
});

it.each([2, 7, 10, 15])('keeps every corner of a %s cube on screen throughout the full orbit', size => {
    for (const aspect of [9 / 20, 1, 16 / 9]) for (const expansion of [0, 0.65]) {
        const camera = new PerspectiveCamera(65, aspect, 0.1, 1000);
        camera.zoom = 1.2;
        camera.updateProjectionMatrix();
        camera.position.set(1, 2, size + 3);
        camera.lookAt(0, 0, size / 2);
        const orbit = makeElementalRevealOrbit(camera, new Vector3(0, 0, size / 2), { size, expansion });
        const eye = new Vector3(), look = new Vector3(), up = new Vector3();
        const half = (size - 1) / 2 * cubeExpansionScale(size, expansion) + 0.8;
        for (let i = 0; i <= 32; i++) {
            sampleElementalRevealOrbit(orbit, 0.18 + i / 32 * 0.64, eye, look, up);
            camera.position.copy(eye); camera.up.copy(up); camera.lookAt(look); camera.updateMatrixWorld();
            for (const x of [-half, half]) for (const y of [-half, half]) for (const z of [-half, half]) {
                const projected = new Vector3(x, y, z).project(camera);
                expect(Math.abs(projected.x)).toBeLessThan(0.95);
                expect(Math.abs(projected.y)).toBeLessThan(0.95);
            }
        }
    }
});

it('uses a gentle pullback without rotation for reduced motion', () => {
    const camera = new PerspectiveCamera(70, 0.5);
    camera.position.set(2, 3, 10); camera.lookAt(0, 0, 0);
    const orbit = makeElementalRevealOrbit(camera, new Vector3(), { size: 15, reducedMotion: true });
    const eye = new Vector3(), look = new Vector3(), up = new Vector3();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        sampleElementalRevealOrbit(orbit, t, eye, look, up);
        expect(eye.clone().normalize().distanceTo(camera.position.clone().normalize())).toBeLessThan(1e-9);
    }
    expect(eye.distanceTo(camera.position)).toBeLessThan(1e-9);
});
