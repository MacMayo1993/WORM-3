// One identity list for labels, picker membership and animation registration.
export const LIVING_SURFACE_LABELS = [
  'Breathing Scales', 'Coral Polyps', 'Amoeba Mosaic', 'Mycelium Veins',
  'Chromatic Cilia', 'Iris Tessellation', 'Ribbon Estuary', 'Pearl Membrane',
  'Origami Tide', 'Lenticular Waves', 'Quilted Space', 'Phase Labyrinth',
  'Ripple Interlock', 'Elastic Honeycomb', 'Living Contour', 'Kaleido Bloom',
  'Folded Horizon', 'Magnetic Rosettes', 'Prismatic Faults', 'Domino Drift',
];
export const LIVING_SURFACE_KEYS = LIVING_SURFACE_LABELS.map(label =>
  label[0].toLowerCase() + label.slice(1).replaceAll(' ', ''));
export const LIVING_SURFACE_STYLES = Object.fromEntries(LIVING_SURFACE_KEYS.map((key, i) =>
  [key, { label: LIVING_SURFACE_LABELS[i], cost: key === 'amoebaMosaic' ? 'med' : 'low', type: 'animated' }]));
