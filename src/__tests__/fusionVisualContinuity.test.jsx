import { it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useGameStore } from '../hooks/useGameStore.js';
let sequence = 0;
vi.mock('@react-three/fiber', () => ({ useFrame() {} }));
vi.mock('../worm/healerWorm/elementalQuality.js', () => ({ resolveElementalQuality: () => ({ particleCount: 0, animate: false }) }));
vi.mock('../worm/healerWorm/FusionAura.jsx', () => ({ default: () => null }));
const retirers = new Map();
vi.mock('../worm/ElementalCubeSkin.jsx', async () => {
  const { useState } = await import('react');
  return { default: function TestSkin({ element, recipe, retire, onRetired }) {
    const [id] = useState(() => ++sequence);
    const key = recipe ? `reaction:${recipe}` : element;
    if (onRetired) retirers.set(key, onRetired); else retirers.delete(key);
    const attrs = { 'data-instance': id, 'data-retire': retire ? '1' : '0' };
    return recipe ? <span data-recipe={recipe} {...attrs} /> : <span data-element={element} {...attrs} />;
  } };
});
vi.mock('../worm/healerWorm/FusionParticles.jsx', () => ({ default: () => null }));
import ElementalAtmosphere from '../worm/ElementalAtmosphere.jsx';

it('turns the outgoing layer into the reaction: it keeps its instance and dissolves while the reaction floods in', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // R3F host names are deliberately inert in this reconciliation-only test.
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const host = document.createElement('div'), root = createRoot(host);
  const set = (element, partner) => act(() => useGameStore.setState({ wormElementalTheme: element, wormElementalPartner: partner }));
  const el = element => host.querySelector(`[data-element="${element}"]`);
  const rx = recipe => host.querySelector(`[data-recipe="${recipe}"]`);
  const finish = key => act(() => retirers.get(key)());
  try {
    set('water', null);
    act(() => root.render(<ElementalAtmosphere />));
    const water = el('water').dataset.instance;
    expect(el('water').dataset.retire).toBe('0');
    expect(host.querySelector('[data-recipe]')).toBeNull();

    // Water then fire: the cube becomes Quench. The water shell is the SAME instance,
    // now draining away under the quench rather than vanishing.
    set('fire', 'water');
    expect(rx('quench')).not.toBeNull();
    expect(el('water').dataset.instance).toBe(water);
    expect(el('water').dataset.retire).toBe('1');
    expect(el('fire')).toBeNull();
    finish('water');
    expect(el('water')).toBeNull();

    // Reclaiming the base reverses the recipe: Quench hands over to Steam the same way.
    const quench = rx('quench').dataset.instance;
    set('water', 'fire');
    expect(rx('steam')).not.toBeNull();
    expect(rx('quench').dataset.instance).toBe(quench);
    expect(rx('quench').dataset.retire).toBe('1');
    finish('reaction:quench');
    expect(rx('quench')).toBeNull();

    set('ice', 'water');
    expect(rx('slipstream')).not.toBeNull();
    // The wash ending clears everything at once; nothing lingers to dissolve.
    set(null, null);
    expect(host.querySelectorAll('[data-element], [data-recipe]')).toHaveLength(0);
  } finally {
    act(() => root.unmount()); warning.mockRestore();
  }
});
