import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { combatBridge } from '../worm/combat/portalCombat.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
vi.mock('../utils/feel.js',()=>({feel:vi.fn()}));
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
  useGameStore.setState({cubies:makeCubies(5),size:5,demoMode:false,wormPauseMenuOpen:false});
  state().initWormMode(undefined,undefined,1.25,2,30,null,true);
  useGameStore.setState({wormGamePhase:'active'});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  act(()=>root.render(<Harness/>));frame();frame();
});
afterEach(()=>{act(()=>root.unmount());host.remove();state().clearDisparityGame();delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
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
