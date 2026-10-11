// The fill light fades in with whatever is on the cube. A fusion remounts the reaction
// coat and particles (keyed by recipe), which fade in over ELEMENTAL_FADE_IN; the light
// used to keep the solo element's clock and sit at full strength over a reaction that
// was still arriving, and again when a reclaim reversed the recipe.
import { it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const frames = [];
vi.mock('@react-three/fiber', () => ({ useFrame: callback => { frames.push(callback); } }));
vi.mock('../worm/healerWorm/elementalQuality.js', () => ({ resolveElementalQuality: () => ({ particleCount: 0, animate: true }) }));
vi.mock('../worm/healerWorm/FusionAura.jsx', () => ({ default: () => null }));
vi.mock('../worm/healerWorm/FusionParticles.jsx', () => ({ default: () => null }));
vi.mock('../worm/ElementalCubeSkin.jsx', () => ({ default: () => null }));

import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { ELEMENTAL_FADE_IN } from '../worm/healerWorm/elementalLifecycle.js';
import ElementalAtmosphere from '../worm/ElementalAtmosphere.jsx';

it('restarts the light\'s fade with the reaction when a pair forms or reverses, not on a refresh', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const host = document.createElement('div'), root = createRoot(host);
  const set = (element, partner) => act(() => useGameStore.setState({ wormElementalTheme: element, wormElementalPartner: partner }));
  // Each render re-registers the frame callback; only the latest one is live.
  const tick = (seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.05) frames.at(-1)({}, 0.05); };
  const light = () => host.querySelector('hemispherelight').intensity;
  const FULL = 0.55;
  try {
    wormBuffs.elementalT = 10;
    useGameStore.setState({ wormPaused: false });
    set('water', null);
    act(() => root.render(<ElementalAtmosphere />));
    tick(1);
    expect(light()).toBeCloseTo(FULL, 5);

    // Water then fire forms Steam: the light fades in with the reaction.
    set('fire', 'water');
    tick(0.1);
    expect(light()).toBeCloseTo(FULL * 0.1 / ELEMENTAL_FADE_IN, 5);
    tick(1);
    expect(light()).toBeCloseTo(FULL, 5);

    // Reclaiming the base reverses it into Quench: a new reaction, a new fade.
    set('water', 'fire');
    tick(0.1);
    expect(light()).toBeCloseTo(FULL * 0.1 / ELEMENTAL_FADE_IN, 5);
    tick(1);

    // Refreshing the newest element changes nothing on the cube, so the light holds.
    set('water', 'fire');
    tick(0.05);
    expect(light()).toBeCloseTo(FULL, 5);
  } finally {
    act(() => root.unmount());
    warning.mockRestore();
    wormBuffs.elementalT = 0;
  }
});
