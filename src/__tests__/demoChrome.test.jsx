import React, { act, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import UILayer from '../components/UILayer.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

let host, root, before;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ demoMode: true, demoStep: 'chaos-forecast', showWelcome: false,
    showMainMenu: false, wormHealerMode: false, showSettings: false, showHelp: false,
    showDisparityWinner: false, disparityWinner: null, size: 3, cubies: makeCubies(3) });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const draw = blocked => act(() => root.render(<Suspense fallback={null}>
  <UILayer metrics={{}} settings={useGameStore.getState().settings} resolvedColors={{}}
    cascades={[]} moveHistory={[]} teachMode={{ courseActive: false }}
    ui={{ demoDialogueVisible: blocked }} handlers={{}} />
</Suspense>));

it('replaces the normal top bar in the demo while retaining hands-on game controls', () => {
  draw(false);
  expect(host.querySelector('.top-app-bar')).toBeNull();
  expect(host.querySelector('[aria-label="Game controls"]')).not.toBeNull();
});
it('removes game controls throughout demo dialogs and restores them for practice', () => {
  draw(true);
  expect(host.querySelector('.top-app-bar')).toBeNull();
  expect(host.querySelector('[aria-label="Game controls"]')).toBeNull();
  draw(false);
  expect(host.querySelector('[aria-label="Game controls"]')).not.toBeNull();
});
it('keeps both menus out of Chaos results independently of dialogue state', async () => {
  useGameStore.setState({ showDisparityWinner: true, disparityWinner: { pair: ['M1-001', 'M4-009'] } });
  draw(false);
  await act(async () => {});
  expect(host.querySelector('.top-app-bar')).toBeNull();
  expect(host.querySelector('[aria-label="Game controls"]')).toBeNull();
});
