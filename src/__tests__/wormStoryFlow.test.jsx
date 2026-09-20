import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { newProgress } from '../progression/model.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
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
it('collects four authored orbs without respawns, completes, and resets on retry', () => {
  begin(1); until(() => !!state().wormStoryResult);
  expect(state()).toMatchObject({ wormSessionOrbs: 4, wormPaused: true, wormAlive: true });
  expect(state().wormPowerups).toHaveLength(0);
  begin(1); expect(state().wormSessionOrbs).toBe(0); expect(state().wormPowerups).toHaveLength(4);
});
it('keeps the tunnel objective active until the tail has continuously cleared its exit', () => {
  begin(2); until(() => state().wormTunnelCount > 0);
  expect(state().wormStoryResult).toBeNull();
  until(() => worm.phase.current === 'crawling');
  expect(worm.tunnelPassages.current.length).toBeGreaterThan(0); expect(state().wormStoryResult).toBeNull();
  until(() => !!state().wormStoryResult);
  expect(worm.tunnelPassages.current).toHaveLength(0); expect(state().wormAlive).toBe(true);
});
it('requires jumping across the authored body and landing; a body collision still kills', () => {
  begin(3); until(() => state().wormJumpRescueActive);
  expect(state().wormStoryResult).toBeNull();
  act(() => worm.queueTurn('jump'));
  until(() => state().wormStoryProgress === 'Clear! Land safely.');
  expect(state().wormStoryResult).toBeNull(); expect(worm.isJumping.current).toBe(true);
  until(() => !!state().wormStoryResult); expect(worm.isJumping.current).toBe(false);
  begin(3); until(() => !state().wormAlive); expect(state().wormStoryResult).toBeNull();
});
it('authors a matching-color collector pair and exactly three restoration pairs', () => {
  begin(5); until(() => state().wormSessionOrbs === 2);
  const target = state().wormStoryTarget;
  const color = state().cubies[target.x][target.y][target.z].stickers[target.dirKey].curr;
  expect(state().wormOrbInventory[color]).toBeGreaterThanOrEqual(2);
  expect(getActiveTunnels(state().cubies, 5)).toHaveLength(1);
  begin(6); expect(getActiveTunnels(state().cubies, 5)).toHaveLength(3);
  expect(state().wormPowerups).toHaveLength(24);
});
it('holds objective time and run state while paused or hidden', () => {
  begin(1); frame(); const before = worm.timeAliveRef.current;
  act(() => useGameStore.setState({ wormPaused: true })); for(let i=0;i<50;i++) frame();
  expect(worm.timeAliveRef.current).toBe(before); expect(state().wormStoryResult).toBeNull();
  act(() => useGameStore.setState({ wormPaused: false })); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  for(let i=0;i<50;i++) frame(); expect(worm.timeAliveRef.current).toBe(before);
});
it('waits for a committed and settled layer turn before awarding Moving Ground', () => {
  begin(4); frame(); expect(state().wormStoryResult).toBeNull();
  act(() => useGameStore.setState({ rotationEpoch: state().rotationEpoch + 1, animState: { axis: 'col', sliceIndex: 0, dir: 1 } }));
  frame(); expect(state().wormStoryResult).toBeNull();
  act(() => useGameStore.setState({ animState: null })); frame();
  expect(state().wormStoryResult).toMatchObject({ levelId: 4 });
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
  expect(state().wormAlive).toBe(true); expect(done()).toBeTruthy();
}
it('plays Color Collector from its pickup lane through the matching mouth and tail clearance', () => {
  begin(5); until(() => state().wormSessionOrbs === 2);
  seek(state().wormStoryTarget, () => state().wormHealedCount === 1);
  until(() => !!state().wormStoryResult);
  expect(getActiveTunnels(state().cubies, 5)).toHaveLength(0);
});
it('can restore all three authored pairs using only the placed orbs and surface steering', () => {
  begin(6);
  for (let pair = 0; pair < 3; pair++) {
    const tunnel = getActiveTunnels(state().cubies, 5)[0], mouth = tunnel.entry;
    const color = state().cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey].curr;
    while (state().wormOrbInventory[color] < 6) {
      const orb = state().wormPowerups.find(p => state().cubies[p.x][p.y][p.z].stickers[p.dirKey].curr === color);
      expect(orb).toBeTruthy();
      seek(orb, () => !state().wormPowerups.some(p => tileKey(p) === tileKey(orb)));
    }
    seek(mouth, () => state().wormHealedCount === pair + 1);
    until(() => worm.phase.current === 'crawling');
  }
  until(() => !!state().wormStoryResult);
  expect(getActiveTunnels(state().cubies, 5)).toHaveLength(0);
  expect(state().wormStoryResult).toMatchObject({ levelId: 6 });
});

it('Classic adds 50 percent more Story orbs without changing the authored tunnel objective', () => {
  act(() => useGameStore.setState({ wormCharacter: 'classic' }));
  begin(1); expect(state().wormPowerups).toHaveLength(6);
  until(() => !!state().wormStoryResult);
  expect(state().wormSessionOrbs).toBe(4);
  expect(state().wormPowerups).toHaveLength(2);
  begin(6); expect(state().wormPowerups).toHaveLength(36);
  expect(getActiveTunnels(state().cubies, 5)).toHaveLength(3);
});
