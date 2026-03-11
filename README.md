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
  - [Secondary/Overlay Modes](#secondaryoverlay-modes)
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

- Cube sizes supported in UI flows: **2×2, 3×3, 4×4, 5×5**.
- Base interactions:
  - Rotate slices.
  - Rotate faces directly (including mobile-assisted face rotation UI).
  - Flip stickers antipodally when flip interactions are enabled.
- Session metrics track moves/time/flips/wormhole state and feed multiple HUD layers.
- Undo history is capped and surfaced in desktop HUD.

### Puzzle Rule Sets

WORM-3 includes three canonical rule sets used in freeplay/levels:

1. **Classic** — color restoration under projective constraints.
2. **Sudokube** — Latin/sudoku-like sticker constraints.
3. **Ultimate** — hybrid of color + Sudokube constraints.

### Progression + Campaign

- Story campaign pack: **“Life Journey”** (Daycare → Black Hole).
- Progressive feature unlocking across levels (rotations, tunnels, flips, chaos/disparity, parity, explode view, net view).
- Level metadata supports:
  - cube size,
  - chaos level,
  - game mode + win condition,
  - environment/background,
  - feature flags,
  - tutorial/cutscene text,
  - difficulty/tags,
  - optional move/time limits,
  - unlock requirements.
- Validation utilities exist for individual levels, packs, and full built-in sets.

---

## Modes and Variants

## Primary Modes

- **Classic Puzzle** (default solve flow)
- **Sudokube**
- **Ultimate**
- **Freeplay Setup Wizard** (customized sandbox entry)
- **Level Select + Story Campaign** (guided progression)

## Secondary/Overlay Modes

These layer on top of core play:

- **Flip Mode** — enables antipodal sticker flips.
- **Disparity / Chaos Mode**
  - chaos levels,
  - optional auto-rotate pressure,
  - cascade tracking,
  - elimination/death tracking overlays,
  - winner cinematic flow.
- **Hands Mode**
  - speedcube-style keyboard mapping,
  - move-history notation,
  - turns-per-second telemetry,
  - combo detection.
- **Solve Mode**
  - focused step/highlight assistance.
- **Teach Mode**
  - guided instructional flow (3×3-targeted learning).
- **Antipodal Integrity Mode (I(T))** — topology/integrity exploration overlay.
- **Antipodal Echo Mode**
  - delayed mirrored/echo rotations,
  - reversal/effect telemetry,
  - echo synchronization controls + indicators.
- **Leaderboard/Tile Stats View** — live tile/death/flip style leaderboard panel.
- **View Modes**
  - classic,
  - grid,
  - sudokube,
  - wireframe,
  - glass.
- **Spatial View Toggles**
  - explode,
  - net panel,
  - hollow cube,
  - tunnel visibility.

## WORM Family Modes

WORM transforms cube state into movement gameplay:

- **WORM Surface** — tile-based crawling with path/body constraints.
- **WORM Tunnel** — wormhole/interior routing variant.
- **WORM Healer** (real-time chase-cam action)
  - jumping + multi-jump behavior,
  - tunnel trigger windows and transitions,
  - collision/death management,
  - run lifecycle controls (retry/new game),
  - orb + powerup driven flow.
- **Co-op Platformer WORM**
  - platforming + cube interaction blend,
  - dedicated setup wizard and HUD components.

## Experimental / Specialty Modes

- **Holonomy Mode** — path-dependent orientation/transport exploration.
- **Merge Mode**
  - theme picker (Pokémon, D&D, Digimon, Marvel, Harry Potter, Disney),
  - connected-region detection,
  - tile evolution tiers (base/mid/final) with tier-based rendering overlays.
- **Biome/World Styling**
  - city/biome driven visual treatment,
  - environment map switching,
  - per-face thematic styling options.

---

## Controls

## Mouse / Touch

- Drag/swipe on cube: rotate slices.
- Shift + drag: twist face.
- Tap/click sticker: antipodal flip (when enabled).
- Mobile includes dedicated touch controls for WORM and face/tile rotation helpers.

## Keyboard Shortcuts

General shortcuts:

- `Space` — shuffle
- `R` — reset
- `H` or `?` — help
- `G` — toggle flip mode
- `T` — toggle tunnels
- `X` — toggle explode
- `V` — cycle visual mode
- `C` — toggle disparity/chaos mode
- `P` — toggle hands mode
- `Esc` — close menus / hide cursor / exit hands mode
- `Z` — undo

Keyboard cursor + cube interaction:

- Arrow keys — move tile cursor
- `W` / `S` — rotate selected row up/down
- `A` / `D` — rotate selected column left/right
- `Q` / `E` — rotate selected face CCW/CW
- `F` — flip selected tile

## Hands Mode Keymap

- `I` / `K` → U / U'
- `O` → U2
- `J` / `L` → R / R'
- `F` / `D` → L / L'
- `H` / `G` → F / F'
- `W` / `E` → B / B'
- `S` / `;` → D / D'
- `,` / `M` → M' / M
- `.` → M2
- `U` / `N` → E' / E

## WORM Healer Control Styles

- **Non-oriented (legacy manifold-relative):** turning relative to worm heading.
- **Oriented (camera-relative):** turning relative to on-screen camera frame.

Both can be toggled in mode-specific UI.

---

## Visual + World Systems

- Antipodal tunnel network rendering.
- Manifold and wormhole effects (waves, tunnel FX, pulse overlays).
- Intro scene + post-processing stack (bloom, vignette, chromatic aberration).
- Optional PiP antipodal visualization.
- Disparity/instability overlays and health/death-style indicators.
- 3D background environments and biome clusters (GLB assets + HDR/EXR maps).
- Large color/theme catalog (classic palettes, stylistic and pop-culture schemes).
- Optional custom face imagery/texture assignment from settings pipeline.

---

## Audio / Feedback / HUD

- Audio utility hooks for game feedback.
- Floating HUD for parity/chaos state cues.
- Top menu stats and runtime indicators.
- Bottom navigation + grouped secondary mode sheet.
- Specialized overlays:
  - hands HUD,
  - disparity HUD,
  - antipodal HUDs,
  - healer worm HUD,
  - rotation previews,
  - solve highlights,
  - cursor highlights.

---

## Tech Architecture

- **Frontend:** React 18 + Vite
- **3D:** Three.js, @react-three/fiber, @react-three/drei
- **Post FX:** @react-three/postprocessing
- **State:** Zustand (single global store + modular hooks)
- **Animation:** GSAP + frame-driven effects
- **Testing:** Vitest + jsdom
- **Linting:** ESLint 9

High-level runtime layering:

1. `App.jsx` orchestrates scene branches, mode switching, and handler wiring.
2. Store/hooks compose stateful systems (cube, chaos, settings, levels, inputs).
3. 3D scene components render manifold/cube/worm visuals.
4. UI layer renders menus, wizards, HUD, overlays, and campaign flows.

---

## Codebase Map

- `src/App.jsx` — main app orchestration.
- `src/hooks/*` — store adapters and gameplay hooks (`useCubeState`, `useChaosMode`, `useHandsMode`, etc.).
- `src/game/*` — core puzzle math/state transitions (rotation, flips, verification, parity, win detection).
- `src/worm/*` — worm movement/gameplay variants, HUD, controls, camera.
- `src/3d/*` — cube/manifold rendering stack and visual effects.
- `src/components/*` — menus, overlays, setup wizards, screens, intro UI.
- `src/teach/*` — teach mode + solving guidance utilities.
- `src/levels/*` — level schema, validation, campaign packs, progression management.
- `src/modes/*` — additional mode domains (biomes, merge mode).
- `src/utils/*` — color schemes, backgrounds, graph/math helpers, constants, audio.
- `src/workers/*` — worker-based chaos/compute utilities.
- `public/models/biomes/*` + `public/environments/*` — 3D world/environment assets.

---

## Local Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Start Dev Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Testing, Linting, CI

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

### Lint

```bash
npm run lint
```

### Full CI Command

```bash
npm run ci
```

---

## Known Notes

- Merge mode includes code-level support for themed region tiers and overlays; final art asset completeness may vary by theme pack at runtime.
- The project intentionally blends puzzle precision with experimental manifold mechanics (chaos/disparity, worm traversal, holonomy), so some modes are more “sandbox research” than fixed competitive rulesets.

---

## License

MIT. See `LICENSE`.
