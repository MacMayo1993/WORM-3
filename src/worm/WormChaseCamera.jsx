import { boundedWormZoom, wormSurfaceFov } from './healerWorm/zoomLimit.js';
import { sliceOverviewInto } from './healerWorm/sliceCamera.js';
import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { bodyPathHeadInto } from './healerWorm/sliceBodyPath.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { rocketOrbitInto, rocketOrbitT, rocketFrameInto } from './healerWorm/rocketOrbit.js';
import { tunnelState } from './tunnelProgressBridge.js';
import {
    makeTunnelCamPose,
    tunnelCamPoseInto,
    diveProgress,
    portalDist,
    ENTER_END_T,
    diveEase,
    blendTunnelPosesInto,
    tunnelExitPoseInto,
    tunnelEntryPoseInto,
} from './tunnelCameraRails.js';
import {
    CAM_HEIGHT_BASE,
    CAM_BACK_BASE,
    LOOK_AHEAD,
    CAM_CENTER_BIAS,
    CAM_LERP,
    MAX_TICK_DELTA,
    FACE_NORMALS,
    DIR_FORWARD,
    BASE_TAIL_LENGTH,
    ORB_SEGMENT_GROWTH,
    HEAL_PAUSE_DURATION,
    CUT_FOCUS_DURATION,
    TUNNEL_HANDOFF_SECONDS,
} from './healerWorm/constants.js';
import { makeElementalRevealOrbit, sampleElementalRevealOrbit } from './elementalRevealOrbit.js';

// Pre-allocated scratch vectors for WormChaseCamera — avoids per-frame allocations
const _camForward = new THREE.Vector3();
const _camUp = new THREE.Vector3();
// Orientation scratch — the chase view's roll is a rotation, not an up vector
// handed to lookAt (see aimCamera below).
const _aimBasis = new THREE.Matrix4();
const _aimQuat = new THREE.Quaternion();
const _aimDir = new THREE.Vector3();
const _aimUp = new THREE.Vector3();
const _camWormWorld = new THREE.Vector3();
const _mobileHeadWorld = new THREE.Vector3();
const _camNormal = new THREE.Vector3();
const _camTargetCam = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
// Face-transition blend scratch — slerp normal and lerp forward over ~250ms
const _rawNormal = new THREE.Vector3();
const _rawForward = new THREE.Vector3();
/**
 * Point the camera at `look` from `eye` with `upHint` overhead, as a rotation the
 * camera is slerped toward rather than a call to lookAt.
 *
 * This is the fix for the chase view rolling by itself around a face. lookAt
 * derives roll from `right = normalize(cross(viewDir, up))`, so it has two failure
 * modes, and crawling a cube walks into both:
 *
 *   • As viewDir approaches the up axis that cross product collapses, and its
 *     direction is then decided by whatever rounding noise is left. Rounding an
 *     edge onto the top or bottom face swings the view a long way while nothing
 *     else appears to move.
 *   • Under the cube the up vector has to flip sign, and smoothing +Y toward -Y
 *     passes through the zero vector, where roll is undefined outright.
 *
 * A quaternion has neither problem: the target orientation is built once, the
 * camera slerps toward it along the shortest arc, and a 180° change is a
 * controlled roll rather than a spin through a singularity. The up hint is also
 * orthogonalised against the view direction first, and falls back to the camera's
 * current up if the two are collinear, so the basis is always well formed.
 */
export function aimCamera(camera, eye, look, upHint, alpha) {
  _aimDir.subVectors(look, eye);
  if (_aimDir.lengthSq() < 1e-8) return;
  _aimDir.normalize();

  _aimUp.copy(upHint).addScaledVector(_aimDir, -upHint.dot(_aimDir));
  if (_aimUp.lengthSq() < 1e-6) {
    _aimUp.copy(camera.up).addScaledVector(_aimDir, -camera.up.dot(_aimDir));
    if (_aimUp.lengthSq() < 1e-6) _aimUp.set(0, 1, 0).addScaledVector(_aimDir, -_aimDir.y);
    if (_aimUp.lengthSq() < 1e-6) _aimUp.set(1, 0, 0);
  }
  _aimUp.normalize();

  _aimBasis.lookAt(eye, look, _aimUp);
  _aimQuat.setFromRotationMatrix(_aimBasis);
  camera.quaternion.slerp(_aimQuat, alpha);
  // Kept in step so the branches that still use lookAt (tunnel rides, the death
  // freeze) start from the orientation the chase actually ended on.
  camera.up.copy(_aimUp);
}

