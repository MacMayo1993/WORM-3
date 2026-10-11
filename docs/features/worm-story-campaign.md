# WORM Story Campaign: Story and Difficulty

> **Status:** shipped 2026-10-11. All 120 levels are authored in `src/worm/story/campaign.js`, Mobi's lines in `narrative.js` and mission sentences in `goalText.js`. This replaces the seeded chapters 5–12 (`generated.js`, removed) and the per-level copy that only restated each level's tasks.

## 1. Canon

- **MOBI** is a **Multi-Oriented Block Intelligence**: a block-built mind that faces every way at once. He was a ferry pilot for the Healer Corps.
- **The Projective Plane** is his home. Every spot there has a twin straight through the middle, and anything long enough meets itself coming the other way, mirrored. In copy it is a place name, never a math lesson.
- **The Flip Cube** is his ship. Its tiles are doors and the Core is its middle, the only spot that is its own twin. Every size, from the 2×2 pocket deck to the 15×15 cargo deck, is a **deck** of the same ship, which is why the campaign changes board size.
- **W³, the Great World Worm War.** The **World Worm** grew so long that it wrapped the whole Plane. It met its own tail coming back mirrored, did not recognize it, and attacked. Every twin, tunnel and turning layer became a weapon. On Mobi's last ferry run it lunged through one of the ship's doors, and Mobi slammed the door on its neck. The Flip Cube survived and crash-landed here broken, with the World Worm's head trapped in the Core.
- **The player** is a worm who hatches aboard after the crash. Mobi calls them "partner".
- **The Rumbler** is unchanged: a stowaway under the tiles, separate from the World Worm.
- **The ending.** The player leads the World Worm through the middle until its head meets its tail and it recognizes itself. The war ends and the way home opens. Mobi stays with the player, so the free modes keep their guide.

The theme ties to mechanics. Healing joins twins back together. **Passing yourself in the Core** without biting is exactly what the World Worm could never do. Growing huge is how a healer matches a world-sized problem.

## 2. Chapters

| # | Chapter | Levels | Story | Gameplay focus |
| --- | --- | --- | --- | --- |
| 1 | Crash Landing | 1–10 | Hatching, the wreck; the doors were chewed open from inside. | 6×6 classic: every core action once, a first siege, first growth goal. |
| 2 | Every Deck | 11–20 | Decks of every size; Mobi's ferry run; routes sealed from inside. | 2×2–8×8, alternate views, explode and flight. |
| 3 | Strange Views | 21–30 | The Core bends the decks; the memory of the slammed door. | Hollow, wireframe, bricks, far side, Steam and Quench. |
| 4 | The Grand Crawl | 31–40 | The story of W³; the World Worm pulls for its body. | 9×9, 10×10, 15×15, long bodies, everything combined. |
| 5 | The Long Body | 41–50 | "Long can mean kind"; the World Worm says "MINE." | Growth goals everywhere; first passes through the Core. |
| 6 | Pocket Worlds | 51–60 | It hides in the smallest decks; it asks "HOW?" | Huge worms on 2×2–4×4; first double heals. |
| 7 | Weather of War | 61–70 | It answers with storms. | Free fusions, recipe variety, all five elements mastered. |
| 8 | The War Machine | 71–80 | The ship as a weapon: the Grind, the Fold. | Turns every 9–10 s, blasts, bombs, rockets. |
| 9 | Siege of the Core | 81–90 | Crawlers dig in; the first door into the Core opens. | Fights, rings, bombs and abilities on long bodies. |
| 10 | Mirror Decks | 91–100 | The World Worm meets its reflection: "Mine… is me?" | Far-side and mirrored views; many passes and double heals. |
| 11 | The Mega Decks | 101–110 | Hold its attention; make the ship whole enough to fly. | 10×10 and 15×15 with 200-segment worms; a giant on a 2×2. |
| 12 | Through the Middle | 111–120 | Lead it through the Core; the war ends. | Every mechanic, the tightest clocks, the longest worms. |

## 3. Goals

Every existing objective is still used (orbs, colors, tunnel crossings, body jumps, layer turns, heals, surrounds, boosts, double jumps, rockets, magnets, explosions, element pickups, distinct elements, element mastery, Steam and Quench, abilities, bombs, enemies). Mechanic goals may now sit on any level kind, so a tunnel trial can also ask for passes and a rotation trial for growth. Four goals are new:

