# WORM Story and Free Play

Selecting WORM in the main carousel opens two side-by-side cards: **STORY** on the left and **FREE PLAY** on the right. They use the existing dark wizard surfaces, Bungee headings and WORM green accent; Free Play adds a gold illustration accent. The two-column choice remains on phones. Back/Escape returns within the WORM flow before returning to the mode carousel. Keyboard focus stays inside the selector.

Free Play opens the existing customization wizard. Story opens chapter one, **The First Turn**, with ten sequentially unlocked levels. Any clear unlocks the next level; extra stars are optional. Story uses a fixed 5×5 board and pace, a ready card to start each attempt, and the existing worm simulation. A failed attempt can be retried, and completion offers Next, Replay and Chapter map.

The original chapter was too close to the practice lessons: a straight four-orb lane, one tunnel, one jump and one turn. The revised chapter requires longer routes, combines mechanics and introduces explicit deadlines. Levels begin with a visible body already on the board (about five tiles in level one, eight in the other route/healing levels, thirteen in the jump trial), so routing and clearance matter from the start.

| Level | Required objectives | Par / deadline | Surface pace | Recurring turns |
| --- | --- | --- | --- | --- |
| First Crawl | 18 orbs and all six colors | 50 / 90 s | 2.0 | None |
| Through the Looking Glass | Four distinct tunnel pairs; full tail clearance | 70 / 120 s | 2.2 | None |
| Clear Your Tail | Four landed body clearances and 12 orbs | 75 / 130 s | 2.35 | None |
| Moving Ground | 18 orbs and six settled layer turns | 95 / 150 s | 2.5 | Every 10 surface seconds |
| Color Collector | All six colors and four healed pairs; full tail clearance | 120 / 190 s | 2.75 | Every 10 surface seconds |
| Restore the Cube | Six healed pairs, 30 orbs, six turns and full tail clearance | 160 / 250 s | 3.0 | Every 8 surface seconds |
| Full Throttle | Two boosts, two landed double jumps, one rocket landing, four remote magnet catches, 24 orbs, two healed pairs | 170 / 280 s | 3.0 | Every 9 surface seconds |
| Force of Nature | All five elements mastered, 24 orbs, three healed pairs | 220 / 350 s | 3.0 | Every 9 surface seconds |
| Under Siege | One ring heal, two signatures, two bomb disarms, four enemy kills, 24 orbs, four healed pairs | 240 / 380 s | 3.0 | Every 10 surface seconds |
| Worm Ascendant | All five elements, two boosts, two double jumps, one rocket landing, four remote magnet catches, one ring heal, two signatures, two disarms, six kills, 36 orbs, eight turns, six healed pairs | 360 / 540 s | 3.2 | Every 8 surface seconds |

The deadline is shown in the chapter map and ready card, then counts down with objective progress. Expiration produces a distinct **TIME’S UP** failure and no completion award. Pause, document hiding and jump rescue hold the deadline. Tail transit and animations still take challenge time; as in Free Play, rotating hazards wait until the entire body clears a tunnel. Each rotating level repeats a six-turn authored cycle spanning all axes and interior/outer slices until the objective finishes. It keeps the existing warning and collision transaction.

The route trial counts unique pair identities only after the head resumes crawling. A marker points to an unvisited pair, so revisiting a mouth cannot silently pad progress. Its four portals are supplied with 24 orbs (four per face; 36 for Classic), enough matching resources to heal every pair. Orb healing follows traversal and preserves its credit; ring healing remains disabled so an unvisited pair cannot disappear. The regular safe-traversal/void limits remain. The jump trial counts one clearance per continuous airborne episode only after an alive surface landing; a double jump does not add another count, and empty/low jumps or already severed body tiles do not count.

Levels 7–10 award choices of Comet/Circuit trails, Aurora/Cosmic palettes, Crown/Wizard hats and Gold/Galaxy skins. Existing six-level saves resume at level seven; level ten now owns chapter completion and the chapter has 30 possible stars.

First-clear rewards remain 25 points on levels 1, 2 and 4; Party Hat or Top Hat on level 3; Forest or Tropical palette on level 5; Royal or Ocean skin on level 6. Previously saved stars and unlocks remain valid, and the rebalance does not reissue claimed rewards.

Each first clear also awards 50 XP. Optional stars reward finishing within the displayed par time and finishing without a tail cut; each newly earned optional star pays 10 XP and 10 points once. Best stars never decrease. Existing XP level-up bonuses are included in the completion wallet total.

