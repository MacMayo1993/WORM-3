# Bands attached to the antipodal core

Follow-up to the tile-by-tile antipodal center in PR #1642.

The core's sticker plane and tunnel dock now share one offset. The shared tunnel
path keeps straight outer throats, then uses cubic shoulders that meet the core
face along its normal. The inner crossing is also tangent-continuous. A cached
arc-length table keeps worm, camera, ribbon, and resting-cord sampling together.

The ride floor's body clearance and its rails taper to zero at each core dock.
Both docking cross-sections are explicit mesh vertices, including on Mega cubes;
the two-strip renderers retain a vertex on each side of the hidden core gap.
This prevents the former offset into neighboring stickers and missing exit segment.

Rendered dock positions and widths follow the core's zoom around its entry tile,
including other visible connections. This is a presentation transform; it does
not change the logical pair or the simulation's traversal progress. Slice turns
continue to carry the same physical core tiles and their docks.

The solid band uses smooth shading and a restrained highlight in its face colors.
Flip waves are pinned at the core as well as the outer mouths. The ride camera
smooths its banking across the tiny core independently of the body's tighter turn.
Resting connections remain one merged draw, with 32 segments per pair; focus
bands use 96 segments, or the existing 160 in WORM.

Regression coverage includes the actual ribbon edges and rails on all six core
faces at sizes 2, 3, 6, and 15; exact dock locations through turns and zoom; tangent
continuity; reverse traversal; aperture clearance; and camera continuity.