| Key | Checklist label | Credit |
| --- | --- | --- |
| `bodyLength` | Grow your worm | The run's peak body length (`practice.peakLength`). Tolls spent afterwards do not remove it. The three-star growth target is at least eight orbs beyond it (`STAR_GROWTH_BEYOND_TASK`). |
| `selfPasses` | Pass yourself in the Core | The sim marks `selfPassPending` when the head dives while any earlier passage's tail has not cleared (`bodyStillRiding`), and reports the pass from `crawling.enter()`, so a pass the worm does not survive earns nothing. Re-entering the same pair from its far end counts. |
| `multiHeals` | Double heals | A pair seals while a heal on a different pair still rides in the body: the head is mid-ride through a paying tunnel (or any tunnel on a trial), or an earlier passage still carries a heal (`otherHealRiding`). One surround that seals several pairs counts once per extra pair. |
| `fusions` / `uniqueFusions` | Fuse two elements / Different fusions | Every `elementFusion` event; distinct recipe IDs in `practice.fusionIds`. While either is open, `nextStoryPower` offers every element in the level's pool, and from level 21 each offer comes with a distinct partner. |

`bodyJumps` also works as a mechanic outside jump trials; `trackPracticeBodyJump` runs whenever it is asked for.

Constraints, held by `storyNarrative.test.js` and `wormStoryChapters.test.jsx`:

- Passes, double heals and surrounds need staged tunnels (`tunnel`, `collector`, `restore`, `mastery`). Surrounds and abilities never go on tunnel trials, because they would hold the trial's free heals.
- Fusion goals start at level 21, where paired offers begin. `uniqueFusions` never exceeds the ordered recipes its element pool allows.
- A stated orb count always covers the growth task plus heal tolls.
- Fights, bombs and surrounds need a 5×5 or larger board; magnets need 4×4; jump trials need 4×4.
- Pocket decks (2×2, 3×3) keep `size / speed ≥ 1`, turns at least 7 s apart, and at most four tunnel pairs.

## 4. Difficulty and time

- **Targets.** Chapters 1–4 keep their teaching order, rewards and kinds, with higher counts (for example, level 1 is now 24 orbs in all six colors plus a 60-segment worm). From chapter 5, growth goals appear in at least five levels per chapter; passes and double heals appear in every chapter from 7 onward. The longest required body grows from 140 segments in chapter 5 to 220 in chapters 11–12. Pocket and mega decks both ask for a worm that fills a real share of the board.
- **Checklists.** Average tasks per level rise from about 3.6 (chapters 1–4) to 4.7 (5–8) and 5.7 (9–12). The finale has the longest checklist in the game: 16 tasks.
- **Speed.** On 5×5 and larger decks the crawl rises from 2.5 (chapter 5) to 2.8 (chapter 12). 4×4 decks stay at 2.4 and pocket decks keep their own pace, because there the space is the challenge.
- **Turns.** Chapter 1 turns every 11–14 s; chapters 8 and 12 turn every 8–11 s.
- **Clocks.** One workload model sets every limit. The longest strand of work sets the pace: orb collection (scaled by board size and how much of the board the body covers), tunnel routes (rides, passes, double heals, surrounds), actions (fights, bombs, jumps) or the auditor's conservative power-offer budget. The other strands add 45% of their time, since they mostly run alongside. Slack multiplies that from 1.45× in chapter 1 down to 1.15× in chapter 12; pocket decks get +0.25 and finales −0.05. Par is 58–66% of the limit. The two grand finales are capped at 20 min (level 40) and 25 min (level 120). The model was calibrated against the original hand-tuned limits of levels 1–40, within about ±15% per objective kind.

Supply and completion are checked against the runtime: every level stages for both orb densities, cycles and places its power offers, refills six colors, and accepts exactly its checklist (`storyQuestSupply`, `wormStoryChapters`, `storyChecklist`, `wormGrowthStars`, `storyNarrative`). `wormStoryFlow` steers a real worm through levels 2, 5, 6, 11 and 12. **Device playtesting is still required:** none of this proves the late-game clocks feel right on a phone, especially the pocket-deck growth levels (51, 58, 104) and the double-heal finales.

## 5. Mobi's lines

Every level has a `briefing` of one to three dialogue cards and a `debrief`. At launch (`handleWormSetupComplete` → `storyLaunchLines`) Mobi speaks the briefing and the literal mission card follows it, at most five cards. Before this change he read only the subtitle and the task list. The map, preflight and pause cards show the briefing as one paragraph (`storyBriefingText`); the result card shows the debrief. Briefings never contain digits; counts stay in the mission sentence. House rules are in `docs/COPY_STYLE.md`.

## 6. Adding or retuning a level

1. Edit the level in `campaign.js` and keep its `par`/`limit` consistent with neighbours of the same chapter.
2. Give a new level a world in `worlds.js` (unique name, one tile style on all faces) and lines in `narrative.js`.
3. Run the story tests. Their messages name the broken constraint. The local auditor (`npm run worm:tools`) shows supply per objective.
