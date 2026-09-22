import { Vector3, MathUtils } from 'three';

const normal = new Vector3();
const side = new Vector3();
const direction = new Vector3();

// Fit the cube's bounding sphere, including the rotating layer and lifted worm,
// through the narrower viewport angle. Portrait needs more distance than desktop.
// Bias the composition slightly toward the impact without cropping the far edge.
export function sliceOverviewInto(eye, look, up, impact, size, fov, aspect) {
    const ax = Math.abs(impact.x), ay = Math.abs(impact.y), az = Math.abs(impact.z);
    if (ax >= ay && ax >= az) normal.set(Math.sign(impact.x) || 1, 0, 0);
    else if (ay >= az) normal.set(0, Math.sign(impact.y) || 1, 0);
    else normal.set(0, 0, Math.sign(impact.z) || 1);
    up.set(0, 1, 0);
    if (Math.abs(normal.y) > 0.9) up.set(0, 0, -normal.y);
    side.crossVectors(normal, up).normalize();
    direction.copy(normal).addScaledVector(side, 0.3).addScaledVector(up, 0.18).normalize();
    look.copy(impact).multiplyScalar(0.18);
    const halfV = MathUtils.degToRad(fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * Math.max(0.1, aspect));
    const radius = size * Math.sqrt(3) / 2 + 0.75 + look.length();
    const distance = radius / Math.sin(Math.min(halfV, halfH)) * 1.08;
    eye.copy(look).addScaledVector(direction, distance);
}
