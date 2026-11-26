# Flip Cube Levels and Relapse: Design Plan

Status: **plan for review**. Nothing here is built yet. Comments and improvements are welcome. The open questions at the end are the places where feedback matters most.

## 1. Summary

Flip Cube becomes a puzzle game with levels.

- **Levels.** Each of the 10 hand-made 3×3 levels starts scrambled: some layers are turned and some tile pairs are already flipped to their antipodal colour.
  - You win by making every face one colour.
  - A tile counts whether it got there by turning or by flipping.
  - Turns are free. Your score is how few flips you used.
- **Relapse.** A tile that has been flipped and then healed back to its normal colour "remembers" being flipped.
  - It shakes, more the more it has been flipped.
  - Every 10 seconds it has a chance of flipping back on its own: 5% for each flip in its history.
  - Relapse is always on in levels and is an option in free play.

## 2. Goals and non-goals

**Goals**
- A clear and fair puzzle loop: read the cube, plan, and solve with as few flips as possible.
- Teach the central idea of the game through play: **a half turn of a middle slice carries every tile in it to its opposite face, which is the same as flipping them.** Turns and flips are two answers to one problem.
- Add time pressure without a countdown. Relapse makes a slow solve cost more flips, never a loss.
- Reuse what exists: the level schema, staging, ProgressManager, the par solver, the paired flip, the far-side window and the flip portals.

**Non-goals for this pass**
- Board sizes other than 3×3. The design generalises, and 4×4 and 5×5 packs can follow.
- Changes to Chaos, WORM or the Story campaign packs.
- A level editor.

## 3. Player experience

1. Main menu → Flip Cube → path screen. The path screen gains a third card, **Levels**, next to Free Play and Chaos.
2. The **level map** shows 10 stages, each with its stars, the best flip count and the flip par. The next unplayed stage pulses. Each stage unlocks when the previous one is cleared.
3. **Launch.** Mobi gives a one-line briefing, the cube scrambles in front of you and play starts.
4. **The HUD** shows:
   - **Flips:** used / par, for example `2 / 3`.
   - **Relapse clock:** a small ring that sweeps every 10 seconds, so you can see when the next roll comes. It is hidden while no tile can relapse.
   - Undo, pause and the far-side window, as today.
5. **Solve.** The cube-solved sting plays and the clear card shows stars, your flips against par and the best before this run. Then Next level, Retry or Map.
6. **Retry** restarts the same puzzle, with the same scramble and a new relapse seed.

## 4. Rules

### 4.1 Solved state

The cube is solved when **every face shows a single colour and the six faces show six different colours**. The check reads the colour each sticker shows now (`curr`), whatever its flip history.

That accepts:
- **The standard solve.** Every tile is home and unflipped.
- **A flipped solve.** Some tiles are fixed by flipping instead of turning.
  - Example: everything is solved except the white and yellow centres, which sit on each other's faces. The cube is **not** solved. One flip of that centre pair, which recolours both, solves it.
- **A whole face showing its flipped colours.**
- **A whole-cube rotation** of any of the above. Turning all three slices of an axis rotates the cube, and that must not hide a solve.

It rejects a cube where every face is uniform but two faces show the same colour. That state can happen once flips have changed how many stickers show each colour, and it does not read as solved.

Implementation: `checkFlipPuzzleSolved(cubies, size)` in `src/game/winDetection.js`. It is the rotation-invariant check plus a distinct-colours check, selected by a new `WIN_CONDITIONS.FLIP`.

### 4.2 Scoring: flips only

- **Every player flip counts as 1.** A flip is one tap, and both tiles of the pair move.
- **Turns cost nothing.**
- **Undo gives the flip back.** The undo uses `unflipStickerPair`, which returns the tile's life as well.
- **Relapses are not charged.** The flips you spend to fix a relapsed pair are charged, so relapse costs you through your response to it, not as a penalty.
- **Par.** Each level has a `flipPar`: the fewest flips that solve it, with any number of turns. It is authored, and a test verifies it (section 7.4).
- **Stars:**
  - ★★★ at par or fewer flips;
  - ★★ up to `par + max(1, ceil(par × 0.5))`;
  - ★ for any solve.
- **Personal best:** the fewest flips, with time as the tiebreaker, shown on the map and the clear card.

Relapse will often push you past par on a slow run. That is deliberate: speed matters through flips, not through a clock.

### 4.3 Relapse

