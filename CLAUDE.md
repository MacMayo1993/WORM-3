# CLAUDE.md

This file provides guidance for Claude Code when working on the WORM-3 project.

## Project Overview

WORM-3 (World of Rubik's Manifolds) is a 3D Rubik's Cube puzzle game built on real projective plane (RP2) topology. It features antipodal point identification, multiple game modes (Classic, Sudokube, Ultimate, Worm), a 10-level story campaign, a teaching mode, and co-op worm mode. Built with React 18, Three.js, and Zustand.

## Build & Development Commands

```bash
npm ci                           # Deterministic install from package-lock.json
npm run dev                      # Start Vite dev server on port 5173
npm run build                    # Production build to dist/
npm run preview                  # Preview production build
npm run lint                     # ESLint check on src/
npm run lint:fix                 # ESLint auto-fix
npm run test                     # Run tests once (vitest run)
npm run test:watch               # Watch mode tests
npm run test:coverage            # Tests with V8 coverage report
npm run bundle:check             # Per-asset + initial-route bundle budgets
npm run e2e                      # Browser smoke tests (Playwright, needs `npm run build` first)
npm run e2e:install              # One-time: download Playwright's Chromium (or set CHROMIUM=/path/to/chrome)
npm run ci                       # Full CI pipeline: lint → test → build → bundle:check
```

Use `npm ci`, not `npm install`. The R3F peer-dependency conflicts still require
npm's legacy resolver, but the flag now lives in `.npmrc` (`legacy-peer-deps=true`)
so every install — local, devcontainer, CI — resolves the same tree the lockfile
was generated from. Passing `--legacy-peer-deps` by hand is harmless but redundant;
running a bare `npm install` is what silently rewrites the lockfile and makes
bundle/performance baselines incomparable between runs.

Supported toolchain: **Node 20** (`.nvmrc`, `engines`, CI, devcontainer all agree).

## Testing

- **Framework**: Vitest with jsdom environment
- **Test location**: `src/__tests__/*.test.js`
- **Run all tests**: `npm run test`
- **Run a single test**: `npx vitest run src/__tests__/cubeRotation.test.js`
- **Coverage scope**: `src/game/**`, `src/utils/**`, `src/levels/**`
- **Browser tests**: `e2e/*.e2e.js` (Playwright, config in `playwright.config.js`) run the production build in real Chromium: the app boots, a WORM run starts, every selector thumbnail draws, and a deleted lazy chunk recovers instead of leaving a blank page. The unit suite is jsdom and cannot see those. WebGL is software-rendered, so they assert that things appear and nothing throws, never frame rates. The `e2e` CI job does not gate deploy yet.
- **Credits**: third-party art is credited from `src/utils/credits.js` (Settings → About) and inventoried in `docs/ASSET_CREDITS.md`; `assetCredits.test.js` fails when a model or environment map is added to `public/` without a credit or an explicit "unverified" entry, and when a credit disagrees with the model's own embedded Sketchfab metadata. The nine biome models are CC BY 4.0, so crediting them is a licence condition.
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
- **Lightning is a storm** (`src/worm/healerWorm/lightningStorm.js`, resolved in `runStorm` in `HealerWormMode.jsx`, drawn by `LightningStrikes.jsx`): while a Lightning wash is up the sky marks `STORM.strikes` tiles (a new orb restarts the count), each charging for `STORM.telegraph` seconds before it strikes; marks still strike after the wash ends, only new ones stop. Marks never go on the head's `STORM.headSafeTiles` ring, an orb, a special, a bomb or another mark, and `STORM.bodyShare` of them aim at the worm's own body. A strike resolves through the bomb-blast helpers: a grounded head dies (`reason: 'lightning'`, WORM'D kind `struck`; a jumping or rocketing head is untouched), a body tile cuts the tail off there (`severAndScatter`), enemies in the 3x3 (`springSlamTiles`) are killed (`strikeEnemies` in `portalCombat.js`), and a tile holding none of that flips like any flip via `strikeTile` in `useWormCrawler.js` (under `activeTunnelCap`) and the tunnel is *charged*: `sim.chargedTunnels` pays `CHARGED_TOLL` heal segments of the toll for free on each ride (the worm's orbs and tail are only spent on the rest) and its mouths crackle. It is held like the rest of the sim (pause, tunnels, slice turns, the orb and cut freeze beats, countdown) and is off in the demo. Randomness comes from `sim.rand`, so tests inject it. The telegraph is a closing ring and diamond, readable without flashes; reduced motion drops the bolt column.
- **Two elements fuse** (`src/worm/healerWorm/elementalFusion.js`): claiming an element while another's wash is up fuses them; the sim keeps the newest in `elementalType` and its partner in `elementalPair` on one shared clock, and a third claim replaces the older (`claimElement`). Read elements through `hasElement(sim, type)` / `activeFusion(sim)`, never `elementalType` alone, or a pair's partner half silently switches off. A first claim leaves the rest of the offering up so a partner is reachable; the claim that fuses wipes it. All ten pairs are named in `FUSION_DEFS` and draw both cube skins and particle fields at once (`wormElementalPartner` in the store, `ElementalAtmosphere`); four have rules: Steam (fire trail joins the light wall via `steamTiles`, and bombs on it are put out), Slipstream (`waterSpeedBonus` 0.4, `turnShedsMomentum` false), Wildfire (a spring landing burns its 3x3 and posts `sim.fusionBurst`, which the mode resolves once per `seq` against enemies) and Thunderpad (the storm aims `STORM.padShare` of its marks at spring pads; `chargeSpringPad` charges a struck pad instead of flipping it, and a charged pad launches with `CHARGED_SPRING_SPAN`/`HEIGHT`).
- **Flip cap**: never import `FLIP_CAP` to decide whether a tile is spent — read `selectEffectiveFlipCap(state)` from `useGameStore.js`. Disparity/Chaos sessions run on a configurable cap (3/8/13/20) and the constant is only the standard-play default; mixing the two is what let a tile show health remaining while refusing the player's tap. Pure helpers take the cap as a trailing argument (`flipStickerPair(..., flipCap)`).
- **A pad jump is one continuous motion**: the flight (`raisedPlatforms.js`) is one cubic Bézier walked in natural time, with its height searched against the raised piece and cube body, so it never stops in mid-air on any board size. Touchdown flows into the pad coil (`getWindWorldPosInto` in `wormLogic.js`, along `tunnel.entryHeading`) and the coil sinks into the entry arm at the arm's own pace; the exit runs the coil backwards into `tunnel.exitHeading`. The sim owns the flying head: `rideLiveRotation` must not re-anchor it (or a head on a raised pad) to the live cubie meshes, which is what used to leave the head on the floor while the body rose. The camera frames worm and pad until touchdown (`framePlatform(..., inFlight)`), swings over the pad with the landing heading as screen-up (`windupPoseInto`), and rolls onto the band's frame over the entry arm rather than at the mouth. `padJumpSmoothness.test.jsx` holds the speed, turn-rate and on-screen bounds.
- **Jump height has one curve**: every surface-jump lift (the head's `jumpLiftOf`, the body lift baked into `stepHistory`, and a raised-pad launch from mid-air) goes through `arcLift` in `src/worm/healerWorm/jumpArc.js`. A double jump starts its new arc from the current height via `sim.jumpBase`; writing `Math.sin(jumpT * π) * jumpHeight` directly is what used to drop a mid-air worm to the floor on its second press.
- **Rocket burn has one envelope**: the sim only owns `rocketActive`/`rocketT`/`rocketFlight` and the landing grace; `rocketBurnInto` in `src/worm/healerWorm/rocketFx.js` turns them into the burn's beats (ignite, liftoff surge, descent, touchdown, booster scale). `RocketExhaust` (booster on the rendered tail, plume, world-space smoke pool, pad shock ring) and `WormChaseCamera` (FOV punch, liftoff lag, three-quarter flight view, desktop-only shake; phones get haptics) both read it, so a refuel keeps the flame lit and replays the surge everywhere at once. Render-only: nothing writes back to the sim, and pause/reduced motion freeze or drop the motion.
- **One dissolve shader**: the opening cube's crumble (`addIntroDissolve`) and defeated WORM enemies (`addFrameDissolve`, driven by `combat/enemyDissolve.js`) share `src/components/intro/introDissolve.js`. Kills stay in `combat.dying` on the combat clock (held with pause/tunnels like bursts); `CombatScene` keys rigs by enemy id so a dying enemy crumbles in the rig it fell in. Orb pickups use `OrbPickupBurst` (motion in `orbPickupBurst.js`), laid out in the tile's frame.
- **Flips are paired and reversible**: `flipStickerPair` is atomic across the β-pair (both members move or neither), which keeps antipodalEngine's ∆ = 0 invariant. To take a flip back use `unflipStickerPair`, not a second `flipStickerPair` — re-flipping restores the colour but spends the tile's life again.
- **Tunnels dock on the antipodal core**: the centre holds a miniature of the cube, the same N×N (`VoidCore.jsx`, `antipodalCore.js`), in which each tile shows its antipodal partner and which copies the live cubie meshes through slice turns. Every tunnel route (worm, camera, ribbon, cords, snap, chaos surges) docks on the core tile beneath its mouth and crosses through the centre (`path.core`); get the dock from `tunnelDockInto` / `tunnelDockForCellInto` / `tunnelDockForMeshInto` in `src/utils/tunnelPath.js`, never as `normal × TUNNEL_MINI_FACE_R`. Partners are glued by grid ID, so a solved cube's routes are straight diameters and a scrambled cube's are bent at the centre. In WORM rides the core swells about the entry dock as the lens closes on it (`coreZoomLimit` / `coreZoomAt`, reading `tunnelState.tunnel`); the dock never moves, so the worm still dives into its tile. Tunnel width comes from the same module (`tunnelDockWidth` / `tunnelMouthWidth` / `tunnelGaugeAt`): every band, rail and cord plugs into its core tile at exactly that tile's width and flares at most 2× (never past 0.36) toward its own tile; the ridden WORM band keeps a 0.36 floor at the tiles and meets the swollen tile via `tunnelState.coreZoom`.
- **Chaos rounds**: the wizard's cube (size, palette, style, scene, tunnels) is applied before Mobi's intro (`applyChaosSetup` in `useDisparityGame.js`). After the scramble the player aims the first strike (`chaosIgnitionPicking` / `chaosIgnition` in the store; taps route to the pick in `CubeAssembly`); the sim starts chain 0 on that tile by grid id (`ignition` in `createChaosSim`), and every later hop still uses fresh randomness. Chaos visuals go through `ChaosStorm` via the render-only `chaosStormBridge`; never route per-bolt events through Zustand. Bolts and flip surges wear the colour of the tile they flip (`face` on each event from `chaosStormEvents`, looked up in the round's palette; `setTunnelCharge` carries it so `RestingCords` lights the cord in the same colour); overloads and recoveries keep their warning colours. The player never flips during a round (`selectChaosFlipLocked` gates `onTapFlip`; heal taps still work). Chaos keeps raised cubie bodies solid (no see-through `raisedWindow`) and every storm strip and tunnel snap depth-tested, so bands and surges stay inside the cube and show only through the gaps. Stickers are keyed by grid slot during Chaos as in WORM (the self-solve turns a slice every 1.5 s), so the identity-swap reset in `StickerPlane` must re-sync any per-piece state it adds, death/tombstone state included.
- **Worm looks are shared**: the played worm, the menu rigs and every preview build from the same parts: per-character head features (`createCharacterAccents`, recoloured with `setSkin`, animated with `update`) and body banding (`characterSegmentPattern`) in `src/worm/wormCharacterVisuals.js`, and the handmade pieces in `handmadeParts.js` (each part names a finish; `buildCraftModel` merges by colour and finish, at most eight draws a piece plus one ink outline per moving group; `grow`/`turn` resize or tilt cargo while its strap keeps hugging the bead). Those pieces must stay readable at chip size on any skin, so every model follows four rules, held by `handmadeAccessories.test.js`: big (at least 1.6 bead radii across), bold (saturated `CRAFT` colours with a light and a dark, never the worm's own green: the leaves are autumn orange), lit (every opaque finish carries a `glow` emissive floor so a piece survives a dark scene) and inked (`buildCraftModel` wraps opaque parts in a back-face outline hull, `CRAFT_OUTLINE_THICKNESS`; parts under `OUTLINE_MIN_EXTENT` and clear glass are skipped). A garment that runs the length of the body (the leaf cape, the quilt, the button trail) is modelled as the one piece that wraps ONE segment (`cover({ gap, stretch, taper, ripple })` and `pick(selector, ...)` in `handmadeParts.js`, cut from the closed `createArchGeometry` slab in `craftGeometry.js`) and `createAccessoryRig` lays one per body segment every frame as `InstancedMesh`es (`finishCover`), so it lengthens as the worm grows, narrows over the real tail (`segTotal`, not a preview's crop) and costs a handful of draws at any length; keep colour variants of one piece on one shared hull (`outlineAs`) and a hair apart in radius so overlapping shingles never z-fight. Single body pieces (`BODY_INDEX`) ride the shoulders, not the bead touching the head, and a worm too short for their segment wears them on its last. A piece's geometry is built once per id (`getTemplate`, never disposed) and shared by every instance; only materials are per instance, so rebuilding a rig is cheap. The preview renderer keeps the last 16 outfits and 24 hats it built instead of rebuilding one per thumbnail, and `updateWormPreview` ignores an options object that would draw the same picture (`wormPreviewLooksAlike`): a parent that re-renders must not cost every thumbnail a readback. Anything that should move in the world goes in a `rig(name, pivot, { spin, sway, freq })` group (the pinwheel's blades, the wind-up key, the firefly orbit, scarf tail, cape and bows): `animateCraftModel` turns the rigs from the caller's pause-aware clock, so a frozen clock leaves every piece at rest. The handmade hats are the same craft models (`WormHat3D` and the preview renderer both call `buildCraftModel`; `poseHandmadeHat` animates them). `wormCharacterVisuals.test.js` keeps every piece inside the preview frames on every character, so growing a piece means checking that frame first. The body's emissive is tinted by the bead's own colour (`uEmissiveTint` in `wormSkinMaterial.js`; the Glow Worm opts out). The Book Worm's body segments are hardbacks lying open face-down (spine, two hinged boards over their pages, one binding material whose colour is the cover) from `src/worm/wormBookFX.js` in gameplay, previews and the menu rig alike: a book of scale `r * BOOK_SCALE_PER_RADIUS` stands in for a bead of radius `r` (belly at the same depth), so clearance, tunnel fit and accessories use the bead radius. Previews render off screen in `WormPreviewRenderer.js`, whose encode pass un-premultiplies and sRGB-encodes the linear target: never read render-target pixels straight into a canvas. A wide `framing="character"` canvas (`aspect > 1.2`) gets the selector's stage, a scrambled cube face lit by a generated studio reflection map.
- **The Dancer's S is one wave** (`src/worm/wiggleBody.js`): the played Wiggle Worm, the picker and the Tail Wipers sweep all take their sideways swing from `wiggleBodyOffset`, and `WormBody` tilts each bead along `wiggleBodySlope` so a wide wave reads as a snake and not as beads sliding sideways. The swing (0.13, about 1.5 bead radii) must stay above the Classic worm's ripple (0.08): an earlier turn-clearance fix cut it to 0.032 and the Dancer stopped wiggling. What keeps a wide wave safe is not a small amplitude but the slope cap (`WIGGLE_AMPLITUDE * WIGGLE_WAVE_NUMBER`), `limitWiggleGap` (no bead more than `WIGGLE_MAX_GAP` from the one ahead, which holds the chain together round hinges) and the body tests in `wormBodyTunnelStream.test.jsx`; change those together. The picker's Dancer body closeup is pulled back (zoom 0.74) so long covers stay in frame.
- **Spring is a coil, a leap and a slam** (`src/worm/healerWorm/signatures.js`, numbers in `characterAbilities.js`): the press starts a short coil during which the worm keeps crawling (the body rears into a loop behind a ducked head, an overlay in `WormBody` that never touches the gait math in `inchGait.js`), the leap launches when it ends or on a jump press, and `springLanding` (`jumpLanding.js`) picks a whole number of tiles and sets `jumpSpan` so the worm comes down exactly on the tile the preview showed and the landing was validated against (a floor on `interpT` flipped the answer by a tile near a step's midpoint). Spring spends one of the two jumps: a press in the air is the ordinary double jump, and a press during the coil whose landing has stopped being clear falls back to a plain hop instead of being swallowed. The touchdown is a window (`signature.slam`, `slamT`; the tile is recorded in `sim` the instant the jump ends, not read a frame later from `pos`) that three systems take once each, keyed on `slam.seq`: `resolveSpringSlam` in `wormSim.js` grabs orbs within two tiles, the bomb loop in `HealerWormMode` defuses bombs in the 3x3 `springSlamTiles` returns (`isBombSlammed`, same coin reward and story credit as ringing a bomb), and `stepCombat` stuns, throws back and damages enemies in that 3x3. The Nature element's spring leap is separate and still the old 2.2 tiles.
- **The Glow Worm's trail is a wall of light**: while the paint stands (`litTiles` in `glowTrail.js`, gone when `life` falls to `LIT_MIN_LIFE`) an enemy in Portal Combat that is about to step onto a lit tile is burned (`LIGHT.touch`), thrown back and stunned instead (`singe` in `portalCombat.js`), one standing in the light burns (`LIGHT.burn`), and an enemy whose step is already past halfway finishes it and burns on arrival. Enemies never path around the light, so a crawler or dasher dies on its first touch and a brute on its third. `useWormCrawler` hands combat a `lit()` function that is read only while an enemy is on the board; combat reads the sim's signature through that and never writes to it.
- **MOBI is the guide art in 3D** (`public/Mobi.png`): pearly bevelled blocks with a lit window in every face (`createMobiFrameGeometry` / `createMobiFrameMaterial`, shared by head and tail), Rubik's-cube eyes on a face screen, bulb antennae. Callers place, orient and scale `rig.group`; everything MOBI draws hangs off `rig.body`, which `animateMobi` bobs, squashes and tilts from the group's own travel (gait, turn lean, spring antennae, gaze saccades, eye twists), all on the caller's pause-aware clock. Pose hats and face accessories from `mobiHeadFrameInto`, not the anchor, or they hover while the head moves. Tail blocks are one per three segments (`isMobiBlockSegment`) and tumble in a follow-the-leader wave keyed to crawl distance (`mobiTailSwayInto`), bounded to stay inside the 0.15 surface clearance.
- **One sticker, every view**: the play cube's stickers are the menu cube's (`createPlayStickerGeometry` in `src/3d/rubiksPiece.js`; hollow's frame is the same call with a `hole`) in every view mode that draws stickers: plain, styled, glass, Sudokube and hollow. Only a loaded face texture keeps the flat quad it is sliced across. No style bends the sticker: depth (the chambers, the eye in its socket behind the eyehole, `eyeTileShader.js`) is ray-traced in the fragment shader from a screen-derivative tile frame, so the same material works on tiles, previews, the core, orb bands and tunnel walls. A style that draws something other than sticker plastic declares `float tileCoat;` and sets the finish's clearcoat per pixel. Tile-style shaders are unlit, so `getTileStyleMaterial` wraps each one in `withStickerFinish` (`src/3d/styles/shaders/stickerFinish.js`): the style reads `baseColor`/`antipodalColor` as the palette's hex (not THREE.Color's linear value) and is shaded by `CUBE_LIGHT_RIG` with a clearcoat highlight. A surface that brings its own vertex shader must use the bare style from `material.userData.styleFragmentShader`, or it will be missing the finish's varyings. The `standard` palette (shown as Classic) is the Rubik's cube's own colours: `COLORS` spreads `RUBIKS_CLASSIC`.
- **Palettes are named themes**: each preset in `src/utils/colorSchemes.js` is six named colours from its theme (`PRESETS`, laid out so each column is an antipodal pair; `PALETTE_FACE_NAMES` is what Chaos bets call them). `paletteQuality.test.js` keeps them playable: every face pair ≥ 0.18 apart in OKLab, opposite faces ≥ 0.22 (Classic and City Biome keep the Rubik's sibling pairs), no tile at OKLab L ≤ 0.45, and no two palettes within 0.06 of each other. City Biome's colours are the cities' `pulseColor`s. When a theme fails a floor, move its own colours apart; never fill it back in with an off-theme rainbow.
- **Slice hazard rule**: riding a turning layer is never fatal. Whichever side of a seam the head is on keeps the body up to that seam and the rest is cut off (`findSlicePathHit` in `src/worm/healerWorm/sliceBodyPath.js`, `checkWormHitBySlice` in `wormHelpers.js`). Only a crossing kills: the sim's live seam check (`movingSliceCrossing`), a head that steps onto the layer early in the turn (`resolveSliceHits(..., { entering: true })` from the turn watch), or a seam so close behind the head that less than the base body would survive. Hit beats (the WORM'D shout per cause, the severed tail popping off the cube, the knocked-out face) are render-only: timing, scatter and sampling live in `src/worm/healerWorm/wormdFx.js`; `ThunkEffect`/`SeveredTail` in `impactFx.jsx` replay them. Capture a severed tail with `sampleSeveredTail` before `cutWormTail` trims history. A cut the worm survives scatters the orbs it carried, Sonic-ring style: `cutWormTail` returns them, `scatterDroppedOrbs` (`src/worm/healerWorm/droppedOrbs.js`) lands them on nearby free tiles in `sim.droppedOrbs` (they ride slice turns and age only while crawling), crawling onto one (or magnet reach) restores exactly those orbs as a recovery (`onOrbPickup(..., recovered)` skips the run tally and story goals), and after `DROPPED_ORB_LIFETIME` (5 s) they blink out and crumble via `addInstanceDissolve` in `introDissolve.js` (`DroppedOrbs.jsx`, render only).
- **Parity orb look**: every orb part is built at `PARITY_ORB_SCALE` (0.85) in `src/worm/parityOrbGeometries.js`; scale reveal/culling radii and anything standing in for the gem (the attraction bead) by the same constant, never a new literal. The glass shell carries a fresnel rim (`addOrbRim` in `orbMaterials.js`, one shared program keyed `parity-orb-rim`, which `orbReveal` chains its dissolve onto). Each orb's collect tile gets a beacon ring in the orb's colour over a soft contact shadow, and orbs perk up (swell, spin faster, ring brightens and pings) as the worm's head nears: timing and texture in `src/worm/orbBeacon.js`, all beacons in one instanced draw (`createOrbBeacons`, per-instance `aIntensity`, `forceSinglePass` so the transparent double-sided decal is not drawn twice a frame). Spins run on an accumulated phase (`refs.spin`) so changing speed never jumps the rotation. Colours: the band wears the manifold the orb sits on and the body wears its antipode (`orbColorRoles`), and a pickup credits the body's face (`orbCreditFace` in `economy.js`): an orb on a white tile is yellow, adds yellow to the reserve and a yellow bead, and pays into yellow tunnels. MOBI's carried orbs are indexed by that credited face and drawn to match.
- **Tile styles register once**: a style is a fragment shader in a `src/3d/styles/shaders/*` module (merged in `TileStyleMaterials.jsx`), a key in a `TILE_STYLE_SECTIONS` family (`tileStyleCatalog.js`), a label in `TILE_STYLES` and a price in `storeCatalog.js`; it goes in `ANTIPODAL_STYLES` if it reads `antipodalColor` and in `animatedStyles.js` if it reads `time` (play and previews share that list; `shaderModules.test.js` checks all of it). Pickers, store shelves, the settings panel and Random Mix derive from the sections. Styles cut from one slab per face (Crafted, stained glass, Penrose) use `craftGlsl.js`: `crFacePlane()` maps the tile's home (`tileHome`/`tileFace`) onto its face through `FACE_PLANE_AXES`, which a test holds to `STICKER_ROT` (`src/3d/stickerFrames.js`), so a solved face reads as one piece. The wizard's preview cube binds the same homes.
- **WORM Levels is a world map**: each chapter is a "world" (`chapterWorldColor` in `src/worm/story/levelMapLayout.js`, a cube face colour, never white) with a ribbon, chapter medallions and a board where `StoryChapterMap.jsx` lays the ten stages on a winding trail (`mapNodePositions` / `mapTrailSegments`; cleared stretches are worm beads). Stages are numbered `chapter-index` (`stageCode`); the selected stage carries the player's worm as a pin, the next unplayed one pulses, the finale is crowned. Styles live in `wormLevelMap.css`; rims there are box-shadows because `.mode-wizard *` forces border colours. The map keeps the `.worm-level-grid` / `.worm-chapter-tabs` hooks the story tests use.
- **Worms are earned, not bought**: Classic is free and every ten WORM levels cleared unlocks the next worm in `WORM_UNLOCK_ORDER` (`src/worm/wormUnlocks.js`; MOBI last, at 60). Ownership still reads `character_<id>` in `ownedItems`, but only progress grants it: `syncCharacterUnlocks` re-locks a save to its progress on load, `grantCharacterUnlocks` adds the new worm when `completeStoryChanges` clears a level (and sets `wormStoryResult.unlockedCharacter` for the result card). The Store has no Worms tab, `buyItem` refuses characters, and no chest tier offers them (Mythic holds items priced ≥ `MYTHIC_PRICE`). Worm trails were retired as a cosmetic: there is no trail store item, state or story reward; the Glow Worm's Light Trail ability is separate and stays.
- **Screen ownership**: `src/hooks/uiSurfaces.js` decides which surface owns the screen. Anything that adds a full-screen modal should register there so keyboard gating and Escape-to-dismiss pick it up automatically; ambient side panels stay out of the blocking set.
- **UI theme (one light arcade style)**: shared tokens live in `src/utils/uiTheme.js`. Fonts: `DISPLAY_FONT` (Bungee, titles and primary keys, uppercase), `HEADING_FONT` (Outfit, labels/numbers/keys), `UI_FONT` (Nunito, reading text); Mobi's dialogue uses `HEADING_FONT` on the arcade paper via `MobiStage` (no handwriting face); bare `monospace` only for manifold grid IDs and algorithm notation. Surfaces are all the `ARCADE_*` look: cream graph paper, deep-green ink, ivory keys and cards on a hard ledge. `NIGHT_*` and `GAME_HUD` now carry the same light values (the in-play HUD is ivory plastic with dark-green outlines); use `VIEWPORT_*` only for type laid directly over a photo or 3D preview. Mode colours are the Rubik's cube faces from `MODE_THEMES` in `src/utils/modeThemes.js` (WORM green, Flip Cube yellow, Teach blue, Chaos orange, Random red, Store white), each with a readable `ink`; a mode's one primary key wears its face via `arcadeModeVars(mode)` (`src/utils/arcadeTheme.js`). Classes live in `src/components/ui/arcadeTheme.css`, imported by the screens that use them rather than globally, to keep the initial CSS inside the bundle budget. Do not add new dark sheets or pastel mode accents. The game scene adds `BackgroundAmbience` (mini cubes and antipodal twin wormholes, laid out in `src/3d/backgroundAmbience.js` beyond `MAX_DISTANCE_BY_SIZE` in `src/3d/cameraLimits.js` so nothing ever passes in front of the puzzle). The opening/carousel graph paper (`MenuPaperBackdrop`) and the loading screen's 2D-canvas copy of it both read `PAPER_GRID` in `src/utils/paperGrid.js`; tune the paper there. The main menu cube is the opening's cube, built from the same parts (`src/3d/rubiksPiece.js`: black-plastic cubies, glossy classic stickers); tapping it runs the opening's antipodal flip wave. The mode carousel's cube (`ModeFacePlates`) is that cube solved, each face's stickers in its mode colour with the name standing off the face; the play cube's classic looks use the same parts too (`createPlayStickerGeometry`, a thin 0.85 variant whose front face is at z = 0 so tile overlays stay in front, and the 0.96 plastic body from `CLASSIC_BODY_*` in `src/3d/cubeViewStyles.js`). Both scenes light the cube with one studio rig, `CUBE_LIGHT_RIG` in `src/3d/cubeLighting.js` (wireframe and glass keep their own), and the play scene adds a reflection map wherever no photo panorama supplies one, so the stickers' gloss shows in the space scenes too. The main menu's keys and the mode carousel's Play key are deliberately cube pieces rather than ivory keys: a glossy sticker in a black-plastic bezel (`src/components/menus/mainMenuKeys.css`). The setup screens use the same pieces from `src/components/ui/pieceKey.css` (`.piece` + `.piece-face` + `.piece-trailer`, sticker colour via `--piece-color`; `.piece-icon` for round ivory back keys): every wizard's primary key (WizardShell), the Chaos bet key, and the path pickers in `src/components/ui/pathSelect.css` (WORM's Levels / Free Play, Flip Cube / Chaos). The loading cover is a small static shell (`LoadingScreen`) around a lazy `LoadingScene` that `preloadAssets.js` warms, keeping its CSS out of the initial bundle: a CSS 3D cube falls for ever between two linked portals drawn by `LoadingPortal`'s canvases (a twin one drop below, clipped from the upper portal's far edge to the floor portal's near edge, makes the loop), timed by `FALL` in `loadingWormhole.js`, which the stylesheets must match (tests check).

## Elemental Cube Art Upgrade Plan (Design Only)

This section is the implementation brief for a future Claude Code pass. It is intentionally a plan, not an instruction to change gameplay while doing unrelated work.

**Implementation checkpoint (skins live):** every element's cube skin has been rebuilt on a shared contract. Read these before touching a skin:

- **Cells** (`healerWorm/elementalCells.js`): each cover cell carries exact world-unit extents to its four borders and a cube-edge flag per border; cells tile each face exactly with no overhang. Instance matrices are unit scale and follow the cubie's full live rotation (roll included); every claim/expiry ramp lives in the shaders off the shared envelope. Cells are centred on stickers, so shaders recover the seam lattice with `fract(local + 0.5)` at any board size.
- **Shared GLSL/uniforms** (`elementalGlsl.js`, `elementalUniforms.js`): noise, the cell frame, `seamPoint`/`sweepStart` for seam-rooted detail, and shared worm-body / claim-origin uniforms published once per frame. Splice JS numbers into GLSL through `glf()` — `${0}` is an int literal and GLSL ES rejects `float * int`.
- **Fire** (`ElementalFireSkin.jsx`): lava-crack bed in the grout, opaque cel-banded tongues rooted in the seams (alpha-to-coverage, depth-written), crowns on edges, additive halos/embers. Flames rise toward the camera's up and part around the worm's body.
- **Water / ice / lightning** (`ElementalSurface.jsx`): one rounded offset shell (edges and corners wrapped, flooding from the claim tile in world space), one compiled program per element. Shell light is added un-encoded and the body only absorbs head-on, so sticker hues survive.
- **Nature** (`ElementalGrassSkin.jsx`, `natureMeadow.js`): moss in the grout, grass rooted in the seams and clumped (lusher on edges, clear over sticker centres), ivy over the edges, sparse flowers; grows moss → grass → flowers and wilts on release.
- **Draw order:** in worm mode cubie bodies are transparent and render at `renderOrder -1` (`Cubie.jsx`); without that, the nearer bodies drew over any cube-wide transparent layer and turned every seam into a black bar.

Still planned from the brief below: dedicated reduced-flash tuning for lightning strikes, water droplets/streams, icicles, and matched perf profiling on mobile.

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
- Worm interaction: **superseded by the storm below.** The decorative "worm is a lightning rod" strikes (`ElementalStrikes`, `strikeScheduler`) were removed: a bolt that hurt nothing would teach players to ignore the real ones. See "Lightning is a storm" under Important Notes.
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
7. **Add worm strikes (done differently: the storm, see Important Notes — gameplay, not render-only):** originally planned as gated render-only scheduling, live segment target lookup, pooling, camera visibility checks, cooldowns, and reduced-motion behavior.
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
- Lightning's strikes are gameplay (see "Lightning is a storm"); they never *control* the worm, and the only change they make to the cube is an ordinary flip.
- Do not replace the existing orb/badge/HUD language with unrelated assets; extend it consistently.
- Do not solve cross-face continuity with one monolithic mesh that breaks during live slice rotations.

## Flip Cube Main Design and Implementation

The brief for making the Flip Cube the game's hero object lives in `docs/features/flip-cube-main-design.md`. It covers:

- flipped tiles popping out as bouncing flip pads with Möbius-funnel springs;
- WORM's jump-to-ride tunnel entry, behind a `tunnelEntry` flag;
- the Rumbler under the tiles;
- Mobi's WORM³ lore.

The implementation checkpoint at the top records what is live and what remains planned. Cube/menu pads use `PadProvider` and a separate normal-offset transform. In cube modes (Flip Cube, Chaos), any live flipped face also pops its whole cubie a hair out of the cube — `CUBE_PIECE_POP` (0.1) via `cubeRaisedAmount(size)`, never the full Explode position, so the tunnel shows only as a sliver; carried unflipped faces are platforms, not tunnel entries. Large tunnel anchors follow this finite piece movement, never the small pad’s continuous bounce. Stalk colors use the visible tile’s antipodal back color. WORM raises the whole flipped piece by `WORM_PIECE_POP` (0.355) along each outer face normal, via `wormRaisedAmount(size)`. With `WORM_PAD_HEIGHT` (0.3), its landing meets `WORM_CAUTION_TAPE_TOP` (0.655) on every board size. Caution posts and tape stay on the unraised cube surface; never place them with `raisedPortalPosition`. Raised WORM shells are translucent with depth writing off, and band anchors extend to the lifted tile. The piece eases outward over two seconds while the Möbius band grows from both mouths; pause holds formation and reduced motion finishes it immediately. `PadEnergy` retains the small render-only shudder. Other faces travel with the piece as jumpable platforms, and only flipped faces enter tunnels. `raisedPlatforms.js` handles deliberate jumps and hurries a still-forming platform up to meet the jump (`rushPlatformFormation`). These values live in `src/game/raisedCubie.js` and feed the sim landing, portal visuals, pad renderer and tunnel handoffs; never hard-code them. Demo uses the same raised platforms and deliberate jump entry as live WORM runs. Read the checkpoint and integration contracts before touching pad, tunnel-entry or rumble code.
