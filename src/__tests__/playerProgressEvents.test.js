import { beforeEach, describe, it, expect } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, xpForLevel, readPlayerSave } from '../progression/model.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
const store=()=>useGameStore.getState();
const set=patch=>useGameStore.setState(patch);
beforeEach(()=>{
  set({playerProgress:newProgress(),xpRun:null,xpNotice:null,parityPoints:100,ownedItems:['skin_slime','hat_none'],showMainMenu:false,showWelcome:false,showPlayerProgress:false,demoMode:false,teachModeActive:false,wormHealerMode:false,wormPaused:false,wormMissionsCompleted:0,currentLevel:null,currentLevelData:null,activePackId:'story-campaign',size:3,settings:{...store().settings,biomeMode:{enabled:false}},randomMode:false,chaosLevel:0,disparityRoundId:1,showDisparityWinner:false,disparityWinner:null,animState:null});
  store().resetGame();
});
function worm(speed=2,interval=20){store().initWormMode(9999,0,speed,null,interval);set({wormGamePhase:'active',wormPaused:false});return store().wormRunId;}
const pickup=(n,id=store().wormRunId)=>store().recordWormXp('orbs',n,null,id);
function puzzle({level=null,moves=15,daily=null,mode='freeplay',difficulty='easy'}={}) {
  store().resetGame();
  const data=level?{id:level,cubeSize:3,par:2,difficulty,...(daily?{dailyKey:daily}:{})}:null;
  set({cubies:rotateSliceCubies(makeCubies(3),3,'row',2,1),currentLevel:level,currentLevelData:data,randomMode:mode==='random',settings:{...store().settings,biomeMode:{enabled:mode==='biome'}},wormHealerMode:false,teachModeActive:false});
  store().setHasShuffled(true,moves);
}
function solve(moves=2){set({cubies:makeCubies(3),moves,gameTime:20});store().setVictory('rubiks');}

describe('Worm XP at real run boundaries',()=>{
  it('retains pickup XP through death and a fresh retry; stale events pay nothing',()=>{
    const id=worm();pickup(8);expect(store().playerProgress.xp).toBe(16);
    store().finishWormXp(false,id);set({wormAlive:false});pickup(9,id);
    expect(store().xpRun).toMatchObject({xp:16,completed:true});
    expect(readPlayerSave().progress.xp).toBe(16);
    worm();pickup(10,id);expect(store().xpRun.xp).toBe(0);
    pickup(1);expect(store().playerProgress.xp).toBe(18);
  });
  it.each([3,7,15])('caps orb earnings on a size-%i cube',size=>{
    set({size});worm(3.5,5);pickup(1000);
    expect(store().playerProgress.xp).toBe(98);
    pickup(1001);pickup(4);pickup(NaN);expect(store().playerProgress.xp).toBe(98);
  });
  it('pays the same multiplier for batched and individual pickups',()=>{
    worm(2.75,10);for(let i=1;i<=80;i++)pickup(i);
    const amount=store().xpRun.xp;worm(2.75,10);pickup(80);
    expect(amount).toBe(84);expect(store().xpRun.xp).toBe(amount);
  });
  it('does not count a tunnel until the worm returns to crawling and pays a route once',()=>{
    const id=worm();const event=(kind,pair)=>store().recordWormXp(kind,1,pair,id);
    event('tunnels');expect(store().xpRun.xp).toBe(0);
    event('entry','1:4');expect(store().xpRun.xp).toBe(0);
    event('tunnels');event('tunnels');event('entry','1:4');event('tunnels');
    expect(store().xpRun.xp).toBe(8);
    event('entry','2:5');event('tunnels');expect(store().xpRun.xp).toBe(16);
    event('entry','undefined:undefined');event('tunnels');expect(store().xpRun.xp).toBe(16);
  });
  it('pays the mission, its existing points and a crossed level atomically',()=>{
    set({playerProgress:{...newProgress(),xp:80}});const id=worm();
    store().recordWormMission('orbs',8,1,id);
    expect(store().playerProgress.xp).toBe(130);
    expect(store().parityPoints).toBe(145); // 20 mission + 25 level
    expect(readPlayerSave()).toMatchObject({points:145,progress:{xp:130}});
    store().recordWormMission('orbs',8,1,id);expect(store().parityPoints).toBe(145);
    expect(store().xpRun.breakdown.Mission).toBe(50);
  });
  it('limits healing and only pays the completed cube once',()=>{
    const id=worm();store().recordWormXp('healed',100,null,id);
    expect(store().xpRun.xp).toBe(90);store().finishWormXp(true,id);store().finishWormXp(true,id);
    expect(store().xpRun.xp).toBe(190);expect(store().xpRun.completed).toBe(true);
  });
  it('excludes paused, pre-game, dead and demo pickups',()=>{
    const id=worm();for(const patch of [{wormPaused:true},{wormPaused:false,wormGamePhase:'countdown'},{wormGamePhase:'active',wormAlive:false},{wormAlive:true,demoMode:true}]) {set(patch);pickup(5,id);}
    expect(store().playerProgress.xp).toBe(0);
    store().initWormMode();expect(store().xpRun).toBeNull();
  });
});

