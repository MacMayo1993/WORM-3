# Campaign objective supply audit — October 19, 2026

Chapter 10, level 1 is campaign level 91, **Reflection**. It requires six different tunnel crossings, two self-passes through the Core, and a peak body length of 120 segments.

## Fix

Tunnel supply now follows unfinished crossing, healing, surround, double-heal and self-pass tasks. It keeps up to two safe open pairs available during active surface play, subject to existing animation, body and transit holds. When queued mouths are occupied, it searches for another safe antipodal pair. Crossing replacements exclude already credited pair identities, so surrounding an unvisited pair cannot permanently spend the crossing inventory. A self-pass task can replenish its second retry pair while the first is still open. Replenishment stops once all tunnel-related tasks are earned.

Surround healing is also allowed on tunnel trial levels. Exhausted flip pairs are skipped instead of consuming a queue slot through a no-op flip. Explicit tunnel qualifiers stage tunnels even on another primary mission type.

## Automated results

`npm run worm:tools:build` audits all 120 current campaign levels and all 557 displayed objectives, including their completion predicates and resource schedules.

| Check | Passed |
| --- | ---: |
| Characters | Glow and Classic |
| Seed variations per character/level | 6 |
| Staged variations | 1,440 |
| Recurring power offers | 5,436 |
| Complete food inventory restores | 1,440 |
| Food restores after layer rotations | 1,440 |
| Independent tunnel task supply checks, including occupied mouths | 458 |
| Missed tunnel task attempts recovered | 2,268 |
| Replacement tunnel transactions | 3,592 |
| Action counter fixtures | 98 |
| Detected supply/timing findings | 0 |

The audit now checks the complete elemental inventory over repeated offers, including cases where a head or tunnel temporarily occupies a face center. It no longer assumes every required element appears as the first orb of a serial cycle.

Regression tests exercise every tunnel trial after surrounding the original inventory without crossing credit, the reported level with rotated pickup-blocked mouths, self-pass-only retries, occupied boards, exhausted flip pairs, completion stopping and the live crawler's surround permission. Every enemy objective is also exercised through real projectile kills after a missed encounter. Existing campaign-wide bomb scheduler tests cover replacement after a missed bomb and every required disarm, independently of enemy kills. Existing power, food, fusion, body-jump, rotation and completion tests cover their respective task rules.

These checks validate supply and completion contracts. They are not full manual playthroughs of all levels or proofs that every route is survivable.

## Repository validation

- Full regression suite: 426 files / 6,953 tests passed.
- Additional enemy supply suite: 25 tests passed.
- ESLint: zero errors; 91 existing warnings.
- Production build and bundle budgets: passed.
