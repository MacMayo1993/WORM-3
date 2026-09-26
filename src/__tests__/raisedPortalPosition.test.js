import { expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { raisedPortalPosition, raisedPortalLift } from '../worm/raisedPortalPosition.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { WORM_PAD_HEIGHT, raisedWormExpansion } from '../game/raisedCubie.js';

it.each(['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'])('puts %s warning visuals on the raised pad, composed with global Explode', face => {
  const size = 7, cubies = makeCubies(size), xyz = [3, 3, 3];
  const axis = { X: 0, Y: 1, Z: 2 }[face[1]], sign = face[0] === 'P' ? 1 : -1;
  xyz[axis] = sign > 0 ? 6 : 0;
  cubies[xyz[0]][xyz[1]][xyz[2]].stickers[face].flips = 1;
  const state = { cubies, wormHealerMode: true, demoMode: false, settings: { flipPads: 'off' } };
  const before = wormExpansion.amount;
  try {
    for (const amount of [0, 0.35, 1]) {
      wormExpansion.amount = amount;
      const expected = getStickerWorldPos(...xyz, face, size, raisedWormExpansion(amount, size)); expected[axis] += sign * WORM_PAD_HEIGHT;
      expect(raisedPortalPosition(...xyz, face, size, state)).toEqual(expected);
    }
    expect(raisedPortalPosition(...xyz, face, size, { ...state, demoMode: true }))
      .toEqual(getStickerWorldPos(...xyz, face, size, 1));
  } finally { wormExpansion.amount = before; }
});

it('reads the flip cap in force, like the simulation', () => {
  const size = 5, cubies = makeCubies(size), xyz = [2, 2, 4];
  cubies[2][2][4].stickers.PZ.flips = 7;
  const base = { cubies, wormHealerMode: true, demoMode: false };
  const before = wormExpansion.amount;
  wormExpansion.amount = 0;
  try {
    // With Chaos's cap of 8 in force, seven flips is a live pad, raised as the sim sees it.
    const raised = getStickerWorldPos(...xyz, 'PZ', size, raisedWormExpansion(0, size));
    raised[2] += WORM_PAD_HEIGHT;
    expect(raisedPortalPosition(...xyz, 'PZ', size, { ...base, chaosLevel: 1, disparityFlipCap: 8 })).toEqual(raised);
    // Under the standard cap the same tile is spent, so its rings stay on the floor.
    expect(raisedPortalPosition(...xyz, 'PZ', size, base)).toEqual(getStickerWorldPos(...xyz, 'PZ', size, 0));
  } finally { wormExpansion.amount = before; }
});

it("reports exactly the hover the portal visuals are raised by, in every mode", () => {
  const size = 3, cubies = makeCubies(size);
  cubies[1][1][2].stickers.PZ.flips = 1;
  cubies[1][2][2].stickers.PZ.flips = 6; // spent at the standard cap
  const pad = { cubies, wormHealerMode: true, demoMode: false };
  const before = wormExpansion.amount;
  wormExpansion.amount = 0;
  try {
    for (const [xyz, state, lift] of [
      [[1, 1, 2], pad, WORM_PAD_HEIGHT],
      [[1, 1, 2], { ...pad, demoMode: true }, 0],
      [[1, 1, 2], { ...pad, wormHealerMode: false }, 0],
      [[1, 2, 2], pad, 0],
      [[0, 0, 2], pad, 0]
    ]) {
      expect(raisedPortalLift(...xyz, 'PZ', state)).toBe(lift);
      // The same lift the portal position carries above its (barely popped) piece.
      const raised = lift > 0 ? raisedWormExpansion(0, size) : 0;
      const surface = getStickerWorldPos(...xyz, 'PZ', size, raised)[2];
      expect(raisedPortalPosition(...xyz, 'PZ', size, state)[2] - surface).toBeCloseTo(lift, 12);
    }
  } finally { wormExpansion.amount = before; }
});
