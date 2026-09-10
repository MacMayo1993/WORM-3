import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { WORM_CHARACTERS } from '../worm/wormCharacterData.js';
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
it('shows every character and only makes the tapped worm hop', () => {
  act(() => root.render(<CarouselWorm />));
  expect([...host.querySelectorAll('[data-character]')].map(p => p.dataset.character)).toEqual(WORM_CHARACTERS.map(c => c.id));
  const preview = host.querySelector('[data-character=book]');
  expect(preview.dataset).toMatchObject({ character: 'book', skin: 'lava', hat: 'crown' });
  const button = preview.closest('button');
  act(() => button.click());
  expect(host.querySelectorAll('[data-jumping=true].carousel-worm-jump')).toHaveLength(1);
  expect(button.querySelector('.carousel-worm-jump').dataset.jumping).toBe('true');
  expect(host.textContent).not.toContain('Tap a worm to hop');
  act(() => button.querySelector('.carousel-worm-jump').dispatchEvent(new Event('animationend', { bubbles: true })));
  expect(button.querySelector('.carousel-worm-jump').dataset.jumping).toBe('false');
});
it('acknowledges reduced-motion taps without animating, and disables interaction during launch', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  act(() => root.render(<CarouselWorm />));
  expect([...host.querySelectorAll('[data-animated]')].every(p => p.dataset.animated === 'false')).toBe(true);
  act(() => host.querySelector('button').click());
  expect(host.textContent).toContain('Hello!');
  expect(host.querySelector('.carousel-worm-jump').dataset.jumping).toBe('false');
  act(() => root.render(<CarouselWorm disabled />));
  expect([...host.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
});
