# WORM-3 Feature Onboarding

This document is a practical map of **all shipped gameplay modes and major feature systems** in WORM-3.

For each mode/feature, it explains:

1. **What it does** for players.
2. **Why it exists in a non-orientable (RP² / antipodal) framework.**
3. **Where to find the implementation in code.**

---

## 1) Core Puzzle Modes (solve rules on the cube state)

These modes all operate over the same cube/manifold state engine, but change win constraints and information overlays.

### Classic
- **What it does:** Standard color-solve loop with projective face identification and slice turns.
- **Non-orientable framing:** Opposite-face identification means moves can be intuitive in local face space but globally “twisted” in RP² terms.
- **Code locations:**
  - State + move bookkeeping: `src/hooks/useGameSession.js`, `src/hooks/useCubeState.js`
  - Rotation + state mutation: `src/game/cubeRotation.js`, `src/game/cubeState.js`
  - Win checks: `src/game/winDetection.js`, `src/game/solveDetection.js`
  - Core scene and interactions: `src/3d/GameScene.jsx`, `src/App.jsx`

### Sudokube
- **What it does:** Adds Sudoku/Latin-like constraints to face patterns, beyond pure color restoration.
- **Non-orientable framing:** Constraint satisfaction is evaluated on a topology-aware cube arrangement where opposite relations are meaningful.
- **Code locations:**
  - Visual mode switching/UI: `src/components/menus/SecondaryModesSheet.jsx`, `src/components/UILayer.jsx`
  - Solver/verification support: `src/game/cubeVerifier.js`, `src/game/winDetection.js`, `src/game/solveDetection.js`

### Ultimate
- **What it does:** Combined strict mode (color + pattern-style constraints).
- **Non-orientable framing:** Forces consistency under both visual and combinatorial constraints in the identified-face manifold model.
- **Code locations:**
  - Victory channels and progression flags: `src/hooks/useGameStore.js`, `src/hooks/useGameSession.js`
  - Validation and solve logic: `src/game/winDetection.js`, `src/game/cubeVerifier.js`

---

## 2) Overlay / Rule Modifier Features (cross-cutting modes)

These are toggles that can be layered on top of core puzzle play.

### Flip Mode
- **What it does:** Enables sticker flips/tap flips and face-pair flipping interactions.
- **Non-orientable framing:** Flip operations expose antipodal pair behavior directly, highlighting quotient-space identity relationships.
- **Code locations:**
  - Flip toggle and state: `src/hooks/useGameStore.js`
  - Flip operations: `src/game/manifoldLogic.js`
  - Flip trigger path: `src/App.jsx` (`onTapFlip`)

### Chaos Mode (Disparity pressure system core)
- **What it does:** Introduces time pressure/instability via auto-rotation and cascading disturbance.
- **Non-orientable framing:** Dynamic perturbations make orientation memory and path-dependence more central than static solve plans.
- **Code locations:**
  - Chaos hook: `src/hooks/useChaosMode.js`
  - UI controls: `src/components/menus/SecondaryModesSheet.jsx`, `src/components/overlays/DisparityHUD.jsx`
  - Trigger flow + countdown: `src/App.jsx`

### Hands Mode
- **What it does:** Speed-focused input layer with move cadence metrics (TPS/history).
- **Non-orientable framing:** Emphasizes motor learning while preserving manifold-induced orientation surprises.
- **Code locations:**
  - Hook and metrics: `src/hooks/useHandsMode.js`
  - HUD overlay: `src/components/overlays/HandsOverlay.jsx`
  - Input plumbing: `src/App.jsx`, `src/hooks/useKeyboardControls.js`

### Teach Mode
- **What it does:** Guided instructional solving with highlighted targets and staged progress.
- **Non-orientable framing:** Scaffolds player intuition so RP²/antipodal effects are introduced progressively instead of all at once.
- **Code locations:**
  - Teach engine/hook: `src/teach/useTeachMode.js`, `src/teach/TeachMode.jsx`
  - Algorithms/highlights: `src/teach/algorithms.js`, `src/teach/LayerHighlight.jsx`, `src/teach/solver3x3.js`
  - Entry path: `src/App.jsx` (`handleMenuTeach`)

