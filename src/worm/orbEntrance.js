// src/worm/orbEntrance.js
// The board wakes as the worm arrives. Every orb on the board when a run starts
// waits, hidden, through the scramble (or the Story briefing); once the portal
// is open they rise out of their own tiles in a wave that leaves the portal as
// the head pops out and has crossed the whole cube by GO.
//
// They used to be hidden for the whole arrival and come back all at once, full
// size, on the first frame of play: their reveal had already played when the run
// placed them, so nothing announced them and they read as appearing from nowhere.
//
// HealerWormMode drives the bridge from the arrival's own clock (pause holds it,
// a tap-to-skip jumps it); ParityOrbs reads it. Render-only: the sim never sees
// it, and an orb that spawns once play is under way keeps its ordinary reveal.

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = v => v * v * (3 - 2 * v);

/** Where the wave runs on the arrival's normalised clock (storyArrivalPose's t). */
export const ORB_WAVE_FROM = 0.32; // the head is popping out of the portal
export const ORB_WAVE_TO = 0.58;   // the front reaches the far side of the cube
/**
 * Seconds an orb takes to rise out of its tile; a short arrival (a retry's, reduced
 * motion's) scales it down. On the full arrival the last orb is up by GO; on any
 * arrival, before control starts.
 */
export const ORB_RISE_SECONDS = 0.55;
const RISE_SHARE = 0.25;
// From a face centre the farthest point of the surface (a corner of the far face)
// is √1.5 ≈ 1.22 board sizes away, so this spans the whole cube on any size.
const REACH_SPAN = 1.25;
// easeOutBack's overshoot: the orb pops a touch past its hover and settles.
const BACK = 1.4;

/**
 * Written by HealerWormMode, read by ParityOrbs. `elapsed`/`duration` are the
 * arrival's seconds; `run` counts holds, so each run's waiting orbs warm once.
 */
export const orbEntrance = { held: false, elapsed: 0, duration: 0, run: 0 };

/** A run is starting: orbs already on the board wait for the arrival. */
export function holdOrbEntrance() {
  orbEntrance.run++;
  orbEntrance.held = true;
  orbEntrance.elapsed = 0;
  orbEntrance.duration = 0;
}

/** The arrival's clock, once per frame of the arrival. */
export function setOrbEntranceClock(elapsed, duration) {
  orbEntrance.elapsed = elapsed;
  orbEntrance.duration = duration;
}

/** Play has started: the wave has passed every orb; any still rising finish on their own. */
export function releaseOrbEntrance() {
  orbEntrance.held = false;
  orbEntrance.elapsed = orbEntrance.duration;
}

/** The arrival's progress 0→1 (1 once released, or for a start with no arrival). */
export function orbEntranceT() {
  if (!orbEntrance.held) return 1;
  return orbEntrance.duration > 0 ? clamp01(orbEntrance.elapsed / orbEntrance.duration) : 0;
}

/** 0 at the portal → 1 at the far side of the cube, from the orb's distance to the head. */
export function orbWaveReach(distance, size) {
  return clamp01(distance / (REACH_SPAN * size));
}

/** The point on the arrival's clock at which the wave reaches an orb this far out. */
export function orbWaveStart(reach) {
  return ORB_WAVE_FROM + (ORB_WAVE_TO - ORB_WAVE_FROM) * clamp01(reach);
}

/** How long each orb takes to rise during an arrival of `duration` seconds (0: none). */
export function orbRiseSeconds(duration) {
  return duration > 0 ? Math.min(ORB_RISE_SECONDS, duration * RISE_SHARE) : ORB_RISE_SECONDS;
}

/**
 * An orb rising out of its tile at progress p (0→1): `sink` is how far it still
 * sits below its hover, along the tile normal (negative a moment past the top),
 * and `scale` its size. Reduced motion keeps it in place; its reveal fades it in.
 */
export function orbRisePoseInto(out, p, hover, reducedMotion = false) {
  if (reducedMotion || p >= 1) { out.sink = 0; out.scale = 1; return out; }
  const q = clamp01(p) - 1;
  const back = 1 + (BACK + 1) * q * q * q + BACK * q * q;
  out.sink = hover * (1 - back);
  out.scale = 0.35 + 0.65 * back;
  return out;
}

/** The ring a rising orb sends across its tile: it widens and fades as the orb clears it. */
export function orbRisePingInto(out, p, reducedMotion = false) {
  out.scale = 0.55 + 1.25 * smooth(clamp01(p));
  out.intensity = !reducedMotion && p > 0 && p < 1 ? 0.9 * (1 - p) * (1 - p) : 0;
  return out;
}
