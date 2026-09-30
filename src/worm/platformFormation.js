import { liveCubies } from './liveCubies.js';

export const PLATFORM_FORMATION_SECONDS = 2;
const ease = t => Math.max(0, Math.min(1, t * t * t * (t * (t * 6 - 15) + 10)));

// This state follows the physical cubie's existing spring through slice turns.
// A timed, monotone ease makes the outward motion readable without overshoot.
export function advancePlatformFormation(spring, raised, delta, reduced = false) {
  const target = raised ? 1 : 0;
  if (spring.formationTarget !== target) {
    spring.formationTarget = target;
    spring.formationFrom = spring.lift;
    spring.formationElapsed = 0;
    spring.formationDuration = (raised ? PLATFORM_FORMATION_SECONDS : .65) * Math.abs(target - spring.lift);
    spring.rushed = false;
  }
  spring.formationElapsed = reduced ? spring.formationDuration
    : Math.min(spring.formationDuration, spring.formationElapsed + Math.max(0, Math.min(delta, .05)));
  const t = spring.formationDuration > 0 ? spring.formationElapsed / spring.formationDuration : 1;
  spring.lift = spring.formationFrom + (target - spring.formationFrom) * ease(t);
  spring.velocity = 0;
  spring.formationProgress = t;
  spring.formationRemaining = raised ? spring.formationDuration - spring.formationElapsed : 0;
}

// A jump aimed at a platform that is still rising: finish the rise within
// `seconds` by running the same ease from where it is now at a faster rate, so
// the piece surges up to meet the worm but never jumps. The Möbius band follows
// a hurried rise (`rushed`) instead of its own two-second clock.
export function rushPlatformFormation(spring, seconds) {
  if (!spring || spring.formationTarget !== 1 || !(spring.formationDuration > 0)) return false;
  const t = spring.formationElapsed / spring.formationDuration;
  if (t >= 1 || spring.formationDuration - spring.formationElapsed <= seconds) return false;
  spring.formationDuration = seconds / (1 - t);
  spring.formationElapsed = t * spring.formationDuration;
  spring.formationRemaining = seconds;
  spring.rushed = true;
  return true;
}

export function livePlatformFormation(tile, size) {
  if (liveCubies.size !== size) return null;
  return liveCubies.refs?.[((tile.x * size) + tile.y) * size + tile.z]?.userData?.wormPlatformFormation ?? null;
}

export function platformFormationHeld(state) {
  return state.wormPaused || state.wormPauseMenuOpen || (typeof document !== 'undefined' && document.hidden);
}