### Cursor / Keyboard Accessibility
- **What it does:** Cursor-based targeting + keyboard-first control paths.
- **Non-orientable framing:** Gives deterministic tile targeting when visual orientation intuition is unreliable.
- **Code locations:**
  - Cursor state: `src/hooks/useCursor.js`, `src/hooks/useGameStore.js`
  - Keyboard input: `src/hooks/useKeyboardControls.js`
  - Overlay UI: `src/components/overlays/CursorHighlight.jsx`

### Antipodal Integrity Mode (I(T))
- **What it does:** Displays and tracks topological integrity/antipodal consistency indicators.
- **Non-orientable framing:** Makes topology itself a first-class mechanic and feedback channel.
- **Code locations:**
  - Logic hook: `src/hooks/useAntipodalIntegrity.js`
  - Math/state helpers: `src/game/antipodalIntegrity.js`, `src/game/antipodalMode.js`
  - HUD: `src/components/overlays/AntipodalModeHUD.jsx`, `src/components/overlays/AntipodalHUD.jsx`

---

## 3) WORM Family Modes (movement gameplay on manifold topology)

### WORM Surface
- **What it does:** Snake-like traversal over cube surfaces with body trail constraints.
- **Non-orientable framing:** Route planning must account for manifold transitions and orientation ambiguity across identified faces.
- **Code locations:**
  - Main mode + game loop: `src/worm/WormMode.jsx`
  - Movement logic: `src/worm/wormLogic.js`
  - Trail and camera: `src/worm/WormTrail.jsx`, `src/worm/WormCamera.jsx`

### WORM Tunnel
- **What it does:** Internal tunnel traversal through manifold network paths.
- **Non-orientable framing:** Makes antipodal/tunnel shortcuts explicit as geometric gameplay, not just abstract state.
- **Code locations:**
  - Tunnel network: `src/worm/WormTunnelNetwork.jsx`, `src/manifold/WormholeTunnel.jsx`, `src/manifold/WormholeNetwork.jsx`
  - Tunnel FX/state visuals: `src/manifold/FlipPropagationWave.jsx`, `src/manifold/ChaosWave.jsx`

### Healer WORM (chase-cam action mode)
- **What it does:** Real-time character-like crawler with jumps, hazards, recovery states, and dedicated HUD.
- **Non-orientable framing:** Includes oriented/non-oriented control mapping to balance mathematical fidelity with player legibility.
- **Code locations:**
  - Mode controller + session: `src/worm/HealerWormMode.jsx`, `src/worm/WormModeController.jsx`, `src/worm/WormModeGame.jsx`
  - Character physics: `src/worm/CrawlerCharacter.jsx`, `src/worm/crawlerPhysics.js`
  - HUD/controls: `src/worm/WormCrawlerHUD.jsx`, `src/worm/WormTouchControls.jsx`, `src/components/overlays/HealerWormHUD.jsx`
  - Control mode state: `src/hooks/useGameStore.js` (`wormControlMode`)

### Co-op Platformer WORM
- **What it does:** Platformer-style worm traversal alongside cube/puzzle interaction.
- **Non-orientable framing:** Combines embodiment + puzzle topology, requiring players to read spatial identification while moving.
- **Code locations:**
  - Mode component: `src/worm/PlatformerWormMode.jsx`
  - HUD: `src/worm/PlatformerHUD.jsx`
  - App entry toggle: `src/App.jsx` (`handleMenuCoop`)

---

## 4) Disparity Mode (competitive elimination pressure)

- **What it does:** Flip-cap/elimination gameplay with countdown start, death tracking, and winner reveal.
- **Non-orientable framing:** Turns manifold instability into a survival constraint where local actions can have non-local consequences.
- **Code locations:**
  - Wizard/setup: `src/components/screens/DisparitySetupWizard.jsx`
  - Runtime HUD/winner screen: `src/components/overlays/DisparityHUD.jsx`, `src/components/screens/DisparityWinnerScreen.jsx`
  - State model: `src/hooks/useGameStore.js` (`disparity*` fields)
  - Start/countdown/app orchestration: `src/App.jsx`

---

## 5) Holonomy Mode (path-dependent orientation focus)

