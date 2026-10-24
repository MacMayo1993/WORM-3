import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { stageStory } from '../worm/story/runtime.js';
import { storyLevel } from '../worm/story/levels.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { ttAt } from '../worm/circularBuffers.js';
import { WORM_LIFT } from '../worm/healerWorm/constants.js';
import { makeHopTracker, trackBodyHop, SKILL_CALLOUTS } from '../worm/healerWorm/skillMoments.js';
import { WORM_HAPTICS } from '../worm/wormFeedback.js';
import { useGameStore } from '../hooks/useGameStore.js';
import SkillCallout from '../worm/SkillCallout.jsx';

// Skill moments are called out: a jump over your own body that lands, a self-pass,
// and a double heal. A jump the game paused to offer (a rescue) is not one.
function hopOverBody() {
  const level = storyLevel(46), sim = makeWormSim(level.cubeSize);
  stageStory(sim, level.cubeSize, level, 'glow');
  sim.tailLength = 140;
  const body = ttAt(sim.tileTrail, 5).split(',');
  sim.pos = { x: +body[0], y: +body[1], z: +body[2], dirKey: body[3] };
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, level.cubeSize, 0)).z += WORM_LIFT;
  sim.prevWorldPos = null; sim.interpT = 0.6; sim.isJumping = true; sim.jumpT = 0.5;
  return { sim, size: level.cubeSize };
}

describe('the body hop', () => {
  it('fires once, on the landing of a jump that crossed the body', () => {
    const { sim, size } = hopOverBody();
    const tracker = makeHopTracker();
    expect(trackBodyHop(sim, tracker, size)).toBe(false); // still in the air
    sim.isJumping = false;
    expect(trackBodyHop(sim, tracker, size)).toBe(true);
    expect(trackBodyHop(sim, tracker, size)).toBe(false);
  });

  it('ignores a rescue jump', () => {
    const { sim, size } = hopOverBody();
    sim.assistedJump = true;
    const tracker = makeHopTracker();
    trackBodyHop(sim, tracker, size);
    sim.isJumping = false;
    expect(trackBodyHop(sim, tracker, size)).toBe(false);
  });

  it('has a sting of its own', () => {
    expect(WORM_HAPTICS.clutch).toBeTruthy();
    expect(Object.keys(SKILL_CALLOUTS).sort()).toEqual(['double', 'hop', 'pass', 'seam']);
  });
});

describe('the callout', () => {
  let root, host, before;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers();
    before = useGameStore.getState();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

  it('shows the moment once and is gone in about a second', () => {
    act(() => root.render(<SkillCallout />));
    act(() => useGameStore.setState({ wormSkillCallout: { kind: 'double' } }));
    expect(host.querySelector('.worm-skill-callout').textContent).toBe('Double heal!');
    expect(useGameStore.getState().wormSkillCallout).toBeNull();
    act(() => vi.advanceTimersByTime(1200));
    expect(host.querySelector('.worm-skill-callout')).toBeNull();
    act(() => useGameStore.setState({ wormSkillCallout: { kind: 'nonsense' } }));
    expect(host.querySelector('.worm-skill-callout')).toBeNull();
  });

  it('a moment landing while one is on screen gets a fresh element and a full second', () => {
    act(() => root.render(<SkillCallout />));
    act(() => useGameStore.setState({ wormSkillCallout: { kind: 'hop' } }));
    const first = host.querySelector('.worm-skill-callout');
    act(() => vi.advanceTimersByTime(900));
    act(() => useGameStore.setState({ wormSkillCallout: { kind: 'hop' } }));
    const second = host.querySelector('.worm-skill-callout');
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
    act(() => vi.advanceTimersByTime(900));
    expect(host.querySelector('.worm-skill-callout')).toBe(second);
    act(() => useGameStore.setState({ wormSkillCallout: { kind: 'pass' } }));
    expect(host.querySelector('.worm-skill-callout')).not.toBe(second);
    expect(host.querySelector('.worm-skill-callout').textContent).toBe('Self-pass!');
  });
});
