// Standard cube move notation shared by Teach and Algorithm Codex.
// Independent of the archived Hands input mode.

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

// Returns the engine rotation for a single named move, or null for double moves
// and unknown names.  Double moves (U2, R2, L2, F2, B2, D2, M2, …) intentionally
// fall through to `default: null` so they're handled by expandMove() which strips
// the '2' suffix and applies the base rotation twice.  Only U2 and M2 have
// explicit null returns for documentation — all other xN moves behave the same way.
export function namedMoveToRotation(moveName, size) {
  const last = size - 1;
  const mid = Math.floor(size / 2); // Middle slice for M, E, S

  switch (moveName) {
    // --- Face moves ---
    case 'U':  return { axis: 'row',   dir: -1, sliceIndex: last };
    case "U'": return { axis: 'row',   dir:  1, sliceIndex: last };
    case 'U2': return null; // double move — expandMove() handles via endsWith('2')

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
    case 'M2': return null; // double move — expandMove() handles via endsWith('2')

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

