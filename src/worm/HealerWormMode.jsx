// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — top-level wrapper and game-phase driver.
// Chase camera follows the worm crawling on the cube exterior.
// Flipped tiles are instant wormholes; jump to clear them.
//
// This file owns only the scramble → spawning → countdown → active →
// finalHealing → solved phase machine and the inverse-rotation hazard
// scheduler. The rendering subsystems (body, trail, face, rings, portal/heal/
// impact FX, tunnel interior) were split into ./healerWorm/ in 2026-07 — each
// module is verbatim-extracted, so recover pre-split history via this file.
// Dead components removed in the same split (recover from git history if ever
// needed): TunnelSurfFX, WormInteriorGlass, TunnelPortalRings.

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { getActiveTunnels } from './wormLogic.js';
import { setWormTurnCallback } from './wormTurnBridge.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import {
    WORM_LIFT,
    FACE_NORMALS,
    DIR_FORWARD,
    STEPS_PER_TILE,
    AUTO_ROTATE_WARNING,
    SCRAMBLE_STEPS,
    ACTIVE_ROTATE_INTERVAL,
    COUNTDOWN_STEP_DURATION,
    BASE_TAIL_LENGTH,
    BODY_BALL_SPACING,
} from './healerWorm/constants.js';
import { shPush } from './circularBuffers.js';
import { feel, setFeelEnabled } from '../utils/feel.js';
import { EARN_ORB_COLLECT } from '../utils/economyConstants.js';
import { liveRotation } from './liveRotation.js';
import { shAt } from './circularBuffers.js';
import { rideLiveRotation, checkWormHitBySlice, cutWormTail } from './wormHelpers.js';
import { useWormCrawler } from './useWormCrawler.js';
import WormChaseCamera from './WormChaseCamera.jsx';
import WormSwipeControls from './WormSwipeControls.jsx';
import { TunnelInteriorView } from './healerWorm/TunnelInteriorView.jsx';
import { TunnelTube } from './healerWorm/TunnelTube.jsx';
import { WormBody, RocketTailFire, GlowWormAura } from './healerWorm/WormBody.jsx';
import { WormTrail } from './healerWorm/WormTrail.jsx';
import { WormFace } from './healerWorm/WormFace.jsx';
import { PowerupOrbs, OrbFlashSystem, SpecialOrbs, SpecialFlashSystem, MagnetFX } from './healerWorm/orbSystems.jsx';
import { HealBurstSystem, TunnelHealProgress } from './healerWorm/healFx.jsx';
import { WormholeRings } from './healerWorm/WormholeRings.jsx';
import { SliceWarningLights } from './healerWorm/SliceWarningLights.jsx';
import { RampMarkers } from './healerWorm/RampMarkers.jsx';
import { PortalGlow, TunnelPortalFX } from './healerWorm/portalFx.jsx';
import { ThunkEffect, CollisionGlow } from './healerWorm/impactFx.jsx';
import { buildWormScramble, invertWormScramble } from './healerWorm/scramble.js';

const SPAWN_DURATION = 0.75;

// Scratch vectors used to seed synthetic body history during spawning.
const _seedPos = new THREE.Vector3();
const _seedNorm = new THREE.Vector3();
const _seedBackDir = new THREE.Vector3();

