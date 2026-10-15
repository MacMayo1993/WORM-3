// src/worm/healerWorm/fusionParticles.js
//
// The motion of a fusion's reaction particles (FusionParticles.jsx draws them). The
// elements' own fields drift in a box around the cube; a reaction instead BOILS OFF
// the cube: every particle is born on a face (or on the worm's own body, so the
// reaction follows the player), pushed off the surface along its normal, lifted or
// dropped by its kind (steam rises, sparks and spray arc and fall), slowed by drag,
// and swells and fades over its life before it is born again somewhere else.
//
// Pure and allocation-free per frame: one set of typed arrays per field, written in
// place. Randomness comes from the caller, so tests are deterministic.

import { expandedFaceCoordinate, elementalHalfExtent } from './elementalExpansion.js';

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// The motions (REACTION_MOTIONS in fusionLooks.js) and their strengths.
const MOTION = { rise: 0, swirl: 1, gust: 2, fountain: 3, zigzag: 4, orbit: 5, hover: 6, spiral: 7 };
export const MOTION_TUNING = Object.freeze({
  swirl: 1.6,        // tangential acceleration round the vertical axis
  spiralPull: 0.9,   // a spiral's inward pull toward the axis
  spiralLift: 0.7,   // ...and its extra lift
  gust: 1.4,         // sideways acceleration of the wind
  gustTurn: 0.15,    // radians a second the wind turns
  fountainKick: 2.0, // a fountain's spawn speed multiplier
  fountainUp: 1.6,   // ...plus this much straight up
  fountainFall: 2.2, // ...and extra gravity pulling it back
  zigzag: 0.9,       // hop speed of a zigzag, world units a second
  orbit: 1.6,        // speed round the worm's head
  orbitRadius: 0.7,  // the ring it is drawn onto
  orbitPull: 3.0,    // how hard it is pulled back onto the ring
  orbitSteer: 5.0,   // how fast its velocity turns onto the ring's
  hoverDamp: 3.0,    // extra drag that holds a hovering particle near the surface
});
const FOUNTAIN_KICK = MOTION_TUNING.fountainKick;
const FOUNTAIN_UP = MOTION_TUNING.fountainUp;

/** A field of `count` particles, all waiting to be born (staggered so they never arrive in one burst). */
export function makeReactionField(count) {
  return {
    count,
    pos: new Float32Array(count * 3),
    vel: new Float32Array(count * 3),
    age: new Float32Array(count),
    life: new Float32Array(count),
    seed: new Float32Array(count),
    // What the renderer reads: world position, 0..1 alpha and world size per particle.
    alpha: new Float32Array(count),
    size: new Float32Array(count),
    k: new Float32Array(count),   // 0 → 1 through each life, for the colour ramp
    time: 0,                       // the field's own clock, for motions that turn (gust)
    started: false,
  };
}

function spawn(field, i, cfg, size, worm, rand, expansion, motion = 0) {
  const h = size / 2;
  let px, py, pz, nx = 0, ny = 0, nz = 0;
  if (worm && worm.count > 0 && rand() < cfg.worm) {
    // Off a random segment of the worm, pushed out along that face's normal.
    const s = Math.floor(rand() * worm.count) * 3;
    px = worm.positions[s]; py = worm.positions[s + 1]; pz = worm.positions[s + 2];
    const ax = Math.abs(px), ay = Math.abs(py), az = Math.abs(pz);
    if (ax >= ay && ax >= az) nx = Math.sign(px) || 1;
    else if (ay >= az) ny = Math.sign(py) || 1;
    else nz = Math.sign(pz) || 1;
  } else {
    // Off a random point of a random face.
    const axis = Math.floor(rand() * 3) % 3;
    const sign = rand() < 0.5 ? -1 : 1;
    const u = expandedFaceCoordinate((rand() * 2 - 1) * h, size, expansion);
    const w = expandedFaceCoordinate((rand() * 2 - 1) * h, size, expansion);
    const surface = elementalHalfExtent(size, expansion);
    const n = AXES[axis];
    nx = n[0] * sign; ny = n[1] * sign; nz = n[2] * sign;
    px = axis === 0 ? sign * surface : u;
    py = axis === 1 ? sign * surface : axis === 0 ? u : w;
    pz = axis === 2 ? sign * surface : w;
  }
  const j = i * 3;
  field.pos[j] = px + nx * 0.06; field.pos[j + 1] = py + ny * 0.06; field.pos[j + 2] = pz + nz * 0.06;
  const out = cfg.out * (0.6 + rand() * 0.8);
  const spread = cfg.out * 0.45;
  field.vel[j] = nx * out + (rand() - 0.5) * spread;
  field.vel[j + 1] = ny * out + (rand() - 0.5) * spread;
  field.vel[j + 2] = nz * out + (rand() - 0.5) * spread;
  if (motion === MOTION.fountain) {
    // Thrown high: a hard kick off the face and up, to arc back down.
    field.vel[j] *= FOUNTAIN_KICK; field.vel[j + 1] = field.vel[j + 1] * FOUNTAIN_KICK + FOUNTAIN_UP; field.vel[j + 2] *= FOUNTAIN_KICK;
  }
  field.age[i] = 0;
  field.life[i] = cfg.life * (0.7 + rand() * 0.6);
  field.seed[i] = rand();
}

