// Offline authoring check. Free turns have no cost lower bound, so depth-limited
// search can find a cheaper target, but cannot certify a global minimum.
import { buildMoveTable, encodeBoard } from './parSolver.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

export function searchFlipTarget(board, size, maxDepth = 4, cap = 6) {
  const table = buildMoveTable(size);
  const { showing, occupant } = encodeBoard(board, size, table);
  const counts = new Uint8Array(showing.length);
  table.slots.forEach(({ x, y, z, dirKey }, i) => { counts[occupant[i]] = board[x][y][z].stickers[dirKey].flips; });
  let best = Infinity;
  const colourClass = c => Math.min(c, ANTIPODAL_COLOR[c]);
  const faces = new Uint8Array(7), wanted = new Uint8Array(7);
  const needed = new Uint8Array(showing.length);
  function finish(state) {
    faces.fill(0);
    for (let i = 0; i < state.length; i++) {
      const face = table.wants[i], group = colourClass(showing[state[i]]);
      if (faces[face] && faces[face] !== group) return;
      faces[face] = group;
    }
    // Assign one of the two compatible colours per face, with no repeats.
    function assign(face, used) {
      if (face < 7) {
        for (const c of [faces[face], ANTIPODAL_COLOR[faces[face]]]) {
          if (used & (1 << c)) continue;
          wanted[face] = c;
          assign(face + 1, used | (1 << c));
        }
        return;
      }
      let flips = 0;
      for (let i = 0; i < state.length; i++) {
        const id = state[i];
        needed[id] = Number(showing[id] !== wanted[table.wants[i]]);
        if (needed[id] && counts[id] >= cap) return;
      }
      for (let i = 0; i < needed.length; i++) {
        if (needed[i] !== needed[table.partner[i]]) return;
        if (i < table.partner[i]) flips += needed[i];
      }
      best = Math.min(best, flips);
    }
    assign(1, 0);
  }
  const visited = new Map();
  const buffers = Array.from({ length: maxDepth }, () => new Int16Array(occupant.length));
  function search(state, depth, lastMove) {
    const key = String.fromCharCode(...state);
    if ((visited.get(key) ?? Infinity) <= depth) return;
    visited.set(key, depth);
    finish(state);
    if (depth === maxDepth || best === 0) return;
    for (let move = 0; move < table.moves.length; move++) {
      if (table.inverse[move] === lastMove) continue;
      const next = buffers[depth], perm = table.perms[move];
      for (let i = 0; i < next.length; i++) next[i] = state[perm[i]];
      search(next, depth + 1, move);
      if (best === 0) break;
    }
  }
  search(occupant, 0, -1);
  return Number.isFinite(best) ? best : null;
}
