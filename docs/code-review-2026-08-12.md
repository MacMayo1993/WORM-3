# WORM-3 Code Review — Game Mechanics, UI/UX, Architecture Health

**Date:** 2026-08-12
**Scope:** full `src/` — 393 source files, ~90,800 LOC
**Baseline:** `npm run lint` clean · `npm run test` 1002/1002 passing across 64 files · `npm run build` succeeds · `bundle:check` passes

The previous review (`CODE_REVIEW.md`, 2026-03-17) covered ~49,600 LOC. The tree has since grown ~83%. Several of that review's structural recommendations were carried out — the setup-wizard duplication is gone, shaders are extracted into `src/3d/styles/shaders/`, and `HealerWormMode` was split into `useWormCrawler` + `healerWorm/*`. This review is fresh and focuses on defects that the green CI does not catch.

> **Status (2026-08-12, same day):** all fourteen findings addressed. Twelve are fixed, tested
> and driven in a browser to confirm behaviour at the real UI. Findings 11 and 13 are large
> refactors where the concrete harm was fixed and the bulk migration was deliberately left —
> see the note at the end of each. Suite grew 1002 → 1059 tests; lint, build and bundle gate green.
>
> **Correction:** finding 12 as first written claimed focus styling was absent app-wide. That was
> wrong — `App.css` has always carried a global `button:focus-visible` rule. The real defect is
> six components whose inline `outline: 'none'` beat it on specificity. Corrected in place below.

---

## Executive summary

The pure-logic core is genuinely excellent. `src/game/` is React-free and DOM-free (verified), densely documented with the *why* rather than the *what*, and carries the great majority of the 1002 tests. The performance engineering is real: incremental manifold-grid maps, shared-reference cubie cloning so `React.memo` can short-circuit, chaos simulation in a worker, adaptive DPR.

**The defects cluster almost perfectly in one layer: `src/hooks/`.** That layer holds the orchestration between pure logic and React, contains the 955-line store, is referenced by only ~2 test files, and is excluded from the coverage report entirely. Every correctness bug below lives there or in the constant it reaches for.

Three of the findings are player-visible today with default settings.

| # | Finding | Severity | Area |
|---|---------|----------|------|
| 1 | Configurable Disparity flip cap is only half-wired | High | Mechanics |
| 2 | Undo of a flip consumes two flips of tile life | High | Mechanics |
| 3 | Tapping a dead tile costs a move and does nothing | High | Mechanics / UX |
| 4 | 8 of 11 keyboard callbacks silently ignored, incl. `disabled` | High | Input |
| 5 | Global keydown handler is live on every screen | Medium | UX |
| 6 | `Escape` closes only 2 of ~10 dismissible surfaces | Medium | UX |
| 7 | Store monolith + no screen state machine | Medium | Architecture |
| 8 | `resetGame` has drifted from `makeDisparityRuntimeDefaults` | Medium | Architecture |
| 9 | Wallet persistence duplicated across 6 call sites | Low | Architecture |
| 10 | Coverage blind spot over `src/hooks/` | Medium | Test health |
| 11 | Remaining monoliths | Low | Architecture |
| 12 | Focus styling effectively absent | Medium | Accessibility |
| 13 | Styling is 995 inline objects vs 4.6k lines of CSS | Low | UI |
| 14 | `CLAUDE.md` drift | Low | Docs |

---

## 1. Configurable Disparity flip cap is only half-wired — **High**

`DisparitySetupWizard` offers flip caps of **3 / 8 / 13 / 20** (`DisparitySetupWizard.jsx:20-25`), and the store defaults `disparityFlipCap: 8` (`useGameStore.js:517`).

Three consumers honour that value:
- the chaos worker and sim (`chaosSim.js:103-106`, `setFlipCap` at `:661`),
- the per-tile health bar (`StickerPlane.jsx:685` — `effectiveFlipCap = chaosLevel > 0 ? disparityFlipCap : FLIP_CAP`),
- bet resolution (`disparityBetting.js:172`).

But the **player's own flip path does not**. `flipStickerPair` reaches for the module constant `FLIP_CAP = 6` (`utils/constants.js:84`):

```js
// src/game/manifoldLogic.js:206-213
const currentFlips = st.flips || 0;
if (currentFlips >= FLIP_CAP) return;          // ← module constant, not the configured cap
stickers[loc.dirKey] = { ...st, curr: ANTIPODAL_COLOR[st.curr],
  flips: Math.min(FLIP_CAP, currentFlips + 1) };
```

