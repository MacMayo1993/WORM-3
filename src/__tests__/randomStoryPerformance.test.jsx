import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useRandomMode } from '../hooks/useRandomMode.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { TILE_STYLES } from '../utils/colorSchemes.js';
import { storyAppearance, storyVisualChanges, STORY_WORLDS } from '../worm/story/worlds.js';
const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('../utils/device.js', () => ({ get isMobile() { return device.mobile; }, prefersReducedMotion: () => false }));
function Harness({ suspended = false }) { useRandomMode(suspended); return null; }
let root, host;
it('does not remix behind Mobi before Worm mode exists, then starts a full play cycle', () => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ randomMode: true, wormHealerMode: false, wormPaused: false,
    showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const initial = useGameStore.getState();
  act(() => root.render(<Harness suspended />));
  act(() => vi.advanceTimersByTime(60000));
  expect(useGameStore.getState().settings).toBe(initial.settings);
  expect(useGameStore.getState().randomStyleTick).toBe(initial.randomStyleTick);
  act(() => {
    useGameStore.setState({ wormHealerMode: true, wormPaused: true });
    root.render(<Harness />);
  });
  act(() => vi.advanceTimersByTime(30000));
  expect(useGameStore.getState().randomStyleTick).toBe(initial.randomStyleTick);
  act(() => useGameStore.setState({ wormPaused: false }));
  act(() => vi.advanceTimersByTime(9999));
  expect(useGameStore.getState().randomStyleTick).toBe(initial.randomStyleTick);
  act(() => vi.advanceTimersByTime(1));
  expect(useGameStore.getState().randomStyleTick).toBe(initial.randomStyleTick + 1);
});

it.each([26, 30, 40])('keeps former Random level %s on a stable lightweight style across devices', id => {
  device.mobile = true;
  expect(Object.values(storyAppearance(id).manifoldStyles)).toEqual(Array(6).fill('solid'));
  device.mobile = false;
  expect(storyAppearance(id).manifoldStyles).toEqual(STORY_WORLDS[id].styles);
  const state = { ...useGameStore.getState(), perfReducedFX: true };
  expect(Object.values(storyVisualChanges(state, id).settings.manifoldStyles)).toEqual(Array(6).fill('solid'));
  expect(storyAppearance(25, true).manifoldStyles).toEqual(STORY_WORLDS[25].styles);
});
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove(); vi.useRealTimers();
  useGameStore.setState({ randomMode: false, wormHealerMode: false, wormPaused: false, perfReducedFX: false });
  device.mobile = false;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each(Object.keys(STORY_WORLDS).map(Number))('keeps level %i styles and palette unchanged through ten remix intervals', id => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ randomMode: true, wormHealerMode: true, wormPaused: false,
    showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false,
    wormStoryVisualBase: null, wormStoryViewBase: null });
  const original = useGameStore.getState();
  useGameStore.setState(storyVisualChanges(original, id));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  const before = useGameStore.getState();
  act(() => vi.advanceTimersByTime(100000));
  const after = useGameStore.getState();
  expect(after.randomMode).toBe(false);
  expect(after.randomStyleTick).toBe(before.randomStyleTick);
  expect(after.settings).toBe(before.settings);
  expect(new Set(Object.values(after.settings.manifoldStyles)).size).toBe(1);
  // Leaving a level restores the player's actual Random setting and look.
  act(() => root.unmount()); root = null;
  useGameStore.setState(storyVisualChanges(after, null));
  expect(useGameStore.getState().randomMode).toBe(true);
  expect(useGameStore.getState().settings.manifoldStyles).toEqual(original.settings.manifoldStyles);
});

