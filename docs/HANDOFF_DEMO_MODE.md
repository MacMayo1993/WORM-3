# WORM-3 Session Handoff — Demo Mode Focus

Handoff for continuing work on a different account. Read this first. It captures
what was done, how demo mode works, the forward roadmap, and the gotchas.

---

## 0. Project / workflow facts

- Repo: `macmayo1993/worm-3`. Dev branch: **`claude/chaos-mode-review-audit-77ajuc`**.
- The PR for this branch has been **merged to `main` at least once** (PR #1077).
  Per workflow: if the branch's PR is already merged, restart the branch from
  latest `main` (`git fetch origin main && git checkout -B <branch> origin/main`)
  and force-with-lease push. Recent commits here were stacked after such a reset.
- Deployed demo = GitHub Pages from `main` (`macmayo1993.github.io/WORM-3`). Work
  on the branch is **NOT live until merged to `main`.**
- Stack: React 18 + Three.js/R3F + Zustand. `npm run dev` (port 5173, base
  `/WORM-3/`), `npm run build`, `npm run test` (vitest), `npm run lint`.
  Install with `npm ci` (`.npmrc` pins `legacy-peer-deps=true`).
- Commit trailers required:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and the
  `Claude-Session:` line. Do NOT put the model id anywhere in commits.

### Headless verification gotcha (important)
The sandbox blocks the drei `<Environment>` HDR CDN (`ERR_TUNNEL_CONNECTION_FAILED`),
which would blank the menu Canvas. All `<Environment>` usages are wrapped in
`SafeEnvironment` so it degrades gracefully. To drive the app headless with the
global Playwright (`/opt/node22/lib/node_modules/playwright`, launch with
`--enable-unsafe-swiftshader`), **abort the HDR request** so the menu renders:
```
await pg.route(/\.(hdr|exr)(\?|$)/i, r => r.abort());
await pg.route(/raw\.githack|pmnd\.rs|market-assets|githubusercontent/i, r => r.abort());
```
Isolated component previews work well: make a root `preview-*.html` + `.jsx` that
seeds `useGameStore.setState({...})` and renders the component, serve via
`npm run dev`, screenshot at `http://localhost:5173/WORM-3/preview-*.html`.
Delete preview files before committing.

---

## 1. What was done this session (chronological)

1. **Antipodal grid-label fix** (`src/3d/Cubie.jsx`): a duplicate/drifted local
   `faceRCFor` + a `GRID_FACE` swap hack made on-cube grid labels disagree with
   the flip logic (tapping "M1-001" flipped "M4-007"). Routed labels through the
   canonical `getManifoldGridId`. Regression test in
   `src/__tests__/coordinates.antipodal.test.js`.
2. **Antipodal numbering decision = "Option A".** After a long analysis, the
   game keeps: **through-the-center (true RP²) antipode + matching numbers**
   (`M1-003 ↔ M4-003`, index-preserving). The unavoidable cost is the opposite
   face's labels read mirror-flipped (orange's top-left shows `003`). The user
   explicitly chose A over B (uniform per-face numbering) and C (mirror
   identification). **Do not revisit this** unless asked — it's settled.
3. **Antipodal tunnel visual upgrades** (`src/manifold/MobiusTunnel.jsx`):
   fresnel rim glow, parallax warp-streaks, a plasma seam at the Möbius midpoint,
   and a travelling light-soliton fired on flip (via `tunnelPulses`). Shader-side,
   verified compiling in a real WebGL2 context.
4. **Roadmap doc** `docs/ROADMAP_FIRST_FLIP_ONBOARDING.md` — a proposed 60s
   interactive "first flip" onboarding. Not built; separate from demo mode.
5. **Demo mode rebuilt as HYBRID + step-6 dead-end fixed** (see §2 — this is the
   main focus).
6. **Mobile menu layout** (`src/components/menus/MainMenu.jsx`): dropped the
   START/Start Demo/Give Feedback cluster to ~40px off the bottom on portrait
   (was 120px); mode-selector cube in portrait sized +10% (`presentScale
   0.72→0.79`) and lowered (`presentY 2.4→1.75`), ~lines 853-855.
