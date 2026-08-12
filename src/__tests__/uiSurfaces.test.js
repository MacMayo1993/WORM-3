// Covers the screen-ownership rules the global keyboard handler depends on.
// Before this module existed the handler guarded three cases and left cube keys
// live under every menu — W/A/S/D scrambled the puzzle behind an open modal and
// arrow keys stole scroll from the settings panel.
import { describe, it, expect, vi } from 'vitest';
import {
  MODAL_SURFACES,
  BLOCKING_FLAGS,
  selectTopSurface,
  selectCubeInputBlocked
} from '../hooks/uiSurfaces.js';
import { useGameStore } from '../hooks/useGameStore.js';

// A store shape with nothing open.
const idle = () => ({ victory: null });

describe('selectCubeInputBlocked', () => {
  it('lets input through when nothing owns the screen', () => {
    expect(selectCubeInputBlocked(idle())).toBe(false);
  });

  it.each(BLOCKING_FLAGS)('blocks while %s is open', (flag) => {
    expect(selectCubeInputBlocked({ ...idle(), [flag]: true })).toBe(true);
  });

  it.each(
    MODAL_SURFACES.filter((s) => !['leaderboard', 'netPanel'].includes(s.id)).map((s) => [s.id, s.flag])
  )('blocks while the %s modal is open', (_id, flag) => {
    expect(selectCubeInputBlocked({ ...idle(), [flag]: true })).toBe(true);
  });

  it('blocks on the victory screen so the celebrated solve cannot be turned away', () => {
    expect(selectCubeInputBlocked({ victory: 'rubiks' })).toBe(true);
  });

  it.each(['showLeaderboard', 'showNetPanel'])(
    'keeps play live with the ambient %s panel open',
    (flag) => {
      expect(selectCubeInputBlocked({ ...idle(), [flag]: true })).toBe(false);
    }
  );

  it('blocks the main menu — the regression that let menu keys scramble the cube', () => {
    expect(selectCubeInputBlocked({ ...idle(), showMainMenu: true })).toBe(true);
  });
});

describe('selectTopSurface', () => {
  it('returns null when nothing is open', () => {
    expect(selectTopSurface(idle())).toBeNull();
  });

  it('returns the open surface', () => {
    expect(selectTopSurface({ ...idle(), showSettings: true })?.id).toBe('settings');
  });

  it('picks the innermost surface when two are open at once', () => {
    // Nothing in the store enforces exclusivity, so Escape must still resolve.
    const top = selectTopSurface({ ...idle(), showSettings: true, showHelp: true });
    expect(top.id).toBe('help');
  });

  it('closes the surface it reports', () => {
    const close = vi.fn();
    const surface = MODAL_SURFACES.find((s) => s.id === 'settings');
    surface.close({ setShowSettings: close });
    expect(close).toHaveBeenCalledWith(false);
  });
});

describe('every surface names an action the store actually has', () => {
  // Guards against a rename silently turning Escape into a no-op for one panel.
  it.each(MODAL_SURFACES.map((s) => [s.id, s.flag]))('%s', (id, flag) => {
    const state = useGameStore.getState();
    expect(flag in state).toBe(true);
    const surface = MODAL_SURFACES.find((s) => s.id === id);
    expect(() => surface.close(state)).not.toThrow();
  });

  it.each(BLOCKING_FLAGS)('%s exists on the store', (flag) => {
    expect(flag in useGameStore.getState()).toBe(true);
  });
});