// ─── Main exported wrapper ────────────────────────────────────────────────────
export function HealerWormMode3DWrapper({ cubies, size, _explosionFactor, _animState, onRotate, _onHeal, onAnimatedShuffle }) {
    const worm = useWormCrawler(size, cubies);

    // ── Game phase + scramble state ────────────────────────────────────────────
    // gameModePhaseRef: 'scrambling'|'spawning'|'countdown'|'active'|'finalHealing'|'solved'
    const gameModePhaseRef  = useRef('scrambling');
    const scrambleSeqRef    = useRef([]);   // [{axis,dir,sliceIndex}] × SCRAMBLE_STEPS
    const inverseQueueRef   = useRef([]);   // remaining inverse moves (consumed each rotation)
    const spawnTimerRef     = useRef(0);    // seconds elapsed in spawning entrance animation
    const countdownTimerRef = useRef(0);    // seconds elapsed in countdown phase
    const countdownStepRef  = useRef(-1);   // last store-synced step (avoids redundant setState)
    const finalHealCheckTimer = useRef(0);  // throttle: scan for active tunnels every 0.5s

    // Reactive phase for conditional JSX rendering — only changes on phase transitions
    const wormGamePhase = useGameStore(s => s.wormGamePhase ?? 'scrambling');
    const wormPhaseReactive = useGameStore(s => s.wormPhase ?? 'crawling');

    // Keep the feel layer's SFX/haptics channels in sync with the player's settings.
    const sfxOn = useGameStore(s => s.settings?.sfx ?? true);
    const hapticsOn = useGameStore(s => s.settings?.haptics ?? true);
    useEffect(() => { setFeelEnabled({ sfx: sfxOn, haptics: hapticsOn }); }, [sfxOn, hapticsOn]);

    // ── Auto-rotation hazard state ─────────────────────────────────────────────
    const autoTimerRef      = useRef(0);
    const pendingRotRef     = useRef(null);   // {axis,dir,sliceIndex} during warning window
    const warningProgressRef = useRef(0);     // 0→1 through warning window
    const thunkRef = useRef({ active: false, pos: [0, 0, 0], colors: [] });

    useEffect(() => {
        setWormTurnCallback(worm.queueTurn);
        return () => { setWormTurnCallback(null); };
    }, [worm.queueTurn]);

    // Build a fresh scramble whenever a new run starts (or on first mount).
    useEffect(() => {
        const generateScramble = () => {
            const seq = buildWormScramble(size, SCRAMBLE_STEPS);
            scrambleSeqRef.current  = seq;
            // Reverse the sequence and every turn so the timed hazard solves the board.
            inverseQueueRef.current = invertWormScramble(seq);

            // Reset all phase state
            gameModePhaseRef.current  = 'scrambling';
            spawnTimerRef.current     = 0;
            countdownTimerRef.current = 0;
            countdownStepRef.current  = -1;
            autoTimerRef.current      = 0;
            pendingRotRef.current     = null;
            warningProgressRef.current = 0;
            // Freeze the worm until the countdown completes
            useGameStore.setState({ wormGamePhase: 'scrambling', wormCountdownStep: null, wormPaused: true });

            // Play all 15 moves through the shared animated-shuffle pipeline:
            // fast 0.12s power2.out animations (no back-easing overshoot → no black layers),
            // properly sequenced, not counted as player moves.
            // When done, go to 'spawning' so the worm can emerge before the countdown.
            onAnimatedShuffle(seq, () => {
                gameModePhaseRef.current = 'spawning';
                spawnTimerRef.current    = 0;
                useGameStore.setState({ wormGamePhase: 'spawning', wormCountdownStep: null });
            });
        };

        // Run immediately so the first game (where initWormMode fires before this
        // component mounts) gets a valid scramble — not just on future runId changes.
        generateScramble();

        const unsub = useGameStore.subscribe(s => s.wormRunId, generateScramble);
        return unsub;
    }, [size, onAnimatedShuffle]);

    useFrame((_, delta) => {
        worm.tick(delta);

        // While a slice the worm sits on is mid-rotation during live play, ride it so the
        // worm visually turns with the cube rather than snapping into place only when the
        // rotation commits. Only meaningful on the surface (crawling); tunnel phases aren't
        // anchored to a slice, and other game phases position the worm themselves.
        if (gameModePhaseRef.current === 'active' && worm.phase.current === 'crawling') {
            rideLiveRotation(worm);
        }

        const store = useGameStore.getState();

        // ── Phase: scrambling ──────────────────────────────────────────────────
        // Moves are sequenced by startAnimatedShuffle (called from generateScramble).
        // Here we only track the worm's visual position so it rides along with each
        // rotating slice instead of staying frozen in world space.
        if (gameModePhaseRef.current === 'scrambling') {
            if (liveRotation.active) {
                // The worm is frozen during the scramble, so tick() didn't refresh
                // headInterpPos — seed it from the flat tile position before riding the slice.
                const { x, y, z, dirKey } = worm.pos.current;
                const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
                worm.headInterpPos.current.set(wp[0], wp[1], wp[2]);
                rideLiveRotation(worm);
            }
            return;
        }

        // ── Phase: spawning — worm wiggles out of the face center ─────────────
        if (gameModePhaseRef.current === 'spawning') {
            spawnTimerRef.current += delta;
            const t = Math.min(spawnTimerRef.current / SPAWN_DURATION, 1);
            // Damped spring: shoots out of the face then settles
            const bounce = Math.sin(t * Math.PI * 2.4) * Math.exp(-t * 4.0) * 0.4;
            const { x, y, z, dirKey } = worm.pos.current;
            const norm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            worm.headInterpPos.current.set(wp[0], wp[1], wp[2]).addScaledVector(norm, WORM_LIFT + bounce);
            if (t >= 1) {
                // Seed step history so the full worm body is visible during countdown.
                // Push points trailing behind the head along the face surface (opposite
                // to the initial move direction), spaced at BODY_BALL_SPACING intervals.
                _seedNorm.copy(norm);
                const fwd = DIR_FORWARD[dirKey]?.up ?? [0, 1, 0];
                _seedBackDir.set(-fwd[0], -fwd[1], -fwd[2]);
                const segCount = BASE_TAIL_LENGTH * STEPS_PER_TILE;
                const stepSize = BODY_BALL_SPACING / STEPS_PER_TILE;
                for (let i = segCount - 1; i >= 0; i--) {
                    const d = (i + 1) * stepSize;
                    _seedPos.set(
                        wp[0] + _seedBackDir.x * d,
                        wp[1] + _seedBackDir.y * d,
                        wp[2] + _seedBackDir.z * d,
                    );
                    shPush(worm.stepHistory.current, _seedPos, _seedNorm, x, y, z);
                }

                gameModePhaseRef.current  = 'countdown';
                countdownTimerRef.current = 0;
                countdownStepRef.current  = -1;
                useGameStore.setState({ wormGamePhase: 'countdown', wormCountdownStep: 3 });
                countdownStepRef.current  = 0;
            }
            return;
        }

        // ── Phase: countdown ──────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'countdown') {
            countdownTimerRef.current += delta;

            // Idle breathing animation — gentle bob on the surface normal
            const { x, y, z, dirKey } = worm.pos.current;
            const norm = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            const breathe = Math.sin(countdownTimerRef.current * 3.5) * 0.03;
            worm.headInterpPos.current.set(wp[0], wp[1], wp[2]).addScaledVector(norm, WORM_LIFT + breathe);

            const step = Math.floor(countdownTimerRef.current / COUNTDOWN_STEP_DURATION);
            if (step !== countdownStepRef.current) {
                countdownStepRef.current = step;
                if      (step === 0) { useGameStore.setState({ wormCountdownStep: 3 }); feel('countdownBeat'); }
                else if (step === 1) { useGameStore.setState({ wormCountdownStep: 2 }); feel('countdownBeat'); }
                else if (step === 2) { useGameStore.setState({ wormCountdownStep: 1 }); feel('countdownBeat'); }
                else if (step === 3) {
                    useGameStore.setState({ wormCountdownStep: 'go' });
                    feel('countdownGo');
                } else if (step === 4) {
                    // Hold phase — "WORM" stays visible for one extra beat
                    useGameStore.setState({ wormCountdownStep: 'hold' });
                } else if (step >= 5) {
                    // Countdown done — release the worm
                    gameModePhaseRef.current = 'active';
                    autoTimerRef.current = 0;
                    pendingRotRef.current = null;
                    warningProgressRef.current = 0;
                    useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false });
                }
            }
            return;
        }

        // ── Phase: solved ──────────────────────────────────────────────────────
        if (gameModePhaseRef.current === 'solved') return;

        // ── Phase: finalHealing — all rotations done, heal remaining tunnels ───
        if (gameModePhaseRef.current === 'finalHealing') {
            if (!store.wormAlive) return;
            // Throttle the expensive tunnel scan to once every 0.5 s
            finalHealCheckTimer.current += delta;
            if (finalHealCheckTimer.current >= 0.5) {
                finalHealCheckTimer.current = 0;
                const liveState = useGameStore.getState();
                const remaining = getActiveTunnels(
                    liveState.cubies,
                    size,
                    getManifoldMap(liveState.cubies, size, liveState.rotationEpoch)
                );
                if (remaining.length === 0) {
                    gameModePhaseRef.current = 'solved';
                    const bodyOrbs = useGameStore.getState().wormBodyTiles ?? 0;
                    // 2× multiplier: reward for clearing all tunnels before the clock ran out
                    if (bodyOrbs > 0) useGameStore.getState().earnCoins(bodyOrbs * EARN_ORB_COLLECT * 2);
                    // Freeze the worm — game is over; publish final time for WinnerScreen
                    useGameStore.setState({ wormGamePhase: 'solved', wormPaused: true, wormTimeAlive: Math.floor(worm.timeAliveRef.current) });
                }
            }
            return;
        }

        // ── Phase: active — inverse-rotation hazard ────────────────────────────
        if (!store.wormAlive || store.wormPaused) return;

        // Pause the rotation hazard entirely while the worm is inside a wormhole: freeze the
        // clock and the warning beam so nothing charges or fires until it emerges (crawling).
        if (worm.phase.current !== 'crawling') return;

        autoTimerRef.current += delta;
        const warningStart = ACTIVE_ROTATE_INTERVAL - AUTO_ROTATE_WARNING;

        // Arm warning with the NEXT inverse move (peek, don't dequeue yet)
        if (autoTimerRef.current >= warningStart && !pendingRotRef.current) {
            if (inverseQueueRef.current.length === 0) {
                // All inverse moves exhausted — enter final healing phase.
                // Wormhole spawning is now blocked (checked in worm.tick).
                // Game ends only when the player heals all remaining tunnels.
                gameModePhaseRef.current = 'finalHealing';
                finalHealCheckTimer.current = 0.5; // check immediately next frame batch
                pendingRotRef.current = null;
                warningProgressRef.current = 0;
                useGameStore.setState({ wormGamePhase: 'finalHealing' });
                return;
            }
            // Peek the next inverse move (a parallel pair only in Mega Mode).
            pendingRotRef.current = inverseQueueRef.current[0];
        }

        // Update warning progress (0→1)
        if (pendingRotRef.current) {
            const elapsed = autoTimerRef.current - warningStart;
            warningProgressRef.current = Math.min(1, Math.max(0, elapsed / AUTO_ROTATE_WARNING));
        }

        // Fire rotation at the fixed 10-second mark
        if (autoTimerRef.current >= ACTIVE_ROTATE_INTERVAL && pendingRotRef.current) {
            // Delay if mid-tunnel
            if (worm.phase.current !== 'crawling') {
                autoTimerRef.current = ACTIVE_ROTATE_INTERVAL - 1.5;
                return;
            }

            const { axis, dir, sliceIndex, sliceIndices, sliceDirs } = pendingRotRef.current;
            inverseQueueRef.current.shift(); // now dequeue

            // Hit detection — the worm can be caught by EITHER spinning plane.
            const layers = sliceIndices?.length ? sliceIndices : [sliceIndex];
            let hit = null;
            for (const layer of layers) {
                hit = checkWormHitBySlice(worm, axis, layer);
                if (hit) break;
            }
            if (hit) {
                const histEntry = hit.type === 'cut'
                    ? shAt(worm.stepHistory.current, hit.cutTrailIdx * STEPS_PER_TILE)
                    : null;
                const hitPos = histEntry
                    ? histEntry.pos.toArray()
                    : worm.headInterpPos.current.toArray();
                const cutColors = worm.orbPickupColorsRef.current.slice(0, 5);
                thunkRef.current = {
                    active: true,
                    pos: hitPos,
                    colors: cutColors.length ? cutColors : ['#ffdd44', '#ff8800'],
                };
                if (hit.type === 'death') {
                    worm.killWorm({ reason: 'slice-rotation', axis, sliceIndex });
                } else {
                    cutWormTail(worm, hit.cutTrailIdx);
                    feel('cut');
                }
            }

            if (onRotate) {
                // liveRotation exposes ONE anchor slice (+ its direction) to the
                // chase/body bridge. If the head sits on one of the two spinning
                // planes, anchor to that plane — and its own turn direction — so the
                // worm rides the correct tween instead of snapping when the move commits.
                const axisCoord = axis === 'col' ? worm.pos.current.x
                    : axis === 'row' ? worm.pos.current.y
                    : worm.pos.current.z;
                const anchorAt = layers.indexOf(axisCoord);
                const anchorSlice = anchorAt !== -1 ? axisCoord : sliceIndex;
                const anchorDir = anchorAt !== -1 && sliceDirs?.length ? sliceDirs[anchorAt] : dir;
                onRotate(axis, anchorDir, anchorSlice, false, sliceIndices, sliceDirs);
            }

            // Reset for next cycle (fixed interval — no randomisation)
            pendingRotRef.current = null;
            warningProgressRef.current = 0;
            autoTimerRef.current = 0;
        }
    });

    const wormInTunnel = wormPhaseReactive === 'windup' || wormPhaseReactive === 'entering' || wormPhaseReactive === 'tunnel' || wormPhaseReactive === 'exiting' || wormPhaseReactive === 'windout';
    const wormAlive = wormGamePhase !== 'scrambling';

    return (
        <>
            <WormChaseCamera worm={worm} size={size} />
            <WormSwipeControls onTurn={worm.queueTurn} worm={worm} />
            <TunnelInteriorView worm={worm} size={size} />
            {/* The shaft the camera actually rides inside — encloses the view so the
                trip reads as a tunnel rather than a ribbon crossing an empty room. */}
            <TunnelTube worm={worm} size={size} />
            {/* Always mounted — each component handles its own dissolve via worm.phase.current */}
            {wormAlive && <WormTrail worm={worm} size={size} />}
            {wormAlive && <WormBody worm={worm} size={size} />}
            {wormAlive && <RocketTailFire worm={worm} />}
            {wormAlive && <GlowWormAura worm={worm} />}
            {wormAlive && <WormFace worm={worm} size={size} />}
            {wormAlive && <PortalGlow worm={worm} size={size} />}
            {wormAlive && <TunnelPortalFX worm={worm} size={size} />}
            {!wormInTunnel && <WormholeRings
                cubies={cubies}
                size={size}
                worm={worm}
                voidTunnelKeysRef={worm.voidTunnelKeysRef}
                tunnelUseCountsRef={worm.tunnelUseCountsRef}
            />}
            <TunnelHealProgress size={size} />
            <HealBurstSystem worm={worm} size={size} />
            <OrbFlashSystem worm={worm} />
            <SpecialFlashSystem worm={worm} />
            {wormAlive && <MagnetFX worm={worm} />}
            <PowerupOrbs size={size} />
            {!wormInTunnel && <RampMarkers worm={worm} size={size} />}
            {!wormInTunnel && <SpecialOrbs size={size} />}
            <SliceWarningLights pendingRotRef={pendingRotRef} size={size} />
            <ThunkEffect thunkRef={thunkRef} />
            <CollisionGlow size={size} />
        </>
    );
}