Verified empirically: after 12 consecutive player flips a sticker sits at `flips = 6`, regardless of the configured cap.

**Consequences at the default "Standard / cap 8" tier:** a tile at 6 flips displays a health bar reading 2/8 remaining — visibly alive — but the player's tap is refused. The player sees an alive tile that will not respond.

**At the "Fragile / cap 3" tier the error inverts:** the sim kills tiles at 3, but the player can keep flipping the same tile to 4, 5, 6 — pushing tiles past the death threshold the tier is built around, which is the entire point of "Fast massacre".

The same hardcoded constant leaks into the presentation layer, so the wormhole network severs pairs at 6 (`WormholeNetwork.jsx:79,88`), the pair-death FX fires at 6 (`useCubeState.js:248-256`), the leaderboard marks tiles dead at 6 (`TileLeaderboard.jsx:114-115`), and the HUD tooltip reports the wrong number outright — `` `${chaosStats.deadTiles} tiles burned out at flip cap (${FLIP_CAP})` `` (`TopMenuBar.jsx:284`) prints "(6)" during a cap-13 game.

`getHalfLifeMultiplier` (`constants.js:132-136`) is likewise pinned to the module constant, so parity-decay acceleration does not rescale with the chosen cap.

**Fix:** thread the effective cap as a parameter, exactly as `chaosSim` already does. Give `flipStickerPair` a `flipCap = FLIP_CAP` trailing argument, resolve `chaosLevel > 0 ? disparityFlipCap : FLIP_CAP` once in `useCubeState`, and pass it through. `StickerPlane.jsx:685` already computes precisely this expression — lift it to a selector (`selectEffectiveFlipCap`) and have every consumer read that one thing.

## 2. Undo of a flip consumes two flips of tile life — **High**

```js
// src/hooks/useUndo.js:62-68
} else if (lastMove.type === 'flip') {
  // Flip is its own inverse — just flip again.
```

The colour is its own inverse. The **flip counter is not** — `flipStickerPair` increments `flips` on both members of the pair on every call, including the undo.

Verified: start `curr=1 flips=0` → flip → `curr=4 flips=1` → undo → `curr=1 flips=2`. The board looks restored; the tile has silently spent a third of its life (2 of 6), and so has its antipodal partner.

Two follow-on effects:

- **On a capped tile the undo is a total no-op** — `flipStickerPair` returns early, so nothing changes — yet `useUndo` still calls `popFromHistory()` and `setMoves(m => m - 1)` (`useUndo.js:70-71`). The move counter drifts below the true move count and the history entry is destroyed. Verified: at `flips=6`, undo leaves `curr` and `flips` untouched.
- WORM³ victory counts stickers with `flips > 0` (`winDetection.js:142-154`). A flip that was undone still counts as travelled, so the secret win can be part-satisfied by moves the player took back.

**Fix:** undo needs a real inverse, not a repeat. Either record `flipsBefore` for both pair members in the history entry and restore it, or add an `unflipStickerPair` that toggles `curr` while decrementing `flips`. Bail out of the undo (leaving history and the counter intact) when the flip cannot be reversed.

## 3. Tapping a dead tile costs a move and does nothing — **High**

`flipSticker` guards on three things only — the first-flip timer, the refractory window, and first-flip interception (`useCubeState.js:157-193`). There is **no dead-tile guard**. When `flipStickerPair` refuses the flip, the surrounding batch still runs unconditionally (`useCubeState.js:275-300`):

```js
cubies: flipStickerPair(...),         // ← returns the board unchanged
moves: state.moves + 1,               // ← still charged
moveHistory: [...state.moveHistory, { type: 'flip', ... }],
flipWaveOrigins: origins,  blackHolePulse: ts,  flipPulse: {...},  cubiePops: {...},
```

So a tap on a burnt-out tile plays the sound, pops the cubie, rings the screen glow, charges a move, and pushes an undo entry — while the board does not change. This is the worst failure mode for feedback: the game says "that worked" when nothing happened. It also seeds finding 2's counter drift, since the history now holds an un-undoable entry.

**Fix:** return early from `flipSticker` when the tapped tile (or its partner) is at the effective cap, and give the refusal its own feedback — a dull thud and a shake read as "this tile is gone", which is information the player needs. The refractory guard at `:160` is the model to follow.

## 4. Eight of eleven keyboard callbacks are silently ignored — **High**

`App.jsx:1324-1336` wires up eleven props:

