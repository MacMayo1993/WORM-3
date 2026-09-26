# Guided WORM practice

The WORM chapter now contains 18 independent exercises. It no longer finishes
when the first tunnel is entered or exited. Players can start, retry, skip an
exercise, or end practice. Each fresh board waits for **Try it**; completed
exercises pause until **Next**. Retrying preserves earlier completion records.

| Exercise | Completion evidence |
| --- | --- |
| Steering | Simulation accepts a direction change |
| Orbs | Two real pickups (six healing charges) |
| Jump | Takeoff and landing |
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
| Signature | Real Glow Worm Beacon activation |
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
