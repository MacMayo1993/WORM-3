import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { getTunnelWorldPosInto } from './wormLogic.js';
import { tunnelState } from './tunnelProgressBridge.js';
import {
    makeTunnelCamPose,
    tunnelCamPoseInto,
    diveEase,
    portalDist,
    portalUp,
    ENTER_END_T,
} from './tunnelCameraRails.js';
import {
    CAM_HEIGHT_BASE,
    CAM_BACK_BASE,
    LOOK_AHEAD,
    CAM_CENTER_BIAS,
    CAM_LERP,
    WORM_LIFT,
    ZOOM_BURST,
    MAX_EXTRA_ZOOM,
    FACE_NORMALS,
    DIR_FORWARD,
    BASE_TAIL_LENGTH,
    ORB_SEGMENT_GROWTH,
} from './healerWorm/constants.js';

// Pre-allocated scratch vectors for WormChaseCamera — avoids per-frame allocations
const _camForward = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camWormWorld = new THREE.Vector3();
const _camNormal = new THREE.Vector3();
const _camTargetCam = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camTunnelTangent = new THREE.Vector3();
// Face-transition blend scratch — slerp normal and lerp forward over ~250ms
const _rawNormal = new THREE.Vector3();
const _rawForward = new THREE.Vector3();
const FACE_TRANS_DURATION = 0.25;
// Tunnel-mouth scratch — the two centerline endpoints the exterior shots frame.
const _ribVStart = new THREE.Vector3();
const _ribVEnd   = new THREE.Vector3();
// Exit-beat scratch — the external framing the inside camera swings out to as the
// worm reaches the exit tile.
const _exitCamOut  = new THREE.Vector3();
const _exitLookOut = new THREE.Vector3();
const _exitSide    = new THREE.Vector3();
const _exitUpOut   = new THREE.Vector3();
const _WORLD_UP    = new THREE.Vector3(0, 1, 0);
// Dive scratch — the two framings the 'entering' phase blends between as the
// camera falls out of the exterior shot and through the entry hole.
const _diveOutCam  = new THREE.Vector3();
const _diveOutLook = new THREE.Vector3();
const _diveInCam   = new THREE.Vector3();
const _diveInLook  = new THREE.Vector3();
const _diveUpOut   = new THREE.Vector3();
// The on-rails pose, shared by the dive and the inside-ribbon branch.
const _rails = makeTunnelCamPose();


