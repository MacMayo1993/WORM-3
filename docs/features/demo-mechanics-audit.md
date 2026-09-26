# Demo mechanics audit — September 26, 2026

The core tour, optional Explore tour, and every WORM practice lesson were checked against the current game paths. WORM now has **18 lessons**: the double-jump lesson was removed in this pass and restored in the second pass below, after the mid-air arc was fixed.

## Shared mechanisms

WORM practice now uses the same raised cubies, energy pads, two-second platform formation, Möbius bands, jump aim, landing height, camera target, tunnel anchors, exit route, and body-collision jump rescue as live runs. Walking underneath a flipped tile does not enter its tunnel. Pause and reduced-motion behavior remain shared with live play. The tunnel HUD describes jump entry in practice too.

Tunnel exercises start within the production two-tile jump aim window. Their target marker follows the platform's live formation and disappears when the task is complete. Ring markers remain on the crawlable floor. Healing inventory uses the production orb-growth constant and current face colors.

## WORM curriculum

| Lesson | Mechanism / completion checked |
| --- | --- |
| Steering | Real turn input; practice continues after success. |
| Orbs | Production pickups; two orbs give six charges. |
| Jump | One surface jump must land. |
| Double jump | Two presses in one flight, then a landing (restored in the second pass). |
| Boost | Actual timed burst must finish. |
| Tunnel | JUMP captures the raised platform; completion waits for the tail to exit. No charges means the pair stays open. |
| Healing | Same jump route; four matching charges seal both ends after tail clearance, leaving two. |
| Surround | All eight floor tiles must be covered by the current body; normal ring healing flips the pair home. |
| Rocket | Actual pickup and steerable flight; wait for landing. |
| Magnet | Actual pickup and nearby-orb collection through live two-tile reach. |
| Water | Live straight-line momentum must build, with the ordinary turning penalty. |
| Fire | Live fire patches must exist. Copy describes route firebreaks and accelerated bomb fuses. |
| Nature | Land to grow a spring, then launch from it. These are two separate grounded jumps. |
| Ice | Jump out of the grounded turn delay. |
| Lightning | Actual elemental pickup and storm effect. |
| Signature | Glow Worm's Light Trail must paint at least two tiles behind the tail; pressing the button alone cannot finish. |
| Bomb | Authored bomb uses the live fuse and full-body disarm ring; no real currency reward. |
| Rotation | Live warning clock and slice rotation; completion waits for the rotation commit. |

## Cube and Explore tour

| Stage | Current path |
| --- | --- |
| First Twist | Shared animated rotation and puzzle completion. |
| Meet the Twins | Normal paired flip handler and raised cube presentation. |
| Through the Middle | Normal nine-pair flip/return task and tunnel renderer. |
| Learn to Solve | Existing Kociemba-backed Teach pipeline. |
| Your Controls | Current navigation buttons/sheets and measured targets. |
| Every Look | Current view settings and renderers. |
| Settings | Real settings panel with borrowed demo settings restored on exit. |
| Call the Winner | Current Chaos round/prediction flow. |
| Surprise Cube | Current Random mode. |
| Spend Your Points | Real store route. |

The cube and Explore mechanisms already used current handlers; no replacement implementations were needed.

## Deliberate practice scaffolding

Lessons retain authored targets, supplied ring length/healing charges, isolated hazards, and explicit Try it / Retry / Next controls. Random tunnel/pickup spawns and ambient combat remain suppressed so they cannot interrupt the exercise. Practice awards no run XP or coins. Goal completion does not pause the worm or automatically skip the lesson.

Regression coverage exercises the crawler, HUD controls, renderer formation/markers, energy pads, bands, camera aim, hazard scheduler, and existing cube-demo progression/settings/mobile layout tests. Browser checks cover the raised tunnel and healing routes using the visible JUMP button in a mobile viewport.

## Explanation coverage by mode — September 26, 2026 (second pass)

The pass above checked that demo steps *use* the live handlers. This pass checked
the other half: that every rule each mode runs on is *told* to the player
somewhere in the demo, and told the way the code enforces it. Ground truth was
read from the mode code, not from older docs. Each row names where the demo now
explains the rule. **Fixed** marks copy or flow changed in this pass;
**Deferred** marks a gap left for a product decision.

### Flip Cube (First Twist, Meet the Twins, Through the Middle, Your Controls)