it.each(['mobile', 'reduced effects'])('bounds shader variety across a full Remix run on %s', tier => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  device.mobile = tier === 'mobile';
  useGameStore.setState({ randomMode: true, wormHealerMode: true, wormPaused: false,
    perfReducedFX: tier === 'reduced effects', showMainMenu: false, showSettings: false,
    showWelcome: false, showTutorial: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  const initial = useGameStore.getState().randomStyleTick;
  for (let cycle = 1; cycle <= 100; cycle++) {
    act(() => vi.advanceTimersByTime(10000));
    const state = useGameStore.getState();
    expect(state.randomStyleTick).toBe(initial + cycle);
    expect(state.wormPaused).toBe(false);
    expect(Object.values(state.settings.manifoldStyles)).toHaveLength(6);
    for (const style of Object.values(state.settings.manifoldStyles)) {
      expect(style).toBe('solid');
      expect(TILE_STYLES[style].cost).toBe('low');
      expect(TILE_STYLES[style].type).not.toBe('3d');
    }
  }
});
it('retains cached materials, updates a remix atomically, and skips paused story cycles', () => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ randomMode: true, wormHealerMode: true, wormPaused: false,
    showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false });
  const cached = getTileStyleMaterial('grass', '#abcdef');
  const disposed = vi.fn(); cached.addEventListener('dispose', disposed);
  const updates = [];
  const unsubscribe = useGameStore.subscribe((s, prev) => { if (s.settings !== prev.settings || s.randomStyleTick !== prev.randomStyleTick) updates.push(s); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  expect(updates).toHaveLength(1);
  const tick = useGameStore.getState().randomStyleTick;
  act(() => vi.advanceTimersByTime(10000));
  expect(updates).toHaveLength(2);
  expect(useGameStore.getState().randomStyleTick).toBe(tick + 1);
  expect(getTileStyleMaterial('grass', '#abcdef')).toBe(cached);
  expect(disposed).not.toHaveBeenCalled();
  act(() => useGameStore.setState({ wormPaused: true }));
  act(() => vi.advanceTimersByTime(30000));
  expect(updates).toHaveLength(2);
  act(() => useGameStore.setState({ wormPaused: false }));
  act(() => vi.advanceTimersByTime(10000));
  expect(updates).toHaveLength(3);
  unsubscribe(); cached.removeEventListener('dispose', disposed);
});

it('counts only active play time from the ready card and across partial-cycle pauses', () => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ randomMode: true, wormHealerMode: true, wormPaused: true, wormRunId: 100,
    showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  const tick = () => useGameStore.getState().randomStyleTick;
  const initial = tick();
  const advance = ms => act(() => vi.advanceTimersByTime(ms));
  const pause = value => act(() => useGameStore.setState({ wormPaused: value }));

  advance(9000); // Ready card time must not use nine seconds of the first cycle.
  pause(false);
  expect(tick()).toBe(initial); // No immediate remix/shake on Start.
  advance(9999); expect(tick()).toBe(initial);
  advance(1); expect(tick()).toBe(initial + 1);

  advance(6000); pause(true);
  advance(45000); expect(tick()).toBe(initial + 1);
  pause(false);
  advance(3999); expect(tick()).toBe(initial + 1);
  advance(1); expect(tick()).toBe(initial + 2);
  advance(10000); expect(tick()).toBe(initial + 3);

  advance(8000); pause(true);
  act(() => useGameStore.setState({ wormRunId: 101 })); // Retry resets remaining time.
  advance(29000); pause(false);
  advance(9999); expect(tick()).toBe(initial + 3);
  advance(1); expect(tick()).toBe(initial + 4);

  act(() => root.unmount()); root = null;
  advance(30000); expect(tick()).toBe(initial + 4);
});

it.each(['showSettings', 'showMainMenu', 'showWelcome', 'showTutorial', 'suspended'])(
  'preserves the remaining remix time through %s', gate => {
    vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useGameStore.setState({ randomMode: true, wormHealerMode: false, wormPaused: false,
      showMainMenu: false, showSettings: false, showWelcome: false, showTutorial: false });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    act(() => root.render(<Harness />));
    const initial = useGameStore.getState().randomStyleTick;
    act(() => vi.advanceTimersByTime(6000));
    const toggle = value => act(() => {
      if (gate === 'suspended') root.render(<Harness suspended={value} />);
      else useGameStore.setState({ [gate]: value });
    });
    toggle(true);
    act(() => vi.advanceTimersByTime(45000));
    toggle(false);
    expect(useGameStore.getState().randomStyleTick).toBe(initial);
    act(() => vi.advanceTimersByTime(3999));
    expect(useGameStore.getState().randomStyleTick).toBe(initial);
    act(() => vi.advanceTimersByTime(1));
    expect(useGameStore.getState().randomStyleTick).toBe(initial + 1);
  }
);
