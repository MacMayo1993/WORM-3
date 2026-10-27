import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createAirSlipstream } from '../worm/healerWorm/airSlipstream.js';

it('carries the open wake with the rendered body on every cube face and live rotation', () => {
    const wind = createAirSlipstream();
    const head = new THREE.Vector3(0, 1, 3), normal = new THREE.Vector3(0, 0, 1);
    const segments = { count: 4, positions: new Float32Array([0, 1, 3, 0, .6, 3, .2, .2, 3, .6, 0, 3]) };
    wind.update(head, normal, segments, 1.2, true, false, false);
    const original = wind.mesh.geometry.attributes.position.array.slice();
    const v = new THREE.Vector3(), offset = new THREE.Vector3(2, -1, .5);
    for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)]) {
        for (const angle of [Math.PI / 2, Math.PI, -Math.PI / 2, .63]) {
            const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
            const moved = { count: segments.count, positions: segments.positions.slice() };
            for (let i = 0; i < moved.count; i++) v.fromArray(segments.positions, i * 3).applyQuaternion(q).add(offset).toArray(moved.positions, i * 3);
            wind.update(head.clone().applyQuaternion(q).add(offset), normal.clone().applyQuaternion(q), moved, 1.2, true, false, false);
            const actual = wind.mesh.geometry.attributes.position.array;
            for (let i = 0; i < original.length; i += 3) {
                v.fromArray(original, i).applyQuaternion(q).add(offset);
                expect(v.distanceTo(new THREE.Vector3().fromArray(actual, i))).toBeLessThan(1e-5);
            }
        }
    }
    wind.mesh.geometry.dispose(); wind.mesh.material.dispose();
});

it('keeps reset, overlapping beads and vertical flight finite and bounded', () => {
    const wind = createAirSlipstream(), head = new THREE.Vector3(0, 0, 3), normal = new THREE.Vector3(0, 0, 1);
    for (const segments of [
        { count: 0, positions: new Float32Array(0) },
        { count: 1, positions: new Float32Array([0, 0, 3]) },
        { count: 3, positions: new Float32Array([0, 0, 3, 0, 0, 3, 0, 0, 3]) },
        { count: 3, positions: new Float32Array([0, 0, 3, 0, 0, 2.8, 0, 0, 2.6]) },
    ]) {
        wind.update(head, normal, segments, 2, true, false, false);
        const positions = wind.mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const distance = new THREE.Vector3().fromArray(positions, i).distanceTo(head);
            expect(Number.isFinite(distance)).toBe(true); expect(distance).toBeLessThan(5);
        }
    }
    wind.mesh.geometry.dispose(); wind.mesh.material.dispose();
});
