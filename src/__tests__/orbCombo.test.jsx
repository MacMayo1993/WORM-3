import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORB_COMBO_WINDOW, chainOrb, comboMilestone, comboWindowLeft } from '../worm/healerWorm/orbCombo.js';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { wormBuffs, resetWormBuffs } from '../worm/wormBuffs.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { WORM_HAPTICS } from '../worm/wormFeedback.js';

// The orb chain: quick pickups (each within the window of the last) build a chain the
// HUD shows from ×2, calling out ×3, ×5 and ×8. Recognition only: it never pays PP.
describe('the chain rules', () => {
  it('names the milestones and nothing in between', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 18].map(comboMilestone))
      .toEqual([null, null, 'Combo', null, 'Streak', null, null, 'Frenzy', null, 'Frenzy', 'Frenzy']);
  });

  it('extends inside the window, restarts after it, keeps the best and cues each milestone once', () => {
    const sim = makeWormSim(3);
    resetWormSim(sim, 3, { orbCount: 0 });
    const feel = vi.fn();
    const ctx = { feel };
    sim.timeAlive = 10;
    const chains = [];
    for (let i = 0; i < 5; i++) { chains.push(chainOrb(sim, ctx)); sim.timeAlive += ORB_COMBO_WINDOW * 0.9; }
    expect(chains).toEqual([1, 2, 3, 4, 5]);
    expect(feel.mock.calls).toEqual([['combo', { combo: 2 }], ['combo', { combo: 4 }]]);
    // The window runs on the sim's clock and lapses.
    expect(comboWindowLeft(sim)).toBeCloseTo(ORB_COMBO_WINDOW * 0.1);
    sim.timeAlive += ORB_COMBO_WINDOW;
    expect(comboWindowLeft(sim)).toBe(0);
    expect(chainOrb(sim, ctx)).toBe(1);
    expect(sim.bestCombo).toBe(5);
    resetWormSim(sim, 3, { orbCount: 0 });
    expect(sim.bestCombo).toBe(0);
    expect(comboWindowLeft(sim)).toBe(0);
  });

  it('has a sound and a buzz for the milestone and for an Air gust', () => {
    expect(WORM_HAPTICS.combo).toBeTruthy();
    expect(WORM_HAPTICS.gust).toBeTruthy();
  });
});

describe('the HUD chip', () => {
  let root, host, before, frames;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    before = useGameStore.getState();
    resetWormBuffs();
    frames = [];
    vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount()); host.remove();
    useGameStore.setState(before, true);
    resetWormBuffs();
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const flushFrame = () => { const run = frames.splice(0); run.forEach(fn => fn()); };
  const pickup = (combo, seq) => act(() => useGameStore.setState({ wormOrbFlash: { color: '#ff0000', combo, seq } }));

  it('shows from the second orb, calls out milestones, drains and hides when the window lapses', async () => {
    const { ComboMeter } = await import('../worm/WormCrawlerHUD.jsx');
    useGameStore.setState({ wormOrbFlash: null });
    act(() => root.render(<ComboMeter />));
    const chip = host.querySelector('.worm-combo');
    expect(chip.hidden).toBe(true);

    wormBuffs.orbComboLeft = ORB_COMBO_WINDOW;
    pickup(0, 1);
    expect(chip.hidden).toBe(true); // a lone orb is not a chain

    pickup(1, 2);
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toBe('×2');
    expect(chip.dataset.milestone).toBe('false');

    pickup(2, 3);
    expect(chip.textContent).toBe('×3Combo');
    expect(chip.dataset.milestone).toBe('true');
    expect(chip.classList.contains('is-popping')).toBe(true);

    // Half the window gone: the ring is half drained.
    wormBuffs.orbComboLeft = ORB_COMBO_WINDOW / 2;
    flushFrame();
    const ring = chip.querySelector('.worm-combo-fill');
    const circ = Number(ring.getAttribute('stroke-dasharray'));
    expect(Number(ring.style.strokeDashoffset)).toBeCloseTo(circ / 2);
    // Lapsed: hidden, and the loop stops.
    wormBuffs.orbComboLeft = 0;
    flushFrame();
    expect(chip.hidden).toBe(true);
    expect(frames).toHaveLength(0);
  });
});
