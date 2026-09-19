# Slice, death and tunnel integrity review

Reviewed 2026-09-19 against main `adba6b5901de741fcc7b2222c47077f8185196b8`.
Implementation branch: `codex/slice-tunnel-integrity`.

This change repairs reproduced geometry and death-ordering defects. It is not
a blanket no-clipping certification. Keep the remaining foundation work below
ahead of new slice abilities or traversal effects.

## What is already sound

- `resolveSliceHits` evaluates all parallel layers before selecting damage.
  Death wins over a cut, and the nearest cut wins over cuts farther down the tail.
- Slice damage is decided once when the scheduled move fires. It is not applied
  again on every animation frame. The head uses the occupied half of its step.
- Rotation commits transform the simulation, history and tunnel descriptors;
  transaction provenance prevents protected crossing samples from rotating twice.
- Tunnel samples remain in the body history after the head resumes crawling.
  Per-sample transit flags prevent the surface renderer from projecting the
  interior tail onto the outside of the cube.
- Passage clearance accounts for tail length and route distance. Healing waits
  an additional simulation frame; the hazard scheduler waits for all passages.

## Repairs in this branch

| Problem | Evidence | Change |
|---|---|---|
| Same-face mouths share one core dock | A new geometry test failed because the core leg had zero length. Traversal still allocated 20% of its parameter span to that point. | Give the two mouths distinct docks along their in-face separation. Reversing entry and exit retraces the same route. The shared path builder updates the worm, tube, ribbon and camera consumers. |
| Body orientation becomes singular on X-axis throats | Extracting the original frame math and testing axial travel produced a zero-length basis vector. Perturbing only `z.x` cannot break X-axis parallelism. | Build a perpendicular reference when the normal and travel direction align. Preserve travel direction and produce an orthonormal, right-handed frame. Used by MOBI, Book, Inch and Prism body rendering. |
| A fatal simulation update can still heal a tunnel | A regression test produced one heal after the worm had entered `dead`. | Stop the tick after a phase handler kills the worm, before passage healing, rewards or special spawning. |
| Fatal bomb damage can be followed by another bomb or a slice | The wrapper holds an earlier store snapshot through its bomb loop. Its death callback updates the store synchronously. | Re-read the alive state during bomb processing and before slice scheduling. Preserve later bombs without disarm rewards or fuse changes. |
| A scheduled hazard can overwrite an uncommitted move | `startAnimation` unconditionally replaces the pending move; the hazard previously had no animation-state gate. | Hold the hazard scheduler until the existing animation commits. |
| A zero-length route leg stops camera frame transport | The camera used `break` for a degenerate leg, skipping all later bends. | Skip the empty leg and continue transporting the frame. |

The geometry defect is consistent with the reported same-manifold glitch when
rotations bring a pair onto the same physical face. If “same manifold” refers to
a different arrangement, that exact board state still needs reproduction.

## Verification and its limits

`npm run ci` passed: **168 test files, 2,076 tests**, production build and bundle
budgets. ESLint reported zero errors and 97 warnings.

New checks cover:

- Same-face paths on every face and sizes 2, 3, 5 and 15: nonzero legs,
  a moving core crossing, reversed-route agreement and containment in the face plane.
- Same-face body histories at 30, 60 and 120 Hz, through exit and windout,
  retaining enough history for 1,200 segments. Samples near a mouth plane remain
  close to an aperture axis; interior transit provenance survives head exit.
- Rigid body orientation for both travel directions on all six face normals,
  including nearly parallel inputs.
- A fatal update with a mature pending heal; repeated death attempts preserve
  the first cause and cannot issue more effects.
- The actual React hazard scheduler, driven with controlled frame callbacks:
  an existing move blocks dispatch; a fatal bomb on the rotation frame prevents
  both further bomb damage and slice dispatch. WebGL children are not mounted.

The same-face history test uses a synthetic long approach to isolate retention
and exit geometry. It is not a 1,200-segment interactive playthrough. Its aperture
check covers the recorded centerline, not every mesh vertex, shader displacement,
page flap, swim offset or camera transition. Existing multi-layer rotation and
surface-clearance regressions also pass.

