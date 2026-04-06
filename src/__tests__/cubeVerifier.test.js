import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { Worm3CubeVerifier, verifyCubeStateShape } from '../coming-soon/game/cubeVerifier.js';
import { importCubeState } from '../game/cubeUtils.js';

describe('verifyCubeStateShape', () => {
  it('accepts a well-formed cube state', () => {
    const cubies = makeCubies(3);
    expect(verifyCubeStateShape(cubies, 3)).toBe(true);
  });

  it('rejects malformed arrays', () => {
    expect(verifyCubeStateShape([], 3)).toBe(false);
    expect(verifyCubeStateShape([[]], 3)).toBe(false);
  });
});

describe('Worm3CubeVerifier', () => {
  it('starts valid in solved state', () => {
    const verifier = new Worm3CubeVerifier(3);
    const result = verifier.verifyState();

    expect(result.shapeValid).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.integrity.integrity).toBe(1);
    expect(result.integrity.total).toBe(27);
  });

  it('serializes/deserializes cube state', () => {
    const verifier = new Worm3CubeVerifier(3);
    verifier.rotateSlice('depth', 2, 1);

    const json = verifier.toJSON();
    const parsed = importCubeState(json);
    const restored = Worm3CubeVerifier.fromJSON(JSON.stringify(parsed), 3);

    expect(restored.verifyState().shapeValid).toBe(true);
    expect(restored.computeIntegrity().integrity).toBe(verifier.computeIntegrity().integrity);
  });

  it('applies flip pair and logs antipodal counterpart', () => {
    const verifier = new Worm3CubeVerifier(3);
    const changed = verifier.flipPair(0, 0, 0, 'NX');

    expect(changed).toBe(true);
    const lastMove = verifier.moveHistory[verifier.moveHistory.length - 1];
    expect(lastMove.type).toBe('flip');
    expect(lastMove.antipodal).toEqual({ x: 2, y: 2, z: 2, dirKey: 'PX' });
  });

  it('supports random fuzz moves while preserving shape', () => {
    const verifier = new Worm3CubeVerifier(3);

    for (let i = 0; i < 200; i++) {
      verifier.randomMove();
    }

    expect(verifyCubeStateShape(verifier.cubies, 3)).toBe(true);
    expect(verifier.computeIntegrity().total).toBe(27);
  });
});
