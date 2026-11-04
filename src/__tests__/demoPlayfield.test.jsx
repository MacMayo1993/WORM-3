import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
const mock = vi.hoisted(() => ({
  camera: { setViewOffset: vi.fn(), clearViewOffset: vi.fn(), updateProjectionMatrix: vi.fn() },
  size: { width: 390, height: 760 },
}));
vi.mock('@react-three/fiber', () => ({ useThree: () => mock }));
import useDemoPlayfield, { demoPlayfieldOffset } from '../worm/useDemoPlayfield.js';
function Probe() { useDemoPlayfield(); return null; }
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({demoMode:true,demoStep:'worm-traversal'});
});
afterEach(() => { act(()=>root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('centers the aim between the measured top lesson and bottom controls', () => {
  expect(demoPlayfieldOffset(760, 260, 650)).toBe(-75);
  expect(demoPlayfieldOffset(375, 150, 300)).toBe(-37);
  expect(demoPlayfieldOffset(760)).toBe(0);
});
it('follows lazy HUD and scene height changes, then restores the shared camera on exit', () => {
  let top = 260;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('worm-hud-top') ? {bottom:top} : {top:650};
  });
  act(()=>root.render(<><div className="worm-hud-top"/><div className="worm-hud-bottom"/><Probe/></>));
  expect(mock.camera.setViewOffset).toHaveBeenLastCalledWith(390,760,0,-75,390,760);
  top = 300; act(()=>vi.advanceTimersByTime(250));
  expect(mock.camera.setViewOffset).toHaveBeenLastCalledWith(390,760,0,-95,390,760);
  act(()=>useGameStore.setState({demoMode:false}));
  expect(mock.camera.clearViewOffset).toHaveBeenCalled();
  const calls = mock.camera.setViewOffset.mock.calls.length;
  act(()=>vi.advanceTimersByTime(1000));
  expect(mock.camera.setViewOffset).toHaveBeenCalledTimes(calls);
});
