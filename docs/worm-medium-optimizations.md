# WORM medium-priority optimization pass — 19 September 2026

Base: `b0c33e3`, including physical slice cuts, continuous tunnel extrusion and jump rescue. Scope comes from the earlier September 19 audit: startup imports, static tile thumbnails, repeated trail work, and pickup/healing event and save costs. This pass also disables manual layer rotation in WORM.

## Player input

WORM owns its scheduled layer turns. `CubeAssembly` rejects pointer-down and pointer-move gestures before acquiring a drag or moving any live meshes; this covers both ordinary cubies and the Mega chassis. `useAnimation.onMove` rejects manual commits, including multi-quarter-turn releases. Puzzle keyboard commands and face/tile rotation controls are gated by the current mode. The scheduler still calls `startAnimation`, and puzzle modes retain manual turns. WORM steering, jumping, firing and automatic hazard sequencing keep their existing paths.

CPU scene tests exercise real gesture handlers and frame callbacks on 3×3 and 15×15 boards. Separate hook tests cover manual commit rejection, automatic turns, return to puzzle mode, and jump/undo keys.

## Startup dependencies

Intro, menu and game postprocessing move behind one lazy `SceneEffects` boundary. Their existing device, PiP and performance gates still determine whether a composer mounts. Mobile intro/menu paths do not request these passes. A desktop scene that enables effects loads them when it mounts.

Chunk ownership matters in addition to dynamic imports. CommonJS helpers belong with React, shared Three.js loaders/controls belong with the base 3D stack, and AO/postprocessing belong together. The solver was already dynamically imported by its consumer, but shared helpers had pulled its chunk into startup. The bundle gate now fails if either the solver or postprocessing chunk re-enters the static startup graph.

Service-worker precaching still includes optional application chunks. Deferring evaluation and the initial static import graph does not claim to eliminate all subsequent background downloads.

## Tile previews

Every unselected thumbnail gets a deterministic still image. A bounded LRU retains up to 128 snapshots and at most 4 MiB of CPU pixel data, keyed by style, color and canvas dimensions. Remounting a cached thumbnail copies those pixels instead of synchronizing with the GPU again. Changing style/color invalidates the thumbnail; active animation never overwrites its reusable still.

Only selected, hovered or keyboard-focused thumbnails animate, still limited to 20 Hz and the existing per-frame budget. Registration owns visibility observation and card-level pointer/focus listeners, so settings, store and reward previews receive the same defaults; unregistering removes those observers/listeners. Reduced motion suppresses animation. Registry arrays are rebuilt on membership changes rather than every frame.

Tests count production renderer readbacks: a 30-style static grid draws each unique image once, then produces zero further readbacks over two additional seconds. A cached remount also adds zero readbacks. Selection resumes animation; deselection returns to the cached still; a color change produces one fresh snapshot.

## Retained paint trail

`TRAIL_PAINTING_ENABLED` is already false on the base commit. This pass leaves that product choice in place; these changes therefore make no current-gameplay FPS claim.

If paint is enabled later, settled frames reuse existing geometry and colors. Path edits, body-length changes, palette/character changes, rotations, healing pops and tunnel transitions invalidate the relevant frame. Instance matrices are compared at Float32 precision, and only a dirty span is uploaded. Color buffers update for newly exposed slots or palette changes. Pending off-camera dirty spans merge into one bounded range. The retained history loop also stops at its real end instead of resolving stale ring-buffer slots.

This preserves the existing age-based LOD, frozen sequence-based gait, surface provenance and tunnel exclusion. Structural path edits still walk the retained route to recompute LOD; it is not an append-only trail redesign. Opacity already depends on daub age/index rather than wall time, so a new fade shader is unnecessary for eliminating settled-frame work.

Production instance-buffer tests cover idle reuse, live rotation plus the final settled pose, unchanged color buffers, tunnel hide/restore, tail-length changes, history wrap/reset/remap and pending upload bounds.

## Pickup, healing and persistence

The XP-before-mission ordering is extracted into pure event reducers. Pickup inventory, counters, flash, XP and mission changes now publish together. A heal publishes restored cubies, pops, deposit cleanup, healed count, XP, mission rewards and its existing coin grant together, before any chaos-worker resync.

A synchronous persistence batch wraps each simulation step. Each changed save key is written only once at the end of that step; all in-memory gameplay changes remain immediately visible. Nested batches and exceptions flush at the outer boundary. There are no debounce timers, idle callbacks or unsaved intervals extending past the step. Ordinary store actions outside a batch still save immediately.

Tests compare the combined event sequence with the previous ordered XP/mission actions, including mission transitions and payouts. An eight-pickup burst produces one authoritative player-save write, and the saved XP/wallet exactly matches memory before the call returns. These are deterministic work-count measurements, not a phone latency trace.

## Validation and limits

`npm run ci` passed: 176 test files, 2,154 tests, zero ESLint errors (97 existing warnings), production build and all bundle gates. `git diff --check` passed.

| Static startup metric | Recorded base build | This pass | Reduction |
| --- | ---: | ---: | ---: |
| Raw JavaScript/CSS | 2,299.3 KiB | 2,005.8 KiB | 293.5 KiB / 12.8% |
| Brotli estimate | 607.0 KiB | 492.4 KiB | 114.6 KiB / 18.9% |

The new startup graph contains six files. Its optional solver and postprocessing chunks are absent. The largest lazy chunk is WORM at 286.9 KiB. Existing bundle ceilings were not raised.

Device GPU/frame-time profiling and touch playtesting remain necessary to quantify p95/p99 improvements and confirm the lazy-effect appearance on the target phone. CPU matrix, event and readback-count tests cannot certify GPU visuals or sustained thermal performance.
