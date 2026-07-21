import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { checkRubiksSolved, checkRubiksSolvedAntipodal, allStickersFlipped } from '../game/winDetection.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { cubiesToKociembaString } from '../game/kociembaAdapter.js';
import { antipodalPairFlip, residualWeight } from '../game/antipodalSolver.js';
import {
  enumerateBetaPairs,
  deltaInvariant,
  globalColorFlip,
  fibreCosts,
  isFibreInSolvedOrbit,
  planQuotientCompletion,
  applyQuotientCompletion,
} from '../game/antipodalEngine.js';

// Toggle a single sticker in place (an asymmetric, non-native mutation —
// breaks β-symmetry the way an external heal or damage would).
function toggleOne(cubies, x, y, z, dir) {
  const st = cubies[x][y][z].stickers[dir];
  st.curr = ANTIPODAL_COLOR[st.curr];
  st.flips = (st.flips ?? 0) + 1;
}

// Flip the first n distinct β-pairs of the cube via the native pair operator.
function flipNPairs(cubies, size, n) {
  const pairs = enumerateBetaPairs(cubies, size);
  let next = cubies;
  for (const p of pairs.slice(0, n)) {
    next = antipodalPairFlip(next, size, p.a.x, p.a.y, p.a.z, p.a.dir);
  }
  return next;
}

describe('antipodalEngine — β-pair enumeration', () => {
  it('a solved 3×3 has exactly 27 clean pairs, each joining antipodal identities', () => {
    const solved = makeCubies(3);
    const pairs = enumerateBetaPairs(solved, 3);
    expect(pairs).toHaveLength(27);
    for (const p of pairs) {
      expect(p.kind).toBe('clean');
      expect(p.b).not.toBeNull();
      const origA = solved[p.a.x][p.a.y][p.a.z].stickers[p.a.dir].orig;
      const origB = solved[p.b.x][p.b.y][p.b.z].stickers[p.b.dir].orig;
      expect(ANTIPODAL_COLOR[origA]).toBe(origB);
    }
  });

  it('pair count generalises: a 2×2 has 12 pairs (24 stickers)', () => {
    expect(enumerateBetaPairs(makeCubies(2), 2)).toHaveLength(12);
  });

  it('classifies clean / dirty / asymmetric pairs', () => {
    let cubies = makeCubies(3);
    cubies = antipodalPairFlip(cubies, 3, 2, 2, 2, 'PZ'); // one symmetric dirty pair
    toggleOne(cubies, 1, 2, 1, 'PY');                     // one asymmetric pair
    const kinds = enumerateBetaPairs(cubies, 3).map((p) => p.kind);
    expect(kinds.filter((k) => k === 'dirty')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'asymmetric')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'clean')).toHaveLength(25);
  });
});

describe('antipodalEngine — ∆ invariant (Theorem 3)', () => {
  it('is zero throughout native play (paired flips + rotations)', () => {
    let cubies = makeCubies(3);
    cubies = antipodalPairFlip(cubies, 3, 0, 0, 2, 'PZ');
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = antipodalPairFlip(cubies, 3, 2, 2, 2, 'PX');
    cubies = rotateSliceCubies(cubies, 3, 'row', 2, -1);
    expect(deltaInvariant(cubies, 3).weight).toBe(0);
  });

  it('counts asymmetric pairs, and rotations cannot change it', () => {
    const cubies = makeCubies(3);
    toggleOne(cubies, 2, 2, 2, 'PZ');
    toggleOne(cubies, 0, 0, 0, 'NX');
    expect(deltaInvariant(cubies, 3).weight).toBe(2);
    // β is identity-indexed: moving pieces around never touches ∆ (Lemma 1)
    const rotated = rotateSliceCubies(rotateSliceCubies(cubies, 3, 'col', 1, 1), 3, 'depth', 0, -1);
    expect(deltaInvariant(rotated, 3).weight).toBe(2);
  });

  it('native paired flips preserve ∆ even when it is nonzero', () => {
    let cubies = makeCubies(3);
    toggleOne(cubies, 2, 2, 2, 'PZ');
    cubies = antipodalPairFlip(cubies, 3, 0, 0, 2, 'PZ');
    cubies = antipodalPairFlip(cubies, 3, 1, 2, 1, 'PY');
    expect(deltaInvariant(cubies, 3).weight).toBe(1);
  });
});

