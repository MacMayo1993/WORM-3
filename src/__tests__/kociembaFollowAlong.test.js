// Follow-along rules for the Kociemba solver panel: when the player performs the
// move the panel is previewing, the plan must be kept and advanced rather than
// recomputed. Re-solving there would replace the whole maneuver with an
// unrelated one and reset the progress markers to zero — the panel would read as
// though it had ignored the player's turn.

import { describe, it, expect } from 'vitest';
import { classifyTurn } from '../teach/useKociembaSolver.js';

const move = (axis, sliceIndex, dir, numTurns) => ({ axis, sliceIndex, dir, numTurns });

describe('classifyTurn', () => {
  it('advances the plan when the previewed quarter turn is performed', () => {
    const expected = move('row', 2, 1, 1);
    const result = classifyTurn(move('row', 2, 1, 1), expected, 1);
    expect(result.verdict).toBe('done');
    expect(result.turnsLeft).toBe(0);
  });

  it('treats a turn of a different layer as stale', () => {
    const expected = move('row', 2, 1, 1);
    expect(classifyTurn(move('row', 0, 1, 1), expected, 1).verdict).toBe('other');
    expect(classifyTurn(move('col', 2, 1, 1), expected, 1).verdict).toBe('other');
  });

  it('treats the same layer turned the other way as stale', () => {
    const expected = move('row', 2, 1, 1);
    expect(classifyTurn(move('row', 2, -1, 1), expected, 1).verdict).toBe('other');
  });

  it('holds position when a double turn is only half performed', () => {
    const expected = move('row', 2, 1, 2); // F2-style
    const first = classifyTurn(move('row', 2, 1, 1), expected, 2);
    expect(first.verdict).toBe('partial');
    expect(first.turnsLeft).toBe(1);

    // The second drag completes it.
    const second = classifyTurn(move('row', 2, 1, 1), expected, first.turnsLeft);
    expect(second.verdict).toBe('done');
    expect(second.turnsLeft).toBe(0);
  });

  it('accepts a double turn performed in one go', () => {
    const expected = move('row', 2, 1, 2);
    expect(classifyTurn(move('row', 2, 1, 2), expected, 2).verdict).toBe('done');
  });

  it('treats overshooting the previewed move as stale', () => {
    const expected = move('row', 2, 1, 1);
    expect(classifyTurn(move('row', 2, 1, 2), expected, 1).verdict).toBe('other');
  });

  it('defaults a missing numTurns to a single quarter turn', () => {
    const expected = { axis: 'depth', sliceIndex: 1, dir: -1 };
    expect(classifyTurn({ axis: 'depth', sliceIndex: 1, dir: -1 }, expected, 1).verdict).toBe('done');
  });

  it('is inert with nothing previewed or nothing turned', () => {
    expect(classifyTurn(null, move('row', 0, 1, 1), 1).verdict).toBe('other');
    expect(classifyTurn(move('row', 0, 1, 1), null, 1).verdict).toBe('other');
  });

  it('follows a whole-cube reorientation one highlighted slice at a time', () => {
    // reorientToHome emits a whole-cube turn as `size` separate slice moves that
    // share a notation. Each is individually performable, so a player following
    // the highlight walks through them without the plan being thrown away.
    const reorient = [move('row', 0, 1, 1), move('row', 1, 1, 1), move('row', 2, 1, 1)];
    for (const step of reorient) {
      expect(classifyTurn(step, step, 1).verdict).toBe('done');
    }
  });
});
