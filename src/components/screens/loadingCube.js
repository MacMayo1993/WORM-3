// The loading cube's layout: the opening's black-plastic Rubik's cube (IntroScene)
// rebuilt from CSS 3D planes, so the loader never needs a WebGL context.
//
// The cube is three horizontal layers so the top one can twist on its own, as it
// clacks home when the opening cube lands. Each layer carries its four side
// strips (3 stickers each); the top and bottom layers add their 3×3 caps, and the
// middle layer a black plastic cap that shows where the twisting top uncovers it.

import { ANTIPODAL_COLOR } from '../../utils/constants.js';

// Face ids follow constants.js: front PZ red, left NX green, top PY white,
// back NZ orange, right PX blue, bottom NY yellow.
const SIDES = {
  front: { id: 1, normal: [0, 0, 1], across: [1, 0, 0], down: [0, 1, 0] },
  right: { id: 5, normal: [1, 0, 0], across: [0, 0, -1], down: [0, 1, 0] },
  back: { id: 4, normal: [0, 0, -1], across: [-1, 0, 0], down: [0, 1, 0] },
  left: { id: 2, normal: [-1, 0, 0], across: [0, 0, 1], down: [0, 1, 0] },
  top: { id: 3, normal: [0, -1, 0], across: [1, 0, 0], down: [0, 0, 1] },
  bottom: { id: 6, normal: [0, 1, 0], across: [1, 0, 0], down: [0, 0, -1] }
};

/** Side strips in the order the top layer carries them round: each twist moves a strip one place on. */
export const RING = ['front', 'right', 'back', 'left'];

// The cube sits at this yaw (CSS rotateY, degrees): front on the left, right on the right.
export const CUBE_YAW = -36;

/** How long the sticker flip wave takes to cross the cube, in seconds. */
export const WAVE_SPREAD = 0.8;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * When the flip wave reaches a sticker: 0 at the top-left of the cube as seen,
 * 1 at the bottom-right — the order the opening's wave uses (introMotion.js).
 * `p` is the sticker centre in cubie units, CSS axes (y down, z to the viewer).
 */
export function waveOrder(p) {
  const yaw = (CUBE_YAW * Math.PI) / 180;
  const across = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
  const reach = 1.5 * (Math.abs(Math.cos(yaw)) + Math.abs(Math.sin(yaw)));
  return clamp01(((p[1] + 1.5) / 3) * 0.7 + ((across + reach) / (2 * reach)) * 0.3);
}

function stickersFor(side, row) {
  const { normal, across, down } = SIDES[side];
  const rows = row === null ? [0, 1, 2] : [1];
  const stickers = [];
  for (const j of rows) {
    for (let i = 0; i < 3; i++) {
      const p = [0, 1, 2].map((axis) => 1.5 * normal[axis] + (i - 1) * across[axis] + (j - 1) * down[axis]);
      // A strip takes its height from the layer it belongs to.
      if (row !== null) p[1] = row;
      stickers.push({ key: `${side}-${row ?? 'cap'}-${j}-${i}`, delay: +(waveOrder(p) * WAVE_SPREAD).toFixed(3) });
    }
  }
  return stickers;
}

const face = (side, row, cap = false) => ({
  side,
  cap,
  color: SIDES[side].id,
  antipode: ANTIPODAL_COLOR[SIDES[side].id],
  stickers: stickersFor(side, cap ? null : row)
});

/** The three layers, top to bottom, with every face and sticker they carry. */
export const LOADING_CUBE = [
  { key: 'top', row: -1, faces: [...RING.map((s) => face(s, -1)), face('top', -1, true)], plastic: [] },
  { key: 'mid', row: 0, faces: RING.map((s) => face(s, 0)), plastic: ['top'] },
  { key: 'bottom', row: 1, faces: [...RING.map((s) => face(s, 1)), face('bottom', 1, true)], plastic: [] }
];
