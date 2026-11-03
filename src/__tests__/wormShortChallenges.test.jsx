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
const input = action => act(() => worm.queueTurn(action));
const at = (x, y) => until(() => worm.pos.current.x === x && worm.pos.current.y === y && worm.pos.current.dirKey === 'PZ' && worm.interpT.current > .8);
function collectRoute() {
  at(2, 1); input('turnRight');
  at(4, 1); input('turnLeft');
  at(4, 4); input('turnLeft');
  at(2, 4); input('turnLeft');
  until(() => worm.moveDir.current === 'down'); input('jump');
}
const until = (condition, max = 1500) => { for (let i = 0; i < max && !condition(); i++) frame(); expect(condition(), JSON.stringify({ pos:worm.pos.current, alive:state().wormAlive, death:state().wormDeathDetails, progress:state().demoWormProgress })).toBeTruthy(); };
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
  expect(state().wormPowerups).toHaveLength(4);
  expect(Object.values(state().wormOrbInventory).reduce((a,b) => a+b,0)).toBe(0);
  act(() => state().nextWormDemoLesson()); expect(state().demoWormLessonIndex).toBe(0);
  act(() => state().startWormDemoLesson());
  collectRoute();
  expect(state().wormSessionOrbs).toBe(4);
  expect(state().wormPowerups.filter(o => o.challengeSupply)).toHaveLength(0);
  expect(state().demoWormComplete).toBe(false);
  until(() => state().wormTunnelCount > 0);
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete);
  expect(state().wormHealedCount).toBe(1);
  expect(worm.tunnelPassages.current).toHaveLength(0);
  expect(state().demoWormCompleted).toEqual(['collect-heal']);
  expect(host.textContent).toContain('One sealed pair');
  expect(state().wormPaused).toBe(true);
  act(() => host.querySelector('[aria-label="Pause"]').click());
  act(() => host.querySelector('.worm-pause-resume').click());
  expect(state().wormPaused).toBe(true);
  act(() => state().nextWormDemoLesson()); frame(); frame();
  expect(wormDemoLesson(state()).id).toBe('body-route');
  expect(state().wormSessionOrbs).toBe(0);
  expect(state().wormHealedCount).toBe(0);
});

