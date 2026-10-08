// Shared by the played Dancer and its picker.
export const WIGGLE_BODY_SCALE = [0.088, 0.082, 0.128];

// A sidewinder's S: a lateral wave that travels down the body. Sized in bead terms,
// not tile terms, so it reads from the gameplay camera: the swing is about 1.5 bead
// radii each way, the wavelength about eleven beads. The slope (AMPLITUDE * WAVE_NUMBER,
// about 0.75) caps how far a bend can stretch the gap between two beads, which the
// body tests hold under their connected-chain bound.
//
// Commit 499d9a7 cut this to 0.032 to stop the neck folding over itself at a turn;
// that left the Dancer swinging less than the Classic worm (0.08). The wave now stays
// big and the beads tilt along it (wiggleBodySlope), with the turn left to the body's
// frame smoothing and the hinge test in wormBodyTunnelStream.test.jsx.
export const WIGGLE_AMPLITUDE = 0.13;
export const WIGGLE_WAVE_NUMBER = 5.8;   // radians per world unit: about 1.08 units per wave
export const WIGGLE_RATE = 8;            // radians per second: about 1.3 waves a second
// The head stays on its tile's path and the wave builds over the first few beads.
const NECK = 0.3;

const smooth = u => u * u * (3 - 2 * u);

/** Sideways offset of the body at `distance` behind the head, `time` seconds into the clock. */
export function wiggleBodyOffset(distance, time) {
  const neck = Math.min(1, Math.max(0, distance / NECK));
  return WIGGLE_AMPLITUDE * smooth(neck) * Math.sin(distance * WIGGLE_WAVE_NUMBER - time * WIGGLE_RATE);
}

/**
 * d(offset)/d(distance): how far the body is leaning sideways per unit of length.
 * Beads tilt by this against the path so each one points along the wave rather than
 * sliding sideways down the straight line, which is what makes a big wave read as a
 * snake and not as a row of beads wobbling in place.
 */
export function wiggleBodySlope(distance, time) {
  const neck = Math.min(1, Math.max(0, distance / NECK));
  const phase = distance * WIGGLE_WAVE_NUMBER - time * WIGGLE_RATE;
  const rise = neck > 0 && neck < 1 ? 6 * neck * (1 - neck) / NECK : 0;
  return WIGGLE_AMPLITUDE * (rise * Math.sin(phase) + smooth(neck) * WIGGLE_WAVE_NUMBER * Math.cos(phase));
}

// The wave carried round a path hinge stretches the outside of the bend, where the
// smoothed side vector swings while the path turns. No two neighbours may sit further
// apart than this (a straight run's wave peaks near 0.113, so only bends are touched):
// the bead is drawn back toward the one ahead of it, which keeps the chain connected at
// every turn without having to flatten the wave. `position` and `ahead` are Vector3s.
export const WIGGLE_MAX_GAP = 0.13;
export function limitWiggleGap(position, ahead) {
  const gap = position.distanceTo(ahead);
  if (gap > WIGGLE_MAX_GAP) position.lerpVectors(ahead, position, WIGGLE_MAX_GAP / gap);
  return position;
}

