// Shared setup identity: accents describe the mode; tile colors describe the palette.
export const MODE_THEMES = {
  cube: { name: 'Cube', accent: '#f4d35e', shadow: '#92752a', tagline: 'Make it your manifold.' },
  worm: { name: 'WORM', accent: '#88e59a', shadow: '#367347', tagline: 'Choose your crawler. Find your flow.' },
  chaos: { name: 'Chaos', accent: '#ffad70', shadow: '#9a542b', tagline: 'Set the stage. Call the survivors.' },
  random: { name: 'Random', accent: '#bda0ff', shadow: '#665091', tagline: 'A new twist every time.' },
};
export function modeTheme(mode) {
  const key = String(mode).toLowerCase();
  return MODE_THEMES[key.includes('worm') ? 'worm' : key.includes('chaos') || key.includes('disparity') ? 'chaos' : key.includes('random') ? 'random' : 'cube'];
}
