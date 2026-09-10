import { ramp, windowOpacity } from './introChoreography.js';

// Envelopes are slow, local accents: no full-screen flash or camera shake.
export function introEnergy(time, reducedMotion = false) {
  if (reducedMotion) return { charge: 0, burst: 0, release: 0, dust: 0, push: 0 };
  return {
    charge: windowOpacity(time, 0.55, 2.2),
    burst: windowOpacity(time, 2.25, 3.75),
    release: ramp(time, 2.25, 3.75),
    dust: windowOpacity(time, 0.4, 7.35),
    push: windowOpacity(time, 4.0, 6.25)
  };
}

// Seeded spherical distribution, shared across quality tiers and remounts.
export function introMote(index) {
  const z = 1 - 2 * ((index * 0.61803398875) % 1);
  const angle = index * 2.39996323;
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  return [Math.cos(angle) * radial, z, Math.sin(angle) * radial];
}
