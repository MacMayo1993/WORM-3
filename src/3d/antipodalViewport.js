// DOM owns the exact camera window; the renderer publishes normalized cube bounds.
export const antipodalViewport = { rect: null, canvas: null, cube: null };
export const overlapArea = (a, b) => !a || !b ? 0 :
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const pad = (r, n) => ({ x: r.x - n, y: r.y - n, width: r.width + 2 * n, height: r.height + 2 * n });

export function placeAntipodalPanel({ width, height, obstacles = [], cube = null, compact = false, expanded = false, corner = 0, previous = null, insets = {} }) {
  const left = 10 + (insets.left || 0), top = 10 + (insets.top || 0);
  const right = width - 10 - (insets.right || 0), bottom = height - 10 - (insets.bottom || 0);
  const blocked = obstacles.map(r => pad(r, 6));
  const body = cube && pad(cube, 6);
  const preferRight = corner < 2, preferBottom = corner === 1 || corner === 2;
  function find(w, h, folded) {
    let best = null, bestScore = Infinity;
    const ys = new Set([top, bottom - h]);
    for (const r of [...blocked, ...(body ? [body] : [])]) { ys.add(r.y - h); ys.add(r.y + r.height); }
    if (previous?.width === w && previous.compact === folded) ys.add(previous.y);
    for (const x of [left, right - w]) for (const y of ys) {
      const rect = { x, y, width: w, height: h, compact: folded };
      if (x < left || x + w > right || y < top || y + h > bottom || blocked.some(r => overlapArea(rect, r) > 0)) continue;
      const cover = overlapArea(rect, body);
      if (!folded && !expanded && cover > 0) continue;
      const distance = Math.abs(x - (preferRight ? right - w : left)) + Math.abs(y - (preferBottom ? bottom - h : top));
      const stable = previous && previous.compact === folded && previous.x === x && previous.y === y ? 40 : 0;
      const score = distance + cover * 100 - stable;
      if (score < bestScore) { best = rect; bestScore = score; }
    }
    return best;
  }
  if (!compact) {
    const sizes = width < 600 || height < 500 ? [168, 148] : [208, 168, 148];
    for (const w of sizes) {
      const found = find(w, 50 + (w - 14) * 0.75, false);
      if (found) return found;
    }
  }
  return find(152, 40, true);
}

// Three.js applies DPR itself. Convert the measured CSS rectangle to canvas CSS
// pixels and bottom-left origin exactly once, including an offset canvas.
export function antipodalScissor(view, canvas, width, height) {
  if (!view || !canvas || canvas.width <= 0 || canvas.height <= 0 || view.width <= 0 || view.height <= 0) return null;
  const x = (view.x - canvas.x) * width / canvas.width;
  const y = height - (view.y - canvas.y + view.height) * height / canvas.height;
  const w = view.width * width / canvas.width, h = view.height * height / canvas.height;
  if (x < 0 || y < 0 || x + w > width + 0.01 || y + h > height + 0.01) return null;
  return { x, y, width: w, height: h };
}
