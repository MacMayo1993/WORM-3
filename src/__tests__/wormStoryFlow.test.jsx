import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { storyLevel } from '../worm/story/levels.js';
import { newProgress } from '../progression/model.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { isHealReady } from '../worm/healerWorm/economy.js';
import { tileKey } from '../worm/healerWorm/wormSim.js';
import { ttAt } from '../worm/circularBuffers.js';
import { getNextSurfacePosition, getActiveTunnels } from '../worm/wormLogic.js';
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));
let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; }, [api]);
  return null;
}
const frame = (dt = 0.02) => act(() => worm.tick(dt));
function begin(id) {
  act(() => state().initWormMode(undefined, undefined, 1.4, 1, 30, null, false, false, id));
  act(() => useGameStore.setState({ wormGamePhase: 'active', wormPaused: false }));
  frame();
  expect(state()).toMatchObject({ wormStoryReady: true, wormPaused: true, wormStoryStarted: false });
  act(() => state().startWormStory());
}
function until(predicate, max = 2000) {
  for (let i = 0; i < max && !predicate(); i++) frame();
  expect(predicate()).toBeTruthy();
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ cubies: makeCubies(5), size: 5, demoMode: false, wormCharacter: 'glow', wormControlMode: 'oriented', animState: null,
    playerProgress: { ...newProgress(), wormStory: { stars: {1:1,2:1,3:1,4:1,5:1}, claimed: {} } } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); state().clearDisparityGame(); vi.restoreAllMocks(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
it('requires cross-face routing for 18 orbs and all six colors, then resets on retry', () => {
  begin(1);
  for (let i = 0; i < 500; i++) frame();
  expect(state().wormStoryResult).toBeNull(); // cruising straight cannot clear it
  expect(state().wormSessionOrbs).toBeLessThan(18);
  begin(1);
  const initialLength = state().wormBodyTiles; expect(initialLength).toBeGreaterThan(0);
  while (!state().wormStoryResult) {
    const orb = state().wormPowerups[0]; expect(orb).toBeTruthy();
    seek(orb, () => !state().wormPowerups.some(p => tileKey(p) === tileKey(orb)));
  }
  expect(state()).toMatchObject({ wormPaused: true, wormAlive: true });
  expect(state().wormBodyTiles).toBe(initialLength + state().wormSessionOrbs);
  expect(state().wormSessionOrbs).toBeGreaterThanOrEqual(18);
  begin(1); expect(state().wormSessionOrbs).toBe(0); expect(state().wormPowerups).toHaveLength(24);
});
it('requires four distinct traversals, keeps the long tail in transit, and does not count repeats', () => {
  begin(2);
  const tunnels = getActiveTunnels(state().cubies, 5);
  expect(tunnels).toHaveLength(4);
  expect(worm.tailLength.current * 0.09).toBeGreaterThan(7.8);
  const route = [tunnels[0], tunnels[0], ...tunnels.slice(1)];
  for (let i = 0; i < route.length; i++) {
    const before = state().wormTunnelCount;
    seek(route[i].entry, () => state().wormTunnelCount > before);
    expect(state().wormStoryResult).toBeNull();
    until(() => worm.phase.current === 'crawling'); frame();
    expect(worm.tunnelPassages.current.length).toBeGreaterThan(0);
    expect(state().wormStoryResult).toBeNull();
    expect(state().wormStoryProgress).toContain(`${Math.max(1, i)}/4 pairs crossed`);
    if (i < route.length - 1) expect(tileKey(state().wormStoryTarget)).not.toBe(tileKey(route[i].entry));
    else expect(state().wormStoryTarget).toBeNull();
  }
  travelUntil(() => !!state().wormStoryResult);
  expect(worm.tunnelPassages.current).toHaveLength(0);
});
it('counts a real body clearance only on landing and requires more than one hop', () => {
  begin(3); until(() => state().wormJumpRescueActive);
  const clock = state().wormStoryProgress; frame(0.2); expect(state().wormStoryProgress).toBe(clock);
  act(() => worm.queueTurn('jump'));
  until(() => worm.isJumping.current);
  expect(state().wormStoryProgress).toContain('0/4 body jumps');
  until(() => !worm.isJumping.current);
  expect(state().wormStoryProgress).toContain('1/4 body jumps');
  expect(state().wormStoryResult).toBeNull();
  begin(3); until(() => !state().wormAlive); expect(state().wormStoryResult).toBeNull();
});
it('stages the increased healing network with enough ordinary matching pickups', () => {
  for (const id of [5, 6]) {
    begin(id); const tunnels = getActiveTunnels(state().cubies, 5);
    expect(tunnels).toHaveLength(storyLevel(id).target);
    expect(state().wormPowerups.length).toBeGreaterThanOrEqual(id === 6 ? 30 : 24);
    for (const color of [1,2,3,4,5,6]) expect(state().wormPowerups.filter(p => state().cubies[p.x][p.y][p.z].stickers[p.dirKey].curr === color).length).toBeGreaterThanOrEqual(4);
  }
});
it('holds objective time and run state while paused or hidden', () => {
  begin(1); frame(); const before = worm.timeAliveRef.current;
  act(() => useGameStore.setState({ wormPaused: true })); for(let i=0;i<50;i++) frame();
  expect(worm.timeAliveRef.current).toBe(before); expect(state().wormStoryResult).toBeNull();
  act(() => useGameStore.setState({ wormPaused: false })); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  for(let i=0;i<50;i++) frame(); expect(worm.timeAliveRef.current).toBe(before);
});
it('cannot win Moving Ground by waiting out six turns without collecting the orbs', () => {
  begin(4); frame();
  act(() => useGameStore.setState({ rotationEpoch: state().rotationEpoch + 6, animState: null }));
  frame(); expect(state().wormStoryResult).toBeNull(); expect(state().wormStoryProgress).toContain('6/6 turns');
});
it('expires with a clear cause and resets the deadline on retry', () => {
  begin(1);
  for (let i = 0; i < 4600 && state().wormAlive; i++) frame();
  expect(state().wormDeathDetails).toMatchObject({ reason: 'story-timeout' });
  expect(state().wormStoryResult).toBeNull();
  begin(1); frame(); expect(state().wormStoryProgress).toContain('90s left');
});

// Navigate through the real surface movement and tunnel triggers. Only steering
// is automated; no teleports, inventory grants or heal callbacks bypass physics.
function seek(target, done) {
  let steered = '';
  for (let n = 0; n < 10000 && !done() && state().wormAlive; n++) {
    const here = tileKey(worm.pos.current);
    if (worm.phase.current === 'crawling' && here !== tileKey(target) && steered !== here) {
      const blocked = new Set();
      for (const tunnel of getActiveTunnels(state().cubies, 5)) for (const mouth of [tunnel.entry, tunnel.exit]) {
        if (tileKey(mouth) !== tileKey(target)) blocked.add(tileKey(mouth));
      }
      for (let i = 1; i < Math.min(worm.tileTrail.current.count, Math.ceil(worm.tailLength.current * 0.09)); i++) blocked.add(ttAt(worm.tileTrail.current, i));
      const queue = [{ pos: worm.pos.current, first: null }], seen = new Set([here]);
      let direction;
      for (let i = 0; i < queue.length && !direction; i++) {
        const node = queue[i];
        for (const dir of ['up', 'right', 'down', 'left']) {
          const pos = getNextSurfacePosition(node.pos, dir, 5), key = tileKey(pos);
          if (blocked.has(key) || seen.has(key)) continue;
          const first = node.first || dir;
          if (key === tileKey(target)) { direction = first; break; }
          seen.add(key); queue.push({ pos, first });
        }
      }
      expect(direction, `route to ${tileKey(target)} from ${here}`).toBeTruthy();
      act(() => worm.queueTurn(direction)); steered = here;
    }
    frame();
  }
  const detail = JSON.stringify({ target, pos: worm.pos.current, phase: worm.phase.current, progress: state().wormStoryProgress, death: state().wormDeathDetails, heals: state().wormHealedCount, paused: state().wormPaused });
  expect(state().wormAlive, detail).toBe(true); expect(done(), detail).toBeTruthy();
}
function travelUntil(done) {
  let steered = '';
  for (let n = 0; n < 10000 && !done() && state().wormAlive; n++) {
    const here = tileKey(worm.pos.current);
    if (worm.phase.current === 'crawling' && steered !== here) {
      const blocked = new Set(getActiveTunnels(state().cubies, 5).flatMap(t => [tileKey(t.entry), tileKey(t.exit)]));
      for (let i = 1; i < Math.min(worm.tileTrail.current.count, Math.ceil(worm.tailLength.current * 0.09)); i++) blocked.add(ttAt(worm.tileTrail.current, i));
      const direction = [worm.moveDir.current, 'up', 'right', 'down', 'left'].find(dir => !blocked.has(tileKey(getNextSurfacePosition(worm.pos.current, dir, 5))));
      expect(direction).toBeTruthy(); act(() => worm.queueTurn(direction)); steered = here;
    }
    frame();
  }
  expect(state().wormAlive, JSON.stringify(state().wormDeathDetails)).toBe(true);
  expect(done(), state().wormStoryProgress).toBeTruthy();
}
it.each([5, 6])('can collect the resources and heal every authored pair for level %i through real movement', id => {
  begin(id);
  // Scheduler assertions live in wormHazardOrdering; this exercises the actual
  // routes, deposits, transit and finite supply without substituting heal calls.
  for (let pair = 0; pair < storyLevel(id).target; pair++) {
    const tunnel = getActiveTunnels(state().cubies, 5)[0], mouth = tunnel.entry;
    const color = state().cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey].curr;
    while (state().wormOrbInventory[color] < 6) {
      const orb = state().wormPowerups.find(p => state().cubies[p.x][p.y][p.z].stickers[p.dirKey].curr === color);
      expect(orb).toBeTruthy();
      seek(orb, () => !state().wormPowerups.some(p => tileKey(p) === tileKey(orb)));
    }
    const before = state().wormTunnelCount;
    seek(mouth, () => state().wormTunnelCount > before);
    travelUntil(() => state().wormHealedCount >= pair + 1);
  }
  expect(getActiveTunnels(state().cubies, 5)).toHaveLength(0);
  if (id === 6) expect(state().wormStoryResult).toBeNull(); // turns + 30 orbs still required
});

