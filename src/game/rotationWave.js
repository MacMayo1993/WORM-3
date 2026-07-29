// src/game/rotationWave.js
//
// A rotation WAVE: one to three slice rotations that warn, animate and commit
// together.
//
// The only shape allowed
// ----------------------
// Every plane in a wave shares one axis, and no two planes share a slice index.
// That is not a simplification — it is what makes the whole feature safe:
//
//   • A quarter-turn of a slice maps that slice onto ITSELF. Cell (x, 2, z) in a
//     'row' turn lands at (x', 2, z'); y never changes. So two planes on the same
//     axis with different indices touch disjoint cells, before and after.
//   • Disjoint permutations commute. Committing plane A then B gives exactly the
//     same cube as B then A, so "the planes turned simultaneously" has a single
//     well-defined answer and commit order stops mattering.
//
// Perpendicular planes have none of that. Their intersection cells belong to both
// rotations, the result depends on which is applied first, and the outcome is no
// longer "two ordinary slice turns" — which is why they are out of scope.
//
// Why turns are stored separately from direction
// ----------------------------------------------
// `dir` is ±1 (a signed quarter turn) and `numTurns` is 1..3, matching the
// existing move payload the animation pipeline already carries. Folding them into
// a single signed count would break every consumer that reads `dir` to decide
// which way to sweep a warning light or spin a comet streamer.

import { forEachSliceCoordinate, getActivePlaneForCoordinate } from './sliceIndex.js';
import { rotateStickers } from './cubeRotation.js';

/** A wave may hold at most this many parallel planes. */
export const MAX_WAVE_PLANES = 3;

const VALID_AXES = new Set(['col', 'row', 'depth']);

let _nextWaveId = 1;

/** Monotonic wave id. Consumers use it to detect "this is a different wave". */
export function nextWaveId() {
  return _nextWaveId++;
}

/** Reset the wave-id counter. Tests only, so ids stay readable across cases. */
export function resetWaveIds() {
  _nextWaveId = 1;
}

/**
 * Validate and canonicalise a set of parallel rotations into a wave.
 *
 * Requests for the same plane are merged rather than rejected: two +1 quarter
 * turns of slice 3 become one double turn, and +1 followed by -1 cancels to
 * nothing. That is the same answer the moves would have produced sequentially,
 * and it means a caller that assembles a wave from independent sources (a
 * generated hazard plus a queued player move, say) cannot accidentally build an
 * illegal duplicate.
 *
 * @param {string} axis - 'col' | 'row' | 'depth'
 * @param {Array<{sliceIndex:number, dir:number, numTurns?:number}>} rotations
 * @param {number} size
 * @returns {{wave: object}|{error: string}}
 */
export function normalizeWave(axis, rotations, size) {
  if (!VALID_AXES.has(axis)) return { error: `unknown axis "${axis}"` };
  if (!Array.isArray(rotations) || rotations.length === 0) return { error: 'wave has no rotations' };

  // Signed quarter turns per slice, insertion-ordered so the resulting plane
  // order is stable and reproducible (warning colours key off it).
  const turnsBySlice = new Map();
  for (const r of rotations) {
    const { sliceIndex } = r;
    if (!Number.isInteger(sliceIndex) || sliceIndex < 0 || sliceIndex >= size) {
      return { error: `slice ${sliceIndex} out of range for size ${size}` };
    }
    if (r.dir !== 1 && r.dir !== -1) return { error: `dir must be ±1, got ${r.dir}` };
    const n = r.numTurns ?? 1;
    if (!Number.isInteger(n) || n < 1) return { error: `numTurns must be a positive integer, got ${n}` };
    turnsBySlice.set(sliceIndex, (turnsBySlice.get(sliceIndex) ?? 0) + r.dir * n);
  }

  const out = [];
  for (const [sliceIndex, signed] of turnsBySlice) {
    // Four quarter turns is the identity, so reduce before deciding whether the
    // plane survives at all.
    const net = ((signed % 4) + 4) % 4;
    if (net === 0) continue;
    if (net === 1) out.push({ sliceIndex, dir: 1, numTurns: 1 });
    // Three quarter turns one way is one the other way — always take the short
    // route, so the animation never sweeps 270° to land where 90° would.
    else if (net === 3) out.push({ sliceIndex, dir: -1, numTurns: 1 });
    // A half turn lands in the same place either way, so the only thing left to
    // decide is which way it visibly sweeps: follow the sign the caller asked for.
    else out.push({ sliceIndex, dir: signed < 0 ? -1 : 1, numTurns: 2 });
  }

  if (out.length === 0) return { error: 'wave cancels to nothing' };
  if (out.length > MAX_WAVE_PLANES) {
    return { error: `wave has ${out.length} planes, max ${MAX_WAVE_PLANES}` };
  }

  return { wave: { id: nextWaveId(), axis, rotations: out } };
}

