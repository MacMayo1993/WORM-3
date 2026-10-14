import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { ElementalAbilityEffects } from '../worm/healerWorm/ElementalAbilityEffects.jsx';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { liveCubies } from '../worm/liveCubies.js';
import { wormSegments } from '../worm/wormSegments.js';
import { ELEMENTAL_DEFS } from '../worm/healerWorm/elementalDefs.js';
extend(THREE);

it('batches readable fire, buds, shields and chain arcs, follows live tiles, and disposes on retry', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const before = useGameStore.getState(), liveBefore = { ...liveCubies }, amount = wormExpansion.amount;
    const segmentsBefore = { count: wormSegments.count, positions: wormSegments.positions.slice() };
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
        const [flames, buds, rings, bolts, wind] = group.children;
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
        sim.elementalType = 'air'; sim.elementalPair = null; sim.elementalAbilities.events = [];
        frame(); expect(wind.count).toBe(4); // visible as soon as Air is active, even grounded
        const calm = wind.instanceMatrix.array.slice();
        sim.elementalAbilities.visualTime += 1; frame();
        expect(wind.instanceMatrix.array).toEqual(calm); // reduced motion keeps the mantle still
        useGameStore.setState({ settings: { ...before.settings, reducedMotion: false } });
        frame(); expect(wind.instanceMatrix.array).not.toEqual(calm);
        const pausedWind = wind.instanceMatrix.array.slice(); frame();
        expect(wind.instanceMatrix.array).toEqual(pausedWind);
        sim.isJumping = true; sim.elementalAbilities.flying = true;
        wormSegments.count = 4; wormSegments.positions.set([0, 1, 3, 0, 0.7, 3, 0, 0.4, 3, 0, 0.1, 3]);
        frame(); expect(wind.count).toBe(7);
        expect([...wind.instanceMatrix.array].every(Number.isFinite)).toBe(true);
        for (const type of ['air', 'fire', 'water', 'grass', 'ice', 'lightning']) {
            sim.elementalType = type;
            sim.elementalAbilities.events = [{ kind: 'pickup', element: type, id: 2, duration: 1.1, ttl: .8, tiles: [sim.pos] }];
            frame();
            expect(buds.count).toBeGreaterThanOrEqual(12); expect(rings.count).toBeGreaterThanOrEqual(3);
            const color = new THREE.Color(); rings.getColorAt(rings.count - 1, color);
            expect(color.getHexString()).toBe(new THREE.Color(ELEMENTAL_DEFS[type].color).getHexString());
        }
        sim.phase = 'tunnel'; frame();
        expect(flames.count + buds.count + rings.count + wind.count + bolts.geometry.drawRange.count).toBe(0);
        const disposed = group.children.flatMap(m => [m.geometry, m.material]).map(resource => {
            const listener = vi.fn(); resource.addEventListener('dispose', listener); return listener;
        });
        await act(async () => root.unmount()); disposed.forEach(fn => expect(fn).toHaveBeenCalledOnce());
    } finally {
        await act(async () => root.unmount());
        useGameStore.setState(before, true); Object.assign(liveCubies, liveBefore); wormExpansion.amount = amount;
        wormSegments.count = segmentsBefore.count; wormSegments.positions.set(segmentsBefore.positions);
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
});
