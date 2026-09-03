import { describe, it, expect } from 'vitest';
import { buildMoveTable, encodeBoard, flipsToFinish, solveCost, solveLine } from '../levels/parSolver.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksWin } from '../game/winDetection.js';
import { betaPairAnchors } from '../levels/antipodalLevelBridge.js';

const S = 3;
const table = buildMoveTable(S);
const turn = (c, axis, sliceIndex, dir) => rotateSliceCubies(c, S, axis, sliceIndex, dir);
const flip = (c, a) => flipStickerPair(c, S, a.x, a.y, a.z, a.dirKey, buildManifoldGridMap(c, S));
const anchors = betaPairAnchors(S);

const playLine = (board, line) => {
  let state = line.turns.reduce((st, m) => turn(st, m.axis, m.sliceIndex, m.dir), board);
  state = line.flips.reduce((st, a) => flip(st, a), state);
  return state;
};

describe('buildMoveTable', () => {
  it('derives one permutation per quarter turn, from the game’s own rotation', () => {
    expect(table.slots).toHaveLength(6 * S * S);
    expect(table.moves).toHaveLength(3 * S * 2);
    for (const perm of table.perms) {
      expect(new Set(perm).size, 'not a permutation — a sticker was lost or duplicated').toBe(perm.length);
    }
  });

  it('pairs every move with its inverse, and every sticker with its β-partner', () => {
    table.moves.forEach((m, i) => {
      const inv = table.moves[table.inverse[i]];
      expect({ ...inv, dir: -inv.dir }).toEqual(m);
    });
    table.partner.forEach((p, i) => {
      expect(table.partner[p], 'β-pairing is not symmetric').toBe(i);
      expect(p, 'a sticker was paired with itself').not.toBe(i);
    });
  });
});

describe('flipsToFinish', () => {
  it('is zero on a solved cube', () => {
    const { occupant, showing } = encodeBoard(makeCubies(S), S, table);
    expect(flipsToFinish(occupant, showing, table)).toBe(0);
  });

  it('counts one per flipped β-pair', () => {
    let c = makeCubies(S);
    for (const a of anchors.slice(0, 4)) c = flip(c, a);
    const { occupant, showing } = encodeBoard(c, S, table);
    expect(flipsToFinish(occupant, showing, table)).toBe(4);
  });

  it('refuses a board where a sticker is simply in the wrong place', () => {
    // A quarter turn sends stickers to ADJACENT faces, where neither their
    // colour nor its antipode is what the face wants. No flip can help.
    const { occupant, showing } = encodeBoard(turn(makeCubies(S), 'col', 0, 1), S, table);
    expect(flipsToFinish(occupant, showing, table)).toBeNull();
  });
});

describe('solveCost', () => {
  it('prices a pure flip board entirely in flips', () => {
    let c = makeCubies(S);
    for (const a of anchors.slice(0, 3)) c = flip(c, a);
    const line = solveLine(c, S, { maxMoves: 6, table });
    expect(line.cost).toBe(3);
    expect(line.turns).toHaveLength(0);
    expect(line.flips).toHaveLength(3);
  });

  it('prices a pure turn board entirely in turns', () => {
    expect(solveCost(makeCubies(S), S, { table })).toBe(0);
    expect(solveCost(turn(makeCubies(S), 'col', 0, 1), S, { table })).toBe(1);
  });

  it('takes the cheaper of turning back and flipping in place', () => {
    // A 180° leaves every displaced tile showing exactly the wrong colour, so
    // flips COULD finish it — but two turns undo it and six flips do not, and
    // the solver has to notice which is cheaper.
    const half = turn(turn(makeCubies(S), 'col', 0, 1), 'col', 0, 1);
    const line = solveLine(half, S, { maxMoves: 6, table });
    expect(line.cost).toBe(2);
    expect(line.turns).toHaveLength(2);
  });

  it('mixes both move types when the board needs both', () => {
    let c = turn(makeCubies(S), 'col', 0, 1);
    for (const a of anchors.slice(0, 2)) c = flip(c, a);
    const line = solveLine(c, S, { maxMoves: 6, table });
    expect(line.turns.length).toBeGreaterThan(0);
    expect(line.flips.length).toBeGreaterThan(0);
    expect(line.cost).toBe(line.turns.length + line.flips.length);
  });

  it('returns a proven optimum — nothing shorter solves the board', () => {
    let c = turn(turn(makeCubies(S), 'col', 0, 1), 'row', 2, -1);
    for (const a of anchors.slice(0, 2)) c = flip(c, a);
    const cost = solveCost(c, S, { maxMoves: 6, table });
    expect(cost).not.toBeNull();
    expect(solveCost(c, S, { maxMoves: cost - 1, table })).toBeNull();
  });

  it('reports null rather than guessing when the board is out of reach', () => {
    let deep = makeCubies(S);
    for (const m of [['col',0,1],['row',1,1],['depth',2,1],['col',2,-1],['row',0,-1]]) deep = turn(deep, m[0], m[1], m[2]);
    expect(solveCost(deep, S, { maxMoves: 2, table })).toBeNull();
  });
});

describe('solveLine', () => {
  it('returns a line that actually solves the board, and not before its last move', () => {
    let c = turn(makeCubies(S), 'depth', 1, -1);
    for (const a of anchors.slice(0, 3)) c = flip(c, a);
    const line = solveLine(c, S, { maxMoves: 6, table });

    expect(checkRubiksWin(playLine(c, line), S)).toBe(true);

    // Every prefix must fall short, or par overstates the cost.
    const steps = [...line.turns.map((m) => ['turn', m]), ...line.flips.map((a) => ['flip', a])];
    let state = c;
    steps.slice(0, -1).forEach(([kind, m]) => {
      state = kind === 'turn' ? turn(state, m.axis, m.sliceIndex, m.dir) : flip(state, m);
      expect(checkRubiksWin(state, S), 'solved before the last move').toBe(false);
    });
  });

  it('names flip anchors where the tile now STANDS, so the player can tap them', () => {
    // The anchors are consumed after the turns have run, so they must describe
    // post-turn positions. Replaying them on the pre-turn board would flip the
    // wrong tiles.
    let c = turn(makeCubies(S), 'col', 0, 1);
    for (const a of anchors.slice(0, 2)) c = flip(c, a);
    const line = solveLine(c, S, { maxMoves: 6, table });
    expect(line.flips.length).toBeGreaterThan(0);
    expect(checkRubiksWin(playLine(c, line), S)).toBe(true);
  });
});
