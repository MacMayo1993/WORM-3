# WORM Story Campaign: Story and Difficulty

> **Status:** shipped 2026-10-11. All 120 levels are authored in `src/worm/story/campaign.js`, Mobi's lines in `narrative.js` and mission sentences in `goalText.js`. This replaces the seeded chapters 5–12 (`generated.js`, removed) and the per-level copy that only restated each level's tasks.

## 1. Canon

> **Canon revised 2026-10-13.** The Great World Worm War is retired. W³ is a feud between two clans of Singular-Oriented worms. Mobi is the only voice in the story: `narrative.js` is his monologue, and the copy in `campaign.js` describes the clans without naming any individual.

- **MOBI** is a **Multi-Oriented Block Intelligence**: a block-built mind that faces every way at once. He was a ferry pilot for the Healer Corps, flying wounded worms from both sides of the war.
- **The Projective Plane** is his home. Every spot there has a twin straight through the middle, and anything long enough comes back round to meet itself, mirrored. In copy it is a place name, never a math lesson.
- **The Singular-Oriented** are the worms of the Plane. Each has one front and one back, faces one way at a time, and cannot tell a mirror image from a stranger.
- **The Ringfolk** keep their bodies short and coiled and hold the near side of the Plane. **The Longhaul** grow long and run its far routes. For generations both clans used the Plane's doors, and the Healer Corps ferried between them.
- **W³, the Great Worm War.** The Longhaul grew so long that their longest body wrapped the Plane. Their longest tail came back round the far side mirrored, and they didn't know it was theirs. The Ringfolk saw a stranger on their side and bit it: the first bite. Each clan took the other for an invader, and every twin, tunnel and turning layer became a weapon.
- **The Flip Cube** is Mobi's ship. Its tiles are doors; every size, from the 2×2 pocket deck to the 15×15 cargo deck, is a **deck** of the same ship, which is why the campaign changes board size. The Core is its middle, the only spot that is its own twin. On Mobi's last ferry run, with wounded from both clans aboard, the Longhaul ambushed the ship at the Core's door. One of their big bodies lunged through a door, and Mobi slammed it shut on its neck. The Flip Cube crash-landed here broken, with the longest Longhaul body wedged in the Core.
- **The player** is a hatchling healer worm born in the wreck. Mobi calls them "partner" and never gives them a line.
- **The ending.** The player leads the longest Longhaul body through the middle until its head meets its own tail and it recognizes it. The Ringfolk, watching from the far-side window, don't bite. The war ends, the way home opens, and Mobi stays with the player, so the free modes keep their guide.

### Cast

| Name | Who | Role in the story |
| --- | --- | --- |
| **MOBI** (he) | Multi-Oriented Block Intelligence, Healer Corps ferry pilot. | The only voice. He explains the war, the ship and the player's task. |

Everyone else is a group or a thing: the Ringfolk, the Longhaul, the Healer Corps, the crawlers, the longest body. The player is addressed as "partner" and never speaks.

The theme ties to mechanics. Healing joins twins back together. **Passing yourself in the Core** without biting is exactly what the feud never learned. Growing huge is how a healer matches a war-sized problem.

## 2. Chapters

| # | Chapter | Levels | Story | Gameplay focus |
| --- | --- | --- | --- | --- |
| 1 | Crash Landing | 1–10 | Hatching, the wreck; the doors were chewed open from inside. | 6×6 classic: every core action once, a first siege, first growth goal. |
| 2 | Every Deck | 11–20 | Decks of every size; Mobi's ferry run; routes sealed from inside. | 2×2–8×8, alternate views, Earth spring pads, Air jumps, explode and flight. |
| 3 | Strange Views | 21–30 | The Core bends the decks; a coil in the far-side window; the last ferry run and the slammed door. | Hollow, wireframe, bricks, far side, Steam and Quench. |
| 4 | The Grand Crawl | 31–40 | The story of W³: the Longhaul's longest body, its mirrored tail, and the Ringfolk's first bite. | 9×9, 10×10, 15×15, long bodies, everything combined. |
| 5 | The Long Body | 41–50 | "Long can mean kind"; the Longhaul's answer is one word: "mine." | Growth goals everywhere; first passes through the Core. |
| 6 | Pocket Worlds | 51–60 | The Longhaul hides in the smallest decks and asks the question the war never answered. | Huge worms on 2×2–4×4; first double heals. |
| 7 | Weather of War | 61–70 | The Longhaul answers with storms. | Free fusions, recipe variety, all six elements mastered. |
| 8 | The War Machine | 71–80 | The ship as a weapon: the Longhaul's Grind and the Ringfolk's Fold. | Turns every 9–10 s, blasts, bombs, rockets. |
| 9 | Siege of the Core | 81–90 | Longhaul crawlers dig in; the first door into the Core opens. | Fights, rings, bombs and abilities on long bodies. |
| 10 | Mirror Decks | 91–100 | The longest body meets its reflection and learns whose tail it is. | Far-side and mirrored views; many passes and double heals. |
| 11 | The Mega Decks | 101–110 | Hold the longest body's attention; the Longhaul asks whether a worm can jump its own tail; make the ship whole enough to fly. | 10×10 and 15×15 with 200-segment worms; a giant on a 2×2. |
| 12 | Through the Middle | 111–120 | Lead the longest body through the Core; the Ringfolk watch without biting; the war ends. | Every mechanic, the tightest clocks, the longest worms. |

## 3. Goals

The six elements are Water, Fire, Earth, Ice, Lightning and Air. Level 8 requires Water, Fire and Earth collection; level 13 teaches an Earth spring launch and safe landing; level 17 teaches an Air jump and safe landing. Level 64 collects all six. Levels 40, 69, 70, 100, 106, 113 and 120 master all six. Focused lessons use `elementTypes` so their offers, objective credit and text share the same named set. The internal `grass` ID remains Earth for save compatibility.

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

The guided demo tells the same story in miniature. Its cold open names Mobi, the Projective Plane, the ship and W³. WORM practice is framed as repairs to the crashed ship, the cube steps as its decks and doors, and the view tour ends at the Core. Mobi's send-off on the end screen points to WORM Levels. Copy lives in `MobiIntroScreen.jsx`, `demoStepCopy.js`, `wormDemoLessons.js`, `DemoFlowController.jsx` and `DemoEndScreen.jsx`.

## 6. Adding or retuning a level

1. Edit the level in `campaign.js` and keep its `par`/`limit` consistent with neighbours of the same chapter.
2. Give a new level a world in `worlds.js` (unique name, one tile style on all faces) and lines in `narrative.js`.
3. Run the story tests. Their messages name the broken constraint. The local auditor (`npm run worm:tools`) shows supply per objective.
