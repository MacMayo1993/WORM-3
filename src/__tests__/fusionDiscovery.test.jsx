import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, sanitizeProgress } from '../progression/model.js';
import { ORDERED_FUSIONS } from '../worm/healerWorm/elementalFusion.js';
import { FusionDiscoveryNotice, FusionGuide } from '../worm/WormCrawlerHUD.jsx';

// The first time a player makes a recipe is a discovery: it persists, the HUD
// says NEW RECIPE with the recipe's sigil, name and rule, and the recipe guide
// counts what has been found. Nothing is hidden: every rule stays readable.
const state = () => useGameStore.getState();
const TOTAL = Object.keys(ORDERED_FUSIONS).length;
let before;
beforeEach(() => { before = state(); useGameStore.setState({ playerProgress: newProgress(), demoMode: false, wormFusionDiscovery: null }); });
afterEach(() => useGameStore.setState(before, true));

describe('discovering a recipe', () => {
  it('records each recipe once, persists it, and ignores the demo and bad ids', () => {
    state().discoverWormFusion('steam');
    expect(state().playerProgress.milestones['first:fusion:steam']).toBe(1);
    expect(state().wormFusionDiscovery).toMatchObject({ id: 'steam', seq: 1 });
    useGameStore.setState({ wormFusionDiscovery: null });
    state().discoverWormFusion('steam');
    expect(state().wormFusionDiscovery).toBeNull();
    expect(sanitizeProgress(state().playerProgress).milestones['first:fusion:steam']).toBe(1);
    for (const id of ['', 'fire>water', 'STEAM', null]) state().discoverWormFusion(id);
    useGameStore.setState({ demoMode: true });
    state().discoverWormFusion('quench');
    expect(Object.keys(state().playerProgress.milestones)).toEqual(['first:fusion:steam']);
  });
});

describe('the HUD', () => {
  let root, host;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

  it('announces a new recipe once, then never replays it on a remount', () => {
    act(() => root.render(<FusionDiscoveryNotice />));
    expect(host.textContent).toBe('');
    act(() => state().discoverWormFusion('steam'));
    const notice = host.querySelector('.worm-fusion-discovery');
    expect(notice.textContent).toContain(`New recipe · 1/${TOTAL}`);
    expect(notice.textContent).toContain('Steam');
    expect(notice.querySelector('svg')).not.toBeNull();
    expect(state().wormFusionDiscovery).toBeNull(); // taken as it shows
    act(() => vi.advanceTimersByTime(4000));
    expect(host.querySelector('.worm-fusion-discovery')).toBeNull();
    act(() => root.render(<span />));
    act(() => root.render(<FusionDiscoveryNotice />));
    expect(host.querySelector('.worm-fusion-discovery')).toBeNull();
  });

  it('marks found recipes in the guide and counts them', () => {
    act(() => { state().discoverWormFusion('steam'); state().discoverWormFusion('quench'); });
    act(() => root.render(<FusionGuide />));
    expect(host.querySelector('summary').textContent).toContain(`2/${TOTAL} found`);
    expect(host.querySelectorAll('li[data-found]')).toHaveLength(2);
    expect(host.querySelectorAll('li')).toHaveLength(TOTAL);
  });
});
