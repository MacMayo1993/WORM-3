import { newProgress, readPlayerSave } from '../progression/model.js';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { advanceMission, startMission, readMissionCount, missionDefinition, WORM_MISSIONS, WORM_MISSION_STORAGE_KEY } from '../worm/missions.js';
import WormMissionCard, { WormReplayLabel } from '../worm/WormMissionCard.jsx';

const state = () => useGameStore.getState();
const set = patch => useGameStore.setState(patch);
beforeEach(() => {
  localStorage.removeItem(WORM_MISSION_STORAGE_KEY);
  set({ playerProgress: newProgress(), demoMode: false, wormMissionsCompleted: 0, parityPoints: 100, wormHealerMode: false, wormPauseMenuOpen: false });
});
function start(completed = state().wormMissionsCompleted) {
  set({ wormMissionsCompleted: completed });
  state().initWormMode(9999, 0, 2, null, 20);
  set({ wormGamePhase: 'active', wormPaused: false });
  return state().wormRunId;
}
function record(kind, total, color, runId = state().wormRunId) {
  state().recordWormMission(kind, total, color, runId);
}
function finishCurrent() {
  const mission = state().wormMission;
  if (mission.kind === 'colors') {
    for (let face = 1; face <= mission.target; face++) record('orbs', state().wormMissionCounters.orbs + 1, face);
  } else record(mission.kind, state().wormMissionCounters[mission.kind] + mission.target, 1);
}