- **What it does:** Explores geometric phase / path-dependent orientation transport.
- **Non-orientable framing:** Directly surfaces that orientation outcome depends on traversal history, a core non-orientable intuition.
- **Code locations:**
  - Mode wrapper + hook: `src/holonomy/HolonomyWrapper.jsx`, `src/holonomy/useHolonomyMode.js`
  - Math + tracer/HUD: `src/holonomy/holonomyMath.js`, `src/holonomy/HolonomyTracer.jsx`, `src/holonomy/HolonomyHud.jsx`
  - Entry action: `src/App.jsx` (`handleMenuHolonomy`)

---

## 6) Freeplay / Explore Mode

- **What it does:** Wizard-driven sandbox for cube size, color/style, background theme, and mode combinations.
- **Non-orientable framing:** Safe experimentation space for testing how RP² identification feels under different visual encodings and constraints.
- **Code locations:**
  - Wizard UI: `src/components/screens/FreeplaySetupWizard.jsx`
  - Apply flow: `src/App.jsx` (`handleWizardComplete`)
  - Persistent settings: `src/hooks/useSettings.js`, `src/hooks/useGameStore.js`

---

## 7) World / Biome Mode

- **What it does:** Applies biome-themed manifold styles and environment presentation.
- **Non-orientable framing:** Uses strong visual landmarks to help players track orientation across identified faces and transitions.
- **Code locations:**
  - Mode resolver: `src/modes/CityBiomeMode.js`
  - Scene assets/render: `src/3d/BiomeGLBCluster.jsx`, `src/3d/BackgroundEnvironments.jsx`, `src/3d/WonderEnvironments.jsx`
  - Mode entry: `src/App.jsx` (`handleMenuBiome`)

---

## 8) Campaign / Level Progression Features

- **What it does:** Structured progression with tutorials, cutscenes, gated mechanics, and level validation.
- **Non-orientable framing:** Introduces topology-driven mechanics in staged lessons instead of requiring immediate full-system mastery.
- **Code locations:**
  - Level data/schema/validation: `src/levels/data/*`, `src/levels/schema.js`, `src/levels/validation.js`
  - Level manager/progress: `src/levels/LevelsManager.js`, `src/levels/ProgressManager.js`, `src/hooks/useLevelSystem.js`
  - UI screens: `src/components/screens/LevelSelectScreen.jsx`, `src/components/screens/LevelTutorial.jsx`, `src/components/screens/Level10Cutscene.jsx`

---

## 9) Shared Visual & Topology Systems Used Across Modes

These are not standalone modes, but major systems that many modes depend on.

- **Antipodal and manifold rendering:**
  - `src/3d/AntipodalVisualization.jsx`
  - `src/3d/AntipodalModeEffects.jsx`
  - `src/3d/AntipodalGlowFill.jsx`
  - `src/3d/SeamPulseOverlay.jsx`

- **Tunnel + void-space presentation:**
  - `src/3d/VoidCore.jsx`
  - `src/3d/HollowVoidCube.jsx`
  - `src/3d/BlackHoleEnvironment.jsx`

- **Material/style pipeline (per-face manifold looks):**
  - `src/3d/styles/*`
  - `src/utils/colorSchemes.js`

- **Topology/game math backbone:**
  - `src/game/manifoldLogic.js`
  - `src/game/coordinates.js`
  - `src/game/refractoryMap.js`
  - `src/utils/tilingGraph.js`

---

## 10) Fast “Where do I edit X?” index

- **Add/change a mode entry point:** `src/App.jsx`
- **Add global mode flags or per-mode state:** `src/hooks/useGameStore.js`
- **Change mode selection UI:** `src/components/menus/MainMenu.jsx`, `src/components/menus/SecondaryModesSheet.jsx`
- **Change 3D rendering behavior by mode:** `src/3d/GameScene.jsx`
- **Change puzzle logic and validation:** `src/game/*`
- **Change WORM behavior:** `src/worm/*`
- **Change holonomy behavior:** `src/holonomy/*`
- **Change guided teaching flow:** `src/teach/*`
- **Change level progression constraints/content:** `src/levels/*`

---

## 11) Non-Orientable Framework Cheat Sheet (for contributors)

When adding features, keep these invariants in mind:

1. **Antipodal identity first:** Opposite-face relations are part of the model, not cosmetic.
2. **Path dependence matters:** Traversal history can alter orientation interpretation.
3. **Control frames may diverge:** Camera-relative and manifold-relative controls can both be valid.
4. **Visual anchors are gameplay aids:** Biomes/HUD/tunnel effects improve readability in a non-orientable space.

