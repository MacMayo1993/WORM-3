import { PER_CUBELET_VIEW_STYLES } from '../../3d/cubeViewStyles.js';

export const VIEW_POWER_DURATION = 20;
const LOOKS = {
  classic: ['Classic', '#fbbf24'], grid: ['Grid', '#60a5fa'],
  sudokube: ['Sudoku', '#fb923c'], wireframe: ['Wireframe', '#a3e635'],
  glass: ['Glass', '#b9f3ff'], chrome: ['Chrome', '#cbd5e1'],
  neon: ['Neon', '#e879f9'], gap: ['Gap', '#c4b5fd'], lego: ['LEGO', '#f87171'],
};
const CUBE_ICON = 'M12 2 22 7v10l-10 5L2 17V7zM2 7l10 5 10-5M12 12v10';

// Namespaced IDs keep visual styles independent of elemental gameplay effects.
export const VIEW_POWER_DEFS = Object.fromEntries(PER_CUBELET_VIEW_STYLES.map(view => {
  const [label, color] = LOOKS[view];
  return [`view-${view}`, { label: `${label} Cube`, view, color, accent: '#ffffff',
    particle: 'ions', iconPath: CUBE_ICON, iconAccent: '',
    description: `Transform the whole cube to ${label} for ${VIEW_POWER_DURATION} seconds of play, then restore its previous appearance.` }];
}));
export const VIEW_POWER_TYPES = Object.keys(VIEW_POWER_DEFS);
export const isViewPower = type => Object.prototype.hasOwnProperty.call(VIEW_POWER_DEFS, type);
export const getViewPowerDef = type => VIEW_POWER_DEFS[type] ?? null;

// A separate fair bag gives every view a turn without overwhelming the other powers.
export function drawViewPower(picker, rand) {
  if (!picker.views?.length) {
    picker.views = VIEW_POWER_TYPES.slice();
    for (let i = picker.views.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [picker.views[i], picker.views[j]] = [picker.views[j], picker.views[i]];
    }
    if (picker.views[0] === picker.lastView) picker.views.push(picker.views.shift());
  }
  return (picker.lastView = picker.views.shift());
}
