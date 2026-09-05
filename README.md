# WORM-3

**WORM-3** is a 3D topological puzzle/action game built around a cube with antipodal identification (RP²-inspired rules), not a standard orientable Rubik model.

Live demo: https://macmayo1993.github.io/WORM-3/

---

## Table of Contents

- [Project Overview](#project-overview)
- [The Antipodal Flip — The Core Innovation](#the-antipodal-flip--the-core-innovation)
- [Gameplay Systems](#gameplay-systems)
  - [Core Cube Rules](#core-cube-rules)
  - [Puzzle Rule Sets](#puzzle-rule-sets)
  - [Progression + Campaign](#progression--campaign)
- [Modes and Variants](#modes-and-variants)
  - [Primary Modes](#primary-modes)
  - [Secondary / Overlay Modes](#secondary--overlay-modes)
  - [WORM Family Modes](#worm-family-modes)
  - [Experimental / Specialty Modes](#experimental--specialty-modes)
- [Controls](#controls)
  - [Mouse / Touch](#mouse--touch)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Hands Mode Keymap](#hands-mode-keymap)
  - [WORM Healer Control Styles](#worm-healer-control-styles)
- [Visual + World Systems](#visual--world-systems)
- [Tile Styles & Depth Illusions](#tile-styles--depth-illusions)
- [Audio / Feedback / HUD](#audio--feedback--hud)
- [Tech Architecture](#tech-architecture)
- [Codebase Map](#codebase-map)
- [Local Development](#local-development)
- [Testing, Linting, CI](#testing-linting-ci)
- [Known Notes](#known-notes)
- [License](#license)

---

## Project Overview

WORM-3 combines:

- A **cube-state engine** (slice rotations, flips, parity-aware state, win checks).
- A **mode framework** that reuses the same manifold/cube state across puzzle, action, and traversal gameplay.
- A **React + React Three Fiber** rendering stack with post-processing, biome environments, and topology overlays.
- A **Zustand global store** coordinating game state, menus, overlays, settings, run/session telemetry, and mode toggles.

Design intent: opposite faces/points are treated as identified through quotient-like antipodal mapping, so orientation, pathing, and parity behaviors differ from standard cube games.

---

## The Antipodal Flip — The Core Innovation

Everything else in WORM-3 grows out of one idea that a standard Rubik's cube does not have: **opposite faces are the same place.**

### What a standard cube can't do

A classic Rubik's cube is an *orientable* puzzle. Its only move is the **rotation** — you permute where stickers sit, but a red sticker stays red, the six faces are independent, and the whole state space is a single group of position permutations. There is exactly one kind of "wrongness" (a piece is in the wrong spot) and exactly one win condition (each face one color).

WORM-3 keeps rotations, then adds a move that is impossible on a normal cube — the **antipodal flip** — by treating the cube as a quotient in which each face is identified with the face on the opposite side (an RP²-inspired identification):

- **Red ↔ Orange**
- **Green ↔ Blue**
- **White ↔ Yellow**

### The flip

Tapping a sticker (when flip interactions are enabled) **flips it to its antipodal partner color** — and, because the two sides are the *same identified point*, it **simultaneously flips its antipodal twin** on the opposite side of the cube. One input, two coordinated changes across the manifold. This is not a rotation and cannot be expressed as any sequence of rotations; it is a topological identification operation unique to this geometry.

Mechanically, the flip adds a **second, independent axis of state** on top of position:

- Every sticker carries a **flip count / parity** in addition to where it sits.
- Rotations shuffle *positions*; flips toggle *identity* across the antipodal seam.
- Solving therefore means satisfying **two** state dimensions at once, not one.

### Why it matters — the possibilities it unlocks

Because opposite points are identified and each sticker has its own flip parity, a single mechanic opens up gameplay a normal cube structurally cannot support:

- **Wormholes & traversal (the WORM modes).** If a face and its antipode are the same place, you can travel *through* the cube from one to the other. That identification is literally a tunnel — so the same cube state powers real-time crawling, tunnel routing, and chase-cam action, not just puzzle-solving.
- **Elimination & survival (Disparity / Chaos).** Flip parity accumulates. Push a sticker past its **flip cap** and it is eliminated; flips propagate in cascades, faces can be wiped out, and the last surviving antipodal pair wins. A second state axis turns a solve puzzle into a battle-royale of tiles.
- **Path-dependent orientation (Holonomy).** On an RP²-flavored surface, transport around a loop can come back flipped. Moving a worm or tracing a path is order-sensitive in a way a sphere-topology cube never is.
- **Identity that travels with parity (Biome / Merge).** Because a flip swaps a tile *across* the seam, higher-level identity can ride on it: in Biome/City mode a flip swaps a tile's city to the antipodal face's city; Merge mode grows connected regions across that same identified surface.
- **New win conditions.** Classic color restoration, Sudokube constraints, and Ultimate all reinterpret "solved" over the identified surface rather than six independent faces.
- **A visible topology.** Parity indicators, the Antipodal Integrity overlay, the tunnel network, and the depth-illusion tile styles all exist to make the identification legible while you play.

In short: the rotation gives WORM-3 a Rubik's cube's body; the antipodal flip gives it a different **topology**, and every mode in the list below is a different game you can play once opposite is the same as here.

---

## Gameplay Systems

### Core Cube Rules

- Cube sizes supported: **2×2, 3×3, 4×4, 5×5** in the campaign; up to **7×7** in Disparity and freeplay wizards.
- Antipodal face pairs (identified through the RP²-like quotient): **Red ↔ Orange**, **Green ↔ Blue**, **White ↔ Yellow**.
- Base interactions:
  - Rotate slices.
  - Rotate faces directly (including mobile-assisted face rotation UI).
  - Flip stickers antipodally when flip interactions are enabled.
- Session metrics track moves / time / flips / wormhole state and feed multiple HUD layers.
- Undo history is capped and surfaced in the desktop HUD.

### Puzzle Rule Sets

WORM-3 includes three canonical rule sets used in freeplay and levels:

1. **Classic** — color restoration under projective constraints.
2. **Sudokube** — Latin/sudoku-like sticker constraints (each face must contain unique values in every row and column).
3. **Ultimate** — hybrid of color + Sudokube constraints.

### Progression + Campaign

The story campaign pack is **"Life Journey"** — a 10-level arc from Daycare to the Singularity that progressively introduces every game mechanic.

| # | Name | Setting | Cube | Mode | Chaos | Features unlocked |
|---|------|---------|------|------|-------|-------------------|
| 1 | Baby Cube | Daycare | 2×2 | Classic | — | Rotations |
| 2 | Twin Paradox | Elementary | 2×2 | Classic | — | Tunnels |
| 3 | Flip Gateway | Middle School | 3×3 | Classic | — | Antipodal flips |
| 4 | Chaos Ripple | High School | 3×3 | Classic | L1 | Chaos / Disparity |
| 5 | Parity Gate | College | 3×3 | Classic | L1 | Parity indicator |
| 6 | Manifold Axes | First Job | 4×4 | Classic | L2 | Explode view |
| 7 | Sudokube Veil | NASA Lab | 4×4 | Sudokube | L2 | Sudoku constraints |
| 8 | Ultimate Seam | Rocket Launch | 4×4 | Ultimate | L3 | Dual constraints |
| 9 | Quotient Collapse | The Moon | 5×5 | Ultimate | L3 | Net (unfolded) view |
| 10 | Black Hole | The Singularity | 5×5 | Ultimate | L4 | All features + epic cinematic |

Level metadata supports: cube size, chaos level, game mode, win condition, background environment, feature flags, tutorial / cutscene text, difficulty, tags, move/time limits, and unlock requirements.

---

## Modes and Variants

### Primary Modes

- **Classic Puzzle** (default solve flow)
- **Sudokube**
- **Ultimate**
- **Freeplay Setup Wizard** — customized sandbox with selectable cube size, mode, and feature flags.
- **Level Select + Story Campaign** — guided 10-level progression.

### Secondary / Overlay Modes

These layer on top of core play:

- **Flip Mode** — enables antipodal sticker flips; flipping a sticker simultaneously flips its antipodal twin.
- **Disparity / Chaos Mode**
  - Five chaos intensity levels (L1–L5), each controlling tick frequency and chain-propagation strength.
  - Configurable flip cap (6–40); tiles that reach the cap are eliminated in rank order.
  - Per-tile death tracking with rank and pair-rank ordering; face-elimination banners when a full face is eliminated.
  - Cascade bolt visuals between propagating stickers.
  - Winner cinematic when the final antipodal pair survives.
  - Computation runs entirely in a dedicated **Web Worker** (off the main thread).
- **Hands Mode**
  - Speedcube-style keyboard mapping (WCA notation).
  - Move-history notation display.
  - Turns-per-second telemetry and combo detection.
- **Solve Mode** — focused step-highlight assistance for the current puzzle state.
- **Teach Mode** — guided instructional flow targeting the 3×3 layer-by-layer method; includes an integrated solver and algorithm reference.
- **Antipodal Integrity Mode (I(T))** — topology/integrity exploration overlay showing the quotient structure in real time.
- **Leaderboard / Tile Stats View** — live tile/death/flip style leaderboard panel.
- **View Modes** — classic, grid, sudokube, wireframe, glass.
- **Spatial View Toggles** — explode, net panel, hollow cube, tunnel visibility.

### WORM Family Modes

WORM transforms cube state into real-time movement gameplay:

- **WORM Surface** — tile-based crawling with path/body constraints across the manifold surface.
- **WORM Tunnel** — wormhole/interior routing variant for traversal between antipodal faces.
- **WORM Healer** (real-time chase-cam action mode)
  - Jumping and multi-jump behavior.
  - Tunnel trigger windows and transitions.
  - Collision/death management.
  - Run lifecycle controls (retry / new game).
  - Orb and powerup-driven flow with inventory HUD.
- **Co-op Platformer WORM** — platforming and cube interaction blend; dedicated setup wizard and HUD components.

### Experimental / Specialty Modes

- **Holonomy Mode** — path-dependent orientation/transport exploration across the manifold.
- **Merge Mode**
  - Connected-region detection across the cube surface.
  - Three tile evolution tiers (base → mid → final) with tier-based rendering overlays.
  - Six theme packs: **Pokémon**, **D&D**, **Digimon**, **Marvel**, **Harry Potter**, **Disney**.
- **Biome / City Mode**
  - Per-face 3D city theming using GLB asset clusters (colosseum, volcano, etc.).
  - City identity follows flip parity across the manifold: flipping a tile swaps its city to the antipodal face's city.
  - Environment-map (HDR/EXR) switching per biome theme.

---

## Controls

### Mouse / Touch

- Drag/swipe on cube: rotate slices.
- Shift + drag: twist face.
- Tap/click sticker: antipodal flip (when flip mode is enabled).
- Mobile includes dedicated touch controls for WORM modes and face/tile rotation helpers.

### Keyboard Shortcuts

General shortcuts:

- `Space` — shuffle
- `R` — reset
- `H` or `?` — help
- `G` — toggle flip mode
- `T` — toggle tunnels
- `X` — toggle explode view
- `V` — cycle visual mode
- `C` — toggle disparity/chaos mode
- `P` — toggle hands mode
- `N` — toggle net (unfolded) view
- `Esc` — close menus / hide cursor / exit hands mode
- `Z` — undo

Keyboard cursor + cube interaction:

- Arrow keys — move tile cursor
- `W` / `S` — rotate selected row up/down
- `A` / `D` — rotate selected column left/right
- `Q` / `E` — rotate selected face CCW/CW
- `F` — flip selected tile

### Hands Mode Keymap

- `I` / `K` → U / U′
- `O` → U2
- `J` / `L` → R / R′
- `F` / `D` → L / L′
- `H` / `G` → F / F′
- `W` / `E` → B / B′
- `S` / `;` → D / D′
- `,` / `M` → M′ / M
- `.` → M2
- `U` / `N` → E′ / E

### WORM Healer Control Styles

- **Non-oriented (legacy manifold-relative):** turning relative to worm heading.
- **Oriented (camera-relative):** turning relative to the on-screen camera frame.

Both styles can be toggled in the mode-specific UI.

---

## Visual + World Systems

- Antipodal tunnel network rendering with wormhole particle effects and arrival bursts.
- Manifold and wormhole effects: flip-propagation waves, chaos cascade waves, tunnel FX, pulse overlays.
- Intro scene with a dedicated animation sequence and post-processing stack (bloom, vignette, chromatic aberration).
- Optional picture-in-picture antipodal visualization overlay.
- Disparity/instability overlays: per-tile health bars, death-rank indicators, face-elimination banners.
- 3D background environments and biome clusters (GLB assets + HDR/EXR maps) switched per campaign level and biome setting.
- Life Journey campaign backgrounds: Daycare, Elementary, Middle School, High School, College, Job, NASA, Rocket, Moon, Black Hole.
- Large color/theme catalog — classic palettes plus stylistic and pop-culture color schemes.
- Optional custom face imagery/texture assignment from the settings pipeline.
- Sticker instancing via `StickerInstances` for efficient batch rendering across all tiles.

---

## Tile Styles & Depth Illusions

Every sticker can be re-skinned with a **tile style** — a GPU shader that draws the tile procedurally instead of using a flat color. Styles are cached per (style × face color) material, shared across all tiles that use them, and grouped in the store/settings catalog into three sections:

- **Classic** — solids, metals, and print-like patterns.
- **Antipodal Op Art** — geometric patterns that pair each face color with its antipodal partner color (polka dots, chevrons, moiré, pinwheels, …), turning the flip relationship into a visual motif.
- **Living** — animated and volumetric styles (grass, ice, lava, galaxy, neural, plasma, …), including the depth-illusion chambers below.

### The depth-illusion chambers

A family of **Living** styles makes each flat sticker read as a little glass chamber with a real 3D object recessed *behind* its surface. They're built on one shared shader toolkit so they behave consistently and stay cheap:

- **View-dependent parallax.** A tangent frame reconstructed from screen-space derivatives lets each style ray-trace its interior, so the object **shifts as you orbit the cube** — genuine depth, not a painted-on picture.
- **Antipodal color pairing.** The chamber/glass renders in the tile's own face color while the *contents* render in the **antipodal partner color** — so every chamber is also a little visualization of the flip relationship.
- **Gravity-bound.** World-space position and normal are used to keep liquids and sand **level to real gravity** and blobs rising correctly, no matter how the cube is oriented or viewed.
- **Rotation-reactive.** Slice membership + a spin-energy signal mean **only the tiles on the layer you actually turn** react — they slosh, jostle, pour, or re-roll, while the rest hold still.

The chambers:

| Style | What's inside | Notable behavior |
|-------|---------------|------------------|
| **Orb Chamber** | A recessed ball | Parallaxes against its chamber wall; jostles when its slice turns |
| **Liquid Tank** | Water with a caustic floor | Waterline stays level to gravity; side faces show a waterline, top/bottom a pool; sloshes on turns |
| **Dice** | A tumbling six-sided die | Re-rolls to a random face on each turn; per-cell roll state means a tile never repeats a face when it returns to a spot |
| **Sand Chamber** | Grainy sand | Piles at world-down and pours to the new low side when a slice reorients |
| **Lava Lamp** | Metaball blobs | Rise/fall with gravity, morph, and merge / pinch off a bottom puddle |

Tile-style thumbnails are rendered through a shared preview renderer (no second WebGL context, so it's mobile-safe), and animated styles advance from a shared `time` uniform driven once per frame.

---

## Audio / Feedback / HUD

- Audio utility hooks for game feedback (flip, shuffle, victory sounds).
- Haptic vibration feedback on supported mobile devices.
- Floating HUD for parity/chaos state cues.
- Top menu bar with runtime stats (moves, time, level name).
- Bottom navigation with grouped secondary-mode sheet.
- Specialized overlays:
  - Hands HUD (notation, TPS meter).
  - Disparity HUD (death log, alive count, face elimination banners).
  - Antipodal HUDs (parity indicator, integrity overlay).
  - Healer Worm HUD (orb inventory, health).
  - Rotation preview.
  - Solve step highlights.
  - Keyboard cursor highlight.

---

## Tech Architecture

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React + React DOM | 18.2 |
| Build tool | Vite | 5.4 |
| 3D rendering | Three.js | 0.159 |
| R3F bindings | @react-three/fiber | 8.15 |
| R3F helpers | @react-three/drei | 9.93 |
| Post-processing | @react-three/postprocessing | 2.19 |
| State management | Zustand | 5.0 |
| Animation | GSAP | 3.14 |
| Testing | Vitest + jsdom | 4.0 |
| Linting | ESLint | 9 |
| Off-thread compute | Web Worker (chaosWorker) | — |

High-level runtime layering:

1. `App.jsx` orchestrates scene branches, mode switching, and handler wiring.
2. Store/hooks compose stateful systems (cube, chaos, settings, levels, inputs).
3. 3D scene components render manifold/cube/worm visuals inside an R3F `<Canvas>`.
4. UI layer renders menus, wizards, HUD, overlays, and campaign flows on top of the canvas.
5. Chaos/Disparity computation runs in a **Web Worker** so the main thread stays unblocked during heavy cascade ticks.

---

## Codebase Map

```
src/
├── App.jsx                 # Main application — scene branches, mode switching, handler wiring
├── main.jsx                # React entry point
│
├── game/                   # Pure game-logic functions — zero React dependencies
│   ├── cubeState.js        #   Cube creation (makeCubies)
│   ├── cubeRotation.js     #   Slice rotation logic (rotateSliceCubies)
│   ├── coordinates.js      #   Coordinate / grid-ID utilities
│   ├── winDetection.js     #   Classic, Sudokube, Ultimate win checks
│   ├── manifoldLogic.js    #   Manifold grid mapping, antipodal lookup
│   ├── antipodalMode.js    #   Antipodal sticker mechanics
│   └── ...                 #   Parity, verification, hands input, mirror blocks
│
├── hooks/                  # Custom React hooks — Zustand store + domain logic
│   ├── useGameStore.js     #   Central Zustand store (cube state, settings, disparity, levels)
│   ├── useCubeState.js     #   Cube manipulation API
│   ├── useChaosMode.js     #   Chaos cascade auto-rotate system
│   ├── useChaosWorker.js   #   Web Worker bridge for off-thread chaos computation
│   ├── useLevelSystem.js   #   Level selection and progression
│   └── ...                 #   Animation, cursor, settings, undo, hands, tiling
│
├── workers/
│   └── chaosWorker.js      # Web Worker — chaos/disparity tick computation (off main thread)
│
├── 3d/                     # Three.js / R3F components
│   ├── CubeAssembly.jsx    #   Main cube mesh, instancing, tremor state
│   ├── Cubie.jsx           #   Individual cube piece
│   ├── StickerPlane.jsx    #   Per-sticker rendering, flip animations, health bars, wormhole FX
│   ├── GameScene.jsx       #   Canvas orchestrator + post-processing chain
│   ├── styles/             #   Tile-style shader materials + shaders (orbChamber, liquidTank,
│   │                       #   dice, sandChamber, lavaLamp, and the Classic/Op-Art/Living sets)
│   └── ...                 #   Biome clusters, wormhole tunnels, antipodal visualization
│
├── components/
│   ├── menus/              #   MainMenu, TopMenuBar, SettingsMenu, MobileControls, HelpMenu, ...
│   ├── screens/            #   WelcomeScreen, LevelSelect, VictoryScreen, setup wizards,
│   │                       #   DisparityWinnerScreen, Level10Cutscene, ...
│   ├── overlays/           #   CursorHighlight, DisparityHUD, HandsOverlay, AntipodalHUDs, ...
│   └── intro/              #   Intro animation sequence components
│
├── teach/                  # Teaching mode
│   ├── TeachMode.jsx       #   Step-by-step instructional UI
│   ├── solver3x3.js        #   3×3 layer-by-layer solver
│   └── algorithms.js       #   Common algorithm library (OLL, PLL, etc.)
│
├── worm/                   # WORM family modes (surface crawl, tunnel, healer, co-op)
│   ├── HealerWormMode.jsx  #   Real-time chase-cam action mode
│   ├── PlatformerWormMode.jsx #  Co-op platformer variant
│   ├── wormLogic.js        #   Core worm physics and pathfinding
│   └── ...                 #   HUD, touch controls, physics, live rotation
│
├── levels/                 # Level system and campaign content
│   ├── schema.js           #   Level schema constants (GAME_MODES, DIFFICULTY, BACKGROUNDS, ...)
│   ├── LevelsManager.js    #   Level loading and access
│   ├── ProgressManager.js  #   Completion tracking and persistence
│   ├── packs/
│   │   └── story-campaign.js  # "Life Journey" pack (levels 1–10)
│   └── data/               #   Individual level definition files (level-01 … level-10)
│
├── manifold/               # Manifold topology visualizations
│   ├── WormholeTunnel.jsx  #   Wormhole tunnel rendering
│   ├── FlipPropagationWave.jsx #  Cascade wave effect
│   └── ...                 #   Particles, chaos waves, manifold grid, intro tunnel
│
├── modes/                  # Specialty mode domains
│   ├── CityBiomeMode.js    #   City/biome environment resolver
│   └── merge/              #   Merge Mode — region detection, tile tiers, theme picker
│
└── utils/                  # Constants, helpers, audio
    ├── constants.js        #   COLORS, ANTIPODAL_COLOR, FLIP_CAP, face IDs, DIR_VECTORS
    ├── colorSchemes.js     #   Color palette catalog
    ├── audio.js            #   Audio feedback utilities
    └── ...                 #   Backgrounds, tile styles, easing, device detection
```

Static assets live under `public/`:
- `public/models/biomes/` — GLB 3D city/biome models.
- `public/environments/` — HDR/EXR environment maps.

---

## Local Development

### Prerequisites

- Node.js 20 (see `.nvmrc` — CI, the devcontainer and `engines` all pin the same major)
- npm 10+

### Install

```bash
npm ci
```

> The R3F ecosystem has peer-dependency conflicts that only resolve under npm's
> legacy algorithm. `.npmrc` sets `legacy-peer-deps=true`, so `npm ci` reproduces
> exactly the tree in `package-lock.json` without any extra flags. Prefer `npm ci`
> over `npm install`: the latter rewrites the lockfile in place.

### Start Dev Server

```bash
npm run dev
```

Starts Vite on `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output goes to `dist/`. The base path is `/WORM-3/` (configured for GitHub Pages).

### Preview Production Build

```bash
npm run preview
```

---

## Testing, Linting, CI

### Run Tests

```bash
npm run test
```

The test suite has **249 tests across 17 files** covering core game logic (`src/game/`), utilities (`src/utils/`), and levels (`src/levels/`). Tests use Vitest with a jsdom environment; globals (`describe`, `it`, `expect`, `vi`) are available without imports.

### Watch Mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

Generates a V8 coverage report scoped to `src/game/**`, `src/utils/**`, and `src/levels/**`.

### Vitest UI

```bash
npm run test:ui
```

### Lint

```bash
npm run lint          # check
npm run lint:fix      # auto-fix
```

ESLint 9 flat config (`eslint.config.js`). `no-console` is off. React Hooks rules are enforced; some strict rules are relaxed for Three.js/R3F imperative patterns.

### Full CI Pipeline

```bash
npm run ci
```

Runs lint → test → build in sequence.

---

## Known Notes

- Merge mode includes code-level support for themed region tiers and overlays; final art asset completeness may vary by theme pack at runtime.
- The project intentionally blends puzzle precision with experimental manifold mechanics (chaos/disparity, worm traversal, holonomy), so some modes are more "sandbox research" than fixed competitive rulesets.
- Disparity Mode computation is isolated in a Web Worker; the main thread receives batched flip updates and applies them with lazy copy-on-write to avoid GC pressure during heavy cascade ticks.

---

## License

MIT. See `LICENSE`.
