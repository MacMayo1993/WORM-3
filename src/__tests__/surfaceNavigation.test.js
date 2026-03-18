import { describe, it, expect } from 'vitest';
import { getNextSurfacePosition, checkSelfCollision, checkTunnelSelfCollision } from '../worm/wormLogic.js';
import { HEAL_COST, ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';

// ─── getNextSurfacePosition ────────────────────────────────────────────────────

describe('getNextSurfacePosition — intra-face moves', () => {
  const size = 3;

  it('moves right within the PZ face without wrapping', () => {
    // Center tile of front face moving right
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 2, dirKey: 'PZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PZ');
    expect(result.x).toBe(2);
    expect(result.y).toBe(1);
    expect(result.z).toBe(2);
  });

  it('moves up within the PZ face without wrapping', () => {
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 2, dirKey: 'PZ' }, 'up', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PZ');
    expect(result.y).toBe(2);
  });

  it('returns null for an unrecognised dirKey', () => {
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 2, dirKey: 'INVALID' }, 'up', size);
    expect(result).toBeNull();
  });
});

describe('getNextSurfacePosition — face wrap (size 3)', () => {
  const size = 3;

  it('wraps PZ→PY when moving off the top edge', () => {
    // Top row of PZ face (y = size-1 = 2)
    const result = getNextSurfacePosition({ x: 1, y: 2, z: 2, dirKey: 'PZ' }, 'up', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PY');
  });

  it('wraps PZ→NY when moving off the bottom edge', () => {
    const result = getNextSurfacePosition({ x: 1, y: 0, z: 2, dirKey: 'PZ' }, 'down', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('NY');
  });

  it('wraps PZ→PX when moving off the right edge', () => {
    const result = getNextSurfacePosition({ x: 2, y: 1, z: 2, dirKey: 'PZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PX');
  });

  it('wraps PZ→NX when moving off the left edge', () => {
    const result = getNextSurfacePosition({ x: 0, y: 1, z: 2, dirKey: 'PZ' }, 'left', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('NX');
  });

  it('NZ face reverses left/right — moving right wraps to NX not PX', () => {
    // On NZ the X axis is mirrored so "right" goes toward -X (NX face).
    // Start at x=0 (left edge in world space) so dx=-1 wraps to NX.
    const result = getNextSurfacePosition({ x: 0, y: 1, z: 0, dirKey: 'NZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('NX');
  });

  it('wraps PX→PY when moving off the top edge of the right face', () => {
    const result = getNextSurfacePosition({ x: 2, y: 2, z: 1, dirKey: 'PX' }, 'up', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PY');
  });
});

describe('getNextSurfacePosition — size-2 cube', () => {
  it('wraps a corner tile immediately on a 2×2 cube', () => {
    const size = 2;
    // Right edge of PZ face (x = 1 = size-1) moving right → PX face
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 1, dirKey: 'PZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PX');
  });
});

// ─── Healing cost invariants ───────────────────────────────────────────────────

describe('healing cost constants', () => {
  it('HEAL_COST equals 4 (two full orb pickups)', () => {
    expect(HEAL_COST).toBe(4);
  });

  it('ORB_SEGMENT_GROWTH equals 2 (each orb grows tail by 2)', () => {
    expect(ORB_SEGMENT_GROWTH).toBe(2);
  });

  it('exactly two orb pickups satisfy the heal cost', () => {
    expect(ORB_SEGMENT_GROWTH * 2).toBe(HEAL_COST);
  });
});

// ─── Surface self-collision ordering ─────────────────────────────────────────

describe('checkSelfCollision — surface mode', () => {
  const makeSegs = (...tiles) => tiles.map(([x, y, z, dirKey]) => ({ x, y, z, dirKey }));

  it('returns false when fewer than 3 segments exist', () => {
    const segs = makeSegs([0, 0, 2, 'PZ'], [0, 1, 2, 'PZ']);
    expect(checkSelfCollision(segs[0], segs)).toBe(false);
  });

  it('returns false when new head matches only the tail (tail vacates next frame)', () => {
    // head → body → tail; new head at tail position, not growing → tail excluded
    const segs = makeSegs([0, 0, 2, 'PZ'], [0, 1, 2, 'PZ'], [0, 2, 2, 'PZ']);
    const newHead = { x: 0, y: 2, z: 2, dirKey: 'PZ' }; // tail position
    expect(checkSelfCollision(newHead, segs, false)).toBe(false);
  });

  it('returns true when new head matches a body segment (not the tail)', () => {
    // 4-segment worm: head, body1, body2, tail
    const segs = makeSegs(
      [1, 1, 2, 'PZ'],
      [1, 2, 2, 'PZ'], // body — must be detected
      [1, 3, 2, 'PZ'],
      [1, 4, 2, 'PZ'],
    );
    const newHead = { x: 1, y: 2, z: 2, dirKey: 'PZ' }; // body1 position
    expect(checkSelfCollision(newHead, segs, false)).toBe(true);
  });

  it('includes tail in collision check when isGrowing=true', () => {
    const segs = makeSegs([0, 0, 2, 'PZ'], [0, 1, 2, 'PZ'], [0, 2, 2, 'PZ']);
    const newHead = { x: 0, y: 2, z: 2, dirKey: 'PZ' }; // tail position
    // tail stays this frame because worm is growing
    expect(checkSelfCollision(newHead, segs, true)).toBe(true);
  });
});

// ─── Tunnel self-collision ordering ──────────────────────────────────────────

describe('checkTunnelSelfCollision', () => {
  const makeTunnelSegs = (...ts) =>
    ts.map(([t, dir]) => ({ tunnelId: 'tunnel-a', t, direction: dir ?? 1 }));

  it('returns false when fewer than 3 segments exist', () => {
    const segs = makeTunnelSegs([0.5], [0.4]);
    const newHead = { tunnelId: 'tunnel-a', t: 0.3, direction: 1 };
    expect(checkTunnelSelfCollision(newHead, segs)).toBe(false);
  });

  it('returns false for a segment trailing behind the head (not ahead)', () => {
    // direction=1 → ahead means higher t; seg at t=0.2 is BEHIND head at t=0.5
    const segs = makeTunnelSegs([0.5], [0.2], [0.1]);
    const newHead = { tunnelId: 'tunnel-a', t: 0.5, direction: 1 };
    expect(checkTunnelSelfCollision(newHead, segs)).toBe(false);
  });

  it('returns true when head is about to collide with a segment ahead within threshold', () => {
    // direction=1, head at 0.5, segment at 0.502 — within TUNNEL_SELF_COLLISION_THRESHOLD (0.05)
    const segs = makeTunnelSegs([0.5], [0.502], [0.1]);
    const newHead = { tunnelId: 'tunnel-a', t: 0.5, direction: 1 };
    expect(checkTunnelSelfCollision(newHead, segs)).toBe(true);
  });
});
