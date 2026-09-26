import { STICKER_OFFSET } from '../../3d/rubiksPiece.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';

// The overlay sits above the domed sticker; navigation uses this same mouth.
export const MENU_PORTAL_OVERLAY_Z = 0.026;
export const MENU_SURFACE_HALF = 1 + STICKER_OFFSET + MENU_PORTAL_OVERLAY_Z;

export const MENU_FLIP_PAIRS = [
  [
    { dir: 'PZ', cubie: [1, 1, 2], pos: [0, 0,  MENU_SURFACE_HALF], rot: [0, 0, 0] },
    { dir: 'NZ', cubie: [1, 1, 0], pos: [0, 0, -MENU_SURFACE_HALF], rot: [0, Math.PI, 0] },
  ],
  [
    { dir: 'PX', cubie: [2, 1, 1], pos: [ MENU_SURFACE_HALF, 0, 0], rot: [0,  Math.PI / 2, 0] },
    { dir: 'NX', cubie: [0, 1, 1], pos: [-MENU_SURFACE_HALF, 0, 0], rot: [0, -Math.PI / 2, 0] },
  ],
  [
    { dir: 'PY', cubie: [1, 2, 1], pos: [0,  MENU_SURFACE_HALF, 0], rot: [-Math.PI / 2, 0, 0] },
    { dir: 'NY', cubie: [1, 0, 1], pos: [0, -MENU_SURFACE_HALF, 0], rot: [ Math.PI / 2, 0, 0] },
  ],
];

// Make every face center a portal without toggling it back on later cycles.
export function flipMenuCenters(cubies) {
  return cubies.map((plane, x) => plane.map((row, y) => row.map((cubie, z) => {
    const face = MENU_FLIP_PAIRS.flat().find(f => f.cubie[0] === x && f.cubie[1] === y && f.cubie[2] === z);
    if (!face) return cubie;
    const sticker = cubie.stickers[face.dir];
    return { ...cubie, stickers: { ...cubie.stickers, [face.dir]: { ...sticker, curr: ANTIPODAL_COLOR[sticker.orig], flips: 1 } } };
  })));
}
