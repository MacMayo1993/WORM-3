import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Texture, EquirectangularReflectionMapping, LinearSRGBColorSpace } from 'three';
import SafeEnvironment from '../3d/SafeEnvironment.jsx';
import InteractivePhotoBackground from '../3d/InteractivePhotoBackground.jsx';
import useOptionalEnvironment from '../3d/useOptionalEnvironment.js';

const mocks = vi.hoisted(() => ({ hdr: vi.fn(), exr: vi.fn(), environment: vi.fn() }));
vi.mock('three-stdlib', () => ({
  RGBELoader: class { loadAsync(url) { return mocks.hdr(url); } },
  EXRLoader: class { loadAsync(url) { return mocks.exr(url); } },
}));
vi.mock('@react-three/drei', () => ({ Environment: props => { mocks.environment(props); return <span data-environment={props.map.uuid} />; } }));
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));

let host, root, errors, rejections, consoleError;
const flushRelease = () => new Promise(resolve => setTimeout(resolve, 5));
const render = node => act(async () => root.render(node));
const texture = () => { const map = new Texture(); vi.spyOn(map, 'dispose'); return map; };
function Probe({ id, files }) {
  const map = useOptionalEnvironment({ files });
  return <span id={id} data-map={map?.uuid ?? ''} />;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  errors = vi.fn(); rejections = vi.fn();
  window.addEventListener('error', errors);
  window.addEventListener('unhandledrejection', rejections);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); await flushRelease();
  window.removeEventListener('error', errors);
  window.removeEventListener('unhandledrejection', rejections);
  vi.restoreAllMocks(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('contains a failed city HDR for both reflections and panorama without a render or window error', async () => {
  mocks.hdr.mockRejectedValue(new TypeError('Failed to fetch'));
  await render(<><button>Play</button><SafeEnvironment preset="city" /><InteractivePhotoBackground preset="city" /></>);
  expect(host.textContent).toBe('Play');
  expect(mocks.hdr).toHaveBeenCalledTimes(1);
  expect(mocks.hdr.mock.calls[0][0]).toMatch(/\/potsdamer_platz_1k\.hdr$/);
  expect(mocks.environment).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(consoleError).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
  expect(rejections).not.toHaveBeenCalled();
});

it('keeps gameplay available while a map is pending and passes only the fulfilled map to drei', async () => {
  let complete;
  mocks.exr.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await render(<><button>Play</button><SafeEnvironment files="/local.exr" backgroundBlurriness={0.2} /></>);
  expect(host.textContent).toBe('Play');
  expect(mocks.environment).not.toHaveBeenCalled();
  const map = texture();
  await act(async () => complete(map));
  expect(mocks.environment).toHaveBeenLastCalledWith({ map, backgroundBlurriness: 0.2 });
  expect(map.mapping).toBe(EquirectangularReflectionMapping);
  expect(map.colorSpace).toBe(LinearSRGBColorSpace);
  expect(consoleError).not.toHaveBeenCalled();
});

it('shares a StrictMode request and disposes the texture only after its last consumer leaves', async () => {
  const map = texture(); mocks.exr.mockResolvedValue(map);
  await render(<StrictMode><Probe key="a" id="a" files="/shared.exr" /><Probe key="b" id="b" files="/shared.exr" /></StrictMode>);
  expect(mocks.exr).toHaveBeenCalledTimes(1);
  expect(host.querySelector('#a').dataset.map).toBe(map.uuid);
  expect(host.querySelector('#b').dataset.map).toBe(map.uuid);
  await render(<StrictMode><Probe key="b" id="b" files="/shared.exr" /></StrictMode>);
  await flushRelease();
  expect(map.dispose).not.toHaveBeenCalled();
  await render(null); await flushRelease();
  expect(map.dispose).toHaveBeenCalledTimes(1);
});

it('disposes late results instead of applying a stale panorama after switching away', async () => {
  const pending = new Map();
  mocks.exr.mockImplementation(url => new Promise(resolve => pending.set(url, resolve)));
  await render(<Probe id="sky" files="/old.exr" />);
  await render(<Probe id="sky" files="/new.exr" />);
  await flushRelease();
  const old = texture(), current = texture();
  await act(async () => { pending.get('/new.exr')(current); pending.get('/old.exr')(old); });
  expect(host.querySelector('#sky').dataset.map).toBe(current.uuid);
  expect(old.dispose).toHaveBeenCalledTimes(1);
  expect(current.dispose).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});

it('contains a failed local EXR and can load a newly selected environment', async () => {
  const map = texture();
  mocks.exr.mockRejectedValueOnce(new Error('Invalid EXR')).mockResolvedValueOnce(map);
  await render(<SafeEnvironment files="/broken.exr" />);
  expect(host.querySelector('[data-environment]')).toBeNull();
  await render(<SafeEnvironment files="/working.exr" />);
  expect(host.querySelector('[data-environment]').dataset.environment).toBe(map.uuid);
  expect(consoleError).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
  expect(rejections).not.toHaveBeenCalled();
});
