// The cream graph paper behind the opening and the mode carousel, as numbers
// both of its renderers read. MenuPaperBackdrop bakes them into its WebGL shader;
// the loading screen draws the same lines on a 2D canvas (it must never open a
// second WebGL context). One source keeps the two sheets from drifting apart.

export const PAPER_GRID = {
  rows: 26, // grid squares across the viewport height
  bend: 0.55, // how far the broad waves bend a line, in squares
  bendFreqX: 0.3, // radians per square along x (bends the horizontal lines)
  bendFreqY: 0.32, // radians per square along y (bends the vertical lines)
  bendSpeedX: 0.38,
  bendSpeedY: 0.45,
  drift: 0.24, // slow whole-sheet sway, in squares
  driftSpeedX: 0.18,
  driftSpeedY: 0.16,
  paperEdge: [0.94, 0.92, 0.86],
  paperCentre: [0.98, 0.97, 0.92],
  highlight: [0.5, 0.55], // brightest point, in uv with y up
  line: [0.64, 0.68, 0.61],
  lineMix: 0.4
};

const P = PAPER_GRID;

/** A number as a GLSL float literal (26 → "26.0"). */
export const glslFloat = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** An RGB triple as a GLSL vec3. */
export const glslVec3 = (rgb) => `vec3(${rgb.map(glslFloat).join(', ')})`;

/**
 * The shader adds this to a pixel's grid x (in squares) before finding lines.
 * `gy` is the pixel's grid y, measured up from the bottom of the viewport.
 * A vertical line n therefore sits where gx = n − paperShiftX(gy, t).
 */
export const paperShiftX = (gy, t) => P.bend * Math.sin(gy * P.bendFreqY + t * P.bendSpeedY) + P.drift * Math.sin(t * P.driftSpeedX);

/** As paperShiftX, for grid y: horizontal line m sits where gy = m − paperShiftY(gx, t). */
export const paperShiftY = (gx, t) => P.bend * Math.sin(gx * P.bendFreqX - t * P.bendSpeedX) + P.drift * Math.cos(t * P.driftSpeedY);

const channel = (v) => Math.round(v * 255);
/** CSS rgb() for a 0–1 triple. */
export const paperRgb = (rgb) => `rgb(${rgb.map(channel).join(',')})`;
