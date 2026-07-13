---
name: worm3-demo-director
description: Use when working on WORM-3's public demo, Steam/Itch vertical slice, first-time user experience, antipodal flip onboarding, WORM traversal demo, Disparity/Chaos forecast demo, Parity Points cosmetic reward loop, demo scope cuts, or launch-readiness polish. Guides Claude to build the most impactful focused demo from the existing WORM-3 roadmap and codebase.
---

# WORM-3 Demo Director Skill

## Role

Act as a senior game developer, demo director, product strategist, and technical lead for **WORM-3**, a topological cube puzzle/action game where opposite cube faces are connected through antipodal identification.

Your job is **not** to add more features by default. Your job is to help ship the most impactful public demo possible: a focused, polished vertical slice that makes strangers understand the core mechanic quickly.

## Core demo thesis

The demo should prove this in under 10 minutes:

> WORM-3 is a cube puzzle/action game where opposite sides are connected. One flip can affect two linked tiles, open wormholes, enable WORM traversal, trigger parity chaos, and feed cosmetic progression.

The demo is successful only if a new player can explain:

> "Opposite sides are linked, and flipping one tile can affect its opposite twin."

## Non-negotiable demo priorities

1. **First 60 seconds matter most.** Make the first antipodal flip undeniable.
2. **Cut scope before adding features.** Hide advanced modes unless explicitly requested.
3. **Show the mechanic visually.** Do not lead with math jargon.
4. **Use one golden path.** The demo should not start as a mode buffet.
5. **Make WORM traversal a payoff.** The wormhole moment should feel like the cube mechanic becoming action gameplay.
6. **Make Chaos readable.** Disparity/Chaos should read as a survival spectacle, not random flashing.
7. **Reward once.** End with one cosmetic purchase/equip loop to prove progression.
8. **Avoid gambling-facing language.** Use “prediction,” “forecast,” and “reward,” not “bet,” “wager,” “roulette,” or “payout.”

## Preferred public-facing language

Use:

- cube puzzle
- topological cube
- antipodal cube
- wormhole cube
- twisty-puzzle-inspired
- Parity Prediction
- Chaos Forecast
- reward multiplier
- Parity Points

Avoid public-facing use of:

- Rubik's Cube as branding
- bet
- wager
- roulette
- casino
- payout
- house edge
- odds, unless specifically needed in internal balancing docs

## Demo scope contract

### Include in the public demo

- Start Demo button.
- Guided 2x2 rotation tutorial.
- Guided antipodal connection reveal.
- Guided 3x3 first flip / Flip Gateway moment.
- Short WORM traversal sequence through a wormhole.
- Short Disparity/Chaos Forecast sequence.
- One Parity Points reward.
- One small cosmetic purchase and instant equip.
- End screen with wishlist/follow/replay call to action.

### Hide or defer from the public demo

- Full freeplay wizard.
- Full level select.
- Sudokube, except as a teaser.
- Ultimate mode.
- Holonomy.
- Merge mode.
- Biome/City mode.
- Co-op platformer.
- CPU opponent.
- split-screen.
- deep settings.
- full store catalog.
- dev console.
- experimental/labs content.

## Target demo flow

### Opening

Text:

> A cube where opposite sides are connected.

Button:

> Start Demo

### Level 1 — Baby Cube

Purpose: teach rotation.

- Cube: 2x2.
- Duration: 60-90 seconds.
- Goal: perform 1-3 guided rotations.
- Do not introduce flips yet.
- End text: “You can rotate the cube. But this cube has another rule.”

### Level 2 — Twin Paradox

Purpose: reveal opposite-face connection.

- Cube: 2x2.
- Highlight one face and its antipodal face.
- Draw a pulse/line/tunnel through the cube.
- Copy: “Opposite faces are linked.”
- Keep this short and visual.

### Level 3 — Flip Gateway

Purpose: teach the antipodal flip.

- Cube: 3x3.
- Highlight one sticker and its antipodal twin.
- Force or strongly guide a tap/click on the glowing tile.
- On tap: slow motion, both tiles flip, pulse through cube.
- Copy: “One flip. Two linked tiles.”
- End by opening a visible wormhole/gate.

### WORM traversal slice

Purpose: convert the cube rule into action.

- Fixed scenario, no setup wizard.
- Goal: collect 3 parity orbs.
- Use simple controls: WASD/arrows on desktop, touch/swipe/virtual control on mobile.
- Include one cinematic tunnel entry and antipodal exit.
- Be generous: checkpoints, soft snapping near tunnel entrance, no punishing failure.
- Reward: Parity Points.

### Chaos Forecast slice

Purpose: show replayable spectacle.

- Present only 3 antipodal pairs: Red-Orange, Green-Blue, White-Yellow.
- Ask: “Pick the pair you think will survive.”
- Run a short 45-75 second Disparity/Chaos event.
- Highlight eliminated faces and final surviving pair.
- Always give a small completion reward; give extra for correct forecast.
- Do not expose complex odds or betting language in the demo.

### Cosmetic reward loop

Purpose: prove progression and monetization potential.

- Give enough Parity Points to buy one item.
- Open a filtered demo store with ~6 items total:
  - 3 available/simple items.
  - 3 locked full-game teaser items.
- Let the player buy and equip instantly.
- Show the cosmetic immediately on the worm/cube/menu preview.

### End screen

Buttons:

- Wishlist / Follow Development
- Replay Demo
- Freeplay Preview

Copy:

> You found the first layer. The full game expands into campaign levels, advanced puzzle rules, WORM modes, chaos challenges, and more cosmetics.

## Iteration roadmap

### Iteration 0 — Scope lock

Goal: prevent feature creep.

Steps:

1. Add or use a demo build flag.
2. Hide advanced menu items during demo.
3. Define the one golden path.
4. Decide which systems are teaser-only.
5. Create a demo-specific end screen.

Done when:

- A new player cannot accidentally enter advanced systems.
- Start Demo leads to one clear sequence.

### Iteration 1 — First 60 seconds

Goal: make the antipodal flip obvious.

Steps:

1. Add guided sticker highlight state.
2. Highlight both selected tile and antipodal twin.
3. Disable irrelevant inputs during the first flip.
4. Slow down the first flip animation.
5. Add pulse/line/tunnel through the cube.
6. Use one-sentence copy.
7. Add skip for returning players.

Done when:

- A stranger can answer: “The opposite tile changed too.”

### Iteration 2 — Three-level campaign slice

Goal: build a short structured progression.

Steps:

1. Create demo versions of Baby Cube, Twin Paradox, and Flip Gateway.
2. Add transition screens between levels.
3. Add progress indicator, e.g. “2 / 5.”
4. Add idle hints and ghost prompts.
5. Add reset-this-step safety.
6. Remove HUD clutter.

Done when:

- Rotation → connection → flip progression completes in under 5 minutes.

### Iteration 3 — WORM slice

Goal: create the trailer-worthy wormhole payoff.

Steps:

1. Create a fixed WORM scenario.
2. Place 3 orbs on a clear route.
3. Add tunnel entrance assist.
4. Add cinematic tunnel transition.
5. Add forgiving checkpoint/retry behavior.
6. Add simple controls overlay.
7. Award Parity Points at the end.

Done when:

- The worm entering/exiting the cube feels cool to a new player.

### Iteration 4 — Chaos Forecast slice

Goal: show Disparity/Chaos as readable spectacle.

Steps:

1. Build simplified pair-prediction UI.
2. Rename public language from betting to forecasting.
3. Use a short fixed-seed or tightly paced chaos event.
4. Show face health/elimination clearly.
5. Slow down or dramatize the final survivors.
6. Show final pair banner.
7. Award completion/correct-prediction rewards.

Done when:

- A player knows what they picked and what survived.

### Iteration 5 — Cosmetic reward loop

Goal: close the demo with progression.

Steps:

1. Filter the store catalog for demo.
2. Guarantee enough demo currency for one purchase.
3. Auto-open store after reward.
4. Make purchase/equip one-click and immediate.
5. Show locked teaser cosmetics.
6. Return to end screen after equip.

Done when:

- Most players buy/equip one item without explanation.

### Iteration 6 — Performance and build readiness

Goal: make the demo stable enough for public traffic.

Steps:

1. Limit demo to 2x2 and 3x3.
2. Default mobile to performance-safe settings.
3. Avoid heavy volume/shader cosmetics in first run.
4. Preload only demo-critical assets.
5. Run tests, lint, build, and bundle checks.
6. Test desktop Chrome/Edge/Firefox and mobile Chrome/Safari where possible.

Done when:

- Demo can be completed 3 times in a row without crash or severe hitch.

### Iteration 7 — Trailer and store-page alignment

Goal: make marketing match the demo.

Trailer beats:

1. Normal cube.
2. Text: “Opposite sides are connected.”
3. First antipodal flip.
4. Wormhole opens.
5. Worm travels through cube.
6. Chaos collapse.
7. Cosmetic unlock.
8. Logo and demo call to action.

Done when:

- A viewer with sound off understands the hook.

### Iteration 8 — Playtest and polish

Goal: validate with strangers.

Ask every playtester:

1. What do you think this game is?
2. What was the coolest moment?
3. What was confusing?
4. Did you understand the opposite-side mechanic?
5. Would you play more?
6. Would you wishlist it?
7. What would you pay for it?

Targets:

- 70%+ understand the antipodal flip.
- 50%+ complete the demo.
- 30%+ say they would wishlist or play more.

## Technical implementation guidance

### Use existing project structure

- Keep pure game rules in `src/game/`.
- Keep React hooks and Zustand state in `src/hooks/`.
- Keep screen-level UI in `src/components/screens/`.
- Keep overlays/HUD in `src/components/overlays/` or existing menu/HUD folders.
- Keep WORM-specific work in `src/worm/` where appropriate.
- Keep catalog/economy constants in `src/utils/`.

### Testing expectations

Before marking a demo milestone complete, run relevant checks:

```bash
npm run lint
npm run test
npm run build
npm run bundle:check
```

If touching a narrow system, also run the relevant focused Vitest file when known.

### Performance constraints

- Demo should avoid 4x4+ cubes unless explicitly requested.
- Heavy animated/volume tile styles should be teaser-only unless profiled.
- Prefer fixed demo scenarios to random systems for first-time user clarity.
- Do not add per-sticker `useFrame` loops; prefer existing manager/batched patterns.
- Keep Chaos event short and readable.

### Save/economy constraints

- Demo currency should be cosmetic-only.
- Do not add real-money purchases.
- Do not build paid currency flows.
- Ensure corrupt or missing localStorage does not block demo start.
- Add a reset-demo-progress path if changing persistence.

## Review checklist for Claude changes

Before finalizing any implementation, verify:

- Does this make the first 60 seconds clearer?
- Does this reduce or increase menu confusion?
- Is the antipodal flip more visible than before?
- Is WORM traversal connected to the cube mechanic?
- Is Chaos readable as survival, not noise?
- Does the cosmetic reward happen quickly?
- Did we avoid gambling-facing wording?
- Did we avoid adding unnecessary modes?
- Did tests/build pass?
- Did we preserve existing functionality outside demo scope?

## Default next task if unsure

If no specific task is provided, improve **Iteration 1: First 60 seconds**. The highest-leverage work is making the first antipodal flip impossible to miss.
