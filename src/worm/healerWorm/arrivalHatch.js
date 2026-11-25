// src/worm/healerWorm/arrivalHatch.js
// "Oh! You hatched!" is Mobi's first line, so a new player's first arrival hatches
// for real: an eggshell sits over the opening portal, rocks as the head pushes up
// under it, and bursts into shards when the head breaks through. The shards tumble
// out, land on the tile and shrink away. Only Story level 1 before it has ever
// been cleared, never a retry's quick arrival; reduced motion has no arrival.
//
// Times are seconds since the breach (StoryArrival's `breachAt`); before it, the
// rock reads the arrival pose's `rise`.
import { storyStars } from '../story/levels.js';

export const HATCH_SHARDS = 14;
/** Seconds the shards fly before they land. */
export const SHARD_FLIGHT = 0.55;
/** Seconds they lie on the tile before shrinking away. */
export const SHARD_REST = 0.9;
export const SHARD_FADE = 0.35;
const GRAVITY = 5.2;

/** Does this arrival hatch? The first time level 1 is played, outside a retry. */
export const hatchesHere = (state, quick = false) =>
  !quick && state?.wormStoryLevel === 1 && !storyStars(state.playerProgress, 1);

/** The shell's rock, 0 → 1, as the head pushes up under it (pose.rise). */
export const shellRock = rise => (rise <= 0 ? 0 : Math.min(1, rise * 2.2));

/**
 * Shard `i`'s pose `since` seconds after the breach, in the portal's frame (z out
 * of the tile, radii in portal radii `r`), written into `out` as
 * { x, y, z, scale, spin }. Shards leave from round the rim, rise and spread, come
 * down onto the tile (z never below `floor`) and rest, then shrink away.
 */
export function shardPoseInto(out, i, since, r, floor = 0.015) {
  const seed = i * 2.39996;
  const angle = seed + (i % 3) * 0.35;
  const speedOut = (0.9 + (i % 4) * 0.22) * r * 2.6;
  const speedUp = 1.15 + (i % 5) * 0.16;
  const t = Math.min(Math.max(since, 0), SHARD_FLIGHT);
  const radius = r * 0.55 + speedOut * t;
  const z = Math.max(floor, r * 0.6 + speedUp * t - GRAVITY * t * t);
  const after = Math.max(0, since - SHARD_FLIGHT - SHARD_REST);
  const shrink = 1 - Math.min(1, after / SHARD_FADE);
  out.x = Math.cos(angle) * radius;
  out.y = Math.sin(angle) * radius;
  out.z = z;
  out.scale = since < 0 ? 0 : r * (0.38 + (i % 3) * 0.08) * shrink;
  out.spin = seed + t * (6 + (i % 4) * 2.5);
  return out;
}

/** Has every shard gone? */
export const hatchDone = since => since > SHARD_FLIGHT + SHARD_REST + SHARD_FADE;
