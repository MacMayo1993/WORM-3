// Converts WORM-3 cubies to the 54-char kociemba face string.
// Face string order: U(9) R(9) F(9) D(9) L(9) B(9)
// Each face read top-left to bottom-right when looking directly at the face.
//
// WORM-3 coordinate system (3x3, size=3):
//   x: 0=Left(NX/Green/L)   2=Right(PX/Blue/R)
//   y: 0=Bottom(NY/Yellow/D) 2=Top(PY/White/U)
//   z: 0=Back(NZ/Orange/B)  2=Front(PZ/Red/F)
//
// kociemba letters:  U=White(3)  R=Blue(5)  F=Red(1)  D=Yellow(6)  L=Green(2)  B=Orange(4)

import { ANTIPODAL_COLOR } from '../utils/constants.js';

const COLOR_TO_FACE = { 1: 'F', 2: 'L', 3: 'U', 4: 'B', 5: 'R', 6: 'D' };

// Resolve a sticker to the colour we feed the solver.
//
// Normally that is `curr` (what's painted right now). But a wormhole flip
// recolours a sticker to its antipode (`curr = ANTIPODAL_COLOR[curr]`) while
// leaving its true identity in `orig` untouched — flips never move a piece,
// they only toggle its facelet colour. So when `ignoreFlips` is set we read the
// flip-invariant identity `orig`, but ONLY when the current paint is explained
// by an (even/odd) chain of antipodal flips, i.e. curr ∈ {orig, antipode(orig)}.
// Any other recolour (manifold paint, chaos damage that isn't a clean flip) is
// left as-is so the 9-of-each validation below still rejects it.
function readColor(st, ignoreFlips) {
  if (!st) return undefined;
  if (ignoreFlips && (st.curr === st.orig || st.curr === ANTIPODAL_COLOR[st.orig])) {
    return st.orig;
  }
  return st.curr;
}

/**
 * Convert a 3x3 cubies array to the 54-char kociemba input string.
 *
 * @param {Array} cubies                3x3x3 cubie grid
 * @param {object} [opts]
 * @param {boolean} [opts.ignoreFlips]  When true, wormhole flips are forgiven:
 *   a flipped sticker is read by its true home identity so a flipped cube still
 *   yields a solvable position string. Non-flip recolours are still rejected.
 * @returns {string|null} 54-char face string, or null if cubies isn't a solvable 3x3.
 */
export function cubiesToKociembaString(cubies, opts = {}) {
  if (!cubies || cubies.length !== 3) return null;

  const { ignoreFlips = false } = opts;
  const n = 2; // size - 1

  // Returns '?' sentinel for unrecognised/missing sticker colours so validation catches it.
  const g = (x, y, z, dir) => COLOR_TO_FACE[readColor(cubies[x]?.[y]?.[z]?.stickers?.[dir], ignoreFlips)] ?? '?';

  // U face (y=2, PY stickers) — viewed from top, back row first (z=0)
  const u =
    g(0,n,0,'PY')+g(1,n,0,'PY')+g(2,n,0,'PY')+
    g(0,n,1,'PY')+g(1,n,1,'PY')+g(2,n,1,'PY')+
    g(0,n,2,'PY')+g(1,n,2,'PY')+g(2,n,2,'PY');

  // R face (x=2, PX stickers) — viewed from right, front-left to back-right (z=2→0)
  const r =
    g(n,2,2,'PX')+g(n,2,1,'PX')+g(n,2,0,'PX')+
    g(n,1,2,'PX')+g(n,1,1,'PX')+g(n,1,0,'PX')+
    g(n,0,2,'PX')+g(n,0,1,'PX')+g(n,0,0,'PX');

  // F face (z=2, PZ stickers) — viewed from front, left-to-right (x=0→2)
  const f =
    g(0,2,n,'PZ')+g(1,2,n,'PZ')+g(2,2,n,'PZ')+
    g(0,1,n,'PZ')+g(1,1,n,'PZ')+g(2,1,n,'PZ')+
    g(0,0,n,'PZ')+g(1,0,n,'PZ')+g(2,0,n,'PZ');

  // D face (y=0, NY stickers) — viewed from below, front row first (z=2→0)
  const d =
    g(0,0,2,'NY')+g(1,0,2,'NY')+g(2,0,2,'NY')+
    g(0,0,1,'NY')+g(1,0,1,'NY')+g(2,0,1,'NY')+
    g(0,0,0,'NY')+g(1,0,0,'NY')+g(2,0,0,'NY');

  // L face (x=0, NX stickers) — viewed from left, back-left to front-right (z=0→2)
  const l =
    g(0,2,0,'NX')+g(0,2,1,'NX')+g(0,2,2,'NX')+
    g(0,1,0,'NX')+g(0,1,1,'NX')+g(0,1,2,'NX')+
    g(0,0,0,'NX')+g(0,0,1,'NX')+g(0,0,2,'NX');

  // B face (z=0, NZ stickers) — viewed from back, right-to-left (x=2→0)
  const b =
    g(2,2,0,'NZ')+g(1,2,0,'NZ')+g(0,2,0,'NZ')+
    g(2,1,0,'NZ')+g(1,1,0,'NZ')+g(0,1,0,'NZ')+
    g(2,0,0,'NZ')+g(1,0,0,'NZ')+g(0,0,0,'NZ');

  const str = u + r + f + d + l + b;

  // Reject any state that doesn't have exactly 9 of every face letter.
  // This catches chaos-mode stickers, non-flip damage, manifold colours, and
  // any other situation where a sticker colour wasn't in COLOR_TO_FACE.
  if (str.length !== 54) return null;
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    if ((str.split(face).length - 1) !== 9) return null;
  }

  return str;
}
