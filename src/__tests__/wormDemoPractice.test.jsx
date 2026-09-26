import { WORM_DEMO_LESSON_COUNT } from '../game/wormDemoState.js';
import { ELEMENTAL_TYPES } from '../worm/healerWorm/elementalDefs.js';
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { WORM_DEMO_LESSONS, newWormDemo } from '../game/wormDemoLessons.js';
import { DEMO_LEVEL_CONFIGS } from '../components/screens/DemoFlowController.jsx';
import { WORM_DIFFICULTIES } from '../worm/wormDifficulty.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));
let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const phase = useGameStore(s => s.wormPhase);
  const alive = useGameStore(s => s.wormAlive);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return <WormCrawlerHUD phase={phase} wormAlive={alive} />;
}
const frame = () => act(() => worm.tick(0.05));
const frames = n => { for (let i = 0; i < n; i++) frame(); };
const until = (condition, max = 600) => { for (let i = 0; i < max && !condition(); i++) frame(); expect(condition()).toBeTruthy(); };
const input = action => act(() => worm.queueTurn(action));
function lesson(id) {
  act(() => useGameStore.setState({ demoWormLessonIndex: WORM_DEMO_LESSONS.findIndex(l => l.id === id), demoWormComplete: false, demoWormAttempt: state().demoWormAttempt + 1, wormPaused: false }));
  frame(); frame(); act(() => state().startWormDemoLesson());
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ ...newWormDemo(), cubies: makeCubies(5), size: 5,
    demoMode: true, demoStep: 'worm-traversal', wormHealerMode: true, wormRunId: 100,
    wormCharacter: 'glow', wormAlive: true, wormPaused: false, wormPauseMenuOpen: false,
    wormGamePhase: 'active', wormOrbCount: 0, wormholeInterval: 30, wormSpeed: DEMO_LEVEL_CONFIGS['worm-traversal'].wormSpeed, rotationEpoch: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />)); frame(); frame(); act(() => state().startWormDemoLesson());
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('uses Easy speed and keeps moving and accepting controls after steering succeeds', () => {
  expect(state().wormSpeed).toBe(WORM_DIFFICULTIES[0].settings.wormSpeed);
  frames(5); expect(state().demoWormComplete).toBe(false);
  input('turnLeft'); until(() => state().demoWormComplete);
  expect(state().demoWormCompleted).toEqual(['steer']); expect(state().wormPaused).toBe(false);
  expect(host.querySelector('.worm-jump').disabled).toBe(false);
  const pos = { ...worm.pos.current }; frames(20); expect(worm.pos.current).not.toEqual(pos);
  input('jump'); until(() => worm.isJumping.current);
  expect(state().demoWormLessonIndex).toBe(0);
  expect(state().demoWormCompleted).toEqual(['steer']);
  expect(host.textContent).toContain('Keep practicing');
});
it('collects two staged orbs through the production pickup path and gives six charges', () => {
  lesson('orbs'); until(() => state().demoWormComplete);
  expect(state().wormSessionOrbs).toBe(2); expect(state().wormBodyTiles).toBe(2); expect(Object.values(state().wormOrbInventory).reduce((a, b) => a + b, 0)).toBe(6);
  const pos = { ...worm.pos.current }; frames(20);
  expect(state().wormPaused).toBe(false); expect(worm.pos.current).not.toEqual(pos);
  expect(state().wormPowerups).toHaveLength(2);
  expect(WORM_DEMO_LESSONS[state().demoWormLessonIndex].id).toBe('orbs');
});
it.each(['jump', 'double-jump'])('requires a real landing for %s', id => {
  lesson(id); input('jump'); until(() => worm.isJumping.current);
  expect(state().demoWormComplete).toBe(false);
  if (id === 'double-jump') { input('jump'); until(() => state().demoWormProgress === '2 / 2 jumps'); }
  until(() => state().demoWormComplete); expect(worm.isJumping.current).toBe(false);
});
it('waits for a boost burst and freezes lessons during pause', () => {
  lesson('boost'); input('boost'); until(() => state().wormBoostState === 'active');
  act(() => state().setWormPaused(true)); const pos = { ...worm.pos.current };
  frames(50); expect(worm.pos.current).toEqual(pos); expect(state().wormBoostState).toBe('active'); expect(state().demoWormComplete).toBe(false);
  act(() => state().setWormPaused(false)); until(() => state().demoWormComplete);
});
it.each(['tunnel', 'heal'])('finishes %s only after the tail exits and preserves the correct deposit outcome', id => {
  lesson(id); until(() => state().wormTunnelCount > 0);
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete, 1600);
  expect(state().wormPhase).toBe('crawling');
  expect(state().wormHealedCount).toBe(id === 'heal' ? 1 : 0);
  if (id === 'heal') expect(Object.values(state().wormOrbInventory).reduce((a, b) => a + b, 0)).toBe(2);
});
it.each(['rocket', 'magnet', 'water', 'fire', 'lightning'])('stages and completes the actual %s pickup effect', id => {
  lesson(id); expect(state().wormSpecials[0].type).toBe(id);
  until(() => state().demoWormComplete, 800);
});
it('teaches ice jumping and a real nature spring consumption', () => {
  lesson('ice'); until(() => state().wormElementalTheme === 'ice'); frames(35); input('jump'); until(() => state().demoWormComplete);
  lesson('grass'); until(() => state().wormElementalTheme === 'grass'); frames(35);
  input('jump'); until(() => worm.isJumping.current);
  expect(state().demoWormComplete).toBe(false);
  until(() => !worm.isJumping.current);
  expect(worm.elementalPatches.current.size).toBeGreaterThan(0);
  expect(state().demoWormComplete).toBe(false);
  input('jump'); until(() => state().demoWormComplete); expect(worm.jumpSpan.current).toBeGreaterThan(2);
});
it('allows Beacon only in the signature lesson, through the real button bridge', () => {
  input('signature'); frames(3); expect(worm.signature.current.seq).toBe(0);
  lesson('signature'); frames(2);
  act(() => host.querySelector('[aria-label="Light Trail"]').click());
  until(() => state().demoWormComplete); expect(worm.signature.current.seq).toBe(1);
});
it('retries only the current exercise; skipping gives no completion credit and clears old buffs', () => {
  lesson('magnet'); until(() => state().demoWormComplete);
  act(() => state().nextWormDemoLesson()); frame();
  expect(state().wormMagnetActive).toBe(false); expect(state().demoWormComplete).toBe(false);
  act(() => state().restartWormDemoLesson()); frame(); expect(WORM_DEMO_LESSONS[state().demoWormLessonIndex].id).toBe('water');
  act(() => state().nextWormDemoLesson()); frame();
  expect(state().demoWormCompleted).not.toContain('water');
  act(() => state().finishWormDemo()); expect(state().demoWormFinished).toBe(true);
  expect(state().demoWormTarget).toBeNull();
});
it('covers the ring with the current body and heals through the real ring logic', () => {
  lesson('surround');
  until(() => worm.pos.current.x === 3 && worm.interpT.current > 0.9); input('turnLeft');
  until(() => worm.pos.current.y === 3 && worm.interpT.current > 0.9); input('turnLeft');
  until(() => worm.pos.current.x === 1 && worm.interpT.current > 0.9); input('turnLeft');
  until(() => state().demoWormComplete);
  expect(state().wormHealedCount).toBe(1);
  expect(state().wormBodyTiles).toBe(0);
});
it('waits for Try it, honors manual pause after success, and changes lessons only on Next', () => {
  act(() => state().restartWormDemoLesson());
  act(() => state().startWormDemoLesson());
  expect(state().demoWormStarted).toBe(false);
  frame();
  const pos = { ...worm.pos.current }; frames(40);
  expect(worm.pos.current).toEqual(pos); expect(state().demoWormComplete).toBe(false);
  act(() => host.querySelector('[aria-label="Pause"]').click());
  act(() => [...host.querySelectorAll('button')].find(b => b.classList.contains('worm-pause-resume')).click());
  expect(state().wormPaused).toBe(true);
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'Try it').click());
  input('turnRight'); until(() => state().demoWormComplete);
  const donePos = { ...worm.pos.current }; frames(20); expect(worm.pos.current).not.toEqual(donePos);
  act(() => host.querySelector('[aria-label="Pause"]').click());
  const pausedPos = { ...worm.pos.current }; frames(40); expect(worm.pos.current).toEqual(pausedPos);
  act(() => host.querySelector('.worm-pause-resume').click());
  expect(state().wormPaused).toBe(false);
  frames(20); expect(worm.pos.current).not.toEqual(pausedPos);
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'Next').click());
  expect(state().demoWormLessonIndex).toBe(1); expect(state().demoWormComplete).toBe(false);
  expect(state().wormPaused).toBe(true); expect(state().demoWormStarted).toBe(false);
  frame(); const nextPos = { ...worm.pos.current }; frames(20); expect(worm.pos.current).toEqual(nextPos);
});
it('does not finish the chapter after a tunnel and awards no real XP or coins for practice', () => {
  const points = state().parityPoints, xp = state().playerProgress.xp;
  lesson('heal'); until(() => state().demoWormComplete, 1600);
  expect(state().demoWormFinished).toBe(false);
  expect(state().parityPoints).toBe(points); expect(state().playerProgress.xp).toBe(xp);
  act(() => state().exitDemo());
  expect(state().demoWormTarget).toBeNull(); expect(state().demoWormCompleted).toEqual([]);
});

it('covers every elemental orb and keeps the store lesson count in sync', () => {
  expect(WORM_DEMO_LESSONS).toHaveLength(WORM_DEMO_LESSON_COUNT);
  for (const id of ELEMENTAL_TYPES) expect(WORM_DEMO_LESSONS.some(l => l.id === id)).toBe(true);
});
