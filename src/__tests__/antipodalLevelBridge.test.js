import { describe, it, expect } from 'vitest';
import {
  betaPairAnchors,
  betaPairCount,
  buildAntipodalFlipSequence,
  buildPlayableAntipodalLevel,
  buildAntipodalDescentLevels,
  buildAntipodalDescentPack,
  ANTIPODAL_PACK_BASE_ID
} from '../levels/antipodalLevelBridge.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { fibreCosts } from '../game/antipodalEngine.js';
import { getLevelPar } from '../levels/scoring.js';
import { validateLevel } from '../levels/validation.js';

describe('betaPairAnchors', () => {
  it('returns the physical β-pair count per cube size', () => {
    expect(betaPairCount(2)).toBe(12);
    expect(betaPairCount(3)).toBe(27);
    expect(betaPairCount(4)).toBe(48);
  });

  it('anchors are unique and well-formed', () => {
    const anchors = betaPairAnchors(3);
    const keys = new Set(anchors.map((a) => `${a.x},${a.y},${a.z},${a.dirKey}`));
    expect(keys.size).toBe(anchors.length);
    for (const a of anchors) expect(a).toHaveProperty('dirKey');
  });
});

describe('buildAntipodalFlipSequence', () => {
  it('is deterministic and picks distinct pairs', () => {
    const a = buildAntipodalFlipSequence(3, 5, 'seed');
    const b = buildAntipodalFlipSequence(3, 5, 'seed');
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
    const keys = new Set(a.map((p) => `${p.x},${p.y},${p.z},${p.dirKey}`));
    expect(keys.size).toBe(5);
  });

  it('rejects a flip count beyond the available pairs', () => {
    expect(() => buildAntipodalFlipSequence(2, 13, 0)).toThrow(RangeError);
  });
});

describe('buildPlayableAntipodalLevel', () => {
  it('stages to a fibre whose exact par equals the requested par', () => {
    for (const targetPar of [1, 3, 6]) {
      const lvl = buildPlayableAntipodalLevel({ id: 301, size: 3, targetPar, seed: 1 });
      expect(getLevelPar(lvl)).toBe(targetPar);
      const state = buildLevelStartState(lvl, 3, { levelNumber: 1 });
      const fc = fibreCosts(state, 3);
      expect(fc.asymmetricPairs).toBe(0); // paired flips → symmetric sector
      expect(fc.dirtyPairs).toBe(targetPar);
      expect(fc.strictCost).toBe(targetPar); // CLASSIC un-flip cost
      expect(validateLevel(lvl).valid).toBe(true);
    }
  });

  it('never adds a random scramble on top of the authored flips', () => {
    const lvl = buildPlayableAntipodalLevel({ id: 305, size: 3, targetPar: 2, seed: 7 });
    expect(lvl.scrambleSequence).toBeNull();
    expect(lvl.scrambleMoves).toBe(0);
    expect(lvl.features.flips).toBe(true);
  });

  it('throws for an unreachable par on the given cube size', () => {
    expect(() => buildPlayableAntipodalLevel({ id: 301, size: 2, targetPar: 13, seed: 0 })).toThrow(RangeError);
  });
});

describe('antipodal descent pack', () => {
  it('is a deterministic 12-level ramp with unique in-range ids and climbing par', () => {
    const p1 = buildAntipodalDescentPack();
    const p2 = buildAntipodalDescentPack();
    expect(p1.levels.map((l) => l.flipSequence)).toEqual(p2.levels.map((l) => l.flipSequence));
    expect(p1.levels).toHaveLength(12);
    p1.levels.forEach((lvl, i) => {
      expect(lvl.id).toBe(ANTIPODAL_PACK_BASE_ID + i);
      expect(getLevelPar(lvl)).toBe(i + 1);
      expect(validateLevel(lvl).valid).toBe(true);
    });
  });

  it('builder count is honoured', () => {
    expect(buildAntipodalDescentLevels(5)).toHaveLength(5);
  });
});
