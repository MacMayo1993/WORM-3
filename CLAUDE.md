# CLAUDE.md

This file provides guidance for Claude Code when working on the WORM-3 project.

## Project Overview

WORM-3 (World of Rubik's Manifolds) is a 3D Rubik's Cube puzzle game built on real projective plane (RP2) topology. It features antipodal point identification, multiple game modes (Classic, Sudokube, Ultimate, Worm), a 10-level story campaign, a teaching mode, and co-op worm mode. Built with React 18, Three.js, and Zustand.

## Build & Development Commands

```bash
npm install --legacy-peer-deps   # Install dependencies (legacy-peer-deps required)
npm run dev                      # Start Vite dev server on port 5173
npm run build                    # Production build to dist/
npm run preview                  # Preview production build
npm run lint                     # ESLint check on src/
npm run lint:fix                 # ESLint auto-fix
npm run test                     # Run tests once (vitest run)
npm run test:watch               # Watch mode tests
npm run test:coverage            # Tests with V8 coverage report
npm run ci                       # Full CI pipeline: lint → test → build
```

Always use `--legacy-peer-deps` when installing dependencies.

## Testing

- **Framework**: Vitest with jsdom environment
- **Test location**: `src/__tests__/*.test.js`
- **Run all tests**: `npm run test`
- **Run a single test**: `npx vitest run src/__tests__/cubeRotation.test.js`
- **Coverage scope**: `src/game/**`, `src/utils/**`, `src/levels/**`
- **Globals**: Vitest globals enabled (`describe`, `it`, `expect`, `vi` available without import)

Test files follow the pattern:
```javascript
import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';

describe('makeCubies', () => {
  it('creates correct number of cubies', () => {
    const cubies = makeCubies(3);
    expect(cubies).toHaveLength(27);
  });
});
```

## Linting

- ESLint flat config (`eslint.config.js`)
- `no-unused-vars` configured with `^_` pattern for ignored args/vars
- React Hooks rules enforced; some strict hooks rules disabled (`refs`, `set-state-in-effect`, `purity`, `immutability`) due to Three.js/R3F patterns
- `no-console` is off (console allowed)

## Code Style

- **Formatter**: Prettier (`.prettierrc`)
- 2-space indentation, single quotes, semicolons, no trailing commas
- Print width: 140 characters
- LF line endings
- ES modules (`"type": "module"` in package.json)

## Architecture

### Directory Structure

```
src/
├── 3d/           # Three.js 3D components (CubeAssembly, Cubie, StickerPlane, materials)
├── components/
│   ├── menus/    # UI menus (MainMenu, TopMenuBar, SettingsMenu, MobileControls)
│   ├── screens/  # Full-screen overlays (Welcome, Victory, Tutorial, LevelSelect)
│   ├── overlays/ # In-game overlays (Cursor, Rotation buttons, Solve highlight)
│   └── intro/    # Welcome animation components
├── game/         # Pure game logic (NO React dependencies)
├── hooks/        # Custom React hooks (Zustand store + domain hooks)
├── levels/       # Level data and progression system
├── manifold/     # Manifold/wormhole visualization components
├── teach/        # Teaching mode (algorithms, solver, step-by-step UI)
├── utils/        # Constants, color schemes, audio
├── worm/         # Worm co-op mode (platformer, crawler)
├── App.jsx       # Main application component
└── main.jsx      # React entry point
```

### Key Design Principles

1. **Game logic is pure**: All files in `src/game/` are pure functions with zero React dependencies. They are easily testable and reusable.

2. **State via Zustand**: Global state lives in `src/hooks/useGameStore.js` (Zustand with `subscribeWithSelector`). Settings persist to `localStorage`.

3. **Modular hooks**: Domain logic is split across 12+ custom hooks in `src/hooks/`, each focused on one concern (cube state, animation, chaos, cursor, levels, settings, undo, etc.). Import them from `src/hooks/index.js`.

4. **Functional components only**: No class components. Use hooks for state and effects.

### State Management Pattern

```javascript
// Reading state
const cubies = useGameStore((state) => state.cubies);

// Updating state
const setCubies = useGameStore((state) => state.setCubies);
setCubies(newCubies);

// Computed updates
set((state) => ({ moves: state.moves + 1 }));
```

### Coordinate System

- **3D Grid**: `[x, y, z]` from 0 to `size-1`
- **Face directions**: `PX` (+X/Right), `NX` (-X/Left), `PY` (+Y/Top), `NY` (-Y/Bottom), `PZ` (+Z/Front), `NZ` (-Z/Back)
- **Face IDs**: 1=PZ (Red), 2=NX (Green), 3=PY (White), 4=NZ (Orange), 5=PX (Blue), 6=NY (Yellow)
- **Manifold Grid IDs**: Format `M${faceId}-${paddedIndex}` (e.g., `M1-001`)
- **Antipodal pairs**: Red↔Orange, Green↔Blue, White↔Yellow

### Cubie Data Structure

```javascript
{
  x, y, z,
  stickers: {
    'PX': { curr: 5, orig: 5, flips: 0, origPos: {x,y,z}, origDir: 'PX' },
    // ... up to 6 stickers per cubie
  }
}
```

## CI/CD

- **Pipeline**: `.github/workflows/deploy.yml` — lint → test → build → deploy
- **Deploy**: GitHub Pages from `dist/` on push to `main`
- **Base path**: `/WORM-3/` (configured in `vite.config.js`)
- **Node version**: 20 in CI, 18 in devcontainer

## Naming Conventions

- **Components**: PascalCase `.jsx` files (`CubeAssembly.jsx`)
- **Logic/Utilities**: camelCase `.js` files (`cubeRotation.js`, `winDetection.js`)
- **Hooks**: `use*` prefix (`useCubeState.js`)
- **Constants**: UPPER_SNAKE_CASE (`COLORS`, `ANTIPODAL_COLOR`)
- **Tests**: `*.test.js` in `src/__tests__/`

## Common Imports

```javascript
// React & 3D
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Game logic (pure functions)
import { makeCubies } from './game/cubeState.js';
import { rotateSliceCubies } from './game/cubeRotation.js';
import { detectWinConditions } from './game/winDetection.js';

// Hooks (import from barrel file)
import { useGameStore, useCubeState, useAnimation } from './hooks/index.js';

// Constants
import { COLORS, ANTIPODAL_COLOR, DIR_VECTORS } from './utils/constants.js';
```

## Important Notes

- The project uses `.js` extensions explicitly in imports (ES modules requirement)
- Three.js/R3F components run inside a `<Canvas>` context — they use `useFrame` and Three.js primitives, not DOM elements
- Animations use both GSAP and requestAnimationFrame
- Mobile support is built-in with touch controls (`MobileControls.jsx`) and responsive layout
- Cube sizes range from 2×2 to 5×5, configurable per level
