import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createPickupMaterialPool, resetPickupMaterials, pickupWarmupMeshes } from '../worm/healerWorm/pickupMaterials.js';

describe('pickup material ownership', () => {
  it('keeps overlapping colours and opacity independent, then resets a reused set', () => {
    const pool = createPickupMaterialPool(), a = pool.acquire(), b = pool.acquire();
    resetPickupMaterials(a, '#ff0000'); resetPickupMaterials(b, '#00ff00');
    a.ring.opacity = .15;
    expect(b.ring.opacity).toBe(1); expect(b.ring.color.getHexString()).toBe('00ff00');
    for (const name of Object.keys(a)) expect(a[name]).not.toBe(b[name]);
    pool.release(a);
    const reused = pool.acquire(); expect(reused).toBe(a);
    resetPickupMaterials(reused, '#0000ff');
    expect(reused.ring.opacity).toBe(1); expect(reused.ring.color.getHexString()).toBe('0000ff');
    expect(reused.ringWhite.color.getHexString()).toBe('ffffff');
    pool.release(reused); pool.release(b); pool.dispose();
  });

  it('bounds retained sets, tolerates duplicate returns, and releases all ownership on mode exit', () => {
    const pool = createPickupMaterialPool(4);
    const warmDispose = vi.spyOn(pool.warm.core, 'dispose');
    const sets = Array.from({ length: 10 }, () => pool.acquire());
    const disposed = sets.map(set => vi.spyOn(set.core, 'dispose'));
    sets.forEach(set => { pool.release(set); pool.release(set); });
    expect(pool.size).toEqual({ active: 0, idle: 4 });
    expect(disposed.filter(spy => spy.mock.calls.length)).toHaveLength(6);
    for (let i = 0; i < 100; i++) pool.release(pool.acquire());
    expect(pool.size).toEqual({ active: 0, idle: 4 });
    expect(warmDispose).not.toHaveBeenCalled();
    pool.acquire(); pool.dispose();
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(warmDispose).toHaveBeenCalledTimes(1);
  });

  it('warms coloured instancing for sparks and plain instancing for motes', () => {
    const pool = createPickupMaterialPool(), geometry = new THREE.PlaneGeometry();
    const meshes = pickupWarmupMeshes(pool.warm, geometry);
    expect(meshes.filter(mesh => mesh.isInstancedMesh)).toHaveLength(2);
    const sparks = meshes.find(mesh => mesh.material === pool.warm.sparks);
    const motes = meshes.find(mesh => mesh.material === pool.warm.motes);
    expect(sparks.instanceColor).toBeTruthy(); expect(motes.instanceColor).toBeNull();
    expect(meshes.find(mesh => mesh.material === pool.warm.halo).material.side).toBe(THREE.BackSide);
    meshes.forEach(mesh => mesh.isInstancedMesh && mesh.dispose());
    geometry.dispose(); pool.dispose();
  });
});
