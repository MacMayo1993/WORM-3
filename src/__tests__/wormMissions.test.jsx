import { newProgress } from '../progression/model.js';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { advanceMission, startMission, readMissionCount, missionDefinition, WORM_MISSION_STORAGE_KEY } from '../worm/missions.js';
import WormMissionCard, { WormReplayLabel } from '../worm/WormMissionCard.jsx';

beforeEach(() => {
  localStorage.removeItem(WORM_MISSION_STORAGE_KEY);
  useGameStore.setState({ playerProgress:newProgress(), demoMode:false, wormMissionsCompleted:0, parityPoints:100, wormHealerMode:false, wormPauseMenuOpen:false });
});
function start(completed = 0) {
  useGameStore.setState({wormMissionsCompleted:completed});
  useGameStore.getState().initWormMode();
  useGameStore.setState({wormGamePhase:'active', wormPaused:false});
  return useGameStore.getState().wormRunId;
}
function record(kind, total, color, runId = useGameStore.getState().wormRunId) {
  useGameStore.getState().recordWormMission(kind, total, color, runId);
}

describe('run mission lifecycle', () => {
  it('starts one mission with fresh progress and stable targets on every cube size', () => {
    start(); expect(useGameStore.getState().wormMission.title).toBe('Collect 8 orbs');
    record('orbs', 5, 1);
    useGameStore.setState({size:15}); start();
    expect(useGameStore.getState().wormMission.progress).toBe(0);
    expect(useGameStore.getState().wormMission.target).toBe(8);
  });
  it('awards exactly once, persists completion, and assigns the next objective on retry', () => {
    const id = start(); record('orbs', 8, 1); record('orbs', 8, 1); record('orbs', 20, 2);
    expect(useGameStore.getState().parityPoints).toBe(120);
    expect(readMissionCount()).toBe(1);
    useGameStore.getState().initWormMode();
    expect(useGameStore.getState().wormMission.kind).toBe('tunnels');
    record('tunnels', 1, null, id); // an event from the previous run cannot win this mission
    expect(useGameStore.getState().wormMission.completed).toBe(false);
  });
  it('counts distinct pickup faces, independent of deposits and repeated colors', () => {
    start(2); record('orbs', 1, 1); record('orbs', 2, 1);
    useGameStore.setState({wormOrbInventory:{1:0}});
    record('orbs', 3, 2); record('orbs', 4, 0); record('orbs', 5, 7);
    expect(useGameStore.getState().wormMission.progress).toBe(2);
    record('orbs', 6, 3);
    expect(useGameStore.getState().wormMission.completed).toBe(true);
    expect(useGameStore.getState().parityPoints).toBe(130);
  });
  it('keeps a failed mission assigned, and excludes demo, dead and pre-game events', () => {
    const id = start(1); useGameStore.setState({wormAlive:false}); record('tunnels',1);
    expect(useGameStore.getState().wormMission.progress).toBe(0);
    useGameStore.getState().initWormMode(); record('tunnels',1);
    expect(useGameStore.getState().wormMission.progress).toBe(0);
    useGameStore.setState({demoMode:true}); useGameStore.getState().initWormMode();
    expect(useGameStore.getState().wormMission).toBeNull(); record('orbs',100,1,id);
    expect(useGameStore.getState().wormMissionsCompleted).toBe(1);
    expect(useGameStore.getState().parityPoints).toBe(100);
  });
  it('clears the run on exit without losing mission-track progress', () => {
    start(3); record('healed',1); useGameStore.getState().clearDisparityGame();
    expect(useGameStore.getState().wormMission).toBeNull();
    expect(useGameStore.getState().wormMissionsCompleted).toBe(4);
  });
  it('does not regress on lower counters, count wrong mechanics, or accept invalid values', () => {
    const m = advanceMission(startMission(0,1),'orbs',4,1);
    expect(advanceMission(m,'orbs',3,1)).toBe(m);
    expect(advanceMission(m,'orbs',NaN,1)).toBe(m);
    expect(advanceMission(m,'tunnels',100,1)).toBe(m);
    expect(missionDefinition(6).id).toBe(missionDefinition(0).id);
  });
  it('recovers from malformed or unavailable saved progress', () => {
    for (const data of ['bad json','null','{"completed":-1}','{"completed":"12"}']) {
      localStorage.setItem(WORM_MISSION_STORAGE_KEY,data); expect(readMissionCount()).toBe(0);
    }
    const spy = vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => {throw new Error('blocked');});
    expect(readMissionCount()).toBe(0); spy.mockRestore();
  });
});

describe('mission UI', () => {
  let host, root;
  beforeEach(() => {globalThis.IS_REACT_ACT_ENVIRONMENT=true; host=document.createElement('div');document.body.append(host);root=createRoot(host);});
  afterEach(() => {act(()=>root.unmount());host.remove();delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
  it('shows accessible live progress, completion reward and the next-run objective', () => {
    start(); act(()=>root.render(<><WormMissionCard summary/><WormReplayLabel/></>));
    expect(host.textContent).toContain('Retry mission');
    act(()=>record('orbs',8,1));
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('8');
    expect(host.textContent).toContain('+20 PP · +50 XP');
    expect(host.textContent).toContain('Next run: Complete 1 tunnel trip');
    expect(host.textContent).toContain('Next mission');
  });
  it('hides the live card during pause or death and everywhere in the demo', () => {
    start();act(()=>root.render(<WormMissionCard/>)); expect(host.textContent).toContain('RUN MISSION');
    act(()=>useGameStore.setState({wormPauseMenuOpen:true})); expect(host.textContent).toBe('');
    act(()=>useGameStore.setState({wormPauseMenuOpen:false,wormAlive:false})); expect(host.textContent).toBe('');
    act(()=>{useGameStore.setState({demoMode:true});root.render(<WormMissionCard summary/>);});expect(host.textContent).toBe('');
  });
});
