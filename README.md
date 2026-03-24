# WORM-3

**WORM-3** is a 3D topological puzzle/action game built around a cube with antipodal identification (RP²-inspired rules), not a standard orientable Rubik model.

Live demo: https://macmayo1993.github.io/WORM-3/

---

## Table of Contents

- [Project Overview](#project-overview)
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
- **Antipodal Echo Mode**
  - Delayed mirrored/echo rotations.
  - Reversal/effect telemetry.
  - Echo synchronization controls and indicators.
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

- Node.js 18+
- npm 9+

### Install

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required due to peer-dependency conflicts in the R3F ecosystem.

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
