# Antipodal Math — the exact decoder behind WORM-3

This folder holds the **mathematical foundation** for WORM-3's antipodal engine and
the **analytic level generator** built on top of it. It is reference material and
pedagogy, not gameplay code.

## Contents

| File | What it is |
| --- | --- |
| [`symmetry-induced-exact-decoding.md`](./symmetry-induced-exact-decoding.md) | The paper *Symmetry-Induced Exact Decoding Under Free Actions* (Markdown rendering — the pedagogy). |
| [`Symmetry_Induced_Exact_Decoding.docx`](./Symmetry_Induced_Exact_Decoding.docx) | The same manuscript, original submission-ready `.docx`. |
| [`verify_symmetry_induced_decoding.py`](./verify_symmetry_induced_decoding.py) | Independent brute-force verifier (BFS/Dijkstra) that checks every closed-form decoder against exhaustive search. |

Run the verifier (no dependencies beyond the Python standard library):

```bash
python3 docs/antipodal-math/verify_symmetry_induced_decoding.py
# → sector_cases / quotient_cases / … / ALL_OK
```

It confirms, on small state spaces, the formulas the game relies on — in
particular the **directed canonical decoder** (Theorem 6):

```
C_dir = n_A + min(n11, P − n11)
```

## How this maps onto the codebase

The paper's abstract kernel `(X, τ, b)` — a finite set, a fixed-point-free
involution, and a binary state — is exactly WORM-3's fibre algebra:

| Paper | WORM-3 |
| --- | --- |
| free involution `τ` | antipodal β-pairing (`findAntipodalStickerByGrid`) |
| defect `D b` = pair disagreement | `deltaInvariant` — the asymmetric β-pairs |
| `wt(D b)` mandatory heals | `fibreCosts().asymmetricPairs` |
| completion `min(k, P−k)` | `min(dirtyPairs, P − dirtyPairs)` |
| directed cost `C_dir` (Thm 6) | `fibreCosts().quotientCost` |
| global complement `γ` | `globalColorFlip` |

See [`../antipodal-identification-engine.md`](../antipodal-identification-engine.md)
for the engine-side write-up.

## Using the formula as a level randomizer

Because `C_dir` is a **closed form**, level design becomes forward synthesis
instead of backward search: pick a target par, and
[`src/levels/antipodalRandomizer.js`](../../src/levels/antipodalRandomizer.js)
enumerates the partitions `(n00, n11, n_A)` that realise it, then instantiates a
deterministic bit vector from a seed. No pathfinding is ever run.

```js
import {
  generateLevelState,   // synthesize one state with an exact par
  generateCampaign,     // the 5-tier, 100-level curriculum
  generateDailyChallenge, // one shared puzzle keyed to a calendar date
  nextHint,             // O(P) zero-cost hint straight from the decoder
  starsForMoves         // deterministic 3-star rating vs. par
} from '../levels/index.js';

const daily = generateDailyChallenge('2026-08-21');   // identical for all players
const campaign = generateCampaign();                  // deterministic 100 levels
```

Four independent difficulty levers fall out of the partition
`(n00, n11, n_A)`:

- **Par cost** `C_dir` — the exact shortest solve length.
- **Asymmetry defect** `n_A` — broken pairs forcing local inspection (targeted heals).
- **Target ambiguity** `|P − 2·n11|` — `0` makes both polarities cost the same
  (a branching puzzle); large values give one obvious attractor.
- **Clean/dirty invariant pairs** `n00, n11` — pre-synchronised pairs.

The generator, campaign, daily challenge, hint engine, and star rating are all
covered by [`src/__tests__/antipodalRandomizer.test.js`](../../src/__tests__/antipodalRandomizer.test.js),
which also asserts the generator never touches `Math.random` (determinism/replay
safety).

### Playable levels

[`src/levels/antipodalLevelBridge.js`](../../src/levels/antipodalLevelBridge.js)
lands the abstract fibre partition on a real cube as a `createLevel` descriptor
that the staging pipeline can open on and the CLASSIC win condition can score.

Native antipodal flips are **paired** (∆-preserving), so staging can only reach
the **symmetric sector** (`n_A = 0`): flip `n11` distinct β-pairs, and the CLASSIC
solve un-flips each, giving an exact `par = n11 = C_dir`. Asymmetric defect pairs
(`n_A > 0`) are exactly the ∆ ≠ 0 states the monograph proves unreachable by
paired moves — they belong to the worm/heal move model, not classic staging, and
are intentionally left for that pipeline.

The generated **Antipodal Descent** pack (ids 301–399, registered in
`packs/index.js`) is a deterministic 12-level par ramp built from this bridge:

```js
import { buildPlayableAntipodalLevel, buildAntipodalDescentPack } from '../levels/index.js';

const pack = buildAntipodalDescentPack();          // registered as 'antipodal-descent'
const custom = buildPlayableAntipodalLevel({ id: 350, size: 4, targetPar: 9, seed: 'daily' });
```

Covered by [`src/__tests__/antipodalLevelBridge.test.js`](../../src/__tests__/antipodalLevelBridge.test.js),
which stages each generated level and confirms its measured fibre cost
(`antipodalEngine.fibreCosts`) equals the authored par.
