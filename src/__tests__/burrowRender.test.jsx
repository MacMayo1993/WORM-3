import React, { act, createRef } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import Cubie from '../3d/Cubie.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import { makeCubies } from '../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { flipPadPair } from '../game/flipPad.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { burrowBridge } from '../worm/burrowBridge.js';
import { makeBurrows } from '../worm/healerWorm/burrows.js';
import { selectiveCubieOffsetRatio, wormRaisedAmount, WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { PAD_STALK_DEPTH } from '../3d/padStalkGeometry.js';
import BurrowEffects from '../worm/healerWorm/BurrowEffects.jsx';
import { liveCubies } from '../worm/liveCubies.js';

vi.mock('../3d/StickerPlane.jsx', async () => {
    const { FlipPadOffset } = await import('../3d/PadSprings.jsx');
    return { default: ({ currentDir, pos, rot, meta, faceSize }) => <FlipPadOffset meta={meta} size={faceSize} pos={pos} rot={rot}>
        <group name={currentDir} position={pos} />
    </FlipPadOffset> };
});
extend(THREE);

it('renders both mouths at the simulation lift, hides stalks underground, and resets a departed wake', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const before = useGameStore.getState();
    let cubies = makeCubies(6);
    cubies = flipStickerPair(cubies, 6, 2, 2, 5, 'PZ', buildManifoldGridMap(cubies, 6));
    const map = buildManifoldGridMap(cubies, 6), pairId = flipPadPair(cubies[2][2][5].stickers.PZ, 6);
    const ids = pairId.split('|'), ends = ids.map(id => map.get(id));
    const pair = { id: pairId, openness: 0.5, phase: 'opening' };
    const burrows = makeBurrows(); burrows.pairs.set(pairId, pair);
    for (const id of ids) burrows.bySticker.set(id, pair);
    burrowBridge.current = burrows;
    useGameStore.setState({ size: 6, cubies, explosionT: 0, mirrorMode: false, hollowMode: false, visualMode: 'solid',
        chaosLevel: 0, randomMode: false, demoMode: false, wormHealerMode: true, cubiePops: {},
        settings: { ...before.settings, flipPads: 'off', reducedMotion: true } });
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
        xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas);
    root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
    const refs = ends.map(() => createRef()), quiet = createRef();
    const previousLive = { ...liveCubies };
    try {
        let store;
        await act(async () => { store = root.render(<><PadProvider>
            {ends.map((p, i) => <Cubie key={i} ref={refs[i]} cubie={cubies[p.x][p.y][p.z]} position={[p.x - 2.5, p.y - 2.5, p.z - 2.5]} size={6} wormMode />)}
            <Cubie ref={quiet} cubie={cubies[3][3][5]} position={[0.5, 0.5, 2.5]} size={6} wormMode />
        </PadProvider><BurrowEffects size={6}/></>); });
        liveCubies.refs = []; liveCubies.size = 6;
        ends.forEach((p, i) => { liveCubies.refs[(p.x * 6 + p.y) * 6 + p.z] = refs[i].current; });
        store.getState().advance(1 / 60);
        refs.forEach((ref, i) => {
            const p = ends[i], center = new THREE.Vector3(p.x - 2.5, p.y - 2.5, p.z - 2.5);
            expect(ref.current.parent.position.distanceTo(center.multiplyScalar(selectiveCubieOffsetRatio(6, 0, wormRaisedAmount(6) * 0.5)))).toBeLessThan(1e-8);
            expect(ref.current.getObjectByName(p.dirKey).parent.position.length()).toBeCloseTo(WORM_PAD_HEIGHT * 0.5);
        });
        let stalk;
        store.getState().scene.traverse(o => {
            if (o.isInstancedMesh && o.material.fragmentShader?.includes('vLocal.z')) stalk = o;
        });
        expect(stalk.count).toBe(2);
        expect(PAD_STALK_DEPTH).toBeGreaterThan(0.5);
        await act(async () => useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: false } }));
        pair.openness = 0; pair.phase = 'underground';
        store.getState().advance(2 / 60);
        refs.forEach((ref, i) => {
            expect(ref.current.parent.position.length()).toBe(0);
            expect(ref.current.getObjectByName(ends[i].dirKey).parent.position.length()).toBe(0);
        });
        expect(stalk.count).toBe(0);
        const wakeId = getManifoldGridId(cubies[3][3][5].stickers.PZ, 6);
        burrows.wake.set(wakeId, { phase: 'burrowing', strength: 1 });
        burrows.wakeCubies.add('3,3,5');
        store.getState().advance(3 / 60);
        expect(quiet.current.parent.position.z).toBeCloseTo(0.13);
        burrows.wake.clear(); burrows.wakeCubies.clear(); store.getState().advance(4 / 60);
        expect(quiet.current.parent.position.length()).toBe(0);
        await act(async () => useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } }));
        pair.openness = 1; pair.phase = 'open'; store.getState().advance(5 / 60);
        expect(stalk.count).toBe(2);
        refs.forEach((ref, i) => expect(ref.current.getObjectByName(ends[i].dirKey).parent.position.length()).toBeCloseTo(WORM_PAD_HEIGHT));
        const closingEnd = ends[0];
        burrows.wake.set(ids[0], { ...closingEnd, phase: 'closing', strength: 1, remaining: 0.5 });
        store.getState().advance(6 / 60);
        const marker = store.getState().scene.children.filter(o => o.isInstancedMesh).at(-1);
        expect(marker.count).toBe(2); // Half of the four countdown segments remain.
        const markerMatrix = new THREE.Matrix4(), markerPosition = new THREE.Vector3();
        marker.getMatrixAt(0, markerMatrix); markerPosition.setFromMatrixPosition(markerMatrix);
        expect(Math.abs(markerPosition.z)).toBeCloseTo(3.025, 4); // Original surface, not beneath the raised stalk.
    } finally {
        await act(async () => root.unmount());
        burrowBridge.current = null; useGameStore.setState(before, true);
        Object.assign(liveCubies, previousLive);
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
});
