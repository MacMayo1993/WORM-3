// How a menu worm answers the player: it turns its head and eyes to look at
// the pointer (or a neighbour it is passing), and a tap makes it flinch, hop
// and grin. Pure numbers on the caller's real-time clock; the rig applies them.

export const POKE_SECONDS = 1.15;
export const WAG_SECONDS = 1.1;
// How far the head turns before the eyes do the rest of the looking.
export const HEAD_YAW_MAX = 0.5;
export const HEAD_PITCH_MAX = 0.32;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createWormReaction() {
  return {
    pokeAt: -Infinity, wagAt: -Infinity, lastNow: null,
    // Smoothed head turn and how much the worm is looking at something at all.
    yaw: 0, pitch: 0, weight: 0,
    // What is left for the eyes after the head has turned.
    gazeX: 0, gazeY: 0,
  };
}

export function pokeWorm(reaction, now) {
  // A second poke mid-reaction restarts the hop rather than stacking it.
  reaction.pokeAt = now;
}

export function wagWorm(reaction, now) {
  if (now - reaction.wagAt > WAG_SECONDS) reaction.wagAt = now;
}

/**
 * Turn toward `dir` (unit vector in the head's own frame: +X its side, +Y up
 * off the surface, -Z ahead), or back to straight ahead when null. Eased on
 * real time, so a pointer flick never snaps the head round.
 */
export function aimWormHead(reaction, dir, now, reducedMotion = false) {
  const dt = reaction.lastNow === null ? 0 : clamp(now - reaction.lastNow, 0, 0.1);
  reaction.lastNow = now;
  let rawYaw = 0, rawPitch = 0, want = 0;
  if (dir) {
    rawYaw = Math.atan2(-dir.x, -dir.z);
    rawPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    // Something behind the worm is out of sight: it only half turns for it.
    want = Math.abs(rawYaw) > 2.2 ? 0.4 : 1;
  }
  const k = 1 - Math.exp(-dt * 9);
  reaction.weight += (want - reaction.weight) * k;
  const yawTarget = reducedMotion ? 0 : clamp(rawYaw, -HEAD_YAW_MAX, HEAD_YAW_MAX) * want;
  const pitchTarget = reducedMotion ? 0 : clamp(rawPitch, -HEAD_PITCH_MAX * 0.5, HEAD_PITCH_MAX) * want;
  reaction.yaw += (yawTarget - reaction.yaw) * k;
  reaction.pitch += (pitchTarget - reaction.pitch) * k;
  // The eyes take the rest, faster than the head.
  const eyeK = 1 - Math.exp(-dt * 18);
  const gx = clamp((rawYaw - reaction.yaw) * 1.7, -1, 1) * want;
  const gy = clamp((rawPitch - reaction.pitch) * 1.7, -1, 1) * want;
  reaction.gazeX += (gx - reaction.gazeX) * eyeK;
  reaction.gazeY += (gy - reaction.gazeY) * eyeK;
  return reaction;
}

/** The face's poke beat: a gasp, then a grin. */
export function wormReactionFaceInto(out, reaction, now, reducedMotion = false) {
  const t = now - reaction.pokeAt;
  out.surprise = 0;
  out.delight = 0;
  out.look = reaction.weight > 0.04 ? { x: reaction.gazeX * reaction.weight, y: reaction.gazeY * reaction.weight } : null;
  if (!(t >= 0 && t < POKE_SECONDS)) return out;
  out.surprise = t < 0.28 ? 1 : 1 - smooth(0.28, 0.5, t);
  out.delight = smooth(0.3, 0.5, t) * (1 - smooth(0.85, POKE_SECONDS, t));
  // A startled worm looks straight out, not at the pointer.
  if (out.surprise > 0.5) out.look = null;
  if (reducedMotion) out.surprise *= 0.6;
  return out;
}

/**
 * Add the poke's flinch and hop, and any tail wag, to segment `i` of `count`'s
 * motion (`lift`, `sway`, `width`, `stretch`, all relative to `radius`).
 * Reduced motion keeps the face's answer and drops the body's.
 */
export function wormReactionSegmentInto(motion, reaction, i, count, now, radius, reducedMotion = false) {
  if (reducedMotion) return motion;
  const t = now - reaction.pokeAt;
  if (t >= 0 && t < POKE_SECONDS) {
    // Flinch: the whole worm squashes for a beat...
    const flinch = 1 - smooth(0, 0.1, Math.abs(t - 0.05));
    motion.width *= 1 + 0.16 * flinch;
    motion.stretch *= 1 - 0.18 * flinch;
    // ...then springs up, head first, the hop running down the body.
    const hopT = t - 0.09 - i * 0.032;
    if (hopT > 0 && hopT < 0.42) {
      const arc = Math.sin(Math.PI * hopT / 0.42);
      motion.lift += radius * 1.05 * arc * Math.pow(0.9, i);
      motion.stretch *= 1 + 0.12 * arc;
    }
    // Landed, it wiggles with glee.
    const glee = smooth(0.5, 0.62, t) * (1 - smooth(0.8, POKE_SECONDS, t));
    motion.sway += radius * 0.45 * glee * Math.sin(now * 22 - i * 0.9) * Math.min(1, i / 2);
  }
  const w = now - reaction.wagAt;
  if (w >= 0 && w < WAG_SECONDS && i > count * 0.55) {
    const envelope = Math.sin(Math.PI * w / WAG_SECONDS);
    const tail = (i - count * 0.55) / (count * 0.45);
    motion.sway += radius * 0.7 * envelope * tail * Math.sin(w * 16 - i * 0.7);
  }
  return motion;
}
