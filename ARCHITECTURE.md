# WORM-3 Architecture Documentation

## Overview

WORM-3 is a mathematically sophisticated 3D puzzle game that explores non-orientable manifolds through an interactive Rubik's Cube interface. The game combines classical cube-solving mechanics with projective plane topology and antipodal point identification.

## Mathematical Foundation

### Antipodal Topology

The core mechanic revolves around **antipodal point identification** from projective plane topology:

- **Antipodal Pairs**: Opposite faces of the cube are mapped together (Red↔Orange, Green↔Blue, White↔Yellow)
- **Flip Mechanism**: Clicking a sticker flips both it AND its antipodal counterpart simultaneously
- **Manifold Grid**: Visual representation showing how the projective plane wraps around itself
- **Wormhole Tunnels**: 3D visualizations of the connections between antipodal stickers

### Win Conditions

1. **Rubik's Cube** - Classic solving: all faces uniform color
2. **Sudokube** - All faces form valid Latin squares (each row/column contains each value 1-N exactly once)
3. **Ultimate** - Both Rubik's and Sudokube conditions satisfied simultaneously

### Chaos Mode

Implements a dynamic instability system where flipped stickers can spontaneously cascade:
- **Unstable Stickers**: Stickers that have been flipped and are out of place
- **Cascade Probability**: Based on flip count and chaos level (1-4)
- **Neighbor Propagation**: Unstable stickers can trigger flips in adjacent stickers

## Code Architecture

### Directory Structure

```
src/
├── utils/                  # Utility functions and constants
│   ├── constants.js        # Color mappings, direction vectors, antipodal mapping
│   ├── audio.js            # Audio playback and haptic feedback
│   └── smartRouting.js     # Tunnel routing algorithms
│
├── game/                   # Core game logic
│   ├── cubeState.js        # Cube initialization and state management
│   ├── cubeRotation.js     # Rotation algorithms
│   ├── manifoldLogic.js    # Antipodal mapping and flip logic
│   ├── winDetection.js     # Win condition checking
│   └── coordinates.js      # Position and grid calculations
│
├── manifold/               # Topology visualization components
│   ├── ManifoldGrid.jsx    # Shader-based projective plane grid
│   ├── WormholeTunnel.jsx  # Individual tunnel visualization
│   ├── WormholeNetwork.jsx # Manages all active tunnels
│   ├── ChaosWave.jsx       # Cascade effect visualization
│   ├── TallyMarks.jsx      # Flip history markers
│   ├── IntroTunnel.jsx     # Welcome animation tunnels
│   ├── WormParticle.jsx    # Particle effects
│   └── ArrivalBurst.jsx    # Arrival animations
│
├── 3d/                     # Three.js 3D components
│   ├── CubeAssembly.jsx    # Main cube with interaction logic
│   ├── Cubie.jsx           # Individual cube piece (3×3×3 grid)
│   ├── StickerPlane.jsx    # Individual sticker face
│   ├── WireframeEdge.jsx   # LED-style edges for wireframe mode
│   └── DragGuide.jsx       # Rotation direction indicators
│
├── components/
│   ├── menus/              # UI menus
│   │   ├── TopMenuBar.jsx   # Stats and progress bar
│   │   ├── MainMenu.jsx     # Landing screen
│   │   ├── SettingsMenu.jsx # Configuration
│   │   └── HelpMenu.jsx     # Controls and help
│   │
│   ├── screens/            # Full-screen overlays
│   │   ├── WelcomeScreen.jsx      # Animated intro
│   │   ├── VictoryScreen.jsx      # Win celebration
│   │   ├── Tutorial.jsx           # Quick start guide
│   │   └── FirstFlipTutorial.jsx  # Detailed flip tutorial
│   │
│   ├── overlays/           # In-game overlays
│   │   ├── InstabilityTracker.jsx # Chaos mode indicator
│   │   └── CursorHighlight.jsx    # Keyboard cursor
│   │
│   └── intro/              # Welcome animation components
│       ├── IntroScene.jsx
│       ├── IntroCubie.jsx
│       ├── IntroSticker.jsx
│       └── TextOverlay.jsx
│
├── App.jsx                 # Main application component
├── App.css                 # Retro 70s styling
└── main.jsx                # React entry point
```

