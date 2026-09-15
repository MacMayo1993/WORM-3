// src/holonomy/HolonomyTracer.jsx
// 3D renderer for Holonomy Mode.
// Renders: tracer sphere, transported-vector arrow, fading trail,
// seam-flash/loop-closed burst effects, and per-face swirl field lines.

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
    chartToWorld, localVecToWorld, FACE_KEYS, FACE_CHARGE, swirlArrowPositions,
} from './holonomyMath.js';

// Colours
const TRACER_COLOR_OBJ = new THREE.Color('#00f5ff');
const TRAIL_COLOR_OBJ = new THREE.Color('#007080');
const MOBIUS_COLOR_OBJ = new THREE.Color('#ff00ff');
const LOOP_COLOR_OBJ = new THREE.Color('#cc44ff');

const MAX_TRAIL = 30;
const SWIRL_LINES_PER_FACE = 12;
const _dummy = new THREE.Object3D();

// ─── Per-face swirl field visualization ──────────────────────────────────────
// `twist` animates continuously, so this used to rebuild 24 Vector3s AND a fresh
// BufferGeometry per face per frame — six undisposed GPU buffers a frame, which
// is a leak, not just garbage. The arrow field now owns one geometry for its
// lifetime and rewrites the position attribute in place, reading twist from a ref
// so an animating field costs no React render at all.
function SwirlFieldLines({ faceKey, twistRef }) {
    const geom = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(SWIRL_LINES_PER_FACE * 2 * 3), 3)
        );
        return g;
    }, []);

    useEffect(() => () => geom.dispose(), [geom]);

    // Last twist actually written, so a paused/steady field skips the rewrite.
    const writtenTwist = useRef(NaN);

    const writeArrows = useCallback((twist) => {
        swirlArrowPositions(faceKey, twist, SWIRL_LINES_PER_FACE, geom.attributes.position.array);
        geom.attributes.position.needsUpdate = true;
        geom.computeBoundingSphere();
    }, [faceKey, geom]);

    // Seed before the first frame so the field is never briefly collapsed at the
    // origin, and re-seed when the face changes identity under the same geometry.
    useEffect(() => {
        writtenTwist.current = NaN;
        writeArrows(twistRef?.current ?? 0);
    }, [writeArrows, twistRef]);

    useFrame(() => {
        const twist = twistRef?.current ?? 0;
        if (twist === writtenTwist.current) return;
        writtenTwist.current = twist;
        writeArrows(twist);
    });

    const charge = FACE_CHARGE[FACE_KEYS.indexOf(faceKey)];
    const col = charge === 0 ? '#004455' : '#440055';

    return (
        <lineSegments geometry={geom}>
            <lineBasicMaterial color={col} transparent opacity={0.35} />
        </lineSegments>
    );
}

