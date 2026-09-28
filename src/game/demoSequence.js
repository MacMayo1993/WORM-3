// One curriculum shared by entry, progression and the progress display.
export const DEMO_STEPS = [
  { id: 'worm-traversal', label: 'WORM Practice', num: 1 },
  { id: 'baby-cube', label: 'First Twist', num: 2 },
  { id: 'twin-paradox', label: 'Meet the Twins', num: 3 },
  { id: 'flip-gateway', label: 'Through the Middle', num: 4 },
  { id: 'learn-to-solve', label: 'Learn to Solve', num: 5 },
  { id: 'control-tour', label: 'Your Controls', num: 6 },
  { id: 'view-showcase', label: 'Every Look', num: 7 },
  { id: 'make-it-yours', label: 'Settings', num: 8 },
  { id: 'chaos-forecast', label: 'Chaos · Call the Winner', num: 9 },
  { id: 'random-showcase', label: 'Random · Surprise Cube', num: 10 },
  { id: 'cosmetic-reward', label: 'Spend Your Points', num: 11 },
  { id: 'end', label: 'Complete', num: 12 },
];
export const DEMO_STEP_IDS = DEMO_STEPS.map(step => step.id);
export const nextDemoStep = id => DEMO_STEP_IDS[DEMO_STEP_IDS.indexOf(id) + 1] ?? 'end';
