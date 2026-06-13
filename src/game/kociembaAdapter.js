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

const COLOR_TO_FACE = { 1: 'F', 2: 'L', 3: 'U', 4: 'B', 5: 'R', 6: 'D' };

// Returns '?' sentinel for unrecognised/missing sticker colours so validation catches it.
function g(cubies, x, y, z, dir) {
  return COLOR_TO_FACE[cubies[x]?.[y]?.[z]?.stickers?.[dir]?.curr] ?? '?';
}

/**
 * Convert a 3x3 cubies array to the 54-char kociemba input string.
 * Returns null if cubies is not a 3x3 array.
 */
export function cubiesToKociembaString(cubies) {
  if (!cubies || cubies.length !== 3) return null;

  const n = 2; // size - 1

  // U face (y=2, PY stickers) — viewed from top, back row first (z=0)
  const u =
    g(cubies,0,n,0,'PY')+g(cubies,1,n,0,'PY')+g(cubies,2,n,0,'PY')+
    g(cubies,0,n,1,'PY')+g(cubies,1,n,1,'PY')+g(cubies,2,n,1,'PY')+
    g(cubies,0,n,2,'PY')+g(cubies,1,n,2,'PY')+g(cubies,2,n,2,'PY');

  // R face (x=2, PX stickers) — viewed from right, front-left to back-right (z=2→0)
  const r =
    g(cubies,n,2,2,'PX')+g(cubies,n,2,1,'PX')+g(cubies,n,2,0,'PX')+
    g(cubies,n,1,2,'PX')+g(cubies,n,1,1,'PX')+g(cubies,n,1,0,'PX')+
    g(cubies,n,0,2,'PX')+g(cubies,n,0,1,'PX')+g(cubies,n,0,0,'PX');

  // F face (z=2, PZ stickers) — viewed from front, left-to-right (x=0→2)
  const f =
    g(cubies,0,2,n,'PZ')+g(cubies,1,2,n,'PZ')+g(cubies,2,2,n,'PZ')+
    g(cubies,0,1,n,'PZ')+g(cubies,1,1,n,'PZ')+g(cubies,2,1,n,'PZ')+
    g(cubies,0,0,n,'PZ')+g(cubies,1,0,n,'PZ')+g(cubies,2,0,n,'PZ');

  // D face (y=0, NY stickers) — viewed from below, front row first (z=2→0)
  const d =
    g(cubies,0,0,2,'NY')+g(cubies,1,0,2,'NY')+g(cubies,2,0,2,'NY')+
    g(cubies,0,0,1,'NY')+g(cubies,1,0,1,'NY')+g(cubies,2,0,1,'NY')+
    g(cubies,0,0,0,'NY')+g(cubies,1,0,0,'NY')+g(cubies,2,0,0,'NY');

  // L face (x=0, NX stickers) — viewed from left, back-left to front-right (z=0→2)
  const l =
    g(cubies,0,2,0,'NX')+g(cubies,0,2,1,'NX')+g(cubies,0,2,2,'NX')+
    g(cubies,0,1,0,'NX')+g(cubies,0,1,1,'NX')+g(cubies,0,1,2,'NX')+
    g(cubies,0,0,0,'NX')+g(cubies,0,0,1,'NX')+g(cubies,0,0,2,'NX');

  // B face (z=0, NZ stickers) — viewed from back, right-to-left (x=2→0)
  const b =
    g(cubies,2,2,0,'NZ')+g(cubies,1,2,0,'NZ')+g(cubies,0,2,0,'NZ')+
    g(cubies,2,1,0,'NZ')+g(cubies,1,1,0,'NZ')+g(cubies,0,1,0,'NZ')+
    g(cubies,2,0,0,'NZ')+g(cubies,1,0,0,'NZ')+g(cubies,0,0,0,'NZ');

  const str = u + r + f + d + l + b;

  // Reject any state that doesn't have exactly 9 of every face letter.
  // This catches chaos-mode stickers, flip damage, manifold colours, and
  // any other situation where a sticker colour wasn't in COLOR_TO_FACE.
  if (str.length !== 54) return null;
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    if ((str.split(face).length - 1) !== 9) return null;
  }

  return str;
}
