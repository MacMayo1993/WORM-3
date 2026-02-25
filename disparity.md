WORM³ — Disparity Mode
Implementation Brief for Claude Code
Bug Fixes + Winner Celebration Screen

Overview
This document describes three changes to make to the WORM³ codebase to fix two bugs and add a cinematic winner celebration screen for Disparity Mode.
Disparity Mode is a spectator-sport game mode where all tiles flip chaotically. Each tile has a FLIP_CAP; once hit, the tile "dies." The last tile to never flip (or flip least) wins.
Three deliverables:
•	BUG FIX: Tile deaths report the ID of where they died (position), not which tile died (identity)
•	BUG FIX: The winner is never announced — mode just ends silently
•	NEW FEATURE: Full cinematic winner celebration screen (DisparityWinnerScreen.jsx)

Bug 1 — Tile Death ID Is Positional, Not Identity-Based
What the Bug Is
When a tile dies (hits FLIP_CAP), the death log records its manifold grid ID (e.g. "M3-007"). This ID is computed by getManifoldGridId(sticker, size). The bug is that this function produces the wrong ID for some faces, making it look like a different tile died.
The correct ID is based on where the tile STARTED (its origPos and origDir), not where it is now. The formula for computing row/column on the 2D manifold face from 3D coordinates differs per face direction (PZ, NZ, PX, NX, PY, NY), and the previous implementation had wrong formulas for NZ, PX, and NY faces.
Root Cause
The function getManifoldGridId(sticker, size) in src/game/coordinates.js computes a (row, col) from origPos, then builds the ID string. The (r, c) formula must exactly match the faceRCFor() function used throughout the rest of the codebase (in solveDetection.js, tilingGraph.js, etc). The NZ, PX, and NY cases were mismatched.
The Fix — src/game/coordinates.js
Replace the entire getManifoldGridId function with the corrected version below. The key change is the switch statement for each origDir case:
export function getManifoldGridId(sticker, size) {
  const { x, y, z } = sticker.origPos;   // permanent identity coords
  const dir = sticker.origDir;             // permanent identity direction
  const faceNum = sticker.orig;            // permanent face number (1–6)

  const s = size - 1;
  let r, c;

  switch (dir) {
    case "PZ": r = s - y; c = x;     break;   // unchanged
    case "NZ": r = s - y; c = s - x; break;   // FIXED: was c = x
    case "PX": r = s - y; c = s - z; break;   // FIXED: was c = z
    case "NX": r = s - y; c = z;     break;   // unchanged
    case "PY": r = z;     c = x;     break;   // unchanged
    case "NY": r = s - z; c = x;     break;   // FIXED: was r = z
    default:   r = 0;     c = 0;
  }

  const idx = r * size + c + 1;           // 1-based index
  const idStr = String(idx).padStart(3, "0");
  return `M${faceNum}-${idStr}`;
}
Verify this matches faceRCFor() in solveDetection.js and tilingGraph.js — those three should be in perfect agreement. If your codebase has a different reference formula, match that instead of the above.

Bug 2 — Death Capture Timing
What the Bug Is
In src/hooks/useChaosMode.js, the death detection loop scans the full state AFTER stepSingleChain() has already been called. This creates a race condition: the sticker object read from state may have been partially mutated, or the wrong sticker gets captured because the state index [x][y][z] was already updated.
The Fix — src/hooks/useChaosMode.js
Move death detection INSIDE stepSingleChain so deaths are captured at the exact moment of the flip, before any chain reassignment. stepSingleChain should return both the new state and any newly-dead stickers it caused:
// MODIFIED: stepSingleChain now returns { next, newlyDead }
const stepSingleChain = (state, chain, deadTileSet, manifoldMap, S) => {
  // ... existing flip logic ...
  const next = flipStickerPair(...);

  const newlyDead = [];
  const { x: fx, y: fy, z: fz, dirKey: fdk } = chain.tile;
  const flipKey = `${fx},${fy},${fz},${fdk}`;
  const flippedSt = next[fx]?.[fy]?.[fz]?.stickers?.[fdk];

  if (flippedSt && (flippedSt.flips || 0) >= FLIP_CAP && !deadTileSet.has(flipKey)) {
    deadTileSet.add(flipKey);
    newlyDead.push(flippedSt);
  }

  // Also check the antipodal partner
  const antiLoc = findAntipodalStickerByGrid(manifoldMap, flippedSt, S);
  if (antiLoc) {
    const antiKey = `${antiLoc.x},${antiLoc.y},${antiLoc.z},${antiLoc.dirKey}`;
    const antiSt = next[antiLoc.x]?.[antiLoc.y]?.[antiLoc.z]?.stickers?.[antiLoc.dirKey];
    if (antiSt && (antiSt.flips || 0) >= FLIP_CAP && !deadTileSet.has(antiKey)) {
      deadTileSet.add(antiKey);
      newlyDead.push(antiSt);
    }
  }

  return { next, newlyDead };
};

// In the RAF loop body, replace death scanning with:
const { next: newState, newlyDead } = stepSingleChain(state, chain, deadTileSet, manifoldMap, S);
if (newState !== state) {
  state = newState;
  changed = true;
  for (const st of newlyDead) allNewDeaths.push(st);
}