describe('antipodalEngine — global colour flip γ (Lemma 5)', () => {
  it('sends the solved state to the all-flipped solved state', () => {
    const flipped = globalColorFlip(makeCubies(3), 3);
    expect(residualWeight(flipped, 3)).toBe(54);
    expect(allStickersFlipped(flipped, 3)).toBe(true);
    expect(checkRubiksSolved(flipped, 3)).toBe(false);          // strict target missed…
    expect(checkRubiksSolvedAntipodal(flipped, 3)).toBe(true);  // …but quotient solved
    expect(isFibreInSolvedOrbit(flipped, 3)).toBe(true);
  });

  it('is an involution: γ² = identity', () => {
    const back = globalColorFlip(globalColorFlip(makeCubies(3), 3), 3);
    expect(checkRubiksSolved(back, 3)).toBe(true);
    expect(residualWeight(back, 3)).toBe(0);
  });

  it('is central: γ commutes with face turns on the residual', () => {
    const a = rotateSliceCubies(globalColorFlip(makeCubies(3), 3), 3, 'col', 0, 1);
    const b = globalColorFlip(rotateSliceCubies(makeCubies(3), 3, 'col', 0, 1), 3);
    expect(residualWeight(a, 3)).toBe(54);
    expect(residualWeight(b, 3)).toBe(54);
    expect(deltaInvariant(a, 3).weight).toBe(0);
    expect(deltaInvariant(b, 3).weight).toBe(0);
  });
});

describe('antipodalEngine — central quotient planner (Theorem 4)', () => {
  it('few dirty pairs → targets Z₀ with k flips', () => {
    const cubies = flipNPairs(makeCubies(3), 3, 3);
    const plan = planQuotientCompletion(cubies, 3);
    expect(plan.target).toBe(0);
    expect(plan.heals).toHaveLength(0);
    expect(plan.flips).toHaveLength(3);
    const done = applyQuotientCompletion(cubies, 3, plan);
    expect(checkRubiksSolved(done, 3)).toBe(true);
  });

  it('many dirty pairs → targets Z₁ with P−k flips (min(k, 27−k))', () => {
    const cubies = flipNPairs(makeCubies(3), 3, 20);
    const plan = planQuotientCompletion(cubies, 3);
    expect(plan.target).toBe(1);
    expect(plan.flips).toHaveLength(7); // 27 − 20, not 20
    const done = applyQuotientCompletion(cubies, 3, plan);
    expect(allStickersFlipped(done, 3)).toBe(true);
    expect(checkRubiksSolvedAntipodal(done, 3)).toBe(true);
    expect(isFibreInSolvedOrbit(done, 3)).toBe(true);
  });

  it('at the k=14 crossover the cheaper representative Z₁ wins with 13 flips', () => {
    const plan = planQuotientCompletion(flipNPairs(makeCubies(3), 3, 14), 3);
    expect(plan.target).toBe(1);
    expect(plan.flipCost).toBe(13); // the worst fibre cost on the in-play sector
  });

  it('asymmetric pairs cost one mandatory heal each before flips (wt ∆)', () => {
    const cubies = flipNPairs(makeCubies(3), 3, 2);
    toggleOne(cubies, 1, 1, 2, 'PZ');
    const plan = planQuotientCompletion(cubies, 3);
    expect(plan.heals).toHaveLength(1);
    expect(plan.flips).toHaveLength(2);
    const done = applyQuotientCompletion(cubies, 3, plan);
    expect(checkRubiksSolved(done, 3)).toBe(true);
  });

  it('conservativity: a clean cube plans nothing (Theorem 5)', () => {
    const plan = planQuotientCompletion(makeCubies(3), 3);
    expect(plan.totalCost).toBe(0);
    expect(plan.target).toBe(0);
  });

  it('fibre repair is position-independent: works on a scrambled cube (Theorem 6)', () => {
    let cubies = rotateSliceCubies(makeCubies(3), 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'row', 2, -1);
    cubies = antipodalPairFlip(cubies, 3, 2, 2, 2, 'PX');
    const done = applyQuotientCompletion(cubies, 3);
    expect(isFibreInSolvedOrbit(done, 3)).toBe(true);
    // Position untouched by the fibre phase — still scrambled
    expect(checkRubiksSolvedAntipodal(done, 3)).toBe(false);
  });
});

