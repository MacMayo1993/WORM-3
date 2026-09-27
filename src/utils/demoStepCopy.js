// demoStepCopy.js — the demo's per-step "preview" lines, in one place.
//
// These are the setup sentences Mobi delivers before each demo level (the "Step
// Preview" text). They are the one place each step names the rule it is about
// to exercise, so every mechanic the step's hands-on phase depends on has to be
// stated here or in the step's own on-screen guidance — a player should never
// finish a step without having been told what finishes it.
//
// House style for every line below: plain language first. The cube's novelty is
// that opposite tiles are the same tile, and the words for that are "twin" and
// "straight through the middle" — never "antipodal", "manifold", "parity" or
// "RP2". The formal name is dropped exactly once, as an aside, in
// TWIN_ASIDE — someone who wants the math can look it up, and everyone else
// never has to care.

export const STEP_COPY = {
  // The step completes only when the cube is solved again, so the goal is part
  // of the line — "try a twist" alone left players twisting with no finish.
  'baby-cube': 'Let’s start small. Watch two turns, then twist the cube back until every face is one color.',
  'learn-to-solve': 'Stuck? I can help. Follow the gold layer guide, one turn at a time.',
  'control-tour': 'Let’s find your controls. Tap each highlighted button to see what it does.',
  'twin-paradox': 'Every tile has a twin on the opposite side. Turn on Flip, then tap a tile to move the pair together.',
  'flip-gateway': 'Send nine tile pairs through the middle, then bring them back. Start with the face in front of you.',
  'view-showcase': 'Let’s look at the same cube in a few different ways. Use Next to explore each view.',
  'make-it-yours': 'Make this cube yours. Pick colors, tiles, and a background, then close Settings to preview your look. Press Next: Chaos when you’re ready. Your choices stay saved.',
  'worm-traversal': 'Steer, collect orbs, and jump onto raised flip pads to ride their tunnels. Practice also covers power-ups, elements, and hazards.',
  // The round's live HUD keeps its rules behind "Inspect match", so the setup
  // line carries the three the player acts on: aim the first strike, flips wear
  // tiles out in twin pairs, and taps heal.
  'chaos-forecast': 'Which color pair will last? Pick one, then tap where the storm strikes first. Flips wear tiles out, and worn-out twins drop out together. Tap damaged tiles to heal them.',
  // Random remixes the look only (useRandomMode); the rules never change.
  'random-showcase': 'Feeling curious? Random remixes the colors and tile looks every ten seconds while you solve. Only the look changes; the puzzle stays the same.',
  'cosmetic-reward': 'Let’s visit the Store. Spend Parity Points on new worms with their own signature moves, trails, hats, palettes, and tiles—or save them. WORM runs, Chaos rounds, and first solves earn more.'
};

// These modes need a briefing before their timers or launch controls begin.
// Each page explains one part of the mode and waits for the player's Next tap.
export const STEP_INTRO_LINES = {
  'chaos-forecast': [
    'Chaos is a survival round. A storm flips tiles and spreads across the cube. The last surviving twin pair wins; you can watch the storm or help your favorites survive.',
    'Each tile has a twin on the opposite side. Every flip uses some of their life. At the flip limit, worn-out twins drop out together. Watch the live counters to see which colors are still in the round.',
    'First, choose the color pair you think will win. This demo prediction is free. After confirming your pick, tap a tile to choose where the storm strikes first; the countdown then starts the round.',
    'During the storm, tap a damaged tile to heal it and send a healing wave through connected damaged tiles. Lost tiles cannot return. Healing can change the winner, so act before your pair disappears!',
    'When one twin pair remains, the results show who survived. Press Next: Random whenever you’re ready to leave this practice, even during the storm. Full Chaos mode also offers predictions on the last color, winning pair, first color out, or collapse speed.',
  ],
  'random-showcase': [
    'Random is a cube puzzle with a changing look. Solve it while the palette and tile styles remix every ten seconds. Your goal is still to make every face one color.',
    'Individual cubelets can switch between solid, glass, wireframe, numbered, and grid looks. The cube’s size and background stay fixed, so you can focus on following the pieces through each new look.',
    'A remix does not scramble the cube again or undo your moves. Matching pieces still belong together when their colors change. Keep making the same twists you learned earlier; only their appearance changes.',
    'This practice starts with a scrambled 3×3. Try a few turns and watch a remix, or solve the whole cube. Choose Skip lesson whenever you’re ready to move on; the look you chose in Settings returns afterward.',
  ],
};

// The one place the demo names the math. Shown as an aside after the player has
// already felt the mechanic, so the concept lands before the jargon does.
export const TWIN_ASIDE = 'Mathematicians call those two spots an antipodal pair. "Twins" works fine.';
