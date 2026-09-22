import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormSwipeControls from '../worm/WormSwipeControls.jsx';
import CaptureController from '../components/capture/CaptureController.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
let root, host, turn;
const finger = (x = 10, y = 10, id = 1) => ({ clientX: x, clientY: y, identifier: id });
const touch = (type, touches, changedTouches = touches) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, { touches: { value: touches }, changedTouches: { value: changedTouches } });
  act(() => window.dispatchEvent(e));
};
beforeEach(() => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ captureMode: true, wormHealerMode: true, wormControlMode: 'non-oriented' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); turn = vi.fn();
  act(() => root.render(<><CaptureController /><WormSwipeControls onTurn={turn} worm={{}} /></>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('keeps taps for jumps, swipes for turns and up-swipes for boosts', () => {
  touch('touchstart', [finger()]); touch('touchend', [], [finger()]);
  expect(turn).toHaveBeenLastCalledWith('jump');
  touch('touchstart', [finger()]); touch('touchend', [], [finger(50)]);
  expect(turn).toHaveBeenLastCalledWith('right');
  touch('touchstart', [finger(10, 70)]); touch('touchend', [], [finger()]);
  expect(turn).toHaveBeenLastCalledWith('boost');
});
it('supports hold-to-fire and stops on release without jumping', () => {
  touch('touchstart', [finger()]); act(() => vi.advanceTimersByTime(350));
  expect(turn).toHaveBeenLastCalledWith('fire-start');
  touch('touchend', [], [finger()]); expect(turn).toHaveBeenLastCalledWith('fire-stop');
  expect(turn).not.toHaveBeenCalledWith('jump');
});
it('cancels pending fire when swiping or using the two-finger exit', () => {
  touch('touchstart', [finger()]); touch('touchmove', [finger(70)]);
  act(() => vi.advanceTimersByTime(350)); expect(turn).not.toHaveBeenCalledWith('fire-start');
  touch('touchend', [], [finger(70)]); turn.mockClear();
  touch('touchstart', [finger()]); touch('touchstart', [finger(), finger(60, 10, 2)]);
  act(() => vi.advanceTimersByTime(1000));
  touch('touchend', [], [finger(), finger(60, 10, 2)]);
  expect(useGameStore.getState().captureMode).toBe(false);
  expect(turn).not.toHaveBeenCalledWith('fire-start'); expect(turn).not.toHaveBeenCalledWith('jump');
});
it('does not turn ordinary HUD taps into capture jumps', () => {
  act(() => useGameStore.getState().setCaptureMode(false));
  touch('touchstart', [finger()]); touch('touchend', [], [finger()]);
  expect(turn).not.toHaveBeenCalledWith('jump');
});
