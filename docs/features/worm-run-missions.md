# Worm run achievements

Normal Worm and Mega runs show one active achievement at a time. Completing it
immediately removes it from live play and assigns the next objective. Every
completion is kept in the current run's earned list. The guided demo has no
achievements or achievement payouts.

## Track

| Objective | Parity Points | Base XP |
| --- | ---: | ---: |
| Collect 8 orbs | 20 | 50 |
| Complete 1 tunnel trip | 25 | 50 |
| Collect 3 distinct face colors | 30 | 50 |
| Heal 1 tunnel | 40 | 50 |
| Collect 20 orbs | 35 | 50 |
| Complete 3 tunnel trips | 45 | 50 |

The six objectives repeat, including within the same run. Each completion has a
separate receipt, even when the same objective is earned again. Targets are fixed
across cube sizes. XP uses the run's existing difficulty multiplier: Easy ×1,
Medium ×1.2, Hard ×1.4. Level-up PP is separate from achievement reward totals.

## Progress and rewards

- New assignments count actions taken after assignment. Earlier pickups, tunnel
  trips and heals cannot automatically complete a replacement objective.
- Absolute counters track all three event types throughout a run, even while an
  unrelated objective is active. The new objective starts at the current counter.
- Color achievements track distinct new pickup faces. Depositing orbs preserves
  progress; duplicate or older pickup notifications cannot add a new face color.
- Tunnel achievements update on crawl resumption after windout; healing updates
  when the game actually heals a tunnel pair, including ring healing.
- Completing an achievement commits its PP, XP, receipt and replacement objective
  in one store update. Reopening pause/results never awards those rewards again.
- Paused, dead, ended, pre-game, demo, invalid-counter and stale-run events are
  ignored. An event can complete at most one objective; it cannot cascade through
  later objectives on the same tick.

## Run lifecycle

Earned receipts remain available on both death and victory screens. Starting a new
run clears the run list, counters and partial progress. The saved track resumes
with the unfinished objective; already earned PP and XP remain in the player's
wallet and profile. Exiting clears run-only data while retaining lifetime progress.

Lifetime completion count continues to use `worm3_missions_v1`. XP and wallet use
the existing player snapshot. Malformed/unavailable storage is handled without
crashing. Active runs and their earned lists are not restored after a page reload.

## UI

The compact live card above the touch controls shows only the current objective,
its counter and reward. Replacement uses a short fade/slide and a polite screen
reader announcement. Reduced-motion preferences disable the transition. Completed
cards do not linger over the cube or move the camera.

Pause shows achievements earned so far, their reward totals, and the active
objective separately. End-of-run results list every earned achievement in order,
including repeated objectives, with the actual PP and XP earned. The unfinished
objective is labeled for the next run and is never included as earned. Runs with
no completions show an explicit empty state. Existing scrollable result screens
keep long achievement lists and the Play again button reachable.

## Verification

The mission tests cover immediate replacement, new-objective baselines, batched
and duplicate events, distinct colors, repeated tracks, per-achievement XP/PP,
level rewards, persistence, death/retry/exit, pause/demo exclusions, live-card
replacement, full win/death results and results reopening without another payout.
Store surface and XP event tests also cover the new state and cumulative rewards.
