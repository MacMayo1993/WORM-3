import { LinearSRGBColorSpace } from 'three';

// The mode carousel's paper, as numbers and ink: where the doodles and the
// doodle worm go round the cube, the doodles each mode inks into the margins,
// and the padlock stamp a locked mode gets. Pure, apart from paintDoodles,
// which draws into a 2D canvas the paper's shader reads as a texture.
// MenuPaperBackdrop does the rest in its shader.

export const PAPER_FX = {
  tint: 0.55,          // how strongly the presented mode's colour glows round the cube
  tintEase: 5,         // per second: the glow crossfades as the carousel turns
  well: 0.22,          // how far the paper dips round the cube (lines drawn in toward it)
  rippleLife: 1.4,     // seconds a swipe's ripple runs
  rippleSpeed: 0.85,   // paper heights a second
  lean: 0.035,         // parallax: paper heights the sheet slides at full lean
  doodleAlpha: 0.42,   // ink strength of the margin doodles
  drawSeconds: 0.9,    // a doodle inking itself in
  wormSpeed: 1.3,      // grid squares a second
};

// The glow a pale mode colour (the Store's white face) wears instead.
export const PALE_MODE_GLOW = '#f2c14e';

/**
 * A mode's glow colour into `out`, as the raw display values the paper's
 * shader writes (no sRGB decode). The Store's face is white, which vanishes on
 * cream paper, so a pale mode colour glows in warm gold instead.
 */
export function paperTintInto(out, hex) {
  out.setStyle(hex, LinearSRGBColorSpace);
  const light = out.r * 0.299 + out.g * 0.587 + out.b * 0.114;
  return light > 0.82 ? out.setStyle(PALE_MODE_GLOW, LinearSRGBColorSpace) : out;
}

/**
 * Where things sit round the cube, in the paper's aspect-corrected space (x
 * across in paper heights, y up). `cube` is { x, y, r } in that space.
 */
export function carouselPaperLayoutInto(out, cube, aspect, rows) {
  const { x, y, r } = cube;
  const portrait = aspect < 0.8;
  // Landscape: the doodles flank the cube; portrait: tucked by its corners,
  // since the header and footer own the space above and below.
  const dx = portrait ? 0.85 * r : 1.45 * r;
  const dy = portrait ? 1.25 * r : 0.55 * r;
  out.left = out.left ?? { x: 0, y: 0 };
  out.right = out.right ?? { x: 0, y: 0 };
  out.left.x = x - dx; out.left.y = y + dy;
  out.right.x = x + dx; out.right.y = y - dy;
  out.size = (portrait ? 0.6 : 0.85) * r;
  // The doodle worm walks the grid line through the cube's lower half, so it
  // passes behind the cube on its way across.
  out.wormRow = Math.round((y - 0.55 * r) * rows);
  return out;
}

// ── Doodles ─────────────────────────────────────────────────────────────────
// Each is a list of strokes; a stroke is a polyline of [x, y] in its slot's
// unit square (y down, as a canvas draws). Hand-drawn wobble is added when they
// are painted, seeded per point, so the same doodle always draws the same way.

const circle = (cx, cy, r, from = 0, to = Math.PI * 2, n = 28) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + (to - from) * (i / n);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const dot = (cx, cy, r = 0.025) => circle(cx, cy, r, 0, Math.PI * 2, 10);

