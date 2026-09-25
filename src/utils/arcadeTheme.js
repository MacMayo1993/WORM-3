// arcadeTheme.js — which colour each mode's primary key wears.
//
// The mode carousel paints every mode on its own cube face and colours its PLAY
// key with that face (MODE_THEMES). Screens reached from a mode reuse the same
// pairing, so "Try again" after a WORM run is the same green key as "PLAY WORM".
import { MODE_THEMES, modeTheme } from './modeThemes.js';

export function arcadeModeColors(mode = 'worm') {
  const theme = MODE_THEMES[mode] ?? modeTheme(mode);
  return { fill: theme.accent, ink: theme.ink };
}

/** CSS custom properties for an arcade surface in `mode`. */
export function arcadeModeVars(mode) {
  const { fill, ink } = arcadeModeColors(mode);
  return { '--arcade-accent': fill, '--arcade-accent-ink': ink };
}
