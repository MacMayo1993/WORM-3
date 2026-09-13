import * as THREE from 'three';

// One conservative sphere replaces per-part work for off-screen orbs. No
// occlusion guesses: orbs around cube corners retain their full silhouette.
export function createOrbVisibility() {
    const frustum = new THREE.Frustum();
    const viewProjection = new THREE.Matrix4();
    const parentWorld = new THREE.Matrix4();
    const sphere = new THREE.Sphere();
    return {
        begin(camera, parent) {
            camera.updateWorldMatrix(true, false);
            viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(viewProjection);
            if (parent) {
                parent.updateWorldMatrix(true, false);
                parentWorld.copy(parent.matrixWorld);
            } else parentWorld.identity();
        },
        contains(position, radius) {
            sphere.center.copy(position);
            sphere.radius = radius;
            sphere.applyMatrix4(parentWorld);
            return frustum.intersectsSphere(sphere);
        },
    };
}
