# WORM-3: Antipodal Topology Puzzle

[![Build Status](https://github.com/MacMayo1993/WORM-3/actions/workflows/deploy.yml/badge.svg)](https://github.com/MacMayo1993/WORM-3/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://macmayo1993.github.io/WORM-3/)

An interactive 3D puzzle game exploring **non-orientable manifolds** and **projective plane topology** through a Rubik's Cube interface. Combines classical cube-solving mechanics with antipodal point identification for a mathematically sophisticated challenge.

## 🎮 [Play Now](https://macmayo1993.github.io/WORM-3/)

**Live Demo**: [https://macmayo1993.github.io/WORM-3/](https://macmayo1993.github.io/WORM-3/)

## 🌟 Features

### Game Mechanics
- **Rubik's Cube Solver**: Classic 3×3, 4×4, and 5×5 cube solving
- **Flip Mode**: Click stickers to flip them AND their antipodal counterparts simultaneously
- **Chaos Mode**: Unstable stickers cascade in 4 difficulty levels
- **Multiple Win Conditions**:
  - **Rubik's**: All faces uniform color (classic mode)
  - **Sudokube**: All faces are valid Latin squares
  - **Ultimate**: Both conditions achieved simultaneously

### Visual Modes
- **Classic**: Traditional color display
- **Grid**: Latin square values shown
- **Sudokube**: Hybrid color + value display
- **Wireframe**: LED-style edges with retro aesthetics

### Topology Features
- **Manifold Grid**: Animated shader showing projective plane coordinates
- **Wormhole Tunnels**: 3D visualization of antipodal connections
- **Antipodal Mapping**: Red↔Orange, Green↔Blue, White↔Yellow
- **Exploded View**: Inspect cube internal structure

### Controls
- **Mouse Drag**: Rotate cube
- **Click Stickers**: Rotate slice (normal mode) or flip pair (flip mode)
- **Keyboard**: Full speedcube controls (WASD + QE + Arrow keys)
- **Explosion Toggle**: See cube pieces separated
- **Tutorial System**: Interactive onboarding

## 🎯 How to Play

### Basic Controls

**Mouse:**
- **Left Click + Drag on Cube**: Rotate view
- **Left Click on Sticker**: Rotate that slice (or flip if flip mode is on)
- **Right Click on Sticker**: Flip sticker pair (when flip mode enabled)

**Keyboard:**
- **Arrow Keys**: Move cursor between stickers
- **W/A/S/D**: Rotate slices relative to cursor position
- **Q/E**: Rotate face counter-clockwise/clockwise
- **F**: Flip sticker at cursor (when flip mode enabled)
- **H or ?**: Toggle help menu
- **T**: Toggle wormhole tunnels
- **X**: Toggle exploded view
- **V**: Cycle visual modes
- **C**: Toggle chaos mode
- **ESC**: Close menus/hide cursor

### Getting Started

1. **Click "SHUFFLE"** to scramble the cube
2. **Try Flip Mode**: Enable "FLIP" and click stickers to see antipodal pairs flip together
3. **Watch the Tutorials**: Follow the welcome tutorial and first-flip guide
4. **Explore Chaos Mode**: Enable "CHAOS" to see unstable stickers cascade
5. **Try Different Sizes**: Switch between 3×3, 4×4, and 5×5 cubes

### Win Conditions Explained

**Rubik's Cube** (Classic):
- Solve like a traditional Rubik's cube
- All stickers on each face must be the same color

**Sudokube** (Latin Square):
- Each face must form a valid Latin square
- Each row and column contains values 1-N exactly once
- Values are based on sticker positions, not colors

**Ultimate** (Master Challenge):
- Achieve both Rubik's AND Sudokube simultaneously
- The hardest win condition in the game

## 🚀 Quick Start

### Play Online

Visit [https://macmayo1993.github.io/WORM-3/](https://macmayo1993.github.io/WORM-3/) to play immediately in your browser.

### Local Development

```bash
# Clone the repository
git clone https://github.com/MacMayo1993/WORM-3.git
cd WORM-3

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Build for Production

```bash
npm run build
npm run preview
```

## 🛠️ Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | React | 18.2.0 |
| **3D Engine** | Three.js | 0.159.0 |
| **React-Three** | @react-three/fiber | 8.15.16 |
| **3D Helpers** | @react-three/drei | 9.93.0 |
| **Build Tool** | Vite | 5.4.21 |
| **Runtime** | Node.js | 18.x |
| **Deployment** | GitHub Pages | Automated |

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, topology math, and code structure
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development setup, workflow, and guidelines
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute to the project

## 🎨 Project Structure

```
WORM-3/
├── src/
│   ├── utils/          # Constants, audio, routing algorithms
│   ├── game/           # Cube state, rotations, win detection
│   ├── manifold/       # Topology visualization components
│   ├── 3d/             # Three.js 3D components
│   ├── components/     # UI menus, screens, overlays
│   ├── App.jsx         # Main application (973 lines, refactored from 4,459)
│   └── App.css         # Retro 70s styling
├── public/             # Static assets
└── dist/               # Build output
```

## 🧮 Mathematical Background

This game explores concepts from **algebraic topology**:

- **Real Projective Plane (RP²)**: Formed by identifying antipodal points on a sphere
- **Non-Orientable Manifolds**: Surfaces where orientation cannot be consistently defined
- **Antipodal Mapping**: Each face maps to its opposite (Red↔Orange, etc.)
- **Latin Squares**: Combinatorial structures with unique row/column values
- **Projective Coordinates**: Visual representation via shader mathematics

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed mathematical explanations.

## 📦 Deployment

This project uses **GitHub Actions** for automated deployment to GitHub Pages.

**Workflow:**
1. Push to `main` branch
2. GitHub Actions builds the project (`npm run build`)
3. Deploys `dist/` folder to `gh-pages` branch
4. Site updates at [https://macmayo1993.github.io/WORM-3/](https://macmayo1993.github.io/WORM-3/)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Quick Contribution Steps:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Issues & Support

- **Bug Reports**: [GitHub Issues](https://github.com/MacMayo1993/WORM-3/issues/new?template=bug_report.md)
- **Feature Requests**: [GitHub Issues](https://github.com/MacMayo1993/WORM-3/issues/new?template=feature_request.md)
- **Questions**: [GitHub Discussions](https://github.com/MacMayo1993/WORM-3/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🎓 Credits

Created by [MacMayo1993](https://github.com/MacMayo1993)

**Technologies:**
- React Team - React framework
- Three.js Team - 3D rendering engine
- Poimandres - @react-three ecosystem
- Vite Team - Build tooling

## ⭐ Star History

If you find this project interesting, please consider giving it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=MacMayo1993/WORM-3&type=Date)](https://star-history.com/#MacMayo1993/WORM-3&Date)

---

**Made with ❤️ and topology** | [Play Now →](https://macmayo1993.github.io/WORM-3/)
