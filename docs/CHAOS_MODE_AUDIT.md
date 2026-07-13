# Chaos Mode & Disparity Betting — Code Review Audit

Audit date: 2026-07-13 · Scope: `src/workers/chaosWorker.js`, `src/hooks/useChaosMode.js`,
`src/hooks/useChaosWorker.js`, `src/manifold/ChaosWave.jsx`, `src/utils/disparityBetting.js`,
`src/components/screens/DisparityBettingScreen.jsx`, `DisparityWinnerScreen.jsx`,
betting flow in `src/App.jsx` and `src/hooks/useGameStore.js`.

Baseline: all 562 tests green. Overall the chaos architecture is in good shape —
the worker offload, copy-on-write batch application, `ROTATE_SLICE` replay instead of
structured-cloning the cube, lazy manifold-map rebuilds, throttled store flushes, and the
shared-mutable countdown for the HUD are all the right calls. The findings below are
ordered by severity within each section.

---

## 1. Gambling section (Parity Roulette)

### 1.1 🔴 DEV overrides disable the entire economy
`src/hooks/useGameStore.js:52-53`

```js
const ownedItems = [...DEFAULT_OWNED];                    // DEV: all items unlocked
const safeParityPoints = Math.max(parityPoints, 10000);   // DEV: floor wallet at 10 000
```

Every page load floors the wallet at 10 000 PP and unlocks the whole store. Bets are
riskless (any loss is refunded by the floor on next reload) and winnings buy nothing that
isn't already owned. The betting feature cannot be meaningfully evaluated, and shipping
this would zero out the economy. These must be gated behind an env flag
(`import.meta.env.DEV`) or removed before release.

### 1.2 🔴 Odds are incoherent: SURVIVOR and PAIR are the same event at different prices
`src/utils/disparityBetting.js:22-55`

The chaos worker always finishes with an **antipodal pair** (deaths propagate pairwise),
so "face X survives to the final pair" is *exactly* the event "the pair containing X
wins" — both are 1-in-3 under uniform elimination. Yet:

| Bet | True probability | Odds | EV per 1 PP staked |
|---|---|---|---|
| SURVIVOR | 1/3 (desc claims "1-in-6", wrong) | 4× | **+0.33** |
| PAIR | 1/3 | 8× | **+1.67** |
| FIRST_OUT | 1/6 | 4× | −0.33 |
| SPEED | depends on level/size tuning | 1.8× | unknown |

PAIR pays out 2.67× the stake in expectation *before* the streak bonus (up to a further
+50%). A player betting PAIR every round grows their bankroll geometrically. SURVIVOR is
strictly dominated by PAIR while pretending to be a different bet.

Suggested rebalance (target ~10% house edge like real roulette):
- PAIR: **2.7×** (EV −0.10)
- SURVIVOR: either delete it, or redefine it as something distinct (e.g. "face X is in
  the final pair **and** was never the first face eliminated") — otherwise fold it into PAIR.
- FIRST_OUT: **5.4×** (EV −0.10)
- SPEED: measure the actual fast/slow split per chaos level and set odds from data; a
  flat 1.8× on both sides is only fair if the split is truly 50/50.
- Fix the SURVIVOR copy: "1-in-6 shot" → "1-in-3 shot" (whatever the final design).

### 1.3 🟠 An abandoned bet silently resolves against the next, unrelated round
`useGameStore.js:213` (`clearDisparityGame`), `:289` (`resetGame`), `App.jsx:527-561`

Neither `clearDisparityGame` nor `resetGame` clears `activeBet` (intentional at round
start, since the bet is placed *before* `startDisparityGame` runs — but there is no
cleanup on abandonment either). If the player quits mid-round (menu, size change, mode
switch), the wager is already spent and `activeBet` lingers. The resolution subscription
fires on **any** `showDisparityWinner` transition — including a later freeplay chaos
session started from the chaos slider (`useChaosWorker` START calls `clearDisparityGame`,
which keeps `activeBet`). The stale bet then pays out or busts against a round the player
never bet on.

Fix: clear (or refund) `activeBet` at every point that tears down a disparity round
without a winner — e.g. in `resetGame`, or tag the bet with a round id and have the
resolver ignore mismatched rounds.

### 1.4 🟡 Double-tap could place the bet twice — fixed in this branch
`DisparityBettingScreen.jsx` `handlePlace`

`onPointerDown` can fire twice on a fast double-tap before the screen unmounts, and the
`spendCoins` return value was ignored. Fixed: a `placedRef` guard plus honoring
`spendCoins`'s boolean. (Also added `src/__tests__/disparityBetting.test.js` — the betting
module previously had zero test coverage.)

