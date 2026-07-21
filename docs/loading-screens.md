# Loading Screens — where WORM³ needs them

_Audit + implementation notes, 2026-07-20._

Goal: the player should never watch the app **lag**, watch a **chunk parse**, or
watch a **background "load in"**. Every heavy transition should be covered by a
deliberate loading beat that dissolves once the scene is actually ready.

This doc maps every place a loading cover is (or should be) shown, the current
behavior, and the recommended fix.

## The loading toolkit

Two reusable pieces were added under `src/components/screens/`:

| Component | Use it for | Notes |
|-----------|-----------|-------|
| `LoadingScreen.jsx` | A DOM, full-screen cover — the WORM³ tumbling cube. | Pure CSS/GPU (no WebGL context, no canvas RAF), so it never competes with the decode it's hiding or collide with the app's single R3F `<Canvas>`. Props: `label`, `progress` (0–100 → determinate bar, else indeterminate), `showTitle`, `transparent`, `leaving`. Must be **statically imported** wherever it's a Suspense `fallback` (a fallback can't itself be lazy). |
| `SceneLoadingGate.jsx` | Covering a scene until its **Three.js assets** (EXR env map, GLBs, textures) finish decoding. | Drives `LoadingScreen` from drei's `useProgress()`. **Armed** by the parent (`active`) so it only appears during an intended transition — never mid-game when a small texture streams. Guarantees a min on-screen time + fade. |

Rule of thumb:
- **DOM chunk load** (a React screen/mode behind `React.lazy`) → `LoadingScreen` as the Suspense `fallback`.
- **3D asset decode** (the "background loading in") → `SceneLoadingGate` armed on entry.
- **Inside `<Canvas>`** a Suspense fallback must be R3F, not DOM — so cover it from the outside with `SceneLoadingGate`, and keep the inner fallback `null`.

---

## Map by transition

### 1. Cold boot — ✅ covered
`index.html` renders `#boot-splash` (pure HTML/CSS, paints before the JS bundle
parses; React replaces it on mount). No change needed. The in-app `LoadingScreen`
deliberately mirrors its look so boot → app feels continuous.

### 2. First-run intro cinematic — ✅ covered
`IntroBranch` + `WelcomeScreen` _is_ the experience; `preloadAppAssets()`
(`src/utils/preloadAssets.js`) warms lazy chunks + Mobi's portrait during it.

### 3. Menu → mode via Mobi intro — ⚠️ mostly covered, one gap
`launchWithMobi()` shows `MobiIntroScreen` while the mode boots behind it. Used by
worm, freeplay, random, teach, holonomy, disparity, co-op, merge, biome.

**Gap:** the intro is **skippable**. Skipping early reveals a half-built scene and
an environment map that is still streaming (the "backgrounds loading in"
complaint). **Fix:** arm `SceneLoadingGate` when the mode is launched and disarm it
on `onMobiIntroComplete` **or** when `useProgress` reports assets settled —
whichever is later — so a fast skip still lands on the cube, not a blank scene.

### 4. Co-op crawler chunk — ✅ implemented
`App.jsx` `if (coopMode)` returns `PlatformerWormMode` (a `React.lazy` chunk).
Previously the Suspense fallback was plain text: `Loading Co-op Crawler...`.

**Done:** now `fallback={<LoadingScreen label="Waking the Co-op Crawler" />}`.

### 5. Full-screen wizards / screens (DOM lazy) — ⬜ recommended
All behind `React.lazy` with `fallback={null}` today, so a cold/slow load shows a
blank flash before the panel appears:

- `WormModeSetupWizard` (~54 KB — the largest), `DisparitySetupWizard` (~32 KB),
  `FreeplaySetupWizard` (~28 KB), `ParityStoreScreen` (~27 KB) — **worth covering**.
- `RandomModeSetupWizard`, `CubeModeSelectScreen`, `ComingSoonScreen`,
  `MobiusCubeletScreen`, `LevelSelectScreen`, `MergeThemePicker` — small; a cover is
  optional (they're usually pre-warmed by `preloadAppAssets`).

**Fix:** swap the biggest ones' `fallback={null}` →
`fallback={<LoadingScreen transparent showTitle={false} label="Loading" />}`
(`transparent` keeps the menu visible behind a light scrim; no giant title on a
modal). Sites: `src/components/UILayer.jsx` (wizard/store/screen Suspense blocks),
`src/App.jsx` (`ParityStoreScreen`).

### 6. Environment map / background streaming — ⬜ recommended (the core ask)
`SafeEnvironment` (`src/3d/SafeEnvironment.jsx`) loads the photo/HDR background via
drei `<Environment>` with a `null` Suspense fallback. These EXR maps are
**20–26 MB**, so the scene renders first and the background visibly pops in a few
seconds later.

**Fix:** this is exactly what `SceneLoadingGate` is for. Arm it on scene entry;
`useProgress` tracks the EXR/GLB/texture decode and the cube stays up until the
background is ready. Keep the inner `<Suspense fallback={null}>` (it's inside the
`<Canvas>` — a DOM cover can't live there).

### 7. In-Canvas lazy 3D (`GameScene`, `HealerWormMode3DWrapper`, `HolonomyWrapper`, `NebulaEnvironment`) — ⬜ recommended
These are `React.lazy` **inside** `<Canvas>` with `null` fallbacks
(`src/App.jsx`, `src/3d/GameScene.jsx`). The inner `null` is correct (fallbacks
inside a Canvas must be R3F). Cover the gap from the DOM side with the same
`SceneLoadingGate` from #6 — one gate handles both the chunk and the asset decode.

### 8. Story-mode level transitions — ⬜ investigate
Advancing levels can trigger a cube `size` change and scene rebuild. Confirm
whether a visible hitch occurs; if so, arm `SceneLoadingGate` around the rebuild.

---

## Suggested rollout order

1. **✅ Co-op crawler** — done.
2. **Scene/background gate (#3, #6, #7)** — one `SceneLoadingGate` mounted as a
   sibling of the `<Canvas>` in `App.jsx`, armed on every mode launch and disarmed
   when Mobi completes / assets settle. Highest impact: kills "backgrounds loading
   in" and covers a skipped Mobi intro.
3. **Heavy wizard/store fallbacks (#5)** — cheap `transparent` covers on the four
   biggest chunks.
4. **Level transitions (#8)** — after measuring.

Items 2–4 are intentionally left for a follow-up so the gate's timing can be tuned
against the live transitions rather than guessed. The components are ready to drop in.