7. **De-neon pass** (user "despises the neon cyberpunk slop"):
   - `DisparityWinnerScreen.jsx` fully rewritten — calm results card, flat color
     swatches, clean ledger; removed glow/spin/scanline/glitch/rings/confetti.
     This also fixed the **mirrored winner-card bug** (cards spun `rotateY
     0→360° infinite` showing their backface = mirrored text).
   - `src/3d/StickerPlane.jsx`: dead (capped) tiles now render flat solid (drop
     decorative tile style) so a board of spent tiles reads as spent.
   - **Tombstone**: removed the buggy "cross" engraving (it rendered as a "T" —
     crossbar sat above the vertical bar) and now always engrave **RIP + tile
     ID** on the headstone (death rank added only in disparity mode). Tombstone
     geometry + ghost worms unchanged. (`StickerPlane.jsx` ~line 1635-1680.)
   - `DisparityHUD.jsx`: stripped all glow text-shadows / box-shadow halos; the
     low-tiles danger pulse is now a red **border** pulse. Cards there were
     already clean light cards.
   - **Finding:** `DisparityBettingScreen` (cream PAPER family) and
     `DemoForecastPicker` are already restrained — left untouched (no churn).

Design system lives in `src/utils/uiTheme.js`: PAPER (cream setup sheets) and
GLASS (dark navy in-game overlays) families + fonts (`UI_FONT`, `DISPLAY_FONT`,
`MONO_FONT` reserved for grid IDs). Pull tokens from here.

---

## 2. DEMO MODE — full architecture (the focus)

### Entry & state
- Launched from the main menu **"Start Demo"** button (`MainMenu.jsx`
  `MenuStartButton`, `onDemo` → `App.jsx` `handleStartDemo`).
- Store (`src/hooks/useGameStore.js` ~line 773): `demoMode`, `demoStep`,
  `startDemo()` (sets `demoStep:'baby-cube'`), `setDemoStep()`, `exitDemo()`.
- Steps live in `src/components/screens/DemoFlowController.jsx`:
  `DEMO_STEPS` (ids + labels + nums), `DEMO_STEP_IDS`, `DEMO_LEVEL_CONFIGS`,
  and the UI pieces `DemoProgressBar`, `DemoStepIntro`, `DemoCoach`, `TRY_COPY`.

### The 7 steps (order matters)
```
1 baby-cube      2 twin-paradox   3 flip-gateway   4 worm-traversal
5 chaos-forecast 6 cosmetic-reward 7 end
```

### Hybrid flow (watch → try) — how it runs
Orchestration is all in **`src/App.jsx`**:
- `applyDemoStepConfig(stepId)` sets up the cube per `DEMO_LEVEL_CONFIGS`
  (`type: 'cube' | 'worm' | 'chaos'`).
- `handleDemoStepContinue()` — on the intro card's Continue:
  - `cosmetic-reward` → opens the Parity Store (`handleOpenStore`); the store's
    close advances the demo (see `handleCloseStore`, which calls
    `advanceDemoStepRef.current('cosmetic-reward')`).
  - cube steps → `applyDemoStepConfig`, then schedule a **WATCH** demo via
    `demoWatchTimers` (a rotation via `startAnimatedShuffle`, or a live flip via
    `onTapFlipRef.current(...)` which fires the tunnel birth + soliton), then set
    `demoTryVisible=true` after ~2800ms to show the **`DemoCoach`** (an
    instruction + an always-available **Next ▶** + Exit).
- `advanceDemoStep(fromStep)` — the SINGLE guarded advance path (idempotent:
  `if (store.demoStep !== fromStep) return`). Clears timers + `demoTryVisible`,
  sets next step, shows the next intro (unless `end`). `advanceDemoStepRef`
  mirrors it for use in earlier-defined callbacks.
- Per-step config carries a `watch` field:
  `baby-cube` = `{type:'rotate', moves:[...]}`; `twin-paradox` / `flip-gateway` =
  `{type:'flip', tile:{x,y,z,dirKey}}`.
- `worm-traversal` (type worm): advances when `wormGamePhase === 'solved'`
  (App effect). **See roadmap item A — this is the step to make skippable.**
- `chaos-forecast` (type chaos): shows `DemoForecastPicker`; dismissing the
  winner calls `handleDemoDisparityDismiss` → awards PP → `advanceDemoStep`.
