import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
vi.mock('../components/screens/wizardSteps/CubePlate.jsx', () => ({ default: ({ title, subtitle, cube, onPrev, onNext }) =>
  <div data-preview="cube" data-color={cube.colors[1]}><h2>{title}</h2><p>{subtitle}</p>
    <button onClick={onPrev}>Previous palette</button><button onClick={onNext}>Next palette</button></div> }));
vi.mock('../components/screens/wizardSteps/shared.jsx', async importOriginal => ({
  ...await importOriginal(),
  WIZARD_SCHEME_KEYS: ['standard', 'neon', 'pastel'], Checkmark: () => <i />, LockPip: () => <i />,
  sizeTier: () => ({ name: 'Classic' }), bgOptionFor: () => null,
}));
import PaletteStep from '../components/screens/wizardSteps/PaletteStep.jsx';
let host, root, cos;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  cos = { settings: { colorScheme: 'standard', tileStyle: 'solid' }, select: vi.fn(), cubeSize: 3,
    colors: COLOR_SCHEMES.standard, accent: '#ffaa55', accentShadow: '#775533', ownedItems: ['scheme_neon'], openImagePicker: vi.fn() };
  act(() => root.render(<PaletteStep cos={cos} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label || b.getAttribute('aria-label') === label);
it('selects owned palettes and keeps locked swatches colored without allowing purchase bypass', () => {
  act(() => button('Neon').click());
  expect(cos.select).toHaveBeenCalledWith('colorScheme', 'neon');
  const locked = button('Pastel, available in the store');
  expect(locked.disabled).toBe(true);
  expect(locked.querySelector('.palette-card-colors span').style.background).not.toBe('');
  act(() => locked.click());
  expect(cos.select).toHaveBeenCalledTimes(1);
});
it('filters families, gives an empty state for unowned families, and preserves photo upload', () => {
  act(() => button('Soft').click());
  expect(host.querySelectorAll('.palette-card')).toHaveLength(1);
  act(() => host.querySelector('input').click());
  expect(host.querySelectorAll('.palette-card')).toHaveLength(0);
  expect(host.textContent).toContain('No owned palettes');
  act(() => host.querySelector('.palette-upload').click());
  expect(cos.openImagePicker).toHaveBeenCalledTimes(1);
});
it('keeps antipodal face labels paired and marks the selected palette', () => {
  expect([...host.querySelectorAll('.palette-current .palette-pair')].map(p => p.textContent)).toEqual(['FrontBack', 'LeftRight', 'TopBottom']);
  expect(button('Standard').getAttribute('aria-pressed')).toBe('true');
});

it('keeps separate hero and body selections synchronized through card taps and arrow navigation', () => {
  function Selector() {
    const [settings, setSettings] = React.useState(cos.settings);
    const state = { ...cos, settings, colors: COLOR_SCHEMES[settings.colorScheme],
      select: (key, value) => setSettings(current => ({ ...current, [key]: value })) };
    return <><PaletteStep cos={state} slot="hero" /><PaletteStep cos={state} slot="body" /></>;
  }
  act(() => root.render(<Selector />));
  const expectSelection = (name, key) => {
    expect(host.querySelector('h2').textContent).toBe(name);
    expect(host.querySelector('.palette-card[aria-pressed="true"] .palette-card-heading').textContent).toBe(name);
    expect(host.querySelectorAll('.palette-card[aria-pressed="true"]')).toHaveLength(1);
    expect(host.querySelector('[data-preview]').dataset.color).toBe(COLOR_SCHEMES[key][1]);
  };
  act(() => button('Neon').click());
  expectSelection('Neon', 'neon');
  act(() => button('Next palette').click());
  expectSelection('Standard', 'standard');
  act(() => button('Previous palette').click());
  expectSelection('Neon', 'neon');
});
it('uses the same photo name as the preview and reports mixed face styles accurately', () => {
  cos.settings = { colorScheme: 'custom', tileStyle: 'solid', perFaceStyles: { 1: 'glass' } };
  act(() => root.render(<PaletteStep cos={cos} />));
  expect(host.querySelector('h2').textContent).toBe('Your Photo');
  expect(host.querySelector('.palette-upload strong').textContent).toBe('Your Photo');
  expect(host.querySelector('[data-preview] p').textContent).toContain('Per Face');
  expect(host.querySelectorAll('.palette-card[aria-pressed="true"]')).toHaveLength(0);
});
