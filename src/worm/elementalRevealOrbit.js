import { Vector3, Quaternion } from 'three';

// Orbit about the cube origin on a great circle: radius stays constant even
// when the player starts directly above or below the cube.
export function makeElementalRevealOrbit(camera, look) {
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
    return { position, look: target, up: camera.up.clone(), quaternion: camera.quaternion.clone(),
        axis, viewUp, fov: camera.fov, rotation: new Quaternion() };
}

export function sampleElementalRevealOrbit(orbit, progress, eye, look, up) {
    const t = Math.max(0, Math.min(1, progress));
    const ease = t * t * t * (t * (t * 6 - 15) + 10);
    orbit.rotation.setFromAxisAngle(orbit.axis, ease * Math.PI * 2);
    eye.copy(orbit.position).applyQuaternion(orbit.rotation);
    look.copy(orbit.look).applyQuaternion(orbit.rotation).multiplyScalar(1 - Math.sin(Math.PI * t) ** 2);
    up.copy(orbit.viewUp).applyQuaternion(orbit.rotation).normalize();
}
