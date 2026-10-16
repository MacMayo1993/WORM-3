import { Vector3, Quaternion } from 'three';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { eventCameraDistance } from './wormCameraZoom.js';

const smooth = t => {
    t = Math.max(0, Math.min(1, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
};

// Pickup reveals stand 25% farther back than the reduced event shot, then return
// to the captured pose. Slice and tail-cut event distances stay unchanged.
// Use the same portrait/expanded-board fit as the reference distance.
export function makeElementalRevealOrbit(camera, look, { size = 3, expansion = 0, reducedMotion = false } = {}) {
    const position = camera.position.clone();
    const radial = position.clone().normalize();
    const viewUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const axis = viewUp.clone().addScaledVector(radial, -viewUp.dot(radial));
    if (axis.lengthSq() < 1e-8) {
        axis.set(Math.abs(radial.y) < 0.9 ? 0 : 1, Math.abs(radial.y) < 0.9 ? 1 : 0, 0);
        axis.addScaledVector(radial, -axis.dot(radial));
    }
    axis.normalize();
    const target = camera.getWorldDirection(new Vector3())
        .multiplyScalar(Math.max(0.1, position.distanceTo(look))).add(position);
    const verticalHalfFov = (camera.getEffectiveFOV?.() ?? camera.fov) * Math.PI / 360;
    const limitingHalfFov = Math.min(verticalHalfFov, Math.atan(Math.tan(verticalHalfFov) * camera.aspect));
    const halfExtent = (size - 1) * cubeExpansionScale(size, expansion) / 2 + 1;
    const fitRadius = Math.sqrt(3) * halfExtent / Math.sin(limitingHalfFov) * 1.15;
    // A close full orbit must still clear the corners on wide/expanded boards.
    const clearanceRadius = Math.sqrt(3) * (halfExtent - 0.5) + 0.15;
    const revealRadius = 1.25 * eventCameraDistance(position.length(), Math.max(position.length() * 1.35, fitRadius), clearanceRadius);
    return { revealRadius, reducedMotion, position, look: target, up: camera.up.clone(), quaternion: camera.quaternion.clone(),
        axis, viewUp, fov: camera.fov, rotation: new Quaternion() };
}

export function sampleElementalRevealOrbit(orbit, progress, eye, look, up) {
    const t = Math.max(0, Math.min(1, progress));
    // Finish the full 360 before beginning the inward leg, so the original
    // heading is already restored when the worm comes back into close view.
    const pull = smooth(t / 0.18) * (1 - smooth((t - 0.82) / 0.18));
    const angle = orbit.reducedMotion ? 0 : smooth((t - 0.18) / 0.64) * Math.PI * 2;
    orbit.rotation.setFromAxisAngle(orbit.axis, angle);
    eye.copy(orbit.position).applyQuaternion(orbit.rotation)
        .setLength(orbit.position.length() + (orbit.revealRadius - orbit.position.length()) * pull);
    look.copy(orbit.look).applyQuaternion(orbit.rotation).multiplyScalar(1 - pull);
    up.copy(orbit.viewUp).applyQuaternion(orbit.rotation).normalize();
}
