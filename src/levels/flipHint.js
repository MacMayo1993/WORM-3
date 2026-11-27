// src/levels/flipHint.js
// "Show me" for Flip Cube levels: the next step of the level's own solution, read
// from the board as it stands.
//
// Every level is authored as its solution run backwards: undo the scramble turns,
// make the middle half turns its bands call for, then flip the pairs that are
// left (flip-puzzles.js, `plan`). Flips never move a sticker, so where the
// stickers stand says which turn of that plan the player has reached, whatever
// they have flipped. On the plan, the hint is its next turn; at its end, a pair
// that still needs flipping. Off the plan, a short search finds the quickest way
// back onto it; past that it says so rather than guess.
import { buildMoveTable, encodeBoard } from './parSolver.js';
import { buildLevelStartState } from './levelStaging.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

/** How many quarter turns the way-back search tries before giving up. */
export const HINT_SEARCH_DEPTH = 3;

const planCache = new Map();

const moveIndex = (table, { axis, sliceIndex, dir }) =>
  table.moves.findIndex(m => m.axis === axis && m.sliceIndex === sliceIndex && m.dir === dir);

function permute(state, perm) {
  const next = new Int16Array(state.length);
  for (let i = 0; i < next.length; i++) next[i] = state[perm[i]];
  return next;
}

const keyOf = state => String.fromCharCode(...state);

/** The level's plan as move indices and the sticker positions before each move. */
export function flipPlanStates(level, size) {
  const cacheKey = `${level.id}:${size}`;
  const cached = planCache.get(cacheKey);
  if (cached) return cached;
  const table = buildMoveTable(size);
  const moves = (level.plan ?? []).map(move => moveIndex(table, move));
  if (moves.some(index => index < 0)) return null;
  const states = [encodeBoard(buildLevelStartState(level, size), size, table).occupant];
  for (const move of moves) states.push(permute(states[states.length - 1], table.perms[move]));
  const plan = { moves, states, keys: new Map(states.map((state, k) => [keyOf(state), k])) };
  planCache.set(cacheKey, plan);
  return plan;
}

// The fewest flips that finish a board whose stickers all stand on faces they can
// be flipped to fit: each face shows one colour or its antipode, the six faces
// six different colours, and a pair always flips together. Returns, by identity,
// which stickers still need their flip, or null when flips alone cannot finish.
function neededFlips(occupant, showing, table, cap, counts) {
  const classOf = c => Math.min(c, ANTIPODAL_COLOR[c]);
  const group = new Int8Array(7);
  for (let slot = 0; slot < occupant.length; slot++) {
    const face = table.wants[slot], c = classOf(showing[occupant[slot]]);
    if (group[face] && group[face] !== c) return null;
    group[face] = c;
  }
  let best = null, bestFlips = Infinity;
  const wanted = new Int8Array(7);
  const need = new Uint8Array(occupant.length);
  const tryAssign = (face, used) => {
    if (face === 7) {
      let flips = 0;
      for (let slot = 0; slot < occupant.length; slot++) {
        const id = occupant[slot];
        need[id] = Number(showing[id] !== wanted[table.wants[slot]]);
        if (need[id] && counts[id] >= cap) return;
      }
      for (let id = 0; id < need.length; id++) {
        if (need[id] !== need[table.partner[id]]) return;
        if (id < table.partner[id]) flips += need[id];
      }
      if (flips < bestFlips) { bestFlips = flips; best = need.slice(); }
      return;
    }
    for (const c of [group[face], ANTIPODAL_COLOR[group[face]]]) {
      if (used & (1 << c)) continue;
      wanted[face] = c;
      tryAssign(face + 1, used | (1 << c));
    }
  };
  tryAssign(1, 0);
  return best;
}

// Breadth-first over quarter turns from the board to any position on the plan.
function wayBack(start, plan, table) {
  const seen = new Set([keyOf(start)]);
  let frontier = [{ state: start, first: -1 }];
  for (let depth = 0; depth < HINT_SEARCH_DEPTH; depth++) {
    const next = [];
    for (const { state, first } of frontier) {
      for (let move = 0; move < table.moves.length; move++) {
        const after = permute(state, table.perms[move]);
        const key = keyOf(after);
        if (seen.has(key)) continue;
        seen.add(key);
        const lead = first < 0 ? move : first;
        if (plan.keys.has(key)) return lead;
        next.push({ state: after, first: lead });
      }
    }
    frontier = next;
  }
  return -1;
}

/**
 * The next step for `cubies` on `level`:
 *   { kind: 'turn', axis, sliceIndex, dir, back } — turn this layer this way
 *     (`back` when it leads back onto the plan rather than along it);
 *   { kind: 'pair', a, b } — flip this pair (each { x, y, z, dirKey });
 *   { kind: 'lost' } — too far from the plan to say;
 *   null — nothing left to do (or no plan for this level).
 */
export function flipHint(level, cubies, size, cap = 6) {
  if (!level?.plan || cubies?.length !== size) return null;
  const plan = flipPlanStates(level, size);
  if (!plan) return null;
  const table = buildMoveTable(size);
  const { occupant, showing } = encodeBoard(cubies, size, table);
  const reached = plan.keys.get(keyOf(occupant));
  if (reached === undefined) {
    const move = wayBack(occupant, plan, table);
    return move < 0 ? { kind: 'lost' } : { kind: 'turn', ...table.moves[move], back: true };
  }
  if (reached < plan.moves.length) return { kind: 'turn', ...table.moves[plan.moves[reached]], back: false };
  const counts = new Uint8Array(occupant.length);
  table.slots.forEach(({ x, y, z, dirKey }, slot) => { counts[occupant[slot]] = cubies[x][y][z].stickers[dirKey].flips ?? 0; });
  const need = neededFlips(occupant, showing, table, cap, counts);
  if (!need) return { kind: 'lost' };
  const slotOf = new Int16Array(occupant.length);
  occupant.forEach((id, slot) => { slotOf[id] = slot; });
  for (let id = 0; id < need.length; id++) {
    if (!need[id]) continue;
    const a = table.slots[slotOf[id]], b = table.slots[slotOf[table.partner[id]]];
    return { kind: 'pair', a: { ...a }, b: { ...b } };
  }
  return null;
}

// What the lit guide on the cube means, in one line.
export function hintLine(step) {
  if (!step) return 'Nothing left to do.';
  if (step.kind === 'pair') return 'Flip the ringed pair. They change together.';
  if (step.kind === 'lost') return 'That is off the plan. Undo, or Reset to see it again.';
  return step.back ? 'Off the plan: turn the glowing layer to get back.' : 'Turn the glowing layer the way its light runs.';
}
