# Worm level quest supply audit — September 30, 2026

Audited all 40 authored levels against staging, refill, power offers and completion rules. Based on main at 0afc6ac. This is a source and automated runtime audit, not a claim of manual playthroughs of all levels.

## Findings and changes

- Fixed-priority powers could indefinitely repeat Magnet or an unmastered element. Level 30's Explode was behind both. The scheduler now cycles unfinished powers on successful **placement**, including missed/expired offers, and skips completed goals.
- Keep one marked special, the 10-second opening, and the full 20-second pickup lifetime. Recovery is now 3 seconds instead of 5. New offerings wait for active effects and landings. Failed placement does not advance the cycle.
- Dense food routes can trade one safe ordinary-orb slot for a required power. Placement still avoids the head, previous tile, body, next three straight steps and open tunnel tiles. Normal color refills restore displaced food.
- Magnet support counts existing food in its real two-step manifold reach, including seams. It adds only outstanding catches, at most four, and replaces leftover support from earlier offers. Missed magnets cannot accumulate unlimited bonus food.
- Existing ordinary-orb refills already preserve six color budgets every 1.5 active seconds, even after the collection quota. Tunnel staging supplies every required pair, with at most two active at once and future mouths reserved from ordinary food refills. Small boards retain their 60% food cap.
- Boost and double-jump quests use player controls. Bomb and enemy goals have recurring dedicated supply until complete. Surround/ability gates preserve healable tunnels until those tasks earn credit.
- Corrected stale rotation descriptions in levels 33, 34, 36 and 38 to match their existing intervals: 10, 10, 11 and 8 seconds. Timing and task targets are otherwise unchanged.

## Every level

Every row has recurring ordinary orbs in all six colors. Power lists recur in order, skipping fulfilled goals. Element pickups count collection; mastery requires performing the element's action. The table below is generated from the authored task definitions.

