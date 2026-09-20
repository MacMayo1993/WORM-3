import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { combatBridge } from '../worm/combat/portalCombat.js';
import { getWormTunnelSnapshot } from '../worm/tunnelSnapshot.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { feel, stopFeel } from '../utils/feel.js';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));
let root,host,worm;
const state=()=>useGameStore.getState();
function Harness(){
  const cubies=useGameStore(s=>s.cubies),phase=useGameStore(s=>s.wormPhase),alive=useGameStore(s=>s.wormAlive);
  const api=useWormCrawler(5,cubies);
  useEffect(()=>{worm=api;setWormTurnCallback(api.queueTurn);return()=>setWormTurnCallback(null);},[api]);
  return <WormCrawlerHUD phase={phase} wormAlive={alive} />;
}
const frame=()=>act(()=>worm.tick(.05));
const until=(fn,max=1000)=>{for(let i=0;i<max&&!fn();i++)frame();expect(fn()).toBeTruthy();};
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;resetLiveRotation();
  useGameStore.setState({cubies:makeCubies(5),size:5,demoMode:false,wormPauseMenuOpen:false,wormCharacter:'glow'});
  state().initWormMode(undefined,undefined,1.25,2,30,null,true);
  useGameStore.setState({wormGamePhase:'active'});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  act(()=>root.render(<Harness/>));frame();frame();
});
afterEach(()=>{act(()=>root.unmount());host.remove();state().clearDisparityGame();vi.useRealTimers();delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
it('starts explicitly, keeps the three-shot gun separate from healing inventory, and resets on retry',()=>{
  expect(state().wormPaused).toBe(true);expect(state().xpRun).toBeNull();expect(state().wormMission).toBeNull();
  const inventory={...state().wormOrbInventory};expect(Object.values(inventory).reduce((a,b)=>a+b,0)).toBe(6);
  act(()=>worm.queueTurn('fire'));frame();expect(combatBridge.current.shotsFired).toBe(0);
  act(()=>worm.queueTurn('combat-start'));frame();act(()=>worm.queueTurn('fire'));frame();
  expect(combatBridge.current.shotsFired).toBe(1);expect(state().wormOrbInventory).toEqual(inventory);
  act(()=>state().initWormMode(undefined,undefined,null,null,null,null,true));
  act(()=>useGameStore.setState({wormGamePhase:'active'}));frame();
  expect(combatBridge.current.shotsFired).toBe(0);expect(combatBridge.current.started).toBe(false);
});
it('freezes combat when paused and does not resume a ready arena through the pause menu',()=>{
  act(()=>host.querySelector('[aria-label="Pause"]').click());
  act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='RESUME').click());
  expect(state().wormPaused).toBe(true);
  act(()=>worm.queueTurn('combat-start'));until(()=>combatBridge.current.time>.1);
  const time=combatBridge.current.time;act(()=>state().setWormPaused(true));
  for(let i=0;i<50;i++)frame();expect(combatBridge.current.time).toBe(time);
});
it('seals the real tunnel, waits for the tail and finishes without permanent rewards',()=>{
  const points=state().parityPoints,xp=state().playerProgress.xp;
  act(()=>worm.queueTurn('combat-start'));act(()=>worm.queueTurn('turnLeft'));
  until(()=>state().wormTunnelCount>0);expect(combatBridge.current.won).toBe(false);
  until(()=>combatBridge.current.won,1800);
  expect(state().wormHealedCount).toBe(1);expect(state().wormPhase).toBe('crawling');expect(state().wormPaused).toBe(true);
  expect(state().parityPoints).toBe(points);expect(state().playerProgress.xp).toBe(xp);
});
it('returns to normal WORM and clears the combat bridge on unmount',()=>{
  act(()=>state().initWormMode());expect(state().wormCombatMode).toBe(false);expect(state().xpRun).not.toBeNull();
  expect(combatBridge.current).toBeNull();
});
it('holds fire through recharge, releases it, and clears a held request on pause',()=>{
  act(()=>worm.queueTurn('combat-start'));frame();act(()=>worm.queueTurn('fire-start'));
  until(()=>combatBridge.current.shotsFired>=4);
  act(()=>worm.queueTurn('fire-stop'));const count=combatBridge.current.shotsFired;
  for(let i=0;i<20;i++)frame();expect(combatBridge.current.shotsFired).toBe(count);
  act(()=>worm.queueTurn('fire-start'));frame();act(()=>state().setWormPaused(true));frame();
  expect(combatBridge.current.fireHeld).toBe(false);
});