### Data Flow

#### Cube State

The cube state is a 3D array (`size × size × size`) where each cell contains:

```javascript
{
  x, y, z,              // Current position
  stickers: {
    PX: {                // Right face (+X direction)
      curr: 5,           // Current color (1-6)
      orig: 5,           // Original color
      flips: 0,          // Number of times flipped
      origPos: {x,y,z},  // Original position
      origDir: 'PX'      // Original direction
    },
    // ... up to 6 stickers per cubie (NX, PY, NY, PZ, NZ)
  }
}
```

#### Manifold Map

A `Map` structure that enables O(1) lookup of antipodal stickers:

```javascript
Map<string, {x, y, z, dirKey, sticker}>
// Key format: "M{face}-{gridId}"  e.g., "M1-001", "M4-009"
// Maps from manifold grid ID to current sticker location
```

#### Game State (App.jsx)

All game state is managed in the main `WORM3` component:

- **Cube State**: `cubies`, `size`, `moves`
- **Visual State**: `visualMode`, `flipMode`, `showTunnels`, `exploded`
- **Animation State**: `animState`, `pendingMove`, `explosionT`
- **Chaos State**: `chaosLevel`, `cascades`
- **Win State**: `victory`, `achievedWins`, `gameTime`, `hasShuffled`
- **Input State**: `cursor`, `showCursor`

### Key Algorithms

#### Rotation Algorithm (cubeRotation.js)

```
1. Identify all cubies in the slice to rotate
2. Calculate new positions using rotation matrices
3. Rotate sticker directions accordingly
4. Update cube state with new positions
```

#### Antipodal Flip (manifoldLogic.js)

```
1. Build manifold grid map from current cube state
2. Find the clicked sticker's manifold grid ID
3. Calculate antipodal grid ID using ANTIPODAL_COLOR mapping
4. Look up antipodal sticker location in map
5. Flip both stickers to their antipodal colors
6. Increment flip counters
```

#### Win Detection (winDetection.js)

**Rubik's Check**: O(n³) - verify each sticker matches its face's expected color

**Sudokube Check**: O(n³)
1. For each face, build a grid of Latin square values
2. Check each row for unique values 1-n
3. Check each column for unique values 1-n

### Component Communication

```
App.jsx (State Management)
  ├─> CubeAssembly (3D Rendering)
  │     ├─> Cubie (Individual Pieces)
  │     │     └─> StickerPlane (Click Handlers)
  │     ├─> WormholeNetwork (Tunnels)
  │     └─> CursorHighlight (Keyboard)
  │
  ├─> TopMenuBar (Stats Display)
  ├─> ManifoldGrid (Background)
  ├─> VictoryScreen (Win Celebration)
  └─> Various Menus/Overlays
```

### Rendering Pipeline

1. **Canvas Setup** (App.jsx) - Camera, lights, environment
2. **ManifoldGrid** (Background layer) - Shader-based sphere
3. **CubeAssembly** - Main cube with interactions
4. **Wormhole Network** - Dynamic tunnels based on flip state
5. **UI Layer** - HTML overlays (menus, stats, controls)

## Technology Stack

- **React 18** - Component framework
- **Three.js** - 3D rendering engine
- **@react-three/fiber** - React bindings for Three.js
- **@react-three/drei** - Helper components
- **Vite** - Build tool and dev server

## Performance Considerations

- **useMemo** for expensive calculations (manifoldMap, metrics)
- **useRef** for animation frame tracking
- **Suspense** for lazy loading 3D assets
- **requestAnimationFrame** for smooth animations
- **Instanced rendering** potential optimization for large cubes

## Future Enhancements

- **State Persistence**: Save/load game state
- **Undo/Redo**: Move history tracking
- **Solver**: Algorithm visualization
- **Multiplayer**: Shared cube state
- **Custom Sizes**: Support for 2×2 and 6×6+ cubes
- **Type Safety**: Convert to TypeScript
- **Testing**: Unit tests for game logic
