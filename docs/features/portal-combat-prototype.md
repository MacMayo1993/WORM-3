# Portal Combat prototype

Open **WORM → Play → Portal Combat · Prototype**, then **Start Playing**.
The 5×5 arena waits for **Start combat**. Worm speed is 1.25 tiles/second.

## Fight or seal

Survive three waves (3, 5 and 7 enemies), or seal the marked portal early with the
six supplied matching healing charges. Real tunnel deposits and tail clearance
still determine when sealing finishes. The two outcomes have distinct results:
**Arena cleared** versus **Portal sealed**. Ordinary body-collision rules apply.

| Enemy | Health | Behavior |
| --- | --- | --- |
| Pink crawler | 1 | Steady pursuit at 0.85 tiles/second |
| Amber dasher | 1 | Pauses 0.45s to telegraph, lunges for 0.5s, repeats every 3s |
| Violet armored crawler | 3 | Slow pursuit at 0.62 tiles/second; visible armor plates disappear with damage |

Waves cap live enemies at 2, 3 and 4 respectively. Four-second breaks between
waves refill the magazine and repair **one** shield, up to three. The worm keeps
moving during these breaks. The first emergence has a 2.5-second warning; enemies
spend another 0.8 seconds emerging before attacking or becoming targetable.

## Shooting and elements

Hold **Fire** or **F** to keep shooting. Release to stop. Losing pointer capture,
canceling a touch, blurring the window, pausing, entering a tunnel, death or victory
cancels held fire. Resuming requires a new press. Keyboard activation via Enter
still fires a single shot. Holding works through an empty magazine's recharge.

The magazine holds three shots, recharges one every 1.4 seconds and has a
0.32-second firing interval. Steer to aim: assistance selects an emerged enemy
within 20° of the worm's forward heading, on the same face and at most seven
world units away. It prefers the closest alignment, then distance. A dotted aim
line and four-part target reticle preview the next shot. Enemies crossing onto
another face cannot be locked.

Shots fly straight along the previewed direction at eight units/second, without
homing or reacquiring targets. They stop at the current face boundary. With no
eligible target they fire directly forward. Lightning can still chain around an
edge after a direct hit. Shooting never consumes healing charges or PP.

Defeated enemies drop ammo. Every other kill also produces a larger colored
pickup, cycling through all five elements. Pickups attract from one surface step
away while grounded and expire after 20 active seconds. An elemental pickup
replaces the current infusion and gives **14 active seconds** of enhanced shots.
Shots retain the element they had when fired.

| Infusion | Effect in addition to one impact damage |
| --- | --- |
| Fire | Burns for 0.75 damage/second for 3 seconds |
| Ice | Freezes movement and contact attacks for 2.2 seconds |
| Water | Pushes a surviving enemy one surface step away, followed by a short stun |
| Nature | Roots movement for 3 seconds; contact remains dangerous |
| Lightning | Deals one damage to up to two other emerged enemies within two surface steps |

Enemies have split carapaces, emissive eye slits, mandibles and six articulated
legs that follow their surface heading. Dashers have narrow bodies and swept
fins; they crouch and project a forward warning before lunging. Armored crawlers
carry three overlapping plates that disappear with damage. Frost cages, root
rings, impact flashes, shot colors and chain arcs show elemental effects.
All scene markers and lightning paths respect the cube surface and depth testing.

## Score and results

Base scores are 100/150/300 for crawler/dasher/armor. Kills within five seconds
build a multiplier up to ×5; contact damage breaks it. The HUD shows wave, shield,
score, active infusion and enemy count when no infusion is active. Results show
waves cleared, shots hit/fired and best combo. A chain hit counts as **one** shot
hit even when it defeats multiple enemies. Prototype score is local to the run;
it grants no permanent XP, mission rewards or currency.

Retry resets waves, held input, effects, score, inventory and ammo. Normal WORM
and the guided demo keep their own rules. The arena suppresses bombs, layer-turn
hazards, additional portals and normal special/elemental offerings. The opening
scramble still plays. Transporting enemies through live rotating layers remains
outside this prototype; unexpected live rotations defensively hold combat.

## Implementation and verification

`portalCombat.js` advances a clamped simulation with bounded pools. `combatDefs.js`
owns wave composition, enemy stats and infusion definitions. Surface routing uses
the production `getNextSurfacePosition` for enemies and lightning. The renderer
interpolates enemies through outside corners; straight shots use small collision
substeps and never enter the cube. Fixed pools support four enemies,
eight shots, six drops, eight impact effects and six lightning arcs. HUD readouts
sample a shared bridge rather than publishing frame-by-frame positions to Zustand.

Tests cover all 150 tiles, outside-corner interpolation, forward aiming in all
24 face/heading combinations, cone limits, fixed trajectories, corner chaining, actual
three-wave completion, enemy behaviors, all elemental effects, bounded lightning
range, combos, intermissions, held fire, pause/retry and real tunnel healing.