const DOODLES = {
  // WORM: a worm squiggling along, and a heart.
  NX: [
    [
      Array.from({ length: 25 }, (_, i) => [0.12 + i * 0.026, 0.62 + Math.sin(i * 0.55) * 0.09]),
      circle(0.83, 0.58, 0.085),
      dot(0.86, 0.55),
    ],
    [
      Array.from({ length: 41 }, (_, i) => {
        const t = (i / 40) * Math.PI * 2;
        return [0.5 + 0.022 * 16 * Math.sin(t) ** 3, 0.47 - 0.022 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
      }),
    ],
  ],
  // FLIP CUBE: a tile with a flip arrow round it, and a pair swapping places.
  NY: [
    [
      [[0.36, 0.36], [0.64, 0.36], [0.64, 0.64], [0.36, 0.64], [0.36, 0.36]],
      circle(0.5, 0.5, 0.3, Math.PI * 1.05, Math.PI * 1.95),
      [[0.71, 0.33], [0.77, 0.43], [0.66, 0.43]],
    ],
    [
      circle(0.5, 0.52, 0.24, Math.PI * 1.1, Math.PI * 1.9),
      [[0.66, 0.26], [0.73, 0.34], [0.63, 0.37]],
      circle(0.5, 0.48, 0.24, Math.PI * 0.1, Math.PI * 0.9),
      [[0.34, 0.74], [0.27, 0.66], [0.37, 0.63]],
    ],
  ],
  // TEACH: a bright idea, and a cube sketched in three faces.
  PX: [
    [
      circle(0.5, 0.4, 0.2, Math.PI * 0.72, Math.PI * 2.28),
      [[0.42, 0.6], [0.42, 0.72], [0.58, 0.72], [0.58, 0.6]],
      [[0.44, 0.78], [0.56, 0.78]],
      [[0.45, 0.58], [0.48, 0.44], [0.52, 0.52], [0.55, 0.44], [0.55, 0.58]],
    ],
    [
      [[0.5, 0.22], [0.76, 0.36], [0.76, 0.66], [0.5, 0.8], [0.24, 0.66], [0.24, 0.36], [0.5, 0.22]],
      [[0.24, 0.36], [0.5, 0.5], [0.76, 0.36]],
      [[0.5, 0.5], [0.5, 0.8]],
    ],
  ],
  // CHAOS: a lightning bolt, and a spiral.
  NZ: [
    [[[0.58, 0.14], [0.36, 0.52], [0.52, 0.52], [0.4, 0.86], [0.68, 0.42], [0.52, 0.42], [0.64, 0.14], [0.58, 0.14]]],
    [Array.from({ length: 60 }, (_, i) => {
      const a = i * 0.32, rr = 0.02 + i * 0.0052;
      return [0.5 + Math.cos(a) * rr, 0.5 + Math.sin(a) * rr];
    })],
  ],
  // RANDOM: a die showing five, and a question mark.
  PZ: [
    [
      [[0.28, 0.3], [0.72, 0.3], [0.72, 0.74], [0.28, 0.74], [0.28, 0.3]],
      dot(0.38, 0.4, 0.03), dot(0.62, 0.4, 0.03), dot(0.5, 0.52, 0.03), dot(0.38, 0.64, 0.03), dot(0.62, 0.64, 0.03),
    ],
    [
      [...circle(0.5, 0.36, 0.14, Math.PI, Math.PI * 2.4), [0.5, 0.62]],
      dot(0.5, 0.76, 0.03),
    ],
  ],
  // STORE: a coin with the Parity Point diamond, and a sparkle.
  PY: [
    [
      circle(0.5, 0.5, 0.28),
      [[0.5, 0.33], [0.6, 0.5], [0.5, 0.67], [0.4, 0.5], [0.5, 0.33]],
    ],
    [
      [[0.5, 0.2], [0.55, 0.45], [0.8, 0.5], [0.55, 0.55], [0.5, 0.8], [0.45, 0.55], [0.2, 0.5], [0.45, 0.45], [0.5, 0.2]],
      [[0.78, 0.2], [0.8, 0.27], [0.87, 0.29], [0.8, 0.31], [0.78, 0.38], [0.76, 0.31], [0.69, 0.29], [0.76, 0.27], [0.78, 0.2]],
    ],
  ],
};

/** The padlock stamp a locked mode wears, in the same unit square. */
export const PADLOCK_STAMP = [
  circle(0.5, 0.5, 0.4),
  circle(0.5, 0.46, 0.13, Math.PI, Math.PI * 2),
  [[0.37, 0.46], [0.37, 0.52]],
  [[0.63, 0.46], [0.63, 0.52]],
  [[0.3, 0.52], [0.7, 0.52], [0.7, 0.76], [0.3, 0.76], [0.3, 0.52]],
  [[0.5, 0.6], [0.5, 0.68]],
];

/** A mode face's two doodles (left, right). Unknown faces get none. */
export function doodlesFor(face) {
  return DOODLES[face] ?? [[], []];
}

const segmentLength = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** Total ink length of some strokes. */
export function strokesLength(strokes) {
  let total = 0;
  for (const stroke of strokes) for (let i = 1; i < stroke.length; i++) total += segmentLength(stroke[i - 1], stroke[i]);
  return total;
}

/**
 * The strokes as far as a pen has got at `progress` (0…1) of their total
 * length, drawn in order: whole strokes, then part of the one being drawn.
 */
export function revealStrokes(strokes, progress) {
  const p = Math.max(0, Math.min(1, progress));
  if (p >= 1) return strokes;
  let left = strokesLength(strokes) * p;
  const out = [];
  for (const stroke of strokes) {
    if (left <= 0) break;
    const part = [stroke[0]];
    for (let i = 1; i < stroke.length; i++) {
      const step = segmentLength(stroke[i - 1], stroke[i]);
      if (step <= left) { part.push(stroke[i]); left -= step; continue; }
      const t = step > 0 ? left / step : 0;
      part.push([stroke[i - 1][0] + (stroke[i][0] - stroke[i - 1][0]) * t, stroke[i - 1][1] + (stroke[i][1] - stroke[i - 1][1]) * t]);
      left = 0;
      break;
    }
    if (part.length > 1) out.push(part);
  }
  return out;
}

const INK = '#2f4a38';
const STAMP = '#c0392b';
// A hand's wobble: a small, fixed offset per point, so a redraw never shimmers.
const wobble = (i, j, axis) => Math.sin(i * 12.9898 + j * 78.233 + axis * 37.719) * 0.006;

function strokeAll(ctx, strokes, x0, size) {
  strokes.forEach((stroke, j) => {
    ctx.beginPath();
    stroke.forEach(([x, y], i) => {
      const px = x0 + (x + wobble(i, j, 0)) * size, py = (y + wobble(i, j, 1)) * size;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
  });
}

/**
 * Ink a mode's doodles into a 2:1 canvas: the left doodle in its left half,
 * the right in its right half (a locked mode gets the padlock stamp there in
 * red instead). `progress` is how far the pen has got, 0…1.
 */
export function paintDoodles(ctx, width, height, face, progress, locked = false) {
  ctx.clearRect(0, 0, width, height);
  const size = Math.min(width / 2, height);
  const [left, right] = doodlesFor(face);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.028;
  ctx.strokeStyle = INK;
  strokeAll(ctx, revealStrokes(left, progress), 0, size);
  if (locked) {
    ctx.strokeStyle = STAMP;
    ctx.lineWidth = size * 0.04;
    strokeAll(ctx, revealStrokes(PADLOCK_STAMP, progress), width / 2, size);
  } else {
    strokeAll(ctx, revealStrokes(right, progress), width / 2, size);
  }
}
