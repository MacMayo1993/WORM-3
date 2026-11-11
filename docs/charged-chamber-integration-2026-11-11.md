# Charged chamber integration

## Scope and review

Integrated the charged mirror traversal and adaptive core-opening work on main commit `913371db1a5b78f20be0a79d4e3b57533e5ce3e7`.

- Mirror seams gather entrance/destination colors, exchange polarity around the crossing midpoint, and send energy toward the exit. The effect uses the existing mirror shader and bounded reflection captures.
- Adaptive panels and circular rims use the actual route/wall intersections. Layout updates run before charge updates, so the charge follows the openings throughout entry-anchored zoom.
- A combined review found that stretching panels invalidated the old normal transform on bevels. The corrected WebGL1-compatible transform matches an inverse-transpose normal matrix. This prevents distorted reflection directions around non-square panels.
- Reduced motion and reduced flashing keep the charge event steady without discharge. Pause holds event progress. Aperture positions can still follow the existing camera-driven zoom, and existing recursive reflections can settle over subsequent captures.
- Inner rims join the reflection subject list; outer rims do not. The original two mirror meshes remain, with two additional pooled rim meshes for the main view. Reflection face counts and target resolutions are unchanged.
- Mirror instance buffers and both rim pools are explicitly disposed. Integration tests cover unregistering rims, preserving capture state, and switching out of WORM mode.

## Local verification

The complete `npm run ci` passed on implementation commit `8559e8f9d014d4b09e012a4a209ead1c001f99da`:

- ESLint: zero errors; 92 existing warnings.
- Unit/component tests: 7,891 passed across 516 files.
- Production build passed.
- Bundle budgets passed: initial route 2,237.8 KB raw and 570.8 KB Brotli, against limits of 2,300 KB and 640 KB.
- Both new browser fixtures bundle successfully. Playwright collects three cases: desktop/phone charged-room rendering and the desktop opening/sleeve regression.
- The actual frame-hook integration test checks charge anchors against the rendered rim instance positions while a bent route zooms, then exercises pause, both calm settings and mode exit.

Chromium could not launch in the local execution environment because its required process socket was restricted. Hosted browser checks are therefore required for actual shader/pixel validation. CI now retains the new fixture screenshots on success as well as failure. These are controlled material fixtures, not gameplay screenshots or mobile GPU benchmarks. Consult the pull request's checks for hosted results.

## CPU-only measurement

An earlier local Node microbenchmark of the combined implementation measured 2,000 changing-zoom updates on a 15×15 room after 200 warm-up updates. It included panel layout, both rim pools and charge uniforms. Mean time was 0.255 ms, median 0.166 ms and 95th percentile 0.592 ms. Active panels ranged from 1,335 to 1,365, compared with 1,350 in the original grid; the allocated pool holds 2,646. This is a helper benchmark, not gameplay FPS or a mobile GPU measurement.

## Geometry limits

An isolated mirror-room opening is centered within its adaptive panel. Nearby same-face openings can share a larger panel. The outward chrome miniature and the outer cube's inner mouths still follow their real traversal intersections, so they are not guaranteed to remain centered on the original moving tiles. Moving those holes independently would obstruct the unchanged worm path. Edge-grazing openings remain clipped at the wall boundary. See `core-portal-openings-2026-11-11.md` for the geometry rationale.
