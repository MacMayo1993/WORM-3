// The first flip a player ever makes is held back for 800ms so the antipodal
// pair highlight can play before the tiles swap. That hand-off is re-entrant:
// the timer calls flipSticker again to actually perform the flip.
//
// `hasFlippedOnce` is only set true by the setState at the end of that second
// call, so the re-entrant call still observes it as false. If the interception
// keys on `hasFlippedOnce` alone it fires again, re-arms the timer, and loops —
// the very first flip of a fresh profile never lands, and because the highlight
// keeps redrawing it looks like a deliberate animation rather than a hang.

import { describe, it, expect } from 'vitest';
import { shouldInterceptFirstFlip } from '../hooks/useCubeState.js';

describe('shouldInterceptFirstFlip', () => {
  it('intercepts a brand-new player’s first flip', () => {
    expect(shouldInterceptFirstFlip(false, false, true)).toBe(true);
  });

  it('does NOT re-intercept the re-entrant call that performs that flip', () => {
    // hasFlippedOnce is still false here — this is the exact loop condition.
    expect(shouldInterceptFirstFlip(false, true, true)).toBe(false);
  });

  it('never intercepts once the player has flipped before', () => {
    expect(shouldInterceptFirstFlip(true, false, true)).toBe(false);
    expect(shouldInterceptFirstFlip(true, true, true)).toBe(false);
  });

  it('does not intercept a sticker with no antipodal partner', () => {
    expect(shouldInterceptFirstFlip(false, false, false)).toBe(false);
  });

  it('reaches a performing state in one hand-off, not a cycle', () => {
    // Model the real sequence: tap → intercept → timer → perform.
    let intercepted = false;
    const hasFlippedOnce = false;
    let hops = 0;
    while (shouldInterceptFirstFlip(hasFlippedOnce, intercepted, true)) {
      intercepted = true;
      if (++hops > 5) break; // guard so a regression fails instead of hanging
    }
    expect(hops).toBe(1);
  });
});
