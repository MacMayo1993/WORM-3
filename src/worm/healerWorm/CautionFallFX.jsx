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
                // Consume the leading end first as it is pulled onto the tile.
                // The previous normal-aligned field hid the head inside the cube
                // before its grain became visible on the surface body.
                const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fall.approach);
                uniforms.uDissolveFrame.value.compose(fall.mouth, rotation, new THREE.Vector3(1, 1, 1)).invert();
                uniforms.uDissolveFrame.value.elements[13] += 1.4;
                restore.current = createCautionDissolve(body.current, uniforms);
            }
        }
        uniforms.uDissolve.value = fall?.dissolve ?? 0;
    });
    return null;
}
