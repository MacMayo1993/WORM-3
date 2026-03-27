# Full Repository Review (2026-03-27)

Scope: architecture, performance, reliability, DX, and fringe-use-case readiness for WORM-3.  
Constraint followed: **no fixes implemented**, only opportunities and potential remediation paths.

## Method used

- Read core architecture docs and runtime entry points (`README.md`, `src/App.jsx`, `src/hooks/useGameStore.js`, `src/hooks/useChaosWorker.js`, `src/workers/chaosWorker.js`, build/test config).
- Ran quality gates to capture current baseline (`npm run test`, `npm run lint`, `npm run build`).
- Focused on hotspots indicated by file size and coupling (large UI/3D modules, central store, worker boundary).

---

## Executive summary

The project is feature-rich and already has strong foundations (worker offloading for chaos, existing test suite of 249 tests, chunking strategy in Vite, modularized game logic). The main opportunities are now in **complexity management** and **operational hardening**:

1. **Complexity concentration**: several very large components/modules create maintainability and regression risk.
2. **Performance predictability**: build output still shows very large chunks and at least one failed lazy-loading split.
3. **State orchestration risk**: a lot of global state + side effects in a single store and main app flow.
4. **Lint hygiene debt**: 39 warnings indicate dependency-array and fast-refresh structural issues that can hide stale-state bugs.
5. **Fringe-case hardening**: persistence schema evolution, long-session memory pressure, low-end device degradation, and atypical browsers deserve explicit handling.

---

## Findings and opportunities

## 1) Architecture and maintainability pain points

### 1.1 Monolithic files remain in critical runtime paths

**Observation**
- Core files are very large (e.g., `src/App.css` 3160 lines, `src/worm/HealerWormMode.jsx` 2370 lines, `src/3d/StickerPlane.jsx` 1539 lines, `src/App.jsx` 1165 lines).

**Risk**
- Higher cognitive load for feature work.
- Regressions become harder to localize.
- Refactors become “all-or-nothing,” so debt accumulates.

**Potential fixes**
- Split by behavior seams:
  - `App.jsx`: move mode handlers into per-mode controller hooks.
  - `HealerWormMode.jsx`: separate simulation, input mapping, camera logic, HUD projection.
  - `App.css`: segment into layer files (`layout`, `hud`, `wizards`, `responsive`) and compose via imports.
- Introduce a “max file size” lint or CI policy for new/modified files (soft threshold first, then enforce).

### 1.2 Single global store has broad blast radius

**Observation**
- `useGameStore` hosts many domains together: cube/session/UI/chaos/disparity/modes/persistence flags.

**Risk**
- Any large state transition can unintentionally affect unrelated domains.
- Testing state transitions in isolation becomes harder.

**Potential fixes**
- Split store into domain slices (e.g., `sessionSlice`, `visualSlice`, `chaosSlice`, `campaignSlice`).
- Add domain-level selectors/actions and prohibit cross-domain writes except via orchestrators.
- Add “state transition tests” for high-risk actions like `resetGame`, mode toggles, and campaign transitions.

### 1.3 Main app orchestration is still high-coupling

**Observation**
- `App.jsx` coordinates intro, menu, game, chaos setup, wizard completion, teach mode, worm modes, victory flow, and numerous callbacks.

**Risk**
- Hard to reason about order-of-operations bugs.
- Small changes can cause unexpected side effects in distant modes.

**Potential fixes**
- Introduce an explicit app-state machine (menu/intro/game/cutscene/worm/disparity setup) to encode allowed transitions.
- Move handler clusters into dedicated “flow modules” (e.g., freeplay flow, campaign flow, disparity flow).
- Add transition contract tests (“from X, event Y must end in Z with flags A/B reset”).

---

## 2) Performance optimization opportunities

### 2.1 Lazy-load split is partially defeated

**Observation**
- Build warns that `HealerWormMode.jsx` is dynamically imported in `App.jsx` but also statically imported in `src/3d/GameScene.jsx`, so it is not split as intended.

**Risk**
- Larger initial/main bundle for users who never enter that mode.
- Slower startup and worse mobile first-interaction latency.

**Potential fixes**
- Eliminate static import path overlap by introducing a wrapper interface loaded only from one place.
- Use route/mode boundary-based dynamic imports consistently.
- Track chunk budgets in CI (fail if main chunk exceeds threshold).

### 2.2 Chunk sizes are still large for mobile constraints

