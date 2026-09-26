import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DisparitySetupWizard from '../components/screens/DisparitySetupWizard.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { chaosSetupSettings } from '../utils/chaosSetup.js';

vi.mock('../components/screens/wizardSteps/CubePlate.jsx', () => ({ default: ({ title, onNext }) => (
  <div>{title}<button onClick={onNext} aria-label="Next preview" /></div>
) }));
vi.mock('../utils/feel.js', () => ({ feel: vi.fn(), resumeFeel: vi.fn() }));
let root, host, before;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ size: 10 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([undefined, { cubeSize: 7 }])('limits inherited and replayed setups to the 2–5 size choices (%j)', initialSettings => {
  const onStart = vi.fn();
  act(() => root.render(<DisparitySetupWizard initialSettings={initialSettings} onStart={onStart} onCancel={vi.fn()} />));
  act(() => [...host.querySelectorAll('nav button')].find(b => b.textContent.includes('Size')).click());
  const slider = host.querySelector('input[aria-label="Cube size"]');
  expect(slider.getAttribute('max')).toBe('3'); // four stops, ending at 5×5
  expect(slider.getAttribute('aria-valuetext')).toBe('5×5×5');
  expect([...host.querySelectorAll('[aria-label="Size choices"] button')].map(b => b.getAttribute('aria-label')))
    .toEqual(['2 by 2', '3 by 3', '4 by 4', '5 by 5']);
  act(() => host.querySelector('[aria-label="Next preview"]').click());
  expect(slider.getAttribute('aria-valuetext')).toBe('5×5×5');
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Make your prediction')).click());
  expect(onStart.mock.calls[0][0].cubeSize).toBe(5);
});

it.each(['off', 'subtle', 'full'])('preserves the saved %s preference even with an old full-bounce round snapshot', flipPads => {
  const current = { colorScheme: 'custom', customColors: { 1: '#123456' }, flipPads };
  expect(chaosSetupSettings(current, { cubeSize: 15, tileStyle: 'circuit', flipPads: 'full' }))
    .toMatchObject({ cubeSize: 5, flipPads, tileStyle: 'circuit', colorScheme: 'custom', customColors: current.customColors });
  expect(current.flipPads).toBe(flipPads);
});
