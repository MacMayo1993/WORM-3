import { beforeEach, afterEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { localStorage.clear(); vi.resetModules(); });

it('starts new players with live captures off', async () => {
  const { persistedState } = await import('../hooks/storeSlices/persistedState.js');
  expect(persistedState.settings.livePortalViews).toBe(false);
});

it.each([0, 1])('removes the old default-on value from version %i without resetting other preferences', async version => {
  localStorage.setItem('worm3_settings_version', String(version));
  localStorage.setItem('worm3_settings', JSON.stringify({ livePortalViews: true, sfx: false, backgroundTheme: 'forest' }));
  const { persistedState } = await import('../hooks/storeSlices/persistedState.js');
  expect(persistedState.settings).toMatchObject({ livePortalViews: false, sfx: false, backgroundTheme: 'forest' });
});

it('retains an explicit opt-in across reloads after the migration', async () => {
  const { useGameStore } = await import('../hooks/useGameStore.js');
  useGameStore.getState().setSettings(s => ({ ...s, livePortalViews: true }));
  expect(localStorage.getItem('worm3_settings_version')).toBe('2');
  vi.resetModules();
  const { persistedState } = await import('../hooks/storeSlices/persistedState.js');
  expect(persistedState.settings.livePortalViews).toBe(true);
});