// ─── Main tracer ──────────────────────────────────────────────────────────────
export default function HolonomyTracer({
    tracerFace,
    tracerU,
    tracerV,
    transportVec,
    twistRef,
    seamCount = 0,
    mobiusCount = 0,
    loopClosed = false,
}) {
    const headRef = useRef();
    const glowRef = useRef();
    const trailRef = useRef();
    const arrowRef = useRef();
    const burstRef = useRef();
    const timeRef = useRef(0);

    const trailHistory = useRef([]);
    const burstActive = useRef(false);
    const burstTimer = useRef(0);
    const burstColor = useRef(TRACER_COLOR_OBJ.clone());
    const prevSeam = useRef(0);
    const prevMobius = useRef(0);
    const prevLoop = useRef(false);

    // Compute world position
    const worldPos = useMemo(() => {
        if (!tracerFace) return null;
        return chartToWorld(tracerFace, tracerU, tracerV, 0, 0.58);
    }, [tracerFace, tracerU, tracerV]);

    // Update trail
    useEffect(() => {
        if (!worldPos) return;
        trailHistory.current = [[...worldPos], ...trailHistory.current].slice(0, MAX_TRAIL);
    }, [worldPos]);

    // Update arrow direction
    useEffect(() => {
        if (!arrowRef.current || !tracerFace || !transportVec) return;
        const dir = localVecToWorld(tracerFace, transportVec);
        const v3 = new THREE.Vector3(...dir);
        if (v3.lengthSq() < 0.0001) return;
        arrowRef.current.setDirection(v3);
        arrowRef.current.position.set(...(worldPos || [0, 0, 0]));
        arrowRef.current.setLength(0.55, 0.16, 0.09);
    }, [tracerFace, transportVec, worldPos]);

    useFrame((_s, delta) => {
        timeRef.current += delta;
        const t = timeRef.current;

        // Head pulse
        if (headRef.current) headRef.current.scale.setScalar(0.16 + Math.sin(t * 7) * 0.025);
        if (glowRef.current) glowRef.current.material.opacity = 0.12 + Math.sin(t * 7) * 0.06;

        // Seam flash
        if (prevSeam.current !== seamCount) {
            const isMob = mobiusCount > prevMobius.current;
            prevMobius.current = mobiusCount;
            prevSeam.current = seamCount;
            burstColor.current.set(isMob ? MOBIUS_COLOR_OBJ : TRACER_COLOR_OBJ);
            burstActive.current = true;
            burstTimer.current = 0;
        }

        // Loop closed burst
        if (loopClosed && !prevLoop.current) {
            prevLoop.current = true;
            burstColor.current.set(LOOP_COLOR_OBJ);
            burstActive.current = true;
            burstTimer.current = 0;
        }
        if (!loopClosed) prevLoop.current = false;

        // Animate burst
        if (burstActive.current && burstRef.current) {
            burstTimer.current += delta;
            const sc = 0.25 + burstTimer.current * 2.5;
            burstRef.current.scale.setScalar(sc);
            burstRef.current.material.color.set(burstColor.current);
            burstRef.current.material.opacity = Math.max(0, 0.75 - burstTimer.current * 1.5);
            if (burstTimer.current > 0.5) burstActive.current = false;
        }

        // Trail instanced mesh
        const mesh = trailRef.current;
        if (mesh) {
            const hist = trailHistory.current;
            for (let i = 0; i < MAX_TRAIL; i++) {
                const pos = hist[i];
                if (!pos) {
                    _dummy.scale.setScalar(0);
                    _dummy.updateMatrix();
                    mesh.setMatrixAt(i, _dummy.matrix);
                    continue;
                }
                _dummy.position.set(pos[0], pos[1], pos[2]);
                const fade = 1 - i / MAX_TRAIL;
                _dummy.scale.setScalar(0.06 * fade);
                _dummy.rotation.set(0, 0, 0);
                _dummy.updateMatrix();
                mesh.setMatrixAt(i, _dummy.matrix);
                mesh.setColorAt(i, TRAIL_COLOR_OBJ.clone().multiplyScalar(fade));
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    });

    if (!worldPos) return null;

    return (
        <group>
            {/* Swirl field lines on each face */}
            {FACE_KEYS.map(fk => (
                <SwirlFieldLines key={fk} faceKey={fk} twistRef={twistRef} />
            ))}

            {/* Trail */}
            <instancedMesh ref={trailRef} args={[undefined, undefined, MAX_TRAIL]} frustumCulled={false}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="#00f5ff" />
            </instancedMesh>

            {/* Tracer head */}
            <group position={worldPos}>
                <mesh ref={headRef}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshStandardMaterial
                        color={TRACER_COLOR_OBJ}
                        emissive={TRACER_COLOR_OBJ}
                        emissiveIntensity={1.8}
                    />
                </mesh>
                {/* Glow */}
                <mesh ref={glowRef}>
                    <sphereGeometry args={[1.7, 16, 16]} />
                    <meshBasicMaterial color={TRACER_COLOR_OBJ} transparent opacity={0.12} side={THREE.BackSide} />
                </mesh>
                {/* Burst flash */}
                <mesh ref={burstRef}>
                    <sphereGeometry args={[0.3, 10, 10]} />
                    <meshBasicMaterial color={TRACER_COLOR_OBJ} transparent opacity={0} />
                </mesh>
            </group>

            {/* Arrow (transport vector) — positioned in useEffect above */}
            <primitive
                ref={arrowRef}
                object={new THREE.ArrowHelper(
                    new THREE.Vector3(1, 0, 0),
                    new THREE.Vector3(...worldPos),
                    0.55, 0x00ff88, 0.16, 0.09
                )}
            />
        </group>
    );
}