**Observation**
- Build reports chunks >500 kB after minification (`index`, `vendor-r3f`, `vendor-three`).

**Risk**
- Slow parse/execute on lower-end devices.
- Higher memory pressure and possible thermal throttling on long sessions.

**Potential fixes**
- Expand granular manual chunking (by feature modes, 3D environments, teach/worm systems).
- Convert heavy optional systems to on-demand loading (wizards, advanced modes, large environment packs).
- Evaluate alternative delivery for large assets (deferred model/env map loading by mode).

### 2.3 Potential hot-loop + allocation hotspots still likely

**Observation**
- Existing internal docs already identify frame-loop allocation concerns and suggest adaptive quality tiers.

**Risk**
- Frame spikes and GC jitter during intensive chaos/worm scenes.

**Potential fixes**
- Continue optimization roadmap in the rendering audit: reusable temp objects, adaptive DPR/effect tiers, instancing extension, and idle-frame bypasses.
- Add lightweight runtime performance telemetry (FPS + frame budget + draw call counters exposed in dev HUD).

### 2.4 Worker/main-thread synchronization edge cost

**Observation**
- Chaos mode relies on worker messages and manifold map rebuild/sync coordination.

**Risk**
- In high-chaos + larger cubes, message volume or sync timing may become a bottleneck.

**Potential fixes**
- Add instrumentation around worker tick throughput and message payload sizes.
- Consider binary/structured compact payload shapes for frequent updates.
- Add stress benchmark scenarios (e.g., 7×7 high chaos for 10+ minutes).

---

## 3) Correctness and reliability pain points

### 3.1 Lint warnings indicate stale-effect risk

**Observation**
- Current lint run reports 39 warnings, including missing hook dependencies and refs-in-cleanup warnings.

**Risk**
- Subtle stale closure bugs in rendering/effects.
- Hard-to-reproduce behavior under rapid mode switches.

**Potential fixes**
- Triage warnings into:
  - “intentional with comment + invariant proof,”
  - “fix now” (dependency cleanup, extracted stable callbacks),
  - “defer with issue + owner.”
- Aim for “zero unknown warnings” policy (allow-list only intentional cases).

### 3.2 User-facing blocking `alert()` calls in gameplay flow

**Observation**
- Save/load state feedback in `App.jsx` uses `alert()`.

**Risk**
- Blocking UI pauses in immersive/real-time contexts.
- Poor experience on mobile/PWA shells.

**Potential fixes**
- Replace with non-blocking toast/HUD notification system.
- Include recoverable error patterns for incompatible save data.

### 3.3 Persistence has no explicit schema version/migration path

**Observation**
- Settings and tutorial flags are read directly from localStorage without versioned migration metadata.

**Risk**
- Future shape changes can cause silent fallback or malformed merged settings.
- Harder to recover from legacy/corrupt persisted payloads.

**Potential fixes**
- Add `worm3_settings_version` and migration steps.
- Validate persisted payload with a small schema validator before merge.
- Emit one-time telemetry/logging for migration failures.

### 3.4 Reset semantics are broad and easy to regress

**Observation**
- `resetGame` clears many cross-domain fields at once (session, chaos/disparity visuals, history, etc.).

**Risk**
- New domain fields can be forgotten in reset, causing ghost state leaks.

**Potential fixes**
- Define per-domain reset contracts and compose `resetGame` from them.
- Add snapshot tests asserting reset invariants for each mode.

---

## 4) Testing and verification opportunities

### 4.1 Coverage focus omits much of interactive runtime

**Observation**
- Coverage config includes `src/game/**`, `src/utils/**`, and `src/levels/**` only.

**Risk**
- UI hooks, 3D components, and mode orchestration can regress without coverage signal.

**Potential fixes**
- Keep logic-heavy coverage scope, but add targeted integration tests for:
  - `useGameStore` transitions,
  - worker bridge (`useChaosWorker`) contract behavior,
  - critical flows (intro → menu → level, disparity setup → first flip → countdown).
- Add smoke tests for lazy mode loading boundaries.

### 4.2 Missing long-session / endurance test profile

**Observation**
- Current tests are fast and logic-focused; no soak tests for prolonged gameplay.

**Risk**
- Memory leaks or drift in long real sessions remain undetected.

**Potential fixes**
- Add optional endurance test harness in CI-nightly:
  - scripted 30–60 minute simulation,
  - monitor memory, event listener counts, worker lifecycle churn.

