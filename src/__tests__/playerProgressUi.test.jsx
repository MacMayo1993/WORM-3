import { useTeachMode } from '../teach/useTeachMode.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { makeCubies } from '../game/cubeState.js';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, xpForLevel } from '../progression/model.js';
import PlayerProgressScreen from '../progression/PlayerProgressScreen.jsx';
import { PlayerLevelBadge, XpRunSummary, LevelUpCue } from '../progression/ProgressWidgets.jsx';
vi.mock('../progression/RewardPreview.jsx',()=>({default:({choice})=><div data-preview>{choice?.label}</div>}));
let host,root;
const state=()=>useGameStore.getState();
const click=el=>act(()=>el.click());
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  useGameStore.setState({playerProgress:newProgress(),xpRun:null,xpNotice:null,ownedItems:['skin_slime','hat_none'],parityPoints:100,demoMode:false,showMainMenu:true,showPlayerProgress:false,victory:null,showDisparityWinner:false});
});
afterEach(()=>{act(()=>root.unmount());host.remove();delete globalThis.IS_REACT_ACT_ENVIRONMENT;vi.useRealTimers();});
it('opens the full level track from the menu badge with accessible progress',()=>{
  act(()=>root.render(<PlayerLevelBadge/>));
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  click(host.querySelector('button'));expect(state().showPlayerProgress).toBe(true);
  act(()=>root.render(<PlayerProgressScreen/>));
  expect(host.querySelectorAll('.xp-level-track button')).toHaveLength(50);
  expect(document.activeElement.getAttribute('aria-label')).toBe('Back to game');
  expect(host.querySelector('.xp-primary').disabled).toBe(true);
  act(()=>host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(state().showPlayerProgress).toBe(false);
});
it('claims a chosen reward once, shows its reveal, and equips it',()=>{
  act(()=>{useGameStore.setState({playerProgress:{...newProgress(),xp:xpForLevel(5)}});root.render(<PlayerProgressScreen/>);});
  expect(host.querySelectorAll('[data-preview]')).toHaveLength(1);
  expect(host.querySelector('.xp-primary').textContent).toContain('Claim');
  click(host.querySelector('.xp-primary'));
  expect(host.textContent).toContain('UNLOCKED');expect(state().ownedItems).toContain('hat_party');
  click(host.querySelector('.xp-primary'));expect(state().wormHat).toBe('party');
  expect(host.querySelector('.xp-primary').disabled).toBe(true);
  expect(state().playerProgress.claimedRewards[5]).toBe('hat_party');
});
it('shows actual earned XP on death and hides receipts belonging to another mode',()=>{
  act(()=>{useGameStore.setState({xpRun:{mode:'worm',startXp:80,xp:45,breakdown:{Orbs:45}},playerProgress:{...newProgress(),xp:125},wormAlive:false});root.render(<XpRunSummary mode="worm"/>);});
  expect(host.textContent).toContain('+45 XP');expect(host.textContent).toContain('LEVEL UP · 2');
  act(()=>root.render(<XpRunSummary mode="chaos"/>));expect(host.textContent).toBe('');
});
it('announces multiple crossed levels briefly and does not replay a saved level on mount',()=>{
  vi.useFakeTimers();act(()=>{useGameStore.setState({showMainMenu:false});root.render(<LevelUpCue/>);});
  expect(host.textContent).toBe('');
  act(()=>useGameStore.setState({playerProgress:{...newProgress(),xp:xpForLevel(4)}}));
  expect(host.textContent).toContain('Level 4');expect(host.textContent).toContain('+75 Parity Points');
  act(()=>vi.advanceTimersByTime(1600));expect(host.textContent).toBe('');
});

it('awards an algorithm only after the last turn commits, never for notation playback',()=>{
  let teach, animation;
  function Harness(){
    const teachApi=useTeachMode(), animationApi=useAnimation();
    React.useLayoutEffect(()=>{teach=teachApi;animation=animationApi;});
    return null;
  }
  act(()=>{useGameStore.setState({size:3,cubies:makeCubies(3),animState:null,pendingMove:null,teachModeActive:true});root.render(<Harness/>);});
  act(()=>teach.selectAlgorithm(0,0));
  const length=teach.algoMoves.length;expect(length).toBeGreaterThan(0);
  for(let i=0;i<length;i++){
    act(()=>teach.executeStep());
    expect(state().playerProgress.xp).toBe(0);
    act(()=>animation.handleAnimComplete());
  }
  expect(state().playerProgress.xp).toBe(25);
  act(()=>animation.handleAnimComplete());expect(state().playerProgress.xp).toBe(25);
  act(()=>teach.playNotation('R'));act(()=>animation.handleAnimComplete());
  expect(state().playerProgress.xp).toBe(25);
});
