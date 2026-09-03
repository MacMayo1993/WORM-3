// parSolver.js — the exact cost of solving a cube that can be TURNED or FLIPPED.
//
// A cube is solved when every sticker shows the colour its face wants. That is
// the ordinary check (winDetection.checkRubiksSolved) and nothing here changes
// it: what counts is the colour showing, whether the tile is flipped or not.
//
// What the flip adds is a second way to fix a tile. A sticker that has travelled
// to its ANTIPODAL face is showing exactly the wrong colour — red on the orange
// face — and one tap recolours it to its antipode, which is the colour that face
// wants. The tile is then correct where it stands, with no turn needed. So a
// solution is a mix of two move types, and par has to price both:
//
//     par = min over turn sequences T of ( |T| + flips needed to finish )
//
// Both cost one move in the game (useCubeState charges a move for a rotation and
// for a flip alike), so they are the same currency and the sum is meaningful.
//
// ── Why flips need no search ─────────────────────────────────────────────────
// A β-pair is a pair of sticker IDENTITIES, not positions: flipStickerPair finds
// its partner through the manifold grid id, which is built from origDir/origPos
// and therefore rides along as turns move the sticker. So the SET of flipped
// identities is all that matters and never depends on when the flips happened —
// every solution can be rewritten with its flips last, at the same cost. The
// search only has to enumerate turn sequences, and at each node ask how many
// flips would finish the job, which is an O(stickers) count rather than another
// branching dimension.
//
// A flip moves both members of its β-pair, so a pair whose two stickers disagree
// about whether they want flipping cannot be finished by flips at all; that node
// is simply not a solution and the search moves on.
//
// Move permutations are derived from the game's own rotateSliceCubies, so the
// solver cannot drift from the cube the player turns.

import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { enumerateBetaPairs } from '../game/antipodalEngine.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

const AXES = ['row', 'col', 'depth'];
const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

const _tableCache = new Map();

/**
 * Slots, moves, permutations and β-pairing for a cube size.
 *
 * A "slot" is one exterior sticker position — a (cubie, face) pair. A move is
 * stored as the permutation it induces on slots, so applying it is a gather:
 * `next[i] = state[perm[i]]`.
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
  const slotIndex = new Map(slots.map((s, i) => [`${s.x},${s.y},${s.z},${s.dirKey}`, i]));

  // The colour each slot's face wants, and its antipode — the only two colours a
  // sticker standing there can legally show.
  const wants = Int8Array.from(slots, (s) => DIR_TO_FACE[s.dirKey]);
  const wantsFlipped = Int8Array.from(wants, (c) => ANTIPODAL_COLOR[c]);

  // On a solved cube identity === slot, so β-pairs enumerated there give the
  // permanent identity pairing. `partner[i]` is the identity flipped alongside i.
  const partner = Int16Array.from({ length: slots.length }, (_, i) => i);
  for (const pair of enumerateBetaPairs(solved, size)) {
    if (!pair.b) continue;
    const a = slotIndex.get(`${pair.a.x},${pair.a.y},${pair.a.z},${pair.a.dir}`);
    const b = slotIndex.get(`${pair.b.x},${pair.b.y},${pair.b.z},${pair.b.dir}`);
    partner[a] = b;
    partner[b] = a;
  }

  const moves = [];
  const perms = [];
  for (const axis of AXES) {
    for (let sliceIndex = 0; sliceIndex < size; sliceIndex++) {
      for (const dir of [1, -1]) {
        // Tag every sticker with its slot number, turn, then read where the tags
        // landed — the permutation, straight from the real rotation.
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

  const inverse = moves.map((m) => moves.findIndex((n) => n.axis === m.axis && n.sliceIndex === m.sliceIndex && n.dir === -m.dir));
  const sliceOf = moves.map((m) => `${m.axis}:${m.sliceIndex}`);

  const table = { size, slots, slotIndex, wants, wantsFlipped, partner, moves, perms, inverse, sliceOf };
  _tableCache.set(size, table);
  return table;
}

/**
 * Two parallel arrays describing the board: which identity stands in each slot,
 * and the colour each identity currently shows. Turns permute the first; the
 * second is fixed, because flips are deferred to the end of the solution.
 */
export function encodeBoard(cubies, size, table = buildMoveTable(size)) {
  const { slots, slotIndex } = table;
  const occupant = new Int16Array(slots.length);
  const showing = new Int8Array(slots.length);
  for (let i = 0; i < slots.length; i++) {
    const { x, y, z, dirKey } = slots[i];
    const st = cubies[x][y][z].stickers[dirKey];
    const identity = slotIndex.get(`${st.origPos.x},${st.origPos.y},${st.origPos.z},${st.origDir}`);
    occupant[i] = identity;
    showing[identity] = st.curr;
  }
  return { occupant, showing };
}

