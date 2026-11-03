import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { WORM_DEMO_LESSONS, newWormDemo } from '../game/wormDemoLessons.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));
let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const phase = useGameStore(s => s.wormPhase), alive = useGameStore(s => s.wormAlive);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return <WormCrawlerHUD phase={phase} wormAlive={alive} />;
}
const frame = () => act(() => worm.tick(.05));
function lesson(id) {
  const index = WORM_DEMO_LESSONS.findIndex(l => l.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  act(() => useGameStore.setState({ demoWormLessonIndex: index, demoWormComplete: false, demoWormAttempt: state().demoWormAttempt + 1 }));
  frame(); frame();
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ ...newWormDemo(), cubies: makeCubies(5), size: 5,
    demoMode: true, demoStep: 'worm-traversal', wormHealerMode: true, wormRunId: 777,
    wormCharacter: 'glow', wormAlive: true, wormPaused: false, wormPauseMenuOpen: false,
    wormGamePhase: 'active', wormOrbCount: 0, wormholeInterval: 30, wormSpeed: 1.25, rotationEpoch: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />)); frame(); frame();
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it.each(['classic', 'wiggle', 'inch', 'glow', 'prism', 'mobi'])('plays the optional %s signature with real crawler outcomes', character => {
  lesson(`signature-${character}`);
  expect(state().wormCharacter).toBe(character);
  expect(state().demoWormComplete).toBe(false);
  act(() => state().startWormDemoLesson()); frame();
  if (character !== 'prism') act(() => worm.queueTurn('signature'));
  else {
    // Move into the two-tile pad aim window before launching.
    for (let i = 0; i < 30 && worm.pos.current.y < 1; i++) frame();
    act(() => worm.queueTurn('jump'));
  }
  for (let i = 0; i < 700 && !state().demoWormComplete && state().wormAlive; i++) frame();
  expect(state().demoWormComplete, state().demoWormProgress).toBe(true);
  expect(state().wormAlive).toBe(true);
  if (character === 'prism') {
    expect(Object.values(state().wormOrbInventory).reduce((a, b) => a + b, 0)).toBe(2);
    expect(state().wormHealedCount).toBeGreaterThan(0);
  }
  if (character === 'mobi') expect(state().wormTunnelCount).toBeGreaterThan(0);
});
