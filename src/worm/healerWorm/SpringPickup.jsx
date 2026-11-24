import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { createTrampolineBatch } from './trampolineModel.js';

export default function SpringPickup() {
    const model = useMemo(() => createTrampolineBatch(1), []);
    const animation = useMemo(() => ({ time: 0, matrix: new THREE.Matrix4() }), []);
    useEffect(() => () => model.dispose(), [model]);
    useFrame((_, delta) => {
        const state = useGameStore.getState();
        if (!state.wormPaused) animation.time += Math.min(delta, 0.05);
        // A deliberate press and release reads as a spring, not just a wobbling decal.
        const compression = state.settings?.reducedMotion || prefersReducedMotion() ? 0
            : Math.max(0, Math.sin(animation.time * 3.6)) ** 6 * 0.78;
        model.put(0, animation.matrix, compression); model.flush();
    });
    return <group name="spring-pickup">{model.meshes.map(mesh => <primitive key={mesh.name} object={mesh} />)}</group>;
}
