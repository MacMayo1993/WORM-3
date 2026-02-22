// src/game/handsInput.js
// Hands Mode: Speedcuber-style input mapping
//
// In Hands Mode the cube is held in a fixed "Home Grip" orientation:
//   Front (F) = PZ (Red)   Back (B) = NZ (Orange)
//   Right (R) = PX (Blue)  Left (L) = NX (Green)
//   Up (U)    = PY (White) Down (D)  = NY (Yellow)
//
// Standard notation moves are translated to the engine's {axis, dir, sliceIndex} format.

// ---------------------------------------------------------------------------
// Named-move → engine rotation translation
// ---------------------------------------------------------------------------

// For a 3×3 cube (size=3):
//   sliceIndex 0 = first layer, sliceIndex 2 = last layer, sliceIndex 1 = middle
//
// Axis mapping:
//   col  (X-axis): sliceIndex 0 = L face, sliceIndex 2 = R face
//   row  (Y-axis): sliceIndex 0 = D face, sliceIndex 2 = U face
//   depth(Z-axis): sliceIndex 0 = B face, sliceIndex 2 = F face

export function namedMoveToRotation(moveName, size) {
  const last = size - 1;
  const mid = Math.floor(size / 2); // Middle slice for M, E, S

  switch (moveName) {
    // --- Face moves ---
    case 'U':  return { axis: 'row',   dir: -1, sliceIndex: last };
    case "U'": return { axis: 'row',   dir:  1, sliceIndex: last };
    case 'U2': return null; // Handled as double move by caller

    case 'D':  return { axis: 'row',   dir:  1, sliceIndex: 0 };
    case "D'": return { axis: 'row',   dir: -1, sliceIndex: 0 };

    case 'R':  return { axis: 'col',   dir: -1, sliceIndex: last };
    case "R'": return { axis: 'col',   dir:  1, sliceIndex: last };

    case 'L':  return { axis: 'col',   dir:  1, sliceIndex: 0 };
    case "L'": return { axis: 'col',   dir: -1, sliceIndex: 0 };

    case 'F':  return { axis: 'depth', dir: -1, sliceIndex: last };
    case "F'": return { axis: 'depth', dir:  1, sliceIndex: last };

    case 'B':  return { axis: 'depth', dir:  1, sliceIndex: 0 };
    case "B'": return { axis: 'depth', dir: -1, sliceIndex: 0 };

    // --- Middle slice moves ---
    // M follows L direction (down from front perspective)
    case 'M':  return { axis: 'col',   dir:  1, sliceIndex: mid };
    case "M'": return { axis: 'col',   dir: -1, sliceIndex: mid };
    case 'M2': return null; // Double move

    // E follows D direction
    case 'E':  return { axis: 'row',   dir:  1, sliceIndex: mid };
    case "E'": return { axis: 'row',   dir: -1, sliceIndex: mid };

    // S follows F direction
    case 'S':  return { axis: 'depth', dir: -1, sliceIndex: mid };
    case "S'": return { axis: 'depth', dir:  1, sliceIndex: mid };

    default: return null;
  }
}

// Expand double moves (U2, M2, etc.) into two single moves
export function expandMove(moveName, size) {
  if (moveName.endsWith('2')) {
    const base = moveName.slice(0, -1); // 'U2' → 'U'
    const rot = namedMoveToRotation(base, size);
    return rot ? [rot, rot] : [];
  }
  const rot = namedMoveToRotation(moveName, size);
  return rot ? [rot] : [];
}

// ---------------------------------------------------------------------------
// Key → Named Move mapping  (speedcuber-inspired layout)
// ---------------------------------------------------------------------------
// Layout optimised for two-hand home-row typing:
//
//   Left hand:                Right hand:
//   ┌─────┐                  ┌─────┐
//   │ S A │ ← L, L'          │ J L │ ← R, R'     (wrist analog)
//   │ D F │ ← D/D', F/F'     │ I K │ ← U, U'     (index flick analog)
//   └─────┘                  │ ; . │ ← D', M/M'
//                            └─────┘

export const HANDS_KEY_MAP = {
  // U moves (top face) - index finger flicks
  'i': 'U',
  'k': "U'",
  'o': 'U2',  // double flick

  // R moves (right face) - right wrist turns
  'j': 'R',
  'l': "R'",

  // L moves (left face) - left wrist turns
  'f': 'L',
  'd': "L'",

  // F moves (front face) - right index pull / thumb push
  'h': 'F',
  'g': "F'",

  // D moves (down face) - ring finger flicks
  's': 'D',
  ';': "D'",

  // B moves (back face)
  'w': 'B',
  'e': "B'",

  // M slice moves - ring/middle finger push
  ',': "M'",  // M' is more common (up motion)
  'm': 'M',
  '.': 'M2',

  // E & S slices (less common, modifier combos)
  'u': "E'",
  'n': 'E',

  // Whole-cube rotations mapped to number row (inspection)
  // These are handled differently – they rotate the camera/view, not a slice
};

