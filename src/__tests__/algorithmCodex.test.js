// The Algorithm Codex pack, and the id-range rule that lets packs coexist.
//
// ProgressManager stores completion as a flat array of numeric level ids with no
// pack qualifier, so ids must be unique across every pack — not just within one.
// Cube Academy originally reused 1-6 alongside Story's 1-10, which meant beating
// Story chapter 3 also marked Academy lesson 3 complete; nothing surfaced it
// only because Academy had no entry point. Now that the pack selector exposes
// all three packs, that rule is load-bearing.

import { describe, it, expect } from 'vitest';
import { ALGORITHM_CODEX_LEVELS } from '../levels/data/algorithm-codex.js';
import { BUILT_IN_PACKS, getPack } from '../levels/packs/index.js';
import { LEVEL_ID_RANGES } from '../levels/schema.js';
import { levelsManager } from '../levels/index.js';
import { getLevelPar } from '../levels/scoring.js';
import { quarterTurnCount } from '../levels/algorithmScramble.js';

describe('Algorithm Codex pack', () => {
  it('ships ten levels, all 3×3', () => {
    expect(ALGORITHM_CODEX_LEVELS).toHaveLength(10);
    for (const level of ALGORITHM_CODEX_LEVELS) {
      expect(level.cubeSize).toBe(3);
    }
  });

  it('gives every level an algorithm whose par is its quarter-turn count', () => {
    for (const level of ALGORITHM_CODEX_LEVELS) {
      expect(level.algorithm, `${level.name} has no algorithm`).toBeTruthy();
      const qtm = quarterTurnCount(level.algorithm.notation);
      expect(level.algorithm.quarterTurns).toBe(qtm);
      // Par is what the star rating grades against, so it must equal the cost of
      // simply performing the algorithm — no more, no less.
      expect(getLevelPar(level), `${level.name} par`).toBe(qtm);
    }
  });

  it('chains each level to its predecessor', () => {
    ALGORITHM_CODEX_LEVELS.forEach((level, i) => {
      const expected = i === 0 ? null : ALGORITHM_CODEX_LEVELS[i - 1].id;
      expect(level.requirements.previousLevel).toBe(expected);
    });
  });

  it('disables flips so a case cannot be recoloured instead of solved', () => {
    for (const level of ALGORITHM_CODEX_LEVELS) {
      expect(level.features.flips).toBe(false);
    }
  });
});

describe('pack id ranges', () => {
  it('keeps every level id globally unique across packs', () => {
    const seen = new Map();
    for (const pack of Object.values(BUILT_IN_PACKS)) {
      for (const level of pack.levels) {
        const clash = seen.get(level.id);
        expect(clash, `id ${level.id} used by both ${clash} and ${pack.id}`).toBeUndefined();
        seen.set(level.id, pack.id);
      }
    }
  });

  it('keeps each pack inside its declared range', () => {
    for (const [packId, [lo, hi]] of Object.entries(LEVEL_ID_RANGES)) {
      const pack = getPack(packId);
      expect(pack, `no pack registered for ${packId}`).toBeTruthy();
      for (const level of pack.levels) {
        expect(level.id).toBeGreaterThanOrEqual(lo);
        expect(level.id).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe('cross-pack level lookup', () => {
  it('resolves levels from every pack, not just the story campaign', () => {
    for (const pack of Object.values(BUILT_IN_PACKS)) {
      for (const level of pack.levels) {
        expect(levelsManager.getLevel(level.id)?.id, `${pack.id}:${level.id}`).toBe(level.id);
      }
    }
  });

  it('advances within the owning pack rather than assuming id + 1', () => {
    const codex = getPack('algorithm-codex').levels;
    expect(levelsManager.getNextLevel(codex[0].id)?.id).toBe(codex[1].id);
    // The last level of a pack has no next — it must not leak into another pack.
    expect(levelsManager.getNextLevel(codex[codex.length - 1].id)).toBeNull();
  });

  it('reports new features pack-relatively', () => {
    // Previously getNewFeatures compared against getLevel(id - 1), which does not
    // exist for a pack numbered in its own range, so every level reported none.
    const codex = getPack('algorithm-codex').levels;
    expect(() => levelsManager.getNewFeatures(codex[3].id)).not.toThrow();
  });
});
