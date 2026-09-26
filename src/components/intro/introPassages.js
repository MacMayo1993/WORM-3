import { Vector3 } from 'three';
import { PAIRS } from './introTopology.js';
import { WORM_START } from './introTiming.js';
import { clamp01 } from './introChoreography.js';

// Six readable hero routes, two per axis. The full cube topology is unchanged.
// Edge centres give each portal its own cubie and avoid a knot at the core.
export const PASSAGES = [
  [2, [-1, 0, 1]], [2, [1, 0, 1]],
  [0, [1, -1, 0]], [0, [1, 1, 0]],
  [1, [0, 1, -1]], [1, [0, 1, 1]]
].map(([axis, position]) => PAIRS.find(p => p.face.axis === axis && p.position.every((v, i) => v === position[i])));
export const WORM_SEGMENTS = 16;
const start = new Vector3(), end = new Vector3(), bend = new Vector3();

// Bow each route around the mechanism. The envelope and its derivative vanish
// at both mouths, so the worm enters perpendicular to the actual sticker.
export function passagePoint(pair, u, spacing, out) {
  start.set(...pair.position).multiplyScalar(spacing);
  start.setComponent(pair.face.axis, start.getComponent(pair.face.axis) + 0.54);
  end.copy(start).negate();
  const t = clamp01(u);
  const axis = pair.face.axis;
  const along = start.getComponent(axis);
  out.copy(start).lerp(end, t * t * (3 - 2 * t));
  out.setComponent(axis, along * (1 - 2 * t));
  bend.set(0, 0, 0);
  const bendAxis = pair.position.findIndex((v, i) => i !== axis && v === 0);
  const sign = pair.position.find((v, i) => i !== axis && v !== 0);
  bend.setComponent(bendAxis, sign * spacing * 0.7 * Math.sin(Math.PI * t) ** 2);
  return out.add(bend);
}

export function wormProgress(time, route) {
  return (time - WORM_START - route * 0.13) / 1.8;
}

// Grow out of the entrance and shrink into the exit; no floating bead pops.
export function wormSegmentScale(u, segment) {
  return Math.min(clamp01(u / 0.025), clamp01((1 - u) / 0.025)) * (0.205 - segment * 0.0065);
}