it('collects a real authored rocket, lands before credit, then offers a magnet', () => {
  act(() => useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i+1, 1])), claimed: {} } } }));
  begin(7);
  expect(state().wormEnemiesEnabled).toBe(false);
  const rocket = state().wormSpecials[0]; expect(rocket.type).toBe('rocket');
  seek(rocket, () => state().wormRocketActive);
  expect(state().wormStoryResult).toBeNull();
  travelUntil(() => !state().wormRocketActive);
  frame();
  expect(state().wormSpecials[0].type).toBe('magnet');
  expect(state().wormStoryResult).toBeNull();
});
it('enables Story enemies independently of the Free Play option and rejects stale bomb events', () => {
  act(() => useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i+1, 1])), claimed: {} } } }));
  begin(9); frame();
  expect(state()).toMatchObject({ wormEnemiesEnabled: true, wormCombatMode: false, xpRun: null, wormMission: null });
  expect(worm.storyBombsNeeded()).toBe(true);
  act(() => worm.recordStoryBomb(1)); expect(worm.storyBombsNeeded()).toBe(true);
  act(() => worm.recordStoryBomb(1)); expect(worm.storyBombsNeeded()).toBe(true);
  act(() => useGameStore.setState({ wormPaused: true }));
  act(() => worm.recordStoryBomb(2)); expect(worm.storyBombsNeeded()).toBe(true);
  act(() => useGameStore.setState({ wormPaused: false }));
  act(() => worm.recordStoryBomb(2)); expect(worm.storyBombsNeeded()).toBe(false);
  begin(9); expect(worm.storyBombsNeeded()).toBe(true);
});