```js
useKeyboardControls({
  onMove, onFlip: onTapFlip, onUndo: undo, onReset: handleReset,
  onShuffle: animatedShuffle, onSaveState: handleSaveState,
  onLoadState: handleLoadState, onLevelJump: handleLevelSelect,
  onExecuteHandsMove: executeHandsMove, onToggleHandsMode: handleToggleHandsMode,
  disabled: coopMode,
});
```

The hook destructures two of them:

```js
// src/hooks/useKeyboardControls.js:18
export function useKeyboardControls({ onMove, onFlip }) {
```

Undo, reset, shuffle, save/load state, level jump, and both hands-mode callbacks have no keyboard binding at all, despite App building and passing every one. Undo in particular has no shortcut — there is no <kbd>Ctrl</kbd>+<kbd>Z</kbd> — even though `useUndo` is fully implemented.

**`disabled: coopMode` is the live bug.** Co-op crawler mode reads WASD and arrows for movement (`PlatformerWormMode.jsx:528-541`). App tries to disable the cube handler for exactly that reason, and the flag is dropped on the floor. `App.jsx:1353` early-returns into `PlatformerWormMode`, but hooks have already run, so the window listener from `useKeyboardControls` is still attached: **in co-op mode, WASD drives the crawler and rotates slices of the cube underneath simultaneously.**

**Fix:** honour `disabled` with an early return in the handler, and either implement the remaining shortcuts or delete the dead props. Do not leave them passed-but-ignored — the call site reads as though the feature exists.

## 5. The global keydown handler is live on every screen — **Medium**

The listener is attached once at App level with `[]` deps (`useKeyboardControls.js:308-311`) and guards only three cases: worm-paused, an editable event target, and the level tutorial (`:180-193`). Nothing checks `showMainMenu`, `showWelcome`, `showSettings`, `showStore`, any wizard, `showHelp`, or the victory screen.

Consequently, while a full-screen modal owns the display:
- <kbd>W</kbd>/<kbd>A</kbd>/<kbd>S</kbd>/<kbd>D</kbd>/<kbd>Q</kbd>/<kbd>E</kbd> rotate slices of the cube behind it,
- <kbd>C</kbd> toggles chaos, <kbd>V</kbd> cycles visual mode, <kbd>X</kbd> explodes the cube, <kbd>T</kbd> toggles tunnels,
- arrow keys call `e.preventDefault()` unconditionally (`:199-222`), which **blocks arrow-key scrolling inside the settings menu, the store, and the help panel** — all scrollable surfaces.

A player typing in the menu is silently scrambling their next game.

**Fix:** derive a single `inputTarget` from the screen state (see finding 7) and gate the whole handler on it, rather than adding one guard per new screen.

## 6. `Escape` closes only two of ~10 dismissible surfaces — **Medium**

```js
// src/hooks/useKeyboardControls.js:303-307
case 'escape':
  latestSetShowHelp(false); latestSetShowSettings(false); latestSetShowCursor(false);
```

The store, all four setup wizards, mode select, the Coming Soon screen, the Möbius cubelet viewer, the leaderboard, and the net panel all ignore <kbd>Esc</kbd>. Escape-to-dismiss is a convention players expect to hold everywhere once it works anywhere.

**Fix:** falls out of a screen state machine for free — pop the top of the stack.

---

## 7. Store monolith and the absence of a screen state machine — **Medium**

`useGameStore.js` is 955 lines spanning roughly twenty domains — cube, session, undo, visual modes, flip FX, chaos, disparity, economy, betting, worm, animation, cursor, UI, levels, hands, dev console, solve, teach, demo, merge, hollow/mirror, face rotation, settings. Only worm is factored out (`createWormSlice`, `:191`). Zustand's slice pattern is already in the file; it is applied once.

Two structural consequences:

**Screen state is ~24 independent booleans with no invariant.** Ten `useState` flags in App (`App.jsx:587-622`: `showCubeModeSelect`, `showFreeplayWizard`, `showRandomWizard`, `showWormModeWizard`, `showMobiIntro`, `showMergeThemePicker`, `showStore`, `showModeSelect`, `showComingSoon`, `showMobiusCubelet`) plus fourteen more in the store. Nothing prevents two from being true at once; correctness rests on every handler remembering to clear its peers. This is the root cause of findings 5 and 6 — there is no single value to ask "what owns the screen right now?"