/** Build a one-plane wave. The shape every legacy single-rotation call site takes. */
export function singlePlaneWave(axis, sliceIndex, dir, numTurns = 1) {
  return { id: nextWaveId(), axis, rotations: [{ sliceIndex, dir, numTurns }] };
}

/**
 * The wave that undoes this one.
 *
 * Because the planes are disjoint they commute, so a wave's inverse is simply
 * the same planes turning the other way — no reordering needed. That is what
 * lets the worm hazard queue be `[...waves].reverse().map(invertWave)` and still
 * un-scramble the cube exactly.
 */
export function invertWave(wave) {
  return {
    id: nextWaveId(),
    axis: wave.axis,
    rotations: wave.rotations.map(r => ({ ...r, dir: -r.dir })),
  };
}

/** Flatten a wave into the singular move payloads legacy consumers expect. */
export function waveToMoves(wave) {
  return wave.rotations.map(r => ({
    axis: wave.axis,
    sliceIndex: r.sliceIndex,
    dir: r.dir,
    numTurns: r.numTurns ?? 1,
  }));
}

/** Total quarter turns across every plane — what the move counter should advance by. */
export function waveTurnCount(wave) {
  let n = 0;
  for (const r of wave.rotations) n += r.numTurns ?? 1;
  return n;
}

/** True when the wave is a plain single-plane turn, i.e. safe for legacy consumers. */
export function isSinglePlane(wave) {
  return !!wave && wave.rotations.length === 1;
}

/** The single-rotation payload for a one-plane wave, else null. */
export function waveToLastRotation(wave) {
  if (!isSinglePlane(wave)) return null;
  const r = wave.rotations[0];
  return { axis: wave.axis, sliceIndex: r.sliceIndex, dir: r.dir, numTurns: r.numTurns ?? 1 };
}

/**
 * Which of a wave's planes owns this cell, or -1. Re-exported so consumers
 * dealing in waves need only one import.
 */
export { getActivePlaneForCoordinate };

// Rotate a lattice coordinate by a plane's quarter turns, about the wave axis.
// Returns the destination [x, y, z]. `k` is the lattice centre offset.
function rotateCell(axis, dir, numTurns, x, y, z, k, out) {
  let cx = x - k, cy = y - k, cz = z - k;
  for (let t = 0; t < numTurns; t++) {
    if (axis === 'col') {
      const ny = -dir * cz, nz = dir * cy;
      cy = ny; cz = nz;
    } else if (axis === 'row') {
      const nx = dir * cz, nz = -dir * cx;
      cx = nx; cz = nz;
    } else {
      const nx = -dir * cy, ny = dir * cx;
      cx = nx; cy = ny;
    }
  }
  out[0] = Math.round(cx + k);
  out[1] = Math.round(cy + k);
  out[2] = Math.round(cz + k);
  return out;
}

// Rotate a cubie's sticker keys through `numTurns` quarter turns.
function rotateStickersN(stickers, axis, dir, numTurns) {
  let s = stickers;
  for (let t = 0; t < numTurns; t++) s = rotateStickers(s, axis, dir);
  return s;
}

const _dest = [0, 0, 0];

/**
 * Commit a whole wave to the cube in one atomic step.
 *
 * Every source cubie is read from the ORIGINAL `cubies`, never from the clone
 * being written, so overlapping source/destination cells inside a plane resolve
 * correctly without a separate snapshot pass — and, because the planes are
 * disjoint, no plane can ever observe another's writes. The result is therefore
 * identical to committing the planes one at a time in any order.
 *
 * Outer arrays are cloned exactly once. Cubies outside every plane keep their
 * object identity, which is what lets Cubie's memo comparator skip the ~85% of
 * the cube that did not move — the same contract rotateSliceCubies upholds.
 */
export function applyWaveToCubies(cubies, size, wave) {
  const k = (size - 1) / 2;
  const next = cubies.map(L => L.map(R => R.slice()));

  for (const r of wave.rotations) {
    const numTurns = r.numTurns ?? 1;
    forEachSliceCoordinate(size, wave.axis, r.sliceIndex, (x, y, z) => {
      const src = cubies[x][y][z];
      rotateCell(wave.axis, r.dir, numTurns, x, y, z, k, _dest);
      next[_dest[0]][_dest[1]][_dest[2]] = {
        ...src,
        x: _dest[0], y: _dest[1], z: _dest[2],
        stickers: rotateStickersN(src.stickers, wave.axis, r.dir, numTurns),
      };
    });
  }

  return next;
}
