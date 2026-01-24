# WORM-3: Antipodal Topology Puzzle

[![Build Status](https://github.com/MacMayo1993/WORM-3/actions/workflows/deploy.yml/badge.svg)](https://github.com/MacMayo1993/WORM-3/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://macmayo1993.github.io/WORM-3/)

A 3D puzzle game that fuses **Rubik's Cube mechanics** with **projective plane topology**. Flip stickers through wormholes, battle chaos propagation, and master non-orientable manifolds.

## [Play Now](https://macmayo1993.github.io/WORM-3/)

---

## Game Overview

WORM-3 takes the classic Rubik's Cube and warps it through mathematical topology. Every sticker has an **antipodal twin** on the opposite side of the cube. Flip one, and both change simultaneously through a visible wormhole connection.

**Antipodal Color Pairs:**
- Red ↔ Orange
- Green ↔ Blue
- White ↔ Yellow

---

## Game Modes

### Standard Mode
Classic cube manipulation. Drag to rotate the view, click stickers to rotate slices.

### Flip Mode
Click any sticker to flip it AND its antipodal partner through a wormhole tunnel. Watch the particle travel through the connection as both stickers swap colors.

### Chaos Mode (4 Levels)
Unstable stickers spread their corruption to neighbors. The longer you leave flipped stickers, the more they cascade.

| Level | Burst Duration | Propagation Rate | Difficulty |
|-------|---------------|------------------|------------|
| L1 | 1 second | 3% per flip tally | Gentle |
| L2 | 2 seconds | 6% per flip tally | Moderate |
| L3 | 3 seconds | 9% per flip tally | Aggressive |
| L4 | 4 seconds | 12% per flip tally | Extreme |

**How Chaos Works:**
- Chaos runs in bursts (duration scales with level)
- Tile-to-tile propagation speed: 350ms (constant)
- Probability scales with each sticker's flip count
- Cross-face propagation follows manifold topology

### Auto-Rotate Mode
Enable within Chaos Mode. The cube rotates itself based on disparity (how many stickers are out of place).

| Disparity | Rotation Interval |
|-----------|------------------|
| 0% (solved) | 10 seconds |
| 50% | ~5 seconds |
| 100% (max chaos) | 0.75 seconds |

A **Tetris-style preview panel** shows the upcoming rotation with:
- Grid highlighting the affected slice
- Direction arrow (↻ or ↺)
- Countdown bar (green → red as time runs out)
- Axis label (X1, Y2, Z3, etc.)

---

## Win Conditions

### Rubik's Cube (Classic)
All stickers on each face match their target color.

### Sudokube (Latin Square)
Each face forms a valid Latin square where:
- Every row contains values 1-N exactly once
- Every column contains values 1-N exactly once

### Ultimate Victory
Achieve **both** Rubik's AND Sudokube simultaneously. Triggers confetti celebration.

### WORM³ Secret Achievement
Solve the cube AND ensure every sticker has traveled through a wormhole at least once. Tracked via flip counters on each sticker.

---

## Visual Modes

| Mode | Description |
|------|-------------|
| **Classic** | Traditional colored stickers |
| **Grid** | Manifold IDs overlaid (M1-001 format) |
| **Sudokube** | Latin square numbers (1-N) |
| **Wireframe** | LED-style edges, retro aesthetics |

---

## Visual Effects

### Wormhole Tunnels
Toggle visibility with `T`. Dynamic strand-based tunnels with:
- 1-50 strands based on flip count
- Spiral animations with configurable angles
- Electrical spark effects at high intensity
- Color gradient between antipodal pairs
- Pulsing opacity animations

### Exploded View
Toggle with `X`. Cube pieces spread outward at 1.8× expansion, revealing internal structure.

### Black Hole Environment
Procedural GLSL shader background featuring:
- Event horizon (pure black center)
- Rotating accretion disk (orange/blue matter)
- Photon sphere with gravitational lensing
- Hawking radiation glow
- Procedural star field
- Flash pulse on sticker flips

### Chaos Visuals
- **ChaosWave**: Pink spheres traveling between cascading stickers
- **Flip Propagation Wave**: Expanding rings with 6-directional trail particles
- **Heat Map**: Color-coded glow (blue → cyan → yellow → red) based on flip intensity

### Tally Marks
Each sticker displays its flip count using traditional tally marks (groups of 5). High counts show numerical display.

---

## Controls

### Mouse
| Action | Effect |
|--------|--------|
| Left Drag | Rotate cube view |
| Left Click Sticker | Rotate slice (or flip in Flip Mode) |
| Right Click Sticker | Force flip regardless of mode |
| Shift + Drag | Rotate entire face |

### Keyboard

**Navigation:**
| Key | Action |
|-----|--------|
| Arrow Keys | Move cursor between stickers |
| W/A/S/D | Rotate slices relative to cursor |
| Q/E | Rotate face counter-clockwise/clockwise |

**Actions:**
| Key | Action |
|-----|--------|
| F | Flip sticker at cursor |
| Space | Shuffle cube (25 random rotations) |
| R | Reset to solved state |

**Toggles:**
| Key | Action |
|-----|--------|
| G | Toggle Flip Mode |
| T | Toggle wormhole tunnels |
| X | Toggle exploded view |
| V | Cycle visual modes |
| C | Toggle Chaos Mode |
| H or ? | Toggle help menu |
| Esc | Close menus / hide cursor |

---

## UI Elements

### Top Menu Bar
Real-time statistics:
- **M** (Moves): Total rotations performed
- **F** (Flips): Total wormhole traversals
- **W** (Wormholes): Currently active flipped pairs
- **Entropy**: Percentage of displaced stickers
- **Timer**: Elapsed time (MM:SS)

### Face Progress Bars
Visual indicators showing completion percentage for each of the 6 faces.

### Parity Indicator
- **EVEN** (cyan): Cube is returnable to original state
- **ODD** (purple): Fundamental twist exists

### Instability Tracker (Chaos Mode)
| Level | Threshold | Color |
|-------|-----------|-------|
| STABLE | <25% | Green |
| UNSTABLE | 25-50% | Yellow |
| CRITICAL | 50-75% | Orange |
| CHAOS | >75% | Red |

---

## Cube Sizes

| Size | Complexity | Camera Distance |
|------|------------|-----------------|
| 3×3 | Standard | 10 units |
| 4×4 | Medium | 14 units |
| 5×5 | Expert | 18 units |

---

## Mathematical Foundation

### Real Projective Plane (RP²)
The cube surface is treated as a **non-orientable manifold** where antipodal points are identified. This creates the wormhole topology.

### Antipodal Mapping
Each face maps to its opposite:
- Front (PZ) ↔ Back (NZ)
- Left (NX) ↔ Right (PX)
- Top (PY) ↔ Bottom (NY)

### Manifold Grid System
Stickers are indexed with IDs like `M1-001` for O(1) antipodal lookup. Cross-face neighbor detection follows manifold topology for proper chaos propagation.

### Latin Squares
Sudokube mode validates that each face forms a proper Latin square where values `(row + col) % size + 1` create unique row/column combinations.

---

## Technical Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.2.0 |
| 3D Engine | Three.js | 0.159.0 |
| React-Three | @react-three/fiber | 8.15.16 |
| 3D Helpers | @react-three/drei | 9.93.0 |
| Build Tool | Vite | 5.4.21 |
| Shaders | Custom GLSL | - |

### Key Technical Features
- **Procedural Shaders**: Black hole environment, manifold grid visualization
- **Quadratic Bezier Curves**: Smooth wormhole tunnel paths
- **BufferGeometry**: Optimized tunnel strand rendering
- **requestAnimationFrame**: 60fps animations
- **useMemo/useRef**: Performance-optimized React patterns

---

## Project Structure

```
WORM-3/
├── src/
│   ├── game/           # Cube state, rotations, win detection, manifold logic
│   ├── 3d/             # CubeAssembly, Cubie, StickerPlane, lighting
│   ├── manifold/       # WormholeTunnel, ManifoldGrid, FlipPropagationWave
│   ├── components/
│   │   ├── menus/      # TopMenuBar, settings
│   │   ├── screens/    # Tutorial, Victory, MainMenu
│   │   └── overlays/   # RotationPreview, InstabilityTracker, CursorHighlight
│   ├── utils/          # Constants, audio, coordinates
│   ├── App.jsx         # Main application state and game loop
│   └── App.css         # Styling
├── public/
│   └── sounds/         # Audio assets
└── dist/               # Production build
```

---

## Quick Start

### Play Online
Visit [https://macmayo1993.github.io/WORM-3/](https://macmayo1993.github.io/WORM-3/)

### Local Development
```bash
git clone https://github.com/MacMayo1993/WORM-3.git
cd WORM-3
npm install
npm run dev
# Open http://localhost:5173
```

### Production Build
```bash
npm run build
npm run preview
```

---

## Deployment

Automated via GitHub Actions:
1. Push to `main` branch
2. Build runs (`npm run build`)
3. Deploys to GitHub Pages
4. Live at [https://macmayo1993.github.io/WORM-3/](https://macmayo1993.github.io/WORM-3/)

---

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and topology math
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development setup and guidelines
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'feat: add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open Pull Request

---

## License

MIT License - see [LICENSE](./LICENSE)

---

## Credits

Created by [MacMayo1993](https://github.com/MacMayo1993)

Built with React, Three.js, and topology.

---

**[Play Now](https://macmayo1993.github.io/WORM-3/)**