Bug 3 — Winner Is Never Announced
What the Bug Is
When the last tile wins, useChaosMode calls setDisparityWinner() on the store, then immediately calls setChaosLevel(0) which tears down the mode. No UI is shown to celebrate or even identify the winner. The win is completely silent and anticlimactic.
The Fix — Three Files
Step A: src/hooks/useGameStore.js
Add a showDisparityWinner flag to the store so App.jsx can independently control when the celebration screen appears:
// Add to store state:
showDisparityWinner: false,

// Add to store actions:
setShowDisparityWinner: (v) => set({ showDisparityWinner: v }),

// Also add clearDisparityGame action that resets everything:
clearDisparityGame: () => set({
  disparityWinner: null,
  disparityDeaths: [],
  showDisparityWinner: false,
}),
Step B: src/hooks/useChaosMode.js — Winner Announcement
When the winner is detected, set the flag BEFORE tearing down chaos level so the screen has time to appear:
// When last survivor is found:
useGameStore.getState().setDisparityWinner({ gridId: getManifoldGridId(neverFlippedSt, S) });
useGameStore.getState().setShowDisparityWinner(true);  // ← ADD THIS
// Do NOT call setChaosLevel(0) here — let the winner screen call it on dismiss
Step C: src/App.jsx — Wire in DisparityWinnerScreen
import DisparityWinnerScreen from './components/screens/DisparityWinnerScreen.jsx';

// In store subscriptions:
const showDisparityWinner = useGameStore((s) => s.showDisparityWinner);
const setShowDisparityWinner = useGameStore((s) => s.setShowDisparityWinner);

// In JSX (after DisparityHUD, before closing wrapper div):
{showDisparityWinner && (
  <DisparityWinnerScreen
    onDismiss={() => {
      setShowDisparityWinner(false);
      useGameStore.getState().setChaosLevel(0);
    }}
  />
)}

New File — DisparityWinnerScreen.jsx
Drop Location
src/components/screens/DisparityWinnerScreen.jsx
What It Does
A full-screen cinematic overlay that plays through 4 phases automatically:
•	intro (0–400ms): Background fades in, scanline begins
•	reveal (400ms–1.2s): Winner tile ID appears huge with glitch flicker effect, ring pulses expand
•	celebrate (1.2–2.4s): Particle burst fires, crown drops in
•	done (2.4s+): Tagline and death log appear, Play Again button becomes clickable
Visual Design
•	Dark background with winner face color bleeding in as ambient light (radial gradient)
•	Scanline sweep animation using the winner color at low opacity
•	Three expanding ring pulses centered on screen
•	60 confetti particles in winner color, white, gold — burst outward on celebrate phase
•	Winner tile ID displayed at ~100px with text-shadow glow and glitch filter during reveal
•	Tagline: "Survived N observations. Never flipped."
•	Death log in reverse-elimination order (runner-up first, earliest death last)
•	Each death row shows: rank, color swatch, grid ID (e.g. M3-007)
•	Winner row at top highlighted with face color background tint
Props
// onDismiss: () => void
// Called when user clicks "Play Again"
// Should: setShowDisparityWinner(false), setChaosLevel(0)
Store Dependencies
The component reads from useGameStore:
•	disparityWinner — { gridId: "M3-007" } — the winning tile
•	disparityDeaths — array of { gridId, rank, id } — all dead tiles in death order
•	clearDisparityGame() — resets winner/deaths/flag on dismiss
Death Log Data Shape
Each entry in disparityDeaths should have:
{ 
  id: string,       // unique key for React
  gridId: string,   // e.g. "M2-014"
  rank: number,     // 1 = first to die, N = last to die before winner
}
If disparityDeaths does not currently track rank, add a counter in useChaosMode.js when pushing to addDisparityDeath.

Verification Checklist
After applying all changes, confirm:
1.	Run Disparity Mode and let it play. Open the console — each "tile died" log should show the tile's original manifold ID, not the position where it happened to be when it died.
2.	Verify NZ/PX/NY faces specifically — rotate the cube 90° and start disparity. Deaths on those faces should report the same ID as before the rotation.
3.	Let the mode run to completion. The DisparityWinnerScreen should appear automatically.
4.	The winner's tile ID in the header should match the tile that never flipped (cross-reference with the death log — it should not appear there).
5.	Death log should be in reverse elimination order (most recent death first).
6.	Clicking Play Again should dismiss the screen and reset chaos level to 0.
7.	faceRCFor() in solveDetection.js and the new getManifoldGridId() produce identical (r,c) for all 6 faces at every size (3×3, 4×4, 5×5).

Appendix — faceRCFor Reference
The canonical (r, c) formula for each face direction. This is the ground truth — getManifoldGridId must match this exactly:
PZ: r = (size-1) - y,  c = x
NZ: r = (size-1) - y,  c = (size-1) - x
PX: r = (size-1) - y,  c = (size-1) - z
NX: r = (size-1) - y,  c = z
PY: r = z,             c = x
NY: r = (size-1) - z,  c = x
If your faceRCFor implementation differs, match that instead — the goal is that getManifoldGridId, faceRCFor, and any grid-ID-based antipodal lookup all agree on where each sticker lives.
