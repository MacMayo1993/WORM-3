// quotientSolver.js — the exact cost of solving a cube in the RP² quotient.
//
// WORM-3 identifies antipodal colours: red IS orange, green IS blue, white IS
// yellow, because opposite faces are the same point of the real projective
// plane. A cube is therefore solved when every sticker shows the colour CLASS
// its face belongs to — not necessarily the literal home colour. Two things
// follow, and they are why this module exists rather than a stock cube solver:
//
//   · A tile sitting on its ANTIPODAL face is already home. One 180° turn
//     leaves the cube solved, at zero cost.
//   · A flip can never change a colour class, so flips cannot help (or hurt) a
//     solve. They are accepted, never required — which is exactly the rule the
//     mode wants. The optimal solution is therefore a sequence of TURNS, and
//     that is all this searches over.
//
// Par is measured in quarter turns, the same unit the game's move counter uses,
// so a level's par and a player's move count are the same currency. 180° turns
// are two moves here because they are two moves there.
//
// Everything is derived from the game's own rotateSliceCubies rather than a
// re-implementation, so the solver cannot drift from the cube the player turns.

import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { colorClass } from '../game/winDetection.js';

const AXES = ['row', 'col', 'depth'];
const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

// Move tables are derived once per cube size and reused. Building one applies
// every move to a tagged cube, which is far too costly to repeat per search.
const _tableCache = new Map();

/**
 * The slot list, move list and permutation table for a cube size.
 *
 * A "slot" is one exterior sticker position — a (cubie, face) pair — numbered
 * 0..(6·size²−1). A move is stored as the permutation it induces on slots:
 * `perm[i]` is the slot whose contents land in slot `i`, so applying a move is
 * a gather, `next[i] = state[perm[i]]`.
 */
export function buildMoveTable(size) {
  const cached = _tableCache.get(size);
  if (cached) return cached;

  const solved = makeCubies(size);
  const slots = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        for (const dirKey of Object.keys(solved[x][y][z].stickers)) slots.push({ x, y, z, dirKey });
      }
    }
  }
  const index = new Map(slots.map((s, i) => [`${s.x},${s.y},${s.z},${s.dirKey}`, i]));

  // The class each slot must show to count as solved.
  const home = Int8Array.from(slots, (s) => colorClass(DIR_TO_FACE[s.dirKey]));

  const moves = [];
  const perms = [];
  for (const axis of AXES) {
    for (let sliceIndex = 0; sliceIndex < size; sliceIndex++) {
      for (const dir of [1, -1]) {
        // Tag every sticker with its slot number, turn, then read where the
        // tags landed. Rotation carries sticker objects intact, so the tag
        // survives the move and reports the permutation exactly.
        const tagged = makeCubies(size);
        slots.forEach((s, i) => {
          tagged[s.x][s.y][s.z].stickers[s.dirKey]._slot = i;
        });
        const after = rotateSliceCubies(tagged, size, axis, sliceIndex, dir);
        const perm = new Int16Array(slots.length);
        slots.forEach((s, i) => {
          perm[i] = after[s.x][s.y][s.z].stickers[s.dirKey]._slot;
        });
        moves.push({ axis, sliceIndex, dir });
        perms.push(perm);
      }
    }
  }

  // Which move is which one's inverse, and which moves act on the same slice —
  // both needed to prune the search without discarding optimal solutions.
  const inverse = moves.map((m) => moves.findIndex((n) => n.axis === m.axis && n.sliceIndex === m.sliceIndex && n.dir === -m.dir));
  const sliceOf = moves.map((m) => `${m.axis}:${m.sliceIndex}`);

  const table = { size, slots, index, home, moves, perms, inverse, sliceOf };
  _tableCache.set(size, table);
  return table;
}

/** The colour class showing in every slot, as a flat array. */
export function encodeQuotientState(cubies, size, table = buildMoveTable(size)) {
  const state = new Int8Array(table.slots.length);
  for (let i = 0; i < table.slots.length; i++) {
    const { x, y, z, dirKey } = table.slots[i];
    state[i] = colorClass(cubies[x][y][z].stickers[dirKey].curr);
  }
  return state;
}

