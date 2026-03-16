// src/worm/shared/movementClock.js
// Unified fixed-step simulation clock used by both surface and tunnel game loops.
//
// Why a shared clock?
//   Surface mode steps one tile per interval (rate = speed tiles/sec).
//   Tunnel mode previously advanced by raw delta each frame (frame-rate dependent).
//   Both now run through advanceStepClock so movement is frame-rate independent
//   and the step rate for each mode is declared in one place.
//
// Usage:
//   Surface:  steps = advanceStepClock(accRef, delta, speed)
//             → 1 step = move one tile; step interval = 1/speed seconds
//
//   Tunnel:   steps = advanceStepClock(accRef, delta, SIMULATION_HZ)
//             → each step = FIXED_DT seconds of tunnel advance
//             → moveAmount = speed * steps * FIXED_DT

/** Fixed simulation rate for tunnel mode (steps per second). */
export const SIMULATION_HZ = 60;

/** Duration of one tunnel simulation step (seconds). */
export const FIXED_DT = 1 / SIMULATION_HZ;

/**
 * Advances a step accumulator and returns the number of simulation steps
 * to process this frame.
 *
 * @param {React.MutableRefObject<number>} accRef  - mutable ref holding accumulated time
 * @param {number}                          delta   - frame delta time (seconds)
 * @param {number}                          stepHz  - target steps per second
 * @returns {number} integer count of steps to execute (0 if not enough time elapsed)
 *
 * Correctly preserves remainder so timing drift does not accumulate over time.
 * (The old surface code did `acc = 0` on each step, discarding the overflow.)
 */
export function advanceStepClock(accRef, delta, stepHz) {
  accRef.current += delta;
  const dt = 1 / stepHz;
  const steps = Math.floor(accRef.current / dt);
  if (steps > 0) accRef.current -= steps * dt;
  return steps;
}
