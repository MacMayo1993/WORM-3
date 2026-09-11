import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import CarouselWorm from '../components/menus/CarouselWorm.jsx';

vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: selector => selector({ wormCharacter: 'book', wormSkin: 'lava', wormHat: 'crown' }) }));
const previewProps = vi.hoisted(() => ({ current: null }));
vi.mock('../3d/WormPreviewCanvas.jsx', () => ({ default: props => {
  previewProps.current = props;
  return <canvas data-character={props.characterId} data-skin={props.skinId} data-hat={props.hatId} data-animated={props.animated} />;
} }));
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('always shows Glow Worm and accepts a follow request', () => {
  act(() => root.render(<CarouselWorm />));
  expect(host.querySelector('[data-character]').dataset).toMatchObject({ character: 'glow', skin: 'slime', hat: 'none' });
  act(() => host.querySelector('button').click());
  expect(host.textContent).not.toContain('Tap a spot');
  expect(previewProps.current.companion.target).toEqual({ x: 0, z: 0 });
  host.querySelector('canvas').getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 400 });
  act(() => host.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 290, clientY: 240 })));
  expect(previewProps.current.companion.target.x).toBeCloseTo(0.36);
  expect(previewProps.current.companion.target.z).toBeCloseTo(0.09 * Math.SQRT2);
});
it('acknowledges reduced-motion taps without animating, and disables interaction during launch', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  act(() => root.render(<CarouselWorm />));
  expect(host.querySelector('[data-animated]').dataset.animated).toBe('false');
  act(() => host.querySelector('button').click());
  expect(host.textContent).toContain('Hello!');
  expect(previewProps.current.companion.target).toEqual({ x: 0.52, z: 0.24 });
  act(() => root.render(<CarouselWorm disabled />));
  expect(host.querySelector('button').disabled).toBe(true);
});
