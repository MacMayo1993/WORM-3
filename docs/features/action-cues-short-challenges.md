# Action cues and short challenges

`src/game/actionCues.js` owns the shared meanings: linked pair (double rings / ↔), layer turn (arrows), target (diamond), danger (triangle), and confirmed completion (check). Colour always accompanies a shape or word; it never changes sticker identity. Help and the WORM pause menu contain the expandable **Read the cube** guide. The same definitions feed teaching turn guides, layer rims, solver/selection colours, practice targets, and challenge cards. A safe tunnel uses the link symbol, not the completion check.

`ActionPairPreview` draws only two outlined markers over the real sticker anchors. Cube challenges can nominate a grid identity; keyboard flip selection resolves the cursor's current identity. Both use the gameplay manifold map and effective flip cap. Anchors follow the actual tile transforms through flips, turns, and expansion. The markers are depth tested, static under reduced motion, and never intercept input. They indicate linkage, not a guaranteed solve or safe traversal.

## WORM

Choose **WORM → Short Challenges → Start challenges**:

1. **Grow, ride, restore:** route through four scattered orbs, jump onto the pad, heal the pair, and clear the tail.
2. **Cross your own route:** double-jump over the staged body, land safely, and collect three orbs on a turning route.
3. **Close the loop:** collect the four front-face corner orbs to earn enough body length, then surround the opening. The ring is no longer traced out for the player.

All three have a 25-second active-play limit and increasing speeds (2.6, 2.8, 3.0). Only the authored, non-respawning pickup supply counts toward the goals. The clock reads the simulation, stops for help, pause, tab blur and forced holds, and excludes tunnel travel. Expiry ends the attempt without awarding completion; Retry resets the board and clock. Successful challenges pause for the result. The ordinary full demo retains its untimed, guided practice behavior.

During play, the challenge card folds to a goal/progress strip. Its **?** button pauses play and opens instructions, Resume, Retry and Skip. Skipping never records completion. Finish and Exit restore the player's settings and character and return to the menu without awarding the full-demo discovery reward.

## Cube puzzles

**TEACH → Cube puzzle campaigns → Short Challenges** opens six mixed turn/flip 3×3 puzzles with 4–9 move targets. The v2 boards use IDs 511–516, so stars earned on the retired one- to three-action boards (501–506) do not count as clearing the harder replacements. Existing saves are not deleted.

Each board uses a deterministic reversible setup. Par is the replay-verified authored solution length, not a claim of global optimality. Tests also exhaustively reject solutions of at most three actions for the opening boards and four for the later boards. All puzzles are selectable, and completion uses the existing puzzle records and cube-practice XP.

Challenges open directly into the board. Their objective starts folded to a small move-counter strip on every puzzle; hints remain optional and do not list the solution. No automatic pair marker gives away the repair. This does not alter the player's persisted Story guidance preference.

## Validation

Tests cover reversible solutions and shortcut bounds, complete WORM routes through the live simulation, double-crossing and landing credit, clock/expiry/retry behavior, help pauses, folded guidance and Story preference preservation. Browser checks launch both challenge modes through the real menus on desktop and phone, and bound the live guidance card's height.
