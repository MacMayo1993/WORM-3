// src/worm/healerWorm/WormFace.jsx
// Extracted from HealerWormMode.jsx (2026-07 monolith split) — code unchanged.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getTunnelWorldPosInto, getWindWorldPosInto } from '../wormLogic.js';
import WormHat3D from '../wormCosmetics.jsx';
import { layoutWormFace, FACE_LAYOUT, MOUTH_ARC } from '../wormFaceLayout.js';
import { BOOK_HEAD_LIFT } from '../wormBookFX.js';
import { _hatAlignQuat, _hatYUp } from '../wormCosmeticsData.js';
import { WORM_LIFT, FACE_NORMALS, DIR_FORWARD, rocketFlightLift } from './constants.js';

// Head radius, matching WormBody's head scale.
const HEAD_RADIUS = 0.092;

// Reused each frame so the layout never allocates.
const _faceParts = { eyes: [null, null], pupils: [null, null], glasses: [null, null], mouth: null, hat: null };

// ─── Worm Face (eyes + pupils + smile) ────────────────────────────────────────
const _faceRight = new THREE.Vector3();
const _faceForward = new THREE.Vector3();
const _faceHeadPos = new THREE.Vector3();
const _faceTunnelAhead = new THREE.Vector3(); // scratch for tunnel tangent during enter/exit

export function WormFace({ worm, size }) {
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const leftPupilRef = useRef();
    const rightPupilRef = useRef();
    const mouthRef = useRef();
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
        if (leftPupilRef.current)  leftPupilRef.current.visible  = faceVisible;
        if (rightPupilRef.current) rightPupilRef.current.visible = faceVisible;
        if (mouthRef.current)      mouthRef.current.visible      = faceVisible;
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

            // Head rides the ribbon/spiral centerline; the layout places the face
            // on the head sphere from its centre.
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
            // Fly with the body during a rocket burn so the face stays on the risen head.
            const flightLift = rocketFlightLift(worm.rocketActive.current, worm.rocketT.current);
            _faceHeadPos.addScaledVector(normal, WORM_LIFT + jumpLiftVal + flightLift);
        }

        // Eyes, pupils, smile, lenses and the hat seat all come from the shared
        // face layout so the previews draw the same worm.
        _faceParts.eyes[0] = leftEyeRef.current;
        _faceParts.eyes[1] = rightEyeRef.current;
        _faceParts.pupils[0] = leftPupilRef.current;
        _faceParts.pupils[1] = rightPupilRef.current;
        _faceParts.mouth = mouthRef.current;
        _faceParts.glasses[0] = isBook ? glassLeftRef.current : null;
        _faceParts.glasses[1] = isBook ? glassRightRef.current : null;
        _faceParts.hat = hatGroupRef.current;
        // The Book Worm's head is a round orb like everyone else's now, so it
        // takes the shared sphere layout too — it only needs the small lift that
        // keeps its head level with its floating book body.
        if (isBook) _faceHeadPos.addScaledVector(normal, BOOK_HEAD_LIFT);
        layoutWormFace(_faceHeadPos, _faceForward, normal, HEAD_RADIUS, _faceParts);

        if (hatGroupRef.current) {
            _hatAlignQuat.setFromUnitVectors(_hatYUp, normal);
            hatGroupRef.current.quaternion.copy(_hatAlignQuat);
        }

    });

    return (
        <>
            <mesh ref={leftEyeRef}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial color="white" />
            </mesh>
            <mesh ref={rightEyeRef}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial color="white" />
            </mesh>
            {/* Pupils — a blank white eye reads as no eye at all once the worm
                is thumbnail-sized. */}
            <mesh ref={leftPupilRef}>
                <sphereGeometry args={[1, 10, 10]} />
                <meshBasicMaterial color="#12131a" />
            </mesh>
            <mesh ref={rightPupilRef}>
                <sphereGeometry args={[1, 10, 10]} />
                <meshBasicMaterial color="#12131a" />
            </mesh>
            {/* Smile — one curved mouth. Three dots in a row disappeared at any
                size a phone actually renders the worm at. */}
            <mesh ref={mouthRef}>
                <torusGeometry args={[1, FACE_LAYOUT.mouthTube / FACE_LAYOUT.mouthRadius, 8, 20, MOUTH_ARC]} />
                <meshBasicMaterial color="#12131a" />
            </mesh>
            {wormHatId !== 'none' && (
                <group ref={hatGroupRef}>
                    <WormHat3D type={wormHatId} scale={HEAD_RADIUS * FACE_LAYOUT.hatScale} />
                </group>
            )}
            {/* Book worm glasses — two torus rings, only rendered for book character */}
            {isBook && (
                <>
                    <mesh ref={glassLeftRef}>
                        <torusGeometry args={[1, FACE_LAYOUT.glassTube / FACE_LAYOUT.glassRadius, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh ref={glassRightRef}>
                        <torusGeometry args={[1, FACE_LAYOUT.glassTube / FACE_LAYOUT.glassRadius, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                </>
            )}
        </>
    );
}
