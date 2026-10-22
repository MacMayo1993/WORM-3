// src/worm/healBeat.js
//
// The camera's half of a tunnel heal (the sim's half is the hitstop and the ladder
// in wormSim.js): the lens punches in a few degrees as both mouths seal and lets go.
// The sim counts heals in `healBeatSeq`; the camera keeps its own copy and starts a
// kick whenever the count moves up while the worm is crawling. Render-only, pure,
// allocation-free: one small object per camera, stepped in place each frame.

export const HEAL_KICK_SECONDS = 0.7;
const ATTACK = 0.06;
// Degrees of FOV the punch narrows by, per tier (a heal, a double heal). The chase
// smooths FOV (about a 0.17 s lag), so the peak on screen lands near two thirds of this.
export const HEAL_KICK_FOV = [0, 5, 8];

export const makeHealBeat = () => ({ seq: 0, t: Infinity, tier: 1 });

/** Degrees to narrow the lens by, t seconds into a kick of the given tier. */
export function healKickFov(t, tier) {
  if (!(t >= 0) || t >= HEAL_KICK_SECONDS) return 0;
  const amp = HEAL_KICK_FOV[tier] ?? HEAL_KICK_FOV[1];
  if (t < ATTACK) return amp * (t / ATTACK);
  const x = (t - ATTACK) / (HEAL_KICK_SECONDS - ATTACK);
  return amp * (1 - x * x * (3 - 2 * x));
}

/**
 * Advance the beat by one frame and return the FOV narrowing for it.
 * `live` is false while paused (the kick holds) and `calm` under reduced motion
 * (no kick). A count that drops (a new run) is adopted without a kick.
 */
export function stepHealBeat(beat, seq, tier, delta, { crawling = true, live = true, calm = false } = {}) {
  if (seq !== beat.seq) {
    if (seq > beat.seq && crawling && !calm) { beat.t = 0; beat.tier = tier === 2 ? 2 : 1; }
    beat.seq = seq;
  }
  if (calm) { beat.t = Infinity; return 0; }
  const fov = healKickFov(beat.t, beat.tier);
  if (live && beat.t < HEAL_KICK_SECONDS) beat.t += Math.max(0, delta);
  return fov;
}
