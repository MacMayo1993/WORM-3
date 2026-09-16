import { describe, it, expect, vi } from 'vitest';
import { createWormFeedback, WORM_HAPTICS } from '../worm/wormFeedback.js';

function setup() {
  const dispatch = vi.fn(), stop = vi.fn();
  return { dispatch, stop, feedback: createWormFeedback(dispatch, stop) };
}
describe('WORM feedback arbitration', () => {
  it('coalesces a magnet sweep without losing the next pickup', () => {
    const { feedback, dispatch } = setup();
    for (let i = 0; i < 30; i++) feedback.emit('orb', { combo: i });
    expect(dispatch).toHaveBeenCalledTimes(1);
    feedback.advance(.05); feedback.advance(.03);
    feedback.emit('orb', { combo: 6 });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1][1].combo).toBe(6);
  });
  it('lets a hit override a shot but never lets fire truncate a heal', () => {
    const { feedback, dispatch } = setup();
    feedback.emit('shot'); feedback.emit('shotHit'); feedback.emit('heal');
    feedback.advance(.05); feedback.emit('shot');
    expect(dispatch.mock.calls.map(call => call[1].haptics)).toEqual([true, true, true, false]);
    for (let i = 0; i < 8; i++) feedback.advance(.05);
    feedback.emit('shot');
    expect(dispatch.mock.lastCall[1].haptics).toBe(true);
  });
  it('times tunnel cues to phase and progress, without per-frame buzzes or resume bursts', () => {
    const { feedback, dispatch, stop } = setup();
    feedback.tunnel('entering', 0);
    for (let i = 0; i < 15; i++) { feedback.advance(.05); feedback.tunnel('entering', i / 15); }
    feedback.tunnel('tunnel', 0);
    feedback.hold(true);
    for (let i = 0; i < 100; i++) { feedback.advance(1); feedback.tunnel('tunnel', 0); }
    feedback.emit('shot');
    expect(stop).toHaveBeenCalledTimes(1);
    feedback.hold(false); feedback.tunnel('tunnel', 0);
    feedback.advance(.05); feedback.tunnel('tunnel', .4);
    feedback.advance(.05); feedback.tunnel('tunnel', .8);
    feedback.advance(.05); feedback.tunnel('exiting', 0);
    expect(dispatch.mock.calls.map(call => call[0])).toEqual(['tunnelRush', 'tunnelFold', 'tunnelFold', 'tunnelFold', 'tunnelRelease']);
  });
  it('cancels old sensations on death/reset and permits a fresh run', () => {
    const { feedback, dispatch, stop } = setup();
    feedback.emit('dive'); feedback.emit('death');
    expect(stop).toHaveBeenCalledTimes(1);
    feedback.tunnel('tunnel', .5, false);
    expect(dispatch).toHaveBeenCalledTimes(2);
    feedback.reset(); feedback.emit('dive');
    expect(stop).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.lastCall[1].haptics).toBe(true);
  });
  it('uses finite buzz-first patterns with bounded duration', () => {
    for (const value of Object.values(WORM_HAPTICS)) {
      for (const combo of [0, 6, 100, NaN, -10]) {
        const p = typeof value === 'function' ? value(combo) : value;
        const pattern = Array.isArray(p) ? p : [p];
        expect(pattern[0]).toBeGreaterThan(0);
        expect(pattern.every(n => Number.isFinite(n) && n >= 0)).toBe(true);
        expect(pattern.reduce((a, b) => a + b, 0)).toBeLessThan(350);
      }
    }
  });
});
