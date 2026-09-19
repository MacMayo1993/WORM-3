import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, readPlayerSave, PLAYER_SAVE_KEY } from '../progression/model.js';
import { wormEventChanges } from '../worm/wormEventChanges.js';
import { withPersistenceBatch, persistLatest } from '../utils/persistenceBatch.js';

const state = () => useGameStore.getState();
beforeEach(() => {
  useGameStore.setState({ playerProgress: newProgress(), parityPoints: 0, wormMissionsCompleted: 0,
    demoMode: false, wormCombatMode: false, size: 3, showMainMenu: false });
  state().initWormMode(9999, 0, 2, null, 20);
  useGameStore.setState({ wormGamePhase: 'active', wormPaused: false });
});
afterEach(() => vi.restoreAllMocks());

it.each(['orbs', 'healed'])('publishes %s XP, missions and inventory with identical ordered rewards', kind => {
  const initial = state();
  const keys = ['playerProgress', 'xpRun', 'xpNotice', 'wormMission', 'wormMissionCounters', 'wormRunAchievements', 'wormMissionsCompleted', 'parityPoints'];
  const select = value => Object.fromEntries(keys.map(key => [key, value[key]]));
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  for (let n = 1; n <= 8; n++) {
    state().recordWormXp(kind, n, 1, initial.wormRunId);
    state().recordWormMission(kind, n, 1, initial.wormRunId);
  }
  const expected = select(state());
  useGameStore.setState(initial, true);
  let commits = 0;
  const unsub = useGameStore.subscribe(() => commits++);
  withPersistenceBatch(() => {
    for (let n = 1; n <= 8; n++) useGameStore.setState(s => wormEventChanges(s, kind, n, 1, s.wormRunId));
  });
  unsub();
  expect(commits).toBe(8);
  expect(select(state())).toEqual(expected);
  expect(readPlayerSave()).toMatchObject({ progress: expected.playerProgress, points: expected.parityPoints });
  now.mockRestore();
});

it('writes one durable player snapshot for an eight-pickup simulation burst', () => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  withPersistenceBatch(() => {
    for (let n = 1; n <= 8; n++) useGameStore.setState(s => ({
      ...wormEventChanges(s, 'orbs', n, (n % 6) + 1, s.wormRunId), wormSessionOrbs: n,
    }));
    expect(state().wormSessionOrbs).toBe(8); // gameplay already sees the latest pickup
    expect(writes.mock.calls.filter(([key]) => key === PLAYER_SAVE_KEY)).toHaveLength(0);
  });
  expect(writes.mock.calls.filter(([key]) => key === PLAYER_SAVE_KEY)).toHaveLength(1);
  expect(readPlayerSave()).toMatchObject({ points: state().parityPoints, progress: state().playerProgress });
});

it('flushes the latest value through nested batches and exceptions without timers', () => {
  const write = vi.fn();
  expect(() => withPersistenceBatch(() => {
    persistLatest('test', () => write(1));
    withPersistenceBatch(() => persistLatest('test', () => write(2)));
    expect(write).not.toHaveBeenCalled();
    throw new Error('interrupted event');
  })).toThrow('interrupted event');
  expect(write.mock.calls).toEqual([[2]]);
  persistLatest('test', () => write(3));
  expect(write.mock.calls).toEqual([[2], [3]]);
});
