# Roadmap: The First Flip — Core-Mechanic Onboarding

**Status:** Proposed
**Owner:** TBD
**Problem it solves:** The game's single differentiating idea — antipodal (RP²)
identification, where flipping a tile sends its color through a wormhole to the
*same point* on the opposite side of the cube — is currently the game's
weakest-taught concept. It is hidden until story level 3, and it is explained
after the fact by a passive text card (`FirstFlipTutorial.jsx`). A new player's
first two impressions are of an ordinary 2×2 Rubik's cube.

This doc specifies a single, tight, interactive **60-second first-flip moment**
that makes the antipodal idea *land* before we ask the player to solve anything.

---

## 1. The one thing this must accomplish

> **Aha:** "Wait — those two tiles on opposite sides are the *same* tile."

Everything below is in service of that one realization. If a playtester finishes
the sequence and can say, unprompted, "flipping here changes the color over
*there* because they're connected through the middle," it worked. If they can't,
it failed — no amount of copy or polish compensates.

We are **not** teaching: solving strategy, modes, scoring, the Latin-square win
condition, or the word "projective plane." Exactly one concept. One.

---

## 2. Success criteria

| Metric | Target | How measured |
|---|---|---|
| Completion rate (start → finish, no skip) | ≥ 80% | `worm3_first_flip_done` set without skip flag |
| Time to first successful flip | ≤ 20s from sequence start | timestamp delta |
| "Got it" comprehension (playtest) | ≥ 8/10 testers restate the mechanic unprompted | moderated playtest |
| Skip rate | < 25% | skip button telemetry |
| Replayable | Always available from Help | manual |

---

## 3. Where it lives in the flow

Current first-run order:

```
Welcome cinematic (worm3_intro_seen)  →  Main Menu (six-faces)  →  pick a mode
```

New first-run order (first launch only):

```
Welcome cinematic  →  ★ FIRST FLIP (worm3_first_flip_done)  →  Main Menu  →  mode
```

- **Gate:** show only when `worm3_first_flip_done !== '1'`. The flag and its store
  mirror (`hasFlippedOnce`) already exist — we repurpose them.
- **Returning players:** never see it automatically. Always replayable via
  **Help → "Replay: The First Flip"**.
- **Relationship to the old screen:** this sequence *replaces* the passive
  `FirstFlipTutorial` card. Keep the component name/slot (`showFirstFlipTutorial`)
  to minimize wiring churn, or introduce `showFirstFlip` as a dedicated phase —
  see §8.
- **Skippable at all times** (`Skip ▶`), mirroring `WelcomeScreen`'s skip affordance.

A brand-new player therefore meets the wormhole as impression #2, not #3-plus.

---

## 4. The 60-second beat sheet

A single scripted 2×2 cube (`makeCubies(2)`), one guided flip, staged in five
beats. The cube is real and interactive — this is a driven level, not a video.
Camera framing values are illustrative.

| # | ~Time | On screen | Camera | Copy (see §6) | Player action | What they see |
|---|---|---|---|---|---|---|
| **0. Arrival** | 0–4s | The 2×2 cube drifts in, front face (red) toward the viewer. Everything else dimmed. Tunnels OFF. | Slow push-in to front face | "This is one cube. But it folds through itself." | (watch) | Calm establishing shot; a faint pulse at the cube's center hints at the VoidCore. |
| **1. Highlight the tile** | 4–10s | One red tile (top-left, `M1-001`) gets a soft breathing highlight ring. A single tap-prompt appears. | Hold | "Tap this tile." | **Tap the highlighted tile** | Ring tightens on tap; the tile depresses. |
| **2. The flip + soliton** | 10–16s | On tap: tunnel is spawned for this pair, `tunnelBirths` grow-in fires, then the **traveling soliton** shoots from the tile → center → the antipodal tile. Plasma seam glows at the core. | Camera pulls back slightly to reveal the *whole* cube so both endpoints are on screen | (no copy — let the motion speak for ~2s) | (watch) | A bright pulse threads *into* the cube and *out the far side*; the destination tile flips to its antipodal color. |
| **3. Name it** | 16–26s | Both tiles now carry a persistent thin wormhole tunnel between them. A callout line connects the two tiles with a label. | Slow orbit ~30° so the player sees the tunnel pass through the middle | "Same point. Opposite sides. Flip one — the other flips too." | (watch / free-orbit enabled) | The tunnel is visibly a bridge through the center, not around the edge. |
| **4. Prove it (they drive)** | 26–45s | Highlight fades; the prompt invites a *free* flip on any tile. A live PiP (antipodal camera) opens in the corner. | Player-controlled orbit | "Try it. Flip any tile and watch its twin." | **Flip any tile** | Every flip they make fires its own soliton; the PiP shows the far side reacting in real time. |
| **5. Close** | 45–60s | Gentle "you've got it" beat. Button: **Continue**. | Ease back to a hero framing | "That's the whole trick. Everything else is a puzzle built on it." | **Tap Continue** | Sets `worm3_first_flip_done`; transitions to Main Menu. |

