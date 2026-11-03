# Playable demo

The opening-screen **DEMO** now opens directly on the live WORM cube. It starts paused on a combined collect → jump → Core traversal → healing mission, instead of two blocking introductions followed by 23 mandatory exercises.

## Main route

The 13 curated scenes use the live simulation: earn and spend healing charges, clear a body crossing, surround a hole, fly with Rocket, traverse the expanded cube, flame-dash, perform Slipstream, fly with Air, fight a crawler, use elemental shots against armor, disarm a bomb, survive a real layer turn, and paint Light Trail.

Next unlocks only after the scene's measured outcome. Retry restages it. Skipping and choosing another scene never fabricate completion. After the WORM highlights, the existing Flip Cube, solver, controls, views, settings, Chaos round, Random puzzle and store stages remain intact.

## Optional scene catalog

The native scene selector offers the curated route and grouped labs:

- All original movement, rescue, healing and hazard exercises.
- Every canonical special pickup, including persistent Trampoline, full Explode expansion/settling, Orb Shower and nine timed view pickups.
- All 30 ordered element recipes, with real pickups and reaction-specific objectives. Reversing pickup order chooses a different recipe.
- All seven character abilities, including mixed-color Prism healing, Book's live clock hold/resume, Mobi's self-created tunnel, actual Glow body protection, and pickup-producing sweeps/slams.
- All six shot elements against each of the three enemy types, using live projectiles, aiming, health, shields, recharge and drops.
- Third-use tunnel collapse (the briefing discloses two prior rides) and a long-tail crossing inside the Core (the briefing discloses the pre-grown tail).

These are staged encounters, not a simulated campaign save. They do not claim campaign progression, award story stars, or prove every possible interaction between simultaneous powers, enemies and hazards. Fusion scenes certify their stated reaction, not every secondary enemy/bomb consequence in a recipe's description.

## Safety and lifecycle

Scene selection pauses play; dismissing the picker without selecting resumes the previous state. Choosing a scene stages a fresh paused attempt. Retry, skip and scene changes clear combat, storm, expansion, elemental and tunnel state through their normal reset paths. Original player character/skin and demo-controlled settings retain the existing exit restoration behavior. The separate three short challenges remain separate.

The card uses the existing measured HUD clearance, native keyboard/touch selection, visible focus, large action targets, and a bounded scroll area for long recipe explanations. No new render loop or postprocessing pass is introduced.

## Verification

- `demoShowcaseFlow.test.jsx` runs every curated scene in sequence with real crawler physics, real hazard scheduling, real layer commit and real Next actions. Only rendering/audio are mocked.
- `demoPracticeMechanics.test.js`, `wormDemoPractice.test.jsx`, `demoSignatureFlow.test.jsx`, `demoSignatures.test.js`, combat and hazard tests check actual effects and retry/pause cleanup.
- `demoScenePicker.test.jsx` checks catalog coverage, picker pause/cancel, incomplete-state transitions and challenge isolation.
- `e2e/demoShowcase.e2e.js` provides desktop/mobile browser checks for opening DEMO, viewport bounds, mid-run scene changes and retry. In this executor Chromium could not initialize its Unix socket; the cloud browser could not reach the local server. Browser screenshots and actual device performance are therefore not verified here.