describe('rolling run achievements', () => {
  it('starts with one fresh objective and stable targets across cube sizes', () => {
    start(); expect(state().wormMission.title).toBe('Collect 8 orbs');
    record('orbs', 5, 1);
    set({ size: 15 }); start();
    expect(state().wormMission.progress).toBe(0);
    expect(state().wormMission.target).toBe(8);
    expect(state().wormRunAchievements).toEqual([]);
  });
  it('replaces the completed objective immediately and pays its reward once', () => {
    start(); record('orbs', 8, 1);
    expect(state().wormMission).toMatchObject({ kind: 'tunnels', progress: 0, completed: false });
    expect(state().wormRunAchievements).toHaveLength(1);
    expect(state().wormRunAchievements[0]).toMatchObject({ title: 'Collect 8 orbs', reward: 20, xpEarned: 25, completed: true });
    record('orbs', 8, 1); record('orbs', 20, 2);
    expect(state().parityPoints).toBe(120);
    expect(state().playerProgress.xp).toBe(25);
    expect(readMissionCount()).toBe(1);
    record('tunnels', 1);
    expect(state().wormRunAchievements).toHaveLength(2);
    expect(state().wormMission.kind).toBe('colors');
    expect(state().xpRun.breakdown.Achievements).toBe(50);
    expect(readPlayerSave()).toMatchObject({ points: 145, progress: { xp: 50 } });
  });
  it('does not backfill new objectives from earlier or batched run totals', () => {
    start(); record('tunnels', 12); record('healed', 3); record('orbs', 80, 1);
    expect(state().wormRunAchievements).toHaveLength(1);
    expect(state().wormMission).toMatchObject({ kind: 'tunnels', startTotal: 12, progress: 0 });
    record('tunnels', 12); expect(state().wormMission.progress).toBe(0);
    record('tunnels', 13);
    expect(state().wormMission).toMatchObject({ kind: 'colors', startTotal: 80, progress: 0 });
    record('orbs', 80, 2); expect(state().wormMission.progress).toBe(0);
    record('orbs', 81, 2); record('orbs', 82, 3); record('orbs', 83, 4);
    expect(state().wormMission).toMatchObject({ kind: 'healed', startTotal: 3, progress: 0 });
    record('healed', 3); expect(state().wormMission.progress).toBe(0);
    record('healed', 4);
    expect(state().wormMission).toMatchObject({ kind: 'orbs', target: 20, startTotal: 83, progress: 0 });
    record('orbs', 84, 1); expect(state().wormMission.progress).toBe(1);
  });
  it('counts distinct new colors, ignoring deposits, old totals and duplicate notifications', () => {
    start(2); record('orbs', 1, 1); record('orbs', 2, 1);
    record('orbs', 2, 2); record('orbs', 1, 3);
    expect(state().wormMission.progress).toBe(1);
    set({ wormOrbInventory: { 1: 0 } });
    record('orbs', 3, 2); record('orbs', 4, 0); record('orbs', 5, 7);
    expect(state().wormMission.progress).toBe(2);
    record('orbs', 6, 3);
    expect(state().wormRunAchievements[0]).toMatchObject({ colors: [1, 2, 3], completed: true });
    expect(state().wormMission).toMatchObject({ kind: 'healed', progress: 0 });
    expect(state().parityPoints).toBe(130);
  });
  it('exhausts a varied pool without repeating a goal or granting again', () => {
    start(); for (let i = 0; i < WORM_MISSIONS.length; i++) finishCurrent();
    const earned = state().wormRunAchievements;
    expect(earned).toHaveLength(WORM_MISSIONS.length);
    expect(new Set(earned.map(a => a.id)).size).toBe(earned.length);
    expect(state().wormMission).toBeNull();
    const xp = state().playerProgress.xp;
    record('orbs', 9999, 1); expect(state().playerProgress.xp).toBe(xp);
    expect(readMissionCount()).toBe(WORM_MISSIONS.length);
    const recent = state().playerProgress.recentGoals;
    start(); expect(recent).not.toContain(state().wormMission.id);
  });
  it('keeps earned receipts on death and clears them only for a new run', () => {
    const oldId = start(); finishCurrent(); finishCurrent(); record('orbs', 9, 1);
    const earned = state().wormRunAchievements;
    state().finishWormXp(false, oldId); set({ wormAlive: false });
    record('orbs', 10, 2);
    expect(state().wormRunAchievements).toBe(earned);
    expect(state().playerProgress.xp).toBe(50);
    start();
    expect(state().wormRunAchievements).toEqual([]);
    expect(state().wormMission).toMatchObject({ kind: 'colors', progress: 0, colors: [] });
    expect(state().wormMissionCounters).toEqual({ orbs: 0, tunnels: 0, healed: 0 });
    record('orbs', 10, 2, oldId); expect(state().wormMission.progress).toBe(0);
    expect(state().wormMissionsCompleted).toBe(2);
  });
  it('keeps an unfinished objective assigned, and ignores paused, dead, pre-game and ended events', () => {
    start();
    for (const patch of [{ wormPaused: true }, { wormPaused: false, wormGamePhase: 'scrambling' }, { wormGamePhase: 'active', wormAlive: false }]) {
      set(patch); record('orbs', 8, 1); expect(state().wormMission.progress).toBe(0);
    }
    set({ wormAlive: true }); state().finishWormXp(false, state().wormRunId); record('orbs', 8, 1);
    expect(state().wormRunAchievements).toEqual([]);
    start(); record('orbs', 4, 1); start(); expect(state().wormMission.progress).toBe(0);
  });
  it('excludes demo objectives, history and payouts', () => {
    start(); finishCurrent(); set({ demoMode: true }); start();
    expect(state().wormMission).toBeNull(); expect(state().wormRunAchievements).toEqual([]);
    record('orbs', 100, 1);
    expect(state().wormMissionsCompleted).toBe(1);
    expect(state().parityPoints).toBe(120);
  });
  it('clears run receipts and counters on exit while keeping lifetime completion and XP', () => {
    start(3); finishCurrent(); state().clearDisparityGame();
    expect(state().wormMission).toBeNull(); expect(state().wormRunAchievements).toEqual([]);
    expect(state().wormMissionCounters).toEqual({ orbs: 0, tunnels: 0, healed: 0 });
    expect(state().wormMissionsCompleted).toBe(4); expect(state().playerProgress.xp).toBe(50);
  });
  it('rejects fractional/invalid/lower counters and wrong mechanics', () => {
    const m = advanceMission(startMission(0, 1), 'orbs', 4, 1);
    for (const value of [3, NaN, Infinity, 8.5, '8', -1]) expect(advanceMission(m, 'orbs', value, 1)).toBe(m);
    expect(advanceMission(m, 'tunnels', 100, 1)).toBe(m);
    expect(missionDefinition(WORM_MISSIONS.length).id).toBe(missionDefinition(0).id);
    start(); for (const value of [NaN, Infinity, 8.5, '8', -1]) record('orbs', value, 1);
    expect(state().wormRunAchievements).toEqual([]);
  });
  it('recovers malformed or unavailable saved completion counts', () => {
    for (const data of ['bad json', 'null', '{"completed":-1}', '{"completed":"12"}']) {
      localStorage.setItem(WORM_MISSION_STORAGE_KEY, data); expect(readMissionCount()).toBe(0);
    }
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readMissionCount()).toBe(0); spy.mockRestore();
  });
});

