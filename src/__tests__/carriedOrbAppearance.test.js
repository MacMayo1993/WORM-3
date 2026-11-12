import { expect, it } from 'vitest';
import { resetCarriedOrbCursor, advanceCarriedOrbCursor, carriedOrbAccentColor } from '../worm/carriedOrbAppearance.js';
import { BASE_TAIL_LENGTH } from '../worm/healerWorm/constants.js';

function read(segments) {
  const cursor = resetCarriedOrbCursor({});
  const colors = ['#ff0000', '#0000ff', '#ffff00'];
  return Array.from({ length: BASE_TAIL_LENGTH + segments.reduce((a, b) => a + b, 0) + 2 }, (_, i) => {
    const carried = advanceCarriedOrbCursor(cursor, i, colors, segments);
    return { face: carried ? cursor.index : -1, accent: cursor.accent, block: cursor.block };
  });
}

it('maps bonus growth and partial survivors to their actual pickup, not fixed trios', () => {
  const body = read([6, 1, 2]);
  expect(body.slice(0, BASE_TAIL_LENGTH).every(b => b.face === -1)).toBe(true);
  expect(body.slice(BASE_TAIL_LENGTH).map(b => b.face)).toEqual([0, 0, 0, 0, 0, 0, 1, 2, 2, -1, -1]);
  expect(body.flatMap((b, i) => b.accent ? [i - BASE_TAIL_LENGTH] : [])).toEqual([1, 4, 6, 8]);
  expect(body.flatMap((b, i) => b.block ? [i - BASE_TAIL_LENGTH] : [])).toEqual([2, 5, 6, 8]);
  expect(carriedOrbAccentColor(BASE_TAIL_LENGTH + 6, ['red', 'blue', 'yellow'], [6, 1, 2], 'skin')).toBe('blue');
  expect(carriedOrbAccentColor(BASE_TAIL_LENGTH + 8, ['red', 'blue', 'yellow'], [6, 1, 2], 'skin')).toBe('yellow');
});

it('retains the three-bead layout for demos and clears a reused cursor', () => {
  const cursor = resetCarriedOrbCursor({});
  advanceCarriedOrbCursor(cursor, BASE_TAIL_LENGTH + 4, ['red', 'blue']);
  expect(cursor.index).toBe(1);
  expect(cursor.accent).toBe(true);
  resetCarriedOrbCursor(cursor);
  expect(advanceCarriedOrbCursor(cursor, 0, [])).toBe(false);
  expect(cursor.accent).toBe(false);
});
