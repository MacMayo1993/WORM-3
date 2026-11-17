import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ScenePanel } from '../components/menus/settings/ScenePanel.jsx';
import { DEFAULT_SETTINGS } from '../utils/colorSchemes.js';

// Settings → Scene → Lightning flashes: off by default, one tap to reduce them.
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

it('defaults to full flashes and switches to reduced from the Scene panel', () => {
  expect(DEFAULT_SETTINGS.reduceFlashing).toBe(false);
  let settings;
  function Harness() {
    const [value, setValue] = useState({ ...DEFAULT_SETTINGS });
    useEffect(() => { settings = value; }, [value]);
    return <ScenePanel settings={value} onSettingsChange={setValue} />;
  }
  act(() => root.render(<Harness />));
  const radios = [...host.querySelectorAll('input[name="reduceFlashing"]')];
  expect(radios.map(r => r.closest('label').textContent)).toEqual(['Full', 'Reduced']);
  expect(radios[0].checked).toBe(true);
  act(() => radios[1].click());
  expect(settings.reduceFlashing).toBe(true);
  act(() => [...host.querySelectorAll('input[name="reduceFlashing"]')][0].click());
  expect(settings.reduceFlashing).toBe(false);
});

it('has a Motion toggle that every prefersReducedMotion() caller honours', async () => {
  const { prefersReducedMotion, setReducedMotionSetting } = await import('../utils/device.js');
  expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
  let settings;
  function Harness() {
    const [value, setValue] = useState({ ...DEFAULT_SETTINGS });
    useEffect(() => { settings = value; }, [value]);
    return <ScenePanel settings={value} onSettingsChange={setValue} />;
  }
  act(() => root.render(<Harness />));
  const radios = [...host.querySelectorAll('input[name="reducedMotion"]')];
  expect(radios.map(r => r.closest('label').textContent)).toEqual(['Full', 'Reduced']);
  act(() => radios[1].click());
  expect(settings.reducedMotion).toBe(true);
  // App syncs the setting into the shared query (jsdom has no system preference).
  expect(prefersReducedMotion()).toBe(false);
  setReducedMotionSetting(true);
  expect(prefersReducedMotion()).toBe(true);
  setReducedMotionSetting(false);
  expect(prefersReducedMotion()).toBe(false);
});

it('lets players switch the camera in Scene settings without enabling the separate reduced-motion flag', async () => {
  const { useGameStore } = await import('../hooks/useGameStore.js');
  const original = useGameStore.getState().settings;
  function Harness() {
    const settings = useGameStore(s => s.settings);
    return <ScenePanel settings={settings} onSettingsChange={useGameStore.getState().setSettings} />;
  }
  act(() => root.render(<Harness />));
  const select = host.querySelector('select');
  expect(select.labels[0].textContent).toBe('Camera mode');
  expect([...select.options].map(option => option.textContent)).toEqual(['Follow worm', 'Steady Follow', 'Stationary']);
  expect(host.querySelector('input[type="range"]')).not.toBeNull();
  try {
    act(() => {
      select.value = 'stationary';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useGameStore.getState().settings).toMatchObject({ wormCameraMode: 'stationary',
      reducedMotion: original.reducedMotion });
    expect(host.querySelector('input[type="range"]')).toBeNull();
  } finally {
    act(() => useGameStore.getState().setSettings(original));
  }
});
