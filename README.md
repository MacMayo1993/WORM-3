# WORM-3

**A topological cube game where opposite faces are identified (RP²).**

WORM-3 is an interactive 3D puzzle/sandbox built around a Real Projective Plane interpretation of a Rubik-like cube. Instead of treating opposite faces as independent, WORM-3 models antipodal identification and exposes it through flips, tunnel travel, parity systems, teaching overlays, chaos, and character-based traversal modes.

**Live:** https://macmayo1993.github.io/WORM-3/

---

## Table of Contents

- [What This Project Is](#what-this-project-is)
- [Mode Reference (Complete)](#mode-reference-complete)
  - [1) Core Puzzle Modes](#1-core-puzzle-modes)
  - [2) System/Overlay Modes](#2-systemoverlay-modes)
  - [3) WORM Family Modes](#3-worm-family-modes)
  - [4) Disparity Mode](#4-disparity-mode)
  - [5) Holonomy Mode](#5-holonomy-mode)
  - [6) Explore / Freeplay](#6-explore--freeplay)
  - [7) World / Biome Mode](#7-world--biome-mode)
  - [8) Level Campaign](#8-level-campaign)
- [Controls (By Mode)](#controls-by-mode)
- [WORM Healer Control Modes](#worm-healer-control-modes)
- [Visual Systems](#visual-systems)
- [Mathematical Model](#mathematical-model)
- [Architecture Overview](#architecture-overview)
- [Development](#development)
- [Testing](#testing)
- [License](#license)

---

## What This Project Is

WORM-3 combines:

- A cube-state engine (slice rotations, sticker flips, parity, win detection).
- Multiple game modes that reinterpret the same cube/manifold in different ways.
- React + React Three Fiber rendering stack with heavy shader/VFX use.
- A Zustand global store coordinating gameplay, HUD, menus, and mode state.

The guiding idea is that face-opposites are not simply “other sides” of a cube, but identified through antipodal mapping. That makes orientation and traversal behavior very different from a standard orientable cube game.

---

## Mode Reference (Complete)

## 1) Core Puzzle Modes

These are the fundamental rule sets for solving the cube-like puzzle state.

### Classic

- Goal: restore face color consistency under projective/antipodal constraints.
- Primary actions: slice rotations + optional sticker flips (depending on setup/rules).
- Good for: baseline puzzle flow and parity intuition.

### Sudokube

- Goal: satisfy Latin-square-like constraints per face (number/pattern consistency by row/column rules).
- Adds combinatorial constraints beyond raw color restoration.

### Ultimate

- Goal: satisfy both color and Sudokube-style constraints simultaneously.
- Hardest pure puzzle target among the core solve modes.

---

## 2) System/Overlay Modes

These can be active with puzzle modes and alter interaction or information density.

### Chaos Mode

- Introduces dynamic instability (auto-rotation/cascade pressure depending on settings/level).
- Changes pacing from deterministic solve to real-time adaptation.

### Hands Mode

- Speedcubing-style key interaction layer.
- Tracks move cadence and speed-oriented input behavior.

### Teach Mode (CFOP assistant flow)

- Step-guided instructional pipeline.
- Highlights layers/targets, supports progression learning rather than free solving.

### Cursor / Accessibility Controls

- Keyboard-first sticker/cursor interaction paths.
- Supports non-mouse workflows and structured tile targeting.

---

## 3) WORM Family Modes

WORM modes turn cube/manifold state into movement/traversal gameplay.

### WORM (Surface)

- Worm advances over cube surfaces tile-to-tile.
- Direction and body trail create snake-like routing constraints.
- Uses flips/parity zones as hazards/opportunities depending on variant.

### WORM (Tunnel)

- Worm travels through antipodal tunnels inside the cube volume.
- Tunnel routing follows tunnel paths through the cube core.
- Tracks tunnel-side activity/inactivity for traversal logic in newer implementations.
- Orb collection and self-collision still govern run survival.

### Healer WORM (Chase-cam action mode)

- Real-time crawler variant with character-like movement and jump mechanics.
- Includes wormhole/tunnel transitions, tunnel camera phases, and HUD-driven run state.
- Features:
  - jump systems (including multi-jump logic),
  - delayed tunnel triggering windows,
  - self-collision windows/grace logic,
  - tunnel surf camera behavior + tunnel FX,
  - optional oriented vs non-oriented input behavior.

### Co-op Platformer WORM

- Split-responsibility style mode where crawler and cube manipulation interplay.
- Platformer HUD and movement controls coexist with cube interactions.

---

## 4) Disparity Mode

- Competitive/elimination-styled manifold pressure mode.
- Uses flip-cap/death style logic and last-survivor/winner tracking systems.
- Includes setup wizard flow and countdown/start behavior.
- Integrates with chaos pressure and elimination visuals.

---

## 5) Holonomy Mode

- Focuses on path-dependent orientation/transport behavior.
- Exposes geometric phase/parallel transport intuition through traversal and HUD overlays.
- Serves as a mathematically focused exploratory mode rather than classic “solve fastest”.

---

## 6) Explore / Freeplay

- Sandbox entry for custom cube size, visuals, and mode toggles.
- Ideal for experimentation without strict campaign sequencing.
- Commonly used to stress-test interactions between flip systems, tunnels, and view modes.

---

## 7) World / Biome Mode

- Environment/scene theming layer.
- Changes visual world style while keeping gameplay state model consistent.
- Useful for immersion and readability testing under varied art directions.

---

## 8) Level Campaign

- Structured progression with tutorials/cutscenes and staged mechanic onboarding.
- Teaches topology/mechanics incrementally.
- Includes level-specific setup constraints and next-level transitions.

---

## Controls (By Mode)

## Global Cube Interaction

- Drag / swipe: rotate slices.
- Flip interaction: sticker flip mode and direct tile interactions (depending on active setup).
- Menu/HUD controls: mode toggles, settings, overlays.

## WORM Surface/Tunnel

- Keyboard/game HUD controls for directional movement.
- Jump and run-state interactions in Healer/platformer variants.
- Mobile/touch controls include swipe-driven directional input and jump action.

## Healer-specific

- Arrow input + swipe mapping.
- Jump action (space / HUD jump button / touch).
- Control mode toggle in HUD (Oriented / Non-Oriented).

---

## WORM Healer Control Modes

WORM Healer includes two input interpretations:

### Non-Oriented (legacy / manifold-relative)

- Left/right are interpreted relative to worm heading.
- Reinforces non-orientable navigation feel.
- More mathematically “raw” but less intuitive for some players.

### Oriented (camera/view-relative)

- Up/left/down/right map relative to what the player sees on screen.
- Better for onboarding and casual usability.
- Especially useful in chase-cam + tunnel transitions.

---

## Visual Systems

WORM-3 includes multiple rendering overlays/systems layered on gameplay state:

- Antipodal tunnel network visualization.
- Void core and manifold-centric interior rendering.
- Flip propagation/chaos wave effects.
- Disparity and parity HUD overlays.
- Tunnel travel camera states and tunnel particle/spark effects.
- Environment packs/biome worlds.

---

## Mathematical Model

The project models the cube under antipodal identification inspired by:

- **RP² viewpoint**: opposite points/faces identified under quotient intuition.
- **Non-orientability effects**: control/heading intuition can diverge from viewer intuition.
- **Parity and path dependence**: state updates can reflect topology-aware transitions.

This is why WORM-3 can feel fundamentally different from a standard cube simulator.

---

## Architecture Overview

- **UI + scene orchestration:** `src/App.jsx`
- **Global state:** `src/hooks/useGameStore.js` (Zustand)
- **Cube/game logic:** `src/game/*`
- **WORM systems:** `src/worm/*`
- **Manifold/topology visual systems:** `src/manifold/*`
- **Teaching/solver flow:** `src/teach/*`
- **Overlays/menus/screens:** `src/components/*`
- **Levels/content packs:** `src/levels/*`

---

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Run Dev Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Build

```bash
npm run preview
```

---

## Testing

### Unit Tests

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

---

## License

MIT (see `LICENSE`).