Design notes:
- **Beat 2 is the money shot.** It must read even on a phone. The soliton +
  plasma seam we just shipped exist specifically to make this legible; this
  sequence is their highest-value use.
- **Beat 4 converts watching into knowing.** Passive comprehension is fragile;
  making the player *cause* the effect themselves is what cements it. Do not skip
  this beat to save time.
- **No solving is required or mentioned.** The cube starts and stays solved-ish;
  we only care about flips.

---

## 5. The aha mechanic, in detail

Reuse existing systems — build almost no new 3D:

- **Cube:** `makeCubies(2)` in a dedicated scripted scene (or the existing
  `GameScene` with a `firstFlip` level config; see §8). Size 2 is deliberate —
  4 tiles per face, antipodal pairs are unambiguous, no interior noise.
- **Flip:** `flipStickerPair` + `buildManifoldGridMap` /
  `findAntipodalStickerByGrid` — the exact same path normal play uses, so what
  the player learns here is literally true everywhere else.
- **Tunnel + soliton:** `WormholeNetwork` / `MobiusTunnel` with `showTunnels`
  forced on for the guided pair. The flip pushes a `tunnelPulses` entry, which
  now drives the traveling soliton (shipped this cycle).
- **Antipodal proof:** `AntipodalPiP` (the negated-camera picture-in-picture)
  during beat 4, so the far side is on screen simultaneously with the near side.
- **Center:** `VoidCore` provides the "folds through itself" focal point in
  beat 0.

The point: this onboarding is assembled from parts that already work. It is
**sequencing and copy**, not an engine feature. That is exactly why it is the
highest ROI item on the board.

---

## 6. Copy deck (final strings)

Tone: plain, confident, short. **No emoji** (aligns with the six-faces
direction; note this diverges from the current story-level tutorials, which use
emoji — a consistency decision to make, see §11).

- Beat 0: `This is one cube. But it folds through itself.`
- Beat 1: `Tap this tile.`
- Beat 2: *(silent)*
- Beat 3: `Same point. Opposite sides. Flip one — the other flips too.`
- Beat 4: `Try it. Flip any tile and watch its twin.`
- Beat 5 title: `That's the whole trick.`
- Beat 5 body: `Every mode in the game is a puzzle built on this one idea.`
- Buttons: `Skip ▶` (persistent), `Continue` (beat 5).
- Help entry label: `Replay: The First Flip`.

---

## 7. Skip / replay / accessibility / mobile

- **Skip:** always visible, top-corner, low-emphasis. Skipping still sets
  `worm3_first_flip_done` (they made a choice) but records a `skipped` flag so we
  can measure it.
- **Replay:** Help menu entry re-runs the full sequence without clearing progress.
- **Reduced motion:** if `prefers-reduced-motion`, slow the soliton, drop the
  camera orbit to a static reveal, keep the color change (the essential signal).
- **Mobile:** the whole thing is tap-driven; beat 4's PiP must not occlude the
  active tile on narrow portrait — reuse the responsive PiP placement in
  `AntipodalPiP.getTopBarHeight()` logic. Verify the soliton reads at phone DPI
  (it did in the shipped screenshots).
