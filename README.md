# Worm3 Puzzle

An interactive 3D Rubik's Cube puzzle exploring antipodal topology, built with React and Three.js.

## Overview

Worm3 Puzzle is a web-based 3D puzzle game that implements a Rubik's Cube with unique topological features. Experience the classic puzzle with an innovative twist involving antipodal face relationships and wormhole mechanics.

## Features

- **Interactive 3D Rubik's Cube**: Fully manipulable 3D cube using mouse controls
- **Antipodal Topology**: Explore mathematical relationships between opposite faces
- **Wormhole Mechanics**: Special visual effects for topological connections
- **Smooth Animations**: Fluid slice rotations and transitions
- **Modern UI**: Clean, responsive interface built with React
- **Keyboard & Mouse Controls**: Intuitive controls for cube manipulation

## Technology Stack

- **React** 18.2.0 - UI framework
- **Three.js** 0.159.0 - 3D graphics engine
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for React Three Fiber
- **Vite** - Fast build tool and dev server
- **ESLint** - Code linting

## Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher

## Installation

1. Clone the repository:
```bash
git clone https://github.com/MacMayo1993/Worm3-puzzle.git
cd Worm3-puzzle
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## How to Play

1. **Rotate Slices**: Click and drag on cube faces to rotate slices
2. **Camera Controls**: Use mouse to orbit, zoom, and pan around the cube
3. **Observe Patterns**: Watch how the antipodal relationships affect the puzzle

## Project Structure

```
Worm3-puzzle/
├── public/          # Static assets
├── src/
│   ├── App.jsx      # Main application component with cube logic
│   ├── App.css      # Styles
│   ├── main.jsx     # Application entry point
│   └── assets/      # React assets
├── index.html       # HTML template
├── vite.config.js   # Vite configuration
├── eslint.config.js # ESLint configuration
└── package.json     # Project dependencies and scripts
```

## Mathematical Concepts

This puzzle explores **antipodal topology** - the mathematical relationship between opposite faces of a cube. Each face has an antipodal counterpart:
- Red (1) ↔ Orange (4)
- Green (2) ↔ Blue (5)
- White (3) ↔ Yellow (6)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Mac Mayo** - [@MacMayo1993](https://github.com/MacMayo1993)

## Acknowledgments

- Inspired by classical Rubik's Cube mechanics
- Built with the amazing React Three Fiber community tools
- Thanks to the Three.js team for the powerful 3D engine
