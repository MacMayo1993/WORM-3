// demoStepCopy.js — the demo's per-step "preview" lines, in one place.
//
// These are the setup sentences Mobi delivers before each demo level (the "Step
// Preview" text). They live here rather than inside DemoFlowController so the
// mode setup wizards can reuse the exact same copy: the preview line a player
// reads in the Worm/Disparity/Random/Freeplay wizard is verbatim the line the
// demo uses for that mechanic. Edit once, both surfaces stay in sync.
//
// House style for every line below: plain language first. The cube's novelty is
// that opposite tiles are the same tile, and the words for that are "twin" and
// "straight through the middle" — never "antipodal", "manifold", "parity" or
// "RP2". The formal name is dropped exactly once, as an aside, in
// TWIN_ASIDE — someone who wants the math can look it up, and everyone else
// never has to care.

export const STEP_COPY = {
  'baby-cube': 'Start easy: a cube that twists like any other. I turned two rows — drag them back to solve it.',
  'learn-to-solve': 'You never have to solve alone. I scrambled three turns — a gold guide will light up each layer to turn. Follow it home.',
  'control-tour': 'Five buttons run this whole game. Let me hand them to you one at a time — press each one as it lights up.',
  'twin-paradox': 'Every tile has a twin: the tile dead opposite it, straight through the middle of the cube. Touch one and both move.',
  'flip-gateway': 'Tapping a tile sends it through the middle to its twin. Send the whole front face across, then bring it home.',
  'view-showcase': 'Same cube, eleven different looks. Try them on.',
  'make-it-yours': 'Colors, tiles, backgrounds — set the cube up how you like it. Whatever you pick here, you keep.',
  'worm-traversal': 'This is WORM mode — steer a worm over the cube and dive through a twin tunnel to heal it.',
  'chaos-forecast': 'This is CHAOS — tiles jump to their twins at random until just one pair of colors is left. Call it early.',
  'random-showcase': 'Random mode picks the rules and the look for you — a new cube every run.',
  'cosmetic-reward': 'Spend the Parity Points you just won in the Store.'
};

// The one place the demo names the math. Shown as an aside after the player has
// already felt the mechanic, so the concept lands before the jargon does.
export const TWIN_ASIDE = 'Mathematicians call those two spots an antipodal pair. "Twins" works fine.';

// Which demo line each setup wizard borrows for its header preview. Freeplay (the
// cube-mode wizard) uses the twin-paradox line — the core "opposite tiles are
// twins" idea that underpins classic cube play.
export const WIZARD_PREVIEW = {
  freeplay: STEP_COPY['twin-paradox'],
  worm: STEP_COPY['worm-traversal'],
  disparity: STEP_COPY['chaos-forecast'],
  random: STEP_COPY['random-showcase']
};
