// A rounded perimeter outside the mode plates, expressed entirely in cube space.
// Straight runs stay on a face; quarter-circles carry the body around each edge.
export const CUBE_WORM_HALF = 1.58;
export const CUBE_WORM_CLEARANCE = 0.16;
export const CUBE_WORM_LAP = 4 * (2 * CUBE_WORM_HALF + Math.PI * CUBE_WORM_CLEARANCE / 2);
export function sampleCubeWorm(distance, position, normal, forward) {
  const h = CUBE_WORM_HALF, r = CUBE_WORM_CLEARANCE;
  const side = CUBE_WORM_LAP / 4;
  const s = ((distance % CUBE_WORM_LAP) + CUBE_WORM_LAP) % CUBE_WORM_LAP;
  const quarter = Math.floor(s / side), u = s - quarter * side;
  let x, z, nx, nz, tx, tz;
  if (u < 2 * h) {
    x = -h + u; z = h + r; nx = 0; nz = 1; tx = 1; tz = 0;
  } else {
    const angle = (u - 2 * h) / r;
    nx = Math.sin(angle); nz = Math.cos(angle);
    x = h + r * nx; z = h + r * nz; tx = nz; tz = -nx;
  }
  const angle = quarter * Math.PI / 2, c = Math.cos(angle), t = Math.sin(angle);
  // The same traveling wave is sampled by every bead, so the tail follows the head.
  const y = 1.03 + 0.10 * Math.sin(s * 24 * Math.PI / CUBE_WORM_LAP);
  const dy = 0.10 * 24 * Math.PI / CUBE_WORM_LAP * Math.cos(s * 24 * Math.PI / CUBE_WORM_LAP);
  position.set(c * x + t * z, y, -t * x + c * z);
  normal.set(c * nx + t * nz, 0, -t * nx + c * nz);
  forward.set(c * tx + t * tz, dy, -t * tx + c * tz).normalize();
}
