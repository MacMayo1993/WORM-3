import { beforeEach, afterEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { localStorage.clear(); vi.resetModules(); });

it.each([undefined, 'obsolete'])('defaults to Follow worm for a missing or invalid mode: %s', async wormCameraMode => {
  localStorage.setItem('worm3_settings', JSON.stringify({ wormCameraMode, sfx: false }));
  const { persistedState } = await import('../hooks/storeSlices/persistedState.js');
  expect(persistedState.settings).toMatchObject({ wormCameraMode: 'follow', sfx: false });
});

it('remembers Stationary after reload and does not save the temporary far-side view', async () => {
  const { useGameStore } = await import('../hooks/useGameStore.js');
  const { setSettings, flipWormStationaryView } = useGameStore.getState();
  setSettings(s => ({ ...s, wormCameraMode: 'stationary' }));
  flipWormStationaryView();
  expect(useGameStore.getState().wormStationaryViewRequest).toBe(1);
  vi.resetModules();
  const { useGameStore: reloaded } = await import('../hooks/useGameStore.js');
  expect(reloaded.getState().settings.wormCameraMode).toBe('stationary');
  expect(reloaded.getState().wormStationaryViewRequest).toBe(0);
  reloaded.getState().setSettings(s => ({ ...s, wormCameraMode: 'follow' }));
  expect(JSON.parse(localStorage.getItem('worm3_settings')).wormCameraMode).toBe('follow');
});

it('remembers Steady Follow across reload independently of the requested viewing angle', async () => {
  const { useGameStore } = await import('../hooks/useGameStore.js');
  useGameStore.getState().setSettings(s => ({ ...s, wormCameraMode: 'steady' }));
  useGameStore.getState().turnWormSteadyView('right');
  expect(useGameStore.getState().wormSteadyViewStep).toBe(1);
  vi.resetModules();
  const { useGameStore: reloaded } = await import('../hooks/useGameStore.js');
  expect(reloaded.getState().settings.wormCameraMode).toBe('steady');
  expect(reloaded.getState().wormSteadyViewStep).toBe(0);
});