**Who can relapse.** A sticker pair whose tiles:
- show their **normal** colour (`curr === orig`, an even flip count), and
- **have a flip history** (`flips > 0`), and
- are **below the flip cap** (`flips < cap`), and
- are not in their 3-second post-flip refractory window, and
- are not mid-animation.

Tiles that are flipped now never relapse. The idea is that tiles want to go back to being flipped once they have been.

**When.** Every **10 seconds of play** (`RELAPSE_INTERVAL = 10`). The clock runs only while you are playing. It stops while paused, during the briefing or scramble, on the clear card, in menus and while the tab is hidden. It does not catch up on missed rolls.

**Chance.** `p = min(1, 0.05 × flips)` (`RELAPSE_PER_FLIP = 0.05`). Because a healed tile always has an even flip count, the chances that actually come up are:

| Flips in history | Chance per roll |
|---|---|
| 2 | 10% |
| 4 | 20% |
| 6 and up | depends on the cap (below) |

**One roll per pair.** A flip moves both tiles of a β-pair (`flipStickerPair` is atomic), so the pair rolls once. Rolling per tile would double the odds.

**What a relapse does.** It runs the ordinary paired flip: both tiles recolour to their antipodes and each spends one flip of its life. Relapses therefore grow the history and raise the next chance.

**The flip cap is a safe harbour.** Levels use the standard cap, `FLIP_CAP = 6`.
- The cap is even, and every pair starts at 0. So a pair can only reach the cap by being **healed**, and a pair at the cap can never relapse.
- No pair can get stuck showing its flipped colour at the cap, so relapse can never make a level unwinnable.
- The most a healed pair can get to is 4 flips, a 20% chance. One more relapse and heal puts it at 6, where it is spent and stable for good.
- Rule: **a pack that enables relapse must use an even cap.** A test enforces this.

Free play also allows the Disparity caps 3, 8, 13 and 20. Cap 3 is odd, so with relapse on a pair could relapse to 3 and get stuck flipped. To avoid that, free play relapse also refuses a roll that would land a pair *on* an odd cap (`flips + 1 >= cap` with `cap` odd).

**Randomness** comes from a seeded generator (`sim.rand`-style), seeded from the level id and the attempt number. Tests inject it, and retries get a fresh seed.

**Undo and relapse.** A relapse is not on the undo stack, and it **truncates** the undo history. You cannot undo back past a relapse, because rewinding a player flip whose pair has since relapsed would rewrite the wrong flip count. The HUD says so once ("Relapse! Undo history cleared").

### 4.4 Free play option

- `settings.flipRelapse` (default **off**) is a switch in the Flip Cube setup wizard. It is also on the session menu's Settings page and in Settings → Modes.
- When it is on, free play runs the same engine and visuals.
- Free play keeps its current score, but the relapse count shows in Run details.

## 5. Visual and feel

### 5.1 A healed tile with history: "scarred"

- **Scar.** A faint cracked-glaze mark on the sticker in its antipodal colour. Its strength steps up with the flip history: 2 shows a hairline, 4 shows a clear crack network. At the cap it settles into a calm gold seam, which reads as "spent, stable".
- **Shake.** A small idle shake. Its amplitude and frequency grow with the flip count, for example about 0.6° at 2 flips and about 1.4° at 4. It stays slight: it reads as unease, not as an alarm. It stops at the cap.
- **Before a roll.** For the last 1.5 s of each 10 s cycle, every tile that can relapse tightens its shake together. The player sees which tiles are at risk just before the roll, as the relapse clock completes.
- **Implementation.** Do this in the shader, not per tile. CLAUDE.md forbids per-tile frame callbacks and per-tile meshes on flipped tiles. The shake is a small vertex wobble in the sticker instance shader, driven by a per-instance history value (`aInstanceData`) and `sharedUniforms.time`. The scar is a fragment layer in the same program. That keeps a 5×5 free-play board as cheap as a 3×3.

### 5.2 The relapse moment

- The pair plays the ordinary flip: the squeeze shut and reopen in the antipodal colour, with no colour wash. The flip portal opens.
- `feel('relapse')`: a short, low "pull" sound, distinct from the player's flip.
- A crack ring blooms from each tile.
- A toast: **"Relapse! +1 pair to fix"**.
- The far-side window shows the twin flipping too.

### 5.3 Reduced motion and flashes

