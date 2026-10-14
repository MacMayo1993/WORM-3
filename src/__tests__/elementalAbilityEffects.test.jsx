import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { ElementalAbilityEffects } from '../worm/healerWorm/ElementalAbilityEffects.jsx';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { liveCubies } from '../worm/liveCubies.js';
extend(THREE);

it('batches readable fire, buds, shields and chain arcs, follows live tiles, and disposes on retry', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const before = useGameStore.getState(), liveBefore = { ...liveCubies }, amount = wormExpansion.amount;
    const sim = makeWormSim(5); resetWormSim(sim, 5, { orbCount: 0, wormholeInterval: 9999 });
    const worm = Object.fromEntries(Object.keys(sim).map(key => [key, { get current() { return sim[key]; } }]));
    sim.elementalType = 'fire'; sim.elementalPair = 'grass'; sim.elementalT = 10;
    sim.elementalAbilities.fireReady = true; sim.elementalAbilities.fireBonus = 6;
    sim.powerups = [{ ...sim.pos, ignited: true }, { x: 1, y: 1, z: 4, dirKey: 'PZ', garden: { remaining: 1.5 } }];
    useGameStore.setState({ wormAlive: true, wormPaused: true, settings: { ...before.settings, reducedMotion: true } });
    liveCubies.refs = null;
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
        xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas); root.configure({ gl, frameloop: 'never', size: { width: 400, height: 700 } });
    try {
        let store, time = 0;
        await act(async () => { store = root.render(<ElementalAbilityEffects worm={worm} size={5} />); });
        const frame = () => store.getState().advance(time += 1 / 60); frame();
        const group = store.getState().scene.getObjectByName('elemental-ability-feedback');
        const [flames, buds, rings, bolts] = group.children;
        expect(flames.count).toBe(4); expect(buds.count).toBe(7); expect(rings.count).toBe(2);
        const snapshot = flames.instanceMatrix.array.slice(); frame();
        expect(flames.instanceMatrix.array).toEqual(snapshot); // paused/reduced motion is stable
        const mesh = new THREE.Object3D(); mesh.position.set(4, 2, 1); mesh.rotation.y = .7;
        liveCubies.size = 5; liveCubies.refs = [];
        liveCubies.refs[sim.pos.x * 25 + sim.pos.y * 5 + sim.pos.z] = mesh;
        frame(); expect(flames.instanceMatrix.array).not.toEqual(snapshot);
        sim.elementalType = 'lightning'; sim.elementalPair = 'ice'; sim.elementalAbilities.iceShield = true;
        sim.elementalAbilities.events = [{ kind: 'lightning', id: 1, ttl: .5, tiles: [sim.pos, sim.powerups[1], sim.pos] }];
        frame(); expect(bolts.geometry.drawRange.count).toBe(24);
        expect([...bolts.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        expect(rings.count).toBeGreaterThan(2);
        sim.phase = 'tunnel'; frame();
        expect(flames.count + buds.count + rings.count + bolts.geometry.drawRange.count).toBe(0);
        const disposed = group.children.flatMap(m => [m.geometry, m.material]).map(resource => {
            const listener = vi.fn(); resource.addEventListener('dispose', listener); return listener;
        });
        await act(async () => root.unmount()); disposed.forEach(fn => expect(fn).toHaveBeenCalledOnce());
    } finally {
        await act(async () => root.unmount());
        useGameStore.setState(before, true); Object.assign(liveCubies, liveBefore); wormExpansion.amount = amount;
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
});
