import { Quaternion, Vector3 } from 'three';
import { CUBE_WORM_HALF, CUBE_WORM_CLEARANCE } from './cubeWormPath.js';

// PLAY on the mode carousel: a portal opens in the middle of the presented
// face, the player's worm leaps into it in one arc, and only then does the face
// rush at the camera. Times are seconds of the dive's own clock.
export const DIVE_PORTAL_OPEN = 0.24;   // the portal is fully open
export const DIVE_LEAP_START = 0.12;    // the head leaves the cube
export const DIVE_LEAP_TIME = 0.5;      // the head's flight, whatever its length
export const DIVE_ZOOM_TIME = 0.55;     // the face's rush at the camera
// The zoom starts as the head goes in, while the tail is still following it.
export const DIVE_ZOOM_START = DIVE_LEAP_START + DIVE_LEAP_TIME;
export const DIVE_TOTAL = DIVE_ZOOM_START + DIVE_ZOOM_TIME;
// Reduced motion keeps the old dive: no leap, just the face.
export const DIVE_REDUCED_TOTAL = 0.6;

// Where the portal sits: just off the face's sticker domes.
export const DIVE_PORTAL_LIFT = 1.548;
// How deep the route runs below the portal before the worm is gone.
const DESCENT = 0.9;
const SAMPLES = 96;

export const FACE_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0], PY: [0, 1, 0], NY: [0, -1, 0], PZ: [0, 0, 1], NZ: [0, 0, -1],
};

const _a = new Vector3(), _c = new Vector3();
const clampBox = v => Math.max(-CUBE_WORM_HALF, Math.min(CUBE_WORM_HALF, v));

// How far out along unit `dir` a point is `clearance` clear of the rounded box.
function surfaceRadius(dir, clearance) {
  let low = 0, high = 4;
  for (let k = 0; k < 24; k++) {
    const mid = (low + high) / 2;
    const x = dir.x * mid, y = dir.y * mid, z = dir.z * mid;
    if (Math.hypot(x - clampBox(x), y - clampBox(y), z - clampBox(z)) > clearance) high = mid;
    else low = mid;
  }
  return high;
}

/** One leap's reusable storage; plan it with `planDiveLeap`. */
export function createDiveLeap() {
  return {
    planned: false,
    points: Array.from({ length: SAMPLES + 1 }, () => new Vector3()),
    normals: Array.from({ length: SAMPLES + 1 }, () => new Vector3()),
    lengths: new Float64Array(SAMPLES + 1),
    length: 0,
    // The portal, in the planning worm's own coordinates.
    center: new Vector3(),
    normal: new Vector3(),
    // Where the flight ends and the fall into the portal begins.
    mouth: 0,
  };
}

/**
 * Plan a leap from the head's pose (cube-local) into the portal on `face`
 * (FACE_NORMALS key). `flip` plans for the antipodal twin, whose portal is
 * on the opposite face in its own (negated) coordinates.
 */