### 4.3 No explicit bundle budget gating in CI

**Observation**
- Build emits size warnings, but CI does not enforce thresholds.

**Risk**
- Bundle growth goes unnoticed until user-reported perf degradation.

**Potential fixes**
- Add CI step parsing build output (or bundle analyzer JSON) with hard/soft limits.
- Track historical trend for main and vendor chunks.

---

## 5) Developer experience (DX) and process opportunities

### 5.1 Lint policy allows warning accumulation

**Observation**
- `npm run lint` passes with warnings, and warnings are numerous.

**Risk**
- Warning fatigue; important warnings get ignored.

**Potential fixes**
- Introduce “no net new warnings” policy.
- Promote selected warning classes to errors once cleaned up.

### 5.2 Documentation is broad but lacks operational runbooks

**Observation**
- README is feature-rich and architecture-heavy, but production incident runbooks are less obvious.

**Risk**
- Slower response to regressions (e.g., chunk load failure patterns, worker desync issues).

**Potential fixes**
- Add `docs/runbooks/` for common incident classes:
  - chunk mismatch/caching incident,
  - chaos worker desync,
  - save-state corruption handling.

### 5.3 Feature growth outpaces explicit ownership boundaries

**Observation**
- Large mode surface (teach, holonomy, disparity, healer worm, merge, biome) suggests high cross-team coupling risk.

**Risk**
- Refactors stall because ownership is ambiguous.

**Potential fixes**
- Add CODEOWNERS by domain (`src/worm`, `src/3d`, `src/hooks`, `src/levels`).
- Require architectural decision records (ADRs) for cross-domain changes.

---

## 6) Fringe use cases you may not have considered

### 6.1 Atypical browser + WebGL degradation paths

- Corporate/managed devices with strict GPU sandboxing may force software rendering.
- Safari/iOS memory pressure may trigger context loss in long sessions.
- Users with reduced-motion preferences may still enter expensive mode transitions.

**Opportunities**
- Explicit degraded rendering profile and runtime fallback banner.
- Automatic quality downgrades after repeated frame overruns/context loss events.

### 6.2 Save-state drift across versions

- Users can keep very old localStorage payloads across deploys.
- Mode-specific settings can become incompatible after schema changes.

**Opportunities**
- Versioned save schema + migration + backup/restore fallback.
- “Safe mode” startup if payload parse/migration fails.

### 6.3 Very long play sessions with repeated mode switching

- Frequent enter/exit of worm/disparity/teach modes may accumulate listeners/objects if any cleanup path is imperfect.

**Opportunities**
- Automated “mode-switch torture” test loop.
- Debug panel counters: active workers, listeners, effect composers, textures/materials.

### 6.4 Accessibility edge cases beyond keyboard shortcuts

- Colorblind users in advanced visual themes.
- Cognitive overload from simultaneous overlays/HUD layers.
- Screen readers for menu and setup flows.

**Opportunities**
- Palette accessibility presets with contrast checks.
- “Minimal HUD” mode and progressive disclosure toggles.
- Basic ARIA audit for non-canvas UI components.

### 6.5 Offline / flaky-network deployment behavior

- GitHub Pages deployments can create transient stale chunk references (already partially handled via `vite:preloadError` reload).
- Repeated reload loops are possible if a CDN/proxy serves inconsistent cache state.

**Opportunities**
- Add bounded retry/backoff and fallback “hard refresh instructions” UI.
- Optional service worker version pinning strategy.

---

## Prioritized roadmap (suggested)

### Immediate (1–2 sprints)

1. Resolve lazy-load/static-import conflict for heavy modes.
2. Reduce lint warning debt for hook dependency correctness.
3. Introduce persistence versioning + migrations.
4. Add bundle budget checks to CI.

### Near-term (1–2 months)

1. Slice `useGameStore` into domain modules.
2. Extract high-coupling flows from `App.jsx` into explicit state machine/controller layer.
3. Add integration tests for mode transitions + worker contracts.

### Strategic (quarter)

1. Performance/adaptive-quality framework tied to runtime telemetry.
2. Endurance test harness + mode-switch torture suite.
3. UI/CSS architecture segmentation and component-level styling boundaries.

---

## Baseline command outputs captured

- Tests: `17` files / `249` tests passing.
- Lint: passes with `39 warnings`.
- Build: succeeds with chunk-size warnings and one dynamic-import conflict warning.

These results are suitable as a before-state benchmark for future optimization work.
