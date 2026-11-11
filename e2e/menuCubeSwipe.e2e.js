import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Real R3F raycasting, native touch capture and compatibility clicks. The
// production gesture controller is wired to a small cube so input regression
// coverage does not depend on the menu's fonts, backgrounds or idle animations.
const bundle = await build({ bundle: true, write: false, format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' }, stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
import React, { useState, useRef } from 'react';
import { createRoot, events, extend, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createMenuCubeSwipe } from './src/components/menus/menuCubeSwipe.js';
extend(THREE);
const canvas = document.createElement('canvas');
canvas.style.touchAction = 'none'; document.body.append(canvas);
const stats = window.swipeStats = { taps: 0, presses: 0, releases: 0, reduced: false, allowed: true, q: [0,0,0,1], active: false, frames: 0 };
function Cube() {
  const camera = useThree(state => state.camera), ref = useRef();
  const [swipe] = useState(() => createMenuCubeSwipe({ camera: () => camera, span: () => 390,
    canInteract: () => stats.allowed, reducedMotion: () => stats.reduced,
    onTap: () => { stats.taps++; }, onPress: () => { stats.presses++; }, onRelease: () => { stats.releases++; } }));
  useFrame((_, dt) => {
    swipe.step(dt); ref.current.quaternion.copy(swipe.offset);
    stats.q = swipe.offset.toArray(); stats.active = swipe.active; stats.frames++;
  });
  return React.createElement('group', { ref, ...swipe.handlers },
    React.createElement('mesh', null, React.createElement('boxGeometry', { args: [2,2,2] }),
      ...['#ff715b','#f0b94b','#79d145','#458fdf','#e7f3d6','#af70df'].map((color,i) =>
        React.createElement('meshBasicMaterial', { key:i, attach:'material-'+i, color }))));
}
createRoot(canvas).configure({ events, size: { width: 390, height: 640 }, dpr: 1,
  camera: { position: [0,0,5], fov: 50 }, gl: { antialias: true } }).render(React.createElement(Cube));
` }
});

test('mobile cube swipes follow all four directions and preserve taps @phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mobile cube swipe</title><style>body{margin:0;background:#263c30}canvas{display:block;touch-action:none}</style>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect.poll(() => page.evaluate(() => window.swipeStats?.frames ?? 0)).toBeGreaterThan(2);
  const touch = await page.context().newCDPSession(page);
  const send = async (type, x = 195, y = 320) => {
    await touch.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel'
      ? [] : [{ x, y, id: 1 }] });
  };
  const snapshot = () => page.evaluate(() => ({ ...window.swipeStats }));
  const relative = (a, b) => {
    // b * inverse(a), using quaternion vector and scalar components.
    const [x,y,z,w] = b, [i,j,k,r] = [-a[0],-a[1],-a[2],a[3]];
    return [w*i+x*r+y*k-z*j, w*j-x*k+y*r+z*i, w*k+x*j-y*i+z*r, w*r-x*i-y*j-z*k];
  };
  for (const [dx,dy,axis,sign] of [[90,0,1,1],[-90,0,1,-1],[0,-90,0,-1],[0,90,0,1]]) {
    await send('touchStart');
    const before = await snapshot();
    await send('touchMove',195+dx/2,320+dy/2);
    await send('touchMove',195+dx,320+dy);
    await expect.poll(async () => relative(before.q,(await snapshot()).q)[axis]*sign).toBeGreaterThan(.2);
    await send('touchEnd');
    await expect.poll(async () => (await snapshot()).active).toBe(false);
    expect((await snapshot()).taps).toBe(0);
  }
  // Returning to the starting pixel is still a drag, not a tap/flip.
  await send('touchStart'); await send('touchMove',300,320); await send('touchMove',195,320); await send('touchEnd');
  await expect.poll(async () => (await snapshot()).active).toBe(false);
  expect((await snapshot()).taps).toBe(0);
  await send('touchStart'); await send('touchEnd');
  await expect.poll(async () => (await snapshot()).taps).toBe(1);
  // A swipe can leave the mesh and still release cleanly via native capture.
  await send('touchStart'); await send('touchMove',388,100); await send('touchEnd');
  await expect.poll(async () => (await snapshot()).active).toBe(false);
  expect((await snapshot()).taps).toBe(1);
  await send('touchStart'); await send('touchCancel');
  await expect.poll(async () => (await snapshot()).active).toBe(false);
  expect((await snapshot()).taps).toBe(1);
  await page.evaluate(() => { window.swipeStats.reduced = true; });
  await send('touchStart'); await send('touchMove',270,320); await send('touchEnd');
  await expect.poll(async () => (await snapshot()).active).toBe(false);
  const stopped = await snapshot();
  await expect.poll(async () => (await snapshot()).frames).toBeGreaterThan(stopped.frames + 2);
  expect((await snapshot()).q).toEqual(stopped.q);
  await send('touchStart'); await send('touchEnd');
  await expect.poll(async () => (await snapshot()).taps).toBe(2);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('mobile-cube-after-swipes.png') });
});