export function planDiveLeap(leap, head, face, flip = false) {
  const n = FACE_NORMALS[face] ?? FACE_NORMALS.PZ;
  leap.normal.set(n[0], n[1], n[2]);
  if (flip) leap.normal.negate();
  leap.center.copy(leap.normal).multiplyScalar(DIVE_PORTAL_LIFT);
  // The flight is swept round the cube's centre: its direction turns from the
  // head's to the portal's, eased so the worm springs straight up off its face
  // and drops straight down into the portal, and its distance never comes
  // nearer than the cube's surface plus the worm's clearance, plus a hump.
  const from = _a.copy(head.position).normalize();
  const to = leap.normal;
  const turn = Math.acos(Math.max(-1, Math.min(1, from.dot(to))));
  const startRadius = head.position.length();
  const above = 0.55;
  const endRadius = DIVE_PORTAL_LIFT + above;
  // Tall enough to read even when the leap points straight at the camera.
  const hump = 0.8 + 0.45 * turn;
  // A perpendicular to swing through when the head is straight under or over the portal.
  const axis = _c.crossVectors(from, to);
  if (axis.lengthSq() < 1e-8) {
    axis.set(0, 1, 0).cross(from);
    if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0).cross(from);
  }
  axis.normalize();
  const direction = (u, out) => {
    const e = u * u * (3 - 2 * u);
    return out.copy(from).applyAxisAngle(axis, turn * e);
  };
  const ARC = Math.round(SAMPLES * 0.75);
  const top = leap.center.clone().addScaledVector(leap.normal, above);
  const drop = above + DESCENT;
  const pointAt = (i, out) => {
    if (i > ARC) return out.copy(top).addScaledVector(leap.normal, -drop * (i - ARC) / (SAMPLES - ARC));
    const u = i / ARC;
    direction(u, out);
    const floor = surfaceRadius(out, CUBE_WORM_CLEARANCE);
    const base = startRadius + (endRadius - startRadius) * u;
    const r = Math.max(floor, base) + hump * Math.sin(Math.PI * u) * (1 - 0.35 * u);
    return out.multiplyScalar(r);
  };
  let length = 0, mouth = 0, prevHeight = 0;
  // Carry the worm's "up" along the flight by turning it with the direction of
  // travel (a rotation-minimising frame), starting from the way it was
  // crawling: as it rears up off the face its back turns to face behind it,
  // and it never flips over at the top or spins as it drops into the portal.
  const frame = new Vector3().copy(head.normal);
  const heading = new Vector3().copy(head.forward), tangent = new Vector3(), prev = new Vector3(), turnQ = new Quaternion();
  for (let i = 0; i <= SAMPLES; i++) {
    const p = leap.points[i];
    pointAt(i, p);
    const height = p.dot(leap.normal) - DIVE_PORTAL_LIFT;
    if (i) {
      const step = p.distanceTo(prev);
      if (!mouth && prevHeight > 0 && height <= 0) mouth = length + step * prevHeight / (prevHeight - height);
      length += step;
      tangent.subVectors(p, prev).normalize();
      frame.applyQuaternion(turnQ.setFromUnitVectors(heading, tangent));
      frame.addScaledVector(tangent, -frame.dot(tangent)).normalize();
      heading.copy(tangent);
    }
    leap.normals[i].copy(frame);
    leap.lengths[i] = length;
    prev.copy(p);
    prevHeight = height;
  }
  leap.length = length;
  leap.mouth = mouth || length;
  leap.planned = true;
  return leap;
}

/**
 * Sample the flight `s` units along it. Returns how far below the portal the
 * point is (negative above it), so callers can hide what has gone in.
 */
export function sampleDiveLeap(leap, s, position, normal, forward) {
  const d = Math.max(0, Math.min(leap.length, s));
  let lo = 0, hi = SAMPLES;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (leap.lengths[mid] <= d) lo = mid; else hi = mid; }
  const span = leap.lengths[hi] - leap.lengths[lo];
  const t = span > 0 ? (d - leap.lengths[lo]) / span : 0;
  position.lerpVectors(leap.points[lo], leap.points[hi], t);
  forward.subVectors(leap.points[hi], leap.points[lo]).normalize();
  normal.lerpVectors(leap.normals[lo], leap.normals[hi], t);
  normal.addScaledVector(forward, -normal.dot(forward));
  if (normal.lengthSq() < 1e-8) normal.copy(leap.normals[lo]);
  normal.normalize();
  return DIVE_PORTAL_LIFT - position.dot(leap.normal);
}

/** The head's distance along the flight `t` seconds into the dive. */
export function diveLeapTravel(leap, t) {
  if (!leap.planned) return 0;
  const flight = Math.max(0, t - DIVE_LEAP_START) / DIVE_LEAP_TIME;
  // Spring off already moving, ease over the top, then drop into the portal:
  // the head reaches the mouth exactly as the zoom begins, and the rest of the
  // body pours in after it faster still.
  const eased = flight < 1 ? 0.35 * flight + 0.65 * flight * flight * (3 - 2 * flight) : 1 + (flight - 1) * 1.6;
  return eased * leap.mouth;
}

/** How open the portal is `t` into the dive: a pop with a little overshoot. */
export function portalOpenAt(t) {
  const p = Math.max(0, Math.min(1, t / DIVE_PORTAL_OPEN));
  return p >= 1 ? 1 : 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
}
