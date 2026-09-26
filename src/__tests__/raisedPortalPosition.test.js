import { expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { raisedPortalPosition } from '../worm/raisedPortalPosition.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { wormExpansion } from '../worm/wormExpansion.js';

it.each(['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'])('puts %s warning visuals on the raised pad, independent of global Explode', face => {
  const size = 7, cubies = makeCubies(size), xyz = [3, 3, 3];
  const axis = { X: 0, Y: 1, Z: 2 }[face[1]], sign = face[0] === 'P' ? 1 : -1;
  xyz[axis] = sign > 0 ? 6 : 0;
  cubies[xyz[0]][xyz[1]][xyz[2]].stickers[face].flips = 1;
  const state = { cubies, wormHealerMode: true, demoMode: false, settings: { flipPads: 'off' } };
  const before = wormExpansion.amount;
  try {
    for (const amount of [0, 0.35, 1]) {
      wormExpansion.amount = amount;
      const expected = getStickerWorldPos(...xyz, face, size, 1); expected[axis] += sign * 0.5;
      expect(raisedPortalPosition(...xyz, face, size, state)).toEqual(expected);
    }
    expect(raisedPortalPosition(...xyz, face, size, { ...state, demoMode: true }))
      .toEqual(getStickerWorldPos(...xyz, face, size, 1));
  } finally { wormExpansion.amount = before; }
});
