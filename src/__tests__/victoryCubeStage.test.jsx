import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import VictoryCubeStage from '../worm/story/VictoryCubeStage.jsx';
import { victoryView, victoryViewport, VICTORY_PITCH } from '../worm/story/victoryFrame.js';

let host, root, stage;
function pointer(type, id, x, y) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0, pointerType: 'touch' });
  act(() => stage.dispatchEvent(event));
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 300, height: 250 });
  act(() => root.render(<VictoryCubeStage />));
  stage = host.querySelector('[role="group"]');
  stage.setPointerCapture = vi.fn();
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('rotates with one finger, pinches both directions, and rebases when a finger lifts', () => {
  pointer('pointerdown', 1, 100, 100);
  pointer('pointermove', 1, 130, 120);
  expect(victoryView.yaw).toBeCloseTo(-.24);
  expect(victoryView.pitch).toBeGreaterThan(VICTORY_PITCH);
  expect(stage.setPointerCapture).toHaveBeenCalledWith(1);
  pointer('pointerdown', 2, 230, 120);
  pointer('pointermove', 2, 330, 120);
  expect(victoryView.zoom).toBeCloseTo(.5);
  pointer('pointermove', 2, 230, 120);
  expect(victoryView.zoom).toBeCloseTo(1);
  pointer('pointerup', 2, 230, 120);
  const yaw = victoryView.yaw;
  pointer('pointermove', 1, 140, 120);
  expect(victoryView.yaw).toBeCloseTo(yaw - .08);
  expect(victoryView.zoom).toBe(1);
  pointer('pointercancel', 1, 140, 120);
  const snapshot = { ...victoryView };
  pointer('pointermove', 1, 400, 400);
  expect(victoryView).toEqual(snapshot);
});
it('bounds zoom and pitch, resets the view, and clears all state on exit', () => {
  pointer('pointerdown', 1, 100, 100);
  pointer('pointermove', 1, 100, 10000);
  expect(victoryView.pitch).toBe(1.35);
  act(() => stage.dispatchEvent(new WheelEvent('wheel', { deltaY: 999999, bubbles: true, cancelable: true })));
  expect(victoryView.zoom).toBe(1.8);
  act(() => host.querySelector('button').click());
  expect(victoryView).toEqual({ yaw: 0, pitch: VICTORY_PITCH, zoom: 1, manual: false });
  expect(victoryViewport.current.width).toBeCloseTo(300 / window.innerWidth);
  act(() => stage.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true })));
  expect(victoryView.zoom).toBeCloseTo(.9);
  act(() => root.render(null));
  expect(victoryViewport.current).toBeNull();
  expect(victoryView.zoom).toBe(1);
  expect(victoryView.manual).toBe(false);
});
it('keeps victory touch gestures from reaching gameplay swipe controls', () => {
  const gameplay = vi.fn(); window.addEventListener('touchend', gameplay);
  act(() => stage.dispatchEvent(new Event('touchend', { bubbles: true })));
  expect(gameplay).not.toHaveBeenCalled();
  window.removeEventListener('touchend', gameplay);
});