it('integrates sparse encounters into normal WORM without replacing missions or signatures',()=>{
  vi.useFakeTimers();
  act(()=>state().initWormMode());
  act(()=>useGameStore.setState({wormGamePhase:'active',wormPaused:false}));
  frame();const c=combatBridge.current;
  expect(c.ambient).toBe(true);expect(c.quiet).toBeGreaterThan(11);expect(c.enemies).toHaveLength(0);
  const xp=state().xpRun,mission=state().wormMission,inventory={...state().wormOrbInventory};
  expect(xp).not.toBeNull();expect(mission).not.toBeNull();
  act(()=>{worm.pos.current={x:0,y:0,z:4,dirKey:'PZ'};worm.moveDir.current='right';c.quiet=0;});
  frame();expect(c.encounter).toBe(true);expect(c.warning).toBe(1.5);
  act(()=>vi.advanceTimersByTime(100));
  expect(host.querySelector('.worm-ambient-actions')).not.toBeNull();
  expect(host.querySelector('.worm-signature-control')).not.toBeNull();
  expect(host.querySelector('[aria-label^="Fire parity shot"]')).not.toBeNull();
  expect(host.querySelector('.worm-combat-card')).toBeNull();
  act(()=>worm.queueTurn('fire-start'));frame();
  expect(c.shotsFired).toBe(1);expect(c.fireHeld).toBe(true);expect(state().wormOrbInventory).toEqual(inventory);
  act(()=>worm.queueTurn('fire-stop'));expect(c.fireHeld).toBe(false);
  expect(state().xpRun.runId).toBe(xp.runId);expect(state().wormMission).toEqual(mission);
  act(()=>useGameStore.setState({cubies:makeCubies(5)}));frame();
  expect(c.encounter).toBe(false);expect(c.won).toBe(false);expect(state().wormPaused).toBe(false);
  act(()=>vi.advanceTimersByTime(100));expect(host.querySelector('.worm-ambient-actions')).toBeNull();
});
it('defers normal encounters to existing hazards and never creates them in the demo',()=>{
  act(()=>state().initWormMode());act(()=>useGameStore.setState({wormGamePhase:'active',wormPaused:false}));frame();
  const c=combatBridge.current;c.quiet=0;worm.pos.current={x:0,y:0,z:4,dirKey:'PZ'};
  act(()=>worm.tick(.05,{busy:true}));expect(c.encounter).toBe(false);
  act(()=>useGameStore.setState({demoMode:true,demoStep:'welcome'}));
  act(()=>state().initWormMode());act(()=>useGameStore.setState({wormGamePhase:'active'}));frame();
  expect(combatBridge.current).toBeNull();
});
it.each(['arena','normal'])('holds aim and new shots throughout an actual edge crossing in %s WORM',mode=>{
  if(mode==='arena') act(()=>worm.queueTurn('combat-start'));
  else {
    act(()=>state().initWormMode());
    act(()=>useGameStore.setState({wormGamePhase:'active',wormPaused:false}));
    frame();
    const hit=getWormTunnelSnapshot(state().cubies,5,state().rotationEpoch).tunnels[0];
    Object.assign(combatBridge.current,{encounter:true,sourceId:hit.tunnel.pairId,portal:hit.tunnel.entry,warning:999});
    worm.moveDir.current='right';
  }
  const c=combatBridge.current;c.spawnTimer=999;
  until(()=>worm.pos.current.dirKey==='PZ'&&worm.pos.current.x===4&&worm.interpT.current>.8);
  act(()=>worm.queueTurn('fire-start'));
  let before;
  // Catch the exact tick on which stepWormSim switches the logical face.
  do {before=c.shotsFired;c.cooldown=0;c.ammo=3;frame();} while(worm.pos.current.dirKey==='PZ');
  expect(worm.crossingCorner.current).toBe(true);
  expect(worm.interpT.current).toBeLessThan(.5);
  expect(c.shotsFired).toBe(before);expect(c.aim).toBeNull();expect(c.lockedId).toBeNull();
  const crossingShots=c.shotsFired,time=c.time;let sawSecondHalf=false;
  for(let i=0;i<100;i++) {
    c.cooldown=0;c.ammo=3;frame();
    if(!worm.crossingCorner.current||worm.interpT.current>=1)break;
    sawSecondHalf ||= worm.interpT.current>.5;
    expect(c.shotsFired).toBe(crossingShots);expect(c.aim).toBeNull();expect(c.aimHeld).toBe(true);
  }
  expect(sawSecondHalf).toBe(true);expect(c.time).toBeGreaterThan(time);
  expect(c.fireHeld).toBe(true);expect(c.aimHeld).toBe(false);
  expect(c.aim.face).toBe(worm.pos.current.dirKey);expect(c.shotsFired).toBeGreaterThan(crossingShots);
});

