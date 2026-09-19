# Continuous tunnel entry, exit and re-entry

Follow-up to PR #1487, based on main `7fe93b04a30eac228da62f4a92031e9e6a0e214b`.

## Reproduced cause

The body already followed a continuous recorded history. The exit animation,
however, recorded **5.3763 world units** of spiral travel above the mouth before
returning the head to that same tile. At 0.09 units per bead, this pulled about
60 beads through the tunnel during the exit animation alone. The entry used
the same elevated orbit, explaining the hovering approach.

The new mouth handoff is axial and only **0.10 units** long. Entry first aligns
with the aperture at crawl height, then descends through its centre. Each
handoff takes approximately 0.18 seconds; the interior ride keeps its existing
timing. The next crawling tick can choose a departure immediately. Camera easing
continues across the phase transition rather than completing its entire move
in those 0.18 seconds.

## Body-flow contract

Let `s` be the accumulated distance along the recorded head route `P`, and let
`d = 0.09` be ordinary bead spacing. Bead `i` follows:

```text
position(i) = P(s - i*d)
body span   = (N - 1)*d
```

If the head crosses the exit at route distance `s_exit`, a bead reaches that
mouth when `s - s_exit >= i*d`. The head's phase does not relocate the body.
The small axial handoff accounts for 0.10 units; ordinary departure supplies
the rest. Pausing adds no route distance and emits no more body.

For example, a 40-bead ordinary worm spans 3.51 units. One unit of crawling
feeds approximately 11 more beads out. Travel is measured along the path, so
turning around can bring the head back through the same physical tunnel while
older portions of the body still occupy it.

The existing conservative heal/closure threshold remains
`(N - 1)*max(0.09, 0.095) + 0.15`, covering Inch Worm spacing and an extra bead
clearance margin. The existing extra clear frame and repeated-pair heal guard
also remain. No new lethal self-collision rule is introduced inside a tunnel.

## Retention and rendering

- The body renderer walks history until it finds each bead's actual route
  distance. An estimated sample-count cap no longer clamps dense histories.
- Completed passages retain their history during a reverse visit. Tests verify
  overlapping incoming and outgoing visits remain present while healing waits.
- Each occupied physical route retains one tube shell. Reversing through that
  route preserves its geometry and reverses the head marker. Entering a different
  tunnel retains the earlier occupied shell too.
- Shell slots are allocated as needed, fade after clearance and are recycled.
  Body history and instance buffers continue to be reused.
- The face follows the local aperture direction during the short handoff.

## Verification

Regression tests cover the old spiral travel, short-tail retention after exit,
pause behavior, ordinary departure and conservative tail clearance, immediate
reverse entry with a queued heal, and shell retention/reuse across routes.
Existing same-face tests cover six faces, sizes 2/3/5/15, 30/60/120 Hz and a
1,200-bead retained history.

The production `WormBody` frame callback is also driven against CPU-side
`InstancedMesh` buffers. Its tests verify that:

1. The exit-to-crawl transition leaves every bead's position unchanged.
2. One unit of surface departure brings out 10–12 additional beads while the
   remainder continues inside the tunnel.
3. Dense histories preserve actual spacing instead of clamping the tail at an
   estimated sample limit.

These are simulation and instance-transform checks. They do not constitute a
GPU screenshot or device frame-time sign-off. The browser's local-preview
access was blocked in this session. Visually check entry, slow departure,
pause and immediate reverse entry with long MOBI/Book/Inch/Prism bodies before
calling all character geometry and camera transitions fully certified.

The path-based slice/cut detection work identified in
`slice-tunnel-integrity-review.md` remains separate and outstanding.
