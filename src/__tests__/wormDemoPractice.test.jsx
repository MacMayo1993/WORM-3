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
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../game/raisedCubie.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { wormExpansion, EXPLODE_AMOUNT } from '../worm/wormExpansion.js';
import { wormBuffs } from '../worm/wormBuffs.js';
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
it('provides abundant orbs on every face and grows a long worm through twelve real pickups', () => {
  lesson('orbs');
  const supply = state().wormPowerups.length;
  expect(supply).toBeGreaterThan(60);
  expect(new Set(state().wormPowerups.map(p => p.dirKey)).size).toBe(6);
  until(() => state().demoWormComplete);
  expect(state().wormSessionOrbs).toBe(12); expect(state().wormBodyTiles).toBe(12); expect(Object.values(state().wormOrbInventory).reduce((a, b) => a + b, 0)).toBe(36);
  const pos = { ...worm.pos.current }; frames(20);
  expect(state().wormPaused).toBe(false); expect(worm.pos.current).not.toEqual(pos);
  expect(state().wormPowerups).toHaveLength(supply);
  expect(WORM_DEMO_LESSONS[state().demoWormLessonIndex].id).toBe('orbs');
});

function collectExplodeOrb() {
  // A heal reward can introduce Explode even though ambient spawns are disabled
  // in the demo. Pick one up through the same contact path as normal gameplay.
  lesson('jump');
  const orb = { x: 2, y: 1, z: 4, dirKey: 'PZ', type: 'explode', id: 'demo-reward', ttl: 999, maxTtl: 999 };
  worm.specials.current = [orb];
  act(() => useGameStore.setState({ wormSpecials: [orb] }));
  until(() => state().wormExplodeActive);
  until(() => worm.expansionAmount.current === EXPLODE_AMOUNT);
  expect(state().explosionT).toBe(EXPLODE_AMOUNT);
  expect(wormExpansion.amount).toBe(EXPLODE_AMOUNT);
}

it.each(['restart', 'next'])('clears the exploded renderer and traversal geometry when practice moves to %s', action => {
  collectExplodeOrb();
  input('jump'); until(() => state().demoWormComplete);
  act(() => action === 'restart' ? state().restartWormDemoLesson() : state().nextWormDemoLesson());
  frame();
  expect(worm.expansionAmount.current).toBe(0);
  expect(wormExpansion.amount).toBe(0);
  expect(state().explosionT).toBe(0);
  expect(state().exploded).toBe(false);
  expect(state().wormExplodeActive).toBe(false);
  expect(wormBuffs.explodeT).toBe(0);
  act(() => state().startWormDemoLesson());
  frames(40);
  expect(state().explosionT).toBe(0);
  expect(worm.headInterpPos.current.toArray().every(Number.isFinite)).toBe(true);
});

