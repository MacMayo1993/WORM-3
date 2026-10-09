import { it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useGameStore } from '../hooks/useGameStore.js';
let sequence = 0;
vi.mock('@react-three/fiber', () => ({ useFrame() {} }));
vi.mock('../worm/healerWorm/elementalQuality.js', () => ({ resolveElementalQuality: () => ({ particleCount: 0, animate: false }) }));
vi.mock('../worm/healerWorm/FusionAura.jsx', () => ({ default: () => null }));
vi.mock('../worm/ElementalCubeSkin.jsx', async () => {
  const { useState } = await import('react');
  return { default: function TestSkin({ element }) {
    const [id] = useState(() => ++sequence);
    return <span data-element={element} data-instance={id} />;
  } };
});
import ElementalAtmosphere from '../worm/ElementalAtmosphere.jsx';

it('retains each mounted skin as it changes from solo to partner, reverses, and chains a third element', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // R3F host names are deliberately inert in this reconciliation-only test.
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const host = document.createElement('div'), root = createRoot(host);
  const set = (element, partner) => act(() => useGameStore.setState({ wormElementalTheme: element, wormElementalPartner: partner }));
  const id = element => host.querySelector(`[data-element="${element}"]`)?.dataset.instance;
  try {
    set('water', null);
    act(() => root.render(<ElementalAtmosphere />));
    const water = id('water');
    set('fire', 'water');
    expect(id('water')).toBe(water);
    const fire = id('fire');
    set('water', 'fire');
    expect(id('water')).toBe(water); expect(id('fire')).toBe(fire);
    set('ice', 'water');
    expect(id('water')).toBe(water); expect(id('fire')).toBeUndefined();
    expect(id('ice')).toBeDefined();
    set(null, null);
    expect(host.querySelectorAll('[data-element]')).toHaveLength(0);
  } finally {
    act(() => root.unmount()); warning.mockRestore();
  }
});