it('disables normal enemies and Fire, preserves the choice on retry, and can enable encounters again', () => {
  const start = enemies => {
    act(() => state().initWormMode(undefined, undefined, null, null, null, null, false, enemies));
    act(() => useGameStore.setState({ wormGamePhase: 'active', wormPaused: false }));
    frame();
  };
  start(false);
  expect(state().wormEnemiesEnabled).toBe(false);
  expect(state().xpRun).not.toBeNull();expect(state().wormMission).not.toBeNull();
  expect(host.querySelector('.worm-signature-control')).not.toBeNull();
  expect(host.querySelector('[aria-label^="Fire parity shot"]')).toBeNull();
  act(() => worm.queueTurn('fire-start'));
  for (let i = 0; i < 1000; i++) frame();
  expect(combatBridge.current).toBeNull();
  // Retry passes the current run's selection, just like App's retry handler.
  start(state().wormEnemiesEnabled);
  expect(combatBridge.current).toBeNull();expect(state().wormEnemiesEnabled).toBe(false);
  start(true);
  expect(combatBridge.current.ambient).toBe(true);
  expect(combatBridge.current.quiet).toBeGreaterThan(11);
});

it('keeps the optional combat arena playable when normal portal enemies are off', () => {
  act(() => state().initWormMode(undefined, undefined, null, null, null, null, true, false));
  act(() => useGameStore.setState({ wormGamePhase: 'active' }));frame();
  expect(state().wormEnemiesEnabled).toBe(false);
  expect(combatBridge.current.ambient).not.toBe(true);
  act(() => worm.queueTurn('combat-start'));frame();
  act(() => worm.queueTurn('fire'));frame();
  expect(combatBridge.current.started).toBe(true);expect(combatBridge.current.shotsFired).toBe(1);
});


it('confirms successful shots and cancels feedback immediately when the pause menu takes ownership', () => {
  act(() => worm.queueTurn('combat-start')); frame();
  vi.mocked(feel).mockClear(); vi.mocked(stopFeel).mockClear();
  act(() => worm.queueTurn('fire')); frame();
  expect(feel).toHaveBeenCalledWith('shot', expect.any(Object), expect.any(Object));
  act(() => useGameStore.setState({ wormPaused: true }));
  expect(stopFeel).toHaveBeenCalled();
  vi.mocked(feel).mockClear();
  for (let i = 0; i < 20; i++) frame();
  expect(feel).not.toHaveBeenCalled();
});
