// src/worm/healerWorm/fusionNova.js
//
// The fuse's two shockwaves (FusionAura.jsx), as pure timing so tests can hold it.

export const NOVA = Object.freeze({ duration: 0.9, stagger: 0.18, reach: 2.6 });

/** A shockwave's radius and opacity `age` seconds after the fuse (null before it starts or once it is gone). */
export function novaAt(age) {
  if (age < 0 || age >= NOVA.duration) return null;
  const t = age / NOVA.duration;
  const out = 1 - (1 - t) * (1 - t) * (1 - t);
  return { radius: 0.3 + out * NOVA.reach, opacity: 0.85 * (1 - t) * (1 - t) };
}