it('a retry resets the inventory, route, completion and attempt without changing the challenge', () => {
  act(() => state().startWormDemoLesson()); until(() => state().wormSessionOrbs === 1);
  act(() => state().restartWormDemoLesson()); frame(); frame();
  expect(state().demoWormLessonIndex).toBe(0);
  expect(state().demoWormComplete).toBe(false);
  expect(state().demoWormStarted).toBe(false);
  expect(state().wormSessionOrbs).toBe(0);
  expect(state().wormPowerups).toHaveLength(4);
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

it('requires a real double body crossing, a safe landing and three routed pickups', () => {
  act(() => state().skipWormDemoLesson(0)); frame(); frame(); act(() => state().startWormDemoLesson());
  at(2, 1); input('jump'); until(() => worm.isJumping.current && worm.jumpT.current >= .4); input('jump');
  at(2, 2); input('turnRight');
  at(4, 2); input('turnLeft');
  expect(state().demoWormComplete).toBe(false);
  at(4, 4); input('turnLeft');
  until(() => state().demoWormComplete);
  expect(state().wormSessionOrbs).toBe(3);
  expect(state().wormAlive).toBe(true);
  expect(worm.isJumping.current).toBe(false);
  expect(state().demoWormCompleted).toEqual(['body-route']);
});

it('grows from the four corners before completing a real ring heal', () => {
  act(() => state().skipWormDemoLesson(0)); act(() => state().skipWormDemoLesson(1)); frame(); frame();
  act(() => state().startWormDemoLesson());
  at(4, 1); input('turnRight'); at(4, 0); input('turnRight');
  at(0, 0); input('turnRight'); at(0, 4); input('turnRight');
  at(4, 4); input('turnRight');
  expect(state().wormSessionOrbs).toBe(4); expect(state().demoWormComplete).toBe(false);
  at(4, 1); input('turnRight'); at(3, 1); input('turnRight');
  at(3, 3); input('turnLeft'); at(1, 3); input('turnLeft'); at(1, 1); input('turnLeft');
  until(() => state().demoWormComplete);
  expect(state().wormAlive).toBe(true); expect(state().wormHealedCount).toBe(1);
});

it('folds the running instructions away and pauses the clock while help is open', () => {
  const button = name => [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === name || b.textContent === name);
  act(() => button('Start challenge').click()); frame();
  expect(host.querySelector('.worm-challenge-details')).toBeNull();
  expect(button('Skip challenge')).toBeUndefined();
  act(() => button('Challenge options').click());
  expect(state().wormPaused).toBe(true);
  const before = state().demoWormProgress;
  for (let i = 0; i < 50; i++) frame();
  expect(state().demoWormProgress).toBe(before);
  expect(host.textContent).toContain(WORM_SHORT_CHALLENGES[0].instruction);
  act(() => button('Resume').click());
  expect(state().wormPaused).toBe(false);
  expect(host.querySelector('.worm-challenge-details')).toBeNull();
});

it('does not charge tunnel travel, rejects a late completion, and resets the attempt clock', () => {
  const challenge = WORM_SHORT_CHALLENGES[0], sim = makeWormSim(5);
  let practice = stageWormPractice(sim, 5, challenge);
  const live = { wormPhase: 'crawling', wormSessionOrbs: 0, wormTunnelCount: 0 };
  sim.timeAlive = 4; readWormPractice(sim, practice, challenge, live, 5, .05);
  sim.phase = 'tunnel'; sim.timeAlive = 14;
  readWormPractice(sim, practice, challenge, { ...live, wormPhase: 'tunnel' }, 5, .05);
  expect(practice.elapsed).toBe(4);
  sim.phase = 'crawling'; sim.timeAlive += challenge.timeLimit;
  sim.healed = 1; sim.powerups = [];
  const result = readWormPractice(sim, practice, challenge, { ...live, wormSessionOrbs: 4, wormTunnelCount: 1 }, 5, .05);
  expect(result).toMatchObject({ done: false, failed: true });
  practice = stageWormPractice(sim, 5, challenge);
  expect(readWormPractice(sim, practice, challenge, live, 5, .05)).toMatchObject({ done: false, failed: false });
  expect(practice.elapsed).toBe(0);
});

it('ends an expired attempt without awarding completion, then retries with a fresh clock', () => {
  act(() => state().startWormDemoLesson()); input('turnRight');
  until(() => !state().wormAlive);
  expect(state().wormDeathDetails.reason).toBe('challenge-timeout');
  expect(state().demoWormCompleted).toEqual([]);
  expect(state().demoWormComplete).toBe(false);
  expect(host.textContent).toContain('Time is up');
  act(() => state().nextWormDemoLesson()); expect(state().demoWormLessonIndex).toBe(0);
  act(() => state().restartWormDemoLesson()); frame(); frame();
  expect(state().wormAlive).toBe(true); expect(state().demoWormStarted).toBe(false);
  act(() => state().startWormDemoLesson()); frame();
  expect(state().demoWormProgress).toContain('25s');
});

it('does not substitute a single crossing or an empty double jump for the double-crossing goal', () => {
  const challenge = WORM_SHORT_CHALLENGES[1], sim = makeWormSim(5);
  const practice = stageWormPractice(sim, 5, challenge);
  const live = { wormPhase: 'crawling', wormSessionOrbs: 3 };
  sim.powerups = []; practice.bodyJumps = 1;
  expect(readWormPractice(sim, practice, challenge, live, 5, 0).done).toBe(false);
  practice.bodyJumps = 0; sim.jumpCount = 2; sim.isJumping = true;
  expect(readWormPractice(sim, practice, challenge, live, 5, 0).done).toBe(false);
  practice.doubleCrossing = true; sim.isJumping = false; practice.bodyJumps = 1;
  expect(readWormPractice(sim, practice, challenge, live, 5, 0).done).toBe(true);
});

it('counts the authored supply, not unrelated bonus orbs', () => {
  const challenge = WORM_SHORT_CHALLENGES[0], sim = makeWormSim(5);
  const practice = stageWormPractice(sim, 5, challenge);
  sim.healed = 1;
  const live = { wormPhase: 'crawling', wormSessionOrbs: 20, wormTunnelCount: 1 };
  expect(readWormPractice(sim, practice, challenge, live, 5, 0).done).toBe(false);
  sim.powerups = [{ type: 'apple', x: 0, y: 0, z: 4, dirKey: 'PZ' }];
  expect(readWormPractice(sim, practice, challenge, live, 5, 0).done).toBe(true);
});
