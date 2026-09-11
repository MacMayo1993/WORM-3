import { CatmullRomCurve3, Vector3 } from 'three';

export const CUBE_WORM_HALF = 1.58;
export const CUBE_WORM_CLEARANCE = 0.16;
// A closed route through front, right, top, back, left, bottom. Project onto
// the rounded cube, never interpolate a chord through the cube's interior.
const route = new CatmullRomCurve3([
  [0.6, 0.65, 3], [3, 0.6, -0.6], [0.5, 3, -0.6],
  [-0.6, 0.6, -3], [-3, -0.6, 0.6], [0.6, -3, 0.6]
].map(p => new Vector3(...p)), true, 'centripetal');
const direction = new Vector3(), next = new Vector3(), scratchNormal = new Vector3();
const clamp = v => Math.max(-CUBE_WORM_HALF, Math.min(CUBE_WORM_HALF, v));
function project(t, position, normal) {
  route.getPoint(((t % 1) + 1) % 1, direction).normalize();
  let low = 0, high = 4;
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    const x = direction.x * mid, y = direction.y * mid, z = direction.z * mid;
    if (Math.hypot(x - clamp(x), y - clamp(y), z - clamp(z)) > CUBE_WORM_CLEARANCE) high = mid;
    else low = mid;
  }
  position.copy(direction).multiplyScalar((low + high) / 2);
  normal.set(position.x - clamp(position.x), position.y - clamp(position.y), position.z - clamp(position.z)).normalize();
}
// Fixed arc-length table keeps climbing speed and body spacing consistent.
const SAMPLES = 512;
const lengths = new Float64Array(SAMPLES + 1);
const previous = new Vector3(), point = new Vector3();
project(0, previous, scratchNormal);
for (let i = 1; i <= SAMPLES; i++) {
  project(i / SAMPLES, point, scratchNormal);
  lengths[i] = lengths[i - 1] + previous.distanceTo(point);
  previous.copy(point);
}
export const CUBE_WORM_LAP = lengths[SAMPLES];
export function sampleCubeWorm(distance, position, normal, forward, antipodal = false) {
  const s = ((distance % CUBE_WORM_LAP) + CUBE_WORM_LAP) % CUBE_WORM_LAP;
  let lo = 0, hi = SAMPLES;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] <= s) lo = mid; else hi = mid; }
  const t = (lo + (s - lengths[lo]) / (lengths[hi] - lengths[lo])) / SAMPLES;
  project(t, position, normal);
  project(t + 0.00001, next, scratchNormal);
  forward.subVectors(next, position).addScaledVector(normal, -forward.dot(normal)).normalize();
  if (antipodal) {
    position.negate();
    normal.negate();
    forward.negate();
  }
}
