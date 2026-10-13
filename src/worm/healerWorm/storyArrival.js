import { COUNTDOWN_STEP_DURATION } from './constants.js';
import { shAt } from '../circularBuffers.js';

// One shared clock for portal, camera, ready beats and control handoff.
export const STORY_ARRIVAL_SECONDS = COUNTDOWN_STEP_DURATION * 4;
export const STORY_ARRIVAL_REDUCED_SECONDS = 0.35;

// The worm crawls out of a portal opened under its tail, head first, at its
// real size, along the very path its resting body lies on. These are lengths
// along that path, in world units.
/** Path length over which a bead rises out of the mouth to full size. */
export const ARRIVAL_RAMP = 0.24;
/** How far below the lip a bead still inside the portal sits. */
export const ARRIVAL_SINK = 0.22;
/** Peak height of the leap each bead makes as it clears the lip. */
export const ARRIVAL_HOP = 0.17;
/** Path length of that leap, from the lip to touchdown. */
export const ARRIVAL_HOP_SPAN = 0.46;
/** Radius of the portal on the tile (a tile is one unit across). */
export const ARRIVAL_PORTAL_RADIUS = 0.36;

const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const pulse = (t, start, rise, fall) => smooth((t - start) / rise) * (1 - smooth((t - start - rise) / fall));

// Out of the mouth with a push, then a long, gentle settle onto the start tile.
const crawl = x => {
  x = clamp(x);
  return smooth(x) * 0.45 + (1 - Math.pow(1 - x, 3)) * 0.55;
};

/**
 * The arrival's beats on one clock. `open` irises the portal, `emerge` is the
 * fraction of the crawl done (0: the whole worm still inside, 1: resting on its
 * authored body), `close` collapses the portal behind the tail, `shock` is the
 * ring it throws off as it shuts, and `settle` hands the camera to the chase.
 */
export function storyArrivalPose(elapsed, reduced = false) {
  const t = clamp((elapsed > 0 ? elapsed + 1e-10 : 0) / (reduced ? STORY_ARRIVAL_REDUCED_SECONDS : STORY_ARRIVAL_SECONDS));
  if (reduced) {
    return { t, open: 0, ring: 0, emerge: 1, close: 1, shock: 0, settle: 1, step: null };
  }
  const open = smooth(t / 0.2);
  const close = smooth((t - 0.8) / 0.12);
  return {
    t, open,
    ring: open * (1 - close),
    emerge: crawl((t - 0.26) / 0.54),
    close,
    shock: pulse(t, 0.8, 0.05, 0.15),
    settle: smooth((t - 0.74) / 0.26),
    step: t < 0.25 ? 3 : t < 0.5 ? 2 : t < 0.75 ? 1 : 'go',
  };
}

/** Path distance from the resting head back to the head while arriving. */
export function arrivalOffset(emerge, mouth) {
  return (1 - clamp(emerge)) * (mouth + ARRIVAL_RAMP);
}

/**
 * How a point `s` along the arriving body (path distance from the resting head,
 * offset included) shows: `grow` scales it, `lift` raises it off its rest height
 * (negative while it is still down in the portal). The leap fades as the crawl
 * ends, so the last frame is exactly the resting body.
 */
export function arrivalBeadInto(out, s, mouth, offset) {
  const u = mouth - s;
  out.grow = smooth((u + ARRIVAL_RAMP) / ARRIVAL_RAMP);
  const leap = u > 0 && u < ARRIVAL_HOP_SPAN ? Math.sin(Math.PI * u / ARRIVAL_HOP_SPAN) : 0;
  out.lift = ARRIVAL_HOP * leap * clamp(offset / 0.3) - ARRIVAL_SINK * (1 - out.grow);
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
