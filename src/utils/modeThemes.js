// Shared setup identity: accents describe the mode; tile colors describe the palette.
export const MODE_THEMES = {
  cube: { name: 'Cube', accent: '#f4d35e', shadow: '#92752a' },
  worm: { name: 'WORM', accent: '#88e59a', shadow: '#367347' },
  chaos: { name: 'Chaos', accent: '#ffad70', shadow: '#9a542b' },
  random: { name: 'Random', accent: '#bda0ff', shadow: '#665091' },
};
export function modeTheme(mode) {
  const key = String(mode).toLowerCase();
  return MODE_THEMES[key.includes('worm') ? 'worm' : key.includes('chaos') || key.includes('disparity') ? 'chaos' : key.includes('random') ? 'random' : 'cube'];
}

export const PACK_ACCENTS = { 'story-campaign': '#3b82f6', 'cube-academy': '#5f7f4a', 'algorithm-codex': '#b06a2e' };
