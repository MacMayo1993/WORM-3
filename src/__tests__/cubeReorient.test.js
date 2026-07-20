import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { centersAtHome, reorientToHome } from '../game/cubeReorient.js';

// Rotate the whole cube one quarter turn about an axis (all three slices).
const wholeCubeTurn = (c, axis, dir) => {
  let o = c;
  for (let s = 0; s < 3; s++) o = rotateSliceCubies(o, 3, axis, s, dir);
  return o;
};
const applyMoves = (c, moves) =>
  moves.reduce((acc, m) => {
    let x = acc;
    for (let i = 0; i < (m.numTurns ?? 1); i++) x = rotateSliceCubies(x, 3, m.axis, m.sliceIndex, m.dir);
    return x;
  }, c);

describe('cubeReorient', () => {
  it('solved cube: centres home, no reorientation needed', () => {
    const c = makeCubies(3);
    expect(centersAtHome(c, 3)).toBe(true);
    expect(reorientToHome(c, 3).moves).toEqual([]);
  });

  it('a middle-slice (E) turn moves the side centres off home', () => {
    const c = rotateSliceCubies(makeCubies(3), 3, 'row', 1, 1);
    expect(centersAtHome(c, 3)).toBe(false);
  });

  it('reorientToHome brings the centres home', () => {
    const c = rotateSliceCubies(makeCubies(3), 3, 'depth', 1, -1); // S-ish slice
    expect(centersAtHome(c, 3)).toBe(false);
    const { cubies } = reorientToHome(c, 3);
    expect(centersAtHome(cubies, 3)).toBe(true);
  });

  it('the returned moves reproduce the returned (centre-home) cube', () => {
    let c = rotateSliceCubies(makeCubies(3), 3, 'row', 1, 1);
    c = rotateSliceCubies(c, 3, 'col', 1, -1);
    const { moves, cubies } = reorientToHome(c, 3);
    const applied = applyMoves(c, moves);
    expect(centersAtHome(applied, 3)).toBe(true);
    expect(centersAtHome(cubies, 3)).toBe(true);
  });

  it('a whole-cube-reorientation scramble is fully solved by reorientation alone', () => {
    // Pure whole-cube turns keep the cube "solved up to reorientation".
    let c = makeCubies(3);
    c = wholeCubeTurn(c, 'row', 1);
    c = wholeCubeTurn(c, 'col', -1);
    c = wholeCubeTurn(c, 'depth', 1);
    expect(checkRubiksSolved(c, 3)).toBe(false); // reoriented ⇒ not home-solved
    const { cubies } = reorientToHome(c, 3);
    expect(checkRubiksSolved(cubies, 3)).toBe(true); // homing the centres restores the solve
  });

  it('handles the reported 180° antipodal-centre-swap', () => {
    // y2 (two whole-cube turns about the vertical axis) swaps each side centre
    // with its antipode — exactly the screenshot: top/bottom fine, four sides
    // showing their antipodal pair.
    let c = makeCubies(3);
    c = wholeCubeTurn(c, 'row', 1);
    c = wholeCubeTurn(c, 'row', 1);
    const fCentre = c[1][1][2].stickers.PZ.curr; // F centre (home = Red 1)
    expect(fCentre).toBe(ANTIPODAL_COLOR[1]); // shows Orange, Red's antipode
    expect(checkRubiksSolved(c, 3)).toBe(false);
    const { cubies } = reorientToHome(c, 3);
    expect(checkRubiksSolved(cubies, 3)).toBe(true);
  });
});
