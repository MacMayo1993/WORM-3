// src/worm/healerWorm/orbPickupBurst.js
//
// Motion for the orb pickup burst (OrbPickupBurst.jsx), as pure functions of
// the burst's age so every curve is testable without a renderer.
//
// The burst is built in the tile's own frame — z is the surface normal, x/y lie
// flat on the face — so it reads as the cube reacting where the worm ate, not a
// ball of light floating in space. Four layers, all in the orb's colour:
//   core   — a white-hot pop at the head that is swallowed almost at once;
//   rings  — two shock rings that run flat along the tile, the second trailing;
//   sparks — motion-stretched shards fanned out over the face, slowing with drag
//            and settling back toward the surface;
//   motes  — charge flecks that spiral up off the head as the orb is absorbed.
// A quick run of pickups (the sim's orb combo) widens the rings and adds sparks,
// capped so a magnet sweep stays bounded.

export const PICKUP_BURST_SECONDS = 0.72;
export const PICKUP_MAX_COMBO = 3;
export const PICKUP_BASE_SPARKS = 10;
export const PICKUP_MAX_SPARKS = PICKUP_BASE_SPARKS + 2 * PICKUP_MAX_COMBO;
export const PICKUP_MOTES = 6;

const clamp01 = v => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const fract = v => v - Math.floor(v);
const easeOutCubic = u => 1 - (1 - u) ** 3;
const comboLevel = combo => Math.max(0, Math.min(PICKUP_MAX_COMBO, combo | 0));

/** Sparks drawn for a combo level (10, then +2 per quick pickup, capped). */
export const pickupSparkCount = combo => PICKUP_BASE_SPARKS + 2 * comboLevel(combo);

/** White-hot core: pops past orb size, then is swallowed. `null` once gone. */
export function pickupCore(t) {
  if (t < 0 || t >= 0.22) return null;
  const pop = Math.sin(Math.PI * clamp01(t / 0.1));
  // Hold full size through the pop, then swallow it with a quickening pull.
  const swallow = 1 - clamp01((t - 0.06) / 0.16) ** 2;
  return { scale: 0.3 * (1 + 0.6 * pop) * swallow, opacity: 1 - t / 0.22 };
}

/**
 * Shock ring `index` (0 = lead, 1 = trailing white ring) flat on the tile.
 * Radius eases out; opacity falls away with it. `null` outside its window.
 */
export function pickupRing(index, t, combo = 0) {
  const delay = index === 0 ? 0 : 0.08;
  const life = index === 0 ? 0.5 : 0.42;
  const u = (t - delay) / life;
  if (u <= 0 || u >= 1) return null;
  const reach = (index === 0 ? 1.05 : 0.7) * (1 + 0.15 * comboLevel(combo));
  return { radius: 0.12 + (reach - 0.12) * easeOutCubic(u), opacity: (1 - u) ** 1.5 * (index === 0 ? 0.9 : 0.7) };
}

/**
 * Spark `index` of `count`: fanned evenly around the head with a little jitter,
 * launched 20–50° off the face, slowed by drag and pulled back toward the
 * surface. Returns its tip position, unit velocity direction (for the stretch),
 * streak length and opacity; `null` once it has faded.
 */
export function pickupSpark(index, t, count = PICKUP_BASE_SPARKS) {
  const life = 0.46 + 0.14 * fract(index * 0.6180339887);
  if (t <= 0 || t >= life) return null;
  const angle = (index / count) * Math.PI * 2 + (fract(index * 0.7548776662) - 0.5) * 0.5;
  const lift = (20 + 30 * fract(index * 0.5698402910)) * Math.PI / 180;
  const speed = 2.3 + 0.9 * fract(index * 0.3819660113);
  const drag = 6.5;
  const travel = speed * (1 - Math.exp(-drag * t)) / drag;
  const planar = travel * Math.cos(lift);
  const settle = 0.55 * t * t;
  const x = Math.cos(angle) * planar, y = Math.sin(angle) * planar;
  const z = Math.max(0.02, travel * Math.sin(lift) - settle);
  // Instantaneous velocity: drag slows the launch, settling pulls it down.
  const v = speed * Math.exp(-drag * t);
  const vx = Math.cos(angle) * Math.cos(lift) * v, vy = Math.sin(angle) * Math.cos(lift) * v;
  const vz = Math.sin(lift) * v - 1.1 * t;
  const mag = Math.hypot(vx, vy, vz) || 1;
  return {
    position: [x, y, z],
    direction: [vx / mag, vy / mag, vz / mag],
    // Fast sparks stretch into streaks and shorten as drag slows them.
    length: 0.06 + 0.1 * Math.min(1, mag / speed),
    opacity: 1 - t / life,
    white: index % 4 === 0,
  };
}

/** Charge mote `index`: spirals up off the head and fades. `null` when gone. */
export function pickupMote(index, t) {
  const delay = 0.05 + 0.04 * index;
  const age = t - delay;
  if (age <= 0 || age >= 0.44) return null;
  const angle = (index / PICKUP_MOTES) * Math.PI * 2 + age * 9;
  const radius = 0.16 + 0.12 * age;
  const fade = age < 0.24 ? 1 : 1 - (age - 0.24) / 0.2;
  return {
    position: [Math.cos(angle) * radius, Math.sin(angle) * radius, 0.1 + 0.95 * age],
    scale: 0.045 * Math.min(1, age / 0.06) * fade,
  };
}
