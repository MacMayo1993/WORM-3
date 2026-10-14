import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { JumpLandingMarker } from '../worm/healerWorm/JumpLandingMarker.jsx';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { jumpLandingTile } from '../worm/healerWorm/jumpLanding.js';
import { getWormStickerWorldPos } from '../worm/wormExpansion.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';

extend(THREE);

it('predicts held glide only for active Air, including fusion partners', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const sim = makeWormSim(5); resetWormSim(sim, 5, { orbCount: 0, wormholeInterval: 9999 });
    const worm = Object.fromEntries(Object.keys(sim).map(key => [key, { get current() { return sim[key]; } }]));
    sim.isJumping = true; sim.jumpT = 0.4; sim.jumpSpan = 2; sim.interpT = 0.2;
    sim.elementalAbilities.jumpHeld = true; sim.elementalAbilities.glideLeft = 1.2;
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
        xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas); root.configure({ gl, frameloop: 'never', size: { width: 400, height: 700 } });
    try {
        let store, time = 0;
        await act(async () => { store = root.render(<JumpLandingMarker worm={worm} size={5} />); });
        const mesh = store.getState().scene.children[0];
        const check = glide => {
            store.getState().advance(time += 1 / 60);
            const tile = jumpLandingTile(sim.pos, sim.moveDir, 5, sim.interpT + glide, sim.jumpT, sim.jumpSpan);
            const expected = new THREE.Vector3(...getWormStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, 5, 0))
                .addScaledVector(FACE_NORMALS[tile.dirKey], 0.045);
            expect(mesh.visible).toBe(true);
            expect(mesh.position.distanceTo(expected)).toBeLessThan(1e-8);
            expect(mesh.material.color.getHexString()).toBe(glide ? 'b9f5ed' : 'fff4b0');
        };
        for (const type of [null, 'fire', 'water', 'grass', 'ice', 'lightning']) {
            sim.elementalType = type; sim.elementalPair = null; sim.elementalT = type ? 10 : 0;
            check(0);
        }
        const ordinary = mesh.position.clone();
        sim.elementalType = 'air'; check(0.9);
        expect(mesh.position.distanceTo(ordinary)).toBeGreaterThan(0.5);
        sim.elementalType = 'fire'; sim.elementalPair = 'air'; check(0.9);
        sim.elementalT = 0; check(0);
        sim.elementalT = 10; sim.rocketActive = true; check(0);
        sim.rocketActive = false; sim.elementalAbilities.jumpHeld = false; check(0);
        sim.elementalAbilities.jumpHeld = true; sim.jumpT = 0.7; check(0);
    } finally {
        await act(async () => root.unmount());
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
});
