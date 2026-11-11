// Keep the mirror chamber's openings centred in deliberately sized panels.
// The outer chrome miniature still follows the play cube; the inner room is
// free to fit its panels around the fixed traversal, without moving the worm.
export const MIRROR_PORT_PANEL_RADIUS = 1.20;

export function mirrorPanelIntervals(half, size, coordinates, radius) {
  const pitch = half * 2 / size;
  const sorted = [...coordinates].sort((a, b) => a - b);
  const ports = [];
  for (const center of sorted) {
    const lo = Math.max(-half, center - radius * MIRROR_PORT_PANEL_RADIUS);
    const hi = Math.min(half, center + radius * MIRROR_PORT_PANEL_RADIUS);
    const previous = ports.at(-1);
    // Close/overlapping ports share one centred panel rather than cutting each
    // other's tile. Separate openings retain their own symmetric port panel.
    if (previous && lo - previous[1] < pitch * .12) previous[1] = Math.max(previous[1], hi);
    else ports.push([lo, hi]);
  }
  const intervals = [];
  const fill = (lo, hi) => {
    const width = hi - lo;
    if (width < pitch * .10) return; // a narrow remainder reads as a dark joint
    const count = Math.max(1, Math.round(width / pitch));
    for (let i = 0; i < count; i++) intervals.push([lo + width * i / count, lo + width * (i + 1) / count]);
  };
  let cursor = -half;
  for (const [lo, hi] of ports) { fill(cursor, lo); intervals.push([lo, hi]); cursor = hi; }
  fill(cursor, half);
  return intervals.map(([lo, hi]) => ({
    center: (lo + hi) / 2,
    width: hi - lo,
    index: Math.min(size - 1, Math.max(0, Math.floor(((lo + hi) / 2 + half) / pitch)))
  }));
}
