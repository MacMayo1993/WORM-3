# WORM³ — World of Rubik's Manifolds

**Don't just think outside the box, flip through the cube.**

WORM³ combines a twistable 3D cube, antipodal tile flips, and a real-time worm game on the same changing surface. Turn a layer to move pieces, flip a tile and its linked partner, jump onto a raised wormhole, crawl through the cube, and heal the route behind you. The cube is both the puzzle and the level.

The project includes arcade survival, a 40-level WORM campaign, cube puzzles, a guided solving course, Chaos prediction rounds, a constantly remixing visual mode, and an unlockable collection of characters and cosmetics. It runs in the browser with mouse, keyboard, and touch controls.

[Play WORM³](https://macmayo1993.github.io/WORM-3/)

## Contents

- [What makes WORM different](#what-makes-worm-different)
- [The cube, antipodal flips, and topology](#the-cube-antipodal-flips-and-topology)
- [Mode guide](#mode-guide)
- [WORM movement, healing, and survival](#worm-movement-healing-and-survival)
- [Powers and elemental effects](#powers-and-elemental-effects)
- [Playable worms and signature abilities](#playable-worms-and-signature-abilities)
- [WORM Story: all 40 levels](#worm-story-all-40-levels)
- [Cube campaigns, daily puzzles, and teaching](#cube-campaigns-daily-puzzles-and-teaching)
- [Chaos and Disparity](#chaos-and-disparity)
- [Progression, missions, and the store](#progression-missions-and-the-store)
- [Views, tile styles, and world presentation](#views-tile-styles-and-world-presentation)
- [Controls and capture mode](#controls-and-capture-mode)
- [Architecture and source map](#architecture-and-source-map)
- [Local development and validation](#local-development-and-validation)
- [Feature status and reference material](#feature-status-and-reference-material)
- [License](#license)

## What makes WORM different

- **A cube that is also traversable terrain.** The worm crawls over all six faces, rounds edges, jumps over its own body, and crosses through linked tiles. Layer rotations change the route during play.
- **Two ways to change a puzzle.** A turn moves sticker identities; an antipodal flip changes the displayed color of two linked identities without moving their pieces. Solving can require both.
- **Raised, usable wormholes.** A flipped tile can lift its whole cubie away from the surface. The opening has warning tape, an antipodal-colored connection, and a visible tunnel; the raised piece is a platform the worm can reach.
- **A body that doubles as inventory.** Collecting colored orbs grows the worm. Spending them to heal a tunnel shortens it, so carrying more healing resources also makes route planning harder.
- **Healing through movement.** Feed matching orbs into a tunnel, or surround its opening with the body. Encircling a bomb reuses that spatial skill to disarm it.
- **Physical consequences for moving ground.** A layer can carry the worm, separate its body, or cause a fatal collision. Tunnel trails and tail cuts follow the worm's actual path.
- **Characters with different rules.** MOBI creates a wormhole, Prism spends any orb color on healing, Book pauses layer turns, and other worms attract orbs, spring forward, paint trails, or sweep their tails.
- **A shared visual language.** Palettes, procedural tile materials, interior tile backs, tunnel surfaces, and elemental effects reinforce the same face identities. Random mode remixes the appearance while the underlying puzzle remains intact.
- **Mathematics that becomes gameplay.** Persistent antipodal pairings support traversal, parity diagnostics, and short turn-plus-flip puzzles with solver-verified move targets.

## The cube, antipodal flips, and topology

### Turns, colors, and paired identity

A cube of size `N` has `6N²` exterior stickers and `3N²` antipodal sticker pairs. The standard palette uses these relationships:

| Face pair | Standard colors | Home directions |
| --- | --- | --- |
| Front ↔ Back | Red ↔ Orange | `PZ` ↔ `NZ` |
| Left ↔ Right | Green ↔ Blue | `NX` ↔ `PX` |
| Top ↔ Bottom | White ↔ Yellow | `PY` ↔ `NY` |

Custom palettes change the appearance of these IDs, not their pairing.

**Turns** permute pieces and carry their sticker identities with them. **Flips** toggle a sticker's color to its antipodal partner and simultaneously toggle its paired sticker. A flip is atomic: both members change or neither does. The pairing follows original sticker identity through layer turns, so after a scramble the partner need not be directly opposite the tile's current world-space position. The tunnel connects the pair's current locations.

Every sticker retains its original identity, current color, and flip count. Color parity and accumulated wear are different: flipping twice restores a color but still adds two flips to its history. Undo/unflip logic is distinct from spending another flip. Chaos uses the accumulated count to determine when a tile is spent.

### RP² inspiration

The topological model is inspired by identifying antipodal points on a sphere, `S² / (x ~ −x)`, which gives the real projective plane, RP². The cube surface supplies a discrete representation of those pairings. Möbius bands, the central cubelet, and through-cube passages make the orientation change visible.

These are game rules and visual representations of the identification. A tunnel mesh is not a literal embedding of the whole projective plane, and the different win conditions should not be conflated with one mathematical quotient condition.

### Puzzle rules and diagnostics

| Rule or tool | Meaning |
| --- | --- |
| **Classic color solve** | Restore the required face colors. The normal cube win check accepts equivalent whole-cube orientations for even-sized cubes, which have no fixed centers. |
| **Sudokube** | Each face contains every value from `1` through `N²` exactly once. Values belong to sticker identities and move with them. This is a complete-number-set rule, not row-and-column Sudoku. |
| **Ultimate** | Satisfy the color and Sudokube conditions together. |
| **WORM³ puzzle condition** | The cube is color-solved and every exterior sticker has been flipped at least once. This engine condition is separate from winning an arcade WORM run. |
| **Antipodal engine** | Classifies pairs as clean, symmetrically flipped, or asymmetric; exposes disagreement and completion plans for the supported algebraic model. |

The free-play wizard primarily configures a Classic cube. Other rules are used by the level/engine systems; a **Numbers/Sudoku visual skin alone does not change the victory rule**. Likewise, an antipodal-color-class check in the engine is not a promise that every playable puzzle accepts either color of a pair.

## Mode guide

The main cube carousel has six destinations: **WORM, FLIP CUBE, TEACH, CHAOS, RANDOM, and STORE**. Campaigns, practice, and exploratory views provide additional ways to use the same systems.

| Mode or destination | How it plays | Current scope |
| --- | --- | --- |
| **WORM — Free Play** | Collect orbs, survive changing terrain, traverse and heal wormholes, and restore the cube. | Sizes **2×2 through 10×10**, plus **15×15 Mega**; Easy, Medium, and Hard presets; optional portal enemies. |
| **WORM — Story** | Complete timed objectives introducing movement, healing, powers, enemies, and unusual worlds. | **40 levels in four chapters**, with stars and rewards. |
| **WORM — guided practice** | Learn steering, jumps, tunnel travel, healing, and related actions through the introduction's practice sequence. | Scripted teaching targets rather than a normal free-play run. |
| **Portal Combat (preview)** | Survive three enemy waves or seal the portal; shoot parity projectiles and use elemental attacks. | WORM setup option; a **5×5** arena with no rotating slices. |
| **FLIP CUBE** | A customizable cube puzzle with turns, antipodal flips, shuffle/reset/undo, and optional views or overlays. | Sizes **2×2 through 10×10**. |
| **TEACH** | Learn a beginner 3×3 solution through notation, highlighted moves, guided practice, and a full solve. | Dedicated course plus in-game teaching/algorithm tools. |
| **Cube puzzle packs** | Complete cube challenges with move targets and progress tracking. | Topological Descent, Cube Academy, Algorithm Codex, and Daily Descent. |
| **CHAOS / Disparity** | Start a flip cascade, predict the surviving colors, heal tiles, and watch the board collapse to a winning pair. | Five intensities; current setup/launch logic limits boards to **2×2–5×5**. |
| **RANDOM** | Solve a cube whose palette, face materials, and per-piece views remix every ten seconds. | Sizes **2×2 through 10×10**; also a visual setting and part of later WORM Story levels. |
| **Biome Mode** | Solve a cube with themed surfaces and per-face biome/city presentation. Flips exchange a tile's biome identity with its antipodal partner. | Playable through the additional-modes screen. |
| **Möbius Cubelet** | Orbit a cubelet and inspect the three bands joining opposite face pairs. | Interactive viewer with pair selection and discovery progress. |
| **STORE** | Preview, unlock, and equip palettes, tile styles, characters, skins, hats, accessories, and trails; open Cubie Chests. | A collection/progression destination rather than a game board. |

Size notation gives tiles per face edge: a 6×6 cube has six 6×6 faces. Mega is a dedicated 15×15 option, not an 11–15 slider range. Some menu summaries still advertise larger Chaos boards; the active Chaos launch normalizer is the authority for its present limit.

## WORM movement, healing, and survival

### The ordinary run

Free Play opens with a cube scramble and a countdown. The worm moves continuously; steering chooses its route across the six faces. During the active phase, warned layer turns work back through the scramble while new wormholes and hazards keep the route changing. Once the turn sequence is complete, the run enters **final healing**: new wormholes stop spawning and the player closes the remaining routes to restore the cube.

Story levels use their own objectives, clocks, and repeating turn schedules. Portal Combat uses its own wave ending. Those runs do not inherit the ordinary free-play victory condition.

Difficulty changes crawl speed, orb supply, and wormhole frequency together. Orb density scales with board size and is capped, keeping larger cubes playable without filling every tile with pickups.

### Movement and the living body

- **Surface crawling:** heading remaps as the worm rounds a cube edge. The body follows its recorded path across faces instead of drawing a straight line through the cube.
- **Jump and double jump:** jump over the body, clear dangerous ground, and reach raised cubies. A second jump extends an airborne maneuver. Landing and clearance matter; an empty jump does not satisfy a Story objective requiring a body crossing.
- **Boost:** a short, rechargeable speed burst creates another timing choice. Jump distance is controlled separately from normal crawl speed.
- **Self-collision and rescue:** occupied body tiles constrain the route. A brief jump-rescue opportunity is available for eligible collisions when that assist is enabled; it is not universal invulnerability.
- **Layer turns:** warnings identify an upcoming rotation. The moving layer can transport supported parts of the worm, while a body crossing its boundary can be severed. A fatal head hit ends the run; a survivable tail cut removes the severed portion and reduces carried resources.
- **Impact presentation:** camera focus, cut effects, and death/retry screens make the location and consequence of a collision visible.

### Raised portals and continuous tunnel travel

A flipped sticker marks an active wormhole. The containing cubie rises, with caution tape at the original surface opening. An antipodal-colored stalk and band connect the raised mouth to the interior route. An unflipped face on that raised cubie can still be a landing surface without becoming a tunnel entrance.

Jump onto the raised entrance and use the contextual jump/dive action to enter. The worm winds into the mouth, travels through the cube, and winds out at the partner's current location. The head and body animate along the route; the tail can remain inside after the head has resumed crawling. Healing and Story completion account for tail clearance instead of instantly erasing the passage.

The tunnel presentation includes a central cubelet/core with paired entry and exit treatment. Tunnel bands, raised connections, and inward-facing sticker backs can use the selected tile materials as well as the corresponding face colors. Explosion and rotation update their positions with the board.

### Orbs, inventory, and healing

Colored **parity orbs** are physical pickups and healing resources. Each pickup adds three visual body segments; the base worm has four. Inventory records carried colors. These run resources are distinct from the spendable **Parity Points** wallet and from permanent XP.

| Healing method | What the player does | Consequence |
| --- | --- | --- |
| **Tunnel deposit** | Enter carrying orbs matching the entry sticker's current color. | Deposit up to the outstanding cost, shorten the worm, and heal a funded pair through the traversal/exit lifecycle. Partial deposits remain recorded. |
| **Body surround / ring heal** | Occupy the ring around a tunnel mouth with the body. | Seal the pair through spatial coverage, with a healing pause/effect as feedback. |

The standard deposit cost is **four body segments**, so a fresh tunnel ordinarily needs resources from **two orb pickups**. The HUD reports what is still needed. Prism's passive makes every orb color eligible, consuming the matching color first and then other carried colors.

Unhealed tunnels are not unlimited shortcuts: the normal rule allows **three safe traversals**. A fourth pass arms a collapse at the interior midpoint; a fully voided route is lethal. Read remaining passes and healing status before committing. Lessons and authored challenges can control these mechanics for their objectives.

### Bombs and portal enemies

**Bombs** have visible fuses and send a cross-shaped blast along the surface, wrapping across face edges. A head caught in a blast can die; a body hit can cut the tail. Surrounding the bomb with the worm's body disarms it. Airborne clearance, rocket protection, and fire-treated ground provide further ways to manage the blast.

**Portal enemies** can be enabled in normal Free Play. Crawlers, faster Dashers, and Armored Crawlers emerge into the run. Steer to aim and hold Fire to use parity shots from a three-shot rechargeable magazine. The aim assist selects enemies in a narrow forward cone on the current face; shots stay on that face instead of passing through the cube. Enemies navigate across surface edges. A three-shield health readout tracks combat damage, and elemental pickups modify attacks.

**Portal Combat (preview)** concentrates these mechanics into three authored waves on a fixed 5×5 cube. Win by clearing the waves or sealing the portal. It disables ordinary solving rotations and the bomb schedule. Story stages can instead request specific enemy defeats or bomb disarms within a broader objective.

## Powers and elemental effects

Power pickups produce a temporary change with a visible activation, timer, and expiry. Elemental and view-changing orbs require direct collection on their marked tile; the magnet does not collect an elemental orb from nearby.

### Movement and cube powers

| Power | Effect |
| --- | --- |
| **Rocket** | Fly above the cube for six seconds, steer the landing, and remain protected from collisions and wormhole entry during flight. |
| **Magnet** | For eight seconds, attract ordinary orbs within two surface steps, including around face edges. |
| **Explode** | Separate cubies and open gaps for a 12-second play window, then close smoothly. Timing accounts for jumps, turns, and tunnel exits. This differs from a single flipped cubie rising. |
| **View powers** | Transform the cube into Classic, Grid, Sudoku, Wireframe, Glass, Chrome, Neon, Gap, or LEGO presentation for 20 seconds, then restore its prior view. |

### Five elements

Each element changes the worm/cube presentation with its own materials, atmosphere, particles, and pickup feedback. Several also change surface movement. In combat, the same element has a projectile effect.

| Element | Surface-play identity | Combat effect |
| --- | --- | --- |
| **Water** | Build up to 25% extra speed on straight routes; turning sheds momentum. Water surfaces and bubbles mark activation. | Push enemies back. |
| **Fire** | Leave three-second hot trails that accelerate bomb fuses and protect their covered tiles from blast damage. | Burn armor. |
| **Nature / Grass** | Land to grow an eight-second spring pad; jumping from it produces a longer, higher leap. | Root enemies in place. |
| **Ice** | Slide to the next tile before turning; jumping restores immediate steering. | Freeze crawlers. |
| **Lightning** | Electrify cube seams and surround the worm with current and timed strikes. | Chain attacks to nearby enemies. |

Offerings rotate through available elements, and taking one resolves that offering. Timed appearances, replacement, pause behavior, and effects quality are managed separately from underlying face identity. Story distinguishes **collecting** an element from **mastering/using** its mechanic where the objective requires it.

## Playable worms and signature abilities

Characters have different silhouettes, faces, body animation, and signature behavior. The profile combines a character with owned skins, hats, accessories, and trails. Catalog stat bars communicate character identity; these concrete abilities describe their gameplay differences.

| Character | Identity | Signature and passive behavior |
| --- | --- | --- |
| **MOBI** | Multi Orientable Block Intelligence; transparent block-bodied intelligence unit. | **Create Wormhole:** open a tunnel beneath the worm without spending orbs. Re-entry is locked for ten seconds; heal that pair before creating another. |
| **Classic** | Original rounded Ranger. | **Orb Call:** attract nearby parity orbs for six seconds, with a 20-second cooldown. Also spawns 50% more orbs, subject to supply limits. |
| **Inch Worm** | Ribbed caterpillar / Brute. | **Spring Loaded:** charge and spring forward in a long jump. Landing must be clear; cooldown is 24 seconds. |
| **Glow Worm** | Bioluminescent Scout. | **Light Trail:** paint for eight seconds; the trail remains another twelve seconds. Enemies glow more brightly. Cooldown is 22 seconds. |
| **Book Worm** | Gilded pages, spectacles, and a Sage identity. | **Time Out:** pause layer turns for five seconds, with a 30-second cooldown. Earn 25% more XP. |
| **Wiggle Worm** | Flexible sidewinder / Dancer. | **Tail Wipers:** sweep three tiles left and right twice to collect orbs. Steering locks during the sweep; cooldown is twelve seconds. |
| **Prism Worm** | Faceted crystal Trickster. | **Spectrum:** an always-active wildcard healing rule. Any carried orb color can fund any tunnel; no activation cooldown. |

Abilities require an eligible surface state and respect pauses, airborne actions, live turns, transit, and individual restrictions. The signature control shows availability and the reason an action must wait.

## WORM Story: all 40 levels

WORM Story is a separate action campaign from the cube puzzle packs. Four ten-level chapters have linear unlocks. Each level supplies a preflight checklist, live objectives, a time limit, a target time, and an authored scene.

Chapter 1 uses **6×6 boards with classic solid-color tiles** throughout, letting players learn the mechanics before decorative surfaces become part of the challenge. Ordinary orbs replenish during the stages. Later chapters introduce sizes, materials, views, powers, and combinations of objectives.

| Chapter | Levels | Focus |
| --- | --- | --- |
| **Hatchling** | 1–10 | Crawl, collect, cross tunnels, jump the body, survive turns, heal, use powers, and fight. |
| **Every Size** | 11–20 | Pocket cubes through 8×8; numbered, glass, chrome, and neon views; explosion and flight. |
| **Strange Views** | 21–30 | Hollow frames, wireframe, bricks, biome faces, the far-side window, and Random remixing. |
| **Grand Crawl** | 31–40 | 9×9, 10×10, and 15×15 terrain; combinations of traversal, powers, combat, and restoration. |

### Level catalog

These summaries describe the main skill; the in-game checklist gives exact counts and completion requirements.

| # | Level | Size | Main challenge |
| --- | --- | --- | --- |
| 1 | First Crawl | 6×6 | Collect 18 orbs and all six colors. |
| 2 | Through the Looking Glass | 6×6 | Traverse four different pairs and clear the tail. |
| 3 | Clear Your Tail | 6×6 | Land four body jumps and collect orbs. |
| 4 | Moving Ground | 6×6 | Collect orbs while surviving six turns. |
| 5 | Color Collector | 6×6 | Collect every color and heal four pairs while layers turn. |
| 6 | Restore the Cube | 6×6 | Six pair heals, orb collection, and six turns. |
| 7 | Full Throttle | 6×6 | Boost, double jump, rocket, magnet, and heal. |
| 8 | Force of Nature | 6×6 | Collect two elemental orbs and restore three pairs. |
| 9 | Under Siege | 6×6 | Ring heal, use signatures, disarm a bomb, and defeat an enemy. |
| 10 | Worm Ascendant | 6×6 | Four goals: 24 orbs, three pair heals, four turns, one enemy. |
| 11 | Pocket Crawl | 2×2 | Collect all six colors on the smallest board. |
| 12 | Grid Lines | 3×3 | Cross three pairs in Grid view. |
| 13 | Numbers Underfoot | 4×4 | Jump the body on numbered tiles. |
| 14 | Glass Carousel | 3×3 | Collect orbs and survive five turns on glass. |
| 15 | Chrome Works | 6×6 | Collect colors and heal on a chrome cube. |
| 16 | Sea of Seven | 7×7 | Restore pairs and survive turns on reef-colored terrain. |
| 17 | Launch Pad | 4×4 | Boost, double jump, and land a rocket flight. |
| 18 | Blast Radius | 6×6 | Ride out two Explode powers while collecting and healing. |
| 19 | Neon Arcade | 8×8 | Cross six different tunnel pairs. |
| 20 | Size Summit | 8×8 | Explosion, flight, magnet, elements, and a signature. |
| 21 | Hollow Hills | 5×5 | Collect every color on an open-frame cube. |
| 22 | Ghost Frame | 5×5 | Navigate four pairs in Wireframe view. |
| 23 | Brick by Brick | 4×4 | Land body jumps on a toy-brick cube. |
| 24 | Biome Crossing | 6×6 | Collect three elements and heal across biome-styled faces. |
| 25 | The Far Side | 5×5 | Restore pairs with the opposite-face window available. |
| 26 | Remix | 5×5 | Collect and survive while Random changes the appearance. |
| 27 | Neon Storm | 6×6 | Master water, fire, and nature. |
| 28 | Shatterglass | 7×7 | Combine glass, explosion, and rocket flight. |
| 29 | Number Siege | 7×7 | Ring healing, signatures, bombs, and enemies on numbered tiles. |
| 30 | Kaleidoscope | 6×6 | Element mastery, explosion, jumps, magnet, and Random. |
| 31 | Nine Lives | 9×9 | Collect 36 orbs and every color. |
| 32 | Tenfold Tunnels | 10×10 | Cross six different pairs on a large board. |
| 33 | Knife Edge | 2×2 | Survive repeated turns on a pocket cube in Gap view. |
| 34 | Chrome Gauntlet | 9×9 | Restore six pairs through repeated turns. |
| 35 | Hollow Siege | 8×8 | Fight, disarm, and ring-heal on an open frame. |
| 36 | Ghost Storm | 6×6 | Collect four elemental powers in Wireframe view. |
| 37 | Brick Blast | 10×10 | Three explosions and two rocket landings. |
| 38 | Mirror Numbers | 7×7 | Restore six pairs with numbers and the far-side window. |
| 39 | Mega Crawl | 15×15 | Collect 40 orbs and every color on the largest board. |
| 40 | Worm Eternal | 10×10 | All five elements, movement powers, signatures, combat, and full restoration in Random mode. |

A valid clear awards one star, finishing at or below the target time adds one, and completing without a cut adds one: **up to three stars**. Required landings, settled rotations, and tail clearance are part of completion. Some mastery stages require ring-heal/signature tasks before ordinary deposits can finish sealing the remaining tunnels.

Rewards include Parity Points and choices of hats, palettes, skins, trails, or accessories. Chapter appearances are temporary; owned and equipped cosmetics are tracked separately from the level's borrowed setup.

## Cube campaigns, daily puzzles, and teaching

### Puzzle packs

| Pack | Content | Distinctive feature |
| --- | --- | --- |
| **Topological Descent** | Twelve chapters from First Reflection to Singularity, using 2×2, 3×3, and 4×4 cubes. | Short puzzles mixing turns and paired flips, with move targets computed for the actual puzzle. |
| **Cube Academy** | Six lessons: a middle layer, through-cube connections, first flips, paired flips, a guided mini-solve, and graduation. | A focused introduction to the cube's interactions. |
| **Algorithm Codex** | Ten 3×3 algorithm challenges, including Sune, Anti-Sune, Niklas, U-Perm, T-Perm, J-Perm, and Superflip. | Practice recognizable move sequences in authored cube states. |
| **Daily Descent** | A date-seeded 3×3 turn-and-flip puzzle, with local records, stars, and streaks. | The same date key gives the same puzzle; current generated pars are three to five moves. |

The mixed-move par solver minimizes **turns + finishing flips**. It searches turn sequences and evaluates the remaining paired flips at each candidate arrangement, rather than assuming the original scramble length is optimal. The algebraic flip-only decoder is a related tool with different assumptions; its formula is not substituted for the complete mixed-move puzzle cost.

The former **Life Journey** campaign definitions remain as legacy content. They are not the active Topological Descent pack and are not the 40-level WORM Story campaign.

### TEACH and Solve

The dedicated TEACH course contains twelve focused lessons plus a full-solve exercise. It starts with notation and reverse/double turns, then covers the white cross, corner insertion, middle-layer edges, yellow cross, yellow corner orientation, and final piece positioning. The cube, highlighted layer, and expected move advance together.

The teaching/algorithm tools also provide step playback, algorithm reference material, and lesson quizzes. **Solve** offers guided moves for a supported 3×3 state, with the Kociemba WASM solver and the project's antipodal handling behind the solving workflow. These helpers are not general solvers for every cube size or action-mode state. Progression distinguishes guided activity from eligible independent puzzle solves.

## Chaos and Disparity

Chaos turns flip wear into a survival simulation. Choose the scene, palette, materials, size, intensity, flip limit, and scramble length. The wizard offers flip limits of **3, 8, 13, or 20**, scramble presets of **10, 20, or 30 turns**, and **five intensity levels**.

A round proceeds through setup, an optional prediction, the scramble, a player-selected first strike, the cascade, and the winning-pair reveal. The first strike targets a chosen tile; subsequent chain propagation remains stochastic. The simulation runs in a Web Worker.

- **Wear and elimination:** repeated flips drive tiles toward the selected cap. Spent tiles drop out, with records for individual tiles, pairs, and exhausted color families.
- **Healing:** restore eligible tiles during the storm to earn healing rewards. Distinct restored identities advance the six- and twelve-tile round objectives.
- **Readable state:** damage bars, one-flip-remaining markers, original-color-family highlighting, survival counts, and a tile ledger remain meaningful through rotations and recoloring.
- **Match stages:** the HUD follows the opening storm, the squeeze, and the final six. Notices summarize elimination bursts and color-family losses.
- **Results:** highlight the actual final pair, settle the prediction, and show net points, healing rewards, XP, achievements, duration, and elimination history. Reuse the setup or configure a new round.

Predictions spend the in-game Parity Points wallet and are optional:

| Prediction | Question | Base total-payout multiplier |
| --- | --- | --- |
| **Last Color** | Is the chosen color represented in the winning pair? | 2.7× |
| **Color Pair** | Does the chosen antipodal color family win? | 2.7× |
| **First Fall** | Which color loses all its tiles first? | 5.4× |
| **Speed Round** | Is the first-to-last-elimination interval faster or slower than the displayed threshold? | 1.8× |

These are payout rules, not guaranteed probabilities. The stake is deducted when placed, so total payout and profit differ. Winning streaks can modify the payout. Stable face IDs determine settlement while forecast colors follow the selected palette. Local records retain completed rounds, resolved predictions, correct predictions, streaks, and healing earnings.

Chaos can also be a cube-play overlay where the current level permits it. Standalone predictions and results are separate from WORM enemies or a Story stage's rotating terrain.

## Progression, missions, and the store

### XP, levels, and achievements

Permanent XP is tracked separately from the spendable wallet. WORM, cube puzzles, Random, Biome, Chaos, Daily Descent, teaching, and exploration contribute through their own award rules.

The player level cap is **50**. Reaching level `L` requires cumulative XP

`100(L − 1) + 25(L − 1)(L − 2) / 2`.

Each level grants **25 Parity Points**, with reward choices at progression milestones. The progress screen reports rank, XP by activity, achievements, and available rewards. Achievements recognize collecting the full spectrum, completing tunnel routes, healing an entire cube, clearing Mega, solving independently, beating a move target, and exploring all three cubelet pairs.

### Run missions

WORM Free Play maintains one active mission at a time: collect orbs, gather different colors, finish tunnel trips, or heal a tunnel. Completion grants points and XP and advances to another goal. Goals start counting when assigned, do not repeat within a run, and deprioritize recently completed ones. These missions are distinct from a Story level's checklist.

### Parity Points, gems, and Cubie Chests

The store offers direct unlocks and a separate gem-funded chest system. The implementation uses in-game currencies and local ownership records; it does not contain a real-money checkout.

- **One cubie:** costs 10 gems and rolls one rarity face.
- **Two cubies:** costs 15 gems and rolls two faces. Different faces resolve to the lower rarity; matching faces upgrade by one tier, capped at Mythic.
- **Reward choice:** non-common results offer up to three distinct items from the resulting tier, prioritizing unowned items. Select one. Duplicate/completed-collection compensation uses the tier's gem rule.
- **Common result:** 25 Parity Points and 25 XP.
- **Exchange:** 100 Parity Points buys 10 gems. The wallet also has welcome and eligible progression grants.

| Face | Rarity | Reward family |
| --- | --- | --- |
| White | Common | Parity Points + XP |
| Green | Uncommon | Color palettes |
| Blue | Rare | Classic and antipodal tile styles |
| Yellow | Very rare | Advanced tile styles |
| Orange | Legendary | Hats, accessories, skins, and trails |
| Red | Mythic | Worm characters |

Cubie animations reveal a weighted random result; the die visuals are not a physics-based probability model. Ownership, the pending choice, and recent chest history are saved.

### Saving

Settings, equipped cosmetics, wallet/ownership, XP, campaign records, mission progress, teaching progress, and daily/Chaos records use browser-local persistence. Reopening the same site in the same browser retains saves when storage is available. Saves are origin-specific: another domain, browser profile, or cleared site storage does not automatically share the previous progress. This build has no account-based cloud-save or online multiplayer system.

## Views, tile styles, and world presentation

### Cube views and topology tools

| View or option | What it reveals |
| --- | --- |
| **Classic** | The ordinary colored-sticker cube. |
| **Grid** | Tile/grid identities for positions and correspondence. |
| **Sudoku / Numbers** | Sticker identity numbers. |
| **Wireframe** | Colored edges and connections with the solid presentation stripped back. |
| **Glass** | Transparent cube pieces for seeing through the board. |
| **Chrome** | Reflective metallic bodies. |
| **Neon** | Luminous edge treatment. |
| **Gap** | Space between pieces. |
| **LEGO / Bricks** | A toy-brick presentation. |
| **Hollow** | Open-frame pieces and a reactive central glow. |
| **Exploded view** | Spatially separate pieces to inspect interior relationships. |
| **Net** | An unfolded face layout alongside the 3D cube. |
| **Tunnels: Off / Hints / Full** | Hide routes, show thin connections, or render the fuller treatment. |
| **Far-side window** | Picture-in-picture inspection of the opposite side. |
| **Flip pads** | Full, subtle, or flat small-pad bounce settings; raised-cubie geometry has its own gameplay role. |

View availability can be restricted by a lesson or mode. Whole-cube view changes, a raised flipped cubie, and the timed Explode pickup are related presentations with different purposes.

### Procedural tile materials

Palettes can be chosen from the catalog, edited face by face, or extracted from an uploaded image. Settings also support mapping uploaded images onto individual faces. Palette colors remain attached to stable face IDs.

Tile styles are GPU-rendered materials, often animated or reactive. Apply styles per face, combine them with a palette, or use Random Mix. The catalog has seven families:

| Family | Examples and behavior |
| --- | --- |
| **Classic** | Solid, glossy, matte, metallic, carbon fiber, stained glass, print patterns, and optical illusions such as Café Wall and Rotating Snakes. |
| **Antipodal Op Art** | Dots, checkerboards, stripes, pinwheels, twisted ribbons, and interference patterns combining a face color with its antipodal partner. |
| **Living** | Water, grass, ice, lava, galaxy, plasma, neural/circuit patterns, liquid chrome, and reactive chambers. |
| **Living Surfaces** | Organic surfaces including breathing scales, coral polyps, mycelium veins, and chromatic cilia. |
| **Non-Euclidean** | Poincaré disk, hyperbolic weave, RP² geodesics, circle inversion, Hopf-fiber motifs, and Droste spirals. |
| **Impossible** | Impossible triangles, endless stairs, forks, Necker flips, Möbius bands, and interlocking forms. |
| **Surreal** | Bowler rain, day over night, sky curtains, painted windows, false reflections, and sky birds. |

**Depth chambers** use view-dependent parallax to make a flat tile read as a recessed container. Orb Chamber contains a ball; Liquid Tank a waterline and caustic floor; Dice a turning die; Sand Chamber a gravity-responsive pile; Lava Lamp moving blobs. Reactive materials use tile orientation and rotation energy so the slice being turned can slosh, tumble, or settle. Compass, Spirit Level, and Snow Globe provide further orientation-sensitive examples.

Shared material caching, time uniforms, instanced surfaces, and a reused thumbnail renderer support this variety without a separate WebGL context for every preview.

### Worlds, menus, and feedback

- Scene selection includes photographic/HDR environments and worlds such as forest, snow, desert, cave, stadium, city, nebula, and black hole.
- Biome mode has face assignments and city/GLB presentation. WORM's biome-themed Story worlds borrow surface identity without putting city buildings in the crawl path.
- Ambient miniature cubes use differing palettes/styles in the background. The introduction and carousel share a moving graph-paper theme.
- The menu is a live turning cube with antipodal flip waves, raised portals, and animated worms; the carousel presents modes as labeled faces.
- Orb pickup, jump, boost, shooting, tunnel entry/exit, healing, cuts, and victory have coordinated visual/audio feedback. Supported mobile devices also provide haptics.
- Chase and tunnel cameras, landing markers, rotation warnings, compact inventory, tunnel-needs readouts, mission trackers, and the far-side view help read the action in three dimensions.
- Responsive layouts, keyboard focus, labels alongside colors, reduced-motion handling, and device-dependent effects budgets support different screens and inputs. Mega uses a lighter effects tier.

## Controls and capture mode

### Cube puzzle controls

Mouse/touch gestures manipulate the cube and its layers; on-screen rotation helpers provide explicit controls. Tap a sticker to flip its pair when flips are enabled. Keyboard bindings apply during ordinary cube play, while menus and WORM own their own inputs.

| Input | Action |
| --- | --- |
| Arrow keys | Move the tile cursor. |
| `W` / `S`, `A` / `D` | Rotate the layer selected through the cursor's directional controls. |
| `Q` / `E` | Turn the selected face counterclockwise / clockwise. |
| `F` | Flip the selected pair when permitted. |
| `Space` | Shuffle; at a briefing, dismiss the briefing first. |
| `U` or `Ctrl/Cmd + Z` | Undo. |
| `R` | Reset. |
| `G` | Toggle flip interaction. |
| `T` | Cycle tunnel visibility/detail. |
| `X` | Toggle exploded view. |
| `N` | Toggle the unfolded net. |
| `C` | Toggle Chaos where permitted. |
| `V` | Cycle the cube visual mode. |
| `H` or `?` | Open/close help. |
| `Esc` | Dismiss the top active surface or hide the tile cursor. |

### WORM controls

Choose **relative / non-oriented steering** to turn relative to the worm's heading, or **oriented / camera-relative steering** to interpret directions in the current screen frame.

| Input | Action |
| --- | --- |
| Left/right swipe or arrow | Steer under the selected control scheme. |
| Down swipe or arrow | Relative-mode reversal, or camera-relative down. |
| Up swipe or arrow | Camera-relative up when oriented steering is selected. |
| Jump button / `Space` | Jump, use the second airborne jump, or perform the contextual tunnel action. |
| Boost button | Trigger the rechargeable speed burst. |
| Ability button / `Q` | Use the character's active signature when eligible. |
| Hold Fire / hold `F` | Fire parity shots when combat is available. |
| Pause / Retry / New Game | Manage the run; Story also provides a next-level flow. |

### Capture Mode — Just the Game

Open **Settings → Capture** during eligible play to hide menus, scores, hints, and notifications while the game continues. Use the device's screenshot or screen recorder; this mode provides a clean presentation, not an integrated video encoder.

In WORM capture mode, swipe to steer, tap to jump/dive, swipe up to boost with relative steering, tap with two fingers for the signature, and hold one finger to fire. Restore the interface with **Escape** or by holding two fingers still for one second. The Möbius Cubelet viewer also supports capture mode.

## Architecture and source map

WORM³ uses React 18, Vite 5, Three.js, React Three Fiber/Drei, post-processing, Zustand, GSAP, and a Kociemba WASM solver. Vitest/jsdom and ESLint cover logic and UI behavior. `package.json` and `package-lock.json` are the source of truth for dependency versions.

| Area | Entry points | Responsibility |
| --- | --- | --- |
| Application and UI | [App.jsx](src/App.jsx), [UILayer.jsx](src/components/UILayer.jsx), [uiSurfaces.js](src/hooks/uiSurfaces.js) | Mode transitions, screen ownership, scene composition, input gating. |
| Cube and topology | [game/](src/game/), [useCubeState.js](src/hooks/useCubeState.js) | Rotations, stable identities, paired flips, win checks, diagnostics, solver adapters. |
| Shared state | [useGameStore.js](src/hooks/useGameStore.js), [storeSlices/](src/hooks/storeSlices/) | Settings, sessions, WORM, Chaos, progression, chests, persistence. |
| Cube and materials | [3d/](src/3d/), [manifold/](src/manifold/) | Cubies, stickers, raised platforms, tunnels, shaders, scene effects. |
| WORM simulation | [HealerWormMode.jsx](src/worm/HealerWormMode.jsx), [wormSim.js](src/worm/healerWorm/wormSim.js), [wormLogic.js](src/worm/wormLogic.js) | Run lifecycle, crawling, jumps, transit, body history, collisions, healing, powers. |
| Characters and combat | [wormCharacterData.js](src/worm/wormCharacterData.js), [signatures.js](src/worm/healerWorm/signatures.js), [combat/](src/worm/combat/) | Abilities, enemies, projectiles, elements, waves. |
| WORM Story | [story/levels.js](src/worm/story/levels.js), [story/worlds.js](src/worm/story/worlds.js), [story/](src/worm/story/) | Forty levels, chapters, objectives, worlds, rewards. |
| Cube campaigns | [levels/](src/levels/), [parSolver.js](src/levels/parSolver.js) | Packs, generation, exact mixed-move par search, daily challenges, records. |
| Teaching | [teach/](src/teach/) | Course, notation, algorithms, stage detection, solving guidance. |
| Chaos | [chaosSim.js](src/game/chaosSim.js), [chaosWorker.js](src/workers/chaosWorker.js), [chaos/](src/chaos/) | Off-thread cascade simulation, match HUD, forecasts/results. |
| Progression and collection | [progression/](src/progression/), [economy/](src/economy/), [storeCatalog.js](src/utils/storeCatalog.js) | XP, achievements, rewards, wallet, chests, items. |
| Capture and presentation | [capture/](src/components/capture/), [menus/](src/components/menus/), [intro/](src/components/intro/) | Clean capture view, carousel, settings, opening sequence. |
| Tests | [src/__tests__/](src/__tests__/) | Topology, simulation, progression, rendering contracts, and UI interactions. |

Large scenes and optional tools load on demand. Chaos computation runs off the main thread. Rendering uses shared geometry/materials, instancing, bounded effect pools, and quality tiers to control larger-board costs.

The PWA service worker versions core assets together, caches heavy media on first use, and offers an update prompt instead of forcibly reloading an active run. Offline availability depends on assets the browser has already cached.

## Local development and validation

Use **Node.js 20** and **npm 10+**. The repository pins the toolchain through `.nvmrc` and CI.

```bash
npm ci
npm run dev
```

Vite starts on port 5173. With the default base path, open `http://localhost:5173/WORM-3/`.

Use `npm ci` to reproduce the lockfile. `.npmrc` already sets `legacy-peer-deps=true` for the R3F dependency tree; an ordinary `npm install` can rewrite the lockfile.

```bash
npm run build
npm run preview
```

The build is written to `dist/`. The default base is `/WORM-3/` for GitHub Pages. A root-hosted deployment can override it:

```bash
VITE_BASE=/ npm run build
```

The base setting also informs the PWA paths. Deployment configuration must serve the built base correctly.

| Command | Purpose |
| --- | --- |
| `npm run test` | Run Vitest once. |
| `npm run test:watch` | Watch tests during development. |
| `npm run test:ui` | Open the Vitest UI. |
| `npm run test:coverage` | Request coverage; requires Vitest's compatible V8 coverage provider in the local environment. |
| `npm run lint` | Check source with ESLint. |
| `npm run lint:fix` | Apply supported lint fixes. |
| `npm run bundle:check` | Check per-asset and initial-route budgets after a build. |
| `npm run ci` | Run lint → tests → build → bundle-budget checks. |

GitHub Actions validates pull requests and main-branch pushes. The Pages deployment job runs for pushes to `main` after its checks. Test totals change frequently; current Vitest output is authoritative.

## Feature status and reference material

This README describes the active release paths and current source behavior. The repository also contains experiments and design briefs:

- **Portal Combat** is explicitly a playable preview.
- **Mirror Blocks** has a settings toggle and shape-based rendering, but its additional-modes card is still marked coming soon; it does not have a completed standalone launch flow.
- Older **WORM Surface / Tunnel** terminology refers to earlier or internal traversal implementations, not extra carousel modes beside the current WORM experience.
- **Hands, Holonomy, Merge, and Co-op** are archived and not playable in this release. Restoration notes and source are in [archive/scrapped-modes/](archive/scrapped-modes/README.md).
- **Life Journey** remains as legacy level data. Topological Descent and WORM Story are the current distinct campaigns described above.
- A proposal in `docs/features/` is not, by itself, evidence that every proposed feature is implemented. Launch paths, data definitions, and simulation are authoritative.

Useful deeper references:

- [Antipodal identification engine](docs/antipodal-identification-engine.md)
- [Antipodal mathematics and verifier](docs/antipodal-math/README.md)
- [WORM monograph](docs/worm3-monograph.md)
- [Continuous tunnel body](docs/continuous-tunnel-body.md)
- [Physical slice cuts](docs/physical-slice-cuts.md)
- [WORM Story design](docs/features/worm-story-mode.md)
- [Character signatures](docs/features/character-signatures.md)
- [Chaos match experience](docs/features/chaos-match-experience.md)
- [Cubie Chests](docs/features/cubie-chests.md)
- [Development guide](DEVELOPMENT.md)

## License

MIT. See [LICENSE](LICENSE).
