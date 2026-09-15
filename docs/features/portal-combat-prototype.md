# Portal enemies and Combat arena

## Normal WORM: occasional encounters

Portal enemies are enabled in normal WORM, including Mega. The guided demo stays
separate. The first encounter cannot begin before **45 seconds of active surface
play**, and every encounter is followed by **at least 30 quiet seconds**. There
is a hard limit of **one enemy**, regardless of cube size or how many portals are
open. A live portal must be on the current face, two to six tiles from the head.

The mouth warns for four seconds, then the enemy emerges. Approaching the mouth
or leaving its face during the warning cancels the spawn. The first encounters
use crawlers; dashers become eligible after 90 active seconds and occasional
armored crawlers after 150. An enemy retreats after 20 active seconds. Pauses,
tunnel travel, rockets and focus animations hold the encounter clocks.

Encounters wait for existing bombs and rotation warnings to clear. While one is
active, scheduled bombs and layer turns wait, so the hazards do not pile up.
Manual live or committed rotations retire the enemy and start the quiet period.
The final-healing phase has no enemies. Sealing the source portal also ends the
encounter, without ending the normal run; MOBI's temporary lock blocks it too.

Normal runs start with three enemy shields. A contact removes one shield and the
enemy retreats immediately; jumping avoids contact. Losing the last shield ends
the run with a dedicated explanation. Healing a tunnel restores one shield, up
to three. The existing self-collision, bomb and tunnel rules still apply.

Fire appears beside the character ability only during an encounter. Jump, boost,
missions and normal XP stay available. The same elemental pickups used by normal
WORM infuse shots while their buff lasts. Enemies do not create an extra pickup
stream or award additional permanent currency/XP. Shield changes have a brief
message in the existing action dock. Retry resets the encounter and grace period.

## Optional three-wave arena

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

Aiming and new shots pause throughout cube-edge crossings, until the visible head
reaches the destination face. The reticle disappears and Fire reads **Turning**;
held fire resumes on arrival, while released/tapped requests do not queue shots.
Enemies, encounter timers and already-fired shots continue normally.

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

Retry resets waves, held input, effects, score, inventory and ammo. Normal WORM uses the sparse director above; the guided demo keeps its own rules. The arena suppresses bombs, layer-turn
hazards, additional portals and normal special/elemental offerings. The opening
scramble still plays. Transporting enemies through live rotating layers remains
outside the arena prototype; unexpected live rotations defensively hold arena combat.
Normal encounters instead retreat when a rotation starts or commits.

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

`ambientCombat.js` owns the sparse director. Integration tests exercise the real
normal-WORM hook, gun input, mission/XP preservation, portal closure and demo
exclusion. A ten-minute director simulation checks the one-enemy cap and minimum
quiet time. Additional cases cover hazard deferral, shield repair/contact, expiry,
MOBI locks, elemental shots and live/committed rotation cancellation.
