import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createCautionDissolve } from './cautionDissolve.js';
import { CAUTION_OPENING_RADIUS } from './cautionOpening.js';

const UP = new THREE.Vector3(0, 1, 0);
const SHAFT_TOP = CAUTION_OPENING_RADIUS - 0.008;
const SHAFT_BOTTOM = 0.28;
const DEPTH_MARKS = [0.12, 0.35, 0.58, 0.81];

export default function CautionFallFX({ worm, body }) {
    const active = useRef(null), restore = useRef(null);
    const shaft = useRef();
    const uniforms = useMemo(() => ({ uDissolve: { value: 0 }, uDissolveFrame: { value: new THREE.Matrix4() } }), []);
    useEffect(() => () => restore.current?.(), []);
    useFrame(() => {
        const fall = worm.cautionFall?.current;
        if (shaft.current) shaft.current.visible = !!fall;
        if (fall !== active.current) {
            restore.current?.(); restore.current = null;
            active.current = fall;
            uniforms.uDissolve.value = 0;
            if (fall && shaft.current) {
                shaft.current.position.copy(fall.mouth);
                shaft.current.quaternion.setFromUnitVectors(UP, fall.normal);
                shaft.current.scale.set(1, fall.depth + 0.2, 1);
            }
            if (fall && body.current) {
                // Dissolve from the leading end only after the visible descent.
                const rotation = new THREE.Quaternion().setFromUnitVectors(UP, fall.normal.clone().negate());
                uniforms.uDissolveFrame.value.compose(fall.mouth, rotation, new THREE.Vector3(1, 1, 1)).invert();
                uniforms.uDissolveFrame.value.elements[13] += 0.2;
                restore.current = createCautionDissolve(body.current, uniforms);
            }
        }
        uniforms.uDissolve.value = fall?.dissolve ?? 0;
    });
    // A real open shaft provides depth references behind the falling worm.
    // Nothing is painted over the mouth; the tile and bands use the same bore.
    return <group ref={shaft} name="caution-fall-shaft" visible={false}>
        <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[SHAFT_TOP, SHAFT_BOTTOM, 1, 40, 1, true]} />
            <meshBasicMaterial color="#182536" side={THREE.BackSide} />
        </mesh>
        {DEPTH_MARKS.map(t => {
            const radius = THREE.MathUtils.lerp(SHAFT_TOP, SHAFT_BOTTOM, t) - 0.002;
            return <mesh key={t} position={[0, -t, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius - 0.012, radius, 40]} />
                <meshBasicMaterial color="#65798f" side={THREE.DoubleSide} />
            </mesh>;
        })}
        <mesh position={[0, -0.995, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[SHAFT_BOTTOM, 40]} />
            <meshBasicMaterial color="#080c14" />
        </mesh>
    </group>;
}
