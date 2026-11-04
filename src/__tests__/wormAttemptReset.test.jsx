import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { useCubeState } from '../hooks/useCubeState.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { makeCubies } from '../game/cubeState.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { rumbleLifts } from '../worm/rumbleBridge.js';
import { healBurstMap, healParticleMap } from '../3d/healBurstBridge.js';
import { liveRotation, setLiveRotation } from '../worm/liveRotation.js';

vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn() }));

let root, before, worm, cube, animation;
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const w = useWormCrawler(5, cubies);
  const c = useCubeState();
  const a = useAnimation();
  useEffect(() => { worm = w; cube = c; animation = a; });
  return null;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ size: 5, cubies: makeCubies(5), demoMode: false });
  useGameStore.getState().initWormMode();
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  useGameStore.setState(before, true);
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each(['retry after death', 'restart while alive'])(
  '%s clears interrupted passage, tile FX, hazards and inputs before a frame runs', kind => {
    const saved = useGameStore.getState();
    const progress = saved.playerProgress, settings = saved.settings;
    const runId = saved.wormRunId;
    const tile = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
    const passage = { entry: tile, exit: { ...tile, z: 0, dirKey: 'NZ' }, pairId: 'old' };
    act(() => {
      animation.startAnimation('row', 1, 2);
      setLiveRotation('row', [2], [0.7], 2, 0.7);
      useGameStore.setState({ wormAlive: kind !== 'retry after death', wormPaused: true,
        wormPauseMenuOpen: true, wormPhase: 'tunnel', wormBoostState: 'active',
        wormActiveTunnelColors: [1, 2], wormPitGrids: ['old'], wormPowerups: [{ tile }],
        cubiePops: { old: {} }, tunnelBirths: { old: {} }, tunnelPulses: { old: {} }, tunnelDeaths: { old: {} },
        wormDeathDetails: { reason: 'sliced' }, showWormDeathMenu: true });
    });
    worm.phase.current = 'tunnel';
    worm.activeTunnel.current = passage;
    worm.tunnelPassages.current = [{ tunnel: passage }];
    Object.assign(tunnelState, { active: true, fallOpening: tile, portalTunnel: passage,
      t: 0.5, rideHead: {}, lensT: 0.4, lensLift: 0.2, activeTunnelId: 'old', tunnel: passage,
      coreZoom: 3, coreZoomAnchor: {} });
    tunnelState.occupiedTunnelIds.add('old');
    rumbleLifts.set('old', 0.4);
    healBurstMap.set('old', 1);
    healParticleMap.set('old', 1);
    // The exact ordering shared by Try again and Pause > Restart in App.
    act(() => {
      animation.cancelShuffle();
      cube.reset();
      saved.initWormMode();
    });
    const fresh = useGameStore.getState();
    expect(fresh.wormRunId).toBe(runId + 1);
    expect(fresh.playerProgress).toBe(progress);
    expect(fresh.settings).toBe(settings);
    expect(fresh.cubies).toEqual(makeCubies(5));
    expect(fresh).toMatchObject({ wormAlive: true, wormPaused: true, wormPauseMenuOpen: false,
      wormBoostState: 'ready', wormPhase: 'crawling', wormDeathDetails: null,
      showWormDeathMenu: false, wormPitGrids: [], wormActiveTunnelColors: null,
      cubiePops: {}, tunnelBirths: {}, tunnelPulses: {}, tunnelDeaths: {}, animState: null, pendingMove: null });
    expect(liveRotation.active).toBe(false);
    expect(worm.phase.current).toBe('crawling');
    expect(worm.activeTunnel.current).toBeNull();
    expect(worm.tunnelPassages.current).toEqual([]);
    expect(tunnelState).toEqual({ active: false, fallOpening: null, occupiedTunnelIds: new Set(),
      portalTunnel: null, t: 0, rideHead: null, lensT: 0, lensLift: 0,
      activeTunnelId: null, tunnel: null, coreZoom: 1, coreZoomAnchor: null });
    expect(rumbleLifts.size + healBurstMap.size + healParticleMap.size).toBe(0);
    // Paused frames cannot resurrect the old passage or commit its interrupted turn.
    act(() => { animation.handleAnimComplete(); worm.tick(0.02); });
    expect(useGameStore.getState().cubies).toEqual(makeCubies(5));
    expect(worm.activeTunnel.current).toBeNull();
  }
);
