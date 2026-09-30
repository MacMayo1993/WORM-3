import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { combatBridge } from '../worm/combat/portalCombat.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import WormSwipeControls from '../worm/WormSwipeControls.jsx';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
import { wormBuffs } from '../worm/wormBuffs.js';
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));

let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies), phase = useGameStore(s => s.wormPhase), alive = useGameStore(s => s.wormAlive);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return <><WormCrawlerHUD phase={phase} wormAlive={alive} /><WormSwipeControls onTurn={api.queueTurn} worm={api} /></>;
}
const frame = (dt = 0.02) => act(() => worm.tick(dt));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetLiveRotation();
  useGameStore.setState({ cubies: makeCubies(5), size: 5, demoMode: false, wormCharacter: 'classic' });
  state().initWormMode(undefined, undefined, 1, 2, 30);
  useGameStore.setState({ wormGamePhase: 'active', wormPaused: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  frame();
  worm.moveDir.current = 'right';
  const target = getNextSurfacePosition(worm.pos.current, 'right', 5);
  const cubies = state().cubies;
  act(() => useGameStore.setState({ cubies: flipStickerPair(cubies, 5, target.x, target.y, target.z, target.dirKey, buildManifoldGridMap(cubies, 5)) }));
  for (let i = 0; i < 100 && !state().wormJumpRescueActive; i++) frame();
  expect(state().wormJumpRescueActive).toBe(true);
  expect(state().wormRescueKind).toBe('caution');
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); state().clearDisparityGame();
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});


it.each(['left', 'right', 'jump'].flatMap(action => ['touch', 'keyboard'].map(input => [action, input])))(
  'accepts %s through %s while the game is frozen', (action, input) => {
    const jump = host.querySelector('[aria-label="Jump now to clear the caution tape"]');
    const steer = [...host.querySelectorAll('.worm-steer-key')];
    expect(jump.disabled).toBe(false);
    expect(steer.every(button => !button.disabled && button.classList.contains('worm-jump-rescue'))).toBe(true);
    expect(host.querySelector('[role="alert"]').textContent).toContain('left, right or jump');
    const before = [worm.timeAliveRef.current, worm.interpT.current, combatBridge.current.time];
    frame(0.8);
    expect([worm.timeAliveRef.current, worm.interpT.current, combatBridge.current.time]).toEqual(before);
    expect(wormBuffs.jumpRescueT).toBeCloseTo(0.2);
    act(() => {
      // Arrow keys remain the displayed left/right rescue actions even in
      // camera-oriented mode; they must not be remapped into up/down.
      useGameStore.setState({ wormControlMode: 'oriented' });
      if (input === 'touch') (action === 'jump' ? jump : steer[action === 'left' ? 0 : 1])
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      else window.dispatchEvent(new KeyboardEvent('keydown', { key: {left:'ArrowLeft', right:'ArrowRight', jump:' '}[action], bubbles:true }));
    });
    frame();
    expect(state().wormJumpRescueActive).toBe(false);
    expect(state().wormRescueKind).toBeNull();
    expect(state().wormAlive).toBe(true);
    if (action === 'jump') expect(worm.padFlight.current).not.toBeNull();
    else expect(worm.moveDir.current).toBe(action === 'left' ? 'up' : 'down');
  }
);

it('ignores held Space, then shows falling before death and clears it on retry', () => {
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true })));
  frame(1);
  expect(state().wormPhase).toBe('falling');
  expect(state().wormAlive).toBe(true);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  for (let i=0; i<120; i++) frame();
  expect(state().wormDeathDetails).toMatchObject({reason:'caution-fall'});
  expect(state().wormAlive).toBe(false);
  act(() => state().initWormMode());
  frame();
  expect(worm.cautionFall.current).toBeNull();
  expect(state().wormRescueKind).toBeNull();
  expect(state().wormAlive).toBe(true);
});

it('preserves the tape countdown in Pause and across a hidden-tab catch-up frame', () => {
  frame(0.1);
  act(() => host.querySelector('[aria-label="Pause"]').click());
  frame(5);
  expect(wormBuffs.jumpRescueT).toBeCloseTo(0.9);
  act(() => host.querySelector('.worm-pause-resume').click());
  let hidden=true;
  vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
  act(()=>document.dispatchEvent(new Event('visibilitychange'))); frame(5);
  hidden=false;
  act(()=>document.dispatchEvent(new Event('visibilitychange'))); frame(5);
  expect(wormBuffs.jumpRescueT).toBeCloseTo(0.9);
  frame(0.1); expect(wormBuffs.jumpRescueT).toBeCloseTo(0.8);
});
