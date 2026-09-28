import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Color, Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { antipodalViewport } from '../3d/antipodalViewport.js';
const hook = vi.hoisted(() => ({ frame: null }));
vi.mock('@react-three/fiber', () => ({ useFrame: fn => { hook.frame = fn; } }));
import AntipodalPiP from '../3d/AntipodalPiP.jsx';
let root, host, frame, gl, main, color, alpha;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ size: 3, wormHealerMode: false, explosionT: 0, showWelcome: false, showMainMenu: false, showSettings: false, showHelp: false, captureMode: false });
  Object.assign(antipodalViewport, { rect: { x: 530, y: 100, width: 180, height: 135 }, canvas: { x: 30, y: 20, width: 800, height: 600 }, cube: null });
  const scene = new Scene(), cube = new Group(); cube.name = 'game-cube'; scene.add(cube); scene.updateMatrixWorld();
  main = new PerspectiveCamera(70, 4 / 3, 0.01, 100); main.position.set(0, 0, 10); main.updateMatrixWorld();
  color = new Color('#123456'); alpha = 0.4;
  gl = { domElement: { width: 1600, height: 1200 }, getPixelRatio: () => 2, autoClear: true,
    setViewport: vi.fn(), setScissor: vi.fn(), setScissorTest: vi.fn(), clear: vi.fn(), render: vi.fn(),
    getClearColor: out => out.copy(color), getClearAlpha: () => alpha,
    setClearColor: (value, a) => { color.set(value); alpha = a; } };
  frame = { gl, scene, camera: main, clock: { elapsedTime: 1 } };
  host = document.createElement('div'); root = createRoot(host); act(() => root.render(<AntipodalPiP />));
});
afterEach(() => { act(() => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('keeps the main render alive while the panel is folded', () => {
  antipodalViewport.rect = null; hook.frame(frame);
  expect(gl.render).toHaveBeenCalledExactlyOnceWith(frame.scene, main);
});
it.each(['captureMode', 'showSettings', 'showHelp'])('suppresses the inset during %s', key => {
  useGameStore.setState({ [key]: true }); hook.frame(frame); expect(gl.render).toHaveBeenCalledTimes(1);
});
it('uses the exact antipode, fits the whole cube, and restores render state after the CSS-sized inset', () => {
  hook.frame(frame);
  expect(gl.render).toHaveBeenCalledTimes(2);
  const camera = gl.render.mock.calls[1][1];
  expect(camera.position.distanceTo(new Vector3(0, 0, -10))).toBe(0);
  let extent = 0;
  for (let i = 0; i < 8; i++) {
    const p = new Vector3(i & 1 ? 1.65 : -1.65, i & 2 ? 1.65 : -1.65, i & 4 ? 1.65 : -1.65).project(camera);
    extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
  }
  expect(extent).toBeGreaterThan(0.8); expect(extent).toBeLessThan(0.95);
  expect(gl.setScissor).toHaveBeenCalledWith(500, 385, 180, 135);
  expect(gl.clear).toHaveBeenCalledWith(true, true, true);
  expect(color.getHexString()).toBe('123456'); expect(alpha).toBe(0.4);
  expect(gl.setViewport).toHaveBeenLastCalledWith(0, 0, 800, 600);
  expect(gl.setScissorTest).toHaveBeenLastCalledWith(false); expect(gl.autoClear).toBe(true);
});
it('restores the full viewport even if the second render throws', () => {
  gl.render.mockImplementation((scene, camera) => { if (camera !== main) throw Error('render failure'); });
  expect(() => hook.frame(frame)).toThrow('render failure');
  expect(gl.setViewport).toHaveBeenLastCalledWith(0, 0, 800, 600);
  expect(gl.setScissorTest).toHaveBeenLastCalledWith(false); expect(gl.autoClear).toBe(true);
  expect(color.getHexString()).toBe('123456'); expect(alpha).toBe(0.4);
});
