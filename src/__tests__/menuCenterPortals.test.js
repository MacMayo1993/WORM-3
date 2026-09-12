import { expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { flipMenuCenters, MENU_FLIP_PAIRS } from '../components/menus/menuCenterPortals.js';

it('flips exactly the six center stickers and preserves the input', () => {
  const original = makeCubies(3);
  const result = flipMenuCenters(original);
  let count = 0;
  result.flat(2).forEach(c => Object.values(c.stickers).forEach(s => { if (s.curr !== s.orig) count++; }));
  expect(count).toBe(6);
  expect(original.flat(2).every(c => Object.values(c.stickers).every(s => s.curr === s.orig))).toBe(true);
  expect(flipMenuCenters(result)).toEqual(result);
  expect(new Set(MENU_FLIP_PAIRS.flat().map(f => f.dir)).size).toBe(6);
});
it('keeps each center flipped after middle-slice turns without toggling off', () => {
  let cube = flipMenuCenters(makeCubies(3));
  for (const axis of ['row', 'col', 'depth']) {
    cube = flipMenuCenters(rotateSliceCubies(cube, 3, axis, 1, 1));
    for (const face of MENU_FLIP_PAIRS.flat()) {
      const [x, y, z] = face.cubie;
      const sticker = cube[x][y][z].stickers[face.dir];
      expect(sticker.curr).toBe(ANTIPODAL_COLOR[sticker.orig]);
    }
  }
});
