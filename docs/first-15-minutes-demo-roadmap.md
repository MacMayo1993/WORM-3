# First 15 Minutes + Demo Mode Roadmap

**Goal:** make the first session feel like one clear game, not a collection of tutorials.

This roadmap assumes WORM-3 keeps only the six destinations currently presented by the mode selector:

1. **WORM** — the action/healer mode.
2. **CUBE** — classic freeplay cube solving.
3. **STORY** — the guided campaign path.
4. **CHAOS** — antipodal flip survival / betting.
5. **RANDOM** — randomized visual/style challenge.
6. **STORE** — cosmetics and Parity Point spend.

Everything else that currently behaves like a tutorial should either be removed, hidden from the first-session path, or folded into this single demo flow.

---

## Product principle

The first 15 minutes should teach only one sentence:

> **Opposite faces are secretly connected, and the worm/cube lets you feel that connection.**

Do not teach every rule. Do not explain every mode. Do not expose every overlay. The demo should create a confident player who knows how to:

- Rotate the cube.
- Follow Mobi's prompts.
- See that opposite tiles are paired.
- Enter a wormhole / antipodal transition.
- Heal or restore a small number of tiles.
- Recognize the six main destinations after the demo ends.

---

## First-session structure

| Time | Beat | Player promise | Primary action | Unlock/result |
|---:|---|---|---|---|
| 0:00-0:45 | Cold open | “This cube has a secret.” | Watch / tap through Mobi intro | Start demo |
| 0:45-2:00 | Touch the cube | “I can move this thing.” | Drag/rotate, tap highlighted tile | Basic control confidence |
| 2:00-3:30 | Twin reveal | “Opposite tiles are linked.” | Tap one highlighted tile and watch its twin respond | Antipodal concept |
| 3:30-5:00 | One-flip solve | “A flip can solve.” | Flip the one highlighted antipodal pair | First full-cube solve |
| 5:00-7:00 | Worm reveal | “I can travel through the cube.” | Guide worm to a tunnel/twin tile | Wormhole concept |
| 7:00-9:30 | Heal loop | “The worm changes the cube state.” | Collect orbs / heal corrupted tiles | Core WORM loop |
| 9:30-11:30 | Light chaos | “The cube pushes back.” | Avoid or heal a few unstable tiles | Stakes without overload |
| 11:30-13:00 | Mini finale | “I understand the toy.” | Restore final highlighted path/face | Demo complete |
| 13:00-15:00 | Six-mode landing | “Now choose what to do next.” | Mode selector tour, choose destination | Player agency |


---

## Current shipped demo mode breakdown

The current in-game demo is already a shorter, six-stage flow plus an end screen. Evaluate it as the concrete baseline before replacing or expanding it:

| Step | ID | Current label | Current purpose | Current configuration | Evaluation focus |
|---:|---|---|---|---|---|
| 1 | `baby-cube` | Baby Cube | Teach basic rotation control with a real solve requirement. | 2x2 cube, one row rotation scramble, rotations on, tunnels/flips off; the inverse row turn must satisfy the solved-cube win condition. | Does the player understand how to rotate without needing notation, and does the step end only after a solve? |
| 2 | `twin-paradox` | Twin Paradox | Show that opposite faces/tiles are linked. | 2x2 cube, one pre-applied antipodal flip, rotations/tunnels/flips on. | Does the player notice that one tile has a twin? |
| 3 | `flip-gateway` | Flip Gateway | Prove that a flip can solve the cube, not just decorate it. | 3x3 cube, no rotation scramble, one pre-applied center antipodal flip pair. | Can the player solve the whole cube with one obvious flip? |
| 4 | `worm-traversal` | WORM Traversal | Convert the same antipodal link into movement. | 3x3 WORM mode, slow worm speed, three orbs, tunnel visibility on. | Does the worm feel like the cube concept made playable? |
| 5 | `chaos-forecast` | Chaos Forecast | Preview instability and prediction. | 3x3 chaos/disparity setup, level 3, flip cap 12, short game. | Is this exciting without overexplaining betting/math? |
| 6 | `cosmetic-reward` | Cosmetic Reward | Spend/demo the reward loop. | Store/reward step after forecast payout. | Does the economy feel like a bonus rather than an interruption? |
| 7 | `end` | Complete | Exit/replay/freeplay decision. | Demo end screen. | Does the next click clearly route to a six-mode destination? |


