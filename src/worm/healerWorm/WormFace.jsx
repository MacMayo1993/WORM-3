// src/worm/healerWorm/WormFace.jsx
// Worm face (eyes, smile, hat, glasses) glued to the head each frame.
// Extracted verbatim from HealerWormMode.jsx (2026-07); no behavior change.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getTunnelWorldPosInto, getWindWorldPosInto } from '../wormLogic.js';
import { WORM_LIFT, FACE_NORMALS, DIR_FORWARD } from './constants.js';
import WormHat3D from '../wormCosmetics.jsx';
import { _hatAlignQuat, _hatYUp } from '../wormCosmeticsData.js';

// ─── Worm Face (eyes + smile) ─────────────────────────────────────────────────
const _faceRight = new THREE.Vector3();
const _faceForward = new THREE.Vector3();
const _faceHeadPos = new THREE.Vector3();
const _faceTunnelAhead = new THREE.Vector3(); // scratch for tunnel tangent during enter/exit
// Glasses orientation — torus axis (Y) aligned to face-forward so ring appears circular
const _glassAxisY = new THREE.Vector3(0, 1, 0);
const _glassQuat = new THREE.Quaternion();

export function WormFace({ worm, size }) {
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const smile0 = useRef(), smile1 = useRef(), smile2 = useRef();
    const smileRefs = [smile0, smile1, smile2];
    const hatGroupRef = useRef();
    const glassLeftRef = useRef();
    const glassRightRef = useRef();
    const faceOpacityRef = useRef(1);
    const wormHatId = useGameStore(s => s.wormHat ?? 'none');
    const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
    const isBook = wormCharacterId === 'book';

    useFrame((_, delta) => {
        // Face stays visible through the whole Möbius ride now (worm rides the band on-camera).
        const showFace = true;
        faceOpacityRef.current += ((showFace ? 1 : 0) - faceOpacityRef.current) * Math.min(1, delta * 9);
        const faceVisible = faceOpacityRef.current > 0.05;
        if (leftEyeRef.current)  leftEyeRef.current.visible  = faceVisible;
        if (rightEyeRef.current) rightEyeRef.current.visible = faceVisible;
        for (const ref of smileRefs) if (ref.current) ref.current.visible = faceVisible;
        if (hatGroupRef.current)    hatGroupRef.current.visible    = faceVisible;
        if (glassLeftRef.current)   glassLeftRef.current.visible   = faceVisible;
        if (glassRightRef.current)  glassRightRef.current.visible  = faceVisible;
        if (!faceVisible) return;

        const phase = worm.phase.current;
        const inTransit = (phase === 'entering' || phase === 'tunnel' || phase === 'exiting' || phase === 'windout') && worm.activeTunnel.current;

        let normal;
        if (inTransit) {
            // During entering/tunnel/exiting/windout the head is driven by getTunnelWorldPosInto
            // or getWindWorldPosInto. Read headInterpPos/currentNormal which are always current.
            _faceHeadPos.copy(worm.headInterpPos.current);
            normal = worm.currentNormal.current;

            if (phase === 'windout') {
                // Tangent from the exit spiral: look slightly ahead in s (s decreases as prog rises)
                const prog = worm.tunnelProgress.current;
                const sHead = 1.0 - prog;
                const sAhead = Math.max(0, sHead - 0.05);
                getWindWorldPosInto(_faceTunnelAhead, worm.activeTunnel.current, 'exit', sAhead, size);
                _faceForward.copy(_faceTunnelAhead).sub(_faceHeadPos);
                if (_faceForward.lengthSq() < 0.0001) _faceForward.set(0, 0, 1);
                _faceForward.normalize();
            } else {
                // Derive forward from the tunnel tangent at the current parametric position.
                const tp = worm.tunnelProgress.current;
                const t = phase === 'entering' ? tp * 0.33 : phase === 'tunnel' ? 0.33 + tp * 0.34 : 0.67 + tp * 0.33;
                const tAhead = Math.min(t + 0.02, 1.0);
                getTunnelWorldPosInto(_faceTunnelAhead, worm.activeTunnel.current, tAhead, size);
                _faceForward.copy(_faceTunnelAhead).sub(_faceHeadPos);
                if (_faceForward.lengthSq() < 0.0001) _faceForward.set(0, 0, 1);
                _faceForward.normalize();
            }

            // Head rides the ribbon/spiral centerline; 0.09 keeps face on the head sphere front.
            _faceHeadPos.addScaledVector(normal, 0.09);
        } else {
            const { dirKey } = worm.pos.current;
            normal = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
            _faceForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);

            // Interpolated head world pos (copy into scratch — no .clone())
            const prev = worm.prevWorldPos.current;
            const cur = worm.curWorldPos.current;
            if (!cur) {
                const wp = getStickerWorldPos(worm.pos.current.x, worm.pos.current.y,
                    worm.pos.current.z, dirKey, size, 0);
                _faceHeadPos.set(wp[0], wp[1], wp[2]);
            } else if (prev && worm.interpT.current < 1) {
                _faceHeadPos.lerpVectors(prev, cur, worm.interpT.current);
            } else {
                _faceHeadPos.copy(cur);
            }
            const jumpLiftVal = worm.isJumping.current
                ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
            _faceHeadPos.addScaledVector(normal, WORM_LIFT + jumpLiftVal + 0.09);
        }

        // Rightward axis in the face plane
        _faceRight.crossVectors(_faceForward, normal).normalize();
        if (_faceRight.lengthSq() < 0.001) _faceRight.set(1, 0, 0);

        const S = 0.022;
        if (leftEyeRef.current) {
            leftEyeRef.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, 0.028)
                .addScaledVector(_faceForward, 0.025);
            leftEyeRef.current.scale.setScalar(S);
        }
        if (rightEyeRef.current) {
            rightEyeRef.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, -0.028)
                .addScaledVector(_faceForward, 0.025);
            rightEyeRef.current.scale.setScalar(S);
        }
        const smileOffsets = [-0.022, 0, 0.022];
        for (let i = 0; i < smileRefs.length; i++) {
            const ref = smileRefs[i];
            if (!ref.current) continue;
            const xo = smileOffsets[i];
            const yo = i === 1 ? -0.028 : -0.022;
            ref.current.position.copy(_faceHeadPos)
                .addScaledVector(_faceRight, xo)
                .addScaledVector(normal, yo * 0.3)
                .addScaledVector(_faceForward, 0.025);
            ref.current.scale.setScalar(S * 0.55);
        }

        // Hat: position above head, orient Y to face normal
        if (hatGroupRef.current) {
            hatGroupRef.current.position.copy(_faceHeadPos)
                .addScaledVector(normal, 0.04);
            _hatAlignQuat.setFromUnitVectors(_hatYUp, normal);
            hatGroupRef.current.quaternion.copy(_hatAlignQuat);
        }

        // Book worm glasses — torus rings in front of each eye, axis aligned to forward
        if (isBook) {
            _glassQuat.setFromUnitVectors(_glassAxisY, _faceForward);
            const GS = 0.054;
            if (glassLeftRef.current) {
                glassLeftRef.current.position.copy(_faceHeadPos)
                    .addScaledVector(_faceRight, 0.028)
                    .addScaledVector(_faceForward, 0.029);
                glassLeftRef.current.quaternion.copy(_glassQuat);
                glassLeftRef.current.scale.setScalar(GS);
            }
            if (glassRightRef.current) {
                glassRightRef.current.position.copy(_faceHeadPos)
                    .addScaledVector(_faceRight, -0.028)
                    .addScaledVector(_faceForward, 0.029);
                glassRightRef.current.quaternion.copy(_glassQuat);
                glassRightRef.current.scale.setScalar(GS);
            }
        }
    });

    return (
        <>
            <mesh ref={leftEyeRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="white" />
            </mesh>
            <mesh ref={rightEyeRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="white" />
            </mesh>
            {smileRefs.map((ref, i) => (
                <mesh key={i} ref={ref}>
                    <sphereGeometry args={[1, 6, 6]} />
                    <meshBasicMaterial color="#111" />
                </mesh>
            ))}
            {wormHatId !== 'none' && (
                <group ref={hatGroupRef}>
                    <WormHat3D type={wormHatId} scale={0.07} />
                </group>
            )}
            {/* Book worm glasses — two torus rings, only rendered for book character */}
            {isBook && (
                <>
                    <mesh ref={glassLeftRef}>
                        <torusGeometry args={[1, 0.13, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh ref={glassRightRef}>
                        <torusGeometry args={[1, 0.13, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                </>
            )}
        </>
    );
}
