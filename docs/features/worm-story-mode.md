# WORM Story and Free Play

Selecting WORM in the main carousel opens two side-by-side cards: **STORY** on the left and **FREE PLAY** on the right. They use the existing dark wizard surfaces, Bungee headings and WORM green accent; Free Play adds a gold illustration accent. The two-column choice remains on phones. Back/Escape returns within the WORM flow before returning to the mode carousel. Keyboard focus stays inside the selector.

Free Play opens the existing customization wizard. Story opens chapter one, **The First Turn**, with six sequentially unlocked levels. Any clear unlocks the next level; extra stars are optional. Story uses a fixed 5×5 board and pace, a ready card to start each attempt, and the existing worm simulation. A failed attempt can be retried, and completion offers Next, Replay and Chapter map.

| Level | Physical objective | First-clear reward |
| --- | --- | --- |
| First Crawl | Collect four authored orbs | 25 points |
| Through the Looking Glass | Traverse a tunnel and clear the entire tail from its exit | 25 points |
| Clear Your Tail | Jump across the staged body crossing and land alive | Party Hat or Top Hat |
| Moving Ground | Survive one warned layer turn through its settled commit | 25 points |
| Color Collector | Collect the two matching orbs and heal the marked opposite-face tunnel | Forest or Tropical palette |
| Restore the Cube | Heal all three authored tunnel pairs, with no tail still in transit | Royal or Ocean skin |

Each first clear also awards 50 XP. Optional stars reward finishing within the displayed par time and finishing without a tail cut; each newly earned optional star pays 10 XP and 10 points once. Best stars never decrease. Existing XP level-up bonuses are included in the completion wallet total.

Cosmetic choices share the shop's item IDs and ownership list. Each choice can be claimed once from the result or the chapter map, including after leaving the run. When both choices are already owned, the player receives a one-time points alternative (100 for hats/palettes, 150 for skins). Claiming unlocks the item for the shared collection; equipping remains in the existing customization UI.

## Runtime and persistence

- `wormStory` stores bounded stars and reward claims inside the existing player save, alongside XP, wallet and owned items. Existing saves default to an empty chapter. Incomplete or malformed progress does not unlock later levels.
- Story completion checks the active run ID, alive/started/unpaused state and actual simulation outcomes. A tunnel-entry event alone cannot finish traversal. Jump input alone cannot finish the body crossing. A queued or animating turn cannot finish Moving Ground.
- Story has finite authored orbs, no random holes, ambient enemies, bombs, elemental offerings or random scramble. Only Moving Ground runs the normal warned slice scheduler. The original collision, cut, death, tunnel extrusion, jump rescue and healing mechanics remain active.
- Ordinary XP runs, missions, survival coins and per-heal payouts are excluded from Story. Replays award only previously unearned star improvements. Free Play retains its own run economy and customization; Story's enemy setting does not overwrite the saved Free Play preference.
- Objective time is held during Pause, hidden-document frames and the jump rescue hold. Progress text publishes only when it changes. Menu illustrations use SVG without additional WebGL preview contexts. Free Play setup remains lazy-loaded.

## Validation

`npm run ci` passes: lint, 179 test files / 2,185 tests, production build and bundle budgets. Initial route: 6 files, approximately 2,011 KiB raw / 494 KiB Brotli; no new dependency.

Focused tests exercise both entry paths, keyboard/back navigation, chapter locks, reward claims and save reloads, retry resets, full-tail tunnel completion, successful and fatal body crossings, the single-turn scheduler, and both healing levels. The final level test collects placed orbs and heals all three pairs through real movement and tunnel triggers, without teleporting the worm or granting inventory.

Browser/phone WebGL visual verification remains outstanding; browser access was blocked in this environment. Automated DOM and physics tests do not establish final appearance or frame rate on a device. Before release, inspect the split at narrow portrait and landscape sizes, the ready/result cards above the thumb tray, and opposite-face target markers under the chase camera.
