// src/__tests__/teach.test.js
// Unit tests for Teach Mode logic

import { describe, it, expect } from 'vitest';
import { BEGINNER_METHOD_3x3, parseAlgorithm, describeMove } from '../teach/algorithms.js';
import { analyzeState } from '../teach/solver3x3.js';
import { makeCubies } from '../game/cubeState.js';

// ---------------------------------------------------------------------------
// algorithms.js — data integrity checks
// ---------------------------------------------------------------------------
describe('BEGINNER_METHOD_3x3', () => {
  it('has exactly 7 stages', () => {
    expect(BEGINNER_METHOD_3x3.stages.length).toBe(7);
  });

  it('every stage has required fields', () => {
    for (const stage of BEGINNER_METHOD_3x3.stages) {
      expect(stage).toHaveProperty('id');
      expect(stage).toHaveProperty('name');
      expect(stage).toHaveProperty('goal');
      expect(stage).toHaveProperty('explanation');
      expect(stage).toHaveProperty('tips');
      expect(stage).toHaveProperty('algorithms');
      expect(Array.isArray(stage.tips)).toBe(true);
      expect(Array.isArray(stage.algorithms)).toBe(true);
      expect(stage.algorithms.length).toBeGreaterThan(0);
    }
  });

  it('every algorithm has why and topologyTip fields', () => {
    for (const stage of BEGINNER_METHOD_3x3.stages) {
      for (const algo of stage.algorithms) {
        expect(algo).toHaveProperty('why');
        expect(algo).toHaveProperty('topologyTip');
        expect(algo).toHaveProperty('quizHint');
        expect(typeof algo.why).toBe('string');
        expect(typeof algo.topologyTip).toBe('string');
        expect(typeof algo.quizHint).toBe('string');
        expect(algo.why.length).toBeGreaterThan(10);
        expect(algo.topologyTip.length).toBeGreaterThan(10);
      }
    }
  });

  it('every algorithm has a valid notation string', () => {
    for (const stage of BEGINNER_METHOD_3x3.stages) {
      for (const algo of stage.algorithms) {
        expect(typeof algo.notation).toBe('string');
        expect(algo.notation.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('stage IDs are unique', () => {
    const ids = BEGINNER_METHOD_3x3.stages.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// parseAlgorithm — basic parse correctness
// ---------------------------------------------------------------------------
describe('parseAlgorithm', () => {
  it('parses a simple single move', () => {
    const moves = parseAlgorithm('R', 3);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0]).toHaveProperty('axis');
    expect(moves[0]).toHaveProperty('dir');
    expect(moves[0]).toHaveProperty('sliceIndex');
    expect(moves[0]).toHaveProperty('notation');
  });

  it('parses multi-move notation into the right count', () => {
    // "R U R' U'" — 4 moves
    const moves = parseAlgorithm("R U R' U'", 3);
    expect(moves.length).toBe(4);
  });

  it('expands double moves (e.g. R2) into two moves', () => {
    const moves = parseAlgorithm('R2', 3);
    // R2 expands to 2 quarter-turn moves
    expect(moves.length).toBe(2);
  });

  it('preserves notation label on each move', () => {
    const moves = parseAlgorithm("F U' R U", 3);
    const notations = moves.map((m) => m.notation);
    expect(notations).toContain('F');
    expect(notations).toContain("U'");
    expect(notations).toContain('R');
    expect(notations).toContain('U');
  });

  it('returns empty array for empty string', () => {
    const moves = parseAlgorithm('', 3);
    expect(moves.length).toBe(0);
  });

  it('ignores unknown tokens gracefully', () => {
    // Should not throw; unknown tokens are skipped
    expect(() => parseAlgorithm('X Y Z', 3)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// describeMove — human-readable layer description
// ---------------------------------------------------------------------------
describe('describeMove', () => {
  it('describes a right-face move', () => {
    const moves = parseAlgorithm('R', 3);
    const desc = describeMove(moves[0], 3);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('includes direction in the description', () => {
    const cwMoves = parseAlgorithm('R', 3);
    const ccwMoves = parseAlgorithm("R'", 3);
    const cwDesc = describeMove(cwMoves[0], 3);
    const ccwDesc = describeMove(ccwMoves[0], 3);
    // The two descriptions should differ
    expect(cwDesc).not.toBe(ccwDesc);
  });
});

// ---------------------------------------------------------------------------
// analyzeState — stage detection on a solved cube
// ---------------------------------------------------------------------------
describe('analyzeState', () => {
  it('returns solved for a freshly initialised cube', () => {
    const cubies = makeCubies(3);
    const result = analyzeState(cubies);
    expect(result.stageId).toBe('solved');
    expect(result.stageIndex).toBe(7);
  });

  it('result has required fields', () => {
    const cubies = makeCubies(3);
    const result = analyzeState(cubies);
    expect(result).toHaveProperty('stageIndex');
    expect(result).toHaveProperty('stageId');
    expect(result).toHaveProperty('progress');
    expect(result).toHaveProperty('highlights');
    expect(Array.isArray(result.highlights)).toBe(true);
  });

  it('highlights is empty when cube is solved', () => {
    const cubies = makeCubies(3);
    const result = analyzeState(cubies);
    expect(result.highlights.length).toBe(0);
  });

  it('detects stage 0 when top cross is absent', () => {
    // Start from solved and manually corrupt a white edge sticker
    const cubies = makeCubies(3);
    // Set the front-top white edge to yellow (wrong)
    cubies[1][2][2].stickers.PY.curr = 6;
    const result = analyzeState(cubies);
    expect(result.stageIndex).toBe(0);
    expect(result.stageId).toBe('white-cross');
  });

  it('highlights contain x, y, z, dir fields', () => {
    const cubies = makeCubies(3);
    cubies[1][2][2].stickers.PY.curr = 6; // break the cross
    const result = analyzeState(cubies);
    for (const h of result.highlights) {
      expect(h).toHaveProperty('x');
      expect(h).toHaveProperty('y');
      expect(h).toHaveProperty('z');
      expect(h).toHaveProperty('dir');
    }
  });
});
