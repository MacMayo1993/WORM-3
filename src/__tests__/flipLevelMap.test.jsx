import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, afterEach } from 'vitest';
import { flipMapNodes, flipMapTrail, SCENE_NAMES } from '../components/screens/flipLevelMapLayout.js';
import FlipLevelMap from '../components/screens/FlipLevelMap.jsx';
import pack, { FLIP_PUZZLES } from '../levels/packs/flip-puzzles.js';
import { progressManager } from '../utils/levels.js';

describe('flip level map layout', () => {
  it('climbs from level 1 at the foot to the finale at the top, swinging side to side', () => {
    const nodes = flipMapNodes(10);
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].y).toBeLessThan(nodes[i - 1].y);
      expect(Math.sign(nodes[i].x - 0.5)).toBe(-Math.sign(nodes[i - 1].x - 0.5));
    }
    for (const { x, y } of nodes) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(1); }
    expect(flipMapTrail(nodes, 100, 1320)).toHaveLength(9);
  });

  it('names every level’s scene', () => {
    for (const level of FLIP_PUZZLES) expect(SCENE_NAMES[level.background], level.name).toBeTruthy();
  });
});

describe('FlipLevelMap', () => {
  let root;
  const testMode = progressManager.testMode;
  afterEach(() => { act(() => root?.unmount()); localStorage.clear(); progressManager.testMode = testMode; });

  it('opens the next stage, locks the rest and shows stars and best flips for cleared ones', () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    // Dev builds open every level; the map's locks are what this checks.
    progressManager.testMode = false;
    localStorage.setItem('worm3_completed_levels', JSON.stringify([601, 602]));
    localStorage.setItem('worm3_level_stats', JSON.stringify({ 601: { stars: 3, bestFlips: 1 }, 602: { stars: 2, bestFlips: 2 } }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const picked = [];
    act(() => root.render(<FlipLevelMap pack={pack} onSelectLevel={id => picked.push(id)} onBack={() => {}} />));
    const keys = [...host.querySelectorAll('.flip-map-piece')];
    expect(keys).toHaveLength(10);
    expect(keys[0].getAttribute('aria-label')).toBe('Replay level 1: First Flip, 3 of 3 stars, best 1 flip');
    expect(keys[2].getAttribute('aria-label')).toMatch(/^Play level 3/);
    expect(keys[3].disabled).toBe(true);
    expect(host.querySelector('.flip-map-stage--next').textContent).toMatch(/Twin Trouble/);
    expect(host.textContent).toMatch(/Best 1 flip(?!s)/);
    expect(host.textContent).toMatch(/5★/);
    act(() => keys[2].click());
    expect(picked).toEqual([603]);
    expect(host.querySelectorAll('.flip-map-road--line')).toHaveLength(1);
    // Its label opens it too; a locked label does nothing.
    act(() => host.querySelectorAll('.flip-map-label')[1].click());
    act(() => host.querySelectorAll('.flip-map-label')[5].click());
    expect(picked).toEqual([603, 602]);
    host.remove();
  });
});
