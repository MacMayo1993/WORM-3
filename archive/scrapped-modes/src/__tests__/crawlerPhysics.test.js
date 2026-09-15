import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { stepCrawler, getGroundPosition } from '../worm/crawlerPhysics.js';

function makeState(overrides = {}) {
  return {
    position: new THREE.Vector3(0, 0, 1.02),
    forward: new THREE.Vector3(1, 0, 0),
    face: 'PZ',
    velocity: 0,
    jumpHeight: 0,
    jumpT: 0,
    jumpReady: true,
    ...overrides,
  };
}

describe('stepCrawler jump mechanism', () => {
  it('does not move more than one tile horizontally in a single jump frame', () => {
    // Crawler is already airborne (jumpT > 0) with high velocity
    const state = makeState({ velocity: 50, jumpT: 0.1, jumpHeight: 0.1 });
    const input = { turnRate: 0, thrust: 1, brake: 0, jump: false, sprint: false };
    const dt = 0.016; // ~60fps

    const next = stepCrawler(state, input, dt, 3);

    // Measure movement in the tangential plane only (strip jump height offset)
    // PZ face normal is (0,0,1), so tangential movement is X and Y.
    const before = getGroundPosition(state, 3);
    const after = getGroundPosition(next, 3);
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const tangentialMove = Math.sqrt(dx * dx + dy * dy);

    expect(tangentialMove).toBeLessThanOrEqual(1.0 + 1e-6);
  });

  it('freezes velocity during airborne so landing speed is zero', () => {
    const state = makeState({ velocity: 10, jumpT: 0.5, jumpHeight: 0.3 });
    const input = { turnRate: 0, thrust: 1, brake: 0, jump: false, sprint: false };

    const next = stepCrawler(state, input, 0.016, 3);

    expect(next.velocity).toBe(0);
  });

  it('allows normal speed when grounded', () => {
    const state = makeState({ velocity: 0 });
    const input = { turnRate: 0, thrust: 1, brake: 0, jump: false, sprint: false };

    const next = stepCrawler(state, input, 0.1, 3);

    // Should accelerate while grounded
    expect(next.velocity).toBeGreaterThan(0);
  });

  it('triggers a jump on input.jump when grounded and jumpReady', () => {
    const state = makeState({ velocity: 3 });
    const input = { turnRate: 0, thrust: 1, brake: 0, jump: true, sprint: false };

    const next = stepCrawler(state, input, 0.016, 3);

    expect(next.jumpT).toBeGreaterThan(0);
  });

  it('does not re-trigger jump while jump key is held down', () => {
    const state = makeState({ velocity: 3, jumpT: 0, jumpReady: false });
    const input = { turnRate: 0, thrust: 0, brake: 0, jump: true, sprint: false };

    const next = stepCrawler(state, input, 0.016, 3);

    expect(next.jumpT).toBe(0);
  });
});
