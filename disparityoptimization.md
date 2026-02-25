WORM³ — Disparity Mode
Optimization Opportunities
16 improvements across spectacle, pacing, information design, and replayability

Design North Star
Disparity Mode is a spectator sport. The player is an audience, not a strategist. Every optimization should serve one of three things: make the carnage more legible (so you can track individuals), make the carnage more dramatic (so moments feel consequential), or make the result more satisfying (so the winner feels earned). Optimizations that just add information noise or complexity in the wrong direction should be skipped.

Tier 1 — High Impact, Directly Implement
These should be done regardless of everything else. Each one has a clear, isolated implementation path.
1.1  Per-Tile Health Bar (Flip Pressure Visualization)
SPECTACLE + LEGIBILITY  —  Makes every tile feel alive and about to die
Right now there is no way to tell which tiles are close to dying. The carnage is invisible until tiles suddenly go dark. Adding a per-tile flip pressure indicator transforms the cube into a living scoreboard where you can root for or against specific tiles in real time.
What to Build
•	Each tile gets a thin colored arc or fill bar that grows from 0 to FLIP_CAP
•	Color shifts: green (0–33% of cap) → yellow → orange → red → flashing red when at 90%+
•	When a tile hits FLIP_CAP, the bar should flash white then disappear (not just vanish instantly)
Implementation Path
In StickerPlane.jsx (or wherever sticker geometry is rendered), read sticker.flips and FLIP_CAP from props and render an overlay bar. The bar should be a thin strip at the bottom edge of the sticker face using a PlaneGeometry at a slight z-offset (+0.001) so it sits above the sticker surface without z-fighting.

// Approximate approach inside StickerPlane / StickerMesh
const pct = Math.min(sticker.flips / FLIP_CAP, 1);
const barColor = pct < 0.33 ? "#22c55e" : pct < 0.66 ? "#f97316" : "#ef4444";
const isFlashing = pct > 0.9;
 
// Render a thin plane geometry at bottom of sticker
// width: pct * stickerSize, height: 0.04
// position: centered at bottom edge, z += 0.001

Keep it subtle — 4px equivalent height. It should read as urgency, not UI clutter.

1.2  "Last 10" Ticker — Live Death Feed
LEGIBILITY + DRAMA  —  Gives the spectator a running commentary
When a tile dies, it disappears from the cube but there is no persistent record of what just happened. A live ticker in the HUD showing the last 5–10 deaths gives the viewer a sense of momentum — whether deaths are accelerating, which face is being annihilated, whether the last survivors are clustered.
What to Build
•	A vertical scroll-list in the DisparityHUD showing the last 10 deaths, newest at top
•	Each entry: colored face swatch + grid ID + a death-cause icon (hit cap / chain kill)
•	New entries slide in from the top with a brief flash; old entries fade out at the bottom
•	Optional: show time-since-death in seconds so you can see if deaths are accelerating
Data Source
Already stored in disparityDeaths in the store. Subscribe to length changes in DisparityHUD and render the last 10 in reverse order. The slide animation can be done with a CSS @keyframes slide-in-top + animation-fill-mode: both.

1.3  Slow-Motion Final 5
DRAMA + PACING  —  The endgame needs weight
The final few tiles dying should feel momentous, not identical to the first few. When aliveCount drops below 5 (configurable), the chaos tick interval should slow down — not stop, but visibly decelerate. This creates a natural "final countdown" feel where you can actually watch each remaining death happen.
Implementation
In useChaosMode.js, the RAF loop controls tick speed. Add a multiplier based on alive count:

const aliveCount = totalTiles - deadTileSet.size;
 
// Slow-mo multiplier: 1.0 normal → 0.25x at final 5
const slowMoFactor = aliveCount <= 5
  ? Math.max(0.25, aliveCount / 10)
  : 1.0;
 
// Use this to throttle how many chain steps fire per RAF frame
const stepsThisFrame = Math.floor(baseStepsPerFrame * slowMoFactor);

Pair this with a visual cue: when aliveCount drops below 5, the cube border in the HUD could pulse slow and red, matching the new pace.

1.4  Death Animation — Tiles Shatter or Implode
SPECTACLE  —  The most visible gap in the current experience
Right now when a tile dies it simply disappears or goes grey. This is the single biggest spectacle miss in the mode. A tile reaching FLIP_CAP is the climactic event — it should look like something.
Option A — Scale Implosion (Easiest)
•	On death, animate scale from 1.0 → 0 over 400ms with a slight overshoot (scale to 1.1 first, then collapse)
•	Add a brief bright flash of the face color at peak (emissive intensity spike)
•	Leave a faint ghost plane at opacity 0.1 for 1 second so you can still see where it was
Option B — Shatter (More Complex, More Dramatic)
•	On death, spawn 6–8 small square fragments flying outward in the tile's face normal direction
•	Fragments fade over 800ms using opacity animation
•	Can be done by spawning temporary Three.js meshes and animating them in a useFrame loop
Recommended Approach
Start with Option A (scale implosion). It is 30 lines of code using useSpring or a simple manual animation ref. Option B is more dramatic but requires a temporary mesh pool and is significantly more code.