const FACE_TRANS_DURATION = 0.25;
// Victory flourish: radians/sec the camera orbits the solved cube (~10s per revolution).
const SOLVED_ORBIT_SPEED = 0.6;
const _entryTileCenter = new THREE.Vector3();
const _WORLD_UP = new THREE.Vector3(0, 1, 0);
const _rails = makeTunnelCamPose();
// Heal-focus scratch — the push-in framing while a ring heal freezes the worm.
const _healFocusLook = new THREE.Vector3();
const _healFocusCam = new THREE.Vector3();
const _healFocusN = new THREE.Vector3();
const _healSide = new THREE.Vector3();
const _healForward = new THREE.Vector3();
// Keep the ring-heal camera deliberately slower than the solved-board flourish.
// This is a tracking move, not a victory spin: it should reveal the surrounded
// tile without making the player lose the worm's heading.
const HEAL_ORBIT_SPEED = 0.34;

// ── Countdown reveal ─────────────────────────────────────────────────────────
// Between the scramble overview and live play the camera used to lerp straight
// from the fixed overview corner to the chase pose — a chord that crosses the
// cube (and the worm's own body) whenever the worm spawns on a far face, so the
// countdown played over a screen-filling clip of worm segments. Instead: on the
// spawn beat, cut to a pulled-back version of the chase pose — built in the
// worm's own frame (up its face normal, behind its heading), so it is outside
// the cube by construction — and dolly in to the true chase framing while the
// 3-2-1 plays. The run then starts with the camera already settled.
const REVEAL_DURATION = 3.0; // seconds of dolly-in; countdown runs ~4.25s + spawn
const REVEAL_LIFT = 2.2;     // extra height at the start, as a multiple of camHeight
const REVEAL_BACK = 2.6;     // extra setback at the start, as a multiple of camBack

// Slice-death freeze frame ("WORM'D") scratch + tuning. On the hit we ease once
// into an overview of the cut side, keeping the severed head and layer visible,
// then hold that pose dead still. Computed a single time on entry; the settled
// hold does no per-frame target math or projection-matrix work.
const _freezeStartCam = new THREE.Vector3();
const _freezeStartLook = new THREE.Vector3();
const _freezeTargetCam = new THREE.Vector3();
const _freezeTargetLook = new THREE.Vector3();
const _freezeTargetUp = new THREE.Vector3();
const SLICE_FREEZE_SETTLE = 0.42;

// Body-cut ("WORM'D" survives) beat scratch. The worm pauses; the chase
// framing swings out to an exterior shot of the impact side of the cube so the
// player sees the hit, then eases back to the chase as the beat expires.
const _cutFocusPos = new THREE.Vector3();
const _cutCam = new THREE.Vector3();
const _cutLook = new THREE.Vector3();
const _cutUp = new THREE.Vector3();

const frameForward = new THREE.Vector3();
const frameDirection = new THREE.Vector3();
const frameCorrection = new THREE.Quaternion();

