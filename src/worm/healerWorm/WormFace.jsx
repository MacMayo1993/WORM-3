import { createAccessoryRig, poseHeadAccessories, poseHandmadeHat } from '../wormAccessories.js';
import { EMPTY_ACCESSORIES } from '../handmadeAccessoriesData.js';
import { createMobiOrbPalette } from '../mobiOrbAppearance.js';
// src/worm/healerWorm/WormFace.jsx
// Shared character expressions follow the head across surfaces and tunnels.
import { createCharacterAccents, poseCharacterAccents } from '../wormCharacterVisuals.js';
import { animateWormFace } from '../wormFaceExpression.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { finishWormEyes } from '../wormCharacterFinish.js';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { getTunnelWorldPosSmoothInto, getWindWorldPosInto } from '../wormLogic.js';
import { tunnelTraversalT } from '../../utils/tunnelPath.js';
import WormHat3D from '../wormCosmetics.jsx';
import { layoutWormFace, FACE_LAYOUT } from '../wormFaceLayout.js';
import { BOOK_HEAD_LIFT } from '../wormBookFX.js';
import { _hatAlignQuat, _hatYUp, getSkin } from '../wormCosmeticsData.js';
import { WORM_LIFT, WORM_HEAD_RADIUS, FACE_NORMALS, DIR_FORWARD, windoutHeadS } from './constants.js';
import { createMobiModel, animateMobi, orientMobi, disposeMobi, setMobiOrbAppearance, mobiHeadFrameInto, MOBI_RADIUS } from '../mobiModel.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { bodyPathHeadInto } from './sliceBodyPath.js';
import { rocketOrbitT, rocketOrbitInto, rocketFrameInto } from './rocketOrbit.js';

// Head radius, matching WormBody's head scale.
// Book keeps its authored head; round characters share the larger body head.
const headRadiusFor = character => character === 'book' ? 0.092 : WORM_HEAD_RADIUS;

// Reused each frame so the layout never allocates.
const _faceParts = { eyes: [null, null], pupils: [null, null], glasses: [null, null], mouth: null, hat: null };

// ─── Worm Face (eyes + pupils + smile) ────────────────────────────────────────
const _faceRight = new THREE.Vector3();
const _faceForward = new THREE.Vector3();
const _rocketFaceNormal = new THREE.Vector3();
const _faceHeadPos = new THREE.Vector3();
const _faceTunnelAhead = new THREE.Vector3(); // scratch for tunnel tangent during enter/exit
const _faceTunnelBehind = new THREE.Vector3();
const _faceFlightTurn = new THREE.Quaternion();
const _mobiRideAxis = new THREE.Vector3();
const _mobiHeadPos = new THREE.Vector3();
const _mobiHeadForward = new THREE.Vector3();
const _mobiHeadNormal = new THREE.Vector3();
const _mobiHeadQuat = new THREE.Quaternion();

