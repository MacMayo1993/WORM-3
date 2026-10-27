import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { newWormDemo, wormPracticeCount } from '../game/wormDemoState.js';
import { wormDemoLesson } from '../game/wormDemoLessons.js';
import { WORM_SHORT_CHALLENGES } from '../game/wormShortChallenges.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { stageWormPractice, readWormPractice } from '../worm/healerWorm/demoPractice.js';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn() }));
let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; }, [api]);
  return <WormCrawlerHUD phase="crawling" wormAlive />;
}
const frame = () => act(() => worm.tick(0.05));
const until = (condition, max = 1500) => { for (let i = 0; i < max && !condition(); i++) frame(); expect(condition()).toBeTruthy(); };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ ...newWormDemo(), demoWormCourse: 'challenges', cubies: makeCubies(5), size: 5,
    demoMode: true, demoStep: 'worm-traversal', wormHealerMode: true, wormRunId: 101,
    wormStoryLevel: null, wormCombatMode: false, wormEnemiesEnabled: false,
    wormCharacter: 'glow', wormAlive: true, wormPaused: true, wormPauseMenuOpen: false,
    wormGamePhase: 'active', wormOrbCount: 0, wormholeInterval: 30, wormSpeed: 1.25, rotationEpoch: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />)); frame(); frame();
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

it('collects real orbs, jumps onto the pad, and waits for the tail to clear before success', () => {
  expect(state().wormPowerups).toHaveLength(2);
  expect(Object.values(state().wormOrbInventory).reduce((a,b) => a+b,0)).toBe(0);
  act(() => state().nextWormDemoLesson()); expect(state().demoWormLessonIndex).toBe(0);
  act(() => state().startWormDemoLesson());
  until(() => state().wormSessionOrbs === 2);
  expect(state().demoWormComplete).toBe(false);
  act(() => worm.queueTurn('jump'));
  until(() => state().wormTunnelCount > 0);
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete);
  expect(state().wormHealedCount).toBe(1);
  expect(worm.tunnelPassages.current).toHaveLength(0);
  expect(state().demoWormCompleted).toEqual(['collect-heal']);
  expect(host.textContent).toContain('sealed both linked mouths');
  act(() => state().nextWormDemoLesson()); frame(); frame();
  expect(wormDemoLesson(state()).id).toBe('body-route');
  expect(state().wormSessionOrbs).toBe(0);
  expect(state().wormHealedCount).toBe(0);
});

it('a retry resets the inventory, route, completion and attempt without changing the challenge', () => {
  act(() => state().startWormDemoLesson()); until(() => state().wormSessionOrbs === 2);
  act(() => state().restartWormDemoLesson()); frame(); frame();
  expect(state().demoWormLessonIndex).toBe(0);
  expect(state().demoWormComplete).toBe(false);
  expect(state().demoWormStarted).toBe(false);
  expect(state().wormSessionOrbs).toBe(0);
  expect(state().wormPowerups).toHaveLength(2);
});

it('uses the short course length and does not claim skipped tasks as completed', () => {
  expect(wormPracticeCount(state())).toBe(WORM_SHORT_CHALLENGES.length);
  act(() => state().skipWormDemoLesson(0));
  expect(state().demoWormLessonIndex).toBe(1);
  expect(state().demoWormCompleted).toEqual([]);
  act(() => state().skipWormDemoLesson(1));
  act(() => state().skipWormDemoLesson(2));
  expect(state().demoWormFinished).toBe(true);
  expect(state().demoWormCompleted).toEqual([]);
});

it('cannot complete a crossing by merely jumping, or a ring by merely approaching', () => {
  for (const challenge of WORM_SHORT_CHALLENGES.slice(1)) {
    const sim = makeWormSim(5);
    const practice = stageWormPractice(sim, 5, challenge);
    sim.isJumping = false;
    practice.sawJump = true;
    expect(readWormPractice(sim, practice, challenge, { wormSessionOrbs: 0 }, 5, 0).done).toBe(false);
    expect(practice.target).not.toBeNull();
  }
});
