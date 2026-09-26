import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// LayerHighlight draws GPU rims and useFrame needs a live R3F canvas — neither is
// what is under test. Record the props instead.
const rims = [];
vi.mock('../teach/LayerHighlight.jsx', () => ({
  default: (props) => { rims.push(props); return null; }
}));
// Capture the frame callback so the alpha ramp can be driven by hand.
let frameCb = null;
vi.mock('@react-three/fiber', () => ({ useFrame: (cb) => { frameCb = cb; } }));

import { SliceWarningLights } from '../worm/healerWorm/SliceWarningLights.jsx';
import { rotationClock, resetRotationClock } from '../worm/healerWorm/rotationClockBridge.js';

function renderWarning({ size, move, warning = 0 }) {
  rims.length = 0;
  frameCb = null;
  const pendingRotRef = { current: move };
  const warningProgressRef = { current: warning };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(
    <SliceWarningLights pendingRotRef={pendingRotRef} warningProgressRef={warningProgressRef} size={size} />
  ));
  // First frame mirrors the armed move into state, which triggers the real render.
  act(() => { frameCb?.({ clock: { elapsedTime: 0 } }); });
  return {
    get rims() { return rims.slice(); },
    setMove: (move) => {
      rims.length = 0;
      pendingRotRef.current = move;
      act(() => frameCb?.());
    },
    tick: (t) => act(() => { frameCb?.({ clock: { elapsedTime: t } }); }),
    unmount: () => { act(() => root.unmount()); host.remove(); }
  };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetRotationClock();
});
afterEach(() => {
  resetRotationClock();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe('rotation preview lighting', () => {
  it('lights only the upcoming rotation layer on every supported board size', () => {
    for (let size = 2; size <= 15; size++) for (const axis of ['col', 'row', 'depth']) {
      const move = { axis, sliceIndex: Math.floor(size / 2), dir: 1 };
      const h = renderWarning({ size, move });
      expect(h.rims).toHaveLength(1);
      expect(h.rims[0]).toMatchObject(move);
      h.unmount();
    }
  });

  it('lights both planes of a paired rotation, with their own turn directions', () => {
    const move = { axis: 'col', sliceIndex: 0, sliceIndices: [0, 4], sliceDirs: [1, -1], dir: 1 };
    const h = renderWarning({ size: 5, move });
    expect(h.rims.map(r => [r.axis, r.sliceIndex, r.dir])).toEqual([['col', 0, 1], ['col', 4, -1]]);
    h.unmount();
  });

  it('replaces the old preview when the next turn changes and clears it when disarmed', () => {
    const h = renderWarning({ size: 3, move: { axis: 'col', sliceIndex: 0, dir: 1 } });
    const next = { axis: 'depth', sliceIndex: 2, dir: -1 };
    h.setMove(next);
    expect(h.rims).toHaveLength(1);
    expect(h.rims[0]).toMatchObject(next);
    h.setMove(null);
    expect(h.rims).toHaveLength(0);
    h.unmount();
  });

  it('draws nothing when no rotation is armed', () => {
    const h = renderWarning({ size: 3, move: null });
    expect(h.rims).toHaveLength(0);
    h.unmount();
  });

  it('retains the final three-second warning flash and holds it steady when a turn is held', () => {
    const h = renderWarning({ size: 3, move: { axis: 'row', sliceIndex: 1, dir: 1 }, warning: 1 });
    const alpha = h.rims[0].opacityRef;
    Object.assign(rotationClock, { armed: true, held: false, secondsLeft: 4 });
    h.tick(0);
    const steady = alpha.current;
    rotationClock.secondsLeft = 3;
    h.tick(0);
    const bright = alpha.current;
    rotationClock.secondsLeft = 2.75;
    h.tick(0);
    expect(alpha.current).toBeGreaterThan(0);
    expect(alpha.current).toBeLessThan(steady);
    expect(bright).toBeGreaterThan(steady);
    rotationClock.held = true;
    h.tick(0);
    expect(alpha.current).toBeCloseTo(steady);
    h.unmount();
  });
});
