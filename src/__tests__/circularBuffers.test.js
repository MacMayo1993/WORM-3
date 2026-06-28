import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  makeStepHistory, shPush, shAt, shTrimTo, shReset,
  makeTileTrail, ttPush, ttAt, ttTrimTo, ttReset, ttMapInPlace, ttFilterInPlace,
} from '../worm/circularBuffers.js';

describe('StepHistory circular buffer', () => {
  it('pushes and retrieves entries in LIFO order', () => {
    const sh = makeStepHistory(4);
    const p1 = new THREE.Vector3(1, 0, 0);
    const n1 = new THREE.Vector3(0, 0, 1);
    const p2 = new THREE.Vector3(2, 0, 0);
    const n2 = new THREE.Vector3(0, 1, 0);

    shPush(sh, p1, n1, 0, 0, 0);
    shPush(sh, p2, n2, 1, 0, 0);

    expect(sh.count).toBe(2);
    const newest = shAt(sh, 0);
    expect(newest.pos.x).toBe(2);
    expect(newest.tx).toBe(1);
    const oldest = shAt(sh, 1);
    expect(oldest.pos.x).toBe(1);
  });

  it('overwrites oldest entry when full', () => {
    const sh = makeStepHistory(2);
    const n = new THREE.Vector3(0, 0, 1);
    shPush(sh, new THREE.Vector3(1, 0, 0), n, 0, 0, 0);
    shPush(sh, new THREE.Vector3(2, 0, 0), n, 0, 0, 0);
    shPush(sh, new THREE.Vector3(3, 0, 0), n, 0, 0, 0);

    expect(sh.count).toBe(2);
    expect(shAt(sh, 0).pos.x).toBe(3);
    expect(shAt(sh, 1).pos.x).toBe(2);
  });

  it('trims count without losing data', () => {
    const sh = makeStepHistory(10);
    const n = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 5; i++) shPush(sh, new THREE.Vector3(i, 0, 0), n, 0, 0, 0);
    expect(sh.count).toBe(5);
    shTrimTo(sh, 3);
    expect(sh.count).toBe(3);
    expect(shAt(sh, 0).pos.x).toBe(4);
  });

  it('resets count to zero', () => {
    const sh = makeStepHistory(4);
    const n = new THREE.Vector3(0, 0, 1);
    shPush(sh, new THREE.Vector3(1, 0, 0), n, 0, 0, 0);
    shReset(sh);
    expect(sh.count).toBe(0);
    expect(sh.head).toBe(0);
  });
});

describe('TileTrail circular buffer', () => {
  it('pushes and retrieves tile keys in LIFO order', () => {
    const tt = makeTileTrail(10);
    ttPush(tt, '0,0,0,PZ');
    ttPush(tt, '1,0,0,PZ');

    expect(tt.count).toBe(2);
    expect(ttAt(tt, 0)).toBe('1,0,0,PZ');
    expect(ttAt(tt, 1)).toBe('0,0,0,PZ');
  });

  it('wraps around when full', () => {
    const tt = makeTileTrail(3);
    ttPush(tt, 'a');
    ttPush(tt, 'b');
    ttPush(tt, 'c');
    ttPush(tt, 'd');

    expect(tt.count).toBe(3);
    expect(ttAt(tt, 0)).toBe('d');
    expect(ttAt(tt, 1)).toBe('c');
    expect(ttAt(tt, 2)).toBe('b');
  });

  it('resets to a single initial key', () => {
    const tt = makeTileTrail(10);
    ttPush(tt, 'a');
    ttPush(tt, 'b');
    ttReset(tt, '0,0,0,PZ');
    expect(tt.count).toBe(1);
    expect(ttAt(tt, 0)).toBe('0,0,0,PZ');
  });

  it('trims to a maximum count', () => {
    const tt = makeTileTrail(10);
    for (let i = 0; i < 7; i++) ttPush(tt, `${i}`);
    ttTrimTo(tt, 3);
    expect(tt.count).toBe(3);
  });

  it('does not trim when count is already under max', () => {
    const tt = makeTileTrail(10);
    ttPush(tt, 'a');
    ttPush(tt, 'b');
    ttTrimTo(tt, 5);
    expect(tt.count).toBe(2);
  });

  it('maps keys in place', () => {
    const tt = makeTileTrail(10);
    ttPush(tt, '0,0,0,PZ');
    ttPush(tt, '1,0,0,PZ');
    ttMapInPlace(tt, k => k.replace('PZ', 'NZ'));
    expect(ttAt(tt, 0)).toBe('1,0,0,NZ');
    expect(ttAt(tt, 1)).toBe('0,0,0,NZ');
  });

  it('filters keys in place', () => {
    const tt = makeTileTrail(10);
    ttPush(tt, '0,0,0,PZ');
    ttPush(tt, '1,0,0,PX');
    ttPush(tt, '2,0,0,PZ');
    ttFilterInPlace(tt, k => k.endsWith('PZ'));
    expect(tt.count).toBe(2);
    expect(ttAt(tt, 0)).toBe('2,0,0,PZ');
    expect(ttAt(tt, 1)).toBe('0,0,0,PZ');
  });

  it('assigns monotonic sequence numbers', () => {
    const tt = makeTileTrail(10);
    ttReset(tt, 'start');
    ttPush(tt, 'second');
    ttPush(tt, 'third');
    const seq0 = tt.seq[(tt.head + 0) % tt.capacity];
    const seq1 = tt.seq[(tt.head + 1) % tt.capacity];
    const seq2 = tt.seq[(tt.head + 2) % tt.capacity];
    expect(seq0).toBeGreaterThan(seq1);
    expect(seq1).toBeGreaterThan(seq2);
  });
});
