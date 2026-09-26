# Demo mechanics audit — September 26, 2026

The core tour, optional Explore tour, and every WORM practice lesson were checked against the current game paths. WORM now has **17 lessons**. The dedicated double-jump lesson is removed; this does not change the live game's jump controls or Story objectives.

## Shared mechanisms

WORM practice now uses the same raised cubies, energy pads, two-second platform formation, Möbius bands, jump aim, landing height, camera target, tunnel anchors, exit route, and body-collision jump rescue as live runs. Walking underneath a flipped tile does not enter its tunnel. Pause and reduced-motion behavior remain shared with live play. The tunnel HUD describes jump entry in practice too.

Tunnel exercises start within the production two-tile jump aim window. Their target marker follows the platform's live formation and disappears when the task is complete. Ring markers remain on the crawlable floor. Healing inventory uses the production orb-growth constant and current face colors.

## WORM curriculum

| Lesson | Mechanism / completion checked |
| --- | --- |
| Steering | Real turn input; practice continues after success. |
| Orbs | Production pickups; two orbs give six charges. |
| Jump | One surface jump must land. No double-jump task. |
| Boost | Actual timed burst must finish. |
| Tunnel | JUMP captures the raised platform; completion waits for the tail to exit. No charges means the pair stays open. |
| Healing | Same jump route; four matching charges seal both ends after tail clearance, leaving two. |
| Surround | All eight floor tiles must be covered by the current body; normal ring healing flips the pair home. |
| Rocket | Actual pickup and steerable flight; wait for landing. |
| Magnet | Actual pickup and nearby-orb collection through live two-tile reach. |
| Water | Live straight-line momentum must build, with the ordinary turning penalty. |
| Fire | Live fire patches must exist. Copy describes route firebreaks and accelerated bomb fuses. |
| Nature | Land to grow a spring, then launch from it. These are two separate grounded jumps. |
| Ice | Jump out of the grounded turn delay. |
| Lightning | Actual elemental pickup and storm effect. |
| Signature | Glow Worm's Light Trail must paint at least two tiles behind the tail; pressing the button alone cannot finish. |
| Bomb | Authored bomb uses the live fuse and full-body disarm ring; no real currency reward. |
| Rotation | Live warning clock and slice rotation; completion waits for the rotation commit. |

## Cube and Explore tour

| Stage | Current path |
| --- | --- |
| First Twist | Shared animated rotation and puzzle completion. |
| Meet the Twins | Normal paired flip handler and raised cube presentation. |
| Through the Middle | Normal nine-pair flip/return task and tunnel renderer. |
| Learn to Solve | Existing Kociemba-backed Teach pipeline. |
| Your Controls | Current navigation buttons/sheets and measured targets. |
| Every Look | Current view settings and renderers. |
| Settings | Real settings panel with borrowed demo settings restored on exit. |
| Call the Winner | Current Chaos round/prediction flow. |
| Surprise Cube | Current Random mode. |
| Spend Your Points | Real store route. |

The cube and Explore mechanisms already used current handlers; no replacement implementations were needed.

## Deliberate practice scaffolding

Lessons retain authored targets, supplied ring length/healing charges, isolated hazards, and explicit Try it / Retry / Next controls. Random tunnel/pickup spawns and ambient combat remain suppressed so they cannot interrupt the exercise. Practice awards no run XP or coins. Goal completion does not pause the worm or automatically skip the lesson.

Regression coverage exercises the crawler, HUD controls, renderer formation/markers, energy pads, bands, camera aim, hazard scheduler, and existing cube-demo progression/settings/mobile layout tests. Browser checks cover the raised tunnel and healing routes using the visible JUMP button in a mobile viewport.