Cosmetic choices share the shop's item IDs and ownership list. Each choice can be claimed once from the result or the chapter map, including after leaving the run. When both choices are already owned, the player receives a one-time points alternative (the amount specified by that level; 100–300 points). Claiming unlocks the item for the shared collection; equipping remains in the existing customization UI.

## Runtime and persistence

- `wormStory` stores bounded stars and reward claims inside the existing player save, alongside XP, wallet and owned items. Existing saves default to an empty chapter. Incomplete or malformed progress does not unlock later levels.
- Story completion checks the active run ID, alive/started/unpaused state and actual simulation outcomes. A tunnel-entry event alone cannot finish traversal. Jump input alone cannot finish the body crossing. A queued or animating turn cannot finish Moving Ground.
- Story starts with authored orbs across all faces and fixed tunnel networks. No random holes or scramble are added. Levels 4–10 use recurring warned slices. The original collision, cut, death, tunnel extrusion and jump rescue remain active.
- Levels 7, 8 and 10 offer one marked power at a time. Missing an offering reoffers it after expiration; failing its objective permits another attempt. Active powers are allowed to finish before the next is offered. Magnet offerings provide up to four additional nearby quest orbs while remote catches remain outstanding, preventing exhausted inventory from blocking progress.
- Element checks require water momentum after three seconds, an actual fire trail after three seconds, a consumed grass spring followed by a safe landing, an ice jump followed by landing, and four seconds surviving lightning. Rocket flights cannot double-count as double jumps. Inch charging alone cannot count as a signature; it must launch successfully.
- Levels 9 and 10 reserve traversable tunnels until ring-heal and signature goals are met: orb deposits remain banked, but sealing on traversal waits for those goals. Ring healing also preserves the final pair until the signature quota is met, so MOBI retains an activation target.
- Story enemy rifts spawn crawler/scout/brute encounters through the existing combat engine. They continue after all traversable tunnels heal and stop after the kill quota. Rifts warn for 2.5 seconds, retry missed encounters, cap enemies at one, and honor pause, death, travel, slice and other hazard gates. Only actual kills count; arena victory and drops are disabled.
- Bomb challenges offer one real bomb at a time with a 25-second fuse and retry after detonation. The existing eight-cell body footprint disarms them; successful disarms are deduplicated and do not pay Free Play coins. Spawn countdowns advance between rotation warnings rather than waiting for an entirely unarmed rotation cycle.
- Ordinary XP runs, missions, survival coins and per-heal payouts are excluded from Story. Replays award only previously unearned star improvements. Free Play retains its own run economy and customization; Story's enemy setting does not overwrite the saved Free Play preference.
- Objective time is held during Pause, hidden-document frames and the jump rescue hold. Progress text publishes only when a counter, transit status or displayed whole second changes. Body-height clearance scans run only after a cheap occupied-tile check finds a crossing candidate. Menu illustrations use SVG without additional WebGL preview contexts. Free Play setup remains lazy-loaded.

## Validation

Full CI passed for the ten-level extension: 181 test files / 2,218 tests, lint, production build and bundle budgets. The initial route is 6 files, 2,014.9 KiB raw / 495.1 KiB Brotli; the largest lazy chunk is HealerWormMode at 298.8 KiB.

The difficulty pass extends the regression coverage for larger collection targets, distinct traversals including a repeated pair, long-tail exit clearance, four separately landed jumps, low/empty/fatal/severed-body rejection, recurring hazards on all axes, interval and pause behavior, deadline expiration, retry reset and the timeout UI. Route tests collect real placed pickups and heal all four/six authored pairs using steering and ordinary tunnel triggers; they do not teleport the worm or grant inventory. Scheduler tests separately exercise recurring turns and their existing damage pipeline. Combined objective gates reject the previous tutorial-sized clears and require every goal within the deadline.

Mastery tests cover every final objective, failed/expired power retries, safe landing credit, real rocket pickup through the live hook, actual remote magnetic catches versus head/Beacon pickups, banked deposits remaining open, real combat projectile kills across all three enemy types, bomb spawn/disarm scheduling and reward suppression, old-save continuity, cosmetic claims and ten-level navigation.

Browser/phone WebGL visual verification remains outstanding; browser access was blocked in this environment. Automated DOM and physics tests do not establish final appearance, frame rate or the subjective difficulty on a device. Before release, play the chapter on a phone to tune the initial pace/par/deadline values, inspect narrow portrait/landscape ready/result cards, and check the route marker under the chase camera.
