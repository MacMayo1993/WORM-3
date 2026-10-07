// Layout for the Levels screen's chapter map: ten stages laid out as a winding
// trail that snakes left-to-right and back, like a world map in a platformer.
// Positions are fractions of the map's box, so the nodes (placed with CSS
// percentages) and the trail (drawn in pixels once the box is measured) agree
// at every size. Pure: no React, no DOM.
import { RUBIKS_CLASSIC, readableInk } from '../../utils/constants.js';

const ROW_Y = [0.37, 0.82];
const COL_X = [0.11, 0.305, 0.5, 0.695, 0.89];
const WOBBLE = 0.065;

/** Where stage `index` (0-based) of a chapter of `count` sits on the map. */
export function mapNodePosition(index, count = 10) {
  const perRow = Math.ceil(count / ROW_Y.length);
  const row = Math.floor(index / perRow), col = index % perRow;
  const xs = perRow === COL_X.length ? COL_X : Array.from({ length: perRow }, (_, i) => 0.11 + (0.78 * i) / Math.max(1, perRow - 1));
  // Odd rows run back the other way, so the trail turns at the edge.
  const x = xs[row % 2 ? perRow - 1 - col : col];
  // Alternate stages sit a little higher or lower, so the trail meanders.
  const y = ROW_Y[Math.min(row, ROW_Y.length - 1)] + (col % 2 ? WOBBLE : -WOBBLE) * (row % 2 ? -1 : 1);
  return { x, y };
}

export const mapNodePositions = count => Array.from({ length: count }, (_, i) => mapNodePosition(i, count));

/**
 * One smooth trail segment per gap between stages, in pixels, as SVG path data.
 * Catmull-Rom through the neighbouring stages keeps the whole trail one curve,
 * while separate segments let cleared and locked stretches be drawn apart. The
 * row turn swings out past the last column rather than doubling back on itself.
 */
export function mapTrailSegments(points, width, height) {
  const px = points.map(p => ({ x: p.x * width, y: p.y * height }));
  const at = i => px[Math.max(0, Math.min(px.length - 1, i))];
  const r = n => Math.round(n * 10) / 10;
  return px.slice(0, -1).map((a, i) => {
    const b = px[i + 1];
    let c1, c2;
    if (Math.abs(a.x - b.x) < 1e-6) {
      // A row turn: bow outward, away from the map's centre.
      const out = (a.x > width / 2 ? 1 : -1) * width * 0.09;
      c1 = { x: a.x + out, y: a.y }; c2 = { x: b.x + out, y: b.y };
    } else {
      const p0 = at(i - 1), p3 = at(i + 2);
      const turnBefore = Math.abs(p0.x - a.x) < 1e-6 && i > 0, turnAfter = Math.abs(p3.x - b.x) < 1e-6 && i + 2 < px.length;
      const t0 = turnBefore ? { x: b.x - a.x, y: 0 } : { x: (b.x - p0.x) / 2, y: (b.y - p0.y) / 2 };
      const t1 = turnAfter ? { x: b.x - a.x, y: 0 } : { x: (p3.x - a.x) / 2, y: (p3.y - a.y) / 2 };
      c1 = { x: a.x + t0.x / 3, y: a.y + t0.y / 3 }; c2 = { x: b.x - t1.x / 3, y: b.y - t1.y / 3 };
    }
    return `M${r(a.x)} ${r(a.y)} C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(b.x)} ${r(b.y)}`;
  });
}

// Each chapter is a "world" lit in one of the Rubik's cube's face colours, in
// the order the campaign travels round the cube. White is left out: it would
// vanish on the ivory paper.
const WORLD_COLORS = [RUBIKS_CLASSIC.green, RUBIKS_CLASSIC.blue, RUBIKS_CLASSIC.orange, RUBIKS_CLASSIC.red, RUBIKS_CLASSIC.yellow];
export function chapterWorldColor(chapterId) {
  const color = WORLD_COLORS[(Math.max(1, chapterId) - 1) % WORLD_COLORS.length];
  return { color, ink: readableInk(color) };
}

/** "2-4": chapter and stage within it, the way a platformer numbers its worlds. */
export const stageCode = (chapterId, index) => `${chapterId}-${index}`;
