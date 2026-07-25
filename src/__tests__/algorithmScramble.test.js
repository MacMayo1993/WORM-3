// The authoring contract for algorithm levels: a level scrambled by the inverse
// of an algorithm must be solved by performing that algorithm. If this breaks,
// every algorithm level silently becomes unsolvable-as-taught, so it is checked
// against the real rotation engine rather than by inspection.

import { describe, it, expect } from 'vitest';
import {
  invertToken, invertAlgorithm, notationToQuarterTurns,
  algorithmToScramble, quarterTurnCount,
} from '../levels/algorithmScramble.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { checkRubiksSolved } from '../game/winDetection.js';

const apply = (state, entries, size = 3) =>
  entries.reduce((s, { axis, sliceIndex, dir }) => rotateSliceCubies(s, size, axis, sliceIndex, dir), state);

describe('invertToken', () => {
  it('flips a quarter turn and leaves a double alone', () => {
    expect(invertToken('R')).toBe("R'");
    expect(invertToken("R'")).toBe('R');
    expect(invertToken('U2')).toBe('U2');
    expect(invertToken('M')).toBe("M'");
  });
});

describe('invertAlgorithm', () => {
  it('reverses the order and inverts each move', () => {
    expect(invertAlgorithm("R U R' U'")).toBe("U R U' R'");
    expect(invertAlgorithm('R U2 R')).toBe("R' U2 R'");
  });
});

describe('notationToQuarterTurns', () => {
  it('emits one entry per quarter turn so par matches what the player pays', () => {
    expect(notationToQuarterTurns('R').length).toBe(1);
    expect(notationToQuarterTurns('R2').length).toBe(2);
    expect(notationToQuarterTurns("R U2 R'").length).toBe(4);
  });

  it('throws on an unsupported move rather than dropping it', () => {
    // Wide moves and cube rotations are not in the engine's notation map; a
    // silent drop would leave a level whose algorithm no longer solves it.
    expect(() => notationToQuarterTurns('r U')).toThrow(/unsupported move/);
    expect(() => notationToQuarterTurns('y')).toThrow(/unsupported move/);
  });
});

describe('quarterTurnCount', () => {
  it('counts doubles as two', () => {
    expect(quarterTurnCount("R U R' U'")).toBe(4);
    expect(quarterTurnCount("R U R' U R U2 R'")).toBe(8);
    expect(quarterTurnCount('M2 U M U2 M\' U M2')).toBe(10);
  });
});

describe('scramble ∘ algorithm = solved', () => {
  // Every algorithm shipped in the Algorithm Codex pack.
  const ALGORITHMS = {
    'Sexy Move':    "R U R' U'",
    'Sledgehammer': "R' F R F'",
    'F2L Insert':   "U R U' R'",
    'Sune':         "R U R' U R U2 R'",
    'Anti-Sune':    "R U2 R' U' R U' R'",
    'Niklas':       "R U' L' U R' U' L",
    'U-Perm (Ua)':  "M2 U M U2 M' U M2",
    'T-Perm':       "R U R' U' R' F R2 U' R' U' R U R' F'",
    'J-Perm (Jb)':  "R U R' F' R U R' U' R' F R2 U' R'",
    'Superflip':    "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
  };

  for (const [name, notation] of Object.entries(ALGORITHMS)) {
    it(`${name} solves its own inverse scramble`, () => {
      const scrambled = apply(makeCubies(3), algorithmToScramble(notation));
      // The scramble must actually disturb the cube — an algorithm that is a
      // no-op on a solved cube would give a level that starts already won.
      expect(checkRubiksSolved(scrambled, 3)).toBe(false);
      const solved = apply(scrambled, notationToQuarterTurns(notation));
      expect(checkRubiksSolved(solved, 3)).toBe(true);
    });

    it(`${name} par equals its quarter-turn count`, () => {
      expect(algorithmToScramble(notation).length).toBe(quarterTurnCount(notation));
    });
  }
});

describe('Superflip', () => {
  // Superflip flips all twelve edges in place, so the permutation is an
  // involution: performing it twice returns to solved. That is a sharp
  // signature — a sequence that merely looks similar fails it — which is how
  // this asserts the finale really is superflip and not just a long scramble.
  const SUPERFLIP = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2";

  it('is a genuine involution: twice from solved returns to solved', () => {
    const q = notationToQuarterTurns(SUPERFLIP);
    const once = apply(makeCubies(3), q);
    expect(checkRubiksSolved(once, 3)).toBe(false);
    expect(checkRubiksSolved(apply(once, q), 3)).toBe(true);
  });

  it('is 20 moves in HTM and 28 quarter turns', () => {
    expect(SUPERFLIP.trim().split(/\s+/).length).toBe(20);
    expect(quarterTurnCount(SUPERFLIP)).toBe(28);
  });
});