### 1.5 🟡 Winner banner shows gross payout; betting screen shows net profit
`DisparityBettingScreen.jsx:371` shows "+75 PP" (net: 25 PP @ 4× minus stake);
`DisparityWinnerScreen.jsx:380` shows "Won +100 PP" (gross `calcPayout`). Same bet, two
different numbers. Pick one convention (net is more honest since the stake left the
wallet at placement) and use it in both places.

### 1.6 🔵 Minor
- **SPEED with <2 deaths counts as FAST** (`disparityBetting.js:122-127`, elapsed = 0).
  Theoretical today (a winner requires ~`size²·6 − 2` deaths) but worth an explicit rule.
- **All-in chip below BET_MIN**: with 1–9 PP the "All-in" chip is selectable but the bet
  can never be placed. Hide the chip when `maxWager < BET_MIN`.
- **`betStreak` is memory-only** while the wallet persists — a streak dies on reload.
  Comment says intentional; if so, consider surfacing that in the UI ("streak resets on
  restart"), otherwise persist it next to `parityPoints`.
- `earnCoins`/`spendCoins`/`buyItem` correctly clamp at 0, round amounts, and persist —
  no issues found there.

---

## 2. Chaos mode — correctness

### 2.1 🟠 Worker/main-thread recovery guard mismatch can desync the two cube copies
Worker `chaosWorker.js:376`:

```js
if (currentFlips <= 0 || currentFlips >= flipCap) return;  // dead tiles never recover
```

Main-thread replay `useChaosWorker.js:74-77` (`recoverOne`):

```js
if (currentFlips <= 0) return;                              // no flipCap guard
```

A recovery op names one pair member; both sides re-derive and apply the antipodal
partner independently. If the partner sits at `flipCap` (dead), the worker skips it but
the main thread decrements it and flips its color — the rendered cube revives a tile the
worker still considers dead, and every subsequent op on that pair compounds the drift.
Pair members can desync at the cap boundary because `applyFlip` skips a capped member
while its partner keeps incrementing. **Fix: add `|| currentFlips >= flipCap` to
`recoverOne`, mirroring the worker.**

### 2.2 🟠 `conwayTick` never registers deaths
`chaosWorker.js:387-466`

Conway births apply `Math.min(flipCap, flips + 1)` to both pair members but never run
the `checkDeath` bookkeeping the chain tick has. A sticker pushed to `flipCap` by a
Conway birth gets no death event, stays out of `deadTileSet`, keeps its `livingStickers`
entry, and `faceAliveMap` is never decremented — until a chain happens to start on it
(likely eventually, since start weight is `flips²`). Until then the death log, FIRST_OUT
bets, and face-elimination events are all blind to it. Extract the chain tick's
death-check into a helper and call it from `conwayTick` after applying births.

### 2.3 🟡 Changing chaos level mid-round resurrects the dead
`chaosWorker.js:797-799` — `SET_CHAOS_LEVEL` calls `resetChainState()`, which wipes
`deadTileSet`, resets `deathRank`/`winnerAnnounced`, and re-seeds `faceAliveMap` and
`livingStickers` from **all** surface stickers, ignoring prior deaths. The main thread
keeps its death log (per-gridId dedupe hides duplicates), but face-elimination events can
fire twice and winner detection restarts from zero. If mid-round level changes are meant
to be legal, `resetChainState` needs to rebuild from `deadTileSet` instead of clearing it;
if not, ignore `SET_CHAOS_LEVEL` while a disparity round is live.

### 2.4 🟡 Winner announcement timer isn't cancelled
`useChaosWorker.js:188` — `setTimeout(announce, 700)`. If the player exits chaos mode in
that window, the winner screen still pops over whatever mode they're now in. Store the
timer id and clear it in the effect cleanup / on `STOP`.

### 2.5 🔵 Minor
- Conway **birth/recovery caps are filled in Map-insertion order** (`births.length <
  birthCap` inside the scan), so stickers early in `livingStickers` win the birth lottery
  every generation — a deterministic spatial bias. Reservoir-sample the candidates
  instead of taking the first N.
- `SET_FLIP_CAP` raises/lowers `flipCap` without re-evaluating existing tiles: lowering
  it below a live tile's flip count strands that tile (can't flip — treated as capped;
  can't recover — `>= flipCap` guard). Only matters if the cap is changed mid-round.

---

## 3. Chaos mode — performance & optimization opportunities

### 3.1 Worker heartbeat never sleeps
`chaosWorker.js:718` — `setTimeout(schedule, size >= 5 ? 32 : 16)` wakes 30–60×/s even
when the next chain tick is 500+ ms away and Conway is 1–2 s away. The next-due time is
already known (`effectivePeriod − tickAcc`, `conwayPeriod − conwayAcc`); sleeping
`min(...)` of those (clamped to ≥16 ms) cuts idle worker wakeups by ~90% — meaningful on
mobile batteries. Low risk since all cooldowns are already wall-clock (`dtMs`) based.

### 3.2 Auto-rotate effect churns every rotation cycle
`useChaosMode.js:202` — the RAF-loop effect lists `upcomingRotation` in its deps, so each
fired rotation (loop calls `setUpcomingRotation`) tears down and rebuilds the loop, and
the initial-countdown block (lines 192-198) duplicates the in-loop interval math (156-162)
just to survive the remount. Keeping `upcomingRotation` in a ref (publishing to the store
for the HUD only) makes the effect mount once per chaos session and deletes the
duplicated countdown code.

### 3.3 Duplicated pure logic between worker and hooks
`buildSurfaceCoords` and `computeChaosMetrics` exist in both `useChaosMode.js` and
`chaosWorker.js`, and the worker re-implements `getGridRC` / `getManifoldGridId` /
`buildManifoldGridMap` / `findAntipodalStickerByGrid` from `src/game/manifoldLogic.js`.
The worker already imports from `src/game/` (`cubeRotation.js`), so the manifold helpers
can be shared too. Drift has already crept in: the worker's metrics include
`totalFlips`/`deadTiles`, the hook's copy doesn't.

- Related: the main-thread metrics scan in `useChaosMode.js:99-104` duplicates the
  worker's `METRICS` snapshot posted on `START`; the effect exists only to seed
  `disparityRef` before the first tick and could read the worker snapshot instead.

### 3.4 Things that are already right (don't "fix" these)
- COW batch writer (`makeCowWriter`) keeps per-TICK cloning proportional to touched
  cubies, not cube size.
- `ROTATE_SLICE` replays move params instead of structured-cloning the whole cubies
  array across the postMessage boundary; manifold map is invalidated lazily.
- Store stat flushes throttled to ~3/s; countdown HUD bypasses React entirely via
  `chaosCountdownState` + direct DOM writes in `RotationPreview`.
- `MAX_OPS_PER_CHAIN_TICK`, cascade caps (`MAX_CASCADES = 4`, ≤3 bolts/tick, ≤2/Conway
  tick), and `computeSizePenalty` keep worst-case main-thread work bounded on 5×5+.
- `ChaosWave` shares static geometries, uses scratch vectors, disposes per-instance line
  geometries, and animates via refs in `useFrame` — no per-frame React work.
- Weighted reservoir sampling (Efraimidis–Spirakis) in `findChainStart` avoids building
  candidate arrays; `livingStickers`/`neighborCache` maps give O(1) hot-path lookups.

---

## 4. Changes made in this branch

1. `DisparityBettingScreen.jsx` — double-placement guard + honor `spendCoins` result (§1.4).
2. `src/__tests__/disparityBetting.test.js` — 27 new tests covering `streakMultiplier`,
   `calcPayout` rounding, grid-ID helpers, face/pair data symmetry, and all four bet
   types' win/lose/edge paths (previously zero coverage).
3. This document.

Recommended follow-up order: 1.1 (dev overrides) → 2.1 (recovery guard, one line) →
1.3 (stale bet) → 1.2 (odds rebalance, needs a design decision) → 2.2 → 3.1.
