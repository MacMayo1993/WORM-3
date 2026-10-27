# Action cues and short challenges

`src/game/actionCues.js` owns the shared meanings: linked pair (double rings / ↔), layer turn (arrows), target (diamond), danger (triangle), and confirmed completion (check). Colour always accompanies a shape or word; it never changes sticker identity. Help and the WORM pause menu contain the expandable **Read the cube** guide. The same definitions feed teaching turn guides, layer rims, solver/selection colours, practice targets, and challenge cards. A safe tunnel uses the link symbol, not the completion check.

`ActionPairPreview` draws only two outlined markers over the real sticker anchors. Cube challenges can nominate a grid identity; keyboard flip selection resolves the cursor's current identity. Both use the gameplay manifold map and effective flip cap. Anchors follow the actual tile transforms through flips, turns, and expansion. The markers are depth tested, static under reduced motion, and never intercept input. They indicate linkage, not a guaranteed solve or safe traversal.

## WORM

Choose **WORM → Short Challenges → Start challenges**:

1. **Grow, ride, restore:** collect the two authored orbs, jump onto the pad, ride the tunnel, and clear the tail after healing.
2. **Cross your own route:** jump over the staged body crossing and land safely.
3. **Close the loop:** occupy the eight-tile ring around the opening to heal the pair.

This is a separate course on the existing practice runtime. It does not replace the full demo or change Story saves. `practiceId` lets the crossing and surround tasks use their existing staging and outcome checks; the collection/healing task has no preloaded inventory. Retry rebuilds the board and clears run counters. Next is disabled until the simulation reports completion. Skip never records completion. Finish and Exit restore the player's settings and character and return to the menu, without launching the rest of the demo or awarding the full-demo discovery reward.

## Cube puzzles

**TEACH → Cube puzzle campaigns → Short Challenges** opens six 3×3 puzzles. They occupy IDs 501–506, outside campaign and Daily ranges. Each uses authored turns/flips, so retries reproduce the same board. All are selectable. Stars and completion use the existing puzzle records; XP is classified as cube practice. Their exact one- to three-action pars are checked with the mixed turn/flip solver, and the returned solution is replayed against the game engine in tests.

## Validation

Tests cover exact pars and playable solutions, identity-preserving preview lookup and cap handling, collection and tunnel-tail completion through the live WORM hook, retry/skip gates, course launch/exit restoration, and entry-screen navigation. The browser smoke checks open the real WORM course from its menu on desktop and phone, and launch the cube pack through Teach. They verify that the mode picker closes, challenge controls remain usable, and the linked-pair objective is displayed.

Verified on this change: 7,143 tests across 460 files; all three Chromium browser checks; production build; lint with no errors; bundle budget (551.2 KB Brotli, below the 640 KB limit); and `git diff --check`.