export function WormFace({ worm, size }) {
    const equipment = useGameStore(s => s.wormAccessories ?? EMPTY_ACCESSORIES);
    const accessories = useMemo(() => createAccessoryRig({face: equipment.face, neck: equipment.neck}), [equipment.face, equipment.neck]);
    useEffect(() => () => accessories.dispose(), [accessories]);
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
    const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
    const accents = useMemo(() => createCharacterAccents(wormCharacterId), [wormCharacterId]);
    useEffect(() => () => accents.dispose(), [accents]);
    useEffect(() => { accents.setSkin(getSkin(wormSkinId)); }, [accents, wormSkinId]);
    const isBook = wormCharacterId === 'book';
    const showBookGlasses = isBook && equipment.face === 'none';
    const isMobi = wormCharacterId === 'mobi';
    const settings = useGameStore(s => s.settings);
    const mobiPalette = useMemo(() => isMobi ? createMobiOrbPalette(settings) : null, [isMobi, settings]);
    const mobi = useMemo(() => isMobi ? createMobiModel() : null, [isMobi]);
    useEffect(() => () => { if (mobi) disposeMobi(mobi); }, [mobi]);
    useEffect(() => {
        if (isMobi) return;
        return finishWormEyes([leftEyeRef.current, rightEyeRef.current], [leftPupilRef.current, rightPupilRef.current], wormCharacterId, mouthRef.current);
    }, [isMobi, wormCharacterId]);
    const faceTime = useRef(0);
    const reducedMotion = useMemo(() => prefersReducedMotion(), []);
    const facePulse = useRef(0);
    const previousOrbs = useRef(0);
    const koTime = useRef(0); // seconds since death; runs while the game clock is frozen

    const runId = useGameStore(s => s.wormRunId);
    useEffect(() => {
        faceTime.current = 0; facePulse.current = 0; previousOrbs.current = 0; koTime.current = 0;
        faceOpacityRef.current = 1;
    }, [runId]);

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
        const inTransit = (phase === 'windup' || phase === 'entering' || phase === 'tunnel' || phase === 'exiting' || phase === 'windout') && worm.activeTunnel.current;

        let normal;
        if (inTransit) {
            // During entering/tunnel/exiting/windout the head is driven by getTunnelWorldPosSmoothInto
            // or getWindWorldPosInto. Read headInterpPos/currentNormal which are always current.
            _faceHeadPos.copy(worm.headInterpPos.current);
            normal = worm.currentNormal.current;

            if (phase === 'windout' || phase === 'windup') {
                // Look along the mouth handoff itself: round a raised pad's coil
                // and then down into the mouth (up out of it on exit). A fixed
                // span keeps the direction defined at both ends of the curve.
                const exiting = phase === 'windout';
                const side = exiting ? 'exit' : 'entry';
                const tp = THREE.MathUtils.clamp(worm.tunnelProgress.current, 0, 1);
                const step = exiting ? -0.03 : 0.03;
                const ahead = THREE.MathUtils.clamp((exiting ? windoutHeadS(tp) : tp) + step, 0, 1);
                getWindWorldPosInto(_faceTunnelAhead, worm.activeTunnel.current, side, ahead, size);
                getWindWorldPosInto(_faceTunnelBehind, worm.activeTunnel.current, side, THREE.MathUtils.clamp(ahead - step, 0, 1), size);
                _faceForward.subVectors(_faceTunnelAhead, _faceTunnelBehind);
                if (_faceForward.lengthSq() < 1e-12) _faceForward.copy(normal).multiplyScalar(exiting ? 1 : -1);
                _faceForward.normalize();
            } else {
                // Derive forward from the tunnel tangent at the current parametric position.
                const tp = worm.tunnelProgress.current;
                const t = tunnelTraversalT(phase, tp);
                const tAhead = Math.min(t + 0.02, 1.0);
                getTunnelWorldPosSmoothInto(_faceTunnelAhead, worm.activeTunnel.current, tAhead, size);
                _faceForward.copy(_faceTunnelAhead).sub(_faceHeadPos);
                if (_faceForward.lengthSq() < 0.0001) _faceForward.set(0, 0, 1);
                _faceForward.normalize();
            }

            // Head rides the ribbon/spiral centerline; the layout places the face
            // on the head sphere from its centre.
        } else if (worm.padFlight?.current) {
            // A pad flight carries the head along its arc. The crawl
            // interpolation still points at the tile the jump left from, which
            // left the eyes on the floor while the head flew. Face the landing
            // heading, turned with the flight's normal across a cube edge.
            const flight = worm.padFlight.current;
            normal = worm.currentNormal.current;
            bodyPathHeadInto(_faceHeadPos, worm);
            _faceForward.copy(flight.heading).applyQuaternion(_faceFlightTurn.setFromUnitVectors(flight.endNormal, normal));
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
                ? worm.jumpLift() : 0;
            _faceHeadPos.addScaledVector(normal, WORM_LIFT + jumpLiftVal);
            // Ride the same orbit the body rides during a rocket burn, so the face
            // stays on the risen head instead of tracking its own face normal.
            rocketOrbitInto(_faceHeadPos, size, rocketOrbitT(worm.rocketActive.current, worm.rocketT.current, worm.rocketFlight?.current));
        }

        if (!inTransit && worm.rocketActive.current) {
            // One live anchor for the body, face, glasses and hat at corners.
            bodyPathHeadInto(_faceHeadPos, worm);
            const lift = rocketOrbitT(true, worm.rocketT.current, worm.rocketFlight?.current);
            normal = _rocketFaceNormal.copy(worm.currentNormal.current);
            rocketFrameInto(_faceForward, normal, _faceHeadPos, size, lift);
            rocketOrbitInto(_faceHeadPos, size, lift);
        }

        const state = useGameStore.getState();
        const rideWeight = inTransit ? (worm.tunnelRide?.current?.rideWeight ?? 0) : 0;
        const rideShift = inTransit ? (worm.tunnelHeadShift ?? 0) : 0;
        _faceHeadPos.addScaledVector(normal, rideShift);
        // WormBody runs first and supplies the final surface-cleared head anchor.
        if (wormCharacterId === 'wiggle' && worm.wiggleHeadPosition) _faceHeadPos.copy(worm.wiggleHeadPosition);
        const dt = state.wormPaused || !state.wormAlive ? 0 : Math.min(delta, 0.05);
        faceTime.current += dt;
        koTime.current = state.wormAlive ? 0 : koTime.current + Math.min(delta, 0.05);
        const count = worm.orbPickupColorsRef.current.length;
        if (count > previousOrbs.current) facePulse.current = 1;
        previousOrbs.current = count;
        facePulse.current = Math.max(0, facePulse.current - dt * 2);

        if (mobi) {
            // Use the same interpolated anchor/current normal as the body.
            const bodyTransit = phase === 'windup' || phase === 'entering' || phase === 'tunnel' || phase === 'exiting' || phase === 'windout';
            normal = worm.currentNormal.current;
            mobi.group.position.copy(worm.headInterpPos.current);
            mobi.group.position.addScaledVector(normal, rideShift);
            if (!bodyTransit) {
                const jump = worm.isJumping.current ? worm.jumpLift() : 0;
                mobi.group.position.addScaledVector(normal, WORM_LIFT + jump);
            }
            rocketOrbitInto(mobi.group.position, size, rocketOrbitT(worm.rocketActive.current, worm.rocketT.current, worm.rocketFlight?.current));
            if (!inTransit && worm.rocketActive.current) {
                mobi.group.position.copy(_faceHeadPos);
                normal = _rocketFaceNormal;
            }
            if (!inTransit && liveRotation.active) {
                const { x, y, z } = worm.pos.current;
                const angle = liveLayerAngle(x, y, z);
                if (angle !== null) {
                    const axis = liveRotation.axis;
                    _mobiRideAxis.set(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
                    _faceForward.applyAxisAngle(_mobiRideAxis, angle);
                }
            }
            orientMobi(mobi.group, _faceForward, normal);
            const faces = worm.orbPickupFaceIdsRef.current;
            setMobiOrbAppearance(mobi, mobiPalette[faces[faces.length - 1]] || mobiPalette[0]);
            if (!bodyTransit) mobi.group.position.addScaledVector(normal, 0.035);
            animateMobi(mobi, faceTime.current, { pulse: facePulse.current, transit: !!inTransit });
            mobi.group.scale.setScalar(MOBI_RADIUS * (worm.pickupHeadScale ?? 1) * (worm.tunnelHeadScale ?? 1));
            const headRadius = MOBI_RADIUS * (worm.pickupHeadScale ?? 1) * (worm.tunnelHeadScale ?? 1);
            // Hats and glasses ride the animated head: its bob, lean and tilt.
            mobiHeadFrameInto(mobi, _mobiHeadPos, _mobiHeadForward, _mobiHeadNormal, _mobiHeadQuat);
            poseHeadAccessories(accessories, _mobiHeadPos, _mobiHeadForward, _mobiHeadNormal, headRadius,
                reducedMotion ? 0 : faceTime.current, !!inTransit, wormCharacterId);
            if (hatGroupRef.current) {
                hatGroupRef.current.position.copy(_mobiHeadPos).addScaledVector(_mobiHeadNormal, headRadius * 1.1);
                hatGroupRef.current.quaternion.copy(_mobiHeadQuat);
                poseHandmadeHat(hatGroupRef.current,wormHatId,_mobiHeadForward,_mobiHeadNormal,reducedMotion ? 0 : faceTime.current,!!inTransit);
                hatGroupRef.current.scale.multiplyScalar(worm.tunnelHeadScale ?? 1);
            }
            return;
        }

        // Eyes, pupils, smile, lenses and the hat seat all come from the shared
        // face layout so the previews draw the same worm.
        _faceParts.eyes[0] = leftEyeRef.current;
        _faceParts.eyes[1] = rightEyeRef.current;
        _faceParts.pupils[0] = leftPupilRef.current;
        _faceParts.pupils[1] = rightPupilRef.current;
        _faceParts.mouth = mouthRef.current;
        _faceParts.glasses[0] = showBookGlasses ? glassLeftRef.current : null;
        _faceParts.glasses[1] = showBookGlasses ? glassRightRef.current : null;
        _faceParts.hat = hatGroupRef.current;
        // The Book Worm's head is a round orb like everyone else's now, so it
        // takes the shared sphere layout too — it only needs the small lift that
        // keeps its head level with its floating book body.
        if (isBook) _faceHeadPos.addScaledVector(normal, BOOK_HEAD_LIFT * (1 - rideWeight));
        layoutWormFace(_faceHeadPos, _faceForward, normal, headRadiusFor(wormCharacterId) * (worm.pickupHeadScale ?? 1) * (worm.tunnelHeadScale ?? 1), _faceParts);

        poseHeadAccessories(accessories, _faceHeadPos, _faceForward, normal,
            headRadiusFor(wormCharacterId) * (worm.pickupHeadScale ?? 1) * (worm.tunnelHeadScale ?? 1), reducedMotion ? 0 : faceTime.current, !!inTransit, wormCharacterId);
        animateWormFace(_faceParts, wormCharacterId, faceTime.current, {
            pulse: facePulse.current, transit: !!inTransit, reducedMotion,
            ko: state.wormAlive ? 0 : Math.min(1, koTime.current / 0.25), koTime: koTime.current,
        });

        poseCharacterAccents(accents.group, _faceHeadPos, _faceForward, normal, headRadiusFor(wormCharacterId) * (worm.pickupHeadScale ?? 1) * (worm.tunnelHeadScale ?? 1));
        accents.update(reducedMotion ? 0 : faceTime.current);

        if (hatGroupRef.current) {
            _hatAlignQuat.setFromUnitVectors(_hatYUp, normal);
            hatGroupRef.current.quaternion.copy(_hatAlignQuat);
            poseHandmadeHat(hatGroupRef.current,wormHatId,_faceForward,normal,reducedMotion ? 0 : faceTime.current,!!inTransit);
            hatGroupRef.current.scale.multiplyScalar(worm.tunnelHeadScale ?? 1);
        }

    });

    if (mobi) return (
        <>
            <primitive object={accessories.root} dispose={null} />
            <primitive object={mobi.group} dispose={null} />
            {wormHatId !== 'none' && <group ref={hatGroupRef}>
                <WormHat3D type={wormHatId} scale={MOBI_RADIUS * FACE_LAYOUT.hatScale} />
            </group>}
        </>
    );

    return (
        <>
            <primitive object={accessories.root} dispose={null} />
            <primitive object={accents.group} dispose={null} />
            <mesh ref={leftEyeRef}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshPhysicalMaterial color="#f1f3e9" roughness={0.22} clearcoat={1} />
            </mesh>
            <mesh ref={rightEyeRef}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshPhysicalMaterial color="#f1f3e9" roughness={0.22} clearcoat={1} />
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
            {/* The shared face finish supplies the sculpted mouth geometry. */}
            <mesh ref={mouthRef}>
                <bufferGeometry />
                <meshBasicMaterial color="#12131a" />
            </mesh>
            {wormHatId !== 'none' && (
                <group ref={hatGroupRef}>
                    <WormHat3D type={wormHatId} scale={headRadiusFor(wormCharacterId) * FACE_LAYOUT.hatScale} />
                </group>
            )}
            {/* Book worm glasses — two torus rings, only rendered for book character */}
            {showBookGlasses && (
                <>
                    <mesh ref={glassLeftRef}>
                        <torusGeometry args={[1, FACE_LAYOUT.glassTube / FACE_LAYOUT.glassRadius, 8, 18]} />
                        <meshStandardMaterial color="#b98739" metalness={0.65} roughness={0.3} />
                    </mesh>
                    <mesh ref={glassRightRef}>
                        <torusGeometry args={[1, FACE_LAYOUT.glassTube / FACE_LAYOUT.glassRadius, 8, 18]} />
                        <meshStandardMaterial color="#b98739" metalness={0.65} roughness={0.3} />
                    </mesh>
                </>
            )}
        </>
    );
}
