import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createOrbVisibility } from '../worm/orbVisibility.js';

function setup() {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const visibility = createOrbVisibility();
    visibility.begin(camera);
    return { camera, visibility };
}

describe('whole parity orb visibility', () => {
    it('keeps visible and edge-overlapping halos but rejects fully offscreen spheres', () => {
        const { visibility } = setup();
        expect(visibility.contains(new THREE.Vector3(0, 0, -5), 0.85)).toBe(true);
        expect(visibility.contains(new THREE.Vector3(3.1, 0, -5), 0.85)).toBe(true);
        expect(visibility.contains(new THREE.Vector3(5, 0, -5), 0.85)).toBe(false);
        expect(visibility.contains(new THREE.Vector3(0, 0, 5), 0.85)).toBe(false);
        expect(visibility.contains(new THREE.Vector3(0, 0, -102), 0.85)).toBe(false);
    });
    it('rechecks camera turns immediately, without a visibility cache', () => {
        const { camera, visibility } = setup();
        const orb = new THREE.Vector3(5, 0, 0);
        expect(visibility.contains(orb, 0.85)).toBe(false);
        camera.lookAt(orb);
        visibility.begin(camera);
        expect(visibility.contains(orb, 0.85)).toBe(true);
    });
    it('handles scaled and rotated parent transforms without mutating the orb', () => {
        const { camera, visibility } = setup();
        const parent = new THREE.Group();
        parent.position.set(0, 0, -5);
        parent.rotation.y = Math.PI / 2;
        parent.scale.set(2, 3, 4);
        const orb = new THREE.Vector3(1, 0, 0);
        visibility.begin(camera, parent);
        expect(visibility.contains(orb, 0.85)).toBe(true);
        expect(orb.toArray()).toEqual([1, 0, 0]);
        parent.position.x = 100;
        visibility.begin(camera, parent);
        expect(visibility.contains(orb, 0.85)).toBe(false);
    });
    it('keeps an orb containing the camera during close tunnel passes', () => {
        const { visibility } = setup();
        expect(visibility.contains(new THREE.Vector3(0, 0, 0), 1.1)).toBe(true);
    });
});