// The recipe's motion on top of the kind's own lift and drag. Allocation-free.
function applyMotion(field, i, j, motion, dt, head, gustX, gustZ, hoverDrag, cfg) {
  if (motion === MOTION.rise) return;
  const T = MOTION_TUNING;
  const vel = field.vel, pos = field.pos;
  if (motion === MOTION.swirl || motion === MOTION.spiral || (motion === MOTION.orbit && !head)) {
    const x = pos[j], z = pos[j + 2];
    const r = Math.hypot(x, z) || 1;
    vel[j] += (-z / r) * T.swirl * dt;
    vel[j + 2] += (x / r) * T.swirl * dt;
    if (motion === MOTION.spiral) {
      vel[j] -= (x / r) * T.spiralPull * dt;
      vel[j + 2] -= (z / r) * T.spiralPull * dt;
      vel[j + 1] += T.spiralLift * dt;
    }
  } else if (motion === MOTION.gust) {
    vel[j] += gustX;
    vel[j + 2] += gustZ;
  } else if (motion === MOTION.fountain) {
    vel[j + 1] -= T.fountainFall * dt;
  } else if (motion === MOTION.zigzag) {
    // Sharp hops: the sideways direction flips on a beat of its own per particle.
    const t = field.age[i] + field.seed[i] * 3;
    pos[j] += Math.sign(Math.sin(t * 22 + field.seed[i] * 40)) * T.zigzag * dt;
    pos[j + 2] += Math.sign(Math.cos(t * 17 + field.seed[i] * 30)) * T.zigzag * dt;
  } else if (motion === MOTION.orbit) {
    // Round the worm's head on a ring, about the vertical axis through it: the
    // velocity is steered toward the ring's own (a set speed round it, plus a pull
    // back onto its radius), so it settles into the ring whatever the kind's drag.
    const dx = pos[j] - head[0], dy = pos[j + 1] - head[1], dz = pos[j + 2] - head[2];
    const r = Math.hypot(dx, dy, dz) || 1;
    const rh = Math.hypot(dx, dz) || 1;
    const back = (T.orbitRadius - r) * T.orbitPull / r;
    const steer = 1 - Math.exp(-T.orbitSteer * dt);
    vel[j] += ((-dz / rh) * T.orbit + dx * back - vel[j]) * steer;
    vel[j + 1] += (dy * back - vel[j + 1]) * steer - cfg.buoy * dt;
    vel[j + 2] += ((dx / rh) * T.orbit + dz * back - vel[j + 2]) * steer;
  } else if (motion === MOTION.hover) {
    // Hangs where it was born: no buoyancy, heavy damping, a gentle bob.
    vel[j] *= hoverDrag; vel[j + 2] *= hoverDrag;
    vel[j + 1] = (vel[j + 1] - cfg.buoy * dt) * hoverDrag + Math.sin((field.age[i] + field.seed[i] * 5) * 3) * 0.12 * dt;
  }
}

/**
 * Advance the field by `dt` seconds.
 * @param {object} field     from makeReactionField
 * @param {number} dt        seconds (clamped by the caller)
 * @param {object} o
 * @param {object} o.cfg     a REACTION_PARTICLES entry
 * @param {number} o.size    the cube's edge length in tiles
 * @param {{positions: Float32Array, count: number}} [o.worm] the worm's published segments
 * @param {boolean} o.emitting  false once the wash is ending: particles finish their lives, none are born
 * @param {() => number} o.rand
 * @param {number} [o.motion]  the recipe's REACTION_MOTIONS value (0 = rise)
 */
export function stepReactionField(field, dt, { cfg, size, worm = null, emitting = true, rand, expansion = 0, motion = 0 }) {
  if (!field.started) {
    // The fusion ERUPTS: the whole first generation is born at once, already spread
    // across the first part of a life, so the reaction bursts off the cube the moment
    // it forms instead of trickling in. Later generations stagger naturally.
    for (let i = 0; i < field.count; i++) {
      spawn(field, i, cfg, size, worm, rand, expansion, motion);
      field.age[i] = rand() * field.life[i] * 0.6;
    }
    field.started = true;
  }
  const drag = Math.exp(-cfg.drag * dt);
  field.time += dt;
  const T = MOTION_TUNING;
  const gustA = field.time * T.gustTurn;
  const gustX = Math.cos(gustA) * T.gust * dt, gustZ = Math.sin(gustA) * T.gust * dt;
  const hoverDrag = Math.exp(-T.hoverDamp * dt);
  const head = motion === MOTION.orbit && worm && worm.count > 0 ? worm.positions : null;
  for (let i = 0; i < field.count; i++) {
    field.age[i] += dt;
    if (field.age[i] < 0) { field.alpha[i] = 0; continue; }
    if (field.age[i] >= field.life[i]) {
      if (!emitting) { field.alpha[i] = 0; continue; }
      spawn(field, i, cfg, size, worm, rand, expansion, motion);
    }
    const j = i * 3;
    field.vel[j] *= drag; field.vel[j + 2] *= drag;
    field.vel[j + 1] = field.vel[j + 1] * drag + cfg.buoy * dt;
    applyMotion(field, i, j, motion, dt, head, gustX, gustZ, hoverDrag, cfg);
    // A slow curl so smoke and steam wander rather than rising in straight columns.
    const t = field.age[i] + field.seed[i] * 10;
    field.pos[j] += (field.vel[j] + Math.sin(t * 1.7) * 0.06) * dt;
    field.pos[j + 1] += field.vel[j + 1] * dt;
    field.pos[j + 2] += (field.vel[j + 2] + Math.cos(t * 1.3) * 0.06) * dt;
    const k = field.age[i] / field.life[i];
    field.k[i] = k;
    // Quick fade in, long fade out.
    field.alpha[i] = Math.min(1, k / 0.12) * (1 - k) * (1 - k * 0.3);
    field.size[i] = cfg.size * (1 + cfg.grow * k) * (0.75 + field.seed[i] * 0.5);
  }
  return field;
}
