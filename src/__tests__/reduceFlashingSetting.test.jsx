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