it('keeps deposited tunnels open until the ring and signature objectives are met', () => {
  act(() => useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i+1, 1])), claimed: {} } } }));
  begin(9);
  // Exercise deposits without the independent combat director.
  act(() => useGameStore.setState({ wormEnemiesEnabled: false }));
  const mouth = getActiveTunnels(state().cubies, 5)[0].entry;
  const color = state().cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey].curr;
  while (state().wormOrbInventory[color] < 6) {
    const orb = state().wormPowerups.find(p => state().cubies[p.x][p.y][p.z].stickers[p.dirKey].curr === color);
    seek(orb, () => !state().wormPowerups.some(p => tileKey(p) === tileKey(orb)));
  }
  expect(state().wormHealedCount).toBe(0);
  seek(mouth, () => state().wormTunnelCount > 0);
  travelUntil(() => worm.phase.current === 'crawling' && worm.tunnelPassages.current.length === 0);
  expect(state().wormHealedCount).toBe(0);
  expect(getActiveTunnels(state().cubies, 5)).toHaveLength(4);
  expect(Object.values(state().wormHealingProgress).some(p => isHealReady(p.deposited))).toBe(true);
});

it('Classic adds 50 percent more Story orbs without changing the authored tunnel objective', () => {
  for (const level of [1, 6]) {
    act(() => useGameStore.setState({ wormCharacter: 'glow' }));
    begin(level);
    const ordinaryOrbs = state().wormPowerups.length;
    const tunnels = getActiveTunnels(state().cubies, 5).length;
    act(() => useGameStore.setState({ wormCharacter: 'classic' }));
    begin(level);
    expect(state().wormPowerups).toHaveLength(Math.ceil(ordinaryOrbs * 1.5));
    expect(getActiveTunnels(state().cubies, 5)).toHaveLength(tunnels);
  }
});
