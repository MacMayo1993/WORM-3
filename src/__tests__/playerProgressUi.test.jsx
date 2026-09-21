import { useTeachMode } from '../teach/useTeachMode.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
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
  useGameStore.setState({playerProgress:newProgress(),xpRun:null,xpNotice:null,chaosLevel:0,disparityWinner:null,xpActivityRuns:{},ownedItems:['skin_slime','hat_none'],parityPoints:100,demoMode:false,teachModeActive:false,showMainMenu:true,showPlayerProgress:false,victory:null,showDisparityWinner:false});
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
  expect(host.textContent).toContain('Unlocked');expect(state().ownedItems).toContain('hat_party');
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
  act(()=>{useGameStore.setState({size:3,cubies:makeCubies(3),animState:null,pendingMove:null,teachModeActive:false});root.render(<Harness/>);});
  act(()=>teach.enterTeachMode());
  expect(state().teachModeActive).toBe(true);
  act(()=>teach.selectAlgorithm(0,0));
  const length=teach.algoMoves.length;expect(length).toBeGreaterThan(0);
  for(let i=0;i<length;i++){
    act(()=>teach.executeStep());
    expect(state().playerProgress.xp).toBe(0);
    act(()=>animation.handleAnimComplete());
  }
  expect(state().playerProgress.xp).toBe(60);
  act(()=>animation.handleAnimComplete());expect(state().playerProgress.xp).toBe(60);
  act(()=>teach.playNotation('R'));act(()=>animation.handleAnimComplete());
  expect(state().playerProgress.xp).toBe(60);
});

it('enters and exits real Teach quiz sessions with synchronized eligibility and fresh receipts', () => {
  let teach;
  function Harness() {
    const api = useTeachMode();
    React.useLayoutEffect(() => { teach = api; });
    return null;
  }
  act(() => {
    useGameStore.setState({ size: 3, cubies: rotateSliceCubies(makeCubies(3), 3, 'row', 2, 1), animState: null });
    root.render(<Harness />);
  });
  act(() => teach.enterTeachMode());
  expect(teach.active).toBe(true);
  expect(state().teachModeActive).toBe(true);
  act(() => teach.switchSubMode('quiz'));
  const correct = teach.quizOptions.findIndex(option => option.isCorrect);
  expect(correct).toBeGreaterThanOrEqual(0);
  act(() => teach.answerQuiz(correct));
  expect(state().xpActivityRuns.teach.achievements.map(a => a.id)).toContain('teach-quiz');
  const xp = state().playerProgress.xp;
  const receipt = state().xpActivityRuns.teach;
  act(() => teach.enterTeachMode());
  expect(state().xpActivityRuns.teach).toBe(receipt);
  act(() => teach.exitTeachMode());
  expect(teach.active).toBe(false);
  expect(state().teachModeActive).toBe(false);
  act(() => state().recordLessonXp('quiz', 'after-exit:0'));
  expect(state().playerProgress.xp).toBe(xp);
  act(() => teach.enterTeachMode());
  expect(state().teachModeActive).toBe(true);
  expect(state().xpActivityRuns.teach).toBeNull();
  expect(state().playerProgress.xp).toBe(xp);
  act(() => teach.exitTeachMode());
  act(() => useGameStore.setState({ size: 4, cubies: makeCubies(4) }));
  act(() => teach.enterTeachMode());
  expect(teach.active).toBe(false);
  expect(state().teachModeActive).toBe(false);
});

it('keeps CHAOS level-ups in the recap and clears an existing toast on mode entry', () => {
  vi.useFakeTimers();
  act(() => { useGameStore.setState({ showMainMenu: false }); root.render(<LevelUpCue />); });
  act(() => useGameStore.setState({ playerProgress: { ...newProgress(), xp: xpForLevel(2) } }));
  expect(host.querySelector('.xp-level-toast')).not.toBeNull();
  act(() => useGameStore.setState({ chaosLevel: 3, xpRun: { mode: 'chaos', startXp: xpForLevel(2), xp: 0, breakdown: {}, achievements: [] } }));
  expect(host.querySelector('.xp-level-toast')).toBeNull();
  act(() => useGameStore.setState({
    playerProgress: { ...newProgress(), xp: xpForLevel(4) },
    disparityWinner: { pair: ['M1-001', 'M4-009'] }, showDisparityWinner: false,
    xpRun: { ...state().xpRun, xp: xpForLevel(4) - xpForLevel(2), breakdown: { Completion: 100 } },
  }));
  expect(host.querySelector('.xp-level-toast')).toBeNull();
  act(() => root.render(<><LevelUpCue /><XpRunSummary mode="chaos" /></>));
  expect(host.textContent).toContain('LEVEL UP · 4');
  expect(host.querySelector('.xp-level-toast')).toBeNull();
  act(() => useGameStore.setState({ chaosLevel: 0, disparityWinner: null, xpRun: null }));
  expect(host.querySelector('.xp-level-toast')).toBeNull();
});
