import { clampWear } from '../game/flipPad.js';

export const PAD_PROFILES = {
  cube: { height: 0.30, amplitude: 0.04, wearAmplitude: 0.12, frequency: 0.9 },
  chaos: { height: 0.14, amplitude: 0.02, wearAmplitude: 0.10, frequency: 1 },
  worm: { height: 0.50, amplitude: 0.05, wearAmplitude: 0.10, frequency: 0.8 },
  menu: { height: 0.35, amplitude: 0.06, wearAmplitude: 0.10, frequency: 0.7 }
};

export function pairPhase(key = '') {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296;
}

// Output object may be reused in the render loop. Phase is integrated by the
// owner: changing wear must not jump the phase by time * (new f - old f).
export function padPose({ phase = 0, wear = 0, profile = 'cube', worn = false, reducedMotion = false, subtle = false, big = false }, out = {}) {
  const p = PAD_PROFILES[profile] ?? PAD_PROFILES.cube;
  const w = clampWear(wear);
  const cycle = phase - Math.floor(phase);
  const arc = 4 * cycle * (1 - cycle);
  const scale = (subtle ? 0.5 : 1) * (big ? 0.5 : 1);
  const irregular = worn ? 0.012 * Math.sin(phase * Math.PI * 2) * Math.sin(phase * Math.PI * 2 * 1.61803398875) : 0;
  out.lift = p.height + (reducedMotion ? 0 : scale * ((p.amplitude + p.wearAmplitude * w) * arc + irregular));
  out.impact = reducedMotion ? 0 : Math.exp(-((cycle / 0.08) ** 2));
  out.cycle = cycle;
  out.frequency = p.frequency * (1 + w);
  return out;
}

// Stable substeps keep the press-style spring safe after a long browser frame.
export function advancePadSpring(spring, target, delta) {
  let remaining = Math.min(0.1, Math.max(0, delta));
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    spring.velocity += ((target - spring.lift) * 210 - spring.velocity * 19) * dt;
    spring.lift += spring.velocity * dt;
    remaining -= dt;
  }
  if (Math.abs(target - spring.lift) < 0.0001 && Math.abs(spring.velocity) < 0.001) {
    spring.lift = target;
    spring.velocity = 0;
  }
  return spring;
}