// Correct aim after position/roll smoothing, so neither lag moves the subject
// around the screen. Mobile anchors the visible head at (0, 0); desktop retains
// its whole-board composition above center. Rotating the existing frame keeps
// the smoothed horizon and never changes the lens or tunnel clearance.
export function frameSurfaceCamera(camera, portraitFactor, head = null) {
    if (head) frameDirection.subVectors(head, camera.position);
    else frameDirection.copy(camera.position).negate();
    if (frameDirection.lengthSq() < 1e-8) return;
    frameDirection.normalize();
    frameForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    frameCorrection.setFromUnitVectors(frameForward, frameDirection);
    camera.quaternion.premultiply(frameCorrection);
    // A fixed screen-space anchor survives every cube face and horizon roll.
    const screenY = head ? 0 : THREE.MathUtils.lerp(0.06, 0.12, portraitFactor);
    camera.rotateX(-Math.atan(screenY * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
}

export default function WormChaseCamera({ worm, size }) {
    const { camera, size: viewportSize } = useThree();
    const mobile = useIsMobile();
    const camPosRef = useRef(new THREE.Vector3(0, 6, 10));
    const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
    const camUpRef = useRef(new THREE.Vector3(0, 1, 0));  // smoothed up — prevents instant snap
    const prevPhaseRef = useRef('crawling');              // detect phase transitions for snap logic
    const prevGamePhaseRef = useRef('scrambling');         // detect entry into the opening scramble
    const prevDirKeyRef = useRef(null);                   // detect face boundary crossings
    const faceTransT = useRef(0);                         // countdown timer for face-transition blend
    const oldNormalRef = useRef(new THREE.Vector3());     // normal at moment of face change
    const oldForwardRef = useRef(new THREE.Vector3());    // forward at moment of face change
    const lastNormalRef = useRef(new THREE.Vector3(0, 0, 1));   // blended normal from previous frame
    const lastForwardRef = useRef(new THREE.Vector3(0, 0, -1)); // blended forward from previous frame
    const postTunnelEaseRef = useRef(0);  // seconds remaining of gentle re-framing after exiting a tunnel
    const solvedAngleRef = useRef(0);     // accumulated azimuth of the victory orbit
    const sliceFreezeActiveRef = useRef(false); // are we mid slice-death freeze frame?
    const sliceFreezeTRef = useRef(0);          // elapsed settle time of that freeze
    const phaseStartPose = useRef(makeTunnelCamPose());
    const transitionPose = useRef(makeTunnelCamPose());
    const elementalOrbitRef = useRef(null);
    const revealTRef = useRef(1);               // countdown reveal dolly progress (0 = fully pulled back)

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
        // Match the simulation clock after a hitch; never snap the lens on resume.
        delta = Math.min(Math.max(0, delta), MAX_TICK_DELTA);
        const gameState = useGameStore.getState();
        const gamePhase = gameState.wormGamePhase ?? 'active';
        // Read per frame rather than through a subscription: this callback already
        // reads the store, and a re-render of the camera on a settings change would
        // reset the smoothing refs mid-crawl.
        const horizonMode = gameState.wormCameraHorizon ?? 'face';
        const phase = worm.phase.current;
        const tailLen = worm.tailLength.current;
        const viewportAspect = viewportSize.width / Math.max(1, viewportSize.height);
        if (mobile) {
            // Match the body's rendered anchor, including jump lift and rocket
            // flight. Tunnel handoffs already contain their own surface lift.
            bodyPathHeadInto(_mobileHeadWorld, worm, phase !== 'crawling' && !!worm.activeTunnel.current);
            rocketOrbitInto(_mobileHeadWorld, size, rocketOrbitT(
                worm.rocketActive.current, worm.rocketT.current, worm.rocketFlight?.current
            ));
        }

        // A layer slice is staged as a comic-book freeze frame while ThunkEffect
        // plays WORM'D. Rather than merely holding wherever the smoothed chase lens
        // happened to lag to, we ease ONCE — over SLICE_FREEZE_SETTLE — into a
        // screen-fitted overview of the severed head and rotating layer,
        // so the location of the hit is visible. After that it holds perfectly
        // still (no per-frame target math, no projection-matrix churn) so the death
        // card sits on a rock-steady plate.
        if (!gameState.wormAlive && gameState.wormDeathDetails?.reason === 'slice-rotation') {
            if (!sliceFreezeActiveRef.current) {
                sliceFreezeActiveRef.current = true;
                sliceFreezeTRef.current = 0;
                _freezeStartCam.copy(camPosRef.current);
                _freezeStartLook.copy(lookAtRef.current);
                // The sim has stopped, so the head holds the impact point.
                _camWormWorld.copy(worm.headInterpPos.current);
                sliceOverviewInto(_freezeTargetCam, _freezeTargetLook, _freezeTargetUp,
                    _camWormWorld, size, camera.fov, viewportAspect);
            }
            if (sliceFreezeTRef.current < SLICE_FREEZE_SETTLE) {
                sliceFreezeTRef.current = Math.min(SLICE_FREEZE_SETTLE, sliceFreezeTRef.current + delta);
                const ft = sliceFreezeTRef.current / SLICE_FREEZE_SETTLE;
                const eased = ft * ft * (3 - 2 * ft); // smoothstep
                camPosRef.current.copy(_freezeStartCam).lerp(_freezeTargetCam, eased);
                lookAtRef.current.copy(_freezeStartLook).lerp(_freezeTargetLook, eased);
            }
            camera.position.copy(camPosRef.current);
            aimCamera(camera, camPosRef.current, lookAtRef.current, _freezeTargetUp,
                sliceFreezeTRef.current >= SLICE_FREEZE_SETTLE ? 1 : 1 - Math.exp(-12 * delta));
            camUpRef.current.copy(camera.up);
            prevGamePhaseRef.current = gamePhase;
            return;
        }
        // Left the freeze (retry/reset) — re-arm so the next slice death re-snaps.
        if (sliceFreezeActiveRef.current) sliceFreezeActiveRef.current = false;

        // Capture once, orbit at the existing radius/FOV, and return exactly to
        // the captured view before handing control back to normal chase smoothing.
        const focusRemaining = worm.elementalFocusT?.current ?? 0;
        if (phase !== 'crawling' || gamePhase === 'scrambling' || gameState.wormAlive === false) {
            elementalOrbitRef.current = null;
        } else if (focusRemaining > 0 || elementalOrbitRef.current) {
            if (!elementalOrbitRef.current) {
                elementalOrbitRef.current = makeElementalRevealOrbit(camera, lookAtRef.current);
                elementalOrbitRef.current.duration = focusRemaining;
            }
            const orbit = elementalOrbitRef.current;
            const progress = 1 - focusRemaining / orbit.duration;
            sampleElementalRevealOrbit(orbit, progress, camPosRef.current, lookAtRef.current, camUpRef.current);
            camera.position.copy(camPosRef.current);
            camera.fov = orbit.fov;
            aimCamera(camera, camPosRef.current, lookAtRef.current, camUpRef.current, 1);
            if (focusRemaining <= 0) {
                camera.position.copy(orbit.position);
                camera.quaternion.copy(orbit.quaternion);
                camera.up.copy(orbit.up);
                camPosRef.current.copy(orbit.position);
                camUpRef.current.copy(orbit.up);
                lookAtRef.current.copy(orbit.look);
                elementalOrbitRef.current = null;
            }
            prevPhaseRef.current = phase;
            prevGamePhaseRef.current = gamePhase;
            return;
        }

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

        // Board solved — the big finish. Pull out to an overview and orbit the whole cube
        // (the one place a full 360 belongs: the run is over, so there's no heading to lose
        // and nothing to disorient). Runs behind the winner overlay as a live backdrop.
        if (gamePhase === 'solved') {
            const dist = 5 + size * 3.6;
            const height = 2 + size * 1.2;
            if (prevGamePhaseRef.current !== 'solved') {
                // Seed the orbit at the camera's current azimuth so it swings on smoothly
                // from wherever the run ended instead of snapping to a fixed start angle.
                solvedAngleRef.current = Math.atan2(camPosRef.current.z, camPosRef.current.x);
            }
            solvedAngleRef.current += delta * SOLVED_ORBIT_SPEED;
            _camTargetCam.set(
                Math.cos(solvedAngleRef.current) * dist,
                height,
                Math.sin(solvedAngleRef.current) * dist
            );
            _camTargetLook.set(0, 0, 0);
            const a = Math.min(1, delta * 2.0);
            camPosRef.current.lerp(_camTargetCam, a);
            lookAtRef.current.lerp(_camTargetLook, a);
            camera.position.copy(camPosRef.current);
            camera.up.set(0, 1, 0);
            camUpRef.current.set(0, 1, 0);
            camera.lookAt(lookAtRef.current);
            prevGamePhaseRef.current = gamePhase;
            return;
        }
        // Countdown-reveal entry test, taken BEFORE prevGamePhaseRef is refreshed.
        const inReveal = gamePhase === 'spawning' || gamePhase === 'countdown';
        const enteredReveal = inReveal &&
            prevGamePhaseRef.current !== 'spawning' && prevGamePhaseRef.current !== 'countdown';
        prevGamePhaseRef.current = gamePhase;

        // Use a continuous portrait factor so camera framing doesn't jump at aspect=1.
        const portraitFactor = THREE.MathUtils.clamp((1 - viewportAspect) / 0.45, 0, 1);
        const baseFov = THREE.MathUtils.lerp(70, 82, portraitFactor);
        // Continuous tunnel FOV ramp: stays wide through 'entering', 'tunnel', and the whole of
        // 'exiting' (the inside ribbon camera rides along for the full exit-arm traversal), then
        // eases back down once 'windout' takes over with the external view.
        const _tp = worm.tunnelProgress.current;
        // FOV follows the same easing as the camera's dive and exit reveal.
        const _enterP = THREE.MathUtils.clamp(_tp, 0, 1);
        const tunnelMix = phase === 'tunnel' ? 1
            : phase === 'entering' ? diveProgress(_enterP)
            : phase === 'exiting' ? 1 - diveEase((_enterP - 0.5) / 0.5)
            : 0;
        const rocketLift = rocketOrbitT(worm.rocketActive.current, worm.rocketT.current, worm.rocketFlight?.current);
        const targetFov = THREE.MathUtils.lerp(wormSurfaceFov(baseFov), baseFov + 16, tunnelMix) + rocketLift * 7;
        const fovAlpha = 1 - Math.exp(-6 * delta);
        const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, fovAlpha);
        if (Math.abs(nextFov - camera.fov) > 0.01) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
        }

        // Grow the framing gently with the tail. Pickup feedback lives on the
        // worm/orb: a repeated zoom burst made dense Mega pickups pump the view.
        const orbCount = Math.max(0, Math.floor((tailLen - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
        const aspectZoomBoost = THREE.MathUtils.lerp(0, 0.4, portraitFactor);
        const extraZoom = boundedWormZoom(size, CAM_BACK_BASE + aspectZoomBoost * 0.9,
            orbCount, 0);
        const camHeight = CAM_HEIGHT_BASE + extraZoom + aspectZoomBoost;
        const camBack = CAM_BACK_BASE + extraZoom * 0.8 + aspectZoomBoost * 0.9;

        // Portrait rake: the base chase runs nearly level (~10° below horizontal),
        // which on a tall phone viewport parks the horizon mid-frame and hands half
        // the pixels to empty sky/void — the same failure the elemental ride's
        // comment describes. As the viewport narrows, steepen the pitch: more lift
        // up the face normal, less setback, and a shorter aim, so the surface ahead
        // (orbs, tunnels, dead tiles) fills the frame instead. Lands ~34° below
        // horizontal at full portrait; desktop landscape is unchanged.
        const rakeLift = THREE.MathUtils.lerp(0, 1.5, portraitFactor);
        const rakeTuck = THREE.MathUtils.lerp(1, 0.75, portraitFactor);
        const rakeAhead = LOOK_AHEAD * THREE.MathUtils.lerp(1, 0.55, portraitFactor);

        // ── Countdown reveal ─────────────────────────────────────────────────
        // Spawn + 3-2-1: cut to a pulled-back chase pose built in the worm's own
        // frame (always outside the cube — the old overview→chase lerp cut a chord
        // straight through it, playing the countdown over a screenful of clipped
        // worm body), then dolly in so the run starts on the settled chase framing.
        if (inReveal && (phase === 'crawling' || !worm.activeTunnel.current)) {
            const { dirKey } = worm.pos.current;
            _camNormal.copy(FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ);
            const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current]
                ?? DIR_FORWARD[dirKey]?.up ?? [0, 1, 0];
            _camForward.set(fwdArr[0], fwdArr[1], fwdArr[2]).normalize();
            _camWormWorld.copy(worm.headInterpPos.current);

            if (enteredReveal) revealTRef.current = 0;
            revealTRef.current = Math.min(1, revealTRef.current + delta / REVEAL_DURATION);
            const rt = revealTRef.current;
            const pull = 1 - rt * rt * (3 - 2 * rt); // smoothstep-eased, 1 → 0

            _camTargetCam.copy(_camWormWorld)
                .addScaledVector(_camNormal, (camHeight + rakeLift) * (1 + REVEAL_LIFT * pull))
                .addScaledVector(_camForward, -(camBack * rakeTuck) * (1 + REVEAL_BACK * pull));
            _camTargetLook.copy(_camWormWorld).addScaledVector(_camForward, rakeAhead);
            _camTargetLook.multiplyScalar(1 - CAM_CENTER_BIAS);
            // Centre the spawning worm first; ease out to the chase aim as the pull expires.
            _camTargetLook.lerp(_camWormWorld, pull * 0.8);
            if (mobile) _camTargetLook.copy(_mobileHeadWorld);

            // Same horizon the chase will use, so the countdown reveal hands over to
            // live play without the view rolling on the first crawling frame.
            if (horizonMode === 'face') _camUp.copy(_camNormal);
            else _camUp.set(0, _camNormal.y < -0.8 ? -1 : 1, 0);

            const revealA = enteredReveal ? 1 : 1 - Math.exp(-CAM_LERP * delta);
            if (enteredReveal) {
                camPosRef.current.copy(_camTargetCam);
                lookAtRef.current.copy(_camTargetLook);
            } else {
                camPosRef.current.lerp(_camTargetCam, revealA);
                lookAtRef.current.lerp(_camTargetLook, revealA);
            }

            // Seed the crawl branch's face-blend state so 'active' takes over
            // without a face-transition jerk on the first live frame.
            prevDirKeyRef.current = dirKey;
            lastNormalRef.current.copy(_camNormal);
            lastForwardRef.current.copy(_camForward);
            faceTransT.current = 0;

            camera.position.copy(camPosRef.current);
            aimCamera(camera, camPosRef.current, lookAtRef.current, _camUp, revealA);
            if (mobile) {
                frameSurfaceCamera(camera, portraitFactor, _mobileHeadWorld);
                lookAtRef.current.copy(_mobileHeadWorld);
            }
            camUpRef.current.copy(camera.up);
            prevPhaseRef.current = phase;
            return;
        }

        if (prevPhaseRef.current !== phase) {
            phaseStartPose.current.cam.copy(camPosRef.current);
            phaseStartPose.current.look.set(0, 0, -1.6).applyQuaternion(camera.quaternion)
                .add(phaseStartPose.current.cam);
            phaseStartPose.current.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        }
        const applyTunnelPose = (pose, alpha = 1) => {
            camPosRef.current.copy(pose.cam);
            lookAtRef.current.copy(pose.look);
            camera.position.copy(pose.cam);
            aimCamera(camera, pose.cam, pose.look, pose.up, alpha);
            camUpRef.current.copy(camera.up);
        };

        if (phase === 'crawling' || !worm.activeTunnel.current) {
            tunnelState.active = false;
            tunnelState.t = 0;
            tunnelState.activeTunnelId = null;
            // Smooth interpolated worm world position (copy into scratch — no .clone())
            _camWormWorld.copy(worm.headInterpPos.current);
            // Track the same elevated shell as the body throughout the rocket arc.
            rocketOrbitInto(_camWormWorld, size, rocketOrbitT(
                worm.rocketActive.current, worm.rocketT.current, worm.rocketFlight?.current
            ));

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

            if (rocketLift > 0) {
                rocketFrameInto(_rawForward, _rawNormal, worm.headInterpPos.current, size, rocketLift);
            }

            if (prevPhaseRef.current !== 'crawling') {
                prevDirKeyRef.current = dirKey;
                faceTransT.current = 0;
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

            // Airborne turns follow the rounded flight path, rather than rolling
            // the camera on a delayed 90-degree surface-face transition.
            if (rocketLift > 0) {
                _camNormal.lerp(_rawNormal, rocketLift).normalize();
                _camForward.lerp(_rawForward, rocketLift).normalize();
            }
            lastNormalRef.current.copy(_camNormal);
            lastForwardRef.current.copy(_camForward);

            // Camera: behind worm (opposite of forward) + above face (along normal),
            // pitched down by the portrait rake on narrow viewports.
            _camTargetCam.copy(_camWormWorld)
                .addScaledVector(_camNormal, (camHeight + rakeLift) * (1 - 0.24 * rocketLift))
                .addScaledVector(_camForward, -camBack * rakeTuck - rocketLift * 0.6);
            _camTargetLook.copy(_camWormWorld).addScaledVector(_camForward, rakeAhead + rocketLift * 0.9);
            // Mobile follows the player on every board size. A center bias grows
            // with the board and used to pull Mega's head out of the viewport.
            if (mobile) _camTargetLook.copy(_mobileHeadWorld);
            else _camTargetLook.multiplyScalar(1 - CAM_CENTER_BIAS * (1 - rocketLift));

            // Heal focus: while a ring heal freezes the worm (worm.healPauseT), push the
            // camera in on the surrounded tile with a slow circular track, then ease back to
            // the chase framing as the pause ends — so the pop reads even on a mega board.
            const healPauseT = worm.healPauseT?.current ?? 0;
            const focusTile = worm.healFocusTile?.current;
            if (healPauseT > 0 && focusTile) {
                const elapsed = HEAL_PAUSE_DURATION - healPauseT;
                const rampIn = THREE.MathUtils.smoothstep(elapsed, 0, 0.22);
                const rampOut = THREE.MathUtils.smoothstep(healPauseT, 0, 0.28);
                const focusBlend = Math.min(rampIn, rampOut);
                if (focusBlend > 0.001) {
                    const tw = getStickerWorldPos(focusTile.x, focusTile.y, focusTile.z, focusTile.dirKey, size, 0);
                    _healFocusLook.set(tw[0], tw[1], tw[2]);
                    _healFocusN.copy(FACE_NORMALS[focusTile.dirKey] ?? FACE_NORMALS.PZ);
                    _healSide.crossVectors(_healFocusN, _WORLD_UP);
                    if (_healSide.lengthSq() < 1e-6) _healSide.set(1, 0, 0);
                    _healSide.normalize();
                    // Track around the heal in a true 360-capable circle rather than
                    // rocking side-to-side. Only a short, slow arc is shown during the
                    // pause; retaining the previous heading makes the return to play
                    // legible. Both axes stay tangent to the healed face.
                    _healForward.crossVectors(_healSide, _healFocusN).normalize();
                    const orbitAngle = elapsed * HEAL_ORBIT_SPEED;
                    const orbitRadius = 0.85;
                    _healFocusCam.copy(_healFocusLook)
                        .addScaledVector(_healFocusN, 1.2 + size * 0.05) // in close, just off the tile
                        .addScaledVector(_healSide, Math.cos(orbitAngle) * orbitRadius)
                        .addScaledVector(_healForward, Math.sin(orbitAngle) * orbitRadius)
                        .addScaledVector(_camForward, -0.35); // retain a hint of the worm's heading
                    _camTargetCam.lerp(_healFocusCam, focusBlend);
                    _camTargetLook.lerp(_healFocusLook, focusBlend);
                }
            }

            // Which way is up. 'face' takes it from the surface the worm is on, so
            // the horizon rolls with the cube and the basis is never degenerate —
            // the camera looks along the face, never down its own up axis. 'level'
            // keeps the old world-Y horizon; it still has to flip under the cube,
            // but the flip is now a slerped roll rather than a lerp through zero.
            if (horizonMode === 'face') _camUp.copy(_camNormal);
            else _camUp.set(0, _camNormal.y < -0.8 ? -1 : 1, 0);

            // Body-cut beat: a rotating layer sheared off part of the tail but the
            // worm lived. The game freezes for this beat (the sim and the rotation
            // hazard clock both stop — see stepWormSim / HealerWormMode), so swing
            // the framing out to an exterior shot of the impact side of the cube —
            // level and pulled back so the hit and the WORM'D card read, while the
            // severing slice spins into view — then ease back to the chase as the
            // beat expires ("he comes back") and the frozen worm resumes.
            const cutFocusT = worm.cutFocusT?.current ?? 0;
            const cutPos = worm.cutFocusPos?.current;
            let cutBlend = 0;
            if (cutFocusT > 0 && cutPos) {
                const elapsed = CUT_FOCUS_DURATION - cutFocusT;
                const rampIn = THREE.MathUtils.smoothstep(elapsed, 0, 0.18);
                const rampOut = THREE.MathUtils.smoothstep(cutFocusT, 0, 0.3);
                cutBlend = Math.min(rampIn, rampOut);
                if (cutBlend > 0.001) {
                    _cutFocusPos.fromArray(cutPos);
                    sliceOverviewInto(_cutCam, _cutLook, _cutUp, _cutFocusPos,
                        size, camera.fov, viewportAspect);
                    _camTargetCam.lerp(_cutCam, cutBlend);
                    _camTargetLook.lerp(_cutLook, cutBlend);
                    _camUp.lerp(_cutUp, cutBlend);
                    if (_camUp.lengthSq() < 1e-6) _camUp.copy(_cutUp);
                    _camUp.normalize();
                }
            }

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

            // Exponential damping has the same response at 30/60/120 Hz.
            // Linear dt gains made Mega's fluctuating frame times change the drag.
            const alpha = 1 - Math.exp(-crawlK * (1 + rocketLift * 0.6) * delta);
            camPosRef.current.lerp(_camTargetCam, alpha);
            lookAtRef.current.lerp(_camTargetLook, alpha);
            camera.position.copy(camPosRef.current);
            aimCamera(camera, camPosRef.current, lookAtRef.current, _camUp, alpha);
            if (mobile) {
                // Let the cut composition take over from the head lock, then
                // ease back to the player as the animation finishes.
                if (cutBlend > 0.001) _mobileHeadWorld.lerp(_cutLook, cutBlend);
                frameSurfaceCamera(camera, portraitFactor, _mobileHeadWorld);
                lookAtRef.current.copy(_mobileHeadWorld);
            } else if (!rocketLift && !(worm.healPauseT?.current > 0) && !(worm.cutFocusT?.current > 0)) {
                frameSurfaceCamera(camera, portraitFactor);
            }
            camUpRef.current.copy(camera.up);
        } else if (phase === 'windup' || phase === 'entering') {
            const tunnel = worm.activeTunnel.current;
            const tp = THREE.MathUtils.clamp(worm.tunnelProgress.current, 0, 1);
            const entN = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;
            _entryTileCenter.fromArray(getStickerWorldPos(
                tunnel.entry.x, tunnel.entry.y, tunnel.entry.z, tunnel.entry.dirKey, size, 0
            ));
            tunnelState.active = true;
            tunnelState.t = phase === 'entering' ? tp * ENTER_END_T : 0;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;
            if (phase === 'windup') {
                _rails.cam.copy(_entryTileCenter).addScaledVector(entN, portalDist(size));
                _rails.look.copy(_entryTileCenter);
                // A face-tangent up remains valid when looking down ±Y.
                _rails.up.set(Math.abs(entN.y) > 0.9 ? 1 : 0, Math.abs(entN.y) > 0.9 ? 0 : 1, 0);
                // The head's short aperture handoff must not compress the
                // entire camera move into 180 ms. Entering continues this blend.
                blendTunnelPosesInto(transitionPose.current, phaseStartPose.current, _rails,
                    diveEase(tp * TUNNEL_HANDOFF_SECONDS / 0.7));
            } else {
                tunnelEntryPoseInto(transitionPose.current, tunnel, tp, size, phaseStartPose.current);
            }
            applyTunnelPose(transitionPose.current);
            if (mobile && phase === 'windup') {
                frameSurfaceCamera(camera, portraitFactor, _mobileHeadWorld);
                lookAtRef.current.copy(_mobileHeadWorld);
                camUpRef.current.copy(camera.up);
            }
        } else if (phase === 'tunnel' || phase === 'exiting') {
            const tunnel = worm.activeTunnel.current;
            const tp = THREE.MathUtils.clamp(worm.tunnelProgress.current, 0, 1);
            const tHead = phase === 'tunnel' ? 0.33 + tp * 0.34 : 0.67 + tp * 0.33;
            tunnelState.active = true;
            tunnelState.t = tHead;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;
            if (phase === 'exiting') tunnelExitPoseInto(_rails, tunnel, tp, size);
            else tunnelCamPoseInto(_rails, tunnel, tHead, size);
            applyTunnelPose(_rails, 1 - Math.exp(-10 * delta));
        } else if (phase === 'windout') {
            const tunnel = worm.activeTunnel.current;
            const tp = THREE.MathUtils.clamp(worm.tunnelProgress.current, 0, 1);
            tunnelState.active = true;
            tunnelState.t = 1;
            tunnelState.activeTunnelId = tunnel.pairId ?? null;
            const extN = FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY;
            const fwd = DIR_FORWARD[tunnel.exit.dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
            _camForward.fromArray(fwd);
            _rails.cam.copy(worm.headInterpPos.current)
                .addScaledVector(extN, camHeight + rakeLift)
                .addScaledVector(_camForward, -camBack * rakeTuck);
            _rails.look.copy(worm.headInterpPos.current).addScaledVector(_camForward, rakeAhead)
                .multiplyScalar(1 - CAM_CENTER_BIAS);
            if (mobile) _rails.look.copy(_mobileHeadWorld);
            _rails.up.copy(horizonMode === 'face' ? extN : _WORLD_UP);
            if (horizonMode !== 'face' && extN.y < -0.8) _rails.up.negate();
            // Start at the actual exit pose; the existing post-tunnel crawl
            // easing completes the camera move after control has returned.
            blendTunnelPosesInto(transitionPose.current, phaseStartPose.current, _rails,
                diveEase(tp * TUNNEL_HANDOFF_SECONDS / 0.7));
            applyTunnelPose(transitionPose.current);
            if (mobile) {
                frameSurfaceCamera(camera, portraitFactor, _mobileHeadWorld);
                lookAtRef.current.copy(_mobileHeadWorld);
                camUpRef.current.copy(camera.up);
            }
        }

        prevPhaseRef.current = phase;
    }, -0.25); // After simulation (-0.5), before body/effects (0); retain automatic rendering.

    return null;
}
