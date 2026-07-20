// cubeReorient.js — bring the cube's centres back to their home faces before
// handing it to Kociemba.
//
// Kociemba is a FIXED-CENTRE solver: its move set is only face turns
// (U/D/L/R/F/B), none of which can move a centre. But WORM-3 lets centres move
// — via middle-slice turns (M/E/S) and the antipodal echo mode — so a cube can
// end up with its centres rotated out of home position. Fed such a cube,
// Kociemba solves the edges and corners relative to the current (rotated)
// centres and leaves the centres wrong (e.g. the four side centres each showing
// their antipode after a 180° reorientation).
//
// The remedy is a whole-cube reorientation: turning all `size` parallel slices
// together rotates the entire cube (centres included) without scrambling it.
// The centre permutation of any reachable cube is one of the 24 cube rotations,
// so a short search over whole-cube turns always finds the reorientation that
// homes the centres. We prepend those turns (as ordinary slice moves) to the
// Kociemba maneuver.

import { rotateSliceCubies } from './cubeRotation.js';

// Home centre colour for each face-dir — matches makeCubies and DIR_TO_FACE.
const HOME_CENTERS = { PY: 3, NY: 6, PZ: 1, NZ: 4, PX: 5, NX: 2 };

// Centre sticker positions for an odd cube (mid = (size-1)/2).
function centerColors(cubies, size) {
  const m = (size - 1) >> 1;
  const last = size - 1;
  return {
    PY: cubies[m][last][m].stickers.PY.curr,
    NY: cubies[m][0][m].stickers.NY.curr,
    PZ: cubies[m][m][last].stickers.PZ.curr,
    NZ: cubies[m][m][0].stickers.NZ.curr,
    PX: cubies[last][m][m].stickers.PX.curr,
    NX: cubies[0][m][m].stickers.NX.curr,
  };
}

export function centersAtHome(cubies, size) {
  const c = centerColors(cubies, size);
  return (
    c.PY === HOME_CENTERS.PY && c.NY === HOME_CENTERS.NY &&
    c.PZ === HOME_CENTERS.PZ && c.NZ === HOME_CENTERS.NZ &&
    c.PX === HOME_CENTERS.PX && c.NX === HOME_CENTERS.NX
  );
}

// Rotate the whole cube one quarter turn about an axis by turning every slice.
function wholeCubeTurn(cubies, size, axis, dir) {
  let c = cubies;
  for (let s = 0; s < size; s++) c = rotateSliceCubies(c, size, axis, s, dir);
  return c;
}

function centerSig(cubies, size) {
  const c = centerColors(cubies, size);
  return `${c.PY},${c.NY},${c.PZ},${c.NZ},${c.PX},${c.NX}`;
}

const GENERATORS = [
  ['row', 1], ['row', -1],
  ['col', 1], ['col', -1],
  ['depth', 1], ['depth', -1],
];

// Breadth-first search over whole-cube turns for the shortest sequence that
// homes the centres. The centre state space is the 24-element cube-rotation
// group, so this visits at most 24 nodes and terminates quickly.
function reorientWholeTurns(cubies, size) {
  if (centersAtHome(cubies, size)) return [];
  let frontier = [{ c: cubies, seq: [] }];
  const seen = new Set([centerSig(cubies, size)]);
  for (let depth = 0; depth < 4; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const [axis, dir] of GENERATORS) {
        const nc = wholeCubeTurn(node.c, size, axis, dir);
        if (centersAtHome(nc, size)) return [...node.seq, [axis, dir]];
        const s = centerSig(nc, size);
        if (!seen.has(s)) {
          seen.add(s);
          next.push({ c: nc, seq: [...node.seq, [axis, dir]] });
        }
      }
    }
    frontier = next;
  }
  return null; // unreachable for a valid cube
}

/**
 * Compute the whole-cube reorientation that brings the centres home.
 *
 * @returns {{ moves: Array<{axis,dir,sliceIndex,numTurns,notation}>, cubies: Array }}
 *   `moves` are ordinary slice moves (one per slice, `size` per whole-cube turn)
 *   ready to prepend to the solver's playback; `cubies` is the reoriented cube to
 *   feed to Kociemba. Returns no moves and the original cube if already home.
 */
export function reorientToHome(cubies, size) {
  const turns = reorientWholeTurns(cubies, size);
  if (!turns || turns.length === 0) return { moves: [], cubies };

  const AXIS_NOTATION = { row: 'y', col: 'x', depth: 'z' };
  let c = cubies;
  const moves = [];
  for (const [axis, dir] of turns) {
    const note = AXIS_NOTATION[axis] + (dir < 0 ? "'" : '');
    for (let s = 0; s < size; s++) {
      c = rotateSliceCubies(c, size, axis, s, dir);
      moves.push({ axis, dir, sliceIndex: s, numTurns: 1, notation: note, isReorient: true });
    }
  }
  return { moves, cubies: c };
}