// In StickerMesh, add death animation state
const [dying, setDying] = useState(false);
const deathProgress = useRef(0);
 
useEffect(() => {
  if (sticker.flips >= FLIP_CAP && !dying) {
    setDying(true);
    // Animate deathProgress 0→1 over 400ms
  }
}, [sticker.flips]);
 
// In useFrame: lerp mesh.scale based on deathProgress
// Flash emissive to face color at deathProgress ~0.3


Tier 2 — Medium Impact, High Payoff
These require more thought or more code, but each one meaningfully changes how the mode feels to watch.
2.1  Face Elimination Events
DRAMA + INFORMATION  —  Creates natural narrative chapters
When the last tile of a face dies (e.g., every red tile is dead), that is a major event — an entire manifold face has been eliminated. This should be called out explicitly with a brief HUD announcement: "RED FACE ELIMINATED" with the face color flashing across the screen edge for 2 seconds.
Implementation
Track a faceAliveMap: Map<faceNum, count> in useChaosMode.js. Decrement on each death. When a face count reaches 0, call store.addDisparityEvent({ type: "face_eliminated", face: faceNum }). DisparityHUD subscribes to this event queue and shows the banner.
•	This also retroactively makes the death log more useful — you can mark which deaths completed a face elimination
•	The winner reveal can say "Sole survivor of the Blue Face" if all other blue tiles died
2.2  Chaos Wave Visualization
SPECTACLE  —  Makes the propagation mechanic legible as a spectator
The chain propagation is the core mechanic of Disparity Mode but it is currently invisible — you just see tiles dying. Adding a brief colored ripple that travels from the source tile to its propagation targets would make the chaos feel like a living thing spreading across the cube.
What It Looks Like
•	When tile A causes tile B to flip, a thin colored arc briefly connects A→B
•	Arc uses the source tile's face color, fades over 300ms
•	At high chaos levels, multiple simultaneous arcs create a web of infection
Implementation Approach
In stepSingleChain, return the (source tile position, target tile position) pair alongside newlyDead. These positions go into a propagationArcs array in the store. In the 3D scene, a thin TubeGeometry or Line component renders each arc and auto-removes it after 300ms.
This is moderately complex because it requires threading world-space positions from the chain logic up to the 3D renderer, but the visual payoff is very high.
2.3  Antipodal Co-death Highlight
TOPOLOGICAL IDENTITY  —  Reinforces the game's core concept visually
When a tile dies, its antipodal partner on the opposite face is fated to die next — they share the same manifold identity in opposite form. Briefly highlighting this link when a death occurs reinforces the non-orientable topology at the heart of the game.
What It Looks Like
•	When tile M2-007 dies, tile M5-007 briefly flashes with a white outline and a connection line through the cube center
•	A small label appears: "ANTIPODAL PARTNER" with a countdown showing how many flips M5-007 has left
•	If M5-007 is already dead, instead show: "PAIR COMPLETED" with both IDs listed
Why This Works for Disparity Mode
Disparity Mode is implicitly about the topology — tiles are dying because of the non-orientable manifold structure. Making antipodal deaths visually connected teaches the player why the game works, without them needing to read documentation. It also creates natural "drama pairs" — two tiles to watch simultaneously.
2.4  Configurable FLIP_CAP in the Setup Wizard
REPLAYABILITY  —  Changes the game's entire feel with one number
FLIP_CAP is currently hardcoded. It is the single most impactful tuning parameter in the mode — lower values mean faster, more violent carnage; higher values mean slow attrition with late-game acceleration. Exposing it in the DisparitySetupWizard with 3–4 presets and a custom slider changes how the mode can be experienced:

Preset	FLIP_CAP	Character
Fragile	3	Rapid massacre. Few tiles last more than seconds. Great for demoing the concept.
Standard	6	The current default. Balanced carnage with a clear late-game.
Endurance	12	Slow attrition. Long early game, dramatic collapse at the end.
Titan	20	Epic mode. Feels like a war of attrition. Use with 5×5 only.

Implementation: add flipCap to the disparity config object passed through DisparitySetupWizard → useGameStore → useChaosMode. The constant FLIP_CAP becomes config.flipCap ?? 6.

