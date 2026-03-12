# Healer Worm Mode Breakdown

This is a functional map for `src/worm/HealerWormMode.jsx`, plus the first extraction pass that moves foundational helpers out of the main file.

## Current module split

### 1) Core mode orchestration
- **File:** `src/worm/HealerWormMode.jsx`
- **Owns:**
  - The `useWormCrawler` state machine (crawl/jump/tunnel/dead).
  - Frame updates and camera behavior.
  - Powerup collection, self-collision detection, and death transitions.
  - React rendering of worm mesh/body/HUD integration.

### 2) Shared constants and direction maps
- **File:** `src/worm/healerWorm/constants.js`
- **Owns:**
  - Camera tuning values.
  - Visual tunnel constants.
  - Face normal and movement direction lookup maps.
  - Worm progression defaults (tail, jump limits, wormhole timing).

### 3) Surface tile and spawn helpers
- **File:** `src/worm/healerWorm/surfaceTiles.js`
- **Owns:**
  - Enumerating cube surface tiles.
  - Surface membership checks.
  - Random free tile picks.
  - Random unflipped tile picks.

## Next recommended decomposition (small, safe steps)

1. **Extract tunnel lifecycle helpers**
   - Move tunnel keying, orientation resolution, and traversal counters from `useWormCrawler` into `src/worm/healerWorm/tunnels.js`.

2. **Extract jump/crawl kinematics**
   - Move interpolation math and jump arc math into `src/worm/healerWorm/movement.js`.

3. **Extract powerup/tail domain state**
   - Move spawn/collect/length calculations into `src/worm/healerWorm/powerups.js`.

4. **Extract camera rig logic**
   - Move chase camera and tunnel camera behavior to `src/worm/healerWorm/useHealerWormCamera.js`.

5. **Optional final split**
   - Keep `HealerWormMode.jsx` as an orchestrator that imports:
     - `useWormCrawler`
     - `useHealerWormCamera`
     - `WormVisuals` rendering component

This ordering minimizes regressions while making each file easy to reason about.