### Stage 1 correction — no passive solved cube

Stage 1 must not be a solved display that the player dismisses with a button. It should start one row turn away from solved, then advance only when the player reverses that row turn and the normal solved-cube check passes.

Implementation requirements for stage 1:

- Start from a 2x2 cube with one deterministic row rotation applied.
- Keep flips, tunnels, chaos, and advanced overlays off.
- Make the prompt say “drag the turned row back,” not “press next.”
- Do not expose a manual next button after the step begins.
- Use the standard solved-cube win condition to advance to Twin Paradox.

### Mobile demo text presentation

Demo text should use the empty top portion of the screen on phones, above the cube, rather than covering the bottom controls. The visual treatment should feel like paper/forest UI: warm off-white, sage/olive accents, soft shadow, and readable dark text. Avoid black glass panels, neon blue outlines, and cyberpunk styling in the demo prompts.

### Stage 3 correction — one flip should solve the cube

Stage 3 should be authored as a solved 3x3 cube with exactly one antipodal center pair already flipped out of place. The player's required action is to flip that same pair once. That creates the cleanest possible lesson:

> **Flips are solve moves. One flip can finish the cube.**

Implementation requirements for stage 3:

- Use a 3x3 cube so the center tile can act as a stable, visually obvious target.
- Do **not** apply any rotation scramble before the staged flip.
- Pre-apply exactly one `flipSequence` entry, ideally the front center tile pair.
- Highlight the front center tile and its antipodal twin.
- On player flip, the cube should immediately satisfy the normal solved-cube win condition and advance to WORM Traversal.
- Mobi copy should say the cube is “one flip away,” so the player understands that the flip is the solution, not a side effect.

This stage should not teach full cube solving, notation, or parity theory. Its job is only to prove that the antipodal flip belongs in the solve vocabulary.

---

## Detailed demo mode roadmap

### Beat 1 — Cold open: “This cube has a secret”

**Target duration:** 45 seconds.

**Scene:** dark menu cube, Mobi portrait, minimal UI.

**Player interaction:** one tap/click advances dialogue; no mode selection yet.

**Mobi script direction:**

- “Aloha, I’m Mobi.”
- “This looks like a cube, but opposite sides are connected.”
- “I’ll show you once. Then you can choose your mode.”

**Design requirements:**

- Keep this under five dialogue cards.
- Skip button is visible from the first line.
- Returning players go directly to the mode selector unless they manually replay the demo.

**Completion trigger:** player taps **Begin Demo** or waits through the final prompt.

---

### Beat 2 — Touch the cube: control confidence

**Target duration:** 75 seconds.

**Scene:** 2x2 or simplified 3x3 cube with only one interaction highlighted at a time.

**Player tasks:**

1. Drag to rotate the camera/cube.
2. Drag a highlighted face edge to rotate one slice.
3. Tap a glowing tile.

**Do not teach:** notation, full solve strategy, parity math, Sudokube, Ultimate, advanced views.

**Success criteria:**

- Player has completed one rotate gesture.
- Player has clicked/tapped one tile.
- UI has shown “Nice — you can move the cube.”

**Failure handling:**

- After 10 seconds of no input, animate a ghost hand / cursor path.
- After 20 seconds, allow **Auto-complete this step**.

---

### Beat 3 — Twin reveal: antipodal pairing

**Target duration:** 90 seconds.

