import { CubicBezierCurve3, Vector3 } from 'three';

export const MENU_WORM_RADIUS = 0.14;
export const MENU_WORM_SEGMENTS = 14;
export const MENU_WORM_SPACING = 0.105;
export const MENU_WORM_SPEED = 1.65;
export const MENU_WORM_TAIL = (MENU_WORM_SEGMENTS - 1) * MENU_WORM_SPACING;

// Each face has a dedicated wormhole. Crawl around that face and return to
// the same mouth; opposite openings never receive a second worm's route.
export function makeMenuTunnelWormPath(start, phase = 0) {
  const normal = new Vector3(...start).normalize();
  const axis = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  // Vary the loop orientation while keeping both crossings on this face.
  const turn = Math.floor(((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2));
  const right = new Vector3().crossVectors(axis, normal).normalize().applyAxisAngle(normal, turn * Math.PI / 2);
  const up = new Vector3().crossVectors(normal, right).normalize();
  const half = new Vector3(...start).length();
  const clearance = MENU_WORM_RADIUS * 0.86;
  const h = half + clearance, buried = h - 0.75;
  const legs = [
    // Cross axially, then bend onto the raised tile without clipping its rim.
    { curve: [[0, 0, buried], [0, 0, half], [0, 0, half], [0, 0, h]] },
    { curve: [[0, 0, h], [0, 0, h + 0.2], [0.22, 0, h], [0.72, 0, h]] },
    // A roomy loop leaves the center clear and fits entirely on this face.
    { curve: [[0.72, 0, h], [1.25, 0, h], [1.25, 1.05, h], [1.08, 1.05, h]], surface: true },
    { curve: [[1.08, 1.05, h], [0.4, 1.05, h], [-0.4, 1.05, h], [-1.08, 1.05, h]], surface: true },
    { curve: [[-1.08, 1.05, h], [-1.3, 1.05, h], [-1.3, -1.05, h], [-1.08, -1.05, h]], surface: true },
    { curve: [[-1.08, -1.05, h], [-0.6, -1.05, h], [0, -1.05, h], [0, -0.72, h]], surface: true },
    { curve: [[0, -0.72, h], [0, -0.22, h], [0, 0, h + 0.2], [0, 0, h]] },
    { curve: [[0, 0, h], [0, 0, half], [0, 0, half], [0, 0, buried]] },
  ];
  const points = [], normals = [], lengths = [], surfaceRanges = [];
  let length = 0;
  const world = p => right.clone().multiplyScalar(p.x).addScaledVector(up, p.y).addScaledVector(normal, p.z);
  legs.forEach((leg, index) => {
    const curve = new CubicBezierCurve3(...leg.curve.map(p => new Vector3(...p)));
    const from = points.length;
    for (let j = index ? 1 : 0; j <= 160; j++) {
      const t = j / 160;
      const p = curve.getPoint(t);
      const position = world(p);
      if (points.length) length += position.distanceTo(points[points.length - 1]);
      points.push(position); normals.push(normal.clone()); lengths.push(length);
    }
    if (leg.surface) surfaceRanges.push([from, points.length]);
  });
  const portals = { source: new Vector3(...start), destination: new Vector3(...start) };
  const beats = [['source', 'exit', 0], ['destination', 'enter', legs.length - 1]].map(([name, kind, leg]) => {
    const axis = portals[name].clone().normalize();
    for (let i = leg * 160 + 1; i <= (leg + 1) * 160; i++) {
      const a = points[i - 1].dot(axis) - half, b = points[i].dot(axis) - half;
      if (a * b <= 0 && a !== b) return { kind, distance: lengths[i - 1] + (lengths[i] - lengths[i - 1]) * -a / (b - a) };
    }
    throw new Error(`Menu worm route does not cross its ${name} mouth`);
  });
  return { points, normals, lengths, length, normal, up, surfaceRanges, portals, beats,
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
  // A live menu tile can turn edge-on until path.up is axial too. Pick the
  // least-aligned world axis rather than giving the character a zero frame.
  if (normal.lengthSq() < 0.001) {
    const x = Math.abs(forward.x), y = Math.abs(forward.y), z = Math.abs(forward.z);
    normal.set(x <= y && x <= z ? 1 : 0, y < x && y <= z ? 1 : 0, z < x && z < y ? 1 : 0);
    normal.addScaledVector(forward, -normal.dot(forward));
  }
  normal.normalize();
  return distance >= 0 && distance <= path.length;
}
