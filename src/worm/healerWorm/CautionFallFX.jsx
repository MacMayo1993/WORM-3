import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createCautionDissolve } from './cautionDissolve.js';

export default function CautionFallFX({ worm, body }) {
    const active = useRef(null), restore = useRef(null);
    const uniforms = useMemo(() => ({ uDissolve: { value: 0 }, uDissolveFrame: { value: new THREE.Matrix4() } }), []);
    useEffect(() => () => restore.current?.(), []);
    useFrame(() => {
        const fall = worm.cautionFall?.current;
        if (fall !== active.current) {
            restore.current?.(); restore.current = null;
            active.current = fall;
            uniforms.uDissolve.value = 0;
            if (fall && body.current) {
                // Align the intro's top-to-bottom grain with the inward fall.
                const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fall.normal);
                uniforms.uDissolveFrame.value.compose(fall.mouth, rotation, new THREE.Vector3(1, 1, 1)).invert();
                restore.current = createCautionDissolve(body.current, uniforms);
            }
        }
        uniforms.uDissolve.value = fall?.dissolve ?? 0;
    });
    return null;
}