describe('achievement UI', () => {
  let host, root;
  beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  it('removes the completed achievement from live play and replaces it with fresh progress', () => {
    start(); act(() => root.render(<WormMissionCard />));
    expect(host.textContent).toContain('Collect 8 orbs');
    act(() => record('orbs', 8, 1));
    expect(host.textContent).not.toContain('Collect 8 orbs');
    expect(host.textContent).toContain('Complete 1 tunnel trip');
    expect(host.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
    expect(host.querySelector('[role="status"]').textContent).toContain('Achievement earned');
    expect(host.querySelector('ol')).toBeNull();
  });
  it.each(['death', 'win'])('lists all seven distinct earned challenges, after a %s', ending => {
    start(); for (let i = 0; i < 7; i++) finishCurrent();
    set(ending === 'death' ? { wormAlive: false } : { wormGamePhase: 'solved' });
    const points = state().parityPoints, xp = state().playerProgress.xp;
    act(() => root.render(<><WormMissionCard summary /><WormReplayLabel /></>));
    expect(host.querySelectorAll('ol li')).toHaveLength(7);
    expect(host.querySelectorAll('ol li')[0].textContent).toContain('Collect 8 orbs');
    expect(host.querySelectorAll('ol li')[6].textContent).toContain('Collect a dozen orbs');
    expect(host.textContent).toContain('Challenges complete');
    expect(host.textContent).toContain('+220 PP · +275 XP');
    expect(host.textContent).toContain('New run, fresh challenges.');
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(host.textContent).toContain('Play again');
    act(() => root.render(<WormMissionCard summary key="reopen" />));
    expect(state().parityPoints).toBe(points); expect(state().playerProgress.xp).toBe(xp);
  });
  it('keeps the active objective separate from the earned list when paused', () => {
    start(); finishCurrent(); set({ wormPauseMenuOpen: true, wormPaused: true });
    act(() => root.render(<WormMissionCard summary />));
    expect(host.textContent).toContain('Challenges');
    expect(host.querySelectorAll('ol li')).toHaveLength(1);
    expect(host.querySelector('ol').textContent).not.toContain('Complete 1 tunnel trip');
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-label')).toBe('Complete 1 tunnel trip');
  });
  it('shows an honest empty result when no achievement was earned', () => {
    start(); set({ wormAlive: false }); act(() => root.render(<WormMissionCard summary />));
    expect(host.textContent).toContain('No achievements earned yet.');
    expect(host.textContent).toContain('New run, fresh challenges.');
    expect(host.querySelector('ol')).toBeNull();
  });
  it('hides live achievements on pause, death and victory, and every achievement surface in the demo', () => {
    start(); act(() => root.render(<WormMissionCard />)); expect(host.textContent).toContain(state().wormMission.title);
    act(() => set({ wormPauseMenuOpen: true })); expect(host.textContent).toBe('');
    act(() => set({ wormPauseMenuOpen: false, wormAlive: false })); expect(host.textContent).toBe('');
    act(() => set({ wormAlive: true, wormGamePhase: 'solved' })); expect(host.textContent).toBe('');
    act(() => { set({ demoMode: true }); root.render(<WormMissionCard summary />); }); expect(host.textContent).toBe('');
  });
});
