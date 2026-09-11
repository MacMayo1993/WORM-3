// The camera, rather than the head's animation phase, determines which side of
// the cube is visible. Shared by the exterior and the interior renderers.
export function tunnelCameraInside(position, size, phase) {
    if (!['windup', 'entering', 'tunnel', 'exiting', 'windout'].includes(phase)) return false;
    const half = size / 2 + 0.03;
    return Math.max(Math.abs(position.x), Math.abs(position.y), Math.abs(position.z)) < half;
}
