import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { TunnelReadability } from '../worm/healerWorm/TunnelReadability.jsx';
import { traversalCue, tunnelAt } from '../worm/healerWorm/tunnelReadout.js';
import { tunnelState, resetTunnelState } from '../worm/tunnelProgressBridge.js';
import { liveRotation } from '../worm/liveRotation.js';
import { resetWormBuffs, wormBuffs } from '../worm/wormBuffs.js';

extend(THREE);
const a = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
const b = { x: 0, y: 0, z: 0, dirKey: 'NZ' };

it('reads the actual resolved endpoint both ways and does not advertise a pit or locked mouth as travel', () => {
    const grid = [];
    for (const tile of [a, b]) {
        grid[tile.x] ??= [];
        grid[tile.x][tile.y] ??= [];
        grid[tile.x][tile.y][tile.z] = { stickers: { [tile.dirKey]: { orig: 1, curr: 2 } } };
    }
    const sim = { signature: {}, tailLength: 0, voidTunnelKeys: new Set(), tunnelUseCounts: new Map() };
    const ctx = {
        getCubies: () => grid, getHealingProgress: () => ({}), isPrismCharacter: () => false,
        getOrbInventory: () => ({}), getOrbColor: () => 'blue',
        resolveTunnel: (_x, _y, _z, dir) => ({ tunnelKey: 'pair', tunnel: dir === 'PZ' ? { entry: a, exit: b } : { entry: b, exit: a } }),
    };
    expect(traversalCue(tunnelAt(sim, ctx, a), null, false)).toMatchObject({ icon: 'ride', text: 'Exit: cube back' });
    expect(traversalCue(tunnelAt(sim, ctx, b), null, false)).toMatchObject({ icon: 'ride', text: 'Exit: cube front' });
    expect(traversalCue({ exit: b, locked: true }, null, false)).toMatchObject({ icon: 'stop', text: 'Tunnel locked' });
    sim.voidTunnelKeys.add('pair');
    expect(traversalCue(tunnelAt(sim, ctx, a), null, false)).toMatchObject({ icon: 'stop', text: 'Unsafe tunnel' });
});

it.each([[360, 780], [1280, 720]])('renders a quiet registered mouth and head outline at %sx%s, clearing both on reset', async (width, height) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const prior = useGameStore.getState();
    useGameStore.setState({ size: 3, wormAlive: true, settings: { ...prior.settings, reducedMotion: true } });
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
        xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas);
    const camera = new THREE.PerspectiveCamera(55, width / height, .05, 100);
    root.configure({ gl, camera, frameloop: 'never', size: { width, height } });
    const worm = { phase: { current: 'crawling' }, currentNormal: { current: new THREE.Vector3(0, 0, 1) }, tunnelHeadShift: .08 };
    let store, now = 0;
    const frame = () => store.getState().advance(now += 1 / 60);
    try {
        await act(async () => { store = root.render(<TunnelReadability size={3} worm={worm} />); });
        const exit = store.getState().scene.getObjectByName('tunnel-exit-preview');
        const head = store.getState().scene.getObjectByName('tunnel-head-outline');
        store.getState().camera.position.set(0, 0, 5);
        store.getState().camera.quaternion.identity();
        wormBuffs.tunnelNeeds = { exit: b };
        frame();
        expect(exit.visible).toBe(false); // opposite side is not x-rayed
        wormBuffs.tunnelNeeds = { exit: a };
        frame();
        expect(exit.visible, JSON.stringify({ mesh: exit.position.toArray(), camera: store.getState().camera.position.toArray() })).toBe(true);
        expect(exit.position.z).toBeGreaterThan(1.5);
        expect(exit.material.depthTest).toBe(true);
        liveRotation.active = true;
        frame();
        expect(exit.visible).toBe(false);
        liveRotation.active = false;

        const subject = new THREE.Vector3(.1, .05, 1);
        worm.phase.current = 'tunnel';
        Object.assign(tunnelState, { active: true, rideHead: subject, t: .5 });
        frame();
        expect(exit.visible).toBe(false);
        expect(head.visible).toBe(true);
        expect(head.position.toArray()).toEqual([.1, .05, 1.08]);
        expect(head.material.depthWrite).toBe(false);
        const scale = head.scale.clone();
        frame();
        expect(head.scale.equals(scale)).toBe(true); // no pulse, including reduced motion
        tunnelState.t = .9;
        frame();
        expect(head.visible).toBe(false);
        tunnelState.t = .5;
        frame();
        expect(head.visible).toBe(true);
        resetTunnelState();
        resetWormBuffs();
        worm.phase.current = 'crawling';
        frame();
        expect(head.visible || exit.visible).toBe(false);
    } finally {
        liveRotation.active = false;
        resetTunnelState();
        resetWormBuffs();
        await act(async () => root.unmount());
        useGameStore.setState(prior, true);
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
});
