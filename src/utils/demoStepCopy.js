// demoStepCopy.js — the demo's per-step "preview" lines, in one place.
//
// These are the setup sentences Mobi delivers before each demo level (the "Step
// Preview" text). They live here rather than inside DemoFlowController so the
// mode setup wizards can reuse the exact same copy: the preview line a player
// reads in the Worm/Disparity/Random/Freeplay wizard is verbatim the line the
// demo uses for that mechanic. Edit once, both surfaces stay in sync.

export const STEP_COPY = {
  'baby-cube': 'Solve this first twist. Drag the turned row back into place to continue.',
  'twin-paradox': 'Every tile has a twin on the opposite face — one tile, two addresses.',
  'flip-gateway': 'A flip sends a tile through the cube to its twin. Flip the front face over, then back to solve.',
  'view-showcase': 'See every way to view the cube.',
  'worm-traversal': 'This is WORM mode — steer a worm through the cube to heal it.',
  'chaos-forecast': 'This is CHAOS — tiles flip at random until one antipodal pair is left.',
  'random-showcase': 'Random mode picks the rules and the look for you — a new cube every run.',
  'cosmetic-reward': 'Spend the Parity Points you just won in the Store.'
};

// Which demo line each setup wizard borrows for its header preview. Freeplay (the
// cube-mode wizard) uses the twin-paradox line — the core "opposite tiles are
// twins" idea that underpins classic cube play.
export const WIZARD_PREVIEW = {
  freeplay: STEP_COPY['twin-paradox'],
  worm: STEP_COPY['worm-traversal'],
  disparity: STEP_COPY['chaos-forecast'],
  random: STEP_COPY['random-showcase']
};