**Game modes are non-exclusive booleans too.** `wormHealerMode`, `teachModeActive`, `holonomyMode`, `mergeMode`, `hollowMode`, `mirrorMode`, `flipMode`, `randomMode`, `demoMode`, `solveModeActive`, `chaosLevel > 0`. `getActiveMode` (`:934-944`) resolves conflicts by priority — which is a read-side paper-over, not an invariant. Two modes really can be on simultaneously; the selector just picks one and the other keeps running its effects. The manual patch-ups are already visible: `App.jsx:451-453` force-closes Teach Mode when the menu opens or the size leaves 3, because nothing else would.

**Fix (incremental, no big-bang):**
1. Split the store into slices by the section banners already in the file — they are an accurate map. `createWormSlice` is the template.
2. Introduce `activeScreen` as one enum plus a modal stack, and migrate the ~24 booleans to derived selectors so call sites need not change at once.
3. Replace the mode booleans with a single `activeMode` field; keep `getActiveMode` as a shim returning it, so consumers are unaffected while writers migrate.

## 8. `resetGame` has drifted from `makeDisparityRuntimeDefaults` — **Medium**

`makeDisparityRuntimeDefaults()` (`:137-150`) and the inline reset list in `resetGame` (`:338-363`) enumerate overlapping-but-unequal field sets:

- `resetGame` clears `tunnelDeaths`; the factory does not.
- The factory clears `disparityParityScore` and `holonomyMode`; `resetGame` does not — so **starting a fresh game carries the previous session's un-cashed parity score forward**, and can leave `holonomyMode` set.

Two hand-maintained lists of the same concept will keep diverging.

**Fix:** `resetGame` should spread `makeDisparityRuntimeDefaults()` and add only genuinely session-scoped fields, with `tunnelDeaths` moved into the factory alongside the other transient FX maps it already owns.

Adjacent smaller drift in the same file: the comment at `:522` names `makeWormRuntimeDefaults`, which does not exist (it is `makeWormSessionDefaults`); `clearDisparityGame` lives in the worm slice despite its name; `visualMode`'s comment lists four modes (`:381`) while `cycleVisualMode` cycles nine (`:459`); and `victory`/`achievedWins` still carry `sudokube` and `ultimate` (`:323-324`) whose screens were removed.

## 9. Wallet persistence duplicated across six call sites — **Low**

`localStorage.setItem(PARITY_POINTS_KEY, ...)` wrapped in `try/catch {}` appears in `cashOutParityScore` (`:535`), `earnCoins` (`:586`), `spendCoins` (`:593`), `buyItem` (`:609`), `beginDisparityRound` (`:633`), and `refundActiveBet` (`:644`). Any future writer of `parityPoints` that forgets the line loses the player's money on reload.

Settings already demonstrate the right pattern in the same file — a `subscribe` at `:947-955`. Apply it to `parityPoints`, `ownedItems`, and `betStreak` and delete the six inline writes.

## 10. Coverage blind spot over `src/hooks/` — **Medium**

```js
// vitest.config.js
include: ['src/game/**/*.js', 'src/utils/**/*.js', 'src/levels/**/*.js'],
```

`src/hooks/**` — 18 files including the 955-line store, `useCubeState`'s flip path, `useUndo`, and `useKeyboardControls` — is outside the coverage report and touched by roughly two test files. Findings 1–6 all live in that gap, and the suite is green with every one of them present.

This is the single highest-leverage change in the review: **add `src/hooks/**` to the coverage include and write tests for the flip/undo/keyboard paths.** The pure layer's test discipline is excellent — extending it one layer outward is what turns the green build into a real signal. The bugs above were each reproducible in a handful of lines using only existing pure helpers, so the tests are cheap to write.

## 11. Remaining monoliths — **Low**

| File | Lines |
|---|---|
| `src/3d/StickerPlane.jsx` | 2398 |
| `src/worm/healerWorm/wormSim.js` | 1756 |
| `src/App.jsx` | 1732 |
| `src/worm/WormCrawlerHUD.jsx` | 1635 |
| `src/components/menus/MainMenu.jsx` | 1493 |
| `src/3d/CubeAssembly.jsx` | 1278 |
| `src/components/screens/DemoFlowController.jsx` | 1207 |
| `src/teach/TeachMode.jsx` | 1183 |
| `src/hooks/useDemoMode.js` | 1102 |

`StickerPlane.jsx` grew from 1382 to 2398 since the last review despite being on its split list, and `App.jsx` from 1148 to 1732. App holds 27 `useState` calls and 84 store references. These are not urgent next to findings 1–6, but the store-slice work in finding 7 is the natural moment to lift App's mode-launch wiring out.