**Scene:** one tile glows on the front face; its opposite twin pulses through a subtle tunnel line or PiP view.

**Player tasks:**

1. Tap the highlighted tile.
2. Watch the opposite tile react.
3. Tap the twin tile from the opposite face.

**Message:**

- “One tile, two addresses.”
- “When this one changes, its twin knows.”

**Visual requirements:**

- Use one strong color pair only.
- Avoid showing all possible pairings at once.
- The first antipodal connection should be dramatic: pulse, sound, short slow-motion, or camera swing.

**Completion trigger:** both the front tile and its twin have been interacted with or observed.

---

### Beat 4 — First micro-puzzle: one-flip solve

**Target duration:** 90 seconds.

**Scene:** a 3x3 cube that is already solved except for one antipodal center tile pair.

**Player tasks:**

1. Inspect the highlighted front-center tile.
2. Notice its opposite twin pulse through the antipodal/tunnel visualization.
3. Flip the highlighted tile once.
4. Watch the whole cube solve.

**Design requirements:**

- This should be solvable even by a player who does not understand cube notation.
- Stage setup should be solved state plus one pre-applied flip, with no rotation scramble.
- Highlighting should make the intended flip unmissable.
- The win should be audiovisual and immediate, because the flip itself is the solution.

**Completion trigger:** the player performs the one corrective flip and the cube reaches the standard solved state.

**Reward:** first small Parity Point grant, even if cosmetic economy is still lightweight.

---

### Beat 5 — Worm reveal: travel through the cube

**Target duration:** 2 minutes.

**Scene:** Mobi/worm appears on a surface tile; a glowing tunnel target appears on the opposite face.

**Player tasks:**

1. Move the worm toward a highlighted tile.
2. Enter the tunnel/antipodal transition.
3. Exit on the opposite face.

**Message:**

- “The cube is not just a puzzle. It is a map.”
- “Opposite is not far away. Opposite is a shortcut.”

**Control requirements:**

- Pointer/touch movement only for this beat.
- No jumping, multi-jump, betting, advanced inventory, or multiple hazard types yet.

**Completion trigger:** worm successfully traverses one antipodal tunnel.

---

### Beat 6 — Heal loop: the core WORM action

**Target duration:** 2.5 minutes.

**Scene:** 5-7 corrupted tiles are scattered across two connected faces. Orbs lead the route.

**Player tasks:**

1. Collect 3 orbs.
2. Heal 3 corrupted tiles.
3. Cross one seam/tunnel to heal a paired tile.

**Design requirements:**

- The route should quietly reinforce the antipodal relationship.
- The player should feel like the worm is restoring the cube, not playing a disconnected minigame.
- The HUD should show only: health/status, orb count, and current objective.

**Completion trigger:** required tiles healed.

**Reward:** store preview item or temporary cosmetic preview.

---

### Beat 7 — Light chaos: the cube pushes back

**Target duration:** 2 minutes.

**Scene:** a few tiles begin pulsing as unstable. Chaos is slow and readable.

**Player tasks:**

1. Avoid one unstable tile.
2. Heal one unstable tile before it flips.
3. Watch one safe, scripted tile flip to demonstrate risk.

**Do not teach:** betting, chaos levels, elimination ranking, face wipes, advanced Disparity strategy.

**Message:**

- “Some tiles fight back.”
- “In CHAOS mode, this becomes the whole game.”

**Completion trigger:** player survives the short chaos sequence.

---

### Beat 8 — Mini finale: restore the final path

**Target duration:** 90 seconds.

**Scene:** the player has one clear final objective: heal the last route or restore the front face emblem.

**Player tasks:**

1. Follow an orb trail.
2. Use one tunnel.
3. Heal/flip the final tile pair.

**Completion moment:**

- Camera pulls back.
- Restored face glows.
- Mobi celebrates.
- Demo summary appears with three learned ideas:
  - Rotate the cube.
  - Opposite tiles are linked.
  - The worm travels/heals through those links.

