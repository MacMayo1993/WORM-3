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

it.each([
  ['Easy', 2, 30, 20], ['Medium', 2.75, 16, 10], ['Hard', 3.5, 6, 5],
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
