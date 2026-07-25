import { describe, it, expect } from 'vitest';
import {
  FACE_TOKENS,
  MODIFIER_TOKENS,
  SLICE_TOKENS,
  EXAMPLE_SEQUENCE,
  resolveToken,
  describeToken
} from '../teach/notation.js';
import { parseAlgorithm } from '../teach/algorithms.js';

const ALL = [...FACE_TOKENS, ...MODIFIER_TOKENS, ...SLICE_TOKENS];

describe('notation lesson tokens', () => {
  it('every taught token resolves to a real turn', () => {
    for (const { token } of ALL) {
      const move = resolveToken(token);
      expect(move, `${token} should resolve`).toBeTruthy();
      expect(['col', 'row', 'depth']).toContain(move.axis);
      expect([1, -1]).toContain(move.dir);
      expect(move.sliceIndex).toBeGreaterThanOrEqual(0);
      expect(move.sliceIndex).toBeLessThan(3);
    }
  });

  it('names all six faces exactly once', () => {
    expect(FACE_TOKENS.map((f) => f.token).sort()).toEqual(['B', 'D', 'F', 'L', 'R', 'U']);
  });

  it('faces turn outer layers, slices turn the middle', () => {
    for (const { token } of FACE_TOKENS) {
      expect([0, 2]).toContain(resolveToken(token).sliceIndex);
    }
    for (const { token } of SLICE_TOKENS) {
      expect(resolveToken(token).sliceIndex).toBe(1);
    }
  });

  it('a prime reverses its bare letter on the same layer', () => {
    const plain = resolveToken('R');
    const prime = resolveToken("R'");
    expect(prime.axis).toBe(plain.axis);
    expect(prime.sliceIndex).toBe(plain.sliceIndex);
    expect(prime.dir).toBe(-plain.dir);
  });

  it('a 2 is a half turn on the same layer and direction', () => {
    const plain = resolveToken('R');
    const half = resolveToken('R2');
    expect(half.numTurns).toBe(2);
    expect(half.axis).toBe(plain.axis);
    expect(half.sliceIndex).toBe(plain.sliceIndex);
    expect(plain.numTurns).toBe(1);
  });

  it('resolves nothing for a token the parser does not know', () => {
    expect(resolveToken('Q')).toBeNull();
    expect(describeToken('Q')).toBeNull();
  });
});

describe('describeToken', () => {
  it('uses the lesson copy for taught tokens', () => {
    expect(describeToken('F').title).toBe('Front');
    expect(describeToken('M').title).toBe('Middle');
  });

  it('falls back to a description of the turn for untaught tokens', () => {
    const info = describeToken("U'");
    expect(info).toBeTruthy();
    expect(info.title).toMatch(/Up \(U\)/);
  });
});

describe('worked example', () => {
  it('parses to one move per token', () => {
    const tokens = EXAMPLE_SEQUENCE.split(' ');
    const moves = parseAlgorithm(EXAMPLE_SEQUENCE, 3);
    expect(moves).toHaveLength(tokens.length);
    expect(moves.map((m) => m.notation)).toEqual(tokens);
  });

  it('every token in the example is describable', () => {
    for (const token of EXAMPLE_SEQUENCE.split(' ')) {
      expect(describeToken(token), token).toBeTruthy();
    }
  });
});
