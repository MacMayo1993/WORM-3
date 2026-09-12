import { CubicBezierCurve3, Vector3 } from 'three';

export const MENU_WORM_RADIUS = 0.14;
export const MENU_WORM_SEGMENTS = 14;
export const MENU_WORM_SPACING = 0.105;
export const MENU_WORM_SPEED = 1.65;
export const MENU_WORM_TAIL = (MENU_WORM_SEGMENTS - 1) * MENU_WORM_SPACING;

// Each surface leg connects DIFFERENT center portals. Only the interior leg
// crosses the cube; all following segments share this distance-indexed trail.
export function makeMenuTunnelWormPath(start, phase = 0) {
  const normal = new Vector3(...start).normalize();
  const axis = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  // Pick one of the four adjacent faces, keeping the endpoint on a real center tile.
  const turn = Math.floor(((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2));
  const right = new Vector3().crossVectors(axis, normal).normalize().applyAxisAngle(normal, turn * Math.PI / 2);
  const up = new Vector3().crossVectors(normal, right).normalize();
  const half = new Vector3(...start).length();
  const clearance = MENU_WORM_RADIUS * 0.86;
  const h = half + clearance, buried = h - 0.75;
  const surface = [[0.45, 0, h], [1.3, 0, h], [h, 0, 1.3], [h, 0, 0.45]];
  const legs = [
    { curve: [[0, 0, buried], [0, 0, h], [0.15, 0, h], [0.45, 0, h]], face: [0, 0, 1] },
    { curve: surface, surface: true },
    { curve: [[h, 0, 0.45], [h, 0, 0.15], [h, 0, 0], [buried, 0, 0]], face: [1, 0, 0] },
    { curve: [[buried, 0, 0], [buried / 3, 0, 0], [-buried / 3, 0, 0], [-buried, 0, 0]], face: [0, 1, 0] },
    { curve: [[-buried, 0, 0], [-h, 0, 0], [-h, 0, -0.15], [-h, 0, -0.45]], face: [-1, 0, 0] },
    { curve: [...surface].reverse().map(p => p.map(v => -v)), surface: true },
    { curve: [[-0.45, 0, -h], [-0.15, 0, -h], [0, 0, -h], [0, 0, -buried]], face: [0, 0, -1] },
  ];
  const points = [], normals = [], lengths = [], surfaceRanges = [];
  let length = 0;
  const clamp = v => Math.max(-half, Math.min(half, v));
  const world = p => right.clone().multiplyScalar(p.x).addScaledVector(up, p.y).addScaledVector(normal, p.z);
  legs.forEach((leg, index) => {
    const curve = new CubicBezierCurve3(...leg.curve.map(p => new Vector3(...p)));
    const from = points.length;
    for (let j = index ? 1 : 0; j <= 160; j++) {
      const t = j / 160;
      const p = curve.getPoint(t);
      if (leg.surface) {
        p.y += 0.13 * Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) ** 2;
        p.normalize();
        // Radial projection onto a rounded cube avoids cutting through an edge.
        let low = 0, high = 4 * half;
        for (let k = 0; k < 28; k++) {
          const mid = (low + high) / 2;
          const x = p.x * mid, y = p.y * mid, z = p.z * mid;
          if (Math.hypot(x - clamp(x), y - clamp(y), z - clamp(z)) > clearance) high = mid;
          else low = mid;
        }
        p.multiplyScalar((low + high) / 2);
      }
      const n = leg.surface
        ? new Vector3(p.x - clamp(p.x), p.y - clamp(p.y), p.z - clamp(p.z)).normalize()
        : new Vector3(...leg.face);
      const position = world(p);
      if (points.length) length += position.distanceTo(points[points.length - 1]);
      points.push(position); normals.push(world(n)); lengths.push(length);
    }
    if (leg.surface) surfaceRanges.push([from, points.length]);
  });
  return { points, normals, lengths, length, normal, up, surfaceRanges,
    portals: { source: new Vector3(...start), entry: right.clone().multiplyScalar(half),
      exit: right.clone().multiplyScalar(-half), destination: new Vector3(...start).negate() },
    duration: (length + MENU_WORM_TAIL) / MENU_WORM_SPEED };
}

export function sampleMenuTunnelWorm(path, distance, position, normal, forward) {
  const s = Math.max(0, Math.min(path.length, distance));
  let lo = 0, hi = path.lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.lengths[mid] <= s) lo = mid; else hi = mid;
  }
  const span = path.lengths[hi] - path.lengths[lo];
  position.lerpVectors(path.points[lo], path.points[hi], span ? (s - path.lengths[lo]) / span : 0);
  forward.subVectors(path.points[hi], path.points[lo]).normalize();
  normal.lerpVectors(path.normals[lo], path.normals[hi], span ? (s - path.lengths[lo]) / span : 0);
  // A stable perpendicular face frame inside the throat (where travel is axial).
  normal.addScaledVector(forward, -normal.dot(forward));
  if (normal.lengthSq() < 0.001) normal.copy(path.up).addScaledVector(forward, -path.up.dot(forward));
  normal.normalize();
  return distance >= 0 && distance <= path.length;
}
