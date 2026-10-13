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
    started: false,
  };
}

function spawn(field, i, cfg, size, worm, rand, expansion) {
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
  field.age[i] = 0;
  field.life[i] = cfg.life * (0.7 + rand() * 0.6);
  field.seed[i] = rand();
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
 */
export function stepReactionField(field, dt, { cfg, size, worm = null, emitting = true, rand, expansion = 0 }) {
  if (!field.started) {
    // The fusion ERUPTS: the whole first generation is born at once, already spread
    // across the first part of a life, so the reaction bursts off the cube the moment
    // it forms instead of trickling in. Later generations stagger naturally.
    for (let i = 0; i < field.count; i++) {
      spawn(field, i, cfg, size, worm, rand, expansion);
      field.age[i] = rand() * field.life[i] * 0.6;
    }
    field.started = true;
  }
  const drag = Math.exp(-cfg.drag * dt);
  for (let i = 0; i < field.count; i++) {
    field.age[i] += dt;
    if (field.age[i] < 0) { field.alpha[i] = 0; continue; }
    if (field.age[i] >= field.life[i]) {
      if (!emitting) { field.alpha[i] = 0; continue; }
      spawn(field, i, cfg, size, worm, rand, expansion);
    }
    const j = i * 3;
    field.vel[j] *= drag; field.vel[j + 2] *= drag;
    field.vel[j + 1] = field.vel[j + 1] * drag + cfg.buoy * dt;
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
