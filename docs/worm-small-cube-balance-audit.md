# Small-cube campaign balance audit

Source: MacMayo1993/WORM-3, base commit 2bbfbc1.

Reviewed all 120 authored levels, including all 21 levels on 2×2, 3×3 and 4×4 cubes. Rebalanced 20: 11, 13, 14, 17, 23, 33, 51–60, 96, 98, 104 and 112. Level 12 already fits the small-board budgets.

## Level 60

The old definition stacked paid repairs, two self-passes, a double heal, growth and frequent turns on a 3×3 board.

| Requirement | Before | After |
|---|---:|---:|
| Heal pairs | 4 | 4 |
| Collect orbs | 42 | 28 |
| Body segments | 110 | 65 |
| Self-passes | 2 | Removed |
| Double heals | 1 | Removed |
| Layer turns | 4 | 3 |
| Speed setting | 2.1 | 1.55 |
| Seconds between turns | 11 | 18 |
| Three-star growth | 134 | 74 |

Speed falls 26.2%. The 420s par and 705s limit remain, providing more recovery time per task. Chain techniques remain in separate free-ride trials.

## Campaign changes

- Small decks reduce compulsory pickups, growth, jumps and turns. Three-star growth adds 2/3/4 extra pickups on 2×2/3×3/4×4 instead of eight. Large-board star targets are unchanged.
- Finite tunnel supplies could be exhausted while self-pass or double-heal tasks remained unfinished. Tunnel-dependent task levels now reopen two previously authored pairs after the network and tail clear, until the missing tasks are earned. Stable identities follow rotations; occupied endpoints, pauses, death, active turns and held animations block placement. Retry pairs do not award objective credit merely by opening.
- The auditor now checks board-size speed/growth/food/turn budgets, chain combinations and combined task time, including routing and recovery after power/rotation waits. Workshop generation uses the same small-board limits. These are conservative playability guardrails, not geometric impossibility proofs.
- Level IDs, unlock order, points and rewards remain unchanged.

## Verification

- 542 targeted regression tests passed across 11 files, including all-level task budgets, missing-goal rejection, repeated missed-chain recovery, safe rotated endpoints, stars, campaign generation and story flow.
- Full 120-level audit passed: 1,440 seeded stages across Glow/Classic, 5,004 repeated power offers, 1,440 full inventory restores, 1,440 post-rotation refills, and 211 authored replacement pairs. Zero supply/timing findings.
- Production build passed. Lint and bundle gate results are recorded in the pull request.

These checks exercise real staging, replenishment, counters and completion logic, plus modeled task time. They do not constitute 120 completed player runs or establish a player win rate. Priority hands-on checks: levels 54, 55, 60, 96, 98, 104 and 112, especially small-deck chain routing and touch controls.
