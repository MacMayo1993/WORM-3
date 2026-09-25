// Shared setup identity. Every mode owns one face of the Rubik's cube and wears
// that face's colour everywhere: its carousel face, its primary key, selection
// tints and progress marks. `ink` is the readable text colour on that fill;
// `shadow` is the arcade ink its keys sit on (see ARCADE_* in uiTheme.js).
import { RUBIKS_FACE_COLORS, DIR_TO_COLOR, readableInk } from './constants.js';

const INK_STRONG = '#354d3c';
const face = (name, dir) => {
  const accent = RUBIKS_FACE_COLORS[DIR_TO_COLOR[dir]];
  return { name, face: dir, accent, ink: readableInk(accent), shadow: INK_STRONG };
};

export const MODE_THEMES = {
  worm: face('WORM', 'NX'),     // green
  cube: face('Cube', 'NY'),     // yellow
  teach: face('Teach', 'PX'),   // blue
  chaos: face('Chaos', 'NZ'),   // orange
  random: face('Random', 'PZ'), // red
  store: face('Store', 'PY'),   // white
};

export function modeTheme(mode) {
  const key = String(mode).toLowerCase();
  return MODE_THEMES[key.includes('worm') ? 'worm' : key.includes('chaos') || key.includes('disparity') ? 'chaos'
    : key.includes('random') ? 'random' : key.includes('teach') || key.includes('story') ? 'teach' : key.includes('store') ? 'store' : 'cube'];
}

export const PACK_ACCENTS = { 'story-campaign': '#3b82f6', 'cube-academy': '#5f7f4a', 'algorithm-codex': '#b06a2e' };
