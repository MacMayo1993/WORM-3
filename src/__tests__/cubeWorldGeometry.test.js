import { expect, it } from 'vitest';
import { cubieCenterInto, cubeGridIndex } from '../game/cubeWorldGeometry.js';
import { getStickerWorldPos } from '../game/gridIds.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
it.each([2, 3, 4, 5, 7, 15])('keeps cubie centers and every sticker face aligned at size %s', size => {
  for (const amount of [0, .25, 1]) {
    const center = cubieCenterInto([], size - 1, 0, size - 1, size, amount);
    const scale = 1 + amount * (size < 4 ? 1.8 : 1.53);
    expect(center).toEqual([(size - 1) / 2 * scale, -(size - 1) / 2 * scale, (size - 1) / 2 * scale]);
    for (const [face, axis, sign] of [['PX', 0, 1], ['NX', 0, -1], ['PY', 1, 1], ['NY', 1, -1], ['PZ', 2, 1], ['NZ', 2, -1]]) {
      const sticker = getStickerWorldPos(size - 1, 0, size - 1, face, size, amount);
      for (let i = 0; i < 3; i++) expect(sticker[i] - center[i]).toBeCloseTo(i === axis ? SURFACE_OFFSET * sign : 0, 10);
    }
  }
});

it.each([3, 5, 15])('round trips every intro fallback lattice index at size %s', size => {
  for (const amount of [0, .5, 1]) for (let index = 0; index < size; index++) {
    const world = cubieCenterInto([], index, index, index, size, amount);
    expect(cubeGridIndex(world[0], size, amount)).toBe(index);
  }
});