describe('puzzle XP',()=>{
  it('pays first clear and stars once, then diminishing replay rewards',()=>{
    puzzle({level:1});solve();expect(store().xpRun.xp).toBe(130); // 30 solve + 40 first + 60 stars
    const p=store().playerProgress;store().setVictory('rubiks');expect(store().playerProgress).toBe(p);
    puzzle({level:1});solve();expect(store().xpRun.xp).toBe(11);
    puzzle({level:1});solve();expect(store().xpRun.xp).toBe(5);
    puzzle({level:1});solve();expect(store().xpRun.xp).toBe(0);
  });
  it('pays improvements to stars and moves even on a replay',()=>{
    puzzle({level:1});solve(10);expect(store().xpRun.breakdown['New stars']).toBe(20);
    puzzle({level:1});solve(2);
    expect(store().xpRun.breakdown).toMatchObject({'New stars':40,'Personal best':30});
    puzzle({level:1});solve(2);expect(store().xpRun.breakdown['Personal best']).toBeUndefined();
  });
  it.each(['freeplay','random','biome'])('rewards meaningful %s scrambles',mode=>{
    puzzle({mode});solve();expect(store().xpRun.mode).toBe(mode);expect(store().xpRun.xp).toBe(135);
    expect(store().playerProgress.modeXp[mode]).toBe(135);
  });
  it('does not pay solved starts, menu cubes, trivial presets or stale/in-flight victories',()=>{
    set({cubies:makeCubies(3)});store().beginPuzzleXp();expect(store().xpRun).toBeNull();
    puzzle({moves:3});solve();expect(store().playerProgress.xp).toBe(0);
    puzzle();set({animState:{t:0},moves:5});store().setVictory('rubiks');expect(store().playerProgress.xp).toBe(0);
    set({animState:null});store().setVictory('rubiks');expect(store().playerProgress.xp).toBe(0); // still scrambled
    set({size:4,cubies:makeCubies(4)});store().setVictory('rubiks');expect(store().playerProgress.xp).toBe(0);
  });
  it('a guided solve never consumes the independent first-clear and star rewards',()=>{
    puzzle({level:1});store().markXpAssisted();solve();expect(store().xpRun.xp).toBe(25);
    puzzle({level:1});store().markXpAssisted();solve();expect(store().xpRun.xp).toBe(0);
    puzzle({level:1});solve();expect(store().xpRun.xp).toBe(130);
  });
  it('rewards a daily once per puzzle date, and upgrades a guided clear fairly',()=>{
    const settings={level:999,daily:'2026-09-15'};
    puzzle(settings);store().markXpAssisted();solve();expect(store().xpRun.xp).toBe(25);
    puzzle(settings);solve();expect(store().xpRun.xp).toBe(125); // remaining 95 + 30 at par
    puzzle(settings);solve();expect(store().xpRun.xp).toBe(0);
    puzzle({...settings,daily:'2026-09-16'});solve();expect(store().xpRun.xp).toBe(150);
  });
});

describe('other release modes and claims',()=>{
  it('pays a completed Chaos round regardless of wager; skips aborts and duplicate results',()=>{
    store().beginDisparityRound();store().setChaosLevel(.5);expect(store().xpRun.mode).toBe('chaos');
    store().finishChaosXp();expect(store().playerProgress.xp).toBe(0);
    set({disparityWinner:{pair:[1,4]}});store().setShowDisparityWinner(true);
    expect(store().xpRun.xp).toBe(50);store().finishChaosXp();expect(store().xpRun.xp).toBe(50);
  });
  it('gives one-time lesson, quiz, exploration and introduction rewards',()=>{
    store().recordLessonXp('teach','white-cross:0');expect(store().playerProgress.xp).toBe(0);
    set({teachModeActive:true});store().recordLessonXp('teach','white-cross:0');store().recordLessonXp('teach','white-cross:0');
    store().recordLessonXp('quiz','white-cross:0');store().recordLessonXp('quiz','white-cross:0');
    expect(store().playerProgress.xp).toBe(60);
    store().recordDiscoveryXp('cubelet');store().recordDiscoveryXp('cubelet');expect(store().playerProgress.xp).toBe(90);
    store().recordDiscoveryXp('introduction');expect(store().playerProgress.xp).toBe(90);
    set({demoMode:true,demoStep:'worm-traversal'});store().recordDiscoveryXp('introduction');store().recordDiscoveryXp('introduction');expect(store().playerProgress.xp).toBe(140);
  });
  it('validates milestone claims, commits ownership with the claim and cannot pay twice',()=>{
    expect(store().claimLevelReward(5,'hat_party')).toBe(false);
    set({playerProgress:{...newProgress(),xp:xpForLevel(5)}});
    expect(store().claimLevelReward(5,'fake')).toBe(false);
    expect(store().claimLevelReward(5,'hat_party')).toBe(true);
    expect(store().ownedItems).toContain('hat_party');expect(store().parityPoints).toBe(100);
    expect(readPlayerSave().progress.claimedRewards[5]).toBe('hat_party');
    expect(store().claimLevelReward(5,'points')).toBe(false);expect(store().parityPoints).toBe(100);
  });
  it('supports points rewards without changing XP, level or existing ownership',()=>{
    set({playerProgress:{...newProgress(),xp:xpForLevel(50)}});
    expect(store().claimLevelReward(50,'points')).toBe(true);
    expect(store().parityPoints).toBe(550);expect(store().playerProgress.xp).toBe(34300);
    expect(store().claimLevelReward(50,'points')).toBe(false);
  });
});
