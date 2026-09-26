# Flip Cube — Main Design and Implementation Plan

> **Status:** design plan, 2026-09-25. Six decisions were settled on 2026-09-26 (§13), and the FLIP CUBE rename has shipped (§7). Much of phases 1–4 (§10) has since shipped: the implementation checkpoint below records what is live, and §13 what is still open. This is the brief for refocusing WORM³ on **the Flip Cube** as its main object. Flipped tiles pop out and bounce according to their flip count. Their Möbius funnels pulse and spring with them. In WORM you jump onto a popped tile to ride its tunnel. Something rumbles under the tiles. Mobi explains all of it as a piece of his home world, WORM³.

## Implementation checkpoint — 2026-09-26

Cube modes now raise whole flipped cubies, retain the small square pads and use full-back
antipodal stalks. WORM raises the landing to the top of its ground-anchored caution tape and
takes a deliberate jump onto a pad underfoot or one tile ahead. The sampled jump carries head and tail together; the chase
camera follows the same head. Nearby platforms receive portrait framing that includes both
the worm and its jump destination. Portal rings, signs and portal effects follow the raised tile. Caution tape and posts stay
on the floor lattice around the opening. Mirror view and cosmetic pad settings cannot
disable physical WORM lift. Flipped-face landings enter the tunnel. Crawl does not enter raised
mouths. Tunnel paths and exit handoffs start from the pad's hover. Demo lessons retain the
legacy route.

WORM pads hold a fixed landing height, `WORM_PAD_HEIGHT` (0.3 since the low-hover pass);
cosmetic motion settings cannot remove the physical platform. Layer-turn scheduling holds during the captured jump (0.65 seconds normally; formation can extend it). Rescue
jumps retain their no-ride provenance. The full Rumbler, animated landing compression and
launch beats, ghosting and cinematic choreography remain roadmap work.

### Tape-height WORM platforms — 2026-09-26 correction

The user clarified that the landing should meet the top of the caution tape, with the tape
left on the cube surface to mark the opening below. The earlier 0.06 piece pop was too small.

- `WORM_CAUTION_POLE_HEIGHT = 0.68`; `WORM_CAUTION_TAPE_TOP = 0.655`.
- `WORM_PIECE_POP = 0.355` plus `WORM_PAD_HEIGHT = 0.3` places the landing at that edge,
  independent of board size. Cube-mode pops are unchanged. Global Explode still composes
  with the lift using `max`, so it never stacks another explosion on top.
- Ground-anchored WORM tape has a stable top edge, including critical/void warnings.
  Portal rings and signs follow the rising mouth; the perimeter never rises with it.
- Raised WORM shells are translucent and do not write depth, so the Möbius band is visible
  through the exposed sides. Band endpoints extend to the lifted tile, not its old slot.
- Whole cubies ease out for two seconds. The Möbius ribbon and rails grow together from
  both mouths, even when tunnel view is Off/Hints. Pause holds progress, and reduced motion
  presents the completed geometry immediately. Cosmetic pad settings cannot disable it.
- Deliberate Jump captures the raised landing; it clears the ledge by 0.35 units and uses
  the same sampled arc for head and tail. An early jump waits for the rise to complete.
  Unflipped faces on the same cubie remain jumpable, without triggering a tunnel ride.
- This is a platform/perimeter correction. The existing crawl and tunnel-collapse death
  rules remain as documented below; it does not add a new fall-death trigger.

### WORM low hover and unstable wormhole — earlier pass, superseded heights

The following records the earlier low-hover pass. Its 0.06 piece movement, 0.36 landing,
shortened moving fences, and floor treatment of carried faces are superseded above.


Playtest: the tunnel sat too high to reach believably. Half the Explode lift plus a 0.5 pad
put a 3×3 landing about 1.4 units off the surface (about 2.0 on 5×5, 5.9 on 15×15), so the
worm leapt clear of the cube to reach it. Now the piece pops out barely, the tile hovers a
short hop above it, and the gap carries the drama instead.

- **Pieces pop out barely.** The piece moves `WORM_PIECE_POP` (0.06) along the face normal, the
  same on every board size. `wormRaisedAmount(size)` turns that distance into an Explode
  fraction for the outer layer, and a corner moves 0.06 along each axis, as Explode would. A
  flipped piece's other faces stay ordinary floor, so `raisedPlatformPosition` returns only
  live pads. Cube modes (Flip Cube and Chaos) now pop a hair too: `CUBE_PIECE_POP` (0.1)
  via `cubeRaisedAmount(size)`, so the tunnel underneath shows only as a sliver. The full
  Explode pop threw flipped pieces across the scene, worst on large boards.
- **One landing height.** `WORM_PIECE_POP` and `WORM_PAD_HEIGHT` (0.3) live in
  `src/game/raisedCubie.js`. Together they feed the sim landing, portal visuals, the pad
  renderer (`PAD_PROFILES.worm`) and tunnel handoffs. The landing sits 0.36 above the surface
  on every board size.