Tier 3 — Stretch Goals (High Payoff, High Effort)
These are substantial features that change what kind of game Disparity Mode is. Worth planning even if not immediately implemented.
3.1  Survivor Betting / Prediction Mode
ENGAGEMENT  —  Turns spectating into a game
Before the mode starts, ask the viewer to pick which tile they think will survive. Lock in the prediction, then play Disparity Mode normally. At the winner reveal, animate a special "YOUR PICK SURVIVED" or "YOU WERE WRONG — almost!" result showing how close your predicted tile got (how many flips it had when it died).
Why This Works
Right now there is nothing to do during Disparity Mode except watch. Adding a stake — even a simple prediction — gives the viewer something to root for and creates personal investment in specific tiles. It is the difference between watching a horse race and watching a horse race you bet on.
Implementation Scope
•	DisparitySetupWizard: add a "Pick Your Survivor" step showing all tile IDs with their face color
•	Store: add disparityPrediction field
•	useChaosMode: track predicted tile's death tick if it dies
•	DisparityWinnerScreen: add "YOUR PREDICTION" summary section above the death log
3.2  Replay Mode / Scrubber
REPLAYABILITY  —  Makes every run reviewable
Record the full sequence of (tile, flipCount, timestamp) events during a Disparity run. After the winner reveal, show a "Replay" button that replays the exact sequence at 4× speed with the death visualizations. This lets you watch a 3-minute match in 45 seconds and see exactly how the carnage unfolded.
Data Requirements
Each chain step already knows which tile it is affecting. Store a compact event log: Array<{ gridId, flipCount, t: number }>. A 3×3 3-minute match at normal chaos speed produces maybe 2000–5000 events, which is ~50KB — totally fine to hold in memory.
•	On replay, feed events back into the renderer in timestamp order using a RAF loop
•	A progress scrubber bar lets you skip to any point in the match
•	Optional: highlight the eventual winner throughout the replay with a crown marker
3.3  Multi-Run Statistics Dashboard
META-GAME  —  Creates long-term interest
Track statistics across multiple Disparity runs using persistent storage. Show which faces win most often, average survival time by face, which tiles are historically "tough" vs fragile. After 10+ runs you start to see patterns in the manifold topology — some positions tend to survive longer than others due to their propagation neighbor structure.
Stats Worth Tracking
•	Win rate by face color (1–6)
•	Win rate by grid position within face (center tiles vs edge tiles vs corner tiles)
•	Average flips at death by face
•	Fastest run (time from start to last survivor) vs slowest
•	Most common "final 2" pairings — which two tiles tend to outlast everyone else together
Use window.storage.set() (Anthropic persistent storage API) to store a compact JSON stats object. Show it in a "Records" tab in the Disparity setup wizard.

Tier 4 — Small Wins, Quick Shipping
Each of these can be done in under an hour and directly improves the existing experience without architectural changes.
4.1  Countdown Before Start
Add a 3-2-1-GO countdown animation before chaos begins. Right now it just starts. A countdown creates anticipation and tells the viewer when to start watching.
4.2  HUD: Show Alive Count Prominently
The HUD should have a large 54 ALIVE counter that counts down to 0 as tiles die. This is the single most important number in spectator mode — how many tiles are left. Currently the viewer has to infer this from the death log.
4.3  Sound Design Hooks
Add empty sound hook calls at key moments: tile death, face elimination, final 5, winner. Even with no audio assets yet, having the hooks wired means adding sounds later is a 10-minute job. Suggest: low thud for tile death, rising chime for face elimination, silence + single tone for winner.
4.4  Speed Control in the HUD
Add a 0.5× / 1× / 2× / 4× speed multiplier button in the live HUD (not just setup). Lets the viewer slow down to watch dramatic moments or speed up boring early-game. Implemented by multiplying the RAF step interval.
4.5  Color the Dead Zone
When a tile dies, instead of disappearing or going grey, it should take on a specific dead color — dark charcoal with a subtle desaturated version of its original face color bleeding through. This distinguishes "never-flipped alive" tiles from "dead" tiles more clearly than just removing them.
4.6  Winner Screen: Show Cube Position
The winner screen currently shows the grid ID (M3-007). Also show a visual indicator of where that tile is on the cube — a small isometric cube diagram with the winning tile highlighted. This makes the abstract ID feel like a real location.

Recommended Implementation Order
If implementing these sequentially, this order maximizes visible improvement per unit of effort:
1.	4.2 — Alive count in HUD  (20 min, biggest legibility win)
2.	1.4 — Death animation (implosion)  (1–2 hrs, biggest spectacle win)
3.	1.2 — Live death ticker in HUD  (1 hr, data already exists)
4.	1.3 — Slow-motion final 5  (30 min, pure pacing)
5.	4.1 — Countdown before start  (30 min, anticipation)
6.	2.4 — Configurable FLIP_CAP  (2 hrs, high replayability)
7.	2.1 — Face elimination events  (2–3 hrs, strong narrative)
8.	1.1 — Per-tile health bars  (2–3 hrs, strong spectacle)
9.	2.3 — Antipodal co-death highlight  (2 hrs, topological storytelling)
10.	3.1 — Prediction mode  (4–6 hrs, engagement shift)
11.	2.2 — Chaos wave arcs  (4–6 hrs, most complex visual)

WORM³ / Disparity Mode Optimizations  •  February 2026
