import { describe, it, expect } from 'vitest';
import { buildMoveTable, encodeQuotientState, isQuotientSolved, quotientMismatch, quotientPar, quotientSolution } from '../levels/quotientSolver.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksSolvedAntipodal } from '../game/winDetection.js';
import { betaPairAnchors } from '../levels/antipodalLevelBridge.js';

const S = 3;
const table = buildMoveTable(S);
const turn = (c, axis, sliceIndex, dir) => rotateSliceCubies(c, S, axis, sliceIndex, dir);
const play = (c, moves) => moves.reduce((st, m) => turn(st, m.axis, m.sliceIndex, m.dir), c);

describe('buildMoveTable', () => {
  it('derives one permutation per quarter turn, from the game’s own rotation', () => {
    expect(table.slots).toHaveLength(6 * S * S);
    expect(table.moves).toHaveLength(3 * S * 2);
    for (const perm of table.perms) {
      expect(perm).toHaveLength(table.slots.length);
      expect(new Set(perm).size, 'not a permutation — a sticker was lost or duplicated').toBe(perm.length);
    }
  });

  it('pairs every move with its inverse', () => {
    table.moves.forEach((m, i) => {
      const inv = table.moves[table.inverse[i]];
      expect(inv.axis).toBe(m.axis);
      expect(inv.sliceIndex).toBe(m.sliceIndex);
      expect(inv.dir).toBe(-m.dir);
    });
  });
});

describe('the quotient goal', () => {
  it('agrees with the live win detector', () => {
    // The solver searches for a state the game will actually accept. If these
    // two notions of solved ever drift, par is measured against a board that
    // does not win.
    const boards = [
      makeCubies(S),
      turn(makeCubies(S), 'col', 0, 1),
      play(makeCubies(S), [{ axis: 'col', sliceIndex: 0, dir: 1 }, { axis: 'col', sliceIndex: 0, dir: 1 }]),
      play(makeCubies(S), [{ axis: 'row', sliceIndex: 2, dir: -1 }, { axis: 'depth', sliceIndex: 1, dir: 1 }])
    ];
    for (const board of boards) {
      expect(isQuotientSolved(encodeQuotientState(board, S, table), table)).toBe(checkRubiksSolvedAntipodal(board, S));
    }
  });

  it('counts a 180° turn as already solved, at zero cost', () => {
    // Every tile lands on its antipodal face, which is the same manifold. This
    // is the defining property of the mode, not an edge case.
    const half = play(makeCubies(S), [{ axis: 'col', sliceIndex: 0, dir: 1 }, { axis: 'col', sliceIndex: 0, dir: 1 }]);
    expect(quotientPar(half, S, { table })).toBe(0);
    expect(quotientSolution(half, S, { table })).toEqual([]);
  });

  it('is blind to flips, because a flip cannot leave a colour class', () => {
    let flipped = makeCubies(S);
    for (const a of betaPairAnchors(S).slice(0, 5)) {
      flipped = flipStickerPair(flipped, S, a.x, a.y, a.z, a.dirKey, buildManifoldGridMap(flipped, S));
    }
    expect(quotientMismatch(encodeQuotientState(flipped, S, table), table)).toBe(0);
    expect(quotientPar(flipped, S, { table })).toBe(0);

    // And a flip does not change the cost of a board that DOES need turns.
    const turned = turn(makeCubies(S), 'col', 0, 1);
    let turnedAndFlipped = turned;
    for (const a of betaPairAnchors(S).slice(0, 5)) {
      turnedAndFlipped = flipStickerPair(turnedAndFlipped, S, a.x, a.y, a.z, a.dirKey, buildManifoldGridMap(turnedAndFlipped, S));
    }
    expect(quotientPar(turnedAndFlipped, S, { table })).toBe(quotientPar(turned, S, { table }));
  });
});

describe('quotientPar', () => {
  it('is zero on a solved cube and one after a single quarter turn', () => {
    expect(quotientPar(makeCubies(S), S, { table })).toBe(0);
    expect(quotientPar(turn(makeCubies(S), 'col', 0, 1), S, { table })).toBe(1);
  });

  it('returns a proven optimum — no shorter sequence solves the board', () => {
    // The guarantee the daily's scoring rests on. Exhaustively confirm that no
    // sequence below the reported par reaches a solved state.
    const scrambles = [
      [{ axis: 'col', sliceIndex: 0, dir: 1 }, { axis: 'row', sliceIndex: 2, dir: 1 }],
      [{ axis: 'depth', sliceIndex: 1, dir: -1 }, { axis: 'col', sliceIndex: 2, dir: 1 }, { axis: 'row', sliceIndex: 0, dir: 1 }]
    ];
    for (const scramble of scrambles) {
      const board = play(makeCubies(S), scramble);
      const par = quotientPar(board, S, { maxDepth: 5, table });
      expect(par).not.toBeNull();
      if (par > 0) expect(quotientPar(board, S, { maxDepth: par - 1, table })).toBeNull();
    }
  });

  it('never exceeds the scramble that produced the board', () => {
    const board = play(makeCubies(S), [
      { axis: 'col', sliceIndex: 0, dir: 1 },
      { axis: 'row', sliceIndex: 2, dir: 1 },
      { axis: 'depth', sliceIndex: 1, dir: -1 }
    ]);
    expect(quotientPar(board, S, { maxDepth: 5, table })).toBeLessThanOrEqual(3);
  });

  it('reports null rather than guessing when the board is out of reach', () => {
    const deep = play(makeCubies(S), [
      { axis: 'col', sliceIndex: 0, dir: 1 }, { axis: 'row', sliceIndex: 1, dir: 1 },
      { axis: 'depth', sliceIndex: 2, dir: 1 }, { axis: 'col', sliceIndex: 2, dir: -1 },
      { axis: 'row', sliceIndex: 0, dir: -1 }, { axis: 'depth', sliceIndex: 0, dir: 1 }
    ]);
    expect(quotientPar(deep, S, { maxDepth: 1, table })).toBeNull();
  });
});

describe('quotientSolution', () => {
  it('returns a line of exactly par length that actually solves the board', () => {
    const board = play(makeCubies(S), [
      { axis: 'col', sliceIndex: 0, dir: 1 },
      { axis: 'row', sliceIndex: 2, dir: 1 },
      { axis: 'depth', sliceIndex: 1, dir: -1 }
    ]);
    const par = quotientPar(board, S, { maxDepth: 5, table });
    const solution = quotientSolution(board, S, { maxDepth: 5, table });
    expect(solution).toHaveLength(par);
    expect(checkRubiksSolvedAntipodal(play(board, solution), S)).toBe(true);
  });

  it('does not solve early — every move in the line is needed', () => {
    const board = play(makeCubies(S), [
      { axis: 'col', sliceIndex: 0, dir: 1 },
      { axis: 'row', sliceIndex: 2, dir: 1 },
      { axis: 'depth', sliceIndex: 1, dir: -1 }
    ]);
    const solution = quotientSolution(board, S, { maxDepth: 5, table });
    let state = board;
    solution.slice(0, -1).forEach((m) => {
      state = turn(state, m.axis, m.sliceIndex, m.dir);
      expect(checkRubiksSolvedAntipodal(state, S), 'solved before the last move — par overstates the cost').toBe(false);
    });
  });
});