it('finishes an Explode pickup in ongoing demo play and preserves its timer through pause', () => {
  collectExplodeOrb();
  const left = wormBuffs.explodeT;
  act(() => state().setWormPaused(true));
  frames(50);
  expect(wormBuffs.explodeT).toBe(left);
  expect(state().explosionT).toBe(EXPLODE_AMOUNT);
  act(() => state().setWormPaused(false));
  until(() => !state().wormExplodeActive && worm.expansionAmount.current === 0, 400);
  expect(state().explosionT).toBe(0);
  expect(wormExpansion.amount).toBe(0);
  expect(state().wormAlive).toBe(true);
});
it('requires a real landing for the single-jump lesson', () => {
  lesson('jump'); input('jump'); until(() => worm.isJumping.current);
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete); expect(worm.isJumping.current).toBe(false);
});
it('requires clearing the staged body and landing, and supports the live Jump now rescue', () => {
  lesson('body-jump');
  expect(state().demoWormTarget).toMatchObject({ x: 2, y: 2, z: 4 });
  until(() => state().wormJumpRescueActive);
  expect(state().demoWormComplete).toBe(false);
  input('jump'); until(() => worm.isJumping.current);
  until(() => state().demoWormProgress === 'Body cleared — land safely');
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete);
  expect(state().wormAlive).toBe(true);
  expect(worm.isJumping.current).toBe(false);
  expect(state().demoWormCompleted).toContain('body-jump');
});
it('completes a planned body jump before the rescue cue, without counting an empty hop', () => {
  lesson('body-jump'); input('turnRight'); input('jump');
  until(() => worm.isJumping.current); until(() => !worm.isJumping.current);
  expect(state().demoWormComplete).toBe(false);
  act(() => state().restartWormDemoLesson()); frame(); frame();
  act(() => state().startWormDemoLesson());
  until(() => worm.pos.current.y === 1 && worm.interpT.current > 0.8);
  input('jump');
  until(() => state().demoWormComplete);
  expect(state().wormAlive).toBe(true);
  expect(state().wormJumpRescueActive).toBe(false);
});
it('counts a double jump only when both presses land in one flight', () => {
  lesson('double-jump'); input('jump'); until(() => worm.isJumping.current);
  // A single hop that lands does not count toward the pair.
  until(() => !worm.isJumping.current);
  expect(state().demoWormComplete).toBe(false); expect(state().demoWormProgress).toBe('0 / 2 jumps');
  input('jump'); until(() => worm.isJumping.current); frames(6);
  const lift = worm.jumpLift();
  input('jump'); until(() => state().demoWormProgress === '2 / 2 jumps');
  // The second arc climbs on from where the first one was, never from the floor.
  expect(worm.jumpLift()).toBeGreaterThanOrEqual(lift * 0.9);
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete); expect(worm.isJumping.current).toBe(false);
});
it('waits for a boost burst and freezes lessons during pause', () => {
  lesson('boost'); input('boost'); until(() => state().wormBoostState === 'active');
  act(() => state().setWormPaused(true)); const pos = { ...worm.pos.current };
  frames(50); expect(worm.pos.current).toEqual(pos); expect(state().wormBoostState).toBe('active'); expect(state().demoWormComplete).toBe(false);
  act(() => state().setWormPaused(false)); until(() => state().demoWormComplete);
});
it.each(['tunnel', 'heal'])('finishes %s only after the tail exits and preserves the correct deposit outcome', id => {
  lesson(id);
  if (id === 'heal') {
    const face = +Object.keys(state().wormOrbInventory).find(face => state().wormOrbInventory[face] > 0);
    expect(worm.orbPickupColorsRef.current).toEqual(Array(2).fill(resolveColors(state().settings)[face]));
  }
  input('jump'); until(() => worm.padFlight.current);
  expect(worm.padFlight.current.padHeight).toBe(WORM_PAD_HEIGHT);
  until(() => state().wormTunnelCount > 0);
  expect(worm.activeTunnel.current.padHeight).toBe(WORM_PAD_HEIGHT);
  expect(worm.activeTunnel.current.padExpansion).toBe(wormRaisedAmount(5));
  expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete, 1600);
  expect(state().wormPhase).toBe('crawling');
  expect(state().wormHealedCount).toBe(id === 'heal' ? 1 : 0);
  if (id === 'heal') expect(Object.values(state().wormOrbInventory).reduce((a, b) => a + b, 0)).toBe(2);
});
it('retries healing during the tunnel ride with fresh charges and working controls', () => {
  lesson('heal'); input('jump'); until(() => state().wormTunnelCount > 0);
  expect(state().demoWormProgress).toBe('Riding through the tunnel…');
  act(() => state().restartWormDemoLesson()); frame(); frame();
  expect(state()).toMatchObject({ wormPhase: 'crawling', wormJumpRescueActive: false,
    wormActiveTunnelColors: null, demoWormComplete: false, wormTunnelCount: 0 });
  expect(Object.values(state().wormOrbInventory).reduce((sum, n) => sum + n, 0)).toBe(6);
  act(() => state().startWormDemoLesson()); input('jump');
  until(() => state().demoWormComplete, 1600);
  expect(state().wormHealedCount).toBe(1);
});
it('walks under a raised tunnel without entering and can retry the jump route', () => {
  lesson('tunnel'); frames(90);
  expect(state().wormTunnelCount).toBe(0); expect(state().demoWormComplete).toBe(false);
  act(() => state().restartWormDemoLesson()); frame(); frame();
  act(() => state().startWormDemoLesson()); input('jump');
  until(() => state().wormTunnelCount > 0);
  expect(worm.activeTunnel.current.padHeight).toBe(WORM_PAD_HEIGHT);
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
it('teaches the real Light Trail and waits until it paints behind the tail', () => {
  input('signature'); frames(3); expect(worm.signature.current.seq).toBe(0);
  lesson('signature'); frames(2);
  act(() => host.querySelector('[aria-label="Light Trail"]').click());
  frame(); expect(state().demoWormComplete).toBe(false);
  until(() => state().demoWormComplete); expect(worm.signature.current.seq).toBe(1);
  expect(worm.signature.current.glowTrail.path.count).toBeGreaterThanOrEqual(2);
});
it('retries the current exercise and blocks Next and early finish until goals are met', () => {
  lesson('magnet'); until(() => state().demoWormComplete);
  act(() => state().nextWormDemoLesson()); frame();
  expect(state().wormMagnetActive).toBe(false); expect(state().demoWormComplete).toBe(false);
  act(() => state().restartWormDemoLesson()); frame(); expect(WORM_DEMO_LESSONS[state().demoWormLessonIndex].id).toBe('orb-shower');
  act(() => state().nextWormDemoLesson()); frame();
  expect(state().demoWormCompleted).not.toContain('orb-shower');
  expect(WORM_DEMO_LESSONS[state().demoWormLessonIndex].id).toBe('orb-shower');
  act(() => state().finishWormDemo()); expect(state().demoWormFinished).toBe(false);
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

it.each(['retry', 'next'])('clears a live body-collision rescue when leaving the ring lesson via %s', action => {
  lesson('surround');
  until(() => worm.pos.current.x === 3 && worm.interpT.current > 0.9); input('turnLeft');
  until(() => worm.pos.current.y === 3 && worm.interpT.current > 0.9); input('turnLeft');
  until(() => worm.pos.current.x === 1 && worm.interpT.current > 0.9); input('turnLeft');
  until(() => state().demoWormComplete);
  input('turnLeft');
  until(() => state().wormJumpRescueActive);
  act(() => action === 'retry' ? state().restartWormDemoLesson() : state().nextWormDemoLesson());
  frame(); frame();
  expect(state().wormJumpRescueActive).toBe(false);
  expect(wormBuffs.jumpRescueT).toBe(0);
  act(() => state().startWormDemoLesson());
  expect(host.querySelector('[aria-label="Turn left"]').disabled).toBe(false);
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
  lesson('heal'); input('jump'); until(() => state().demoWormComplete, 1600);
  expect(state().demoWormFinished).toBe(false);
  expect(state().parityPoints).toBe(points); expect(state().playerProgress.xp).toBe(xp);
  act(() => state().exitDemo());
  expect(state().demoWormTarget).toBeNull(); expect(state().demoWormCompleted).toEqual([]);
});

it('covers every elemental orb and keeps the store lesson count in sync', () => {
  expect(WORM_DEMO_LESSONS).toHaveLength(WORM_DEMO_LESSON_COUNT);
  // Body clearance follows the basic hop, then double jump builds on both.
  expect(WORM_DEMO_LESSONS[WORM_DEMO_LESSONS.findIndex(l => l.id === 'jump') + 1].id).toBe('body-jump');
  expect(WORM_DEMO_LESSONS[WORM_DEMO_LESSONS.findIndex(l => l.id === 'body-jump') + 1].id).toBe('double-jump');
  expect(WORM_DEMO_LESSONS[WORM_DEMO_LESSONS.findIndex(l => l.id === 'double-jump') + 1].id).toBe('boost');
  for (const id of ELEMENTAL_TYPES) expect(WORM_DEMO_LESSONS.some(l => l.id === id)).toBe(true);
});

it('showcases the full Orb Shower, freezes its countdown on pause, and clears it on Retry', () => {
  lesson('orb-shower');
  expect(state().demoWormComplete).toBe(false);
  until(() => state().wormOrbShowerActive);
  expect(worm.orbShowerT.current).toBeGreaterThan(9);
  frames(60);
  expect(state().wormPowerups.length).toBeGreaterThan(24);
  expect(state().demoWormComplete).toBe(false);
  act(() => useGameStore.setState({ wormPaused: true }));
  const left = worm.orbShowerT.current; frames(40);
  expect(worm.orbShowerT.current).toBe(left);
  act(() => useGameStore.setState({ wormPaused: false }));
  until(() => state().demoWormComplete);
  expect(state().wormOrbShowerActive).toBe(false);
  expect(state().wormPowerups.length).toBeGreaterThan(40);
  expect(state().wormSessionOrbs).toBeGreaterThan(0);
  act(() => state().restartWormDemoLesson()); frame();
  expect(worm.orbShowerT.current).toBe(0);
  expect(wormBuffs.orbShowerT).toBe(0);
  expect(state().wormPowerups).toHaveLength(0);
  expect(state().demoWormComplete).toBe(false);
});
