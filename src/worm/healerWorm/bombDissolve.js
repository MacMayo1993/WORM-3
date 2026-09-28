// The opening cube's sand-like crumble, sized for a bomb. Local +y follows the
// face's up direction, so the glowing front reads top-to-bottom on all six faces.
export const BOMB_DISSOLVE_SECONDS = 1.1;
export const BOMB_FLECK_LIFE = 0.7;
export const BOMB_DISSOLVE_HOLD = BOMB_DISSOLVE_SECONDS + BOMB_FLECK_LIFE;
export const BOMB_FLECKS = 12;
export const BOMB_RADIUS = 0.42;
export const BOMB_FIELD_TOP = BOMB_RADIUS + 0.3; // includes the unlit fuse
export const BOMB_FIELD_BOTTOM = -BOMB_RADIUS;
export const BOMB_FIELD_SCALE = 3.4 / (BOMB_FIELD_TOP - BOMB_FIELD_BOTTOM);
export const BOMB_FIELD_MID = (BOMB_FIELD_TOP + BOMB_FIELD_BOTTOM) / 2;

const clamp01 = v => Math.min(1, Math.max(0, v));
const fract = v => v - Math.floor(v);
export const bombDissolveProgress = t => clamp01(t / BOMB_DISSOLVE_SECONDS);

// Like introFleck: pieces shed near the passing front, drift up/out and shrink.
// Sample a sphere rather than the intro's cube so the fragments start on the shell.
export function bombFleck(index, t, seed = 0, reducedMotion = false) {
  if (reducedMotion) return null;
  const k = index + seed * 7.13;
  const y = 1 - 2 * ((index + 0.5) / BOMB_FLECKS);
  const angle = fract(k * 0.7548776662) * Math.PI * 2;
  const r = Math.sqrt(1 - y * y);
  const normal = [Math.cos(angle) * r, y, Math.sin(angle) * r];
  const sweep = (BOMB_FIELD_TOP - y * BOMB_RADIUS) / (BOMB_FIELD_TOP - BOMB_FIELD_BOTTOM);
  const born = BOMB_DISSOLVE_SECONDS * (0.1 + 0.6 * sweep + 0.2 * fract(k * 0.381966));
  const age = t - born;
  if (age <= 0 || age >= BOMB_FLECK_LIFE) return null;
  const off = 0.18 * (1 - Math.exp(-age * 2.6));
  const rise = 0.35 * age + 0.16 * age * age;
  const fade = 1 - clamp01((age - BOMB_FLECK_LIFE * 0.45) / (BOMB_FLECK_LIFE * 0.55));
  return {
    position: normal.map((n, axis) => n * (BOMB_RADIUS + off) + (axis === 1 ? rise : 0)),
    spin: [age * (4 + index % 4), age * (3 + index % 3), age * 1.5],
    scale: 0.045 * Math.min(1, age / 0.08) * fade,
    color: index % 3 === 2 ? '#1b1b1d' : index % 3 === 1 ? '#8a93a8' : '#ffb45c',
  };
}
