import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { WORM_DEMO_LESSONS, newWormDemo } from '../game/wormDemoLessons.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { combatBridge } from '../worm/combat/portalCombat.js';
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
it.each(['combat', 'combat-elements'])('plays %s with live movement, shots and outcome completion', id => {
  lesson(id);
  expect(combatBridge.current.enemies).toHaveLength(1);
  expect(host.querySelector('[aria-label^="Fire parity shot"]')).not.toBeNull();
  expect(state().demoWormComplete).toBe(false);
  act(() => state().startWormDemoLesson()); frame();
  act(() => worm.queueTurn('fire-start'));
  for (let i = 0; i < 120 && !state().demoWormComplete; i++) frame();
  expect(combatBridge.current.kills).toBe(1);
  expect(state().demoWormComplete).toBe(true);
  expect(state().wormPaused).toBe(false);
  if (id === 'combat-elements') expect(combatBridge.current.elementalHits).toBeGreaterThan(0);
  act(() => state().restartWormDemoLesson()); frame();
  expect(combatBridge.current.kills).toBe(0);
  expect(combatBridge.current.fireHeld).toBe(false);
  expect(state().wormPaused).toBe(true);
  lesson('steer'); expect(combatBridge.current).toBeNull();
});