- Reduced motion has no shake, only the static scar. The relapse clock is a stepped ring instead of a sweep.
- Nothing here flashes. The bloom is a ring, not a full-tile flash.

## 6. The 10 levels (draft)

All levels are on a 3×3 with relapse on. Setups are written as turns (`scrambleSequence`, applied first) and flips (`flipSequence`, applied on top). History-only pairs ("scars") are a pair flipped twice in `flipSequence`, so they start healed but able to relapse. Par numbers are drafts until the par test (7.4) confirms them.

| # | Name | Idea | Setup (draft) | Flip par |
|---|---|---|---|---|
| 1 | First Flip | One tap fixes a tile *and* its twin on the far side | 1 flipped edge pair, no turns | 1 |
| 2 | Twin Trouble | Turn back, then flip | 1 face turn + 2 flipped pairs | 2 |
| 3 | Centre Swap | The white and yellow centres look swapped; one flip fixes both | Centre pair flipped + 1 turn | 1 |
| 4 | Half-Turn Trick | Six pairs look flipped, but one middle half turn fixes them all | A state equal to M2 shown as 6 flipped pairs | **0** |
| 5 | Scar Tissue | Meet relapse: some pairs start scarred (2 flips) | 2 turns + 2 flipped pairs + 2 scars | 2 |
| 6 | Mixed Signals | Some pairs are fixed by a half turn, some only by flips | E2 equivalent + 2 extra flipped pairs + 2 turns | 2 |
| 7 | Deep Scars | Scars at 4 flips (20%): go fast | 3 turns + 3 flipped pairs + 2 scars at 4 | 3 |
| 8 | Antipodal Shuffle | Two half turns on different axes overlap | M2 + S2 equivalents + 1 flipped pair + 2 turns | 1 |
| 9 | Last Life | Pairs at 5 flips: heal them once and they are spent and safe | 4 turns + 2 pairs at 5 + 1 flipped pair | 3 |
| 10 | Event Horizon | Everything at once | 6 turns + 4 flipped pairs + 3 scars + a half-turn shortcut | 4 |

Briefings are one line from Mobi each (copy follows COPY_STYLE.md). For example, level 4: "Six flipped pairs? Look again. Sometimes a turn is a flip."

## 7. Technical design

### 7.1 Data

- A new pack, **`flip-puzzles`**:
  - `src/levels/data/flip-puzzles.js` holds the levels, and `src/levels/packs/flip-puzzles.js` holds the pack.
  - Its ids are **601–610**, with `'flip-puzzles': [601, 699]` added to `LEVEL_ID_RANGES`.
  - It is registered in `BUILT_IN_PACKS`.
- New schema fields in `schema.js`:
  - `scoring: 'flips'` selects the flip scoring.
  - `flipPar: number` is the authored par.
  - `relapse: true` makes relapse mandatory for the level.
  - `flipCap: 6` is optional; it defaults to `FLIP_CAP` and must be even when relapse is on.
  - `winCondition: WIN_CONDITIONS.FLIP` selects the solved check in 4.1.
- Staging uses the existing `buildLevelStartState`: turns first, then flips. It records the flip history.

### 7.2 Game logic (pure, `src/game/`)

- `winDetection.js`: `checkFlipPuzzleSolved`.
- `relapse.js` (new):
  - `RELAPSE_INTERVAL` and `RELAPSE_PER_FLIP`;
  - `relapseChance(flips)`;
  - `relapseCandidates(cubies, size, manifoldMap, cap, { refractory })`, which returns one entry per eligible pair;
  - `rollRelapses(candidates, rand)`, which returns the pairs to flip;
  - `canRelapseUnderCap(flips, cap)`, the odd-cap rule.
- `flipPar.js` (new, used in tests and tools): the fewest flips over turn sequences up to depth D. It reuses parSolver's "flips needed to finish" count, prunes on pairs whose tiles disagree, and dedups states by hash.

### 7.3 State and hooks

- **Store:**
  - `playerFlips` goes up on a player tap flip (`useCubeState`), down on an undone flip (`useUndo`), and resets with `resetGame`.
  - `relapseCount` counts relapses.
  - `relapseClock` is the play-time accumulator, render-facing.
  - `settings.flipRelapse` holds the free-play option.
