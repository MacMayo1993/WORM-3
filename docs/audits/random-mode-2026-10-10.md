# Random mode audit — 2026-10-10

Scope: the mixed Classic cube in demo step 10/11, especially the green/pink patch reported on a metallic tile, plus Random's ten-second remix lifecycle.

## Confirmed and fixed: menu resume caused an extra remix

`useRandomMode` reset its remaining time and applied a new style whenever `inGame` became true. Returning from Settings, the main menu, a tutorial/welcome overlay, or an explicitly suspended wizard therefore remixed immediately, even if the current ten-second cycle had time remaining. That also changed the per-piece view and triggered the application's remix shake unexpectedly.

Only enabling/disabling Random or changing the Worm run identity now resets the cycle. A fresh session retains its initial remix behavior; a paused Worm ready card retains its authored appearance until ten seconds of play. Resuming an existing session continues its remaining active-play time. No additional frame subscriptions, shaders, geometry, or draw calls were added.

Five regression cases pause six seconds into a cycle, spend 45 seconds in an overlay, and verify that the next remix occurs four seconds after resuming. Existing paused-Worm, retry, mobile-style-budget and story-appearance tests still pass.

## Reported color tearing: unresolved

The screenshot contains a localized green/pink patch consistent with overlapping surfaces, but a still image cannot identify which surface or transition produced it. Do not describe the timer change as a fix for this artifact.

The renderer audit exercises the actual Cubie, StickerPlane, solid sticker batch and label batches with mobile and desktop style pools. Across 24 mixed-style remixes and layer turns per pool it checks:

- No duplicate exterior front positions between individual meshes and the solid batch.
- No missing exterior fronts (accounting for intentional wireframe pieces).
- Rounded sticker geometry and current shader/palette remain attached.
- Grid identity labels follow their pieces and obsolete grid/number labels disappear.
- Labels require no asynchronous font rendering.

A Chromium software-WebGL fixture also rendered metallic, carbon-fiber, hex-grid, solid and wood transitions, including exterior-portal material patches, without shader/page errors. The reported patch did not reproduce in these checks. This is not an iPhone Safari GPU test or a mobile frame-rate benchmark.

Next reproduction: an iPhone recording through one ten-second remix, then a cube orbit/turn. Whether the patch appears only at the remix, persists at rest, or changes with viewing angle will distinguish stale surface state from depth/sorting trouble. Also confirm the deployed build before attributing the screenshot to current main.

## Intended behavior

Random mixes Classic, grid labels, Sudoku numbers and other piece views. White numbered tiles beside textured tiles are expected. The palette and finish change; the underlying face identities and solving rules do not. The audit leaves that behavior intact.

## Validation

147 tests passed across Random timing/story, Random renderer, demo skip/exit and demo view startup suites. ESLint passed for the changed source and tests. Production build and bundle-budget checks passed (9 initial files, 530.4 KB Brotli). All five new timing regressions fail against the original hook and pass with the fix.
