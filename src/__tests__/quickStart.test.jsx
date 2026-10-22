import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi, describe } from 'vitest';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { requestQuickStart, beginRun, runStart } from '../worm/healerWorm/runStart.js';
import { storyArrivalPose, arrivalSeconds, STORY_ARRIVAL_SECONDS, STORY_ARRIVAL_QUICK_SECONDS } from '../worm/healerWorm/storyArrival.js';
import { commitShuffleNow } from '../hooks/useAnimation.js';
import { applyTileMove } from '../game/tileOrientation.js';
import { buildWormScramble } from '../worm/healerWorm/scramble.js';

let frameCb, worm;
vi.mock('@react-three/fiber', async importOriginal => ({
  ...await importOriginal(), useFrame: cb => { frameCb = cb; }, useThree: () => ({}),
}));
vi.mock('../worm/useWormCrawler.js', () => ({ useWormCrawler: () => worm }));
vi.mock('../worm/healerWorm/elementalWarmup.js', () => ({ warmUpElementalSkins: vi.fn() }));
vi.mock('../worm/healerWorm/HealerBombs.jsx', () => ({ HealerBombs: () => null, FLAME_TEX: null }));
vi.mock('../utils/feel.js', async importOriginal => ({ ...await importOriginal(), feel: vi.fn(), setFeelEnabled: vi.fn() }));

import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';

// Run the real scheduler's hooks without mounting its WebGL children.
function Harness(props) { HealerWormMode3DWrapper(props); return null; }

// A retry gets the player back in fast: the scramble is committed in one go, the
// scrambling phase still holds two frames for the warm-up, and the portal arrival
// runs on the short clock with only GO. A first run keeps the full show.
describe('the quick start bridge and clock', () => {
  it('is taken by exactly one run', () => {
    expect(beginRun()).toBe(false);
    requestQuickStart();
    expect(beginRun()).toBe(true);
    expect(runStart.quick).toBe(true);
    expect(beginRun()).toBe(false);
    expect(runStart.quick).toBe(false);
  });

  it('plays the same beats on the short clock, with only GO', () => {
    expect(arrivalSeconds(false, true)).toBe(STORY_ARRIVAL_QUICK_SECONDS);
    expect(arrivalSeconds(false, false)).toBe(STORY_ARRIVAL_SECONDS);
    expect(STORY_ARRIVAL_QUICK_SECONDS).toBeLessThan(STORY_ARRIVAL_SECONDS / 2);
    const steps = new Set();
    for (let t = 0; t <= STORY_ARRIVAL_QUICK_SECONDS; t += 0.02) steps.add(storyArrivalPose(t, false, true).step);
    expect([...steps]).toEqual([null, 'go']);
    const end = storyArrivalPose(STORY_ARRIVAL_QUICK_SECONDS, false, true);
    expect(end).toMatchObject({ t: 1, emerge: 1, close: 1, settle: 1 });
    // The full show still counts 3-2-1.
    expect(storyArrivalPose(0.1).step).toBe(3);
  });

  it('commits a scramble exactly as the animated one would, one turn per store write', () => {
    const size = 3, moves = buildWormScramble(size, 12);
    useGameStore.setState({ cubies: makeCubies(size), size, rotationEpoch: 0, lastRotation: null });
    const seen = [];
    const unsub = useGameStore.subscribe(s => s.rotationEpoch, () => seen.push(useGameStore.getState().lastRotation));
    commitShuffleNow(moves, size);
    unsub();
    let want = makeCubies(size);
    for (const move of moves) want = applyTileMove(want, size, move).cubies;
    expect(JSON.stringify(useGameStore.getState().cubies)).toBe(JSON.stringify(want));
    expect(useGameStore.getState().rotationEpoch).toBe(moves.length);
    expect(seen).toHaveLength(moves.length);
    expect(new Set(seen).size).toBe(moves.length); // a fresh rotation every turn
  });
});

