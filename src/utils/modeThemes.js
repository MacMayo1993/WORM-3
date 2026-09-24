// Shared setup identity: accents describe the mode; tile colors describe the palette.
export const MODE_THEMES = {
  cube: { name: 'Cube', accent: '#39a8ff', shadow: '#1664b5' },
  worm: { name: 'WORM', accent: '#56e542', shadow: '#208329' },
  teach: { name: 'Teach', accent: '#ffd52d', shadow: '#be8509' },
  chaos: { name: 'Chaos', accent: '#ff765d', shadow: '#be4734' },
  random: { name: 'Random', accent: '#bda0ff', shadow: '#665091' },
};
export function modeTheme(mode) {
  const key = String(mode).toLowerCase();
  return MODE_THEMES[key.includes('worm') ? 'worm' : key.includes('teach') ? 'teach' : key.includes('chaos') || key.includes('disparity') ? 'chaos' : key.includes('random') ? 'random' : 'cube'];
}

export const PACK_ACCENTS = { 'story-campaign': '#3b82f6', 'cube-academy': '#5f7f4a', 'algorithm-codex': '#b06a2e' };
