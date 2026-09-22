import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect } from 'vitest';
import ChaosCountdown from '../chaos/ChaosCountdown.jsx';
import { resolveColors } from '../utils/colorSchemes.js';

it('shows palette tiles and advances accessible countdown states without owning a timer', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  const settings = { colorScheme:'neon' };
  try {
    for (const value of [3, 2, 1, 'GO!']) {
      act(() => root.render(<ChaosCountdown value={value} settings={settings} />));
      expect(host.querySelector('strong').textContent).toBe(String(value));
      expect(host.querySelector('[role=status]').getAttribute('aria-label')).toBe(value === 'GO!' ? 'Go! Chaos begins.' : `Chaos begins in ${value}`);
      const tiles = [...host.querySelectorAll('.chaos-countdown-tiles i')];
      expect(tiles.map(tile => tile.style.getPropertyValue('--tile-color'))).toEqual(Object.values(resolveColors(settings)));
      expect(host.querySelectorAll('[data-done=true]').length).toBe(value === 'GO!' ? 3 : 3 - value);
    }
    act(() => root.render(<ChaosCountdown value={null} settings={settings} />));
    expect(host.textContent).toBe('');
  } finally { act(() => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});
