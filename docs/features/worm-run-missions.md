# Worm run missions

Normal worm runs now have one optional mission. Missions add a goal and a Parity Point bonus without changing survival, controls or the cube's win conditions. The guided demo has no missions or mission payouts.

## First track

| Objective | Bonus |
| --- | --- |
| Collect 8 orbs | 20 PP |
| Complete 1 tunnel trip | 25 PP |
| Collect 3 distinct face colors | 30 PP |
| Heal 1 tunnel | 40 PP |
| Collect 20 orbs | 35 PP |
| Complete 3 tunnel trips | 45 PP |

The six objectives repeat after a full track. Targets stay fixed across cube sizes so switching size cannot change the assignment's meaning. An unfinished mission stays assigned; its progress starts at zero on the next run. A completed mission stays visible through the current run and unlocks the next assignment for the next run.

## Counting and rewards

- Ordinary orb pickup notifications provide absolute session totals, making repeated or lower counter notifications harmless.
- Color missions remember distinct face IDs at pickup time; depositing inventory does not remove mission progress.
- Tunnel missions update on crawl resumption after windout, not tunnel entry.
- Healing updates when the game actually heals a tunnel pair, including ring healing.
- Progress, completion count and the wallet bonus are committed in one store update. Once complete, further notifications cannot pay again. Demo, dead, pre-game and mismatched-run events are ignored.
- Completed mission count is saved in `worm3_missions_v1`, with defensive parsing and in-memory behavior when browser storage is unavailable. The existing wallet subscription saves the PP balance. Active run progress is intentionally not resumed after reload.

## UI

A compact card above the measured touch-control tray shows the objective, counter, progress bar and PP bonus. It yields to pause and result screens; those screens display an inline mission summary instead. Completion displays the earned reward without stopping play or moving the camera. Result actions distinguish Retry mission and Next mission. Progress has accessible values and reduced-motion preferences disable its transition.

## Verification

92 tests across six focused suites pass, including nine mission tests covering lifecycle, exactly-once reward, persistence parsing, reset/exit, distinct colors, invalid counters, demo exclusion and UI. Existing economy, simulation, store contract and mobile-demo suites also pass. Production build and bundle-size gate pass; changed-source lint has no errors. Phone/WebGL visual verification remains pending in the draft PR.
