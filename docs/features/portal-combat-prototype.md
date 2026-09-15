# Portal Combat prototype

Open **WORM → Play → Portal Combat · Prototype**, then **Start Playing**.
The staged arena waits for **Start combat** before releasing the worm.

This is an optional 5×5 encounter at 1.25 tiles/second. Ordinary WORM runs and
the guided demo retain their own rules. The prototype disables random bombs,
layer-turn hazards, extra portals and special/elemental offerings to isolate
shooting and pursuit. The opening scramble still plays before the arena is set.

## Controls and objective

- Steer, jump and boost with the existing controls. Jumping avoids crawler contact.
- Tap **Fire**, or press **F**. The gun aims at the nearest emerged crawler within
  seven surface steps. With no target, it fires along the current heading.
- The three-shot magazine regenerates one shot every 1.4 seconds. Shots have a
  0.32-second minimum interval and do not consume healing charges or Parity Points.
- Follow the lavender beacon to the spawning portal. Its ring turns amber during
  the 2.5-second warning. At most two crawlers can be active; their movement speed
  is 0.85 tiles/second. They emerge for 0.8 seconds before they can attack.
- A shot defeats a crawler and releases a mint-colored pickup. Collect it to
  restore one shot. Uncollected drops expire after 14 active seconds.
- The player has three shield hits against crawlers, with 1.6 seconds of protection
  after contact. Normal body-collision rules still apply.
- Six matching healing charges are supplied. Enter the marked mouth and let the
  tail clear the exit to seal the portal and end the encounter. The opposite
  mouth may require the other face color, as in ordinary WORM healing.

The end card reports defeated enemies, shots hit/fired and collected drops.
Retry rebuilds the arena, inventory, shield and ammunition. Main menu clears
combat mode. Starting a normal run also clears it. Prototype play grants no
permanent XP, mission awards or currency.

## Simulation and rendering

`src/worm/combat/portalCombat.js` is the bounded combat simulation. Routes use
`getNextSurfacePosition`, the same face-edge topology as the worm. Targeting
uses surface distance; it cannot lock through the cube to the opposite face.
Projectile movement is substepped for collision checks. Face transitions render
through the outside corner, avoiding a straight chord through a cubelet.

The combat clock advances with the worm's clamped timestep. Pause, death,
tunnel travel and tail clearance, healing focus, elemental focus, signature
charge and live rotations hold combat. Input while held is discarded. Rotations
are held defensively; transporting combat actors through rotating layers is not
part of this prototype and is not enabled in its arena.

`CombatScene.jsx` uses fixed pools of two crawlers, eight shots, six drops and
eight impact effects. Scene geometry uses depth testing. Only the active combat
arena mounts these renderers. HUD readouts sample the shared simulation bridge;
frame-by-frame enemy positions do not create Zustand updates. Fire occupies the
signature slot, and the encounter card occupies the mission slot in the measured
bottom dock.

## Verification

The combat tests cover all 150 surface tiles, directed cube-edge interpolation,
range limits, spawn warnings/caps, auto-aim and corner hits, ammunition, damage
and jump protection, pause, drops, healing and run lifecycle. The hook-level
integration uses the actual worm simulation and store for tunnel deposits,
tail clearance, reward isolation and retry behavior.