/** Does every slot show its face's class? */
export function isQuotientSolved(state, table) {
  const { home } = table;
  for (let i = 0; i < state.length; i++) if (state[i] !== home[i]) return false;
  return true;
}

/** Slots not yet showing their face's class — the search's progress measure. */
export function quotientMismatch(state, table) {
  const { home } = table;
  let n = 0;
  for (let i = 0; i < state.length; i++) if (state[i] !== home[i]) n++;
  return n;
}

/**
 * The exact minimum number of quarter turns that solves `cubies` in the
 * quotient, or `null` if no solution exists within `maxDepth`.
 *
 * Iterative deepening, so the first depth that succeeds IS the minimum — this
 * returns a proven optimum, never an upper bound, which is the whole point of
 * scoring a player against it.
 *
 * Pruning discards only sequences that a shorter one already covers: a move
 * immediately followed by its inverse, and a third consecutive turn of one
 * slice (three quarter turns one way is one quarter turn the other). Two in a
 * row stay legal — that is a 180°, and it costs two moves here because it costs
 * the player two moves.
 */
export function quotientPar(cubies, size, { maxDepth = 6, table = buildMoveTable(size) } = {}) {
  const start = encodeQuotientState(cubies, size, table);
  if (isQuotientSolved(start, table)) return 0;

  const { perms, inverse, sliceOf } = table;
  const n = start.length;
  const moveCount = perms.length;

  // One scratch buffer per level, allocated once for the whole search.
  const levels = Array.from({ length: maxDepth + 1 }, () => new Int8Array(n));
  levels[0].set(start);

  const search = (depth, limit, prevMove, sameSliceRun) => {
    const state = levels[depth];
    if (depth === limit) return isQuotientSolved(state, table);
    for (let m = 0; m < moveCount; m++) {
      if (prevMove >= 0) {
        if (m === inverse[prevMove]) continue;                       // undoes the last move
        if (m === prevMove && sameSliceRun >= 2) continue;            // a third identical turn
        if (sliceOf[m] === sliceOf[prevMove] && m !== prevMove) continue; // same slice, other dir
      }
      const perm = perms[m];
      const next = levels[depth + 1];
      for (let i = 0; i < n; i++) next[i] = state[perm[i]];
      const run = m === prevMove ? sameSliceRun + 1 : 1;
      if (search(depth + 1, limit, m, run)) return true;
    }
    return false;
  };

  for (let limit = 1; limit <= maxDepth; limit++) {
    if (search(0, limit, -1, 0)) return limit;
  }
  return null;
}

/**
 * An optimal solution as a move list, or `null` if none exists within
 * `maxDepth`. Same search as `quotientPar`, keeping the path — so its length is
 * the exact par, and replaying it on the staged cube reaches a solved board and
 * does so no sooner than the last move.
 */
export function quotientSolution(cubies, size, { maxDepth = 6, table = buildMoveTable(size) } = {}) {
  const start = encodeQuotientState(cubies, size, table);
  if (isQuotientSolved(start, table)) return [];

  const { perms, inverse, sliceOf, moves } = table;
  const n = start.length;
  const levels = Array.from({ length: maxDepth + 1 }, () => new Int8Array(n));
  levels[0].set(start);
  const path = [];

  const search = (depth, limit, prevMove, sameSliceRun) => {
    const state = levels[depth];
    if (depth === limit) return isQuotientSolved(state, table);
    for (let m = 0; m < perms.length; m++) {
      if (prevMove >= 0) {
        if (m === inverse[prevMove]) continue;
        if (m === prevMove && sameSliceRun >= 2) continue;
        if (sliceOf[m] === sliceOf[prevMove] && m !== prevMove) continue;
      }
      const perm = perms[m];
      const next = levels[depth + 1];
      for (let i = 0; i < n; i++) next[i] = state[perm[i]];
      path.push(m);
      if (search(depth + 1, limit, m, m === prevMove ? sameSliceRun + 1 : 1)) return true;
      path.pop();
    }
    return false;
  };

  for (let limit = 1; limit <= maxDepth; limit++) {
    path.length = 0;
    if (search(0, limit, -1, 0)) return path.map((m) => ({ ...moves[m] }));
  }
  return null;
}