- **`useParityDecay`** comes back as the relapse driver:
  - It accumulates play time from a frame or interval clock, gated by the conditions in 4.3.
  - On each 10 s tick it rolls, applies `flipStickerPair` for each hit, marks those tiles as refractory, truncates undo and fires the feel and toast.
  - It is active when `currentLevelData?.relapse` or `settings.flipRelapse` is on in Flip Cube free play.
  - It never runs in WORM, Chaos, Teach or the demo.
- **`useGameSession`** uses `checkFlipPuzzleSolved` when the level's win condition is `FLIP`.
- **`completion.js` / `scoring.js`:** `computeStars` branches on `scoring: 'flips'` and uses `playerFlips` against `flipPar`. Bests are stored per level id.

### 7.4 Par verification

- `flipPuzzles.test.js` stages each level and checks two things:
  1. `flipPar` is reachable. The level's own intended solution, authored as `solution: { turns, flips }`, solves it with exactly `flipPar` flips.
  2. No cheaper solve exists within depth D. `flipPar.js` searches slice quarter turns, 18 moves, up to D = 4, about 10⁵ nodes. This guards against accidental shortcuts.

### 7.5 UI

- **`CubeModeSelectScreen`:** a third path card, **Levels**, in Flip Cube's yellow. It opens the level map for `flip-puzzles`.
- **Level map:** reuse `LevelSelectScreen` with `packId="flip-puzzles"`, adding flip par, best flips and stars per card. A WORM-style trail map can come later.
- **HUD:** a `FlipParChip` (flips used / par) and a `RelapseClock` ring in the Flip Cube instrument row. The relapse clock reads from the store and the DOM is written by an rAF loop, like the `ComboMeter`, so nothing re-renders every frame.
- **Clear card:** stars, flips against par, a new-best tag, the relapse count, and Next / Retry / Map.
- **Settings:** the free-play toggle described in 4.4.

### 7.6 Rendering

- The sticker instance shader gets a scar and shake branch driven by per-instance history. It is a uniform or attribute branch, not a new program per tile.
- It is warmed with the other Flip Cube programs, so the first relapse does not stall.
- The relapse bloom is pooled, one rig per pair at most, and hidden while idle.

## 8. Tests

- **Solved check:** standard, centre-swap fixed by a flip, whole-face flipped, whole-cube rotated, and rejecting duplicate colours.
- **Relapse logic:**
  - eligibility: flipped tiles never roll, history 0 never rolls, a pair at the cap never rolls, refractory tiles are skipped;
  - one roll per pair;
  - the chance is 0.05 × flips;
  - the odd-cap guard;
  - with seeded rand, the same seed gives the same relapses.
- **Clock:** no ticks while paused, in briefings, on the clear card or while hidden; no catch-up.
- **Scoring:** player flips count, undo refunds, relapses are not charged, the star thresholds hold.
- **Undo after relapse** truncates.
- **Levels:**
  - ids are in range;
  - every level stages without errors;
  - par is verified (7.4);
  - the cap is even when relapse is on;
  - unlocking follows the chain.
- **UI:** the path card opens the map, the HUD chip shows flips / par, the clock hides with no candidates, and the free-play toggle persists.
- **Browser** (`e2e`): play level 1 to a clear.

## 9. Phasing

1. **Rules core:** solved check, `relapse.js`, `playerFlips`, flip scoring. Pure and tested.
2. **Levels:** the pack, levels 1–10, the par test, and the path card plus map.
3. **Relapse live:** the driver hook, the HUD clock, the relapse moment, the undo rule and the free-play toggle.
4. **Look:** the scar and shake shader, the pre-roll tension and the bloom.
5. **Polish:** briefings, the clear card, sounds, the e2e test, and a phone pass.

## 10. Open questions for reviewers

1. **Relapse interval.** Is 10 s right for a 3×3? A shorter interval means more pressure. It could also scale per level.
2. **The pre-roll tell.** Should every tile that can relapse tighten its shake before each roll (current plan), or should the roll come with no warning?
3. **Undo after relapse.** Clearing the undo history is the simplest fair rule. Would players rather keep undo for everything before the relapse?
4. **Star slack.** Is `par + max(1, ceil(par × 0.5))` for ★★ too forgiving, given that relapse adds flips?
5. **Free-play default.** Off by default (current plan), or on for returning players once they have cleared level 5?
6. **Scars at the cap.** The plan turns spent tiles gold and calm. Should they look more "dead", like Chaos's graves?
7. **Later packs.** Should 4×4 and 5×5 packs keep 10 s, or scale the interval with the number of pairs?
