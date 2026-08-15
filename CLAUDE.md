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
├── holonomy/     # Holonomy loop mode
├── modes/        # Mode-specific rules (merge, city biome)
├── coming-soon/  # Preview environments for unreleased modes
├── workers/      # Web workers (chaos simulation)
├── assets/       # Static assets imported by components
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
import { checkRubiksWin } from './game/winDetection.js';

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
- **Flip cap**: never import `FLIP_CAP` to decide whether a tile is spent — read `selectEffectiveFlipCap(state)` from `useGameStore.js`. Disparity/Chaos sessions run on a configurable cap (3/8/13/20) and the constant is only the standard-play default; mixing the two is what let a tile show health remaining while refusing the player's tap. Pure helpers take the cap as a trailing argument (`flipStickerPair(..., flipCap)`).
- **Flips are paired and reversible**: `flipStickerPair` is atomic across the β-pair (both members move or neither), which keeps antipodalEngine's ∆ = 0 invariant. To take a flip back use `unflipStickerPair`, not a second `flipStickerPair` — re-flipping restores the colour but spends the tile's life again.
- **Screen ownership**: `src/hooks/uiSurfaces.js` decides which surface owns the screen. Anything that adds a full-screen modal should register there so keyboard gating and Escape-to-dismiss pick it up automatically; ambient side panels stay out of the blocking set.
- **UI theme**: shared tokens live in `src/utils/uiTheme.js` — `UI_FONT` (body text, mirrors `--ui-font` in App.css), `DISPLAY_FONT` (Bungee, big titles), `HAND_FONT` (Mobi's dialogue), `PAPER_*` (cream sheets: the player is reading or deciding and the panel owns the screen — wizards, store, help, level select), `NIGHT_*` (warm dark surfaces layered over the live 3D scene — victory, the mode carousel, in-scene viewers). There is no `GLASS_*` family; the old cold-navy set was removed in favour of `NIGHT_*`. Import these instead of hardcoding font stacks or panel colors; bare `monospace` is reserved for manifold grid IDs and algorithm notation

## Elemental Cube Art Upgrade Plan (Design Only)

This section is the implementation brief for a future Claude Code pass. It is intentionally a plan, not an instruction to change gameplay while doing unrelated work.

### Product intent and current-state reading

Elemental orbs are a temporary **presentation state** in Healer Worm mode, not a cube mutation or combat buff. Claiming an orb sets `sim.elementalType`, freezes the simulation for the short focus shot, then runs a ten-second wash while crawling. That key is mirrored into `wormElementalTheme`; `ElementalAtmosphere` composes the cube skin, particles, and fill light; the HUD shows the same definition; expiry clears the theme. Preserve that single source of truth and pause/tunnel clock behavior.

The current four-element pipeline is data-driven in `elementalDefs.js`, but rendering still branches by hand:

- **Water** and **ice** share `ElementalSurface` geometry and select separate shader modes.
- **Fire** uses per-cell flame sprites from `ElementalFireSkin`.
- **Nature/grass** reuses `GrassBlades`.
- `ElementalAtmosphere` supplies generic point particles plus an element-colored light.
- `ElementalCubeSkin` samples at most a 5×5 grid per face and follows each sampled live tile, so skins move with turning slices and remain bounded on large cubes.

The upgrade should make the **whole cube silhouette, seams, corners, light, and nearby space** express each element—not merely place a different texture over every sticker. The base sticker color, heal state, warning state, markings, raycasting, and worm navigation must remain legible and unchanged. Treat “cube state” below as a visual state layered on top of the authoritative puzzle/simulation state.

### Shared visual grammar

Every element should use the same readable three-scale composition:

1. **Sticker scale:** local material movement and small details that follow live cubies.
2. **Cube scale:** a distinct silhouette treatment spanning faces—edge flow, corner buildup, crowns, drips, arcs, or volume—so the active element reads from the overview camera.
3. **World scale:** sparse particles, reactive light, and occasional hero beats around the worm.

Keep a common claim/hold/release envelope. During the 1.8-second focus beat, sweep the effect outward from the claimed tile across the six faces instead of making all cells appear uniformly. During hold, use calm ambient motion with rare accents. During the last 1.25 seconds, stop spawning accents first, then dissolve cube-scale geometry, sticker details, light, and particles together. Element replacement should crossfade or cleanly reset all pooled effects; it must never leave geometry from the previous theme.

Do not hide the cube under six opaque boxes. Preserve a quiet inset over sticker centers for numbers, colors, danger indicators, bombs, orbs, and healing feedback. Put the strongest element cues along sticker edges, cube edges, corners, and outside the surface. Use the active theme to tint existing light, not flatten all face colors into one hue.

### Art direction by orb

#### Water — the cube becomes a moving aquarium

- Replace the repeated “wet tile” reading with one coherent water volume whose wave phase continues across cells while each face still follows live slice motion.
- Keep animated caustics and specular crests, but bias opacity lower at sticker centers and stronger along rims. Add a thin waterline meniscus around the cube silhouette.
- Run broad traveling swells across a face, then hand them across adjacent cube edges with phase offsets; do not require a watertight global mesh during slice turns.
- Add a few face-edge streams and corner droplets that peel away, orbit briefly, and fall upward/downward according to a consistent world gravity. Avoid a dense rain curtain.
- Around the worm, add a subtle displacement wake, two or three trailing bubbles, and a soft ripple ring when the head crosses a tile boundary. These are visual observers only and must not alter movement.
- Palette: deep blue body, cyan caustics, white foam accents. Lighting should feel refracted rather than merely blue-tinted.

#### Fire — the cube becomes a banked furnace

- Retain the successful flame-sprite vocabulary, but vary height and timing in coherent gust bands rather than independent identical flames on every sampled cell.
- Establish a dark ember-crust close to the surface, hot orange fissures along sticker gaps, and taller yellow-white flames concentrated at the silhouette and upper-facing edges.
- Add a slow heat-haze shell just above the cube and occasional ember vortices that follow the worm’s wake. The haze must not distort HUD or make tile selection inaccurate.
- Let corners flare in sequence during the claim sweep. During hold, rare localized “whoomph” pulses may briefly brighten one face without implying damage.
- Around the worm, use warm rim light, a short ember tail, and tiny contact sparks; never obscure bomb fuse colors or warning lights.
- Palette: near-black red crust, orange body, pale-gold cores. Avoid covering the cube in evenly spaced campfires.

#### Nature — the cube becomes a living terrarium

- Expand beyond identical grass tufts: use low moss/fine grass at sticker centers, thicker blades at gaps, and a few bounded vines that bridge neighboring cells visually without binding their transforms.
- Grow the treatment in visible stages during the claim beat: moss wash, grass sprout, then vine/flower accents. Reverse with drifting pollen and leaf motes on expiry rather than scaling all blades to zero at once.
- Give each face a controlled biome rhythm: clusters, clearings, and occasional small flowers or leaves seeded deterministically from face/cell keys. Preserve clean reading zones around gameplay marks.
- Add vine curls around outer cube edges and small leafy crowns at selected corners. Re-anchor or hide a bridge while either attached slice rotates so no vine stretches through space.
- Around the worm, bend nearby grass away from the head and emit a restrained pollen wake. This is a renderer-only proximity response.
- Palette: deep moss shadows, saturated green growth, soft mint highlights, rare warm flower accents. “Nature” is the player-facing label; keep the internal key `grass` unless a migration is deliberately planned.

#### Ice — the cube becomes a carved glacier

- Preserve the faceted plate shader and cracks, but add real silhouette thickness: frosted bevels along outer edges, crystal ridges at corners, and sparse icicles on world-downward edges.
- Make frost nucleate from the claim tile and branch through gaps; cracks should form a coherent hierarchy (large branch, medium plates, fine grain), not six unrelated noise fields.
- Use a translucent blue underlayer plus opaque white rim frost so healed green tiles cannot turn the ice muddy while markings remain readable.
- Add a slow internal light sweep and rare crystal twinkles, capped so the cube never strobes. During expiry, cracks dim, frost retreats, then a few shards sublimate into flakes.
- Around the worm, add a fine powder trail and a brief crystalline contact glint. Do not change traction or crawler physics.
- Palette: deep glacial blue shadows, clear cyan body, white rims. Favor hard facets and restrained sparkle over a flat pale film.

#### Lightning — the cube becomes a charged storm cage

Add a fifth `lightning` elemental definition with an electric-violet/blue body, white-hot accent, storm-dark fill light, a bolt badge/icon, a `lightning` particle kind, and Living-style-compatible tile identity. If no dedicated tile style exists, choose an explicit supported fallback rather than adding an invalid catalogue key merely to satisfy the definition test.

- Sticker scale: faint branching charge veins crawl mostly through gaps and rims; individual stickers pulse in short, non-simultaneous groups. Use a dark conductive sheen so white cores have contrast.
- Cube scale: charge rails trace outer cube edges and jump between selected corners. A low-opacity storm corona breathes around the silhouette. The claim sweep should arrive as one major bolt from the orb impact, then charge each face in sequence.
- World scale: sparse ion motes drift upward, with momentary local fill flashes when a strike lands. Avoid continuous full-screen bloom.
- Worm interaction: at randomized intervals, pick a point on or immediately beside a live worm segment, strike it from a nearby cube corner/charged surface point, show a white-blue contact flash and a few branching tendrils, then let residual charge crawl briefly along one or two body segments. This is playful “the worm is a lightning rod” staging: **no damage, stun, score, speed, heal, input interruption, or simulation mutation** unless a later game-design task explicitly adds those rules.
- Keep strikes fair and readable: never fire during countdown, pause, tunnel transit, death/victory, the elemental focus freeze, or reduced-motion mode; suppress them when the worm target is off-camera; use a minimum cooldown and no back-to-back hits on the same body point.
- Randomness must be seeded or emitted as render-only events from stable simulation data. Tests must not depend on `Math.random`, and network/replay determinism must not be affected.

### Reusing Chaos-mode bolts safely

`ChaosWave` already owns the desired bolt vocabulary: a jagged white core, colored halo, traveling spark head, ghost trail, optional seam flash/face bloom, and destination impact. Do **not** import the chaos cascade controller or fake chaos tile events to produce lightning-orb strikes.

Instead, refactor the visual primitive without changing Chaos behavior:

1. Extract reusable path construction and a configurable one-shot bolt renderer (working name `ElectricBolt`) from `ChaosWave`.
2. Keep `ChaosWave` as a thin compatibility wrapper supplying its current speed, cross-face bloom, colors, ghost trail, and completion semantics.
3. Give the primitive an explicit seed, start/end points, duration/speed, jitter, thickness/glow profile, branch count, and impact options. Avoid hidden per-instance `Math.random` for the lightning theme.
4. Add a lightweight branch mode for lightning strikes, but cap branches and geometries. Branches should fork late and fade before the main impact; Chaos defaults remain visually identical.
5. Introduce a lightning-theme strike scheduler/pool owned by the elemental renderer. It reads live worm segment transforms and phase/theme state, but writes nothing back to the sim.
6. Resolve live source and target positions every frame or snapshot them intentionally. A strike must not remain attached to a stale rest-grid point during a slice ride; conversely, a short ballistic strike may snapshot its target so the bolt does not rubber-band.

### Proposed architecture

- Extend `ELEMENTAL_DEFS` with optional renderer metadata such as `surface`, `particle`, and effect palette fields, while keeping the module dependency-free.
- Replace growing `if/set` branches in `ElementalCubeSkin` with a small renderer registry keyed by element. Each renderer receives the same sampled cells, live transform mechanism, definition, fade envelope, and quality budget.
- Split shared lifecycle calculation into one hook/controller so skin, particles, lights, and strikes consume a common `{ claim, hold, release, intensity }` envelope rather than each interpreting `wormBuffs.elementalT` differently.
- Add cube-scale adornments as a sibling to the cell skin, not as more per-sticker children. Use instancing, pooled sprites/lines, shared geometry/materials, and bounded counts.
- Keep all scene content under `ElementalAtmosphere` so `HealerWormMode` continues to mount one elemental feature boundary.
- Add a quality tier derived from existing device/performance conventions: reduce particles, vines, droplets, icicles, bolt branches, and update rates before removing the core identity. Reduced motion keeps a static themed skin/light and disables sweeps, wakes, pulses, and lightning strikes.
- Audit disposal carefully. Cached shared materials/geometries must not be disposed by transient JSX children; per-strike paths must be returned to a pool or disposed on completion/unmount.

### Implementation sequence

1. **Baseline and guardrails:** capture overview and chase-camera reference images for all four elements at 3×3 and a large supported size; record draw calls/frame time; add tests around the current definition list, lifecycle, offering count, replacement, and expiry.
2. **Shared lifecycle/registry:** centralize the visual envelope and renderer selection without changing output. Verify slice-following, pause, focus freeze, tunnels, cleanup, and rapid element replacement.
3. **Cube-scale foundation:** add shared edge/corner masks, deterministic face/cell seeds, quality budgets, and readable-center rules.
4. **Upgrade one element at a time:** water, fire, nature, then ice. Take matched screenshots and performance readings after each; do not land four half-finished styles in one pass.
5. **Extract the chaos bolt primitive:** prove `ChaosWave` visual/API compatibility with focused tests before using it elsewhere.
6. **Add lightning definition and static skin:** wire catalogue, offering, orb shader/badge, HUD, atmosphere, and cube skin. Because offerings place one orb per type on distinct face centers, update placement logic for five types and verify size/occupancy fallbacks rather than assuming the old four-face layout.
7. **Add worm strikes:** implement gated render-only scheduling, live segment target lookup, pooling, camera visibility checks, cooldowns, and reduced-motion behavior.
8. **Polish and accessibility:** tune contrast from both camera modes, cap flashes, validate color readability, profile mobile/large cubes, and document intentional fallbacks.

### Tests and acceptance criteria

- Pure definition tests accept exactly `water`, `fire`, `grass`, `ice`, and `lightning`; every definition has a valid label, colors, icon, supported tile style/fallback, renderer key, and particle kind.
- Offering tests expect five unique elemental pickups, prove collision/occupancy fallback placement, and prove claiming one removes the other unclaimed elemental offerings.
- Lifecycle tests cover lightning start, replacement, focus freeze, pause/tunnel behavior, full duration, expiry, reset, and store/HUD synchronization with no changes to cube stickers or worm physics.
- Visual registry tests prove every canonical type resolves to a renderer and unknown types fail softly without leaking a cached resource.
- Bolt helper tests use fixed seeds to verify pinned endpoints, bounded jitter, stable branches, degenerate endpoints, and completion exactly once. Existing chaos tests must pass unchanged.
- Strike scheduler tests use a fake clock and seeded generator to verify cooldown bounds, phase gates, unique/reachable worm targets, reduced-motion suppression, unmount cleanup, and zero simulation writes.
- Manual checks cover all elements in overview and chase cameras; active slice rotations; 2×2, 3×3, 5×5, and the largest advertised cube; claim while another element is active; pause/resume; tunnel transit; death/victory; low quality; and reduced motion.
- Performance acceptance: effect object counts stay bounded by quality tier and do not scale quadratically beyond the existing face-grid cap; no per-frame React state updates; no unbounded arrays/timers; no persistent GPU-resource growth across repeated claims.
- Readability acceptance: face colors, sticker marks, heal/bomb/warning feedback, worm silhouette, and pickup badges remain identifiable throughout every theme. Lightning flashes must remain localized, infrequent, and below an accessibility-safe intensity after reduced-motion/flash settings are applied.

### Explicit non-goals

- Do not recolor or rotate authoritative cubies, consume tile life, heal tiles, trigger chaos propagation, or alter win state.
- Do not give the four existing elements gameplay powers as part of this art pass.
- Do not make lightning strikes damage or control the worm.
- Do not replace the existing orb/badge/HUD language with unrelated assets; extend it consistently.
- Do not solve cross-face continuity with one monolithic mesh that breaks during live slice rotations.