---

### Beat 9 — Six-mode landing

**Target duration:** 2 minutes.

The demo should end at the six-face mode selector, not a generic tutorial menu.

Each mode gets one plain-language sentence:

| Mode | First-session positioning | CTA |
|---|---|---|
| **WORM** | “Play the action/healing version of what you just learned.” | Continue with WORM |
| **CUBE** | “Practice the cube freely with no pressure.” | Open Freeplay |
| **STORY** | “Play the structured campaign path.” | Start Story |
| **CHAOS** | “Survive the unstable antipodal cube.” | Try Chaos |
| **RANDOM** | “Let the cube remix visuals and settings.” | Surprise Me |
| **STORE** | “Spend points on cosmetics.” | Visit Store |

**Recommended default CTA:** **Continue with WORM**, because the demo has just taught worm traversal and healing.

**Secondary CTA:** **Start Story**, for players who want structured progression.

---

## What to remove or hide from first-session onboarding

If the product direction is “one demo, six modes,” then remove these from first-session tutorial surfacing:

- Separate Guided / Demo / Quiz tutorial tabs.
- Layer-by-layer beginner cube method as an onboarding requirement.
- Sudokube and Ultimate explanations before the player chooses Story/CUBE.
- Holonomy, Merge, Hollow, Mirror, Biome, Antipodal Integrity, and other lab-style mode explanations.
- Advanced keyboard notation except in CUBE/Hands-oriented contexts.
- Full Chaos betting explanation before the player explicitly chooses CHAOS.

These systems can still exist internally or later, but the first 15 minutes should not sell them.

---

## Implementation phases

### Phase 1 — Content lock

- Freeze the six mode-selector destinations as the only first-session choices.
- Rewrite the first-run Mobi script around the 9-beat demo above.
- Replace “tutorial mode” language with “demo” language.
- Decide whether returning players can replay the demo from the mode selector utility row.

### Phase 2 — Demo state machine

Create a dedicated first-run demo controller with explicit beat IDs:

1. `cold_open`
2. `basic_controls`
3. `twin_reveal`
4. `micro_puzzle`
5. `worm_reveal`
6. `heal_loop`
7. `light_chaos`
8. `mini_finale`
9. `mode_landing`

Each beat should define:

- Allowed controls.
- Objective text.
- Highlight targets.
- Completion condition.
- Timeout hint.
- Skip/autocomplete behavior.

### Phase 3 — UI simplification

- During the demo, hide all nonessential HUD panels.
- Use a single objective chip and a single Mobi dialogue panel.
- Disable settings panels, advanced overlays, and mode toggles until the mode landing.
- Keep accessibility controls available: volume, reduce motion, skip demo.

### Phase 4 — Six-mode selector polish

- After demo completion, show the mode selector with the last demo-learned mode highlighted.
- Use mode descriptions that connect directly to demo knowledge.
- Store `worm3_demo_complete = true` in local storage or the existing progress manager.
- Route first-time users to demo; route returning users to mode selector.

### Phase 5 — Measurement

Track only a few first-session events:

- `demo_started`
- `beat_completed:{beat_id}`
- `hint_shown:{beat_id}`
- `demo_skipped:{beat_id}`
- `demo_completed`
- `first_mode_selected:{mode_id}`

The goal is not analytics sprawl; it is finding where new players get stuck.

---

## Acceptance criteria

The roadmap is successful when a new player can answer these questions after 15 minutes:

1. “What is special about this cube?” — opposite tiles/faces are linked.
2. “What do I do in WORM?” — move, collect, heal, use tunnels.
3. “What is CUBE?” — free cube practice.
4. “What is STORY?” — structured progression.
5. “What is CHAOS?” — unstable survival challenge.
6. “What is RANDOM?” — remix/surprise mode.
7. “What is STORE?” — cosmetics with earned points.

If they can answer those, the demo has done enough. The rest can wait.
