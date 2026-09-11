import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import PuzzleOrbitControls from '../3d/PuzzleOrbitControls.jsx';

const harness = vi.hoisted(() => ({ frames: new Set(), updates: 0 }));
vi.mock('@react-three/drei', async () => {
  const React = await import('react');
  const Controls = React.forwardRef(function Controls({ enabled = true }, ref) {
    const instance = React.useRef({ enabled, target: {} });
    React.useImperativeHandle(ref, () => instance.current, []);
    // Match prop application: an imperative mutation is not repaired when the
    // next render still supplies the same enabled value.
    React.useLayoutEffect(() => { instance.current.enabled = enabled; }, [enabled]);
    React.useEffect(() => {
      const frame = () => { if (instance.current.enabled) harness.updates++; };
      harness.frames.add(frame);
      return () => harness.frames.delete(frame);
    }, []);
    return null;
  });
  return { TrackballControls: Controls };
});

let root, host, controlsRef;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  harness.frames.clear(); harness.updates = 0;
  host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host); controlsRef = createRef();
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const frame = () => { for (const fn of harness.frames) fn(); };
const render = (chaseActive, enabled) => act(() => root.render(
  <PuzzleOrbitControls chaseActive={chaseActive} enabled={enabled} controlsRef={controlsRef} />
));
it('reproduces why a mounted disabled controller can resume after pointer cleanup', () => {
  render(false, false);
  controlsRef.current.enabled = true; // existing pointer-up cleanup
  render(false, false); // unchanged React prop does not repair the mutation
  frame();
  expect(harness.updates).toBe(1);
});
it('removes the controller and its frame writer throughout chase mode', () => {
  render(false, true); frame();
  expect(harness.updates).toBe(1);
  const staleControls = controlsRef.current;
  render(true, false);
  expect(controlsRef.current).toBeNull();
  expect(harness.frames.size).toBe(0);
  staleControls.enabled = true;
  for (let i = 0; i < 120; i++) {
    if (controlsRef.current) controlsRef.current.enabled = true;
    frame();
  }
  expect(harness.updates).toBe(1);
  render(false, true);
  expect(controlsRef.current).not.toBe(staleControls);
  expect(harness.frames.size).toBe(1);
  frame();
  expect(harness.updates).toBe(2);
});
