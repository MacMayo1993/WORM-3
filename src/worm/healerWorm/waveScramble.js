// src/worm/healerWorm/waveScramble.js
//
// The opening scramble for WORM mode, generated as a list of rotation WAVES.
//
// Why waves and not a flat move list
// ----------------------------------
// The hazard the player dodges during a run is the scramble played backwards:
// `[...waves].reverse().map(invertWave)`. That works only because a wave's
// planes are parallel and disjoint, so they commute and the inverse of a wave is
// simply the same planes turning the other way — no reordering, no ambiguity
// about "which of the three undid first".
//
// Generating the scramble flat and then trying to group consecutive moves into
// waves at fire time would give waves of random width (usually one, since three
// consecutive random moves rarely share an axis), so a three-plane turn would
// almost never appear. Authoring waves up front means the width is a deliberate
// difficulty knob, and the player sees a three-plane turn in the opening
// scramble — a preview of what the run will throw at them.
//
// Pure: `rand` is injected, so a run is reproducible in tests and the bench.

import { normalizeWave, invertWave } from '../../game/rotationWave.js';
import { isTileInSlice } from '../../game/sliceIndex.js';

const AXES = ['col', 'row', 'depth'];

/**
 * How many planes a wave should hold at a given point in the scramble.
 *
 * Standard cube sizes always get one, so their scramble and their hazard stream
 * are byte-identical to what they were before waves existed. Mega ramps up: the
 * first waves are single-plane so the opening reads clearly, then widen.
 */
export function planesForWave(index, total, maxPlanes) {
  if (maxPlanes <= 1) return 1;
  const t = total <= 1 ? 1 : index / (total - 1);
  if (t < 0.25) return 1;
  if (t < 0.6) return Math.min(2, maxPlanes);
  return maxPlanes;
}

/**
 * Generate the opening scramble as waves.
 *
 * @param {number} size
 * @param {number} waveCount - how many waves to emit
 * @param {number} maxPlanes - 1 for standard sizes, 3 for Mega
 * @param {() => number} rand - [0,1) source
 * @returns {Array<object>} waves
 */
export function generateScrambleWaves(size, waveCount, maxPlanes, rand = Math.random) {
  const waves = [];
  let prevAxis = null;
  let prevSlices = null;

  for (let i = 0; i < waveCount; i++) {
    const want = Math.min(planesForWave(i, waveCount, maxPlanes), size);

    // Standard scrambler rule: never turn the same layer twice in a row. Without
    // it a random pick can re-select the layer just turned — most visibly when
    // the direction also flips, which turns the previous move straight back and
    // wastes a wave. Applied to the whole wave: a wave that repeats the previous
    // wave's exact plane set is rerolled.
    let axis, slices;
    let attempts = 0;
    do {
      axis = AXES[Math.floor(rand() * AXES.length)];
      slices = pickDistinctSlices(size, want, rand);
      attempts++;
    } while (
      attempts < 8 &&
      axis === prevAxis &&
      prevSlices &&
      slices.length === prevSlices.length &&
      slices.every(s => prevSlices.includes(s))
    );

    const rotations = slices.map(sliceIndex => ({
      sliceIndex,
      dir: rand() < 0.5 ? 1 : -1,
      numTurns: 1,
    }));

    const { wave, error } = normalizeWave(axis, rotations, size);
    // normalizeWave only rejects malformed input, and the slices here are
    // distinct and in range by construction — but a wave that somehow cancelled
    // to nothing must be skipped rather than pushed, or the inverse queue would
    // carry an empty turn the player can't read.
    if (error) continue;
    // Mark the whole wave so CubeAssembly picks the scramble tween speed.
    wave.wormScramble = true;
    waves.push(wave);
    prevAxis = axis;
    prevSlices = slices;
  }

  return waves;
}

// `count` distinct slice indices in [0, size). Small counts, so a reroll loop
// beats shuffling the whole range.
function pickDistinctSlices(size, count, rand) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 12) {
    const s = Math.floor(rand() * size);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** The hazard queue: the scramble undone, wave by wave, from the end. */
export function buildInverseQueue(waves) {
  return [...waves].reverse().map(invertWave);
}

/**
 * Split a wave into the part that fires now and the part that waits.
 *
 * The fairness guarantee is modest by design and cheap to check: standing still
 * must not be certain death. A worm dies when its head rides a turning plane
 * while some part of it does not, so the dangerous shape is "head on one of
 * several planes" — the head is swept away while the tail is held by a
 * differently-moving plane or by static ground, and no amount of steering inside
 * the warning window can save a long worm.
 *
 * When that shape comes up, the wave narrows to the head's own plane. The
 * dropped planes are NOT discarded: they are returned as a deferred wave and go
 * back on the front of the hazard queue, so the run still works through the same
 * total rotation and still reaches the same end state. The player gets a gentler
 * wave now and the rest a beat later.
 *
 * This is the floor, not the tuned rule — weighting by how far the worm can
 * actually crawl inside the warning window is Phase 4 work.
 *
 * @param {object} wave
 * @param {{x:number,y:number,z:number}} head
 * @returns {{fire: object, deferred: object|null}}
 */
export function splitFairWave(wave, head) {
  if (!head || wave.rotations.length <= 1) return { fire: wave, deferred: null };

  const onHeadPlane = (r) => isTileInSlice(wave.axis, r.sliceIndex, head.x, head.y, head.z);
  const headPlanes = wave.rotations.filter(onHeadPlane);
  // Head is on no plane at all: it can stand still and lose at most some tail.
  if (headPlanes.length === 0) return { fire: wave, deferred: null };

  const rest = wave.rotations.filter(r => !onHeadPlane(r));
  return {
    fire: { ...wave, rotations: headPlanes },
    deferred: rest.length ? { ...wave, id: `${wave.id}-deferred`, rotations: rest } : null,
  };
}

/** Convenience wrapper for callers that only want the wave that fires. */
export function pickFairWave(wave, head) {
  return splitFairWave(wave, head).fire;
}