export default function WormChaseCamera({ worm, size }) {
    const { camera, size: viewportSize } = useThree();
    const camPosRef = useRef(new THREE.Vector3(0, 6, 10));
    const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
    const camUpRef = useRef(new THREE.Vector3(0, 1, 0));  // smoothed up — prevents instant snap
    const prevPhaseRef = useRef('crawling');              // detect phase transitions for snap logic
    const prevGamePhaseRef = useRef('scrambling');         // detect entry into the opening scramble
    const zoomExtraRef = useRef(0);   // burst zoom accumulated
    const prevDirKeyRef = useRef(null);                   // detect face boundary crossings
    const faceTransT = useRef(0);                         // countdown timer for face-transition blend
    const oldNormalRef = useRef(new THREE.Vector3());     // normal at moment of face change
    const oldForwardRef = useRef(new THREE.Vector3());    // forward at moment of face change
    const lastNormalRef = useRef(new THREE.Vector3(0, 0, 1));   // blended normal from previous frame
    const lastForwardRef = useRef(new THREE.Vector3(0, 0, -1)); // blended forward from previous frame
    const prevTailLen = useRef(BASE_TAIL_LENGTH);   // detect new parity pickups
    const postTunnelEaseRef = useRef(0);  // seconds remaining of gentle re-framing after exiting a tunnel

    // This camera is the app's shared one, and the chase view leaves it wide
    // (FOV 70–82, wider still inside a tunnel) and rolled to whichever cube face
    // the run ended on. Hand it back the way we found it so the next screen —
    // menu, mode select, any other mode — frames from a clean camera even if it
    // never re-runs its own setup.
    useEffect(() => {
        const restoreFov = camera.fov;
        const restoreUp = camera.up.clone();
        return () => {
            camera.fov = restoreFov;
            camera.up.copy(restoreUp);
            camera.updateProjectionMatrix();
        };
    }, [camera]);

    useFrame((_, delta) => {
        const gamePhase = useGameStore.getState().wormGamePhase ?? 'active';
        const phase = worm.phase.current;
        const tailLen = worm.tailLength.current;
        const viewportAspect = viewportSize.width / Math.max(1, viewportSize.height);

        // Only use the overview during the INITIAL scramble. wormGamePhase is set to
        // 'scrambling' exactly once, at game start (mid-game auto-rotation hazards only
        // touch gameModePhaseRef, never wormGamePhase), so this alone identifies the
        // opening scramble — do NOT also gate on !worm.prevWorldPos.current: that ref is
        // reset to null by a separate React effect (useWormCrawler's run-reset effect)
        // that fires strictly AFTER the synchronous Zustand subscriber which sets
        // wormGamePhase here, so any useFrame tick landing in that gap would see
        // gamePhase === 'scrambling' but a still-stale, non-null prevWorldPos left over
        // from the previous run — falling through to the normal chase-cam branch with
        // leftover position/up-vector data (the intermittent "starts inside the cube /
        // upside down" glitch).
        if (gamePhase === 'scrambling') {
            const dist = 5 + size * 4.0;
            _camTargetCam.set(0.6, 1.1, 1).normalize().multiplyScalar(dist);
            _camTargetLook.set(0, 0, 0);
            // Snap straight to the overview framing the instant a new run's scramble
            // begins, instead of lerping in from wherever the camera was left at the end
            // of the previous run — that leftover state can be deep inside the cube (or
            // up-side down) and lerping from it produced a brief but visible swoop through
            // the cube that differed run to run. Snapping makes the opening shot identical
            // on every iteration.
            if (prevGamePhaseRef.current !== 'scrambling') {
                camPosRef.current.copy(_camTargetCam);
                lookAtRef.current.copy(_camTargetLook);
                prevDirKeyRef.current = null;
                faceTransT.current = 0;
            } else {
                camPosRef.current.lerp(_camTargetCam, Math.min(1, delta * 2.5));
                lookAtRef.current.lerp(_camTargetLook, Math.min(1, delta * 2.5));
            }
            camera.position.copy(camPosRef.current);
            camera.up.set(0, 1, 0);
            camUpRef.current.set(0, 1, 0);
            camera.lookAt(lookAtRef.current);
            prevGamePhaseRef.current = gamePhase;
            return;
        }
        prevGamePhaseRef.current = gamePhase;

        // Use a continuous portrait factor so camera framing doesn't jump at aspect=1.
        const portraitFactor = THREE.MathUtils.clamp((1 - viewportAspect) / 0.45, 0, 1);
        const baseFov = THREE.MathUtils.lerp(70, 82, portraitFactor);
        // Continuous tunnel FOV ramp: stays wide through 'entering', 'tunnel', and the whole of
        // 'exiting' (the inside ribbon camera rides along for the full exit-arm traversal), then
        // eases back down once 'windout' takes over with the external view.
        const _tp = worm.tunnelProgress.current;
        // During 'entering' the widening is squared rather than linear: the dive
        // itself is cubic, so a linear FOV ramp finishes long before the camera
        // moves and the two read as unrelated. Squared leads the rush by just
        // enough to play as anticipation of it.
        const _enterP = THREE.MathUtils.clamp(_tp, 0, 1);
        const tunnelMix = phase === 'tunnel' ? 1
            : phase === 'entering' ? _enterP * _enterP
            : phase === 'exiting'  ? 1
            : 0;
        const targetFov = THREE.MathUtils.lerp(baseFov, baseFov + 16, tunnelMix); // widen for the portal/tunnel view
        const fovAlpha = Math.min(1, delta * 6);
        const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, fovAlpha);
        if (Math.abs(nextFov - camera.fov) > 0.01) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
        }

        // Detect new pickup → brief burst zoom that decays quickly
        if (tailLen > prevTailLen.current) {
            prevTailLen.current = tailLen;
            zoomExtraRef.current = Math.min(zoomExtraRef.current + ZOOM_BURST, MAX_EXTRA_ZOOM);
        }
        // Decay burst zoom over time
        if (zoomExtraRef.current > 0) {
            zoomExtraRef.current = Math.max(0, zoomExtraRef.current - delta * 3.0);
        }

        // Permanent zoom scales with orbs collected so the longer worm always fits in frame.
        // Each orb adds 0.18 units of pull-back; cap is size-relative.
        const MAX_PERM_ZOOM = size * 2.6;
        const orbCount = Math.max(0, Math.floor((tailLen - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
        const permZoom = Math.min(orbCount * 0.18, MAX_PERM_ZOOM);
        const aspectZoomBoost = THREE.MathUtils.lerp(0, 0.4, portraitFactor);
        const extraZoom = permZoom + Math.min(zoomExtraRef.current, MAX_EXTRA_ZOOM);
        const camHeight = CAM_HEIGHT_BASE + extraZoom + aspectZoomBoost;
        const camBack = CAM_BACK_BASE + extraZoom * 0.8 + aspectZoomBoost * 0.9;

        if (phase === 'crawling' || !worm.activeTunnel.current) {
            // Smooth interpolated worm world position (copy into scratch — no .clone())
            _camWormWorld.copy(worm.headInterpPos.current);

            const { dirKey } = worm.pos.current;

            // Compute the raw (unblended) normal and forward for this frame.
            _rawNormal.copy(worm.currentNormal.current);

            if (worm.prevWorldPos.current && worm.curWorldPos.current) {
                _rawForward.subVectors(worm.curWorldPos.current, worm.prevWorldPos.current);
                if (_rawForward.lengthSq() < 0.0001) {
                    const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 0, -1];
                    _rawForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);
                } else {
                    _rawForward.normalize();
                }
            } else {
                const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 0, -1];
                _rawForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);
            }

            // Detect face boundary crossing — start a smooth blend from the
            // camera's previous normal/forward toward the new face's values.
            if (prevDirKeyRef.current !== null && prevDirKeyRef.current !== dirKey) {
                oldNormalRef.current.copy(lastNormalRef.current);
                oldForwardRef.current.copy(lastForwardRef.current);
                faceTransT.current = FACE_TRANS_DURATION;
            }
            prevDirKeyRef.current = dirKey;

            // Blend normal and forward during a face transition so the camera
            // target doesn't jump when the surface normal changes direction.
            if (faceTransT.current > 0) {
                faceTransT.current = Math.max(0, faceTransT.current - delta);
                const t = 1 - faceTransT.current / FACE_TRANS_DURATION;
                const eased = t * t * (3 - 2 * t); // smoothstep
                _camNormal.copy(oldNormalRef.current).lerp(_rawNormal, eased).normalize();
                _camForward.copy(oldForwardRef.current).lerp(_rawForward, eased).normalize();
            } else {
                _camNormal.copy(_rawNormal);
                _camForward.copy(_rawForward);
            }

            lastNormalRef.current.copy(_camNormal);
            lastForwardRef.current.copy(_camForward);

            // Camera: behind worm (opposite of forward) + above face (along normal).
            _camTargetCam.copy(_camWormWorld)
                .addScaledVector(_camNormal, camHeight)
                .addScaledVector(_camForward, -camBack);
            _camTargetLook.copy(_camWormWorld).addScaledVector(_camForward, LOOK_AHEAD);
            // Pull the look target partway toward the cube centre (origin) so the whole cube
            // stays framed rather than drifting off-screen as the camera tracks the worm.
            _camTargetLook.multiplyScalar(1 - CAM_CENTER_BIAS);

            // Camera UP: always world-Y so the horizon stays level.
            // Bottom face is the only case where Y-up would flip the view.
            _camUp.set(0, _camNormal.y < -0.8 ? -1 : 1, 0);

            // Just resumed crawling after a tunnel: ease the camera back to the chase framing
            // over ~0.7s instead of yanking it, so the worm doesn't pop straight to gameplay.
            if (prevPhaseRef.current !== 'crawling') {
                postTunnelEaseRef.current = 0.7;
            }
            let crawlK = CAM_LERP;
            if (postTunnelEaseRef.current > 0) {
                postTunnelEaseRef.current = Math.max(0, postTunnelEaseRef.current - delta);
                // ramp the smoothing rate from gentle (3) up to normal (CAM_LERP) as the ease expires
                crawlK = THREE.MathUtils.lerp(3.0, CAM_LERP, 1 - postTunnelEaseRef.current / 0.7);
            }

            const alpha = Math.min(1, crawlK * delta);
            camPosRef.current.lerp(_camTargetCam, alpha);
            lookAtRef.current.lerp(_camTargetLook, alpha);
            camera.position.copy(camPosRef.current);
            camUpRef.current.lerp(_camUp, Math.min(1, crawlK * delta)).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else if (phase === 'windup' && worm.activeTunnel.current) {
            // Entry-side external view: the windup spiral is watched from outside so the
            // player sees the worm swirl down onto the entry hole against the cube face.
            const tunnel = worm.activeTunnel.current;

            tunnelState.active = true;
            tunnelState.t = 0;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;

            const entN = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;
            // Ask the centerline itself for its start rather than re-deriving it from the
            // sticker position. The old hand-rolled correction (−2·SURFACE_OFFSET) existed
            // only to reach the anchor's former spot on the far side of the cubie; now that
            // tunnels anchor on their tiles there is nothing to correct, and reusing the one
            // function that defines the path keeps camera and geometry from drifting apart.
            getTunnelWorldPosInto(_ribVStart, tunnel, 0, size);

            _camTargetCam.copy(_ribVStart).addScaledVector(entN, portalDist(size));
            _camTargetLook.copy(_ribVStart);
            _camUp.set(0, entN.y < -0.85 ? -1 : 1, 0);

            const a = Math.min(1, 3.0 * delta);
            camPosRef.current.lerp(_camTargetCam, a);
            lookAtRef.current.lerp(_camTargetLook, a);
            camera.position.copy(camPosRef.current);
            camUpRef.current.lerp(_camUp, a).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else if (phase === 'entering' && worm.activeTunnel.current) {
            // ── The dive ─────────────────────────────────────────────────────────
            // 'entering' used to be a second exterior shot: the camera hung where the
            // windup left it and watched the worm disappear into the hole, then the
            // next phase cut to a view already inside. The player never travelled
            // through the opening, so the wormhole read as a place the worm went
            // rather than a place they went — the one thing this mechanic is for.
            //
            // Now the camera falls from that exterior framing onto the tunnel's own
            // rails and through the mouth, on the cubic acceleration curve the mode
            // selector's cube dive uses: almost still at first, then a rush. Because
            // the on-rails end of the blend is computed with the same math as the
            // inside-ribbon branch below, at tp = 1 the two are the same pose and the
            // phase change is invisible — no cut, one continuous move from outside the
            // cube to inside the shaft.
            const tp = worm.tunnelProgress.current;
            const tunnel = worm.activeTunnel.current;

            tunnelState.active = true;
            const tHead = tp * ENTER_END_T;
            tunnelState.t = tHead;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;

            const entN = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;
            getTunnelWorldPosInto(_ribVStart, tunnel, 0, size);

            // Where we are diving FROM — the windup framing, held so the fall starts
            // from exactly where the previous phase parked the camera.
            _diveOutCam.copy(_ribVStart).addScaledVector(entN, portalDist(size));
            _diveOutLook.copy(_ribVStart);

            // Where we are diving TO — the on-rails pose. Same call the ride branch
            // below makes, so at tp = 1 the two poses are identical by construction.
            tunnelCamPoseInto(_rails, tunnel, tHead, size);
            _diveInCam.copy(_rails.cam);
            _diveInLook.copy(_rails.look);

            // Cubic, as in MainMenu's dive. Keeping the acceleration this
            // back-loaded also means the camera only breaks the cube's surface over
            // the last handful of frames of the phase — the frames in which the solid
            // body is swapped for the interior view — so it never sits inside a cube
            // that is still being drawn as solid.
            const dive = diveEase(tp);
            _camTargetCam.copy(_diveOutCam).lerp(_diveInCam, dive);
            _camTargetLook.copy(_diveOutLook).lerp(_diveInLook, dive);

            // Start level with the world, land in the Möbius roll.
            _diveUpOut.set(0, entN.y < -0.85 ? -1 : 1, 0);
            _camUp.copy(_rails.up).lerp(_diveUpOut, 1 - dive);
            if (_camUp.lengthSq() < 1e-6) _camUp.copy(_diveUpOut);
            _camUp.normalize();

            // Exponential smoothing is a lag, and a lag at the aperture means the
            // camera never actually arrives — it would hand over to the next branch
            // still outside the hole, reintroducing the cut this whole branch exists
            // to remove. The second pull converges on the target as the dive closes.
            const a = Math.min(1, 3.0 * delta);
            const snap = Math.max(a, dive * dive);
            camPosRef.current.lerp(_camTargetCam, a).lerp(_camTargetCam, dive * dive);
            lookAtRef.current.lerp(_camTargetLook, a).lerp(_camTargetLook, dive * dive);
            camera.position.copy(camPosRef.current);
            camUpRef.current.lerp(_camUp, snap).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else if ((phase === 'tunnel' || phase === 'exiting') && worm.activeTunnel.current) {
            // Inside ribbon camera: follows the worm along the full ribbon ride, including the
            // entire exit arm, so the player sees the whole Möbius strip exit climb up close.
            const tp = worm.tunnelProgress.current;
            const tunnel = worm.activeTunnel.current;

            tunnelState.active = true;
            const tHead = phase === 'tunnel' ? 0.33 + tp * 0.34 : 0.67 + tp * 0.33;
            tunnelState.t = tHead;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;

            // The same pose the dive lands on — Möbius roll, trail distance and all —
            // so the entering→tunnel boundary is a no-op rather than a cut.
            tunnelCamPoseInto(_rails, tunnel, tHead, size);
            _camTunnelTangent.copy(_rails.tangent);
            _camUp.copy(_rails.up);
            _camTargetCam.copy(_rails.cam);
            _camTargetLook.copy(_rails.look);

            // ── Exit beat ────────────────────────────────────────────────────────
            // The moment the worm punches out through the flipped tile used to fall in
            // the seam between this branch and 'windout', with nothing framing it. Over
            // the last stretch of the exit arm the camera swings out past the tile and
            // turns back to watch the worm burst through it, righting itself as it goes.
            const exitBlend = phase === 'exiting'
                ? THREE.MathUtils.smoothstep(tp, 0.60, 0.95)
                : 0;
            if (exitBlend > 0.001) {
                const extN = FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY;
                const xw = getStickerWorldPos(tunnel.exit.x, tunnel.exit.y, tunnel.exit.z, tunnel.exit.dirKey, size, 0);
                _exitLookOut.set(xw[0], xw[1], xw[2]);

                // Offset to one side rather than dead-on: head-on, the worm emerges
                // straight down the lens and reads as nothing.
                _exitSide.crossVectors(extN, _WORLD_UP);
                if (_exitSide.lengthSq() < 1e-6) _exitSide.set(1, 0, 0);
                _exitSide.normalize();

                _exitCamOut.copy(_exitLookOut)
                    .addScaledVector(extN, 1.7 + size * 0.34)
                    .addScaledVector(_exitSide, 1.2 + size * 0.22)
                    .addScaledVector(_WORLD_UP, 0.7);

                _camTargetCam.lerp(_exitCamOut, exitBlend);
                _camTargetLook.lerp(_exitLookOut, exitBlend);

                // Unwind the roll as we emerge, so the player lands upright.
                _exitUpOut.copy(_WORLD_UP);
                if (extN.y < -0.85) _exitUpOut.set(0, -1, 0);
                _camUp.lerp(_exitUpOut, exitBlend);
                if (_camUp.lengthSq() < 1e-6) _camUp.copy(_exitUpOut);
                _camUp.normalize();
            }

            const a = Math.min(1, 2.5 * delta);
            camPosRef.current.lerp(_camTargetCam, a);
            lookAtRef.current.lerp(_camTargetLook, a);
            camera.position.copy(camPosRef.current);
            camUpRef.current.lerp(_camUp, a).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else if (phase === 'windout' && worm.activeTunnel.current) {
            // Exit-side external view: the windout spiral flourish above the exit tile,
            // watched from outside the cube once the worm has fully ridden the exit ribbon.
            const tunnel = worm.activeTunnel.current;

            tunnelState.active = true;
            tunnelState.t = 1.0;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;

            const extN = FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY;
            // Same reasoning as the entry anchor above — take the endpoint from the
            // centerline rather than re-deriving it.
            getTunnelWorldPosInto(_ribVEnd, tunnel, 1, size);

            _camTargetCam.copy(_ribVEnd).addScaledVector(extN, portalDist(size));
            _camTargetCam.y += portalUp(size);
            _camTargetLook.copy(_ribVEnd);
            _camUp.set(0, extN.y < -0.85 ? -1 : 1, 0);

            const a = Math.min(1, 3.0 * delta);
            camPosRef.current.lerp(_camTargetCam, a);
            lookAtRef.current.lerp(_camTargetLook, a);
            camera.position.copy(camPosRef.current);
            camUpRef.current.lerp(_camUp, a).normalize();
            camera.up.copy(camUpRef.current);
            camera.lookAt(lookAtRef.current);
        } else {
            tunnelState.active = false;
            tunnelState.t = 0;
            tunnelState.activeTunnelId = null;
        }

        prevPhaseRef.current = phase;
    });

    return null;
}
