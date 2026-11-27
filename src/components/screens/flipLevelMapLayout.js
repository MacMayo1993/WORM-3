// src/components/screens/flipLevelMapLayout.js
// The Flip Cube level map's trail: ten stages climbing a portrait page from level
// 1 at the foot to the finale at the top, as the scenes climb from the daycare to
// the black hole. Stages swing left and right so the trail winds. Positions are
// fractions of the map's box (x across, y down), so the stage keys (CSS
// percentages) and the trail (an SVG in the same box) agree at any size. Pure.
import { BACKGROUNDS } from '../../levels/schema.js';

/** Height of the map per stage, in CSS pixels. */
export const STAGE_SPACING = 132;
// The pieces sit on these lines; each label hangs from its piece toward the middle.
const SWING = [0.2, 0.8];
const EDGE = 0.5; // half a stage of margin at the top and bottom

/** Where stage `index` (0 = level 1, at the bottom) sits, as { x, y } fractions. */
export function flipMapNode(index, count) {
  const x = SWING[index % 2];
  const y = 1 - (index + EDGE) / count;
  return { x, y };
}

export const flipMapNodes = count => Array.from({ length: count }, (_, i) => flipMapNode(i, count));

/**
 * One SVG path per gap between stages, in a viewBox `width` × `height`, as cubic
 * curves that leave each stage straight up and arrive from straight below, so
 * the whole trail reads as one road. Separate segments let cleared and locked
 * stretches be drawn apart.
 */
export function flipMapTrail(nodes, width, height) {
  const r = n => Math.round(n * 10) / 10;
  return nodes.slice(0, -1).map((a, i) => {
    const b = nodes[i + 1];
    const ax = a.x * width, ay = a.y * height, bx = b.x * width, by = b.y * height;
    const lift = (ay - by) * 0.55;
    return `M${r(ax)} ${r(ay)} C${r(ax)} ${r(ay - lift)} ${r(bx)} ${r(by + lift)} ${r(bx)} ${r(by)}`;
  });
}

/** Each stage's scene, as the name the map prints under it. */
export const SCENE_NAMES = {
  [BACKGROUNDS.DAYCARE]: 'Daycare', [BACKGROUNDS.ELEMENTARY]: 'Old town', [BACKGROUNDS.MIDDLESCHOOL]: 'Forest',
  [BACKGROUNDS.HIGHSCHOOL]: 'Stadium', [BACKGROUNDS.COLLEGE]: 'Paris', [BACKGROUNDS.JOB]: 'Shanghai',
  [BACKGROUNDS.NASA]: 'Mission lounge', [BACKGROUNDS.ROCKET]: 'Launch site', [BACKGROUNDS.MOON]: 'Moon', [BACKGROUNDS.BLACKHOLE]: 'Black hole',
};
