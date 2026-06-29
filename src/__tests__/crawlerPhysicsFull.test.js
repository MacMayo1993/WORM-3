import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  projectOntoCube,
  projectOntoFace,
  getDefaultForward,
  rotateTangent,
  stepCrawler,
  getGroundPosition,
  worldToGrid,
  rotateCrawlerWithSlice,
  checkOrbCollision,
} from '../worm/crawlerPhysics.js';

function makeState(overrides = {}) {
  return {
    position: new THREE.Vector3(0, 0, 1.52),
    forward: new THREE.Vector3(1, 0, 0),
    face: 'PZ',
    velocity: 0,
    jumpHeight: 0,
    jumpT: 0,
    jumpReady: true,
    ...overrides,
  };
}

describe('projectOntoCube', () => {
  it('projects a point in front of PZ face onto PZ surface', () => {
    const p = new THREE.Vector3(0, 0, 5);
    const result = projectOntoCube(p, 3);
    expect(result.face).toBe('PZ');
    expect(result.position.z).toBeCloseTo(1.52, 1);
  });

  it('projects a point behind NX face onto NX surface', () => {
    const p = new THREE.Vector3(-10, 0.3, 0.1);
    const result = projectOntoCube(p, 3);
    expect(result.face).toBe('NX');
    expect(result.position.x).toBeCloseTo(-1.52, 1);
  });

  it('clamps tangential coordinates within cube bounds', () => {
    const p = new THREE.Vector3(0, 0.3, 5);
    const result = projectOntoCube(p, 3);
    expect(result.face).toBe('PZ');
    expect(result.position.y).toBeLessThanOrEqual(1);
    expect(result.position.y).toBeGreaterThanOrEqual(-1);
  });

  it('all 6 faces reachable for size 3', () => {
    const dirs = [
      [10, 0, 0, 'PX'], [-10, 0, 0, 'NX'],
      [0, 10, 0, 'PY'], [0, -10, 0, 'NY'],
      [0, 0, 10, 'PZ'], [0, 0, -10, 'NZ'],
    ];
    for (const [x, y, z, face] of dirs) {
      const r = projectOntoCube(new THREE.Vector3(x, y, z), 3);
      expect(r.face).toBe(face);
    }
  });
});

describe('projectOntoFace', () => {
  it('removes the normal component from a vector', () => {
    const v = new THREE.Vector3(1, 2, 3);
    const result = projectOntoFace(v, 'PZ');
    expect(result.z).toBeCloseTo(0, 10);
    expect(result.x).toBeCloseTo(1, 10);
    expect(result.y).toBeCloseTo(2, 10);
  });

  it('returns a zero-length vector when input is parallel to normal', () => {
    const v = new THREE.Vector3(0, 5, 0);
    const result = projectOntoFace(v, 'PY');
    expect(result.length()).toBeCloseTo(0, 10);
  });
});

describe('getDefaultForward', () => {
  it('returns a tangent vector for each face', () => {
    const faces = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
    for (const face of faces) {
      const fwd = getDefaultForward(face);
      expect(fwd.length()).toBeCloseTo(1, 5);
    }
  });
});

describe('rotateTangent', () => {
  it('rotates a tangent vector around the face normal', () => {
    const fwd = new THREE.Vector3(1, 0, 0);
    const rotated = rotateTangent(fwd, 'PZ', Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0, 5);
    expect(rotated.y).toBeCloseTo(1, 5);
    expect(rotated.z).toBeCloseTo(0, 5);
  });

  it('writes into a provided out vector without allocating', () => {
    const fwd = new THREE.Vector3(0, 0, 1);
    const out = new THREE.Vector3();
    const result = rotateTangent(fwd, 'PX', Math.PI / 2, out);
    expect(result).toBe(out);
  });
});

describe('worldToGrid', () => {
  it('converts world position to nearest grid cell on PZ face', () => {
    const pos = new THREE.Vector3(0.4, -0.3, 1.52);
    const grid = worldToGrid(pos, 'PZ', 3);
    expect(grid).toEqual({ x: 1, y: 1, z: 2, dirKey: 'PZ' });
  });

  it('fixes the boundary coordinate for PX face', () => {
    const pos = new THREE.Vector3(1.52, 0, 0);
    const grid = worldToGrid(pos, 'PX', 3);
    expect(grid.x).toBe(2);
    expect(grid.dirKey).toBe('PX');
  });

  it('clamps coordinates within bounds for size 2', () => {
    const pos = new THREE.Vector3(-5, -5, -5);
    const grid = worldToGrid(pos, 'NZ', 2);
    expect(grid.x).toBeGreaterThanOrEqual(0);
    expect(grid.y).toBeGreaterThanOrEqual(0);
    expect(grid.z).toBe(0);
  });
});

describe('rotateCrawlerWithSlice', () => {
  it('returns unchanged state when crawler is not on rotating slice', () => {
    const state = makeState();
    const result = rotateCrawlerWithSlice(state, 'col', 0, 1, 3);
    expect(result).toBe(state);
  });

  it('rotates the crawler when it is on the rotating slice', () => {
    const state = makeState({
      position: new THREE.Vector3(1, 0, 1.52),
      face: 'PZ',
    });
    const result = rotateCrawlerWithSlice(state, 'depth', 2, 1, 3);
    expect(result).not.toBe(state);
    expect(result.face).toBeDefined();
  });
});

describe('getGroundPosition', () => {
  it('strips jump offset from position', () => {
    const state = makeState({ jumpHeight: 0.3 });
    const ground = getGroundPosition(state, 3);
    expect(ground.z).toBeCloseTo(1.52 - 0.3, 5);
  });

  it('equals position when not jumping', () => {
    const state = makeState();
    const ground = getGroundPosition(state, 3);
    expect(ground.z).toBeCloseTo(1.52, 5);
  });
});

describe('checkOrbCollision', () => {
  it('returns true when positions overlap', () => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(0.1, 0, 0);
    expect(checkOrbCollision(a, b)).toBe(true);
  });

  it('returns false when positions are far apart', () => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(5, 5, 5);
    expect(checkOrbCollision(a, b)).toBe(false);
  });

  it('respects custom threshold', () => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(0.5, 0, 0);
    expect(checkOrbCollision(a, b, 0.3)).toBe(false);
    expect(checkOrbCollision(a, b, 0.6)).toBe(true);
  });
});

describe('stepCrawler face transitions', () => {
  it('transitions face when a large step overshoots the edge', () => {
    // With dt=0.5 and sprint velocity=5, step=2.5 which overshoots the 0.52 gap
    let state = makeState({
      position: new THREE.Vector3(0.99, 0, 1.52),
      forward: new THREE.Vector3(1, 0, 0),
      velocity: 5,
    });
    const input = { turnRate: 0, thrust: 1, brake: 0, jump: false, sprint: true };
    state = stepCrawler(state, input, 0.5, 3);
    expect(state.face).toBe('PX');
  });

  it('sprint doubles max speed', () => {
    const slow = makeState({ velocity: 0 });
    const fast = makeState({ velocity: 0 });
    const input = { turnRate: 0, thrust: 1, brake: 0, jump: false, sprint: false };
    const sprintInput = { ...input, sprint: true };
    let s1 = slow, s2 = fast;
    for (let i = 0; i < 100; i++) {
      s1 = stepCrawler(s1, input, 0.016, 3);
      s2 = stepCrawler(s2, sprintInput, 0.016, 3);
    }
    expect(s2.velocity).toBeGreaterThan(s1.velocity);
  });
});