| Level | Board | Tasks | Required power cycle | Par / limit (s) |
| --- | --- | --- | --- | --- |
| 1. First Crawl | 6×6 | 18 orbs; 6 colors | None required | 70 / 125 |
| 2. Through the Looking Glass | 6×6 | 4 crossings | None required | 95 / 165 |
| 3. Clear Your Tail | 6×6 | 4 body jumps; 12 orbs | None required | 105 / 180 |
| 4. Moving Ground | 6×6 | 6 turns; 18 orbs | None required | 130 / 205 |
| 5. Color Collector | 6×6 | 4 heals; 6 colors | None required | 165 / 260 |
| 6. Restore the Cube | 6×6 | 6 heals; 30 orbs; 6 turns | None required | 220 / 340 |
| 7. Full Throttle | 6×6 | 2 boosts; 2 double jumps; 1 rocket landings; 4 remote catches; 2 heals; 24 orbs | Magnet, Rocket | 230 / 380 |
| 8. Force of Nature | 6×6 | 2 element pickups; 3 heals; 24 orbs | Water, Fire | 300 / 475 |
| 9. Under Siege | 6×6 | 1 surround heals; 2 abilities; 1 disarms; 1 kills; 4 heals; 24 orbs | None required | 325 / 515 |
| 10. Worm Ascendant | 6×6 | 1 kills; 3 heals; 24 orbs; 4 turns | None required | 220 / 380 |
| 11. Pocket Crawl | 2×2 | 10 orbs; 6 colors | None required | 70 / 125 |
| 12. Grid Lines | 3×3 | 3 crossings | None required | 90 / 165 |
| 13. Numbers Underfoot | 4×4 | 3 body jumps; 10 orbs | None required | 90 / 165 |
| 14. Glass Carousel | 3×3 | 5 turns; 12 orbs | None required | 110 / 190 |
| 15. Chrome Works | 6×6 | 4 heals; 6 colors | None required | 180 / 285 |
| 16. Sea of Seven | 7×7 | 5 heals; 24 orbs; 5 turns | None required | 245 / 395 |
| 17. Launch Pad | 4×4 | 2 boosts; 2 double jumps; 1 rocket landings; 2 heals; 14 orbs | Rocket | 165 / 285 |
| 18. Blast Radius | 6×6 | 2 explosions; 3 heals; 20 orbs | Explode | 230 / 380 |
| 19. Neon Arcade | 8×8 | 6 crossings | None required | 205 / 340 |
| 20. Size Summit | 8×8 | 1 explosions; 1 rocket landings; 4 remote catches; 2 element pickups; 1 abilities; 4 heals; 30 orbs; 6 turns | Magnet, Explode, Water, Rocket, Fire | 405 / 625 |
| 21. Hollow Hills | 5×5 | 20 orbs; 6 colors | None required | 85 / 150 |
| 22. Ghost Frame | 5×5 | 4 crossings | None required | 110 / 190 |
| 23. Brick by Brick | 4×4 | 4 body jumps; 12 orbs | None required | 110 / 190 |
| 24. Biome Crossing | 6×6 | 3 element pickups; 3 heals; 18 orbs | Water, Fire, Grass | 300 / 460 |
| 25. The Far Side | 5×5 | 4 heals; 20 orbs; 4 turns | None required | 205 / 340 |
| 26. Remix | 5×5 | 6 turns; 18 orbs | None required | 125 / 220 |
| 27. Neon Storm | 6×6 | 3 element masteries; 3 heals; 20 orbs | Water, Fire, Grass | 325 / 515 |
| 28. Shatterglass | 7×7 | 2 explosions; 1 rocket landings; 3 heals; 24 orbs | Explode, Rocket | 315 / 490 |
| 29. Number Siege | 7×7 | 1 surround heals; 1 abilities; 1 disarms; 2 kills; 4 heals; 24 orbs | None required | 355 / 540 |
| 30. Kaleidoscope | 6×6 | 3 element masteries; 1 explosions; 2 double jumps; 4 remote catches; 5 heals; 30 orbs; 6 turns | Magnet, Explode, Water, Fire, Grass | 490 / 730 |
| 31. Nine Lives | 9×9 | 36 orbs; 6 colors | None required | 180 / 300 |
| 32. Tenfold Tunnels | 10×10 | 6 crossings | None required | 230 / 380 |
| 33. Knife Edge | 2×2 | 8 turns; 10 orbs | None required | 125 / 205 |
| 34. Chrome Gauntlet | 9×9 | 6 heals; 30 orbs; 6 turns | None required | 355 / 540 |
| 35. Hollow Siege | 8×8 | 1 surround heals; 2 abilities; 2 disarms; 3 kills; 4 heals; 24 orbs | None required | 405 / 625 |
| 36. Ghost Storm | 6×6 | 4 element pickups; 3 heals; 20 orbs | Water, Fire, Grass, Ice | 340 / 515 |
| 37. Brick Blast | 10×10 | 3 explosions; 2 rocket landings; 4 heals; 30 orbs | Explode, Rocket | 450 / 675 |
| 38. Mirror Numbers | 7×7 | 6 heals; 30 orbs; 8 turns | None required | 340 / 515 |
| 39. Mega Crawl | 15×15 | 40 orbs; 6 colors | None required | 355 / 570 |
| 40. Worm Eternal | 10×10 | 1 surround heals; 2 abilities; 2 boosts; 2 double jumps; 1 rocket landings; 4 remote catches; 2 explosions; 5 element masteries; 2 disarms; 6 kills; 6 heals; 40 orbs; 10 turns | Magnet, Explode, Water, Rocket, Fire, Grass, Ice, Lightning | 650 / 975 |

## Verification scope

- All 40 stages with normal and Classic food density: six colors, required tunnel count, no duplicate food, three power cycles without task credit, and refill after full depletion.
- Level 30: a missed Magnet expires through the real crawler path, then Explode is offered and published to the quest marker without magnet credit.
- Completed-task skipping, retry resets, blocked placement, dense-food replacement, preserved elemental mastery requirements and active-effect recovery.
- Repeated magnet offers on alternate faces stay within four support orbs, all in remote-catch reach. Existing food and partial progress reduce added supply.
- A conservative supply-only budget fits each power level's time limit: two missed full cycles plus enough effect/recovery cycles for repeated-power counts. This excludes player routing, combat and tunnel travel time.
