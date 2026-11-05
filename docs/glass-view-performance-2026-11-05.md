# Glass view rendering cost

Reference: main `8c7a96c5` (2026-11-05). This addresses glass view/pickup lag without changing the simulation, view duration, tile tint, portal routes or cube spacing.

## Findings and changes

- Every glass sticker had its own transparent front and antipodal back. The front's `DoubleSide` material made Three r159 submit its 284-triangle, 0.016-unit-thick geometry twice. It now uses `forceSinglePass`; both sides remain visible, and the separately sorted, inward-facing antipodal plane remains. This is limited to thin glass stickers. Thick transparent bodies retain their two-sided two-pass behavior.
- At size 6 and up, on mobile, or under the existing adaptive reduced-FX tier, glass uses shared lower-tessellation geometry: 92 triangles per sticker instead of 284, and 236 per rounded body instead of 716. Bounds, sticker depth, UV mapping and corner/bevel radii are unchanged. This reduces bevel smoothness, not the glass tint, Fresnel edge effect, thickness or see-through behavior. Small full-quality desktop boards retain the original geometry.
- A private glass material clone previously copied all 16 procedural-style uniforms, including an unused DataTexture. Glass now has only its four live uniforms; private colors stay independent while the three rig directions remain shared. The unused per-tile identity callback no longer forces another uniform-upload pass.
- A Glass pickup changed the cube's appearance but the scene's shadow/AO gates only read the saved view. Pickup glass now suspends those opaque-only passes, including pending shadow-map refreshes. The light/shadow program configuration and composer stay mounted, so collecting and expiring a pickup does not relink all lit programs. Expiry restores the prior cadence. A scene already saved as Glass does not mount extra opaque passes during a brief Classic pickup.

Glass still keeps independent per-mesh alpha sorting. It is not put into the opaque tile batch or an unsorted transparent batch. There is still quadratic sticker/draw growth on large boards; these changes do not establish that every device will sustain 60 FPS.

## Reproducible structural measurements

Run `node scripts/perf-worm/glass-cost.mjs`. All exterior stickers are counted as visible in one scene pass; these are actual geometry counts and Three r159 material-pass semantics, not measured whole-scene draws or frame timings. Other cameras, bodies, the core and effects are excluded.

| Board | Sticker submissions before → after | Submitted triangles before → after (desktop) |
| --- | ---: | ---: |
| 3×3 | 162 → 108 | 30,780 → 15,444 |
| 7×7 | 882 → 588 | 167,580 → 27,636 |
| 10×10 | 1,800 → 1,200 | 342,000 → 56,400 |
| 15×15 | 4,050 → 2,700 | 769,500 → 126,900 |

That is one-third fewer glass sticker submissions. Compact boards submit 83.5% fewer glass-sticker triangles; their rounded bodies contain 67% fewer triangles per pass. A 3×3 mobile/reduced-FX board submits 5,076 sticker triangles instead of 30,780. Independent hardware timing is required before converting any of these savings into an FPS claim.

## Regression coverage and limits

- `npm run ci` passed: lint (0 errors, 92 existing warnings), all 7,821 tests across 502 files, production build and bundle budgets. The 18 focused glass tests also passed independently.
- Material tests cover private tint ownership, live shared rig uniforms, portal-cutout wrapping, `DoubleSide`/single-pass transparency and the absence of per-tile procedural textures.
- Render-tree tests cover Story appearances 14 and 28 at 3×3, 7×7 and 15×15, with and without loaded face textures, five slice turns, the flip midpoint, adaptive-quality/reduced-motion changes, view restoration, remount and material disposal.
- Geometry tests preserve bounds, depth, UVs and finite normals; shadow tests cover pickup refresh/replacement, expiry, reduced FX, mobile, saved Glass with a Classic pickup and stale pickup state outside WORM.
- Local Chromium could not launch because this environment blocks its local sockets. No local screenshots, raster comparison, WebGL1 device run or physical-phone FPS measurement is claimed. In particular, the thin-sticker single-pass overlap and lower-detail bevels still require real-browser visual checks. A hosted production-WebGL submission regression and screenshot artifact provide additional coverage.
