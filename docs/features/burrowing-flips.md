# Burrowing automatic wormholes

Standard WORM's existing timed tunnel spawns now approach underneath the cube.
The wave pushes neighbouring whole cubies outward slightly and lights their seams,
then commits to a tile and warns both antipodal endpoints before opening. This
does not add spreading, offspring, or extra spawn clocks.

## Lifecycle

- Burrow across up to five adjacent surface tiles, at 0.6 seconds per tile.
- Settle for 1.8 seconds; both destination seams pulse.
- Commit the pair's normal flip once, then raise the cubies and pads over 1 second.
- Remain usable for 12 seconds. During the last 3 seconds, four amber perimeter
  segments disappear to announce retreat. A jump accepted during this warning
  keeps the tunnel open until the entire worm is clear.
- Close admission and lower over 1 second. Stay underground for 2 seconds before
  starting another approach to the same physical pair.

These clocks use simulation time. Pause, hidden tabs, focus/rescue freezes,
rotations, jumps, rocket flight, tunnel transit and a tail on a raised route hold
the cycle. A new opening or retreat also waits for occupied endpoint cubies.
Reduced motion retains the seam cues while suppressing the small traveling lift.

## State and scope

Only automatic spawns use the cycle. Mobi-created tunnels, manual flips, scripted
Teach/demo/Story connections, and other cube modes keep their existing rules.
The pending approach reserves a population slot and never flips intermediate
tiles. Both ends must still be pristine when a new arrival commits.

Retreat changes access and presentation, **not flip state**. The original pair
identity, deposits, traversal wear and unhealed count remain intact; reopening
does not increment flip counts or earn healing rewards. Existing active-tunnel
caps include underground committed pairs. A collapsed pit never retreats.

During final healing, pending uncommitted arrivals are cancelled and committed
burrows reopen and remain available. Real healing retires the corresponding
cycle. Reset and unmount clear its presentation bridge.

Routes use physical sticker IDs. A committed cube rotation rebuilds an underground
route and restarts its warning; it cannot redirect an opening to a stale grid slot.

## Code and verification

- `src/worm/healerWorm/burrows.js`: simulation lifecycle and route selection.
- `src/worm/burrowBridge.js`: shared access/lift state without frame-rate React updates.
- `src/worm/healerWorm/BurrowEffects.jsx`: one instanced seam/countdown draw.
- `Cubie`, `PadSprings`, tunnel ribbons/cords and portal markers read that same pose.
- `burrows.test.js`, `burrowRender.test.jsx`, and the spawn-clock cases in
  `wormSim.test.js` cover delayed commitment, re-emergence, safety holds, final
  healing, rotations, reset, and actual body/pad transforms.
