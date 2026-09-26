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
  }
  spring.formationElapsed = reduced ? spring.formationDuration
    : Math.min(spring.formationDuration, spring.formationElapsed + Math.max(0, Math.min(delta, .05)));
  const t = spring.formationDuration > 0 ? spring.formationElapsed / spring.formationDuration : 1;
  spring.lift = spring.formationFrom + (target - spring.formationFrom) * ease(t);
  spring.velocity = 0;
  spring.formationProgress = t;
  spring.formationRemaining = raised ? spring.formationDuration - spring.formationElapsed : 0;
}

export function livePlatformFormation(tile, size) {
  if (liveCubies.size !== size) return null;
  return liveCubies.refs?.[((tile.x * size) + tile.y) * size + tile.z]?.userData?.wormPlatformFormation ?? null;
}

export function platformFormationHeld(state) {
  return state.wormPaused || state.wormPauseMenuOpen || (typeof document !== 'undefined' && document.hidden);
}
