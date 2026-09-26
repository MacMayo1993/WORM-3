# Temporary cube-view power-ups

WORM can collect nine cube-view orbs: Classic, Grid, Sudoku, Wireframe, Glass,
Chrome, Neon, Gap, and LEGO. Each uses the existing whole-cube renderer and the
elemental orb presentation and claim burst.

- Effects last 20 seconds of crawling. Pause, tunnel transit, and pickup reveals
  hold the timer. Another view replaces or refreshes it rather than stacking time.
- Temporary rendering overrides leave the selected visual mode, random view,
  mirror, hollow, and tile settings intact. Expiry, death, retry, and mode exit
  remove the override. Elemental gameplay effects can coexist with a cube view.
- The HUD names the active view and shows its simulation-driven countdown.
- Free play uses four ambient bag slots: Explode, Rocket, Magnet, and one view.
  Views have a separate shuffled bag so every view appears before repetition.
  The existing board cap, spawn interval, and first Explode offering remain.
- Story levels 9 onward can offer one optional view after their required powers
  have been served. Required objective pickups always have priority.
- View orbs require centered contact; a magnet cannot collect one remotely.

## Reveal camera

Both elemental and view pickups use the same protected four-second reveal:
18% pullback, 64% full 360-degree orbit, 18% return. The circle finishes before
zooming back in. The captured position, orientation, up vector, and FOV return
before chase control resumes.

The pullback fits the cube's bounding sphere to the tighter horizontal/vertical
field of view, with expansion and margin included. It also pulls out by at least
35% of the captured radius. Reduced motion keeps the pullback without the spin.
Mega's shared chassis receives temporary materials without restoring thousands
of individual body meshes; Gap hides that backing to keep the gaps open.

## Verification

- Simulation: every view, timer holds, expiry, replacement/reset, centered pickup,
  and balanced spawning.
- Camera: six starting faces, exact return, and projected cube corners throughout
  the orbit for 2/7/10/15 cubes, portrait/square/landscape, and expanded geometry.
- Render/HUD: glass opacity, LEGO studs, whole-corner neon, saved view restoration,
  mode isolation, countdown, expiry, and Story objective priority.
- Full Vitest suite, ESLint, production build, and bundle budget checks.