describe('a retried free-play run', () => {
  let root, host, sim, shuffle;
  const tick = (count = 1, delta = 0.05) => act(() => { for (let i = 0; i < count; i++) frameCb({}, delta); });
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    runStart.requested = false; runStart.quick = false;
    sim = makeWormSim(3);
    resetWormSim(sim, 3, { orbCount: 0, wormholeInterval: 9999 });
    worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
      get current() { return sim[key]; }, set current(value) { sim[key] = value; },
    }]));
    worm.tick = vi.fn(); worm.queueTurn = vi.fn(); worm.feel = vi.fn();
    const cubies = makeCubies(3);
    useGameStore.setState({ cubies, size: 3, wormAlive: true, wormPaused: false, wormJumpRescueActive: false, animState: null,
      demoMode: false, wormStoryLevel: null, wormStoryResult: null, wormCombatMode: false, wormEnemiesEnabled: false, wormPhase: 'crawling' });
    shuffle = vi.fn((_moves, done) => done());
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    act(() => root.render(<Harness cubies={cubies} size={3} onRotate={vi.fn()} onAnimatedShuffle={shuffle} />));
  });
  afterEach(() => {
    resetLiveRotation();
    act(() => root.unmount()); host.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  const framesToActive = () => {
    let frames = 0;
    while (useGameStore.getState().wormGamePhase !== 'active' && frames < 200) { tick(); frames++; }
    return frames;
  };

  it('skips the animated scramble, holds the warm-up frames, and arrives on the short clock', () => {
    // The first run plays the full show.
    expect(shuffle).toHaveBeenCalledTimes(1);
    const fullFrames = framesToActive();
    expect(fullFrames * 0.05).toBeGreaterThanOrEqual(STORY_ARRIVAL_SECONDS - 0.05);

    // Try again.
    const before = JSON.stringify(useGameStore.getState().cubies);
    const epoch = useGameStore.getState().rotationEpoch;
    requestQuickStart();
    act(() => useGameStore.setState(s => ({ wormRunId: (s.wormRunId ?? 0) + 1 })));
    expect(shuffle).toHaveBeenCalledTimes(1); // no animated scramble
    expect(useGameStore.getState().rotationEpoch).toBeGreaterThan(epoch);
    expect(JSON.stringify(useGameStore.getState().cubies)).not.toBe(before);
    expect(useGameStore.getState().wormGamePhase).toBe('scrambling');
    tick();
    expect(useGameStore.getState().wormGamePhase).toBe('scrambling'); // the warm-up's frame
    const steps = new Set();
    let frames = 1;
    while (useGameStore.getState().wormGamePhase !== 'active' && frames < 200) {
      tick(); frames++;
      steps.add(useGameStore.getState().wormCountdownStep);
    }
    expect(frames * 0.05).toBeLessThan(STORY_ARRIVAL_QUICK_SECONDS + 0.3);
    expect(steps.has(3)).toBe(false);
    expect(steps.has('go')).toBe(true);

    // The next run without a retry is the full show again.
    act(() => useGameStore.setState(s => ({ wormRunId: (s.wormRunId ?? 0) + 1 })));
    expect(shuffle).toHaveBeenCalledTimes(2);
  });

  it('starts a retried Story level by itself once it is staged, on the short clock', () => {
    framesToActive();
    act(() => useGameStore.setState({ wormHealerMode: true, wormStoryLevel: 1, wormStoryReady: false, wormStoryStarted: false,
      wormStoryResult: null, wormPauseMenuOpen: false }));
    requestQuickStart();
    act(() => useGameStore.setState(s => ({ wormRunId: (s.wormRunId ?? 0) + 1 })));
    expect(useGameStore.getState().wormGamePhase).toBe('active'); // staged, waiting on its card
    tick(5);
    expect(useGameStore.getState().wormStoryStarted).toBe(false); // not before the board is ready
    act(() => useGameStore.setState({ wormStoryReady: true }));
    tick(2);
    expect(useGameStore.getState().wormStoryStarted).toBe(false); // the warm-up's frames behind the card
    tick(2);
    expect(useGameStore.getState().wormStoryStarted).toBe(true);
    expect(useGameStore.getState().wormGamePhase).toBe('spawning');
    const frames = framesToActive();
    expect(frames * 0.05).toBeLessThan(STORY_ARRIVAL_QUICK_SECONDS + 0.3);

    // Launched from the map instead (no retry): the card waits for Start.
    act(() => useGameStore.setState({ wormStoryReady: false, wormStoryStarted: false, wormGamePhase: 'active' }));
    act(() => useGameStore.setState(s => ({ wormRunId: (s.wormRunId ?? 0) + 1 })));
    act(() => useGameStore.setState({ wormStoryReady: true }));
    tick(10);
    expect(useGameStore.getState().wormStoryStarted).toBe(false);
  });
});
