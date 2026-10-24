import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { MOBI_FIRSTS } from '../worm/mobiFirsts.js';
import { MobiFirstPad } from '../worm/WormCrawlerHUD.jsx';
import WormCountdownOverlay from '../worm/WormCountdownOverlay.jsx';
import { skipArrivalTo, arrivalSeconds, storyArrivalPose, STORY_ARRIVAL_SECONDS } from '../worm/healerWorm/storyArrival.js';
import { COUNTDOWN_STEP_DURATION } from '../worm/healerWorm/constants.js';
import { setReducedMotionSetting } from '../utils/device.js';

let before;
beforeEach(() => {
  before = useGameStore.getState();
  useGameStore.setState({ demoMode: false, wormMobiLine: null,
    playerProgress: { ...before.playerProgress, milestones: {} } });
});
afterEach(() => { useGameStore.setState(before, true); });

describe("Mobi's first lines", () => {
  it('speaks each once per save, never in the demo, and only lines it has', () => {
    const say = id => useGameStore.getState().sayMobiFirst(id);
    say('ride');
    expect(useGameStore.getState().wormMobiLine).toMatchObject({ id: 'ride', text: MOBI_FIRSTS.ride, seq: 1 });
    expect(useGameStore.getState().playerProgress.milestones['first:mobi:ride']).toBe(1);
    say('ride');
    expect(useGameStore.getState().wormMobiLine.seq).toBe(1);
    say('pad');
    expect(useGameStore.getState().wormMobiLine).toMatchObject({ id: 'pad', seq: 2 });
    say('nonsense');
    expect(useGameStore.getState().wormMobiLine.id).toBe('pad');
    useGameStore.setState({ demoMode: true, playerProgress: { ...useGameStore.getState().playerProgress, milestones: {} } });
    say('ride');
    expect(useGameStore.getState().wormMobiLine.id).toBe('pad');
  });

  // House style: no topology words, and no claim the game does not make true.
  it('keep to plain words', () => {
    for (const line of Object.values(MOBI_FIRSTS)) {
      expect(line).not.toMatch(/antipod|manifold|parity|RP²|orientation|mirror/i);
      expect(line.length).toBeLessThan(110);
    }
  });

  it('point at the first flip pad only once play is under way', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'), root = createRoot(host);
    const state = patch => act(() => useGameStore.setState(patch));
    try {
      useGameStore.setState({ wormOpenPairs: 1, wormAlive: true, wormPaused: false, wormPhase: 'crawling', wormGamePhase: 'spawning' });
      await act(async () => root.render(<MobiFirstPad />));
      expect(useGameStore.getState().wormMobiLine).toBeNull();
      await state({ wormGamePhase: 'active', wormOpenPairs: 0 });
      expect(useGameStore.getState().wormMobiLine).toBeNull();
      await state({ wormOpenPairs: 2 });
      expect(useGameStore.getState().wormMobiLine).toMatchObject({ id: 'pad' });
    } finally {
      await act(async () => root.unmount());
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
  });
});

describe('skipping the arrival', () => {
  it('jumps the full show to its GO beat and leaves the short arrivals alone', () => {
    const go = STORY_ARRIVAL_SECONDS - COUNTDOWN_STEP_DURATION;
    expect(skipArrivalTo(0.2)).toBeCloseTo(go, 10);
    expect(storyArrivalPose(skipArrivalTo(0.2)).step).toBe('go');
    expect(skipArrivalTo(go + 0.3)).toBeCloseTo(go + 0.3, 10);
    expect(skipArrivalTo(0.2, false, true)).toBe(0.2);
    expect(skipArrivalTo(0.1, true)).toBe(0.1);
    expect(skipArrivalTo(0.2)).toBeLessThan(arrivalSeconds());
  });

  it('says so on the arrival countdown only', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => root.render(<WormCountdownOverlay step={3} arrival />));
      expect(host.textContent).toContain('Tap to skip');
      await act(async () => root.render(<WormCountdownOverlay step={3} />));
      expect(host.textContent).not.toContain('Tap to skip');
    } finally {
      await act(async () => root.unmount());
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
  });
});

describe('the Motion setting in CSS', () => {
  it('marks the document root while it is on', () => {
    setReducedMotionSetting(true);
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(true);
    setReducedMotionSetting(false);
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
  });
});
