import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let images, preload;
beforeEach(async () => {
  vi.resetModules();
  images = [];
  vi.stubGlobal('Image', class {
    constructor() { images.push(this); }
    decode = vi.fn(() => Promise.resolve());
  });
  ({ preloadMobiPortrait: preload } = await import('../utils/preloadAssets.js'));
});
afterEach(() => vi.unstubAllGlobals());

it('shares the opening preload and waits for the portrait to decode', async () => {
  let decoded;
  const ready = vi.fn(), pending = preload();
  images[0].decode.mockImplementation(() => new Promise(resolve => { decoded = resolve; }));
  expect(preload()).toBe(pending);
  expect(images).toHaveLength(1);
  pending.then(ready);
  images[0].onload();
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  decoded();
  await pending;
  expect(ready).toHaveBeenCalledTimes(1);
});

it('waits for the PNG fallback when the WebP fails', async () => {
  const ready = vi.fn(), pending = preload();
  pending.then(ready);
  images[0].onerror(new Error('missing WebP'));
  await Promise.resolve();
  expect(images[1].src).toMatch(/Mobi\.png$/);
  expect(ready).not.toHaveBeenCalled();
  images[1].onload();
  await pending;
  expect(ready).toHaveBeenCalledTimes(1);
});

it('does not strand the level if both portrait formats fail', async () => {
  const pending = preload();
  images[0].onerror(new Error('missing WebP'));
  await Promise.resolve();
  images[1].onerror(new Error('missing PNG'));
  await expect(pending).resolves.toBeUndefined();
});
