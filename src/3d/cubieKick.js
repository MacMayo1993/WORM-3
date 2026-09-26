// src/3d/cubieKick.js
//
// A physical jolt for a whole cubie when chaos lightning lands on one of its
// tiles: the piece is punched into the cube along the struck face's normal, then
// rebounds past its rest pose and settles — a hit you can see land.
//
// Chaos flips are deliberately "clean" (chaosFlipPose): the colour swap has to
// read, so the sticker itself does not shake. The impact lives on the piece
// instead, in Cubie's pop group, where it composes with the raised-cubie lift and
// Explode rather than fighting the sticker's own flip writers.
//
// Module state keyed by grid slot (`${x},${y},${z}`, Cubie's popKey), so firing
// one never triggers a React render. Render-only; never read by the simulation.

export const KICK_DURATION_MS = 420;

/** popKey → { startMs, x, y, z, amp } with (x, y, z) a unit direction in cube space. */
export const cubieKicks = new Map();

/** How hard a kick is still ringing `nowMs` in (its decaying envelope). */
export function cubieKickRinging(kick, nowMs) {
  if (!kick) return 0;
  const u = (nowMs - kick.startMs) / KICK_DURATION_MS;
  if (u >= 1) return 0;
  return kick.amp * Math.pow(1 - Math.max(0, u), 1.6);
}

/**
 * Kick the cubie at `key` along `dir` (the struck face's outward normal — the
 * punch goes the opposite way, into the cube). `startMs` may be in the future:
 * a ripple lands on a neighbour a beat after the blow that caused it.
 *
 * A weaker hit never interrupts a stronger one that is still ringing — a burst
 * of strikes on one piece reads as one heavy blow, and a neighbour's ripple can
 * never cut short the piece's own hit. A stronger hit takes over.
 */
export function fireCubieKick(key, dir, amp, startMs) {
  if (!key || !(amp > 0)) return;
  if (amp <= cubieKickRinging(cubieKicks.get(key), startMs)) return;
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  cubieKicks.set(key, { startMs, x: dir.x / len, y: dir.y / len, z: dir.z / len, amp });
}

/**
 * Signed displacement along the kick direction `elapsedMs` into a kick.
 * Negative first (the punch inward), a smaller outward rebound, then exactly 0 at
 * the end of the window so the piece always comes to rest where it started.
 */
export function cubieKickAmount(elapsedMs, amp) {
  const u = elapsedMs / KICK_DURATION_MS;
  if (!(u >= 0) || u >= 1) return 0;
  return -amp * Math.sin(u * Math.PI * 2.6) * Math.pow(1 - u, 1.6);
}

export function clearCubieKicks() {
  cubieKicks.clear();
}