Visual validation was blocked: the cloud browser returned
`net::ERR_BLOCKED_BY_CLIENT` for the local development preview. No GPU frame-time
measurements or rendered no-clipping sign-off were obtained.

## Foundation work still required

### 1. Make slice detection and cutting use the same measured body path

This is the highest-priority next mechanism. `wormHelpers.js` still determines
body occupancy with `ceil(tailLength * 0.09)` coarse trail tiles, then checks
indices beginning at 1. For the four-segment starter, that limit is 1, so no
body tile is checked. A short worm can visibly span a tile boundary without
the helper considering the trailing side. Longer worms also get quantized
boundary decisions.

`cutWormTail` then assumes `cutTrailIdx * STEPS_PER_TILE` identifies the cut in
the dense history. That assumption does not hold uniformly across corner arcs,
jumps and tunnel flourishes. Impact-position lookup uses the same assumption,
and `shAt` itself does not validate that the requested index is within `count`.

Recommended implementation contract:

- At the start of an accepted turn, snapshot the head and occupied body path
  once, including segment spacing and any explicit immunity.
- Return one immutable result containing the turn ID, actual offending layer,
  reason, route distance, retained history boundary and world impact position.
- Apply damage, trimming, inventory reconciliation and the feedback cue from
  that same result. Do not independently estimate the cut in each subsystem.
- Preserve the existing policy that a wholly contained worm rides a slice and
  that fatal results across any layer outrank cuts. Define the short-worm and
  jump cases explicitly before changing those gameplay rules.

Acceptance cases: starter/long tails; just before/at/after a tile boundary;
corner pivots; jump apex and landing; opposing parallel rotations; identical
outcomes with reversed layer order; exactly one inventory change and one cue.

### 2. Give each occupied tunnel a complete lifetime

The simulation retains multiple `tunnelPassages`, but `TunnelTube` selects one:
the active tunnel or the most recent completed passage. A long worm occupying
two different routes therefore does not retain two independent tube shells.
This mismatch is established by source inspection; a rendered failure has not
been reproduced here.

Give each passage a stable traversal ID and route snapshot, retained until its
last body sample clears. Render occupied route shells from that collection,
deduplicating repeat visits to one pair. Keep mouth appearance, interior
visibility, collision protection and heal eligibility on the same lifetime.
Pool these meshes and rebuild only when a route changes; do not add a fresh
allocation or a complete route reconstruction for each body segment per frame.

### 3. Enforce clearance for the complete rendered body

The current surface guard intentionally skips transit samples, including the
outside windout flourish. Interior samples must remain exempt, but an outside
sample is not automatically safe after swim motion, character geometry and
mouth healing are applied. The geometric tests in this branch do not certify
those final meshes.

Add an explicit distinction between interior route, aperture crossing and
outside flourish samples. Use character bounds and aperture clearance to
constrain decorative motion near the mouth, while preserving the actual
recorded route. Avoid a generic outside-cube projection for interior segments:
that would recreate the body-ejection glitch.

### 4. Add a repeatable visual regression scene and a small event trace

A development-only scene should select face pair, tile positions, cube size,
character, tail length and frame step. Include same-face adjacent/corner mouths,
both traversal directions, two occupied tunnels, healing and immediate turns
after exit. Pause and scrub through the last interior segment leaving the mouth.

Keep a bounded trace of run ID, hazard ID, selected layers, damage result,
rotation commit, traversal IDs and heal/death events. Export a reproduction
seed and the trace on demand. This would make intermittent bugs diagnosable
without logging every body segment each frame.

## Player experience after the foundation passes

The first improvements should explain existing rules: one unambiguous impact
cue at the actual cut point, a brief last-event view for deaths, and an exit
clearance indicator that stays active until the tail is safe. Defer new slice
powers, extra portal motion and added hazards until path-based damage and
rendered exit clearance pass the cases above.
