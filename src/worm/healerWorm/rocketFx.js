// src/worm/healerWorm/rocketFx.js
//
// The rocket burn as the player should feel it: ignition, a launch surge that
// leaves a cloud on the pad, a steady cruise trailing smoke, a throttled-back
// descent and a dusty touchdown.
//
// The simulation only knows three numbers (rocketActive, rocketT, rocketFlight)
// plus the landing grace it starts at touchdown. Everything here is derived from
// those, so the exhaust, the booster, the smoke and the camera all agree about
// which beat of the burn they are in without anyone writing state back to the
// sim. Pure and dependency-free apart from the constants, so the envelope, the
// smoke pool and the shake are testable without a GPU.

import { ROCKET_DURATION, ROCKET_FLIGHT_LANDING, ROCKET_LANDING_GRACE } from './constants.js';

/** Seconds from ignition to a full flame. */
export const ROCKET_IGNITE_TIME = 0.12;
/** Seconds the launch surge takes to settle into the cruise flame. */
export const ROCKET_LIFTOFF_TIME = 1.3;
/** Landing grace spent on the touchdown kick (grace counts down from ROCKET_LANDING_GRACE). */
const TOUCHDOWN_KICK = 0.3;
/** The booster stays strapped on briefly after touchdown, then pops away over this window. */
const HARDWARE_HOLD = 0.25;
const HARDWARE_STOW = 0.3;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = t => t * t * (3 - 2 * t);
// A small overshoot so the booster clunks into place rather than fading in.
const easeOutBack = t => {
  const c = 1.9, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

/**
 * The burn envelope, 0..1 channels written into `out`:
 *   ignite    flame presence (snaps on, and stays on through a refuel)
 *   liftoff   the launch surge: 1 at ignition, easing to 0 as the cruise settles
 *   landing   0 through the cruise, rising to 1 over the descent
 *   touchdown 1 at the moment of landing, fading over the first moments of grace
 *   thrust    flame length / smoke rate, combining the above
 *   hardware  booster scale (with a little overshoot on the way in)
 *
 * A refuel resets rocketT while rocketFlight stays at 1: the flame and booster
 * never blink, and the launch surge replays as an afterburner kick.
 */
export function rocketBurnInto(out, active, rocketT = 0, flight = 0, landingGraceT = 0) {
  if (active) {
    const elapsed = Math.max(0, ROCKET_DURATION - rocketT);
    out.ignite = clamp01(Math.max(elapsed / ROCKET_IGNITE_TIME, (flight ?? 0) * 8));
    out.liftoff = 1 - smooth(clamp01((elapsed - 0.15) / (ROCKET_LIFTOFF_TIME - 0.15)));
    out.landing = 1 - clamp01(rocketT / ROCKET_FLIGHT_LANDING);
    out.touchdown = 0;
    out.thrust = out.ignite * (0.7 + 0.5 * out.liftoff) * (1 - 0.55 * smooth(out.landing));
    out.hardware = easeOutBack(clamp01(Math.max(elapsed / 0.22, (flight ?? 0) * 4)));
    return out;
  }
  const grace = clamp01(landingGraceT / ROCKET_LANDING_GRACE);
  out.ignite = 0;
  out.liftoff = 0;
  out.landing = grace > 0 ? 1 : 0;
  out.touchdown = clamp01((grace - (1 - TOUCHDOWN_KICK)) / TOUCHDOWN_KICK);
  out.thrust = 0;
  out.hardware = smooth(clamp01((grace - (1 - HARDWARE_HOLD - HARDWARE_STOW)) / HARDWARE_STOW));
  return out;
}

/**
 * Camera shake amplitude, in world units: a hard kick at ignition that settles
 * into a faint engine rumble, and a short thump at touchdown.
 */
export function rocketShakeAmount(burn) {
  const kick = burn.liftoff * burn.liftoff * burn.ignite;
  return 0.045 * kick + 0.006 * burn.thrust + 0.03 * burn.touchdown * burn.touchdown;
}

/**
 * A smooth, non-repeating jitter of the given amplitude written into `out`
 * (x/y in the camera's right/up plane). Sums of incommensurate sines rather
 * than random draws, so it is continuous between frames and never spikes.
 */
export function rocketShakeInto(out, time, amount) {
  if (!(amount > 0)) return out.set(0, 0, 0);
  out.set(
    (Math.sin(time * 47.3) * 0.6 + Math.sin(time * 91.7 + 1.3) * 0.4) * amount,
    (Math.sin(time * 53.9 + 2.1) * 0.6 + Math.sin(time * 83.1 + 0.4) * 0.4) * amount,
    0
  );
  return out;
}

/** Small seeded generator (mulberry32) so smoke is reproducible under test. */
export function createRocketRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Smoke ────────────────────────────────────────────────────────────────────
// A fixed ring of puffs in world space. The worm flies on and the puffs stay
// where they were exhaled, which is what draws the contrail around the cube.

/** Puff budget at full quality. A burn at full thrust keeps about half of it alive. */
export const ROCKET_SMOKE_CAPACITY = 220;

export function createSmokePool(capacity = ROCKET_SMOKE_CAPACITY) {
  return {
    capacity,
    next: 0,
    live: 0,
    pos: new Float32Array(capacity * 3),
    vel: new Float32Array(capacity * 3),
    age: new Float32Array(capacity),
    life: new Float32Array(capacity),
    size0: new Float32Array(capacity),
    size1: new Float32Array(capacity),
    alpha: new Float32Array(capacity),
    heat: new Float32Array(capacity),
    cool: new Float32Array(capacity),
    drag: new Float32Array(capacity),
    seed: new Float32Array(capacity)
  };
}

/** Forget every puff (run reset, mode exit). */
export function clearSmokePool(pool) {
  pool.life.fill(0);
  pool.age.fill(0);
  pool.next = 0;
  pool.live = 0;
}

/**
 * Exhale one puff. When the ring is full the oldest slot is reused, so a long
 * burn can never grow the pool. `age` lets a caller spread a frame's worth of
 * puffs along the path the nozzle travelled, instead of stacking them.
 */
export function emitPuff(pool, px, py, pz, vx, vy, vz, opts) {
  const i = pool.next;
  pool.next = (i + 1) % pool.capacity;
  if (!(pool.life[i] > pool.age[i])) pool.live++;
  pool.pos[i * 3] = px; pool.pos[i * 3 + 1] = py; pool.pos[i * 3 + 2] = pz;
  pool.vel[i * 3] = vx; pool.vel[i * 3 + 1] = vy; pool.vel[i * 3 + 2] = vz;
  pool.age[i] = opts.age ?? 0;
  pool.life[i] = opts.life;
  pool.size0[i] = opts.size0;
  pool.size1[i] = opts.size1;
  pool.alpha[i] = opts.alpha ?? 1;
  pool.heat[i] = opts.heat ?? 0;
  pool.cool[i] = opts.cool ?? 7;
  pool.drag[i] = opts.drag ?? 2;
  pool.seed[i] = opts.seed ?? 0;
  return i;
}

/** Age, drift and slow every live puff. Expired puffs are dropped from `live`. */
export function stepSmokePool(pool, dt) {
  if (!(dt > 0)) return pool;
  let live = 0;
  for (let i = 0; i < pool.capacity; i++) {
    if (!(pool.life[i] > pool.age[i])) continue;
    pool.age[i] += dt;
    if (pool.age[i] >= pool.life[i]) continue;
    const damp = Math.exp(-pool.drag[i] * dt);
    const j = i * 3;
    pool.vel[j] *= damp; pool.vel[j + 1] *= damp; pool.vel[j + 2] *= damp;
    pool.pos[j] += pool.vel[j] * dt;
    pool.pos[j + 1] += pool.vel[j + 1] * dt;
    pool.pos[j + 2] += pool.vel[j + 2] * dt;
    live++;
  }
  pool.live = live;
  return pool;
}

/**
 * How a puff looks at its current age: `size` (world diameter), `alpha` and
 * `heat` (0 = grey smoke, 1 = fresh fire-lit exhaust, fading at the puff's own
 * `cool` rate). Returns false once the puff has expired.
 */
export function puffLookInto(out, pool, i) {
  const life = pool.life[i], age = pool.age[i];
  if (!(life > age)) return false;
  const t = age / life;
  out.size = pool.size0[i] + (pool.size1[i] - pool.size0[i]) * Math.sqrt(t);
  // Quick fade-in so a puff never pops, then a long tail as it thins out.
  out.alpha = pool.alpha[i] * clamp01(age / 0.05) * Math.pow(1 - t, 1.6);
  out.heat = pool.heat[i] * Math.exp(-age * pool.cool[i]);
  return true;
}
