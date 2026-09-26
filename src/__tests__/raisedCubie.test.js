import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { cubieHasFlippedFace, cubieFaceRole, padBackFace, selectiveCubieOffsetRatio, wormRaisedAmount, raisedWormExpansion, WORM_PIECE_POP, WORM_PAD_HEIGHT, WORM_CAUTION_TAPE_TOP, PIECE_OVERSHOOT_MAX } from '../game/raisedCubie.js';
import { padEntryDecision } from '../worm/healerWorm/padEntry.js';
import { publishRaisedCubie, removeRaisedCubie, raisedCubieExtent } from '../3d/raisedCubieMotion.js';

describe('whole-cubie flip platforms', () => {
  it('raises a corner once for any flipped face, without making other faces tunnels', () => {
    const cubie = makeCubies(3)[2][2][2];
    expect(cubieHasFlippedFace(cubie, 6)).toBe(false);
    cubie.stickers.PZ.flips = 1;
    expect(cubieHasFlippedFace(cubie, 6)).toBe(true);
    expect(cubieFaceRole(cubie, 'PZ', 6)).toBe('tunnel');
    expect(cubieFaceRole(cubie, 'PY', 6)).toBe('platform');
    expect(cubieFaceRole(cubie, 'PX', 6)).toBe('platform');
    expect(cubieFaceRole(cubie, 'NX', 6)).toBe('absent');
    // Even if another face on the same piece resolves to a tunnel, the face
    // actually landed on must be flipped. A raised ordinary face is walkable.
    expect(padEntryDecision({ rule: 'pad', event: 'land', flipped: false, resolved: true })).toBe('pass');
    cubie.stickers.PY.flips = 1;
    expect(cubieHasFlippedFace(cubie, 6)).toBe(true);
    cubie.stickers.PZ.flips = 2;
    expect(cubieHasFlippedFace(cubie, 6)).toBe(true);
    cubie.stickers.PY.flips = 2;
    expect(cubieHasFlippedFace(cubie, 6)).toBe(false);
  });
  it('uses the effective cap and stops raising an odd but spent face', () => {
    const cubie = makeCubies(3)[1][1][2];
    cubie.stickers.PZ.flips = 3;
    expect(cubieHasFlippedFace(cubie, 3)).toBe(false);
    expect(cubieHasFlippedFace(cubie, 8)).toBe(true);
  });
  it.each([2, 3, 5, 7, 15])('matches full Explode at size %s without stacking expansion', size => {
    for (const global of [0, 0.2, 0.5, 1]) {
      const scale = cubeExpansionScale(size, global);
      expect(scale * (1 + selectiveCubieOffsetRatio(size, global, 1))).toBeCloseTo(cubeExpansionScale(size, 1));
      expect(selectiveCubieOffsetRatio(size, global, 0)).toBe(0);
    }
  });
  it.each([[3, 6], [6, 3], [1, 4], [4, 1], [2, 5], [5, 2]])('uses visible face %s → back %s, regardless of home', (curr, back) => {
    expect(padBackFace({ curr, orig: back })).toBe(back);
  });
  it('tracks only active extent and clears owners independently', () => {
    const a = {}, b = {};
    publishRaisedCubie(a, 0.2); publishRaisedCubie(b, 0.8);
    expect(raisedCubieExtent()).toBe(0.8);
    removeRaisedCubie(b);
    expect(raisedCubieExtent()).toBe(0.2);
    publishRaisedCubie(a, 0);
    expect(raisedCubieExtent()).toBe(0);
  });
});

// WORM exposes a visible piece and lands at the fixed tape height on every board.
it.each([2, 3, 5, 7, 15])('raises the landing to caution-tape height at size %i', size => {
  const outer = (size - 1) / 2;
  expect((cubeExpansionScale(size, wormRaisedAmount(size)) - 1) * outer).toBeCloseTo(WORM_PIECE_POP, 12);
  expect(WORM_PIECE_POP).toBeGreaterThan(0.3);
  expect(WORM_PIECE_POP + WORM_PAD_HEIGHT).toBeCloseTo(WORM_CAUTION_TAPE_TOP, 12);
  for (const global of [0, .35, .8, 1]) {
    // Manual Explode never stacks on top of the pop.
    expect(raisedWormExpansion(global, size)).toBe(Math.max(global, wormRaisedAmount(size)));
    expect(cubeExpansionScale(size, global) * (1 + selectiveCubieOffsetRatio(size, global, wormRaisedAmount(size))))
      .toBeCloseTo(cubeExpansionScale(size, raisedWormExpansion(global, size)), 10);
  }
});

it.each([3, 7])('passes a springing overshoot through, bounded, at size %i', size => {
  const rest = selectiveCubieOffsetRatio(size, 0, 1);
  expect(selectiveCubieOffsetRatio(size, 0, 1.2)).toBeGreaterThan(rest);
  expect(selectiveCubieOffsetRatio(size, 0, 99)).toBeCloseTo(selectiveCubieOffsetRatio(size, 0, PIECE_OVERSHOOT_MAX));
  expect(selectiveCubieOffsetRatio(size, 0, -0.2)).toBe(0);
});

