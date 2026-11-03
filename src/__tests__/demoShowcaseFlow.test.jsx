import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateAlignedSlice } from '../game/tileOrientation.js';
import { newWormDemo, wormDemoLesson, WORM_DEMO_LESSONS } from '../game/wormDemoLessons.js';
import { WORM_SHOWCASE_IDS } from '../game/wormDemoCatalog.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { WORM_DIFFICULTIES } from '../worm/wormDifficulty.js';
let frameCb, worm;
vi.mock('@react-three/fiber', async original => ({ ...await original(), useFrame: cb => { frameCb = cb; }, useThree: () => ({}) }));
vi.mock('../worm/useWormCrawler.js', async original => {
  const real = await original();
  return { ...real, useWormCrawler: (...args) => { worm = real.useWormCrawler(...args); return worm; } };
});
vi.mock('../worm/healerWorm/elementalWarmup.js', () => ({ warmUpElementalSkins: vi.fn() }));
vi.mock('../worm/healerWorm/HealerBombs.jsx', () => ({ HealerBombs: () => null, FLAME_TEX: null }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));
import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';
const state = () => useGameStore.getState();
const shuffle = (_moves, done) => done();
const rotate = (axis, dir, slice) => state().setRotatedCubies(c => rotateAlignedSlice(c, 5, axis, slice, dir));
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  HealerWormMode3DWrapper({ cubies, size: 5, onAnimatedShuffle: shuffle, onRotate: rotate });
  return null; // Run all scheduler and simulation hooks without WebGL renderers.
}
const frame = () => act(() => frameCb({}, .05));
const input = command => act(() => worm.queueTurn(command));
function until(predicate, limit = 1600) {
  for (let i = 0; i < limit && !predicate() && state().wormAlive; i++) frame();
  expect(predicate(), `${wormDemoLesson(state()).id}: ${state().demoWormProgress}; alive=${state().wormAlive}; paused=${state().wormPaused}; game=${state().wormGamePhase}; phase=${worm.phase.current}; tunnel=${worm.tunnelProgress.current}; pos=${JSON.stringify(worm.pos.current)}`).toBeTruthy();
}
function ring() {
  until(() => worm.pos.current.x === 3 && worm.interpT.current > .9); input('turnLeft');
  until(() => worm.pos.current.y === 3 && worm.interpT.current > .9); input('turnLeft');
  until(() => worm.pos.current.x === 1 && worm.interpT.current > .9); input('turnLeft');
}
it('plays all 13 curated scenes in order with real simulation and scheduler outcomes', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ ...newWormDemo(), demoWormCourse: 'showcase', cubies: makeCubies(5), size: 5,
    demoMode: true, demoStep: 'worm-traversal', wormHealerMode: true, wormRunId: 999,
    wormCharacter: 'glow', wormAlive: true, wormPaused: false, wormPauseMenuOpen: false,
    wormCombatMode: false, wormStoryLevel: null, wormEnemiesEnabled: false,
    wormGamePhase: 'active', wormOrbCount: 0, wormholeInterval: 30,
    wormSpeed: WORM_DIFFICULTIES[0].settings.wormSpeed, rotationEpoch: 0 });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    act(() => root.render(<Harness />));
    for (const id of WORM_SHOWCASE_IDS) {
      until(() => state().demoWormPrepared);
      expect(wormDemoLesson(state()).id).toBe(id);
      expect(state().demoWormComplete).toBe(false);
      act(() => state().startWormDemoLesson()); frame();
      if (id === 'collect-heal') { until(() => state().wormSessionOrbs >= 2); input('jump'); }
      if (id === 'body-jump') { until(() => state().wormJumpRescueActive); input('jump'); }
      if (id === 'surround' || id === 'bomb') ring();
      if (id === 'fire') { until(() => worm.elementalType.current === 'fire' && worm.elementalFocusT.current === 0); input('boost'); }
      if (id === 'air') { until(() => worm.elementalType.current === 'air' && worm.elementalFocusT.current === 0); input('jump'); }
      if (id === 'combat' || id === 'combat-elements') input('fire-start');
      if (id === 'fusion-slipstream') { until(() => worm.elementalPair.current === 'water' && worm.elementalType.current === 'ice' && worm.elementalFocusT.current === 0); input('turnLeft'); }
      if (id === 'signature') input('signature');
      until(() => state().demoWormComplete, 2400);
      expect(state().demoWormCompleted).toContain(id);
      expect(state().wormAlive).toBe(true);
      act(() => state().nextWormDemoLesson());
      frame();
    }
    expect(state().demoWormFinished).toBe(true);
    expect(state().demoWormCompleted).toEqual(WORM_SHOWCASE_IDS);
    expect(state().demoWormSkipped).toEqual([]);
  } finally { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
}, 30000);


it.each(['conductor', 'plasma', 'current', 'firestorm', 'cryostorm', 'grounded', 'lightning-air'])(
  'plays the real %s storm fusion effect and clears it on Retry', fusion => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
    const index = WORM_DEMO_LESSONS.findIndex(l => l.id === `fusion-${fusion}`);
    useGameStore.setState({ ...newWormDemo(), demoWormLessonIndex: index, cubies: makeCubies(5), size: 5,
      demoMode: true, demoStep: 'worm-traversal', wormHealerMode: true, wormRunId: 1001,
      wormCharacter: 'glow', wormAlive: true, wormPaused: false, wormPauseMenuOpen: false,
      wormCombatMode: false, wormStoryLevel: null, wormEnemiesEnabled: false,
      wormGamePhase: 'active', wormOrbCount: 0, wormholeInterval: 30,
      wormSpeed: WORM_DIFFICULTIES[0].settings.wormSpeed, rotationEpoch: 0 });
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    try {
      act(() => root.render(<Harness />)); until(() => state().demoWormPrepared);
      expect(state().demoWormHazardCleared).toBeNull();
      act(() => state().startWormDemoLesson());
      until(() => state().demoWormHazardCleared === `fusion:${fusion}`, 1600);
      expect(state().wormAlive).toBe(true);
      if (['plasma', 'firestorm'].includes(fusion)) expect([...worm.elementalPatches.current.values()].some(p => p.type === 'fire')).toBe(true);
      if (fusion === 'cryostorm') expect([...worm.elementalPatches.current.values()].some(p => p.type === 'frost')).toBe(true);
      if (fusion === 'grounded') expect([...worm.elementalPatches.current.values()].some(p => p.type === 'grass' && p.charged)).toBe(true);
      if (fusion === 'lightning-air') expect(worm.staticT.current).toBeGreaterThan(0);
      if (fusion === 'conductor') expect(worm.chargedTunnels.current.size).toBeGreaterThanOrEqual(2);
      act(() => state().restartWormDemoLesson()); frame();
      expect(state().demoWormHazardCleared).toBeNull();
      for (let i = 0; i < 100; i++) frame();
      expect(state().demoWormHazardCleared).toBeNull();
    } finally { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
  });