// Return the named move for a keydown event, or null if not mapped
export function keyToMove(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const key = event.key.toLowerCase();
  return HANDS_KEY_MAP[key] || null;
}

// ---------------------------------------------------------------------------
// Combo / algorithm detection
// ---------------------------------------------------------------------------

// Well-known algorithm patterns (matched against recent move history)
export const KNOWN_COMBOS = [
  { name: 'Sexy Move',       pattern: ['R', 'U', "R'", "U'"],          notation: "R U R' U'" },
  { name: 'Inverse Sexy',    pattern: ['U', 'R', "U'", "R'"],          notation: "U R U' R'" },
  { name: 'Sledgehammer',    pattern: ["R'", "F", "R", "F'"],          notation: "R' F R F'" },
  { name: 'Hedge',           pattern: ["F", "R", "F'", "R'"],          notation: "F R F' R'" },
  { name: 'Sune',            pattern: ['R', 'U', "R'", 'U', 'R', 'U2', "R'"], notation: "R U R' U R U2 R'" },
  { name: 'Anti-Sune',       pattern: ["R'", "U'", 'R', "U'", "R'", 'U2', 'R'], notation: "R' U' R U' R' U2 R" },
  { name: 'T-Perm',          pattern: ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"], notation: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Double Sexy',     pattern: ['R', 'U', "R'", "U'", 'R', 'U', "R'", "U'"], notation: "(R U R' U')2" },
];

// Check if the end of moveHistory matches any known combo
// Returns { name, notation, length } or null
export function detectCombo(moveHistory) {
  if (!moveHistory || moveHistory.length < 4) return null;

  for (const combo of KNOWN_COMBOS) {
    const len = combo.pattern.length;
    if (moveHistory.length < len) continue;

    const tail = moveHistory.slice(-len);
    let match = true;
    for (let i = 0; i < len; i++) {
      if (tail[i] !== combo.pattern[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return { name: combo.name, notation: combo.notation, length: len };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Move notation for display
// ---------------------------------------------------------------------------

export const MOVE_DESCRIPTIONS = {
  'U':  { finger: 'R. Index flick →',  plane: 'Up (CW)' },
  "U'": { finger: 'L. Index flick ←',  plane: 'Up (CCW)' },
  'U2': { finger: 'Double flick →→',   plane: 'Up (180)' },
  'D':  { finger: 'L. Ring flick',      plane: 'Down (CW)' },
  "D'": { finger: 'R. Ring flick',      plane: 'Down (CCW)' },
  'R':  { finger: 'R. Wrist turn →',    plane: 'Right (CW)' },
  "R'": { finger: 'R. Wrist turn ←',    plane: 'Right (CCW)' },
  'L':  { finger: 'L. Wrist turn ←',    plane: 'Left (CW)' },
  "L'": { finger: 'L. Wrist turn →',    plane: 'Left (CCW)' },
  'F':  { finger: 'R. Index pull ↓',    plane: 'Front (CW)' },
  "F'": { finger: 'R. Thumb push ↑',    plane: 'Front (CCW)' },
  'B':  { finger: 'L. Middle push',     plane: 'Back (CW)' },
  "B'": { finger: 'L. Middle pull',     plane: 'Back (CCW)' },
  'M':  { finger: 'R. Ring push ↓',     plane: 'Middle (down)' },
  "M'": { finger: 'R. Ring push ↑',     plane: 'Middle (up)' },
  'M2': { finger: 'Ring→Middle flick',   plane: 'Middle (180)' },
  'E':  { finger: 'Equatorial',         plane: 'Equator (CW)' },
  "E'": { finger: 'Equatorial',         plane: 'Equator (CCW)' },
  'S':  { finger: 'Standing',           plane: 'Standing (CW)' },
  "S'": { finger: 'Standing',           plane: 'Standing (CCW)' },
};

// Hands Mode fixed camera position (Home Grip POV)
// Slightly above and in front of the cube, looking slightly down
export const HANDS_CAMERA = {
  position: [0, 1.2, 10],  // Slightly elevated
  lookAt: [0, 0, 0],
  fov: 40,
};
