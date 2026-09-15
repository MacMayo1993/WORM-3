import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, it, expect } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, readPlayerSave, sanitizeProgress, XP_MODES } from '../progression/model.js';
import { ACHIEVEMENTS } from '../progression/achievements.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import AchievementList from '../progression/AchievementList.jsx';
import { XpReceipt } from '../progression/ProgressWidgets.jsx';
import { startMission, WORM_MISSIONS } from '../worm/missions.js';
const state = () => useGameStore.getState();
const set = patch => useGameStore.setState(patch);
beforeEach(() => {
  set({ playerProgress: newProgress(), xpRun: null, xpNotice: null, xpActivityRuns: {}, parityPoints: 0,
    demoMode: false, showMainMenu: false, showWelcome: false, teachModeActive: false,
    wormHealerMode: false, wormMissionsCompleted: 0, wormPaused: false, animState: null,
    currentLevel: null, currentLevelData: null, activePackId: 'story-campaign', randomMode: false,
    chaosLevel: 0, size: 3, settings: { ...state().settings, biomeMode: { enabled: false } } });
});
function worm(size = 3) {
  set({ size }); state().initWormMode(9999, 0, 2, null, 20);
  set({ wormGamePhase: 'active', wormPaused: false });
}
function event(kind, n, value = null, id = state().wormRunId) { state().recordWormXp(kind, n, value, id); }
const ids = () => state().xpRun.achievements.map(a => a.id);
it('covers every release progression mode with unique, named feats', () => {
  expect([...new Set(ACHIEVEMENTS.map(a => a.mode))].sort()).toEqual(Object.keys(XP_MODES).sort());
  expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
  expect(ACHIEVEMENTS.every(a => [25, 50, 100].includes(a.xp))).toBe(true);
});
it('tracks colors outside the active objective, even after the base pickup XP cap', () => {
  worm(); event('orbs', 80, 1);
  for (let color = 2; color <= 6; color++) event('orbs', 80 + color, color);
  expect(ids()).toContain('worm-spectrum');
  expect(state().wormMission.progress).toBe(0);
  expect(state().xpRun.breakdown.Orbs).toBe(70);
  const xp = state().playerProgress.xp;
  event('orbs', 86, 6); event('orbs', 1, 5);
  expect(state().playerProgress.xp).toBe(xp);
});
it('pays only the upgrade difference and one discovery bonus for a feat family', () => {
  worm(); for (let c = 1; c <= 6; c++) event('orbs', c, c);
  const family = state().xpRun.achievements.filter(a => a.family === 'worm-colors');
  expect(family.map(a => a.xpEarned)).toEqual([35, 25]);
  expect(readPlayerSave().progress.achievements['worm-spectrum'].count).toBe(1);
  worm(); for (let c = 1; c <= 6; c++) event('orbs', c, c);
  expect(state().xpRun.achievements.filter(a => a.family === 'worm-colors').map(a => a.xpEarned)).toEqual([25, 25]);
});
it('requires eight fresh pickups in one grass activation and ignores paused or stale events', () => {
  worm(); event('element', 0, 'grass'); event('orbs', 7, 1);
  event('element', 0, null); event('element', 0, 'grass'); event('orbs', 8, 1);
  expect(ids()).not.toContain('worm-grass');
  set({ wormPaused: true }); event('orbs', 20, 1); expect(ids()).not.toContain('worm-grass');
  set({ wormPaused: false }); event('orbs', 15, 1);
  expect(ids()).toContain('worm-grass');
  event('element', 0, 'water'); event('element', 0, 'lightning');
  expect(ids()).toContain('worm-elements');
  const oldId = state().wormRunId; state().finishWormXp(false, oldId);
  const earned = state().xpRun.achievements;
  event('orbs', 80, 1); expect(state().xpRun.achievements).toBe(earned);
  worm(); event('element', 0, 'grass', oldId); expect(state().xpRun.featStats).toEqual({});
});
it('reserves the Mega feat for a completed Mega run and never doubles its clear family XP', () => {
  worm(15); state().finishWormXp(true, state().wormRunId);
  expect(ids()).toEqual(['worm-restored', 'worm-mega']);
  expect(state().xpRun.achievements.reduce((sum, a) => sum + a.xpEarned, 0)).toBe(110);
  const xp = state().playerProgress.xp; state().finishWormXp(true, state().wormRunId);
  expect(state().playerProgress.xp).toBe(xp);
});
const modeCases = [
  ['story', 'story-campaign', 'story-stars'], ['cube', 'cube-academy', 'cube-par'],
  ['codex', 'algorithm-codex', 'codex-par'], ['daily', 'story-campaign', 'daily-par'],
  ['freeplay', null, 'freeplay-large'], ['random', null, 'random-efficient'], ['biome', null, 'biome-efficient'],
];
function puzzle(mode, pack, assisted = false) {
  state().resetGame();
  const size = mode === 'freeplay' ? 4 : 3;
  set({ size, activePackId: pack, currentLevel: pack ? 1 : null,
    currentLevelData: pack ? { id: 1, cubeSize: size, par: 5, difficulty: 'easy', ...(mode === 'daily' ? { dailyKey: '2026-09-15' } : {}) } : null,
    cubies: rotateSliceCubies(makeCubies(size), size, 'row', 1, 1),
    randomMode: mode === 'random', settings: { ...state().settings, biomeMode: { enabled: mode === 'biome' } },
  });
  state().setHasShuffled(true, 15);
  if (assisted) state().markXpAssisted();
  set({ cubies: makeCubies(size), moves: 3, gameTime: 20 }); state().setVictory('rubiks');
}
it.each(modeCases)('earns %s feats only through the matching independently solved mode', (mode, pack, special) => {
  puzzle(mode, pack);
  expect(ids()).toContain(`${mode}-clear`); expect(ids()).toContain(special);
  expect(state().xpRun.achievements.every(a => a.id.startsWith(`${mode}-`))).toBe(true);
  const xp = state().playerProgress.xp;
  state().completePuzzleXp(); expect(state().playerProgress.xp).toBe(xp);
});
it.each(modeCases)('keeps assisted %s solves out of the feat collection', (mode, pack) => {
  puzzle(mode, pack, true); expect(ids()).toEqual([]);
  expect(state().playerProgress.achievements).toEqual({});
});
it('reduces puzzle feat XP on replays and remembers paid daily feats through save reload', () => {
  for (let n = 0; n < 4; n++) puzzle('story', 'story-campaign');
  expect(state().xpRun.xp).toBe(0);
  puzzle('daily', 'story-campaign');
  set({ playerProgress: readPlayerSave().progress });
  puzzle('daily', 'story-campaign'); expect(state().xpRun.xp).toBe(0); expect(ids()).toEqual([]);
});
it('keeps Chaos achievements independent of the forecast and pays discovery bonuses once', () => {
  for (const pair of [[1, 4], [2, 5], [3, 6]]) {
    set({ chaosLevel: 0, disparityWinner: null, showDisparityWinner: false });
    state().beginDisparityRound(); state().setChaosLevel(.5);
    state().finishChaosXp(); expect(state().xpRun.achievements).toEqual([]);
    set({ disparityWinner: { pair } }); state().finishChaosXp();
  }
  expect(ids()).toContain('chaos-colors');
  expect(state().playerProgress.chaosColors).toHaveLength(6);
  expect(state().playerProgress.achievements['chaos-round'].count).toBe(3);
  expect(state().xpRun.achievements.find(a => a.id === 'chaos-round').xpEarned).toBe(0);
});
it('tracks Teach sessions separately without replacing a pending puzzle run', () => {
  const puzzleRun = { mode: 'freeplay', id: 123 }; set({ xpRun: puzzleRun });
  state().setTeachModeActive(true);
  for (const key of ['cross:0', 'corners:0', 'middle:0']) state().recordLessonXp('teach', key);
  expect(state().xpRun).toBe(puzzleRun);
  expect(state().xpActivityRuns.teach.achievements.map(a => a.id)).toContain('teach-session');
  state().setTeachModeActive(false); state().setTeachModeActive(true);
  state().recordLessonXp('teach', 'last-layer:0');
  expect(state().xpActivityRuns.teach.achievements.map(a => a.id)).not.toContain('teach-session');
});
it('migrates old progress and rejects malformed achievement history', () => {
  const p = sanitizeProgress({ xp: 300, achievements: { 'worm-grass': { count: 2 }, 'worm-orbs': { count: 99 }, 'demo-intro': { count: -1 } }, chaosColors: [1, 1, 7, '2'], recentGoals: Array(20).fill('orb-starter') });
  expect(p.xp).toBe(300); expect(p.achievements).toEqual({ 'worm-grass': { count: 2 } });
  expect(p.chaosColors).toEqual([1]); expect(p.recentGoals).toHaveLength(6);
  expect(sanitizeProgress({ xp: 300 }).achievements).toEqual({});
});
it('filters impossible heal assignments in final healing and avoids recent goals', () => {
  const other = WORM_MISSIONS.filter(a => a.kind !== 'healed').map(a => a.id);
  expect(startMission(3, 1, {}, { phase: 'finalHealing', earned: other })).toBeNull();
  expect(startMission(0, 1, {}, { recent: ['orb-starter'] }).id).not.toBe('orb-starter');
});
it('renders the complete earned list with a highlight and never pays on remount', () => {
  worm(); for (let c = 1; c <= 6; c++) event('orbs', c, c);
  const earned = state().xpRun.achievements, xp = state().playerProgress.xp;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    act(() => root.render(<AchievementList achievements={earned} />));
    expect(host.querySelectorAll('li')).toHaveLength(2); expect(host.textContent).toContain('Full Spectrum');
    act(() => root.render(<AchievementList key="reopen" achievements={earned} />));
    expect(state().playerProgress.xp).toBe(xp);
    state().setTeachModeActive(true); state().recordLessonXp('quiz', 'cross:0');
    act(() => root.render(<XpReceipt mode="teach" />)); expect(host.textContent).toContain('Read the Cube');
  } finally { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});

it('lets existing players discover feats without repaying old lesson or exploration XP', () => {
  set({ playerProgress: { ...newProgress(), milestones: { 'teach:cross:0': 1, 'teach:corners:0': 1, 'teach:middle:0': 1, 'explore:cubelet': 1 } } });
  state().setTeachModeActive(true);
  for (const key of ['cross:0', 'corners:0', 'middle:0']) state().recordLessonXp('teach', key);
  expect(state().xpActivityRuns.teach.breakdown['Algorithm learned']).toBeUndefined();
  expect(state().xpActivityRuns.teach.achievements.map(a => a.id)).toContain('teach-session');
  state().recordDiscoveryXp('cubelet');
  expect(state().xpActivityRuns.explore.breakdown['Three pairs explored']).toBeUndefined();
  expect(state().xpActivityRuns.explore.achievements.map(a => a.id)).toEqual(['explore-pairs']);
  const xp = state().playerProgress.xp;
  state().beginAchievementActivity('explore'); state().recordDiscoveryXp('cubelet');
  expect(state().playerProgress.xp).toBe(xp);
});
