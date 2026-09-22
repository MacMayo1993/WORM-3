import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
vi.mock('../hooks/index.js', () => ({ useIsMobile: () => true }));
vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: selector => selector({ ownedItems: [] }) }));
vi.mock('../3d/WormPreviewCanvas.jsx', () => ({ default: () => null }));
vi.mock('../components/screens/wizardSteps/CubePlate.jsx', () => ({ default: () => null }));
vi.mock('../components/screens/WizardChrome.jsx', async importOriginal => ({
  ...await importOriginal(),
  WizardShell: ({ categories, active, onSelect, onPrimary }) => <>
    <nav>{categories.map((c, i) => <button key={c.key} onClick={() => onSelect(i)}>{c.label}</button>)}</nav>
    {categories[active].content}<button onClick={onPrimary}>Continue</button>
  </>,
}));
import WormModeSetupWizard from '../components/screens/WormModeSetupWizard.jsx';
import FreeplaySetupWizard from '../components/screens/FreeplaySetupWizard.jsx';
import RandomModeSetupWizard from '../components/screens/RandomModeSetupWizard.jsx';
import DisparitySetupWizard from '../components/screens/DisparitySetupWizard.jsx';

for (const [name, Wizard, category] of [
  ['Worm', WormModeSetupWizard, 'Play'], ['Cube', FreeplaySetupWizard, 'Size'],
  ['Random', RandomModeSetupWizard, 'Size'], ['Chaos', DisparitySetupWizard, 'Size']
]) {
  it.each([8, 9, 10])(`${name} launches the selected size-%i board`, size => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host), launch = vi.fn();
    const click = label => act(() => [...host.querySelectorAll('button')]
      .find(b => b.textContent === label || b.getAttribute('aria-label') === label).click());
    try {
      act(() => root.render(<Wizard onComplete={launch} onStart={launch} />));
      click(category); click(`${size} by ${size}`);
      expect(host.querySelector('[aria-label="Cube size"]').getAttribute('aria-valuetext')).toContain(`${size}×${size}×${size}`);
      const choice = host.querySelector(`[aria-label="${size} by ${size}"]`);
      expect(choice.getAttribute('aria-pressed')).toBe('true');
      expect(choice.style.minHeight).toBe('48px');
      click('Scene'); click(category); // selection survives category changes
      click('Continue');
      expect(launch).toHaveBeenCalledWith(expect.objectContaining({ cubeSize: size }));
      if (name === 'Worm') expect(launch.mock.lastCall[0].megaMode).toBe(false);
    } finally { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
  });
}

it.each([
  ['Easy', 2, 12, 20], ['Medium', 2.75, 10, 10], ['Hard', 3.5, 8, 5],
])('starts %s with the selected size and complete difficulty settings', (label, speed, orbs, interval) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host); const onComplete = vi.fn();
  const click = name => act(() => [...host.querySelectorAll('button')].find(b => b.textContent === name || b.getAttribute('aria-label') === name).click());
  try {
    act(() => root.render(<WormModeSetupWizard onComplete={onComplete} />));
    expect([...host.querySelectorAll('nav button')].map(b => b.textContent)).toEqual(['Character', 'Scene', 'Colors', 'Style', 'Play']);
    click('Play');
    expect(host.querySelector('[aria-label="Cube size"]')).not.toBeNull();
    expect(host.textContent).not.toContain('Orb Count');
    click('15 by 15'); click(label);
    expect([...host.querySelectorAll('[aria-pressed="true"]')].some(b => b.textContent === label)).toBe(true);
    click('Continue');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cubeSize: 15, megaMode: true,
      wormSpeed: speed, wormOrbCount: orbs, wormholeInterval: interval }));
  } finally { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});

it.each([true, false])('loads the saved enemy choice %s and submits changes independently of arena and difficulty', saved => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host); const onComplete = vi.fn();
  const click = name => act(() => [...host.querySelectorAll('button')].find(b => b.textContent === name).click());
  try {
    act(() => root.render(<WormModeSetupWizard onComplete={onComplete} initialSettings={{ wormEnemiesEnabled: saved }} />));
    click('Play');
    const toggle = () => host.querySelector('[role="switch"][aria-label="Portal enemies"]');
    expect(toggle().checked).toBe(saved);
    act(() => toggle().click());
    expect(toggle().checked).toBe(!saved);
    click('Hard');
    const arena = host.querySelector('input[type="checkbox"]:not([role="switch"])');
    act(() => arena.click());
    expect(toggle()).toBeNull();
    act(() => arena.click());
    expect(toggle().checked).toBe(!saved);
    click('Continue');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ wormEnemiesEnabled: !saved, wormCombatMode: false, wormSpeed: 3.5 }));
  } finally { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});
