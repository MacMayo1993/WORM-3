import { expect, it } from 'vitest';
import { antipodalScissor, overlapArea, placeAntipodalPanel } from '../3d/antipodalViewport.js';
const rect = (x, y, width, height) => ({ x, y, width, height });

it.each([[1440, 900], [390, 844], [320, 640], [844, 390]])('avoids text and the central cube at %s×%s', (width, height) => {
  const obstacles = [rect(0, 0, width, 64), rect(0, height - 90, width, 90), rect(20, 80, width - 40, 120)];
  const cube = rect(width * 0.22, height * 0.36, width * 0.56, height * 0.36);
  const panel = placeAntipodalPanel({ width, height, obstacles, cube });
  expect(panel).not.toBeNull();
  for (const item of obstacles) expect(overlapArea(panel, item)).toBe(0);
  if (!panel.compact) expect(overlapArea(panel, cube)).toBe(0);
  expect(panel.x).toBeGreaterThanOrEqual(10); expect(panel.y).toBeGreaterThanOrEqual(10);
  expect(panel.x + panel.width).toBeLessThanOrEqual(width - 10);
  expect(panel.y + panel.height).toBeLessThanOrEqual(height - 10);
});
it('collapses when the cube fills the screen, and only overlaps it after an explicit expansion', () => {
  const args = { width: 390, height: 600, cube: rect(0, 0, 390, 600), obstacles: [rect(0, 0, 390, 60)] };
  const automatic = placeAntipodalPanel(args);
  expect(automatic.compact).toBe(true);
  expect(placeAntipodalPanel({ ...args, expanded: true }).compact).toBe(false);
  expect(placeAntipodalPanel({ ...args, expanded: true, compact: true }).compact).toBe(true);
});
it('keeps a valid position stable, moves corners on request, and respects safe areas', () => {
  const args = { width: 1000, height: 800, insets: { top: 30, right: 20, bottom: 25, left: 10 } };
  const first = placeAntipodalPanel(args);
  expect(first.y).toBe(40); expect(first.x + first.width).toBe(970);
  expect(placeAntipodalPanel({ ...args, previous: first })).toEqual(first);
  const moved = placeAntipodalPanel({ ...args, corner: 2 });
  expect(moved.x).toBe(20); expect(moved.y + moved.height).toBe(765);
});
it('keeps an established dock fixed when lesson text changes, but avoids it during initial placement', () => {
  const args = { width: 390, height: 844, obstacles: [rect(0, 0, 390, 80)] };
  const first = placeAntipodalPanel(args);
  const lesson = rect(10, 86, 370, 420);
  const next = placeAntipodalPanel({ ...args, obstacles: [...args.obstacles, lesson], previous: first });
  expect(next).toEqual(first);
  const initial = placeAntipodalPanel({ ...args, obstacles: [...args.obstacles, lesson] });
  expect(overlapArea(initial, lesson)).toBe(0);
  expect(placeAntipodalPanel({ ...args, obstacles: [rect(0, 0, 390, 844)] })).toBeNull();
});
it('does not fold or reopen an established panel as the cube moves', () => {
  const args = { width: 390, height: 844 };
  const open = placeAntipodalPanel(args);
  const cube = rect(0, 0, 390, 844);
  expect(placeAntipodalPanel({ ...args, cube, previous: open })).toEqual(open);
  const folded = placeAntipodalPanel({ ...args, cube });
  expect(folded.compact).toBe(true);
  expect(placeAntipodalPanel({ ...args, previous: folded })).toEqual(folded);
});
it('clamps an existing dock within a resized viewport and its safe areas without reopening it', () => {
  for (const compact of [false, true]) {
    const previous = placeAntipodalPanel({ width: 1200, height: 900, compact, corner: 1 });
    const next = placeAntipodalPanel({ width: 320, height: 240, previous,
      insets: { left: 20, right: 30, top: 25, bottom: 15 } });
    expect(next.compact).toBe(compact);
    expect(next.x).toBeGreaterThanOrEqual(30);
    expect(next.y).toBeGreaterThanOrEqual(35);
    expect(next.x + next.width).toBeLessThanOrEqual(280);
    expect(next.y + next.height).toBeLessThanOrEqual(215);
  }
});
it('aligns an offset DOM window with the CSS-pixel scissor without double-applying DPR', () => {
  expect(antipodalScissor(rect(230, 100, 180, 135), rect(30, 20, 800, 600), 800, 600))
    .toEqual(rect(200, 385, 180, 135));
  expect(antipodalScissor(null, rect(0, 0, 800, 600), 800, 600)).toBeNull();
  expect(antipodalScissor(rect(-10, 0, 10, 20), rect(0, 0, 800, 600), 800, 600)).toBeNull();
  expect(antipodalScissor(rect(0, 0, 0, 0), rect(0, 0, 800, 600), 800, 600)).toBeNull();
});