---

## 12. Focus styling is effectively absent — **Medium**

220 `<button>` elements across the app; **10 `:focus`/`:focus-visible` rules total** in all CSS. Because styling is overwhelmingly inline (finding 13), buttons cannot express focus without JS state, so most simply do not. A keyboard or switch-control player cannot see where they are.

Supporting numbers: 67 `aria-label`s for 220 buttons; 5 `tabIndex` uses; 20 `role=` attributes. Only 5 non-semantic `onClick` handlers on `div`/`span`, which is good — the elements are right, the focus affordance is missing.

**Fix:** one global `:focus-visible` rule in `App.css` covering `button, [role="button"], a, input, select` gets most of the way there in a few lines, and inline styles do not override it since neither sets outline.

Reduced-motion support is partially present (`App.css`, `UILayer.jsx`, `VictoryScreen.jsx`, `LoadingScreen.css`, `device.js`, and others) — worth completing to the same standard across the newer worm and demo screens.

## 13. Styling is 995 inline objects against 4.6k lines of CSS — **Low**

995 `style={{ ... }}` literals across `.jsx`, concentrated in `TeachMode` (80), `ParityStoreScreen` (52), `WormCrawlerHUD` (49), `DisparityBettingScreen` (43). Each is a fresh object per render, defeating `React.memo` on any component that receives one as a prop, and none can express `:hover`, `:focus`, `:active`, or media queries.

The token layer itself is in good shape — `uiTheme.js` is well-designed and imported by 61 files. The gap is the delivery mechanism, not the palette. Moving the repeated card/button/panel shapes into CSS classes backed by custom properties would cut the inline count sharply and make finding 12 a one-line fix.

## 14. `CLAUDE.md` drift — **Low**

- The UI-theme note documents `GLASS_*` as "dark navy in-game overlay family". Those tokens no longer exist — `uiTheme.js` explicitly records that the glass family was removed in favour of `NIGHT_*`. An agent following `CLAUDE.md` today would import symbols that are gone. (The four `GLASS_*` hits remaining in `src/` are unrelated worm glass-material constants.)
- The directory tree omits five real directories: `coming-soon/` (12 files), `holonomy/` (5), `modes/` (5), `workers/` (1), `assets/`.
- The `detectWinConditions` example in Common Imports is no longer the live win path — `useGameSession` uses `checkRubiksWin`, deliberately (`useGameSession.js:73-77`).

---

## What is working well

Worth stating explicitly, because it is a large part of why this codebase is pleasant to review:

- **`src/game/` purity is real, not aspirational.** Zero React imports, zero DOM access — verified by grep, not assumed. This is why every bug above was reproducible in a five-line test.
- **Comments explain the why.** `cubeRotation.js:36-39` on why non-slice cubies keep their references (React.memo and InstancedMesh colour-buffer corruption), `manifoldLogic.js:137-149` on why incremental map rebuilds are safe, `useGameSession.js:67-76` on why the live path skips `detectWinConditions`. This is unusually good.
- **The previous review's recommendations were genuinely executed.** Wizard duplication is gone (shared `WizardChrome` + `wizardSteps/`), shaders are extracted, `HealerWormMode` dropped from 2041 lines to 526.
- **Performance work is thoughtful and measured** — worker-based chaos, incremental grid maps, adaptive DPR with a separate Mega override, frameloop parking on tab hide, `ClockContinuity` to keep timelines unbroken across it.
- **Bundle splitting is disciplined**: vendor chunks separated, heavy modes lazy-loaded, and a `bundle:check` gate in CI.

---

## Suggested order of work

1. **Finding 10** — add `src/hooks/**` to coverage and write tests for the flip, undo, and keyboard paths. Do this first; it is what catches 1–4 and prevents their return.
2. **Findings 1, 2, 3** — the flip-cap threading, the real undo inverse, and the dead-tile guard. All three are in the same call path and are best fixed together.
3. **Finding 4** — honour `disabled`, then either implement or delete the seven dead callbacks.
4. **Findings 5, 6, 7** — the screen state machine, which resolves the input-gating and Escape inconsistencies as a side effect.
5. **Findings 8, 9** — store hygiene while the slices are being split.
6. **Finding 12** — the global `:focus-visible` rule; cheap and high-value.
7. **Finding 14** — refresh `CLAUDE.md` so the next agent starts from accurate ground.
