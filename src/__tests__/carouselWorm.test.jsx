import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import CarouselWorm from '../components/menus/CarouselWorm.jsx';

vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: selector => selector({ wormCharacter: 'book', wormSkin: 'lava', wormHat: 'crown' }) }));
vi.mock('../3d/WormPreviewCanvas.jsx', () => ({ default: props => <span data-character={props.characterId} data-skin={props.skinId} data-hat={props.hatId} data-animated={props.animated} /> }));
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('shows the equipped worm and responds to a tap without launching a mode', () => {
  act(() => root.render(<CarouselWorm />));
  const preview = host.querySelector('[data-character]');
  expect(preview.dataset).toMatchObject({ character: 'book', skin: 'lava', hat: 'crown' });
  act(() => host.querySelector('button').click());
  expect(host.querySelector('.carousel-worm-jump').dataset.jumping).toBe('true');
  expect(host.textContent).not.toContain('Tap to hop');
  act(() => host.querySelector('.carousel-worm-jump').dispatchEvent(new Event('animationend', { bubbles: true })));
  expect(host.querySelector('.carousel-worm-jump').dataset.jumping).toBe('false');
});
it('acknowledges reduced-motion taps without animating, and disables interaction during launch', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  act(() => root.render(<CarouselWorm />));
  expect(host.querySelector('[data-animated]').dataset.animated).toBe('false');
  act(() => host.querySelector('button').click());
  expect(host.textContent).toContain('Hello!');
  expect(host.querySelector('.carousel-worm-jump').dataset.jumping).toBe('false');
  act(() => root.render(<CarouselWorm disabled />));
  expect(host.querySelector('button').disabled).toBe(true);
});
