import { CubicBezierCurve3, Vector3 } from 'three';

export const MENU_WORM_RADIUS = 0.14;
export const MENU_WORM_SEGMENTS = 14;
export const MENU_WORM_SPACING = 0.105;
export const MENU_WORM_SPEED = 1.65;
export const MENU_WORM_TAIL = (MENU_WORM_SEGMENTS - 1) * MENU_WORM_SPACING;

// The same distance-indexed trail drives the head AND every following bead.
// Surface legs stay on the sticker plane; only the center-tile throats dive.
export function makeMenuTunnelWormPath(start, phase = 0) {
  const normal = new Vector3(...start).normalize();
  const axis = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const right = new Vector3().crossVectors(axis, normal).normalize().applyAxisAngle(normal, phase);
  const up = new Vector3().crossVectors(normal, right).normalize();
  const h = new Vector3(...start).length() + MENU_WORM_RADIUS * 0.86;
  const buried = h - 0.75;
  const legs = [
    [[0, 0, buried], [0, 0, h], [0.3, 0, h], [0.65, 0, h]],
    [[0.65, 0, h], [1.05, 0, h], [1.05, 0.8, h], [0.5, 0.8, h]],
    [[0.5, 0.8, h], [-0.15, 0.8, h], [-0.95, 0.55, h], [-0.8, -0.15, h]],
    [[-0.8, -0.15, h], [-0.7, -0.8, h], [0.6, -0.7, h], [0.6, -0.25, h]],
    [[0.6, -0.25, h], [0.6, 0.1, h], [0, 0, h], [0, 0, buried]],
  ];
  const tunnel = [[0, 0, buried], [0, 0, buried / 3], [0, 0, -buried / 3], [0, 0, -buried]];
  const curves = [...legs, tunnel, ...legs.map(leg => leg.map(p => p.map(v => -v)))];
  const points = [], lengths = [];
  let length = 0;
  curves.forEach((leg, index) => {
    const curve = new CubicBezierCurve3(...leg.map(p => new Vector3(...p)));
    for (let j = index ? 1 : 0; j <= 100; j++) {
      const t = j / 100;
      const p = curve.getPoint(t);
      // Sidewinder bends are baked into the trail, so the tail follows them
      // through the mouths rather than receiving a new offset after exit.
      if (index !== 5) {
        const envelope = Math.sin(Math.PI * t) ** 2;
        p.y += 0.10 * Math.sin(t * Math.PI * 4) * envelope * (index < 5 ? 1 : -1);
      }
      const world = right.clone().multiplyScalar(p.x).addScaledVector(up, p.y).addScaledVector(normal, p.z);
      if (points.length) length += world.distanceTo(points[points.length - 1]);
      points.push(world); lengths.push(length);
    }
  });
  return { points, lengths, length, normal, up, duration: (length + MENU_WORM_TAIL) / MENU_WORM_SPEED };
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
  normal.copy(path.normal).multiplyScalar(position.dot(path.normal) >= 0 ? 1 : -1);
  // A stable perpendicular face frame inside the throat (where travel is axial).
  normal.addScaledVector(forward, -normal.dot(forward));
  if (normal.lengthSq() < 0.001) normal.copy(path.up).addScaledVector(forward, -path.up.dot(forward));
  normal.normalize();
  return distance >= 0 && distance <= path.length;
}
