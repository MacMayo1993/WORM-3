import { COUNTDOWN_STEP_DURATION } from './constants.js';
import { shAt } from '../circularBuffers.js';

// One shared clock for portal, camera, ready beats and control handoff.
export const STORY_ARRIVAL_SECONDS = COUNTDOWN_STEP_DURATION * 4;
export const STORY_ARRIVAL_REDUCED_SECONDS = 0.35;
// A retry's arrival (runStart.js): the same beats on a short clock, with only GO.
export const STORY_ARRIVAL_QUICK_SECONDS = 1.2;

/** This arrival's length: reduced motion's beat, a retry's quick one, or the full show. */
export const arrivalSeconds = (reduced = false, quick = false) =>
  reduced ? STORY_ARRIVAL_REDUCED_SECONDS : quick ? STORY_ARRIVAL_QUICK_SECONDS : STORY_ARRIVAL_SECONDS;

// The worm surfaces through a portal opened under its start tile: the head
// rises out first, already facing the way it will crawl, and the body uncoils
// out of the hole behind it onto the path it rests on. Lengths are along that
// path, in world units.
/** Path length over which a bead rises out of the mouth to full size. */
export const ARRIVAL_RAMP = 0.24;
/** How far below the lip a bead or the head still inside the portal sits. */
export const ARRIVAL_SINK = 0.22;
/** Peak height of the arch each bead makes as it clears the lip. */
export const ARRIVAL_HOP = 0.12;
/** Path length of that arch, from the lip to touchdown. */
export const ARRIVAL_HOP_SPAN = 0.4;
/** Peak height of the head's pop out of the portal. */
export const ARRIVAL_HEAD_HOP = 0.26;
/** Radius of the portal on the tile (a tile is one unit across). */
export const ARRIVAL_PORTAL_RADIUS = 0.36;

const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const pulse = (t, start, rise, fall) => smooth((t - start) / rise) * (1 - smooth((t - start - rise) / fall));

// Out of the mouth with a push, then a long, gentle settle onto the trail.
const crawl = x => {
  x = clamp(x);
  return smooth(x) * 0.45 + (1 - Math.pow(1 - x, 3)) * 0.55;
};

/**
 * The arrival's beats on one clock. `open` irises the portal, `rise` lifts the
 * head out of it, `emerge` is how much of the body has uncoiled (0: all still
 * in the hole, 1: resting on its authored body), `close` collapses the portal,
 * `shock` is the ring it throws off as it shuts, and `settle` hands the camera
 * to the chase. `quick` is a retry's arrival (runStart.js): the same beats on
 * the short clock, with only GO.
 */
export function storyArrivalPose(elapsed, reduced = false, quick = false) {
  const t = clamp((elapsed > 0 ? elapsed + 1e-10 : 0) / arrivalSeconds(reduced, quick));
  if (reduced) {
    return { t, open: 0, ring: 0, rise: 1, emerge: 1, close: 1, shock: 0, settle: 1, step: null };
  }
  const open = smooth(t / 0.2);
  const close = smooth((t - 0.8) / 0.12);
  return {
    t, open,
    ring: open * (1 - close),
    rise: smooth((t - 0.24) / 0.17),
    emerge: crawl((t - 0.34) / 0.46),
    close,
    shock: pulse(t, 0.8, 0.05, 0.15),
    settle: smooth((t - 0.74) / 0.26),
    // A retry's player is already set: no 3-2-1, just GO as the body lands.
    step: quick ? (t < 0.75 ? null : 'go') : t < 0.25 ? 3 : t < 0.5 ? 2 : t < 0.75 ? 1 : 'go',
  };
}

/** Length of body (from the head back) still coiled inside the portal. */
export function arrivalTuck(emerge, mouth) {
  return (1 - clamp(emerge)) * mouth;
}

/**
 * The head popping out of the portal on its own tile: `lift` off its rest
 * height, `grow`, and a `pitch` (nose up out of the hole, down onto the tile)
 * that is exactly zero once it has landed.
 */
export function arrivalHeadInto(out, rise) {
  rise = clamp(rise);
  out.lift = -ARRIVAL_SINK * (1 - rise) + ARRIVAL_HEAD_HOP * Math.sin(Math.PI * rise);
  out.grow = smooth(rise / 0.45);
  const slope = ARRIVAL_SINK + ARRIVAL_HEAD_HOP * Math.PI * Math.cos(Math.PI * rise);
  out.pitch = Math.atan(0.35 * slope) * (1 - smooth((rise - 0.75) / 0.25));
  return out;
}

/**
 * How a bead that rests `s` back along the path shows while `tuck` of the body
 * is still in the hole: it sits `s - tuck` along the path (see WormBody),
 * `grow` scales it and `lift` raises it off its rest height (negative while it
 * is still down in the portal, an arch as it clears the lip). Both fade to the
 * resting body as the tuck runs out.
 */
export function arrivalBeadInto(out, s, tuck) {
  const u = s - tuck;
  if (u <= 0) {
    out.grow = 0;
  } else {
    const base = smooth(u / ARRIVAL_RAMP);
    out.grow = base + (1 - base) * (1 - clamp(tuck / 0.15));
  }
  const arch = u > 0 && u < ARRIVAL_HOP_SPAN ? Math.sin(Math.PI * u / ARRIVAL_HOP_SPAN) : 0;
  out.lift = ARRIVAL_HOP * arch * clamp(tuck / 0.3) - ARRIVAL_SINK * (1 - out.grow);
  return out;
}

/**
 * The point `dist` back along the worm's path (live head, then its step
 * history), dropped onto the tile surface, with that point's face normal.
 * Past the end of the history it carries on along the last stretch.
 */
export function arrivalPathPointInto(worm, dist, outPos, outNormal) {
  const head = worm.headInterpPos.current;
  const headNormal = worm.currentNormal.current;
  const level = head.dot(headNormal);
  const history = worm.stepHistory.current;
  let ax = head.x, ay = head.y, az = head.z;
  let an = headNormal;
  let walked = 0;
  const count = history?.count ?? 0;
  for (let i = 0; i < count; i++) {
    const record = shAt(history, i);
    const b = record.pos;
    // History carries its own lift; measure on the surface like the live head.
    const lift = b.dot(record.normal) - level;
    const bx = b.x - record.normal.x * lift, by = b.y - record.normal.y * lift, bz = b.z - record.normal.z * lift;
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    if (length > 1e-9 && walked + length >= dist) {
      const k = (dist - walked) / length;
      outPos.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
      outNormal.copy(k < 0.5 ? an : record.normal);
      return outPos;
    }
    if (length > 1e-9) {
      // Keep the last stretch's direction for running off the end.
      outNormal.set(bx - ax, by - ay, bz - az).multiplyScalar(1 / length);
    }
    walked += length;
    ax = bx; ay = by; az = bz;
    an = record.normal;
  }
  const extra = Math.max(0, dist - walked);
  if (walked > 0) outPos.set(ax, ay, az).addScaledVector(outNormal, extra);
  else outPos.set(ax, ay, az);
  outNormal.copy(an);
  return outPos;
}
