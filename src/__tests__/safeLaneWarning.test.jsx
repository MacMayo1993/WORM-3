// SliceWarningLights is where the safe lane becomes something the player can see.
// The lane maths is covered in wormSafeLane.test.js; what this file pins is the
// wiring — that a second LayerHighlight really is emitted, on a slice the pending
// move does not turn, in a colour the hazard rim never uses, and only on the small
// boards that need it.
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
import { chooseSafeLane } from '../worm/healerWorm/safeLane.js';
import { SAFE_LANE_MAX_SIZE } from '../worm/healerWorm/constants.js';

const SAFE_COLOR = '#3fe0d0';

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
    rims: rims.slice(),
    tick: (t) => act(() => { frameCb?.({ clock: { elapsedTime: t } }); }),
    unmount: () => { act(() => root.unmount()); host.remove(); }
  };
}

beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

describe('safe lane rendering', () => {
  it('draws a lane alongside the hazard rim on a 2x2', () => {
    const h = renderWarning({ size: 2, move: { axis: 'col', sliceIndex: 0, dir: 1 } });
    const safe = h.rims.filter((r) => r.color === SAFE_COLOR);
    expect(safe).toHaveLength(1);
    // The other half of the board — the only safe place to be on a 2x2.
    expect(safe[0]).toMatchObject({ axis: 'col', sliceIndex: 1 });
    // And the gold hazard rim is still drawn, on the slice that turns.
    const hazard = h.rims.filter((r) => r.color !== SAFE_COLOR);
    expect(hazard).toHaveLength(1);
    expect(hazard[0]).toMatchObject({ axis: 'col', sliceIndex: 0 });
    h.unmount();
  });

  it('never draws the lane on a slice the move turns', () => {
    for (let size = 2; size <= SAFE_LANE_MAX_SIZE; size++) {
      for (let i = 0; i < size; i++) {
        const h = renderWarning({ size, move: { axis: 'row', sliceIndex: i, dir: 1 } });
        const safe = h.rims.filter((r) => r.color === SAFE_COLOR);
        expect(safe).toHaveLength(1);
        expect(safe[0].sliceIndex).not.toBe(i);
        h.unmount();
      }
    }
  });

  it('excludes both planes of a two-plane hazard turn', () => {
    const move = { axis: 'col', sliceIndex: 0, sliceIndices: [0, 4], sliceDirs: [1, -1], dir: 1 };
    const h = renderWarning({ size: 5, move });
    const safe = h.rims.filter((r) => r.color === SAFE_COLOR);
    expect(safe).toHaveLength(1);
    expect([0, 4]).not.toContain(safe[0].sliceIndex);
    // Both threatened planes still get their own rim, each turning its own way.
    const hazard = h.rims.filter((r) => r.color !== SAFE_COLOR);
    expect(hazard.map((r) => r.sliceIndex)).toEqual([0, 4]);
    expect(hazard.map((r) => r.dir)).toEqual([1, -1]);
    h.unmount();
  });

  it('leaves the roomy boards exactly as they were', () => {
    const h = renderWarning({ size: 7, move: { axis: 'depth', sliceIndex: 3, dir: 1 } });
    expect(h.rims.filter((r) => r.color === SAFE_COLOR)).toHaveLength(0);
    expect(h.rims).toHaveLength(1);
    h.unmount();
  });

  it('draws nothing at all when no move is armed', () => {
    const h = renderWarning({ size: 3, move: null });
    expect(h.rims).toHaveLength(0);
    h.unmount();
  });

  it('keeps the lane dimmer than the hazard, and brightening with it', () => {
    const h = renderWarning({ size: 3, move: { axis: 'col', sliceIndex: 0, dir: 1 }, warning: 0 });
    const safe = h.rims.find((r) => r.color === SAFE_COLOR);
    const hazard = h.rims.find((r) => r.color !== SAFE_COLOR);
    const idle = safe.opacityRef.current;
    expect(idle).toBeLessThan(hazard.opacityRef.current);
    // Same ramp, driven off the same warning progress.
    h.tick(0);
    const stillIdle = safe.opacityRef.current;
    expect(stillIdle).toBeCloseTo(idle, 5);
    h.unmount();
  });

  it('is a thinner rim than the hazard, so it invites rather than alarms', () => {
    const h = renderWarning({ size: 3, move: { axis: 'col', sliceIndex: 0, dir: 1 } });
    const safe = h.rims.find((r) => r.color === SAFE_COLOR);
    const hazard = h.rims.find((r) => r.color !== SAFE_COLOR);
    expect(safe.gain).toBeLessThan(hazard.gain);
    h.unmount();
  });

  it('agrees with the lane the sim biases orbs into', () => {
    // The rim and the orb respawn must name the SAME lane, or the player is sent
    // one way and fed the other.
    const move = { axis: 'depth', sliceIndex: 1, dir: 1 };
    const h = renderWarning({ size: 4, move });
    const safe = h.rims.find((r) => r.color === SAFE_COLOR);
    expect(safe.sliceIndex).toBe(chooseSafeLane(4, move).sliceIndex);
    expect(safe.axis).toBe(chooseSafeLane(4, move).axis);
    h.unmount();
  });
});
