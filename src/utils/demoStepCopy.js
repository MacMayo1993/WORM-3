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
  'baby-cube': 'Let’s start small. Watch two turns, then drag a row or column to try a twist yourself.',
  'learn-to-solve': 'Stuck? I can help. Follow the gold layer guide, one turn at a time.',
  'control-tour': 'Let’s find your controls. Tap each highlighted button to see what it does.',
  'twin-paradox': 'Every tile has a twin on the opposite side. Turn on Flip, then tap a tile to move the pair together.',
  'flip-gateway': 'Send nine tile pairs through the middle, then bring them back. Start with the face in front of you.',
  'view-showcase': 'Let’s look at the same cube in a few different ways. Use Next to explore each view.',
  'make-it-yours': 'Make this cube yours. Pick colors, tiles, and a background, then close Settings. Your choices stay saved.',
  'worm-traversal': 'Follow the worm! Steer left or right, collect glowing orbs, and enter tunnels to heal the cube.',
  'chaos-forecast': 'Which color pair will last? Pick one, then watch the cube flip until a pair survives.',
  'random-showcase': 'Feeling curious? Random mixes the rules and the look. Watch a remix, then move on whenever you like.',
  'cosmetic-reward': 'Let’s visit the Store. Browse the looks and spend Parity Points on a favorite—or save them for later.'
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
