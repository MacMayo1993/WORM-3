import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';

// Replace the exterior when the lens crosses the actual raised mouth. Waiting
// for the resting shell leaves the camera among double-sided black cubie backs.
export function tunnelCameraInside(position, size, phase, tunnel = null) {
    if (!['windup', 'entering', 'tunnel', 'exiting', 'windout'].includes(phase)) return false;
    const half = (size - 1) / 2 * cubeExpansionScale(size, tunnel?.padExpansion ?? 0)
        + .53 + (tunnel?.padHeight ?? 0);
    return Math.max(Math.abs(position.x), Math.abs(position.y), Math.abs(position.z)) < half;
}