- **Colorblind:** the mechanic is taught by *motion through the center*, not by
  which color appears — so it survives color-vision differences. Good; keep it
  that way (don't make the aha depend on distinguishing red from orange).

---

## 8. Technical implementation plan

Phased so an MVP ships before polish.

**Reuse / repurpose (no new engine work):**
- `worm3_first_flip_done` + `hasFlippedOnce` (exists) — the gate.
- `showFirstFlipTutorial` slot in `UILayer.jsx` (exists) — either upgrade its
  component in place or add a `showFirstFlip` phase in `App.jsx` alongside
  `showWelcome` / `showMainMenu`.
- `WormholeNetwork`, `MobiusTunnel`, `VoidCore`, `AntipodalPiP`, `flipStickerPair`.

**New, small:**
1. `FirstFlipSequence.jsx` — a DOM overlay driving the 5 beats (a tiny state
   machine keyed off an elapsed timer + interaction gates), mounted on top of the
   persistent Canvas exactly like `WelcomeScreen` is. Passes a `beat` down so the
   3D scene and copy stay in sync (same pattern `WelcomeScreen` uses with
   `introTime`).
2. A **scripted scene config** — the cleanest route is a `firstFlip` pseudo-level
   in `src/levels/data/` (`cubeSize: 2`, `features: { flips:true, tunnels:true }`,
   guided highlight target `M1-001`) so it flows through the existing
   `GameScene` rather than a bespoke renderer.
3. A **guided-highlight overlay** — reuse the existing solve-highlight/cursor
   overlay to breathe a ring on the target tile; gate the flip handler so only the
   highlighted tile responds in beats 1–2, then open it up in beat 4.
4. Wire **Help → Replay**.

**Flag lifecycle:**
- Set `worm3_first_flip_done` on beat 5 Continue *or* Skip.
- Never auto-show again once set; Replay bypasses the gate without clearing it.

**Estimated effort:** ~2–3 focused days for MVP (beats 0–5, copy, gating,
replay), because the 3D is all reused. Polish (camera choreography, reduced-motion
path, telemetry) is another ~1–2 days.

---

## 9. Knock-on: reshuffle story levels 1–3

Once the mechanic is taught up front, the early campaign should reinforce it
immediately instead of hiding it:

- **Level 1 (Baby Cube):** keep as the pure-rotation 2×2 solve — but now it lands
  *after* the aha, so rotation reads as "the other half of the toolkit."
- **Level 2:** introduce a *goal that requires a flip* (currently "twin paradox"
  is thematic only). Make the twin paradox literally a flip puzzle — the earliest
  possible payoff for what they just learned.
- **Level 3 (flip-gateway):** no longer the first exposure; promote it to the
  first *combination* of rotate + flip.

Net: the novel idea appears at impression #2 and is exercised by level 2, instead
of first appearing at level 3.

---

## 10. Roadmap phasing

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 — MVP** | Beats 0–5, scripted 2×2 level, guided highlight, gating, Continue/Skip, Replay | New player reaches Main Menu having caused ≥1 flip and seen the soliton cross the cube |
| **P1 — Comprehension** | Beat 4 free-flip + live PiP, copy polish, playtest round | ≥ 8/10 testers restate the mechanic unprompted |
| **P2 — Polish** | Camera choreography, reduced-motion path, mobile tuning, telemetry (completion/skip/time) | Metrics in §2 instrumented and green |
| **P3 — Reinforce** | Level 1–3 reshuffle (§9) | Level 2 requires a flip to solve |

Do **P0–P1 before adding any new mode.** The thesis of this roadmap is: spend the
next cycle inward (make the one idea land) rather than outward (more modes).

---

## 11. Risks & open questions

- **Emoji consistency.** Proposed copy is emoji-free; existing story tutorials use
  emoji. Pick one voice globally. (Recommendation: emoji-free for the core
  onboarding; it reads more confident.)
- **Too much hand-holding?** Beat 4 must feel like play, not a checklist. If
  playtests find it patronizing, compress beats 3–4.
- **Skip-baiting.** If skip rate is high, the sequence is too slow — cut beat 0 to
  2s and move the flip earlier. The flip is the hook; do not bury it.
- **Does it belong before or after the six-faces menu?** Spec says before (mechanic
  before choice). Alternative: let them pick "Story," then run First Flip as
  level 0. Playtest both; leaning "before."
- **One pair vs. show the whole net.** We deliberately teach *one* pair. Resist the
  urge to show all antipodal connections at once in onboarding — that's a level-3+
  reveal, not a first impression.

---

*This is a design sketch for discussion, not a committed plan. The core claim it
rests on: the mechanic is under-taught, and the fix is sequencing + copy on top of
systems that already exist.*
