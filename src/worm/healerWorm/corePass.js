// src/worm/healerWorm/corePass.js
//
// Passing yourself in the Core. Every tunnel route crosses the core's centre,
// so when the head dives while an earlier ride's body is still inside its
// tunnel (a self-pass, `sim.selfPassPending`), the head can meet its own body
// in the Core. That meeting is a beat of its own:
//
//   • the sim watches, through the crossing, for the head's closest approach to
//     the body it is passing (the older ride's samples in `stepHistory`, still
//     within the tail's reach) and, once that comes within CORE_PASS_RADIUS,
//     marks the meeting (`met`, `point`, `head`, a new `seq`);
//   • the crossing slows to CORE_PASS_RATE for CORE_PASS_SLOW_SECONDS and eases
//     back, so the two halves of the worm visibly slide past each other;
//   • the pass charges the tunnel being ridden (when this ride doesn't heal it),
//     so its next ride pays part of its toll, and the HUD calls out "Core pass!".
//
// Renderers (CorePassFX, the chase camera) only read `seq`, `point` and `head`
// and keep their own clocks; nothing here allocates per frame.
import * as THREE from 'three';
import { tunnelTailReach } from './tunnelTrail.js';

/** The head and its body count as meeting inside this distance (world units). */
export const CORE_PASS_RADIUS = 0.32;
/** Close enough that the meeting fires without waiting for the closest approach. */
export const CORE_PASS_TOUCH = 0.04;
/** The crossing's slowest pace during the beat, as a share of its own. */
export const CORE_PASS_RATE = 0.3;
/** How long the slowed beat lasts, in real seconds. */
export const CORE_PASS_SLOW_SECONDS = 0.7;
/** The current ride's own samples nearest the head are not "the body it passes". */
const OWN_RIDE_MARGIN = 0.2;

export const makeCorePass = () => ({
  seq: 0,           // counts meetings this run; renderers play a beat when it moves
  met: false,       // this ride has met its body in the Core
  charged: false,   // the meeting charged the ride's tunnel
  rideStart: 0,     // stepHistory.distance when this ride dived
  best: Infinity,   // closest approach so far this ride
  slowT: 0,         // seconds left of the slowed crossing
  point: new THREE.Vector3(),     // the body point the head met
  head: new THREE.Vector3(),      // where the head was then
  bestPoint: new THREE.Vector3(),
  bestHead: new THREE.Vector3(),
});

/** A new ride (or a new run, with `rideStart` 0): forget the last meeting. */
export function resetCorePass(pass, rideStart) {
  pass.met = false;
  pass.charged = false;
  pass.rideStart = rideStart;
  pass.best = Infinity;
  pass.slowT = 0;
}

/**
 * The crossing's pace multiplier this tick, stepping the slowed beat. The dip
 * lands quickly (the first fifth of the beat) and eases out over the rest.
 */
export function corePassRate(pass, delta) {
  if (!(pass.slowT > 0)) return 1;
  const u = 1 - pass.slowT / CORE_PASS_SLOW_SECONDS;
  pass.slowT = Math.max(0, pass.slowT - Math.max(0, delta));
  const into = Math.min(1, u / 0.2);
  const out = u <= 0.2 ? 1 : 1 - THREE.MathUtils.smoothstep(u, 0.2, 1);
  return 1 - (1 - CORE_PASS_RATE) * into * out;
}

/**
 * Nearest point of the body the head is passing: recorded tunnel samples older
 * than this ride and still inside the tail's reach. Writes it to `out` and
 * returns its distance from `head` (Infinity when none).
 */
export function nearestPassedBodyInto(out, history, head, rideSpan, tailLength) {
  const reach = tunnelTailReach(tailLength);
  const { buf, capacity, count } = history;
  let slot = history.head === 0 ? capacity - 1 : history.head - 1;
  let prev = null, behind = 0, best = Infinity;
  const from = rideSpan + OWN_RIDE_MARGIN;
  for (let i = 0; i < count; i++) {
    const s = buf[slot];
    if (prev) behind += prev.pos.distanceTo(s.pos);
    if (behind > reach) break;
    if (behind >= from && s.transit) {
      const d = s.pos.distanceTo(head);
      if (d < best) { best = d; out.copy(s.pos); }
    }
    prev = s;
    slot = slot === 0 ? capacity - 1 : slot - 1;
  }
  return best;
}

/**
 * Called each crossing tick while a self-pass is pending. Returns true on the
 * tick the head meets its body: at the closest approach once it is inside
 * CORE_PASS_RADIUS (or at once on a touch).
 */
export function watchCorePass(pass, history, head, tailLength) {
  if (pass.met) return false;
  const rideSpan = Math.max(0, history.distance - pass.rideStart);
  const d = nearestPassedBodyInto(pass.point, history, head, rideSpan, tailLength);
  if (!Number.isFinite(d)) return false;
  if (d <= pass.best) {
    pass.best = d;
    pass.bestPoint.copy(pass.point);
    pass.bestHead.copy(head);
    if (d > CORE_PASS_TOUCH) return false;
  } else if (pass.best > CORE_PASS_RADIUS) {
    return false;
  }
  pass.met = true;
  pass.seq += 1;
  pass.slowT = CORE_PASS_SLOW_SECONDS;
  pass.point.copy(pass.bestPoint);
  pass.head.copy(pass.bestHead);
  return true;
}