/**
 * How many flips finish this arrangement, or `null` if flips cannot.
 *
 * A sticker showing its face's colour is done. One showing that colour's
 * antipode wants a flip. One showing anything else is in the wrong place and no
 * flip will help. A β-pair moves as a unit, so its two members must agree.
 */
export function flipsToFinish(occupant, showing, table) {
  const { wants, wantsFlipped, partner } = table;
  const need = new Int8Array(occupant.length); // by identity
  for (let slot = 0; slot < occupant.length; slot++) {
    const identity = occupant[slot];
    const colour = showing[identity];
    if (colour === wants[slot]) need[identity] = 0;
    else if (colour === wantsFlipped[slot]) need[identity] = 1;
    else return null; // wrong place entirely
  }
  let flips = 0;
  for (let i = 0; i < need.length; i++) {
    const j = partner[i];
    if (need[i] !== need[j]) return null; // the pair cannot agree
    if (need[i] === 1 && i < j) flips++;  // count each pair once
  }
  return flips;
}

/**
 * The exact minimum number of moves — turns and flips together — that solves
 * `cubies`, or `null` if no solution exists within `maxMoves`.
 *
 * Iterative deepening over turn count, pricing the flip finish at every node.
 * The search stops as soon as no deeper turn sequence could beat what it has:
 * a solution using `d` turns costs at least `d`, so once the best found is no
 * more than the next depth, that best is proven optimal.
 */
export function solveCost(cubies, size, { maxMoves = 6, table = buildMoveTable(size) } = {}) {
  const found = solveLine(cubies, size, { maxMoves, table });
  return found === null ? null : found.cost;
}

/**
 * The same search, keeping the winning line: `{ cost, turns, flips }` where
 * `turns` is a move list and `flips` a list of β-pair anchors to tap afterwards.
 * `cost === turns.length + flips.length`.
 */
export function solveLine(cubies, size, { maxMoves = 6, table = buildMoveTable(size) } = {}) {
  const { perms, inverse, sliceOf, moves, partner, slots } = table;
  const { occupant, showing } = encodeBoard(cubies, size, table);
  const n = occupant.length;

  let best = null;
  const consider = (state, depth, path) => {
    const flips = flipsToFinish(state, showing, table);
    if (flips === null) return;
    const cost = depth + flips;
    // `maxMoves` caps the TOTAL, turns and flips together. Capping only the turn
    // depth would let a shallow-turn, many-flip line through and report a cost
    // above what the caller asked for — which for the daily means a par outside
    // its own published band.
    if (cost > maxMoves) return;
    if (best !== null && cost >= best.cost) return;
    best = { cost, turnIndices: path.slice(), state: Int16Array.from(state) };
  };

  const levels = Array.from({ length: maxMoves + 1 }, () => new Int16Array(n));
  levels[0].set(occupant);
  const path = [];

  const search = (depth, limit, prevMove, sameSliceRun) => {
    const state = levels[depth];
    consider(state, depth, path);
    if (depth === limit) return;
    // A turn cannot pay for itself if the depth alone already matches the best.
    if (best !== null && depth + 1 >= best.cost) return;
    for (let m = 0; m < perms.length; m++) {
      if (prevMove >= 0) {
        if (m === inverse[prevMove]) continue;                            // undoes the last move
        if (m === prevMove && sameSliceRun >= 2) continue;                 // a third identical turn
        if (sliceOf[m] === sliceOf[prevMove] && m !== prevMove) continue;  // same slice, other dir
      }
      const perm = perms[m];
      const next = levels[depth + 1];
      for (let i = 0; i < n; i++) next[i] = state[perm[i]];
      path.push(m);
      search(depth + 1, limit, m, m === prevMove ? sameSliceRun + 1 : 1);
      path.pop();
    }
  };

  for (let limit = 0; limit <= maxMoves; limit++) {
    search(0, limit, -1, 0);
    // Any solution deeper than this costs more than limit + 1 turns alone.
    if (best !== null && best.cost <= limit + 1) break;
  }
  if (best === null) return null;

  // Turn the winning arrangement's outstanding flips into tappable anchors.
  const need = new Int8Array(n);
  for (let slot = 0; slot < n; slot++) {
    const identity = best.state[slot];
    need[identity] = showing[identity] === table.wants[slot] ? 0 : 1;
  }
  const flipAnchors = [];
  for (let identity = 0; identity < n; identity++) {
    if (need[identity] === 1 && identity < partner[identity]) {
      // Report where that identity now STANDS, which is where the player taps.
      const slot = best.state.indexOf(identity);
      const { x, y, z, dirKey } = slots[slot];
      flipAnchors.push({ x, y, z, dirKey });
    }
  }
  return {
    cost: best.cost,
    turns: best.turnIndices.map((m) => ({ ...moves[m] })),
    flips: flipAnchors
  };
}
