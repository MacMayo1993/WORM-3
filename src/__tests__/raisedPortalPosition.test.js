import { expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { raisedPortalPosition } from '../worm/raisedPortalPosition.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { WORM_PAD_HEIGHT } from '../worm/healerWorm/raisedPlatforms.js';

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
      const expected = getStickerWorldPos(...xyz, face, size, Math.max(0.5, amount)); expected[axis] += sign * 0.5;
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
    const raised = getStickerWorldPos(...xyz, 'PZ', size, 0.5);
    raised[2] += WORM_PAD_HEIGHT;
    expect(raisedPortalPosition(...xyz, 'PZ', size, { ...base, chaosLevel: 1, disparityFlipCap: 8 })).toEqual(raised);
    // Under the standard cap the same tile is spent, so its rings stay on the floor.
    expect(raisedPortalPosition(...xyz, 'PZ', size, base)).toEqual(getStickerWorldPos(...xyz, 'PZ', size, 0));
  } finally { wormExpansion.amount = before; }
});

