# Centred chamber openings

## What changed

- The mirror chamber now fits its panel grid around the real route/wall crossings. An isolated opening has a symmetric panel; nearby same-face openings share one panel instead of slicing through each other's tile. Remaining wall spans are divided into similarly sized panels, with narrow leftover spans treated as joints.
- Circular core rims are continuous geometry centred on the exact sampled crossing used by the shader. They remain inside the existing sticker-width budget, are clipped at their face boundary, and do not enlarge the bore. The previous fixed 0.012-world-unit glow was disproportionately wide on small tiles and split at tile seams.
- The outer cube's inner mouths now use a short recessed sleeve and pearl bevel. Circular sections lie parallel to the wall and shear along the route, rather than tilting a funnel against a circular cutout. The lip sits in front of the inner tile and dimming layers. The centre stays empty.
- All existing live/tail route collection, per-face texture capacity, caching and pooled mouth geometry remain intact. The worm/camera path and cutout radius are unchanged.

## Why not snap the hole to the old tile centre?

The enlarged core grows about its entry dock while the simulation path is fixed. For a bent 3×3 route at 1.5× zoom, the far opening crosses 0.499 tile pitches away from the nearest original tile centre. Moving the opening to that centre would displace it by 0.106 world units, more than the 0.082 aperture radius, putting the worm through solid wall.

Keeping zoom at one avoids this sliding but loses the enlarged chamber. Discrete aligned zoom values still drift during growth and do not solve arbitrary two-axis/same-face paths. The inner mirror room can instead adapt its panels without moving the traversal. Colours are sampled from the nearest corresponding original core tile.

## Remaining geometry constraints

The outward chrome anticube remains a miniature of the play cube. Its tiles therefore still move past the fixed route under zoom; its new concentric rim is passage-centred, not guaranteed tile-centred. The outer cube's inner-wall openings likewise follow the real raised-mouth routes rather than snapping away from them. Openings grazing a room edge remain clipped at that edge, rather than enlarging into a perpendicular face. Strict tile centring in these cases requires a separate path/zoom redesign.

## Verification

- Full lint, 7,876 tests across 514 files, production build and bundle budgets passed. The final mirror-subject lifecycle/warm-up adjustment also passed all 17 focused geometry/render tests.
- Added tests for the formerly seam-straddling bent exit, exact rim/cutout centres, original width budget, sizes 2–15, same-face routes, pooling, deactivation and the open recessed sleeve.
- The bent 3×3 exit panel centre matches the route crossing within 1e-7 world units.
- Local 2,000-update 15×15 geometry microbenchmark: approximately 0.37 ms per changing-zoom update, including panels and both rim pools. Active panel count ranged from 1,335–1,396 against 1,350 original panels. This is a CPU-only helper measurement, not gameplay FPS or a mobile GPU benchmark.
- Browser/WebGL verification was attempted but Chromium could not open its required local process socket (Operation not permitted), including with the reviewed execution escalation. No live gameplay screenshot or shader-pixel result is claimed. Existing portal pixel regressions must be run in an environment that permits Chromium.
