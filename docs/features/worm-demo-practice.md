# Guided WORM practice

Demo starts with the WORM introduction and 19 required exercises, then continues
through First Twist, Meet the Twins, Through the Middle, Learn to Solve, Controls,
Views, Settings, Chaos, Random, and Store. There is one 11-section progress track.
Mode choices appear after the whole curriculum; players can exit the demo anytime.
Mobi’s opening and WORM briefing run before WORM initializes, on both first entry
and replay. The worm, practice HUD, and WORM loading gate start only after the
player finishes the briefing.

Each fresh board waits for **Try it**. Reaching the goal unlocks **Next** while
practice keeps running. Next stays available if the player dies after success.
Retry restages only the current exercise; unfinished exercises cannot be skipped,
and healing the first tunnel no longer offers an early finish.

| Exercise | Completion evidence |
| --- | --- |
| Steering | Simulation accepts a direction change |
| Orbs | Two real pickups (six healing charges) |
| Jump | Takeoff and landing |
| Jump over your body | Clear a staged, visible tail crossing and land alive; empty hops do not count |
| Double jump | Two presses in one flight, then landing; a hop that lands in between resets the count |
| Boost | Actual burst runs to its end |
| Tunnel | Exit and tail clearance, with no deposit |
| Heal | Matching charges deposited; both ends heal and tail clears |
| Surround | Current body covers the eight-cell ring; production ring heal fires |
| Rocket | Real pickup, flight and landing |
| Magnet | Real pickup attracts the staged neighboring orbs |
| Water | Pickup followed by straight-route momentum |
| Fire | Pickup followed by live fire patches |
| Nature | Pickup, landing pad, and a boosted spring jump |
| Ice | Jump while ice is active |
| Lightning | Four seconds of active storm after the claim focus |
| Signature | Real Glow Worm Light Trail activation |
| Bomb | Production bomb disarm from the body-covered ring |
| Rotation | A real warned layer rotation commits with the worm alive |

The board is staged on the front face of a 5×5 cube. Encirclement exercises
supply enough body length to cover the ring without requiring dozens of pickups.
The bomb exercise uses a generous 25-second practice fuse; ordinary runs retain
their five-second fuse. Scene markers use depth testing, so they do not appear
through the cube. Random wormholes and special offerings stay disabled during
practice; only the lesson's encounters are present. All five elements use their
normal simulation, shaders and lifetimes.

The practice card lives inside the HUD's measured bottom dock, alongside the
controls. It replaces the separate App-level instruction overlay. Signature,
inventory and rotation readouts appear when needed by their exercises. Tutorial
outcomes do not grant gameplay XP, mission rewards or repeatable healing/survival
currency. Existing one-time onboarding rewards stay under their original guard.

Implementation: `wormDemoState.js` owns the small store protocol;
`wormDemoLessons.js` holds lesson copy; `demoPractice.js` stages and checks the
real simulation through `useWormCrawler`. Hazard lessons use the existing
`HealerWormMode` bomb and rotation loops. The staged-ready flag prevents a Start
press from racing the next simulation frame's reset.

Retry and Next clear the HUD’s jump-rescue flag along with the simulation reset.
Previously, resetting during “Jump now” could leave steering and hazard clocks
held indefinitely. Tunnel progress distinguishes the ride from tail clearance;
Retry restores the pad and matching healing charges. Body-jump practice shares
Story’s authored trail and clearance observer, with enough tail to span the route.
