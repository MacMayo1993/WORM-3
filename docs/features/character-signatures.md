# Character signature moves

Each character has a signature button above Jump and Boost. Q activates the same
action. Invalid attempts spend no cooldown. Signature clocks advance with crawling
simulation time and freeze during pause, transit and cinematic gameplay freezes.
Death, retry and leaving Worm mode clear the effects.

| Character | Move | Effect | Cooldown |
| --- | --- | --- | --- |
| Classic | Shed Skin | Four-second window to survive one body collision by shedding tail, costing at least one orb's worth of growth | 30 seconds |
| Book | Bookmark | Mark a tile and heading; tap Return within four seconds to fold back to it if clear | 30 seconds from marking |
| Prism | Refract | Next three pickups become useful tunnel colors and provide one extra healing segment each | 26 seconds |
| Wiggle | Sidewinder | 0.18-second sideways dodge toward the last left/right steering input; defaults right | 12 seconds |
| Inch | Spring Loaded | 0.24-second wind-up, then a 2.2-tile jump with increased height | 24 seconds from launch |
| Glow | Pulse Beacon | Five seconds of nearby color-orb/entrance reveals and adjacent-tile color-orb pickup reach | 22 seconds |
| MOBI | Parity Lock | Seal the current or nearest valid entrance up to three tiles ahead for six seconds | 28 seconds |

Cooldowns include active windows. Refract stays armed until three eligible pickups
are consumed; it cannot be stacked while active. Its bonus adds body/inventory
energy, while each collection still produces exactly one pickup/XP event. Prism's
existing wildcard payment remains available. Color selection favors underfunded
live entrances and excludes voided or fully paid entrances.

Shed Skin is consumed only by a confirmed body collision. It cuts enough tail to
remove the collision, reconciles inventory against remaining physical growth,
and provides brief disengagement grace. Bombs, slice hazards and collapsed tunnels
retain their existing rules.

Bookmark's marked tile and heading follow their own cube slice, including opposite
paired turns. Return rechecks the current sticker and body occupancy. It preserves
current inventory, growth, deposits, scores and clocks; spatial body history folds
closed and rebuilds at the destination. Return is blocked during jumps, face/tunnel
crossings and unsettled rotations. Expiry spends the original cooldown.

Sidewinder previews the adjacent landing and travels there using the existing
surface interpolation/body history. It rejects flipped or occupied landings and
cross-face destinations, then resumes the original forward heading. Cube rotation
and hazard rules still apply during the dodge. Boost keeps its independent timer.

Spring previews and rechecks its projected landing after wind-up. Subsequent
steering and hazards can still change its outcome. Beacon alone reveals through
the cube; landing and seal markers obey depth testing. Effects use bounded reusable
meshes with explicit disposal. Parity Lock seals one entrance, follows its sticker,
and restores entry after expiry once any moving cube layer settles. It neither
heals nor deposits orbs.

## Tunnel healing readout

One contextual HUD card replaces the per-entrance floating text signs. A small
depth-tested surface ring identifies the relevant entrance. The card follows the
nearest entrance on the current/next three route tiles, including around corners,
and reports the active tunnel during transit. It clears when no relevant entrance
exists, after death/solve, on mode exit, and during unsettled cube rotations.

Amounts are **additional collected orbs**, not body segments. Each ordinary pickup
provides three segments, while a fresh tunnel needs four. The display uses:

    payable = min(matching reserve, remaining cost, physical tail reserve)
    missing = remaining cost - payable
    additional pickups = ceil(missing / pickup contribution)

Prism can pay with any color; armed Refract increases its next contribution to
four. Saved deposits and carried contribution appear separately in the progress
bar. Ready, healing-on-exit, sealed and traversal-limit states explain what happens
next without changing the underlying economy.

Validation covers deterministic gameplay, real hook/store/button/keyboard/tunnel
lookup integration, pause/retry, inventory reconciliation, effect disposal and
paired cube rotations. Mobile WebGL appearance and subjective balance still need
device playtesting.
