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
  return { default: function TestSkin({ element, recipe }) {
    const [id] = useState(() => ++sequence);
    return recipe ? <span data-recipe={recipe} data-instance={id} /> : <span data-element={element} data-instance={id} />;
  } };
});
vi.mock('../worm/healerWorm/FusionParticles.jsx', () => ({ default: () => null }));
import ElementalAtmosphere from '../worm/ElementalAtmosphere.jsx';

it('draws a fused pair as its reaction, not as both elements\' skins, and swaps it as the recipe changes', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // R3F host names are deliberately inert in this reconciliation-only test.
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const host = document.createElement('div'), root = createRoot(host);
  const set = (element, partner) => act(() => useGameStore.setState({ wormElementalTheme: element, wormElementalPartner: partner }));
  const id = element => host.querySelector(`[data-element="${element}"]`)?.dataset.instance;
  const reaction = () => host.querySelector('[data-recipe]')?.dataset.recipe;
  try {
    set('water', null);
    act(() => root.render(<ElementalAtmosphere />));
    expect(id('water')).toBeDefined();
    expect(reaction()).toBeUndefined();
    // Water then fire: the cube is Steam now, not water plus fire.
    set('fire', 'water');
    expect(reaction()).toBe('steam');
    expect(host.querySelectorAll('[data-element]')).toHaveLength(0);
    // Reclaiming the base reverses the recipe, and the reaction with it.
    set('water', 'fire');
    expect(reaction()).toBe('quench');
    expect(host.querySelectorAll('[data-recipe]')).toHaveLength(1);
    set('ice', 'water');
    expect(reaction()).toBe('slipstream');
    set(null, null);
    expect(host.querySelectorAll('[data-element], [data-recipe]')).toHaveLength(0);
  } finally {
    act(() => root.unmount()); warning.mockRestore();
  }
});