- In demo mode a win does **not** pop the full VictoryScreen (an App effect
  clears `victory` so it can't hijack pacing).
- Render block for demo overlays is near `App.jsx` ~line 1578 (`DemoProgressBar`,
  `DemoStepIntro`, `DemoCoach`, `DemoForecastPicker`, `DemoEndScreen`).
- Regression test: `src/__tests__/demoFlow.test.js` locks the 7-step order,
  walk-to-end completeness, the cosmetic-reward store-routing, and the hybrid
  invariants.

### Verified
Live headless drive confirmed steps 1→2→3 advance via the coach (progress bar
1/7 → 2/7 → 3/7). Steps 4/5/6 verified by the state-machine test + code review
(hard to drive worm/chaos headless).

### The bug that was fixed
`cosmetic-reward` (step 6) had **no** config and nothing advanced it → the demo
parked at 6/7 forever and `DemoEndScreen` was unreachable. Now store-routed.

---

## 3. ROADMAP — forward work (from the user)

### A. Make step 4 (worm-traversal) skippable after the first wormhole tunnel  ⭐ priority
Problem: step 4 forces the user to play the worm until win **or** death, and
**death does not advance** to step 5 — so it can dead-end / drag forever.
Goal:
- After the **first wormhole tunnel is traversed** (or after a short grace
  period), show a skip affordance (reuse `DemoCoach` with a Next/Skip) so the
  user can advance to step 5 (`chaos-forecast`) at will.
- **Death must also advance** (or at least not block). Right now only
  `wormGamePhase === 'solved'` advances — add handling for the death/failure
  phase, and/or let the skip button cover it.
Pointers: `App.jsx` worm-advance effect (keys on `wormGamePhase`); worm phases
and tunnel-traversal events live in the worm subsystem (`src/worm/…`,
`tunnelProgressBridge.js`/`tunnelState` tracks active tunnel traversal). Route
any new advance through `advanceDemoStep('worm-traversal')` for idempotency.

### B. DO NOT overwrite the user's demo UI/text styling  ⚠️
The user is **separately editing the demo-mode UI and in-game text appearance**
(it "looks like dog shit on mobile"). Whatever styling exists in the code when
the next session loads is **canonical** — do not revert `DemoStepIntro`,
`DemoCoach`, `TRY_COPY`, `DemoProgressBar`, `DemoForecastPicker`, or in-game text
styles to earlier versions. Treat their current styles as correct; only change
them if explicitly asked.

### C. Demo must showcase the bottom in-game buttons / view modes
Every feature that opens from the **bottom in-game button bar** needs a demo
beat/step: **explode** view, **tunnels** toggle, **glass** view style, **hollow**
view style, plus the rest (grid, net panel, wireframe, reset/shuffle/solve, the
color/view menus). Currently the demo teaches rotate/flip/worm/chaos but never
shows these view features.
Pointers: view modes are `visualMode` (`classic|grid|hollow|glass|wireframe|…`),
`showTunnels`, explode/`explosionFactor`, and the net panel — all toggled from
the bottom bar (see `src/components/menus/TopMenuBar.jsx` /
`src/components/menus/MobileControls.jsx` and the store setters
`setVisualMode`, `setShowTunnels`, explode state). Likely approach: add a new
demo step (or extend an existing cube step) that cycles these toggles in the
WATCH phase with `DemoCoach` copy naming each one.

---

## 4. Key files quick-reference
- Demo flow UI + configs: `src/components/screens/DemoFlowController.jsx`
- Demo orchestration: `src/App.jsx` (search `demoStep`, `advanceDemoStep`,
  `applyDemoStepConfig`, `demoWatchTimers`, `handleDemoStepContinue`)
- Demo store state: `src/hooks/useGameStore.js` (~line 773)
- Demo screens: `DemoStepIntro`/`DemoCoach` (in DemoFlowController),
  `DemoForecastPicker.jsx`, `DemoEndScreen.jsx`
- Winner screen (de-neoned): `src/components/screens/DisparityWinnerScreen.jsx`
- HUD (de-neoned): `src/components/overlays/DisparityHUD.jsx`
- Tombstone + dead tiles: `src/3d/StickerPlane.jsx` (search `isDead`, `tombstone`)
- Chaos sim (winner/death logic): `src/game/chaosSim.js`; worker sync:
  `src/hooks/useChaosWorker.js` (note: manual flips are NOT synced to the worker
  — only rotations are; the worker owns the winner determination)
- Theme tokens: `src/utils/uiTheme.js`

## 5. Chaos winner logic (for reference)
Tiles die in antipodal pairs (`checkPairDeaths` caps a tile + its
`findAntipodalStickerByGrid` partner together). Winner fires when
`aliveAfterDeaths <= 2` (all but one pair capped) → the last surviving pair.
"Lots of tiles looked alive" was because capped/dead tiles still render — hence
the dead-tile flatten + tombstone work. Manual flips during chaos are cosmetic
(not fed to the worker), so they don't affect the winner. A proposed (NOT built)
mechanic: manual flip → instantly kill that pair for PP, with a cost/cap to
avoid guaranteeing a bet win — left for the user to spec.