- **Exit fix.** Tunnel exits now test `padHeight`, not the truthiness of `padExpansion` (which
  was 0 while pieces stayed put). A ride that starts on the floor (Mobi's Create Wormhole)
  still lands on the exit pad.
- **The unstable wormhole** (`PadEnergy`, render only; cube modes unchanged):
  - the stalk becomes an additive energy column spanning only the gap, narrow in the slot and
    flaring to the tile, with twisting bands, climbing surges and a stepped flicker;
  - the slot's mouth becomes a swirling vortex;
  - three arcs per pad re-strike 9 times a second at a 62 % duty: two jump the gap and one
    discharges to the surface just outside it;
  - eleven sparks a second spit off the rim;
  - the tile shudders a few millimetres (≤ 0.012 along the normal, ≤ 0.008 in-plane), with
    twins in step (the $P_+$ rule, §9.2).

  All of it is deterministic in (time, seed) with no `Math.random`, and nothing is written
  back to the sim. Pause freezes it. Reduced motion keeps a steady glow with no arcs, sparks
  or shudder.
- **Readability at the new height.**
  - Tunnel signs shrink as the camera nears them: full size beyond 5 units, gone inside 2.6.
    The HUD card already reads out the pad ahead.
  - Pad fences are shortened by the hover, so their tape stays below the chase camera's eye.
- **Clearance.** The crawl under a pad runs on the unpopped surface, and the tile's underside
  sits 0.36 above it. That clears the bare head (≈ 0.17, Mobi ≈ 0.20) and a tall hat (≈ 0.30).
  The cost: while crossing under, the worm's beads dip up to about 0.06 into the popped piece's
  top.

### Bounce model upgrade — 2026-09-26

- **Worn regime.** `padIsWorn(wear, livesLeft)` ($w \ge k^*$, or one life left) is now the one
  predicate behind both `classifyPad` and `PadProvider`. The provider eases a worn weight
  $r \in [0,1]$ at 1.5 per second instead of snapping it. With $\varphi$ the pair's integrated
  phase, $\varepsilon = 0.06$, $G$ the golden ratio and $U_\pi(k) \in [0,1)$ a hash of the pair
  seed and hop index $k$:
  $$\beta = \varphi + r\varepsilon\left[\sin \pi\varphi + \sin \pi G\varphi\right], \qquad h = h_0 + A(w)\left[1 - 0.45\,r\,U_\pi(\lfloor\beta\rfloor)\right] b(\beta).$$
  - Twins share $\varphi$ and the seed, so they stay identical (the $P_+$ rule, §9.2).
  - $\partial_\varphi\beta \ge 1 - \varepsilon\pi(1+G) \approx 0.51$, so the beat never runs
    backwards. The worst case during the ease is $0.51 \cdot 0.7 - 2\varepsilon \cdot 1.5 \approx 0.17$
    cycles per second (menu profile, $f_0 = 0.7$ Hz), which is still positive.
  - A hop's height changes only at touchdown, where $b = 0$, and only shrinks toward $h_0$, so
    a worn pad never dips below its hover height.
  - **Deviation from §3.2: no in-plane jitter or tilt.** Jitter would move tap targets under a
    finger, and tilt would skew the tally marks. Uneven hops and beat drift carry the
    irregular read instead.
  - On every supported cap, $k^*$ alone decides which pads are worn. Cap 3 has no worn pad,
    because its warning sits on the $n = 2$ home tile (§9.6).
- **Whole pieces bounce out.** In cube modes, a flipped cubie now rides a lighter spring to
  its Explode position: stiffness 210, damping 12.2, $\zeta \approx 0.42$. It passes that
  position by about 22 % and springs back, and does so identically at 30, 60 and 144 fps
  (fixed 1/120 s substeps).
  - On the return, the lift is clamped at zero, so the piece lands instead of sinking into
    its neighbours.
  - `selectiveCubieOffsetRatio` passes the overshoot through, capped at 1.5.
  - The overview camera's `raisedCubieExtent` still clamps at 1, so framing does not pump
    with each bounce.
  - Pads keep the press spring ($\zeta \approx 0.65$, about 5 % overshoot). WORM keeps its
    fixed platform height, with no spring.
- **Pair bookkeeping.** A twin that is not mounted is assumed to match (`pairFlips`) rather
  than counted as zero, which had halved a lone-mounted pair's wear. The frame loop now
  reuses one pose input and inverts the provider frame once per frame, not once per pad.
- **One cap everywhere.** WORM portal placement and platform framing now read
  `selectEffectiveFlipCap` and `WORM_PAD_HEIGHT`, the same sources the renderer uses. Before
  this, they used a literal 6 and 0.5. Under a cap of 8, a 7-flip tile's cubie would have
  been raised while its portal ring sat on the floor.
- **One entry rule.** `tunnelEntryRule(state)` ('pad', or 'crawl' in demo lessons) feeds both
  the crawler and the HUD. The pad route's danger copy says "don't jump on it" and "crawl
  under it", and Mobi's WORM intro says to jump onto a flip pad.
- **Not yet: lethal pits.** A voided pad still stands, and crawling under it is safe; only
  landing on it kills. Decision #3 (§4.4) needs the pad to drop into its slot, crawling into
  the mouth to kill, and the pit to stay visible with reduced motion or tunnels hidden. Until
  then, the HUD describes what actually happens rather than the decision.

### Implementation decisions

- Whole cubies now pop a hair out of the cube (`CUBE_PIECE_POP`, see above) when any face has a
  live odd flip count. They first rose to their full Explode position, which was far too much.
  Unflipped faces travel with the body and remain ordinary platforms; tunnel eligibility is per face.
  Springs follow physical piece identity through layer turns. Manual Explode does not stack the lift.
  Whole-piece motion settles; only the small normal-offset pads bounce continuously.
- Stalks cover the full 0.85-square tile back with a capped, half-twisted square funnel.
  They extend through the raised cubie and emerge behind its inner face; instance transforms
  animate the extension without rebuilding geometry.
- Raised stalks use the selected palette’s antipodal color of the currently visible face
  (white → yellow, red → orange, blue → green), without a fixed green material tint.
- Keep the remaining default choices in §13: bigger/faster wear, subtle Chaos profile,
  cover topology for the eventual chaser, and the existing names.
- Put pad displacement on a parent transform owned by `FlipPadOffset`. The existing sticker
  transform still owns its flip, death, shake and press effects. Normal lift composes with
  live layer rotations and Explode without competing position writes.
- Use one scene-local `PadProvider`, shared pair clocks and two instanced draws: stalks and
  slot mouths. No per-frame React state. Funnel anchors follow the finite whole-cubie movement,
  but do not read the small pad’s continuous normal bounce.
- Evaluate shared wear from the symmetric average of pair inputs, then evaluate the nonlinear
  pose. A lone pad's absent mate is still a home tile, not a second elevated pad.
- Integrate phase (`phase += frequency * dt`) instead of evaluating `frequency(wear) * time`:
  changing wear must change speed continuously, not teleport the bounce to another phase.
- Use the press spring constants with bounded substeps. Pair phase survives a slice remount
  within the scene; cleanup is owner-checked so old scenes cannot clear replacement data.
- Reduced motion holds the pad at its static height and disables its idle pulse. Full/subtle/
  flat choices live in Settings → Scene. Chaos has its own low-height profile; big boards
  halve the moving amplitude. No random jitter or tilt ships in this foundation.
- WORM uses the same pad positions (slot plus `WORM_PAD_HEIGHT`) for rendering, captured
  jumps and tunnel handoffs. Keep the physical pads independent of cosmetic motion settings.

### WORM integration contract for phase 4

1. Route crawl triggers, jump presses, natural landings, lag-frame swept entry and rotation
   commits through `padEntryDecision`. A pending candidate alone must never grant self-hit
   immunity when its entry decision is `pass`.
2. Track jump provenance for the whole arc: a rescue or exit-launch hop must remain protected
   at landing, not merely on its first frame. Rocket grace and MOBI lock retain precedence.
3. Evaluate the landing event against the tile actually reached that tick. Avoid checking
   the next cell after consuming a large step remainder. Arm/consume it exactly once.
4. Pad ride count is keyed by canonical tunnel identity, not by the transient surface slot.
   Publish ride wear, void state and pad events through a render bridge; never mirror frame
   clocks into Zustand. Heals/reset must remove both twins' stale events.
5. The route sampler owns the head's hop-up, compression, plunge and launch. Body history and
   camera sample that same route; the renderer follows its pad event. Test continuity at each
   phase boundary and across 30/60/120 Hz, including a turning layer and a long tail.
6. Pad assist only captures a forward pad in the agreed 0–1 tile window. Steering away cancels
   capture. It must not turn a jump intended to clear a pit into a lethal assisted landing.
7. At three used rides, show an explicit **NEXT RIDE COLLAPSES** warning before commitment;
   bounce intensity alone is insufficient. A voided mouth remains visibly a pit in reduced
   motion and with decorative tunnels switched off.
8. A raised cubie’s unflipped faces are jumpable platforms, never tunnel entries. Classify the
   face actually landed on, not the whole cubie. The route must handle radial gaps, edge/corner
   offsets, turns and platform-to-platform jumps before enabling whole-cubie lift in WORM.
9. Story/demo may override entry mode. Switch the global default only after their prompts,
   authored routes, character/hat clearance and mobile chase-camera checks pass.

### Rumbler contract for phase 5

R1 and R2 are visual observers. Freeze their phase during pause, countdown, transit, rescue,
focus, death and victory; resuming must not catch up through missed wall-clock time. R2 reads
`rotationClock.axis`, **all** `sliceIndices`, and `warning`; it must not infer a threatened
slice independently or change when that turn dispatches. Keep the existing safe lane and
rim visible. Belts use wrapped distance `min(|s-s0|, L-|s-s0|)` for `L=4N`, so a crest crosses
the seam continuously. At a size/scene change clear its bounded tile-displacement bridge.
The optional chaser needs a separate gameplay acceptance pass and stays out of R1/R2.

## 0. Summary

- **One hero object.** The cube on every screen is *the Flip Cube*, a piece of Mobi's world WORM³. The intro, main menu, loading screen, every mode and the victory beat show the same object behaving the same way. The solve mode carries its name: CUBE is now **FLIP CUBE**.
- **Flipped tiles become flip pads.** A tile with an odd flip count (it is showing its twin's colour) lifts out of its slot along its own outward normal, then bounces and pulses. The bounce reads the tile's wear: flips toward the cap in cube modes, rides toward collapse in WORM. Twins always move in phase because they are the same tile (§9.2–9.3).
- **"Using the explode function".** A live flipped face raises its entire cubie to the position shown in Explode, including its unflipped faces. The small square pad lift remains on top. The piece returns only when none of its faces has a live odd flip count (§9.7, item 2).
- **The Möbius funnel activates, pulses and springs.** A short half-twisted stalk joins each pad to its slot and compresses like a coil. Every bounce sends a pulse from *both* twins into the Core. A ride sends one pulse from entry to exit.
- **WORM: jump on the pad to ride.** Crawling under a pad no longer drops you into the tunnel. Landing on a pad, or hopping up while under it, does. The twin launches you back out with a spring hop. Tunnels stop being pits and become choices.
- **Something lives under the tiles.** *The Rumbler* is a wave that runs along the rows and columns beneath the worm. It ships first as atmosphere and as the layer-turn warning, dragging the layer that is about to turn. A chaser version comes later.
- **Mobi says why, in plain words.** WORM³ is a world where every spot has a twin straight through the middle. The Flip Cube slipped out of it and landed here scrambled, and the Rumbler came along. Healing the Flip Cube keeps Mobi's way home open. On-screen copy stays jargon-free (house style). The mathematics lives in §9.

## 1. Why this refocus fits now

The codebase already contains most of the parts. This plan joins them into one behaviour.

| Already shipped | Where | What the Flip Cube does with it |
|---|---|---|
| The monograph formally names the object "The WORM-3 Antipodal Flip Cube" | `docs/worm3-monograph.md` | Promote the name to the product. |
| One-shot explode hop of both flipped cubies (radial, 1.5 u, 600 ms / 1200 ms first flip) | `useCubeState.flipSticker` → `cubiePops` → `3d/Cubie.jsx` | Keep as the impact beat when a pad is born. |
| Global Explode view; WORM's Explode power | `explosionT` + `cubeExpansionScale`; `worm/wormExpansion.js` | Pads compose on top of either. |
| Parity blink: the tile shoves out along its normal, 0.05 per flip up to 0.26 | `3d/parityBlink.js`, `StickerPlane` | Generalise from a one-shot to a persistent pose. |
| Persistent tremor plus a small hop on flipped tiles, scaling with flips up to 5 | `StickerPlane` frame tick | Replace with the pad pose (same writer, same cost). |
| Tunnel anchors ride their tile's flip motion (`bounce` along the normal) | `manifold/tunnelAnchorMotion.js` | Pads publish lift through the same kind of bridge. |
| Möbius funnel: half-twist ribbon tapering into the Core, whip and soliton pulses, births and deaths, focus budget 3 | `manifold/MobiusTunnel.jsx`, `RestingCords.jsx`, `WormholeNetwork.jsx` | "Activates, pulses and springs" reuses these uniforms. |
| Worm-weight springs (K 210, damping 19, ζ ≈ 0.65, ≤ 24 tiles) | `worm/tilePressBridge.js` | Same spring feel for pad events and Rumbler heave. |
| Tunnels trigger automatically on crawl-in; jumping over avoids them; jumping while on dives in | `worm/healerWorm/wormSim.js` crawl step | Invert: jump on to ride. |
| Active-tunnel cap halved to 10 because open tunnels "became terrain" | `worm/healerWorm/constants.js` | Pads remove the cause, so the cap can be re-tuned. |
| Turn hazard: inverse-scramble queue every 10 s, gold rim and safe lane | `worm/HealerWormMode.jsx`, `SliceWarningLights.jsx` | The Rumbler becomes the warning inside the game world. |
| Mobi dialogue; MOBI character ("Multi Orientable Block Intelligence") whose ability opens a tunnel | `MobiIntroScreen.jsx`, `worm/wormCharacterData.js`, `healerWorm/signatures.js` | Mobi is the Flip Cube's native. |
| Menu cube flips its face centres and sends worms through them | `MainMenu.jsx`, `menuCenterPortals.js`, `MenuFlipWave.jsx` | Those centre flips become real pads. |

## 2. Pillars

1. **One object, one vocabulary.** A pad looks and means the same in the intro, menu, Classic, Chaos, Story and WORM. A mode changes only the pad's *profile* (height and amplitude), never its meaning.
2. **The flip is physical.** Flipped tiles leave the surface and home tiles sit flush, so a board's flip state can be read from across the room.
3. **Twins are one thing.** Both tiles of a pair always move together. If they ever disagree, the disagreement is itself the signal: only a heal can fix it.
4. **Tunnels are invitations.** In WORM a tunnel is ridden on purpose.
5. **The cube is alive underneath.** The Rumbler raises the stakes without adding deaths the player can't avoid.
6. **Plain words on screen, exact math in docs.** The house style in `docs/COPY_STYLE.md` and `utils/demoStepCopy.js` is unchanged.

## 3. The flip pad (all modes)

### 3.1 States

Notation:

- $n$ is a tile's flip count.
- $C$ is the cap in force (`selectEffectiveFlipCap`, never the bare `FLIP_CAP`).
- In WORM, $u$ is the pair's rides so far (`tunnelUseCounts`) and $U$ = `WORMHOLE_MAX_TRAVERSALS` (3).

| State | Condition | Look / motion |
|---|---|---|
| Home | $n$ even, $n < C$ | Flush with its cubie, which can be raised by another face. Worn home tiles keep their existing tally marks and health bar. |
| Pad | $n$ odd (shows its twin's colour) | Lifted to the mode's hover height, with a periodic bounce and an impact pulse. |
| Worn pad | pad with wear $w \ge k^*$, or one life left | Same height; irregular bounce and a hotter rim (§3.2, §9.6). |
| Lone pad | pad whose twin is home ($\Delta \ne 0$; only a heal can cause it) | Hovers; its funnel is torn (ends at the Core, no exit portal) and writhes. |
| Locked pad | MOBI re-entry cooldown | Holds still with a lock ring; cannot be ridden. |
| Riding | worm landing or entering, or exiting | Compress-and-plunge, or preload-and-launch (§4.2). |
| Pit (WORM) | tunnel voided | The pad drops into its slot, leaving a dark mouth; entering it is lethal (§4.4). |
| Dead | $n \ge C$ | Existing grey death; flush; funnel severed (existing `tunnelDeaths`). |

Wear:

- In cube modes, $w = n/C$.
- In WORM, $w = u/(U+1)$. WORM tunnels always sit at $n = 1$: they spawn from one flip and heal back to 0 (`healSticker`), so the ride count is the only wear signal WORM has (§9.7, item 1).

### 3.2 Motion model

For each pair $\pi$ with shared phase $\varphi_\pi$ (a hash of the same sorted-grid-id `pairId` that WormholeNetwork builds), at time $t$:

- **Lift.** $h(t) = h_0 + A(w)\,b(\phi(t))$, where $b(x) = 1-(2\{x\}-1)^2$ is a bouncing-ball arc with the impact at $\{x\} = 0$, and $\phi(t) = f(w)\,t + \varphi_\pi$.
- **Wear.** $A(w) = A_0 + A_1 w$ and $f(w) = f_0(1+w)$: more wear gives a bigger, faster bounce. This continues what today's tremor, blink reach and rim intensity already say.
- **Impact squash.** Normal scale is $1-\sigma\iota$ and in-plane scale is $1+\tfrac{\sigma}{2}\iota$, with $\iota = e^{-(\{\phi\}/0.08)^2}$. The same impulse drives the rim glow and the funnel pulse (§3.3).
- **Worn regime** ($w \ge k^*$, or one life left). As shipped (see the bounce-model checkpoint above):
  - The drift term $\epsilon[\sin \pi\varphi + \sin \pi G\varphi]$ is added to the integrated **phase**, not to time, so it keeps the pad's own tempo and cannot run the beat backwards. $G$ is the golden ratio.
  - Each hop draws its height from a hash of the pair's seed and hop index (never `Math.random`), between 55 % and 100 % of the amplitude.
  - The originally drafted in-plane jitter (≤ 0.03) and tilt (≤ 6°) were dropped: they moved tap targets and skewed tally marks.
  - The incommensurate rates make the bounce less regular. This deterministic quasi-periodic signal has discrete spectral components; it is not, by itself, broadband noise.
- **Events.** Pads use the press-bridge spring (ζ ≈ 0.65). Pop-out overshoots $h_0$ by about 5 %. Flip-home and heal settle to 0 with one rebound. The whole cubie under a pad uses a lighter spring (ζ ≈ 0.42). It passes its Explode position by about 22 %, then lands without sinking below zero.
- **Reduced motion.** $A = 0$, with no jitter and no squash. Pads hold $h_0$, and wear shows as a static rim tint.

Starting profiles (to tune in playtest). These small pad lifts are along the tile’s own outward normal, on top of the whole cubie’s radial extension.

| Profile | $h_0$ | $A_0$ | $A_1$ | $f_0$ | Notes |
|---|---|---|---|---|---|
| WORM | 0.30 | 0.05 | 0.10 | 0.8 Hz | Fixed height, no bounce (the landing must hold still). Sits over a piece popped 0.355; combined height 0.655 meets the ground-anchored tape. |
| Cube / Story / Random | 0.30 | 0.04 | 0.12 | 0.9 Hz | |
| Chaos | 0.14 | 0.02 | 0.10 | 1.0 Hz | Dense boards; the worn regime carries the betting read. |
| Menu / intro | 0.35 | 0.06 | 0.10 | 0.7 Hz | Cinematic. |
| Big boards (fxBudget `big`) | ×1 | ×0.5 | ×0.5 | ×1 | Worn hop spread scales with the halved amplitude. |

```
        ┌──────────┐    ← flip pad: sticker face up, rides h(t)
        └───┐  ┌───┘
            │╲╱│        ← PadSpring: half-twisted stalk, squashes like a coil
  ──────────┘  └────────  ← slot mouth (aperture decal) at the surface
             ╲╱          ← existing Möbius funnel dives to the Core
```

### 3.3 The Möbius funnel: activate, pulse, spring

- **Stalk.** A new `PadSprings` component is one InstancedMesh of a short half-twisted ribbon running from the slot to the pad's underside, scaled by the live lift. Squashing it shortens the twist pitch, so it reads as a coil. It costs one draw call for every pad on the board.
- **Anchors stay at the cubie’s slot.**
  - The ribbon and cords keep anchoring at `TUNNEL_ANCHOR_OFFSET`, and only the stalk follows the small pad bounce. The slot and large funnel anchor move with the whole cubie during its finite rise/return.
  - `MobiusTunnel` rebuilds its geometry whenever an anchor moves more than 0.01, and the resting cords share one merged strand. If every bouncing pad dragged its anchor, the whole network would rebuild every frame.
- **Idle pulses are symmetric.** On each impact, a soliton leaves *both* mouths and meets at the Core. The shader drives it from the pad clock, with no store writes. A ride is the only one-directional pulse: the existing entry → exit soliton. Symmetric pulses mean idle life; a directed pulse means travel.
- **Spring.** During events (pop, land, launch), the ribbon's existing whip amplitude follows the pad's velocity. Lone pads whip continuously, in proportion to the asymmetry channel (§9.2).
- **Visibility.**
  - A new pad births its funnel with the existing `tunnelBirths` grow-in and holds the focus tier for a few seconds. It then yields to the resting cords under `FOCUS_BUDGET`.
  - With `showTunnels` off, the stalk and mouth still show, so a flip always reads as a door.

### 3.4 Cube-mode interaction

- **Tap a pad.** This flips the pair home, subject to the existing 3 s refractory period and `canFlipStickerPair`. The pad springs down, its stalk retracts, and the funnel goes dormant: the pair keeps its resting cord while it carries any flips, exactly as WormholeNetwork does today, but it stops pulsing and springing. Only the cap severs it, through the existing `tunnelDeaths` snap.
- **Tap a home tile.** Existing cubie pop, plus the pad springing out and a funnel birth.
- **Untouched systems.** Drags, slice turns, undo (`unflipStickerPair`), solve detection and the Kociemba/antipodal engines are unchanged. Pads are presentation over the authoritative state.
- **Explode view.** Pad lift is added in the exploded frame.
- **Hit testing.** Unchanged, because the sticker mesh moves with the pad.
- **Biome cities.** They ride their pad as small floating islands; check the GLB cost.

### 3.5 Readability and accessibility

- The sticker face stays flat and legible on top of the pad. Marks, Sudokube numbers, health bars and tally marks ride with it.
- The slot shows a mouth decal (reusing the WORM aperture shader), so a lifted tile never exposes bare cubie plastic.
- Height, not colour alone, carries pad state, which keeps it readable for colour-blind players.
- No flash exceeds the existing flip flash. Worn jitter is bounded and turns off under reduced motion.

## 4. WORM: jump on the pad to ride

### 4.1 Entry rule

Ship behind `tunnelEntry: 'crawl' | 'pad'`, a store setting with a story/level override. `'crawl'` is today's rule, kept for regression and for any level that wants it.

| Situation | Today (`crawl`) | New (`pad`) |
|---|---|---|
| Crawl into a flipped cell | Enters at 1/3 of the step (`TUNNEL_TRIGGER_PROGRESS`) | Passes under the pad; no entry |
| Jump pressed while the head is in the pad cell | Deliberate dive | Hop up onto the pad → ride (same code path) |
| Jump whose landing cell is the pad | Enters if still in that cell's step | Lands on the pad → ride |
| Jump that lands past the pad | Skips | Skips (arc apex 1.3 is well above the pad) |
| Rocket touchdown on a pad | No entry (landing grace) | Unchanged |
| Jump-rescue hop | Never dives (`allowDive: false`) | Never enters a pad |
| Grass spring / Inch spring / ice jump landing on a pad | Enters if still in the cell | Counts as a landing → ride |
| Layer still turning onto the cell | No dive | No entry until it settles |
| MOBI re-entry lock | No entry | No entry; locked pad |
| Voided tunnel | Kills on contact (entry into a collapsed tunnel) | Pit: crawling or landing into it kills; jumping over clears it |

**Landing assist.** A jump pressed with a pad 0–1 tiles ahead stretches or shrinks `jumpSpan` to land on the pad's centre, the same way the jump rescue already stretches its span. A natural landing more than one tile past the pad clears it. `JumpLandingMarker` switches to a pad reticle when the predicted landing cell is a pad, and the pad goes solid and brightens ("locked on").

### 4.2 Beats

- **Land (≈ 0.3 s).**
  - The head touches the pad top at $h(t)$. The pad compresses to 0.15, then plunges 0.05 into the slot, carrying the head into the throat; this becomes `windup`.
  - The pad rebounds behind the worm with overshoot.
  - The body keeps the continuous-route contract in `docs/continuous-tunnel-body.md`; the axial handoff only grows by the pad height.
- **Ride.** Unchanged interior, with the directed soliton.
- **Exit launch.**
  - The twin pad dips as the head nears its mouth (anticipation), then kicks.
  - The worm leaves with a spring hop (span 1.25 tiles, height ≈ 0.8) along its exit heading, with landing grace plus the existing post-tunnel self-collision grace.
  - Grace means a launch can never land straight into another ride.
- **Perfect spring (optional).** Landing while the pad is in the bottom 20 % of its bounce earns a small reward, such as ride speed or bonus XP. There is no fail state: bounce phase can only help, never hurt.

### 4.3 Crawling under pads (decided)

- **Clearance.** The WORM pad hovers `WORM_PAD_HEIGHT` (0.30) above a piece popped `WORM_PIECE_POP` (0.06), so its underside sits 0.36 over the crawl route. That clears the bare head (≈ 0.17), MOBI's (radius 0.12, top ≈ 0.20) and a tall hat (≈ 0.30).
- **Ghosting.** While the grounded head is within one cell of a pad, the pad ghosts to ~35 % opacity. This handles chase-camera occlusion and signals "you can pass under". It turns solid again when the worm is airborne, so solid means landable.
- **HUD.** `onFlippedTile` becomes `onPadAhead`, and the HUD shows "JUMP to ride" while a rideable pad is in assist range.

### 4.4 Knock-on rules

- **Void.** The thresholds are unchanged: 3 safe rides, and the 4th collapses mid-ride. The worn regime starts at $u = 3$, which is exactly $w = 3/4 \ge k^*$, so a pad warns you on precisely the ride that would kill you (§9.6). Pits (decided) keep the old contact lethality honest: a collapsed tunnel is a hole.
- **Active-tunnel cap.** Open pads no longer block crossings. `MAX_ACTIVE_TUNNEL_PAIRS` was halved to 10 because open holes "became terrain" that the player could not cross without falling in, so re-tune it upward after playtest.
- **Heals.** Economics are unchanged. On a heal, both pads settle home in a spring cascade, alongside the existing `cubiePops` burst.
- **Rotations.** Pads ride their layer. A cell whose contents are still turning into place is not enterable until the turn commits (existing rest-read rules).
- **MOBI's Create Wormhole.** Pops a pad under MOBI and rides it immediately, like an elevator. Same rules, new visual.
- **Specials, bombs, elementals.**
  - Pads never host pickups; spawn exclusion already treats mouths as occupied.
  - The elemental cube skin must follow the lifted sticker, not the slot. This is an integration note for `ElementalCubeSkin` and the Elemental plan in `CLAUDE.md`.
- **Story and demo.**
  - "Through the Looking Glass" becomes the jump-to-ride lesson.
  - Route tests that use "ordinary tunnel triggers" steer and jump instead.
  - The demo's WORM traversal and practice lessons get new prompts (§6.3).

## 5. The Rumbler: something under the tiles

### 5.1 Scope tiers

Decided 2026-09-26: R1 and R2 are in scope now; R3 comes later, after the §5.3 topology choice.

**R1 · Ambience** — ship first. No gameplay effect.

- A slow heave travels along the worm's lane (its row or column) and the cross line, approaching from behind.
- 2–4 tiles lift slightly at the crest, and a dark band runs through the grid channels.
- Dust puffs from the seams, with low rumble audio and light haptics when a crest passes under the head.

**R2 · Telegraph** — ship with R1, and keep the gold rim for accessibility. It adds no new rules: turn timing, the rim and the safe lane are unchanged.

- When a turn is armed, the Rumbler moves to the threatened slice and circles its belt in the turn direction.
- It gets faster and harder as `warningProgress` ramps.
- At dispatch it "drags" the layer round.

**R3 · Chaser** — new and opt-in: a flagged experiment plus one Story level.

- It follows the worm's trail along rows and columns at just under crawl speed.
- If it reaches the tail it nips one segment and drops a carried orb. It never kills.

### 5.2 Wave model

- **Belts.** Rows and columns are slice *belts*: straight walks of $4N$ cells across four faces (`getNextSurfacePosition` stays in one slice).
- **Wave.** A wave is a crest $s_0(t)$ travelling along a belt with profile $\delta(s) = a\,\mathrm{sech}^2((s-s_0)/\lambda)$.
- **Cost.** Only cells above a threshold are physically displaced: ≤ 8 on full boards, 0 on `big`. The rest of the wave is a cheap band shader in the style of `LayerHighlight`.
- **Placement.** Crests pick belts through the head cell (R1), the pending slice (R2) or the trail (R3). They follow the belt around edges rather than stopping at a face boundary.

### 5.3 Topology choice (decide before R3)

- **Cover Rumbler (recommended).**
  - It lives on the *inside* of the Flip Cube's surface. The sphere is two-sided even though WORM³ is not.
  - It cannot cross the Core. Riding a pad takes you where it isn't, so tunnels become escape hatches and pads matter more.
- **Quotient Rumbler (late-game twist).**
  - It lives in WORM³ itself, so on the cube it always appears as two opposite crests.
  - Tunnels cannot shake it, because in the quotient a ride does not move you at all (§9.5).
  - It would make a good Chapter 3 "Strange Views" surprise.

### 5.4 Fairness gates

The gates copy `strikeScheduler.js`:

- Never during countdown, pause, tunnel transit, death or victory, the elemental focus freeze, or a jump-rescue hold.
- Under reduced motion, show a static belt tint only.
- The model uses seeded randomness only.
- R1 and R2 write nothing to the sim.

## 6. Mobi, WORM³ and the Flip Cube

### 6.1 Premise: the lost cube (decided)

The Flip Cube slipped out of WORM³ and landed here scrambled, and something from its underside, the Rumbler, came along. Healing the Flip Cube keeps Mobi's way home open. That one reason ties together the heal loop in every mode, the Rumbler, and the story chapters. The alternative, Mobi as a visitor showing off his world, was set aside.

Beats the premise needs:

- **First run.** Mobi introduces himself, the Flip Cube, and the ask: help heal it.
- **Heals.** Each heal is a small step toward home. Mobi can react to one now and then, never to every heal.
- **Chapters.** Openers escalate toward the finale, in which the way home opens.
- **Solves and victories.** "The Flip Cube is whole again."
- **The Rumbler** is a stowaway, not a villain with a backstory. It is felt more than explained.

Recommended: in the finale, the way home stays *open*, and Mobi doesn't leave. That way the free modes keep their guide after the story ends.

### 6.2 Canon (player-facing words only)

- **WORM³.** Mobi's world. Every spot there has a twin straight through the middle, and the twins are the same place.
- **The Flip Cube.** A piece of WORM³ whose tiles are doors. Flip one and it pops up as a *flip pad*, and its tunnel runs straight through the middle to its twin. It slipped out of WORM³ and landed here scrambled; healing it keeps Mobi's way home open.
- **The Core.** The middle of the Flip Cube, the only spot that is its own twin. Every tunnel passes through it.
- **Worms.** WORM³ natives who ride tunnels.
- **The Rumbler.** Came along with the Flip Cube. Lives under the tiles and can't get through the Core (cover choice).
- **Mobi.** Multi Orientable Block Intelligence: a little block from WORM³ who can open doors (Create Wormhole).

### 6.3 Where Mobi says it (draft lines, house style)

Rules for these drafts:

- Short sentences.
- No "antipodal", "manifold", "parity" or "RP²"; the single existing `TWIN_ASIDE` stays the only exception.
- At most five cards per dialogue.
- **A line ships with the mechanic it describes, never before it.** Premise lines (who Mobi is, where the Flip Cube came from, healing it to keep the way home open) are true today and can ship in the copy pass at any time. Lines about popping pads, jumping to ride or the Rumbler wait for their phase. Until then, a line like "Flip one and they pop up together" becomes "Flip one and its twin flips too."

| Surface | File | Draft |
|---|---|---|
| First-run cold open | `MobiIntroScreen.jsx` `MOBI_LINES_DEMO_INTRO` | "Aloha! I'm Mobi. I'm from a world called WORM³." / "This is a Flip Cube. It slipped out of my world and landed here scrambled." / "Every tile has a twin straight through the middle. Flip one and they pop up together." / "Help me heal it, and my way home stays open." / "Try the controls one step at a time. You can skip any step." |
| WORM intro | `MOBI_LINES_WORM` | "Flipped tiles pop up as flip pads. Jump onto one to ride its tunnel." / "Carry orbs into a tunnel to heal it." / "Feel that rumble? Something's under the tiles. Keep moving!" |
| FLIP CUBE mode | `MOBI_LINES_FREEPLAY` | "Turn the Flip Cube until each face is one color." / "Turn on Flip to pop tiles through to their twins." |
| Chaos | `MOBI_LINES_CHAOS` | "The Flip Cube gets restless. Tiles pop and flip on their own." / "Wild bouncing means a tile is nearly worn out. Pick the pair you think will last." |
| Story openers | `worm/story` cards, `levels/data/story-descent.js` | Ch.1 "The Flip Cube landed scrambled. Let's heal it." · Ch.2 "In WORM³, Flip Cubes come in every size." · Ch.3 "WORM³ looks strange from the inside. Stay close." · Ch.4 "Almost home. The Rumbler knows it." |
| Loading tips | `LoadingScreen.jsx` | "Twins always bounce together. They're the same tile." · "A tile bouncing wildly is almost worn out." · "The Rumbler can't follow you through the Core." |
| Store | `ParityStoreScreen.jsx` | "Everything here was made in WORM³. Mostly." |
| Victory | `VictoryScreen.jsx` | "The Flip Cube is whole again. My way home is open!" |

### 6.4 Additions to `docs/COPY_STYLE.md`

- "Flip Cube" (Title Case) names the object everywhere.
- FLIP CUBE is also the solve mode's name: uppercase Bungee on its carousel plate and keys, "Flip Cube" in sentences. The shared name is deliberate. The mode is the Flip Cube on its own, while every other mode adds something to it.
- "flip pad" is a popped tile.
- "WORM³" is both the game and Mobi's world.
- "Twin" and "straight through the middle" remain the only words for the pairing.

## 7. The Flip Cube as the hero object (surface pass)

| Surface | Change |
|---|---|
| Intro | "flip through the cube" lands on a real pad pop. The title card holds on a bouncing pad while its funnel spins up. |
| Main menu | The carousel cube *is* the Flip Cube. Idle centre flips become pads with worms riding their funnels (`MenuFlipWave`, `MenuWormParticle`). Tapping the cube pops a pad, and PLAY dives through the active face's centre pad. |
| Loading | The levitating cube bounces one pad per load beat. |
| Mode name | **Shipped 2026-09-26.** CUBE is renamed FLIP CUBE on the carousel plate and Play key, the setup wizard, the help menu, the demo-end card and the "Solve or survive?" chooser. The two-word plate title steps down one font size to stay on one line. Internal ids (`freeplay`, `MODE_THEMES.cube`) are unchanged, so saves and play stats carry over. The same change fixed the setup wizard, which had been showing Teach's artwork for this mode. The Cube Academy lesson titles ("CUBE 1–6") name the course, not the mode, and stay. |
| In game | The same pad language in every mode (§3). |
| Victory | All pads settle home in a spring cascade, followed by one last symmetric pulse through the Core. |
| Store | Tile styles and palettes are presented as Flip Cube skins. |

## 8. Architecture

New modules, pure where possible so they are testable without a renderer:

- `src/game/flipPad.js`: state classification (§3.1), wear, regime (`K_STAR = 0.721`, documented as a design threshold), pair keys, and pair-symmetric reduction (§9.2). No React or THREE.
- `src/3d/padPose.js`: the motion model (§3.2) as numbers in, numbers out, plus spring helpers and a seeded LCG.
- `src/3d/padMotionBridge.js`: a module-level map like `tilePressBridge` and `stickerFlipMotion`, holding lift, velocity and impulse per surface key, with one writer per key.
- `src/3d/PadSprings.jsx`: instanced stalks plus slot mouths.
- `src/worm/healerWorm/padEntry.js`: the §4.1 truth table as a pure function consumed by `wormSim`.
- `src/worm/healerWorm/rumbler.js` + `RumbleField.jsx`: the wave scheduler (pure) and its renderer. Heave goes through a press-like bridge with a small tile cap.

Changed:

- **`3d/StickerPlane.jsx`**
  - The persistent-tremor block becomes the pad pose.
  - The flip animation keeps ownership during a flip, then hands off to the spring. The file already warns about colliding position writers, so keep a single writer.
  - Publish the pose to the bridge.
  - Take the cap from the same inputs as `selectEffectiveFlipCap` (the flip-cap rule in `CLAUDE.md`).
- **`manifold/tunnelAnchorMotion.js`, `MobiusTunnel.jsx`, `RestingCords.jsx`**: anchors stay at the slot; add the symmetric idle pulse and the lone-pad whip channel.
- **`utils/tunnelPath.js`**: an optional mouth lift, used only by the WORM route's handoff. Sim, body and camera all sample this one definition.
- **`worm/healerWorm/wormSim.js`, `worm/useWormCrawler.js`**: the `tunnelEntry` rule, the land, hop-up and launch beats, pits, and `onPadAhead`.
- **`worm/HealerWormMode.jsx`, `SliceWarningLights.jsx`**: the R2 telegraph.
- **`JumpLandingMarker.jsx`, `WormCrawlerHUD.jsx`, `TunnelNeedsCard.jsx`**: pad reticle, "JUMP to ride", and a wear readout.
- **`utils/feel.js`**: `padPop`, `padSettle`, `padLand`, `padLaunch` and `rumble(level)`.
- **Hero pass**: `MainMenu.jsx`, `MenuFlipWave.jsx`, and the intro and loading components.
- **Settings**:
  - `flipPads: 'full' | 'subtle' | 'off'`
  - `tunnelEntry`
  - `rumbler: 'off' | 'ambient' | 'full'`
  - Reduced motion forces static pads and turns the Rumbler off.

Budgets:

- No per-frame React state.
- Pads add no draw calls per tile, because flipped tiles already render outside the instanced batch.
- One draw call for all stalks, and one per Rumbler band.
- The ribbon rebuild rate is unchanged.
- The Rumbler displaces ≤ 8 tiles, and 0 on `big`.

## 9. Mathematical foundation (for the team)

### 9.1 Pads are the support of the residual

In the monograph's notation:

- $S$ is the set of sticker identities, $\beta$ the fixed-point-free pairing, and $\alpha$ the colour involution.
- The residual is $f(s) = [\mathrm{curr}(s) \ne \mathrm{orig}(s)]$.

The audited write paths all preserve $\mathrm{curr}(s) = \alpha^{n(s)}(\mathrm{orig}(s))$:

- flip and unflip (`manifoldLogic.js`);
- heal (`cubeState.healSticker`);
- turns;
- Chaos's flip and recover (`game/chaosSim.js`).

Hence a tile is a pad $\iff f(s)=1 \iff n(s)$ is odd. By Corollary 1, ordinary play keeps $f \in P_\beta = \ker\Delta$, so **pads always come in twin pairs**. A lone pad exists iff $\Delta(f) \ne 0$, which only a heal can create or remove (Theorem 3.4).

### 9.2 Twin synchrony is the P₊ projection

Let $\beta^*$ act on per-sticker fields $h \in \mathbb{R}^S$ by $(\beta^*h)(s) = h(\beta s)$. It is an orthogonal involution, so $P_\pm = \tfrac12(I \pm \beta^*)$ are complementary orthogonal projectors.

- **Rule.** Build every pad quantity (lift, phase, wear) from pair data, that is, from $P_+$ of the per-tile inputs.
- **Why it is safe.** Any **linear** pose operator $V$ with $[V,\beta^*]=0$ preserves both eigenspaces. A nonlinear equivariant operator preserves the symmetric fixed-point space but does not generally preserve the antisymmetric space; reduce the inputs with $P_+$ before evaluating nonlinear motion. The symmetric block (motion) and the antisymmetric block (asymmetry) are therefore independent and can be rendered separately.
- **Lone pads.** The lone-pad whip is driven by $P_-$ alone.

For the binary field $h = f$, with $b$ symmetric dirty pairs and $a = \mathrm{wt}(\Delta f)$ lone pads:

$$\alpha_- = \frac{\|P_-f\|^2}{\|f\|^2} = \frac{a/2}{2b+a} = \frac{\mathrm{wt}(\Delta f)}{2\,\mathrm{wt}(f)} \in \left[0, \tfrac12\right].$$

At $f=0$ the displayed ratio is undefined; the implementation uses the explicit UI convention $\alpha_-=0$ for the solved board. For $f\ne0$, the asymmetric energy fraction is exactly the minimal heal count of Theorem 3.4, normalised by the size of the dirty set. $\alpha_- = 0$ throughout ordinary play, and $\alpha_+ = 1 - \alpha_- \ge \tfrac12$ always.

### 9.3 Outward bounce is the equivariant motion

Let $A(p) = -p$, with outward normals $\nu(-p) = -\nu(p)$. Act on displacement fields by $(Sv)(p) = dA\,v(Ap)$.

- **In phase.** $v(p) = h(t)\,\nu(p)$ gives $(Sv)(p) = -h\,\nu(-p) = v(p)$. This is the $+1$ eigenspace, so it commutes with the deck transformation and descends to $\mathbb{RP}^2$.
- **Anti-phase.** Twins moving in anti-phase give $Sv = -v$. That field is not the motion of a single point of $\mathbb{RP}^2$.

In-phase normal displacement is required **if the animation is to descend through this antipodal identification**. Choosing to impose that quotient interpretation is the design assumption.

### 9.4 Why the funnel has a half-twist, and what it cannot be

- **The ride is the generator.** Treat a ride as the identification $p \sim -p$. Any surface path from $p$ to $-p$ projects to the generator of $\pi_1(\mathbb{RP}^2) \cong \mathbb{Z}/2$, because its lift is open. The tunnel is the game's shortcut for that path.
- **One ride mirrors, two restore.** $A$ has degree $-1$ on $S^2$, so the orientation character $w_1$ is non-trivial on that loop. One ride mirrors the rider's handedness relative to the outward normal, and two rides restore it. The existing control modes decide whether the player feels this.
- **The half-twist is forced.** The normal bundle of a projective line in $\mathbb{RP}^2$ is the tautological (Möbius) bundle, so a ribbon representing that normal bundle has a half-twist. A decorative ribbon along a diameter inside the cube is not automatically that bundle; the game deliberately uses it as a visual representation.
- **Its handedness is not.** For the idealised straight diameter:
  - $A$ reverses orientation on $\mathbb{R}^3$ ($\det(-I) = -1$) and so negates twist.
  - An $A$-invariant strip would therefore need $\mathrm{Tw} = -\mathrm{Tw} = 0$.
  - But end frames that are negatives of each other need $\mathrm{Tw} \equiv \pi \pmod{2\pi}$.
  - So no half-twisted ribbon is $A$-invariant as a set, and "symmetric pulse" in §3.3 means symmetric in timing and intensity, not in geometry.

### 9.5 The Core is the cone point; rides don't move you in RP²

- **The Core.** $A$ fixes only the centre of $D^3$, and $D^3/\{\pm1\} \cong \mathrm{Cone}(\mathbb{RP}^2)$ is singular exactly there. That makes the Core the "spot that is its own twin" (§6.2) and the natural barrier for a Rumbler living on the cover.
- **Rides.** A ride takes $p$ to $-p$, which is the same point of $\mathbb{RP}^2$. With the quotient metric $d([p],[q]) = \min(d(p,q), d(p,-q))$, an entity on the quotient keeps its distance to the worm under rides; this is the "Quotient Rumbler" of §5.3. On the cube it appears as two crests related by $A$.
- **Middle belt.** On an odd board the middle belt is $A$-invariant with a half-turn shift ($s \mapsto s + 2N$). An equivariant heave on it must therefore be $2N$-periodic.

### 9.6 Where k* ≈ 0.721 sits

Wear only takes lattice values on pads ($n$ odd):

| Cap / mode | Pad wear values | Worn regime ($w \ge k^*$) | Lives left there |
|---|---|---|---|
| WORM, $U = 3$ | 0, .25, .50, .75 | $u = 3$ | next ride is lethal |
| $C = 3$ | .33 | none: the warning lives on the home tile $n = 2$ | — |
| $C = 6$ (standard) | .17, .50, .83 | $n = 5$ | 1 |
| $C = 8$ | .13, .38, .63, .88 | $n = 7$ | 1 |
| $C = 13$ | … .69, .85 | $n = 11$ | 2 |
| $C = 20$ | … .75, .85, .95 | $n \ge 15$ | ≤ 5 |

For WORM and for $C \in \{6, 8\}$, the boundary lands exactly on the lethal-next-ride or last-life state. For larger caps it marks roughly the last quarter of a tile's life (remaining lives $r \le (1-k^*)\,C \approx 0.28\,C$). At $C = 6$ it also coincides with the 4× tier of `getHalfLifeMultiplier`.

That makes it a good *design* threshold, but it is an artifact of the lattice $n/C$, not an MDL result for this game. Before claiming more:

- Add the fallback "or one life left", so every cap warns. *Shipped as `padIsWorn`.* With $w = n/C$ it adds a case only when $1 - 1/C < k^*$, i.e. $C \le 3$, where it marks the home tile $n = 2$.
- Validate the boundary as a *perceptual* one with telemetry: do players stop riding or flipping pads above it?

### 9.7 Gaps in the request and the bridges they need

1. **Flip count in WORM is constant.** Tunnels are born at $n = 1$ and heal to 0. "Bounce by flips" therefore needs the ride count (§3.1) or a change to heal semantics.
2. **"Explode" is radial and moves whole cubies.**
   - `cubiePops` and Explode push whole cubies radially away from the cube's centre. For edge and corner cubies that direction is diagonal, and it drags unflipped stickers on other faces along.
   - In WORM it would also move the surface under the worm.
   - **User decision, 2026-09-26:** this whole-piece movement is intended. Keep the small normal pad too. Raise only cubies with at least one live flipped face. A carried unflipped face is a platform, not a tunnel.
   - WORM rendering is enabled with sampled platform jumps and expanded tunnel handoffs. Idle pad bounce stays disabled in WORM so the physical landing surface is stable. Platform jumps target the actual expanded height, clear the underside and ledge, and share their two-cell aim window with the camera. Raised WORM pairs automatically show the full Möbius bands regardless of the cosmetic tunnel-view toggle.
3. **"Jump to ride" inverts the risk model.** The void rule, the tunnel cap, Story route tests and demo lessons all assume automatic entry; that is why the change ships behind a flag.
4. **"Under the tiles" does not exist in RP².** $\mathbb{RP}^2$ is one-sided. An underside exists only on the double cover (the sphere is two-sided), which is why §5.3 is a real choice.
5. **Rows and columns are belts, not face lines.** A wave that stops at a face edge breaks the illusion.
6. **Chaos density.** Dozens of full-height pads turn the cube into a porcupine; hence the profiles and budgets.

## 10. Roadmap

| Phase | Scope | Done when |
|---|---|---|
| 0 | Decide §13: six settled and the rename shipped (2026-09-26). Still to do: capture reference screenshots and frame times for 3×3, 5×5, 7×7 and Mega, in Classic, Chaos L5 and WORM. | Remaining §13 defaults confirmed or changed; reference captures stored. |
| 1 | `flipPad.js`, `padPose.js`, `padEntry.js` and their tests. | Truth table, regime table, twin-phase equality, bounds, determinism and reduced motion all pinned. |
| 2 | Cube-mode pads, `PadSprings`, symmetric pulses, menu pads. | §3 holds in every cube mode; perf within budget; existing tunnel and flip tests green. |
| 3 | Mobi and WORM³ copy pass (can run in parallel with 2). | Copy tests updated; `COPY_STYLE.md` updated. |
| 4 | WORM `tunnelEntry: 'pad'`, beats, HUD, Story and demo updates; switch the default after playtest. | Sim tests parameterised over both rules; Story route tests pass using jumps. |
| 5 | Rumbler R1 + R2. | No sim writes; gates tested with a fake clock; Mega budget holds. |
| 6 | Hero passes: intro, loading, victory. | Bundle budgets hold (the intro CSS is at its ceiling). |
| 7 | R3 chaser experiment; telemetry for the k* boundary. | Behind a flag; one Story level. |

## 11. Tests

**New, pure:**

- `flipPad.test.js`
  - States, including lone, locked and pit.
  - Wear for $C \in \{3, 6, 8, 13, 20\}$ and WORM.
  - The k* boundary.
  - Pair reduction and the $\alpha_-$ closed form.
- `padPose.test.js`
  - Twin phases are equal.
  - In the WORM profile the lowest point is ≥ clearance.
  - Worn hops stay between hover and full amplitude, and the beat never runs backwards, including during the ease.
  - Regime switch, seeded determinism, and reduced motion = static.
  - The whole-piece spring peaks within 1 % across 30, 60 and 144 fps and comes exactly to rest.
- `padEntry.test.js`: the §4.1 table, row by row.
- `rumbler.test.js`
  - A belt walk covers $4N$ cells.
  - Gates, determinism, and zero sim writes.

**Existing, to update:**

- `wormSim.test.js`: parameterise "enters windup when fully stepping onto a flipped tile" and "deliberately dives…" over both rules.
- `wormJumpRescueFlow`: the rescue hop never enters a pad.
- `wormStoryFlow` / `wormStoryChapters`: the tunnel trial is completed by jumping.
- `wormBodyTunnelStream` / `tunnelTrail`: handoff length with a pad.
- `cubeTunnelAnchorRender`: anchors stay at the slot.
- `parityBlink`: composes with the pad lift.
- Demo practice tests.

**Manual:**

- Overview and chase cameras.
- Every character and hat passing under a pad.
- Slice turns carrying pads.
- Explode view and reduced motion.
- Phone profiling on 7×7 and Mega.

## 12. Risks

- **Pads blocking the chase camera.** Mitigated by the ghosting rule; verify in playtest.
- **Visual noise in Chaos.** Use the subtle profile; the worn regime carries the signal.
- **Motion sickness.** Reduced motion, plus `flipPads: 'subtle'`.
- **Test churn from the entry-rule change.** The flag, plus parameterised tests.
- **The intro bundle ceiling**, which recent commits had to fight. Keep pad code out of the intro chunk, or reuse only the pure pose.
- **Wireframe and mirror views draw no stickers.** Pads have nothing to lift there and fall back to today's edge and colour cues.

## 13. Decisions

### Decided (2026-09-26)

1. **Premise:** B, the lost cube (§6.1).
2. **Crawling into a pad's cell:** the worm passes under it (§4.3).
3. **Voided tunnels:** lethal pits (§4.4).
4. **Rumbler scope:** R1 + R2 now, R3 later (§5.1).
5. **Mode name:** CUBE is renamed FLIP CUBE. Shipped (§7).
6. **Persistent state:** whole-cubie Explode position, plus the small square pad. Carried unflipped faces are ordinary platforms. Stalk color is the visible tile’s antipodal back color.

### Still open (the default stands until you say otherwise)

2. Wear reads as **bigger and faster** (matches today's tremor), or as "tired and lower"?
3. For R3, the **cover** topology or the quotient one (§5.3)? Needed before R3 starts.
4. Names: keep "flip pad", "the Rumbler" and "the Core", or rename?
5. Landing-assist window: **pad 0–2 tiles ahead** (implemented; includes an airborne correction press).
6. Chaos pads: **subtle**, or full height?
