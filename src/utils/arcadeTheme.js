// arcadeTheme.js — which colour each mode's primary key wears.
//
// The mode carousel paints every mode on its own cube face and colours its PLAY
// key with that face. Screens reached from a mode reuse the same pairing, so
// "Try again" after a WORM run is the same green key as "PLAY WORM".
import { RUBIKS_FACE_COLORS, DIR_TO_COLOR, readableInk } from './constants.js';

export const ARCADE_MODE_FACE = {
  worm: 'NX', cube: 'NY', freeplay: 'NY', teach: 'PX', story: 'PX',
  chaos: 'NZ', disparity: 'NZ', random: 'PZ', store: 'PY',
};

export function arcadeModeColors(mode = 'worm') {
  const fill = RUBIKS_FACE_COLORS[DIR_TO_COLOR[ARCADE_MODE_FACE[mode] ?? 'NX']];
  return { fill, ink: readableInk(fill) };
}

/** CSS custom properties for an arcade surface in `mode`. */
export function arcadeModeVars(mode) {
  const { fill, ink } = arcadeModeColors(mode);
  return { '--arcade-accent': fill, '--arcade-accent-ink': ink };
}
