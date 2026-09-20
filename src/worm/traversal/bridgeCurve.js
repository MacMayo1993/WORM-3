import { Vector3 } from 'three';

// A degree-four Bezier has horizontal contact tangents and a sagging middle.
// Adaptive subdivision bounds curve/line deviation for conservative collision.
export const CURVE_DEVIATION_TOLERANCE = 0.0002;
export const ARC_LENGTH_TOLERANCE = 0.00001;
export const SAG_FIT_TOLERANCE = 0.0001;
const MAX_DEPTH = 18;
const EPS = 1e-9;
function subdivide(control, depth, points, errors, lengthErrors, budget) {
  const a = control[0], b = control[4], chord = b.clone().sub(a), length = chord.length();
  let flatness = 0, polygon = 0;
  for (let i = 1; i < 5; i++) polygon += control[i].distanceTo(control[i - 1]);
  for (let i = 1; i < 4; i++) {
    const offset = control[i].clone().sub(a);
    const t = length > EPS ? Math.max(0, Math.min(1, offset.dot(chord) / (length * length))) : 0;
    flatness = Math.max(flatness, offset.addScaledVector(chord, -t).length());
  }
  const lengthError = Math.max(0, polygon - length);
  if (flatness <= CURVE_DEVIATION_TOLERANCE && lengthError <= budget) {
    points.push(b.clone()); errors.push(flatness); lengthErrors.push(lengthError); return;
  }
  // Never silently accept an unresolved interval at the subdivision limit.
  if (depth >= MAX_DEPTH) throw new RangeError('Bridge subdivision did not meet error bounds');
  const work = control.map(p => p.clone()), left = [work[0].clone()], right = [work[4].clone()];
  for (let level = 4; level > 0; level--) {
    for (let i = 0; i < level; i++) work[i].lerp(work[i + 1], .5);
    left.push(work[0].clone()); right.push(work[level - 1].clone());
  }
  subdivide(left, depth + 1, points, errors, lengthErrors, budget / 2);
  subdivide(right.reverse(), depth + 1, points, errors, lengthErrors, budget / 2);
}
export function makeBridgeCurve(a, b, up, sag = 0, shoulder = 0) {
  if (![...a, ...b, ...up, sag, shoulder].every(Number.isFinite) || sag < 0 || shoulder < 0 || up.lengthSq() < EPS) throw new Error('Invalid bridge geometry');
  const normal = up.clone().normalize(), delta = b.clone().sub(a);
  const rise = delta.dot(normal), horizontal = delta.clone().addScaledVector(normal, -rise);
  if (horizontal.length() < .0001) throw new Error('Bridge needs distinct horizontal supports');
  if (shoulder > 0) {
    if (shoulder * 2 >= horizontal.length()) throw new Error('Contact shoulders exceed span');
    const direction = horizontal.clone().normalize();
    const middle = makeBridgeCurve(a.clone().addScaledVector(direction, shoulder), b.clone().addScaledVector(direction, -shoulder), up, sag);
    const points = [a.clone(), ...middle.points, b.clone()];
    const distances = [0, ...middle.distances.map(d => d + shoulder), middle.length + 2 * shoulder];
    return { ...middle, points, distances, errors: [0, ...middle.errors, 0], length: distances.at(-1), lengthUpper: middle.lengthUpper + 2 * shoulder };
  }
  const control = [a.clone(), a.clone().addScaledVector(horizontal, .25),
    a.clone().addScaledVector(horizontal, .5).addScaledVector(normal, rise * .5 - 8 * sag / 3),
    a.clone().addScaledVector(horizontal, .75).addScaledVector(normal, rise), b.clone()];
  const points = [a.clone()], errors = [], lengthErrors = [];
  subdivide(control, 0, points, errors, lengthErrors, ARC_LENGTH_TOLERANCE);
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
  const lengthErrorBound = lengthErrors.reduce((sum, error) => sum + error, 0);
  return { points, errors, distances, length: distances.at(-1), lengthUpper: distances.at(-1) + lengthErrorBound, lengthErrorBound, up: normal, forward: horizontal.normalize(), sag };
}
export function sampleBridgeInto(curve, distance, position, normal, forward) {
  const { points, distances } = curve;
  const d = Math.max(0, Math.min(curve.length, distance));
  let lo = 0, hi = distances.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (distances[m] < d) lo = m; else hi = m; }
  const span = distances[hi] - distances[lo];
  const t = span > EPS ? (d - distances[lo]) / span : 0;
  position.lerpVectors(points[lo], points[hi], t);
  forward.subVectors(points[hi], points[lo]).normalize();
  normal.copy(curve.up).addScaledVector(forward, -curve.up.dot(forward)).normalize();
  return position;
}
export function fitBridgeToLength(a, b, up, available, desiredSag, shoulder = 0) {
  if (!Number.isFinite(available) || !Number.isFinite(desiredSag) || desiredSag < 0) throw new Error('Invalid sag budget');
  let best = makeBridgeCurve(a, b, up, 0, shoulder);
  if (best.lengthUpper > available) return null;
  const desired = makeBridgeCurve(a, b, up, desiredSag, shoulder);
  const finish = (curve, high, constrained) => ({ ...curve, fit: {
    available, constrained, sagBracket: [curve.sag, high],
    slackUpper: available - curve.length, tolerance: SAG_FIT_TOLERANCE,
  } });
  if (desired.lengthUpper <= available) return finish(desired, desiredSag, false);
  let low = 0, high = desiredSag;
  // Exact arclength is strictly increasing for d >= 0 (see the milestone proof).
  // Classify uncertainty against its upper bound: the returned curve always fits.
  // This may reject <= ARC_LENGTH_TOLERANCE of feasible length, never overspend it.
  for (let i = 0; i < 64; i++) {
    if (available - best.length <= SAG_FIT_TOLERANCE) return finish(best, high, true);
    const mid = (low + high) / 2, curve = makeBridgeCurve(a, b, up, mid, shoulder);
    if (curve.lengthUpper <= available) { low = mid; best = curve; } else high = mid;
  }
  throw new RangeError('Sag fit did not meet length tolerance');
}

// Segment versus inflated AABB, inclusive. The curve's per-segment convex-hull
// error is added to radius, so checking only the polyline cannot miss a corner.
export function segmentHitsBox(a, b, box, radius) {
  let enter = 0, exit = 1;
  for (const key of ['x', 'y', 'z']) {
    const min = box.min[key] - radius, max = box.max[key] + radius, d = b[key] - a[key];
    if (Math.abs(d) < EPS) { if (a[key] < min || a[key] > max) return false; }
    else {
      const t1 = (min - a[key]) / d, t2 = (max - a[key]) / d;
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
      if (enter > exit) return false;
    }
  }
  return true;
}
export function bridgeHitsBoxes(curve, boxes, radius = .09) {
  for (let i = 1; i < curve.points.length; i++) for (const box of boxes) {
    if (segmentHitsBox(curve.points[i - 1], curve.points[i], box, radius + curve.errors[i - 1])) return true;
  }
  return false;
}
