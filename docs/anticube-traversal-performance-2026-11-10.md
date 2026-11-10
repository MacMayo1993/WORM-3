# Anticube reflection traversal cost

Baseline: `main` at `6f28c2de` (through PR #1921).

## Finding

The mirror layer excluded exterior objects from **drawing**, but Three r159's
`WebGLRenderer.projectObject` still recursively visited their children. The
probe rendered the full game scene for each cube-map face: two extra full-scene
projection walks per capture frame on mobile/reduced FX, three on desktop, in
addition to the main view. It also updated the full scene's transforms once
for every capture batch. Those walks grew with the exterior board even though
the mirror could not see it.

This is separate from the intended center-crossing pace. The current ride
splits its existing total budget by route length and clamps the core crossing
to 1.6–2.4 seconds. No simulation or camera timing is changed here.

## Change

The probe now renders a small dedicated scene containing references to the
mirror room, registered subjects and visible lights. It does not reparent live
objects, duplicate their materials or geometries, or update them relative to
the capture scene. Only those subtrees and their ancestors/lighting targets
receive transform updates. Invisible ancestors and nested/overlapping subjects
are respected, and newly mounted children and lights are picked up.

The source scene's environment, fog, background and material override remain
the capture's inputs. The existing ping-pong targets, resolution, capture
cadence, per-frame face budget and complete-cube publication are unchanged.
Render targets, cube faces, mip levels, pending shadows and XR state are still
restored if a draw fails. Portal cutouts, retained-tail openings, head fit and
contact shadows are untouched.

One full-scene walk to discover lights remains per capture batch. This change
removes the repeated per-face projection walks and the extra full-scene
transform update; it does not claim to eliminate all scene or GPU costs.

## Verification

- All 7,872 unit/integration tests pass across 513 files. Lint reports zero
  errors (92 pre-existing warnings). The final focused capture tests also pass.
- The production build and bundle budget check pass (`npm run ci`).
- A structural regression adds 10,000 unrelated scene objects and verifies
  that the capture traverses only the room, worm and light subtrees, with no
  exterior transform updates. This is an object-count check, not an FPS test.
- Tests cover moving ancestors, source-scene visibility, hidden ancestors,
  nested subjects/lights, late-mounted children, detached subjects, scene
  inputs, externally maintained matrices and disposal without reparenting.
- Probe tests retain capture cadence, complete ping-pong cubes and no feedback,
  including failure recovery from a nondefault target/cube face/mip level.

Local Chromium could not start: the environment rejects its Unix socket with
`socket() failed: Operation not permitted`, including an escalated attempt.
There are therefore **no before/after browser timings, GPU measurements, or
visual approval** for this change. Validate the first crossing, a repeated
crossing and a long-tail ride on a real GPU before claiming the reported lag
is completely resolved.

Reproduction on a machine that can run Chromium:

```sh
npm run ci
npx vite build --config scripts/perf-worm/vite.perf.config.mjs
CHROMIUM=/path/to/chromium node scripts/perf-worm/travel.mjs \
  --size=5 --pairs=4 --out=/tmp/anticube-travel.json
CHROMIUM=/path/to/chromium node scripts/perf-worm/ride-camera.mjs \
  --size=5 --tail=30 --scramble=6 --attrib --raw=/tmp/anticube-camera.json
```

Use identical quality settings and hardware for baseline/current measurements.
The harness suppresses draws by default to isolate CPU submission work; even a
successful CPU comparison would not establish real-device GPU frame rates.
