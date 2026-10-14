# Elemental abilities

All six base elements now offer value without enemies. They use existing Jump,
steering and Boost controls, plus bounded feedback batches; there are no new
per-frame Zustand updates.

| Element | Benefit | Limits and controls |
| --- | --- | --- |
| Fire | Ready flame dash; nearby growth orbs ignite and give twice their normal growth | Boost: 0.75 seconds at 1.5× base speed. Six distinct surface tiles recharge it. Six bonus pickups per Fire claim. Ordinary Boost and flame dash use the greater speed multiplier, not their product. |
| Water | Starts with full momentum; sweeps ordinary growth orbs from the two adjacent lanes at ≥80% momentum | +25% speed at full momentum. Ordinary turns retain 65%; existing momentum-preserving fusions retain all of it. |
| Earth | Starts with a spring and two garden buds; landings grow two more | Buds ripen in 1.5 simulation seconds. Six buds per Earth claim, including existing unharvested buds. Mature buds use normal pickup credit and never respawn. |
| Ice | Completing a queued slide-turn grants +25% speed for 0.55 seconds; one ice shell saves a body collision | Shell breaks into a 1.2-second body-pass window. It does not prevent bomb, slice or other deaths. |
| Air | Existing larger jumps plus adjacent-tile airborne collection and a controllable glide | Hold Jump near the apex to slow descent; release to resume it. A finite 1.2-tile hold budget adds at most 0.9 tile of travel per jump. Midair steering and the landing marker remain live. Rocket flights are excluded. |
| Lightning | Every four seconds chains through up to three ripe growth orbs; discharges also hit nearby enemies and defuse nearby bombs | First target within three surface steps, later targets within two. Own storm marks cannot kill/cut the owner, including marks that land after expiry. Existing charged-tunnel behavior remains. |

Growth is expressed in the existing game economy: a normal orb adds three
visual body segments, so an ignited orb adds six. Each collection still emits
one pickup event for objectives, with its original face/color identity. Fire
has a separate six-pickup bonus budget; fusing a different element does not
refill it. Earth likewise does not reset its budget on another element's claim.

## Ordered reactions

- Fire → Water / Steam collects ignited orbs within two surface steps, including
  elevated ones, and keeps its existing combat/bomb effects.
- Water → Fire / Quench lays obsidian through flame dashes as well as ordinary
  trails; turns on it preserve momentum.
- Fire → Earth / Wildfire plants one seed per dash step within Earth's budget,
  retaining its spring-landing fire burst.
- Earth → Fire / Emberseed turns ripening gardens into small growth showers,
  planting additional buds only while the same six-bud budget remains.
- Ice → Lightning / Static discharges a collection chain on a completed drift,
  even during the ordinary chain cooldown. Its former storm-speed reaction stays.
- Air → Earth / Highlands grows up to three buds on landing and retains its
  charged spring. Available unoccupied tiles and the shared budget bound planting.

Other ordered recipes retain their existing reactions and inherit the upgraded
base abilities. Tutorial, pickup descriptions, live feedback and the recipe
guide describe the new behavior.

## Presentation and lifecycle

Heat pips, flame fronts, burning orb markers, ripening buds, water/wind rings,
ice-shell/shatter cues and chain arcs use three instanced meshes and one line
buffer. Their clocks come from the sim, freeze on pause/transit, and respect
reduced motion. Tile effects follow live cubie transforms; rotation commits
carry garden/ignition metadata, heat identities and event anchors with tiles.
Immature buds are shown as buds rather than collectible parity gems.

Deterministic tests exercise caps, pickup accounting, ordinary hazards, the six
reactions, pause/reset, rotation, glide release and Boost cooldown. Render tests
check finite geometry, live tile movement, hidden transit and resource disposal.
The browser smoke script is documented in `scripts/perf-worm/README.md`.
