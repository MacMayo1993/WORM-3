# WORM-3 Codebase Optimization & UI/UX Improvement Opportunities

This review focuses on high-impact, low-risk changes first, then medium-term architectural improvements.

## Top 5 Quick Wins

1. **Stabilize global keyboard listeners to reduce re-binding overhead**  
   `useKeyboardControls` re-registers `window.keydown` whenever dependencies such as cursor state change, which can happen frequently during gameplay. Move mutable values behind refs or read from store snapshots inside the handler so the listener is attached once per mount.  
   **Impact:** lower event churn, simpler profiling traces, fewer stale-closure bugs.

2. **Batch Zustand selectors in input-heavy hooks**  
   Hooks like `useKeyboardControls` and `useCursor` pull many store values with separate selector calls. Converting to grouped selectors (with shallow comparison) in hot paths can reduce render pressure during rapid interactions.  
   **Impact:** fewer re-renders while moving/rotating quickly.

3. **Improve intro screen accessibility semantics**  
   Intro CTA buttons are visually clear but can be improved with stronger accessibility cues (`aria-label` wording, explicit button type, and optional keyboard shortcut hint text).  
   **Impact:** better keyboard/screen reader support and clearer first-time onboarding.

4. **Replace inline style objects used every render with CSS classes where practical**  
   Some frequently rendered UI nodes (especially in overlays) build inline style objects in render paths. Migrating stable styles to CSS classes lowers prop churn and keeps visual design easier to iterate.  
   **Impact:** cleaner component trees and easier future theming.

5. **Add reduced-motion handling for high-animation UI moments**  
   Intro/post-processing and pulsing UI effects are attractive, but users with `prefers-reduced-motion` should receive toned-down transitions and less aggressive pulsing.  
   **Impact:** accessibility compliance and lower GPU spikes on constrained mobile devices.

---

## Performance-Focused Opportunities

### 1) Input + State Update Efficiency
- **Where:** `src/hooks/useKeyboardControls.js`, `src/hooks/useCursor.js`.
- **Opportunity:** isolate hot path updates and avoid broad dependency arrays for global listeners.
- **Suggested implementation:**
  - Keep a single listener attachment.
  - Use refs for mutable callbacks/flags or derive current state from a `useGameStore.getState()` snapshot in the keydown handler.
  - Keep handler branch checks fast (early exits for text inputs, overlays, modals).

### 2) Reduce startup/main-thread pressure in `App.jsx`
- **Where:** `src/App.jsx`.
- **Opportunity:** the app entry orchestrates many concerns (intro timing, mode switching, hooks, 3D branch selection). Continue splitting feature orchestration into subcontrollers to reduce top-level re-render scope.
- **Suggested implementation:**
  - Extract intro-specific logic into an `useIntroFlow` hook.
  - Extract mode navigation into an app shell state coordinator.
  - Memoize derived structures that are passed deeply.

### 3) Runtime feature flag gating for expensive effects
- **Where:** intro/game post-processing branches.
- **Opportunity:** allow automatic quality scaling based on FPS/device capability.
- **Suggested implementation:**
  - Add a “dynamic quality” setting defaulted on mobile.
  - Lower bloom/chromatic aberration intensity or disable secondary effects under load.

### 4) Testing around input behavior regressions
- **Where:** existing test suite under `src/__tests__`.
- **Opportunity:** add tests for keyboard handler behavior with level-feature restrictions and modal-open scenarios.
- **Impact:** safer refactors when optimizing listener wiring.

---

## UI/UX-Focused Opportunities

### 1) Onboarding flow clarity
- **Where:** `src/components/screens/WelcomeScreen.jsx`, tutorial screens.
- **Recommendations:**
  - Add a compact hint row under CTA (“Press Enter to start”, “Press S to skip intro after 2s”).
  - Surface one-line control affordances immediately after entering gameplay.

### 2) Mobile ergonomics
- **Where:** bottom nav + mobile controls components.
- **Recommendations:**
  - Ensure primary actions remain inside thumb-reachable zones.
  - Add subtle haptic/tactile visual feedback (pressed states with stronger contrast).
  - Keep touch targets at least ~44px logical size consistently.

### 3) Information hierarchy during play
- **Where:** top bar/HUD overlays.
- **Recommendations:**
  - Prioritize core puzzle signals (moves/time/objective) over advanced toggles.
  - Group secondary controls into collapsible sections to reduce cognitive load.

### 4) Empty/error/loading states
- **Where:** lazy-loaded branches and menus.
- **Recommendations:**
  - Add lightweight skeleton/loading text when deferred components are mounting.
  - Standardize recoverable error notices for missing assets or unsupported features.

---

## Suggested Implementation Order

1. Optimize keyboard listener wiring + selector batching in hot hooks.
2. Add reduced-motion + dynamic quality toggles.
3. Improve welcome/tutorial CTA hints and accessibility semantics.
4. Expand tests around keyboard/overlay interaction constraints.
5. Continue decomposing `App.jsx` orchestration for long-term maintainability.

