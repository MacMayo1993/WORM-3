# Worm character review

| Character | Finding and change |
| --- | --- |
| Classic | Kept the rounded silhouette; shares corrected per-endpoint surface normals and bead clearance. |
| Inch | Replaced render-side step-progress guessing with accumulated simulation travel. Corner dwells, healing pauses and explicit pause hold the contraction. Orb growth eases the loop geometry using reusable lookup buffers. Preview now uses the gameplay gait. |
| Glow | Preserved its light/halo and orb pulse. Shared surface clearance and fresh-mesh colour initialization apply here too. Picker copy describes the implemented lighting rather than a nonexistent hidden-sticker reveal. |
| Book | Replaced thick box leaves with curved paper, a thin binding, contrasting covers and separated open spreads. Reduced the sheet count from eight to four per side. Preview and gameplay share the geometry; platformer uses the same leaf/binding shapes. Turn banking is bounded and frame-rate independent. |
| Wiggle | Each history endpoint's normal rides its own rotating plane before blending. Rendered beads are kept outside the current stationary/rotated slabs, including opposing rotations. The wide wave is retained. |
| Prism | Preserved rainbow rendering and wildcard deposits; shares the surface-frame/clearance fixes and pause-aware animation clock. |

The picker has 48px character-selection targets, selected-state semantics and more readable trait text. Removed unimplemented double-heal and route-hint promises from Inch/Book descriptions. This does not introduce new combat or movement-speed advantages.

Menu correction: restored the photo panorama removed during the theme pass. Readability treatment is confined to home controls and heading.

## Validation

Regression tests check all six surface directions and all three rotation axes against individual cubie boxes, including opposing layer turns. Tests also cover corner clipping, independently rotated normals, crawl-distance commits/pause/reset, gait dwell/growth/cache continuity, book geometry and frame-rate-independent banking. Existing rotation, tunnel, character-face and gameplay tests remain in the full CI gate.

Inspected all six actual preview-mesh silhouettes with an offline vector geometry render. This verifies geometry/framing, not WebGL materials or mobile touch behavior. Live phone QA is still needed: the available browser cannot reach the local preview. Check short/long worms, book covers and hats, repeated side crossings, opposing slices, tunnel entry/exit, jump/rocket, pause/resume and store/setup previews on a device before merging.