describe('antipodalEngine — cost accounting (Theorem 7)', () => {
  it('strict = a + b, quotient = a + min(b, P−b)', () => {
    const cubies = flipNPairs(makeCubies(3), 3, 2);
    toggleOne(cubies, 1, 1, 2, 'PZ');
    const c = fibreCosts(cubies, 3);
    expect(c).toMatchObject({ totalPairs: 27, asymmetricPairs: 1, dirtyPairs: 2, strictCost: 3, quotientCost: 3 });
  });

  it('quotient cost caps at 13 while strict grows to k', () => {
    const c = fibreCosts(flipNPairs(makeCubies(3), 3, 20), 3);
    expect(c.strictCost).toBe(20);
    expect(c.quotientCost).toBe(7);
  });
});

// ── Theorem 9: minimal observational aliasing (Appendix B executable check) ──
//
// Two paired flips on the solved state (the U-stickers of the UF and UB slots,
// with their β-partners) produce EXACTLY the same facelet appearance as the
// legal classical double edge swap UF↔DF, UB↔DB — four changed facelets
// {U2, U8, D2, D8}, the minimum possible support for such an alias. This
// discharges the monograph's audited-convention hypothesis directly against
// the shipped pairing code.

describe('antipodalEngine — Theorem 9 observational aliasing', () => {
  const ALIAS = 'UDUUUUUDU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DUDDDDDUD' + 'LLLLLLLLL' + 'BBBBBBBBB';
  const SOLVED = 'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';

  it('the audited pairing sends UD-edge U-stickers to UD-edge D-stickers', () => {
    const cubies = makeCubies(3);
    const map = buildManifoldGridMap(cubies, 3);
    for (const [x, y, z] of [[1, 2, 2], [1, 2, 0]]) {
      const partner = findAntipodalStickerByGrid(map, cubies[x][y][z].stickers.PY, 3);
      expect(partner).not.toBeNull();
      expect(partner.dirKey).toBe('NY');
      // Partner is the D-sticker of a UD-layer edge slot (DF or DB)
      expect([`1,0,2`, `1,0,0`]).toContain(`${partner.x},${partner.y},${partner.z}`);
    }
  });

  it('State A (two paired flips) shows the alias string with support 4', () => {
    let a = makeCubies(3);
    a = antipodalPairFlip(a, 3, 1, 2, 2, 'PY'); // U-of-UF pair
    a = antipodalPairFlip(a, 3, 1, 2, 0, 'PY'); // U-of-UB pair
    expect(residualWeight(a, 3)).toBe(4); // pure colour state: 4 dirty stickers
    const str = cubiesToKociembaString(a);
    expect(str).toBe(ALIAS);
    const support = [...str].map((ch, i) => (ch !== SOLVED[i] ? i : -1)).filter((i) => i >= 0);
    expect(support).toEqual([1, 7, 28, 34]); // U2, U8, D2, D8 (0-based)
  });

  it('State B (legal classical double swap UF↔DF, UB↔DB) shows the same string', () => {
    const b = makeCubies(3);
    // Swap two UD-layer edge pairs with edge orientation zero: the moved edge's
    // U/D-type sticker stays on the U/D face, its F/B sticker stays on F/B.
    const swapEdges = (uSlot, dSlot, fbDir) => {
      const uc = b[uSlot[0]][uSlot[1]][uSlot[2]];
      const dc = b[dSlot[0]][dSlot[1]][dSlot[2]];
      const uPY = uc.stickers.PY, uFB = uc.stickers[fbDir];
      uc.stickers.PY = dc.stickers.NY;
      uc.stickers[fbDir] = dc.stickers[fbDir];
      dc.stickers.NY = uPY;
      dc.stickers[fbDir] = uFB;
    };
    swapEdges([1, 2, 2], [1, 0, 2], 'PZ'); // UF ↔ DF
    swapEdges([1, 2, 0], [1, 0, 0], 'NZ'); // UB ↔ DB
    expect(residualWeight(b, 3)).toBe(0); // pure positional state: no dirty stickers
    expect(cubiesToKociembaString(b)).toBe(ALIAS);
  });
});
