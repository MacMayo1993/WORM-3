import { expect, it } from 'vitest';
import { antipodalScissor, overlapArea, placeAntipodalPanel } from '../3d/antipodalViewport.js';
const rect = (x, y, width, height) => ({ x, y, width, height });

// Where no open spot clears the cube (the two phones) the window stays open over
// as little of it as it can rather than folding; it folds itself only where the
// text leaves no open spot at all (the short landscape screen).
it.each([[1440, 900, 'clear'], [390, 844, 'over'], [320, 640, 'over'], [844, 390, 'folded']])('avoids text, and the central cube where it can, at %s×%s', (width, height, expected) => {
  const obstacles = [rect(0, 0, width, 64), rect(0, height - 90, width, 90), rect(20, 80, width - 40, 120)];
  const cube = rect(width * 0.22, height * 0.36, width * 0.56, height * 0.36);
  const panel = placeAntipodalPanel({ width, height, obstacles, cube });
  expect(panel).not.toBeNull();
  expect(panel.compact).toBe(expected === 'folded');
  for (const item of obstacles) expect(overlapArea(panel, item)).toBe(0);
  if (expected === 'clear') expect(overlapArea(panel, cube)).toBe(0);
  if (expected === 'over') expect(overlapArea(panel, cube)).toBeLessThan(panel.width * panel.height / 2);
  expect(panel.x).toBeGreaterThanOrEqual(10); expect(panel.y).toBeGreaterThanOrEqual(10);
  expect(panel.x + panel.width).toBeLessThanOrEqual(width - 10);
  expect(panel.y + panel.height).toBeLessThanOrEqual(height - 10);
});
it('stays open when the cube fills the screen: only the player folds it', () => {
  const args = { width: 390, height: 600, cube: rect(0, 0, 390, 600), obstacles: [rect(0, 0, 390, 60)] };
  expect(placeAntipodalPanel(args).compact).toBe(false);
  expect(placeAntipodalPanel({ ...args, compact: true }).compact).toBe(true);
});
it('holds an open window still while the camera moves the cube under it', () => {
  const args = { width: 1000, height: 800, obstacles: [rect(0, 0, 1000, 60)] };
  let previous = placeAntipodalPanel({ ...args, cube: rect(350, 250, 300, 300) });
  const first = previous;
  // The chase camera sweeps the cube across every corner, a quarter-second apart.
  for (const cube of [rect(600, 60, 400, 400), rect(0, 60, 1000, 740), rect(0, 400, 500, 400), rect(500, 400, 500, 400)]) {
    previous = placeAntipodalPanel({ ...args, cube, previous });
    expect(previous).toBe(first);
  }
  // Text that lands on it moves it, but never folds it while an open spot fits.
  const toast = rect(first.x - 20, first.y - 10, first.width + 40, first.height + 20);
  const moved = placeAntipodalPanel({ ...args, obstacles: [...args.obstacles, toast], cube: rect(0, 60, 1000, 740), previous });
  expect(moved.compact).toBe(false);
  expect(overlapArea(moved, toast)).toBe(0);
  // And when the text goes, it stays where it went instead of snapping back.
  expect(placeAntipodalPanel({ ...args, cube: rect(0, 60, 1000, 740), previous: moved })).toBe(moved);
});
it('keeps a valid position stable, moves corners on request, and respects safe areas', () => {
  const args = { width: 1000, height: 800, insets: { top: 30, right: 20, bottom: 25, left: 10 } };
  const first = placeAntipodalPanel(args);
  expect(first.y).toBe(40); expect(first.x + first.width).toBe(970);
  expect(placeAntipodalPanel({ ...args, previous: first })).toEqual(first);
  const moved = placeAntipodalPanel({ ...args, corner: 2 });
  expect(moved.x).toBe(20); expect(moved.y + moved.height).toBe(765);
});
it('moves around growing lesson text and hides if a dialog leaves no room even for a tab', () => {
  const args = { width: 390, height: 844, obstacles: [rect(0, 0, 390, 80)] };
  const first = placeAntipodalPanel(args);
  const lesson = rect(10, 86, 370, 420);
  const next = placeAntipodalPanel({ ...args, obstacles: [...args.obstacles, lesson], previous: first });
  expect(overlapArea(next, lesson)).toBe(0);
  expect(next.y).toBeGreaterThan(first.y);
  expect(placeAntipodalPanel({ ...args, obstacles: [rect(0, 0, 390, 844)] })).toBeNull();
});
it('aligns an offset DOM window with the CSS-pixel scissor without double-applying DPR', () => {
  expect(antipodalScissor(rect(230, 100, 180, 135), rect(30, 20, 800, 600), 800, 600))
    .toEqual(rect(200, 385, 180, 135));
  expect(antipodalScissor(null, rect(0, 0, 800, 600), 800, 600)).toBeNull();
  expect(antipodalScissor(rect(-10, 0, 10, 20), rect(0, 0, 800, 600), 800, 600)).toBeNull();
  expect(antipodalScissor(rect(0, 0, 0, 0), rect(0, 0, 800, 600), 800, 600)).toBeNull();
});