| Rule (source) | Where the demo explains it | Status |
| --- | --- | --- |
| Goal: every face one color (`checkRubiksSolved`) | First Twist setup line and hint. Previously the step only said "try a twist" while completing only on a solve. | Fixed |
| Drag a row/column; drag empty space to orbit | First Twist hint | OK |
| Flip toggle turns taps into pair flips | Meet the Twins spotlight + tour Flip beat | OK |
| A flip moves a tile and its twin together | Meet the Twins; Far Side view | OK |
| Tile life: six flips per pair, then grey and unflippable (`FLIP_CAP`) | Through the Middle completion note | Fixed (was never mentioned) |
| Re-flipping spends life; Undo returns it (`unflipStickerPair`) | Through the Middle completion note; tour Undo beat | Fixed |
| Three-second rest after a pair moves (`REFRACTORY_MS`) | Through the Middle "bring them home" card, where a quick re-tap is likeliest | Fixed |
| Undo (the bar's first key in live play) | New tour beat between Shuffle and Flip: twist, then Undo. Shuffle empties history, so the beat asks for a move first. | Fixed (tour skipped it) |
| Reset / Shuffle live in More | Tour Reset and Shuffle beats | OK |
| Shift+drag face twist; keyboard keys | Help screen only | Not in demo (desktop-only) |

### Teach (Learn to Solve)

| Rule | Where | Status |
| --- | --- | --- |
| The cameo's gold guide is the live Kociemba **Solve** guide from More (`SolveMode`, `useKociembaSolver`) | Completion note now names it as the Solve guide. It previously said "That was Teach Mode", but Teach is a fixed twelve-lesson course that is explicitly not an adaptive solver. | Fixed |
| Teach = twelve lessons from notation to an independent solve | Same completion note; end-screen Teach row | Fixed |

### Views, Settings

| Rule | Where | Status |
| --- | --- | --- |
| Grid prints each tile's address; twins share the index (`getManifoldGridId`) | Every Look → Grid. Previously described as "grid lines". | Fixed |
| Sudoku numbers travel with their tiles (`sudokuValue`) | Every Look → Sudoku | Fixed (wording) |
| Wireframe, Glass, Chrome, Neon, Gap, Lego, Explode, Tunnels, Far Side, Hollow | Every Look | OK |
| Net | Help screen; deliberately omitted from the showcase | Unchanged |
| Colors / Tiles / Scene tabs | Settings step | OK |

### WORM (WORM Practice, 18 lessons)

| Rule (source) | Where | Status |
| --- | --- | --- |
| Full-run structure: opening scramble, warned turns undo it, new tunnels on a timer, `finalHealing`, win by healing every tunnel (`HealerWormMode`) | Chapter completion note, shown however practice ends | Fixed (never stated) |
| Portal enemies (on by default): steer to aim, hold Fire (`ambientCombat`) | Chapter completion note; Signature lesson now says "portal enemies". Previously referenced enemies without introducing them. | Fixed (copy); no practice lesson — Deferred |
| Orb color = its tile's color; healing needs four charges of the tunnel's color; orbs over raised tiles float (`wormSim` pickup) | Orbs lesson success line | Fixed |
| Tunnel wear: three safe rides, fourth collapses mid-ride (`classifyTraversal`) | Tunnel lesson success; death advice | Fixed |
| Layer turn: head caught ends the run, body caught cuts the tail (`findSlicePathHit`) | Rotation lesson instruction | Fixed |
| Bomb: grounded head in blast ends the run, body burns off, jumping protects the head (`bombs.js`) | Bomb lesson success | Fixed |
| Death advice for self-collision and collapsed tunnels | Practice card (was a generic line for both) | Fixed |
| Each character has its own signature | Signature lesson success; Store setup line | Fixed |
| Steer, jump, boost, pad entry, heal on exit, surround, rocket, magnet, five elements, bomb disarm | Their lessons, unchanged | OK |
| Double jump (`MAX_JUMPS = 2`); Story levels require "double jumps landed" | New Double jump lesson after Jump. The mid-air press used to restart the arc at `jumpT = 0.001`, dropping the worm from ~1.24 units to the floor in one frame; `jumpArc.js` now starts the second arc from the current height, used by the head, the baked body lift and pad launches alike | Fixed (lesson + arc bug) |
| Explode orb, 20-second cube-look orbs (`specialDefs`, `viewPowerups`) | Not taught; practice suppresses random specials | Deferred |
| Missions card, Story levels | Self-describing cards outside practice | Not in demo |

### Chaos (Call the Winner)

| Rule (source) | Where | Status |
| --- | --- | --- |
| First strike: the player aims chaos's first hit (`pickIgnition`) | The demo round now launches with the live pick, like every real round. It previously skipped it. | Fixed (flow) |
| Flips wear tiles; at the limit a tile and its twin die together (`checkPairDeaths`) | Setup line; forecast picker rules | Fixed |
| Tap a damaged tile to heal it plus the joined damaged tiles; healing can change the outcome (`chaosHeal.js`) | Setup line; forecast picker rules. The live HUD's heal hint sits behind Inspect match since the HUD condense, so the pre-round copy now carries it. | Fixed |
| Last pair standing wins | Forecast picker rules | Fixed |
| Real mode stakes Parity Points on four prediction types with odds and streaks (`disparityBetting.js`) | Forecast picker's last rule (the demo pick itself is free) | Fixed |
| Exiting the demo mid-round cancels the launch | `cleanupAllDemoState` tested `disparityRunning`, a field the store never had, so the cancel never ran; it now checks the Chaos step, `chaosLevel` and the pick | Fixed (bug) |
| Demo flip limit 6 vs the wizard's 3/8/13/20 tiers | Demo-only tuning for a short round | Unchanged |

### Random (Surprise Cube)

| Rule (source) | Where | Status |
| --- | --- | --- |
| Every ten seconds the palette, per-face tile styles and per-cubelet looks remix (`useRandomMode`, `CYCLE_MS`) | Setup line and hint | Fixed |
| Rules never change; the puzzle is the same | Setup line and hint. Both previously claimed Random "mixes the rules". | Fixed (was wrong) |

### Store (Spend Your Points)

| Rule | Where | Status |
| --- | --- | --- |
| Sells worms (each with a signature), trails, skins, accessories, hats, palettes, tiles | Setup line | Fixed |
| Points come from WORM runs, Chaos rounds and first solves (`economyConstants`) | Setup line | Fixed |

### Also corrected

- `demoStepCopy.js` claimed the mode wizards reuse its lines through
  `WIZARD_PREVIEW`; nothing imported it. The export and the claim are removed.
- `worm-demo-practice.md` still listed eighteen exercises including double jump.

Regression coverage: `demoFlow.test.js` pins the copy above to the constants
behind it (`FLIP_CAP`, `WORMHOLE_MAX_TRAVERSALS`, the ten-second remix, the
Undo beat's order). `demoGuidance.test.jsx` covers the Undo beat, the demo Chaos
launch with the first-strike pick, and the exit cancel. `mobileDemoUi.test.jsx`
covers the Undo pointer, the forecast rules and cause-specific death advice.
