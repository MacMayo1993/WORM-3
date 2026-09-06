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
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { getActiveTunnels, collectManifoldRing } from './wormLogic.js';
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
    CUT_FOCUS_DURATION,
    MAX_TAIL,
} from './healerWorm/constants.js';
import { shPush, ttAt } from './circularBuffers.js';
import { feel, setFeelEnabled } from '../utils/feel.js';
import { EARN_ORB_COLLECT } from '../utils/economyConstants.js';
import { liveRotation } from './liveRotation.js';
import { shAt } from './circularBuffers.js';
import { rideLiveRotation, checkWormHitBySlice, cutWormTail } from './wormHelpers.js';
import { useWormCrawler } from './useWormCrawler.js';
import WormChaseCamera from './WormChaseCamera.jsx';
import WormSwipeControls from './WormSwipeControls.jsx';
import { TunnelInteriorView } from './healerWorm/TunnelInteriorView.jsx';
import { warmUpElementalSkins } from './healerWorm/elementalWarmup.js';
import { TunnelTube } from './healerWorm/TunnelTube.jsx';
import { WormBody, RocketTailFire, GlowWormAura } from './healerWorm/WormBody.jsx';
import { WormTrail, TRAIL_PAINTING_ENABLED } from './healerWorm/WormTrail.jsx';
import { WormFace } from './healerWorm/WormFace.jsx';
import { PowerupOrbs, OrbFlashSystem, SpecialOrbs, SpecialFlashSystem, MagnetFX } from './healerWorm/orbSystems.jsx';
import ElementalAtmosphere from './ElementalAtmosphere.jsx';
import { wormBuffs } from './wormBuffs.js';
import { HealBurstSystem, TunnelHealProgress } from './healerWorm/healFx.jsx';
import { WormholeRings } from './healerWorm/WormholeRings.jsx';
import { HealerBombs } from './healerWorm/HealerBombs.jsx';
import { randomFreeTile } from './healerWorm/surfaceTiles.js';
import {
    BOMB_FUSE_SECONDS,
    BOMB_SPAWN_INTERVAL,
    BOMB_DISARM_REWARD,
    bombCap,
    computeBlastTiles,
    isBombDisarmed,
    checkBlastHitWorm,
} from './healerWorm/bombs.js';
import { SliceWarningLights } from './healerWorm/SliceWarningLights.jsx';
import { rotationClock, resetRotationClock } from './healerWorm/rotationClockBridge.js';
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

    // Compile every elemental skin's GLSL now, while the board is still scrambling
    // and the player cannot act. Without this the first claim of each element paid
    // the driver's shader compile in the same frame the wash mounted, which is the
    // hitch players reported when a power-up appeared. Same treatment CubeAssembly
    // gives tile styles and HealerBombs' <WarmUp> gives bombs.
    const { gl, camera } = useThree();
    useEffect(() => {
        warmUpElementalSkins(gl, camera);
    }, [gl, camera]);

    // Keep the feel layer's SFX/haptics channels in sync with the player's settings.
    const sfxOn = useGameStore(s => s.settings?.sfx ?? true);
    const hapticsOn = useGameStore(s => s.settings?.haptics ?? true);
    useEffect(() => { setFeelEnabled({ sfx: sfxOn, haptics: hapticsOn }); }, [sfxOn, hapticsOn]);

    // ── Auto-rotation hazard state ─────────────────────────────────────────────
    const autoTimerRef      = useRef(0);
    // The next move, armed as soon as the cycle starts rather than only for the
    // last few seconds: the layer it names is lit the whole time, so the player can
    // see which slice is coming and plan around it instead of being told about it
    // once the turn is nearly on top of them.
    const pendingRotRef     = useRef(null);   // {axis,dir,sliceIndex} for the whole cycle
    const warningProgressRef = useRef(0);     // 0→1 through warning window
    const thunkRef = useRef({ active: false, pos: [0, 0, 0], colors: [] });

    // ── Bomb hazard state ──────────────────────────────────────────────────────
    // Bombs are a separate scheduled hazard, kept in a ref (written from the frame
    // loop, read by <HealerBombs>). Each: { id, tile:{x,y,z,dirKey}, fuse, maxFuse }.
    const bombsRef      = useRef([]);
    const bombTimerRef  = useRef(BOMB_SPAWN_INTERVAL);
    const bombSeqRef    = useRef(0);          // monotonic bomb id source
    const blastApiRef   = useRef(null);       // imperative detonation-flash handle from HealerBombs
    const occupiedTilesRef = useRef(new Set()); // scratch: body-covered tiles, rebuilt each frame
    // Bumped whenever the live bomb set gains or loses a member, so <HealerBombs>
    // can notice the change without serialising the id list every frame.
    const bombMembershipRef = useRef(0);

    useEffect(() => {
        setWormTurnCallback(worm.queueTurn);
        return () => { setWormTurnCallback(null); };
    }, [worm.queueTurn]);

    // The countdown readout lives in the DOM HUD and reads this bridge, so leaving
    // the mode has to blank it — otherwise the last run's clock is still showing
    // when the next one mounts.
    useEffect(() => () => resetRotationClock(), []);

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
            resetRotationClock();
            bombsRef.current          = [];
            bombMembershipRef.current++;
            bombTimerRef.current      = BOMB_SPAWN_INTERVAL;
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
                    resetRotationClock();
                    // Give the player a full interval of breathing room before the
                    // first bomb spawns (the rotation hazard already ramps in slowly).
                    bombTimerRef.current = BOMB_SPAWN_INTERVAL;
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
        if (worm.phase.current !== 'crawling') { rotationClock.held = true; return; }

        // Freeze the hazard clock in lockstep with the body-cut freeze frame: the sim is
        // frozen for this beat (see stepWormSim), so hold the auto-rotate timer and warning
        // beam steady too — otherwise the clock keeps charging behind the camera swing and
        // the next turn can fire the instant the worm resumes.
        if (worm.cutFocusT.current > 0) { rotationClock.held = true; return; }

        // Same for the elemental-claim beat — the sim is frozen for it, so the
        // auto-rotate clock must not keep charging behind the camera move.
        if ((worm.elementalFocusT?.current ?? 0) > 0) { rotationClock.held = true; return; }

        // ── Bomb hazard: spawn → fuse → disarm-by-encircle → detonation ────────
        {
            // Clamp the timestep so a render stall (tab switch, GC pause) can't burn a
            // whole fuse — or the spawn clock — in one giant frame.
            const bdelta = Math.min(delta, 0.1);
            // Tiles the visible body currently covers — the same reach the wormhole
            // ring-heal uses, so surrounding a bomb reads identically to sealing a hole.
            const trail = worm.tileTrail.current;
            const bodyReach = Math.min(MAX_TAIL, worm.tailLength.current) * BODY_BALL_SPACING;
            const occupiedCount = Math.min(trail.count, Math.max(1, Math.ceil(bodyReach)));
            // Reused across frames: a long worm rebuilds this every frame for the
            // whole run, and a fresh Set per frame is garbage the collector has to
            // come back for mid-crawl. Cleared and refilled instead.
            const occupied = occupiedTilesRef.current;
            occupied.clear();
            for (let i = 0; i < occupiedCount; i++) occupied.add(ttAt(trail, i));

            // Spawn clock — one attempt per interval, capped by board size.
            //
            // An active elemental wash suspends it entirely: the cube is re-skinned,
            // the camera has pulled out and the player is reading a transformed
            // board, which is the worst possible moment to drop a five-second fuse
            // on them. The clock is reset to a full interval on the skip, so the
            // wash ending does not immediately hand over a bomb either.
            bombTimerRef.current -= bdelta;
            if (bombTimerRef.current <= 0) {
                bombTimerRef.current = BOMB_SPAWN_INTERVAL;
                if (wormBuffs.elementalT > 0) {
                    // suspended for the wash — fall through to the fuse loop below
                } else if (bombsRef.current.length < bombCap(size)) {
                    // Never spawn on or right next to the worm: exclude a no-spawn ring
                    // around the head (size-scaled), the visible body, and live bombs, so
                    // every bomb lands with room to react and detonates in open view.
                    const head = worm.pos.current;
                    const safeRadius = size <= 3 ? 1 : 2;
                    const exclSet = collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, safeRadius);
                    for (const key of occupied) exclSet.add(key);
                    for (const b of bombsRef.current) exclSet.add(`${b.tile.x},${b.tile.y},${b.tile.z},${b.tile.dirKey}`);
                    const exclude = [...exclSet].map((k) => {
                        const [x, y, z, dirKey] = k.split(',');
                        return { x: +x, y: +y, z: +z, dirKey };
                    });
                    const tile = randomFreeTile(size, exclude);
                    if (tile) {
                        bombsRef.current.push({ id: bombSeqRef.current++, tile, fuse: BOMB_FUSE_SECONDS, maxFuse: BOMB_FUSE_SECONDS });
                        bombMembershipRef.current++;
                    }
                }
            }

            // Fuse / disarm / detonate. Survivors are compacted toward the front of
            // the existing array rather than collected into a new one — this runs on
            // every active frame, and the list it was rebuilding is almost always
            // unchanged.
            if (bombsRef.current.length > 0) {
                const bombs = bombsRef.current;
                let kept = 0;
                for (let read = 0; read < bombs.length; read++) {
                    const bomb = bombs[read];
                    // Disarm: body fully encircles the bomb — reward and remove it.
                    if (isBombDisarmed(bomb, occupied, size)) {
                        useGameStore.getState().earnCoins(BOMB_DISARM_REWARD);
                        feel('heal');
                        continue;
                    }
                    bomb.fuse -= bdelta;
                    if (bomb.fuse > 0) { bombs[kept++] = bomb; continue; }

                    // Detonate: shoot fire out along the arms, then resolve the hit.
                    // Flames ignite staggered by distance so the blast reads as
                    // bursting outward from the bomb (Bomberman-style).
                    const { keys, arms, center } = computeBlastTiles(bomb, size);
                    const flames = [];
                    const pushFlame = (t, delay) => {
                        const wp = getStickerWorldPos(t.x, t.y, t.z, t.dirKey, size, 0);
                        const n = FACE_NORMALS[t.dirKey] ?? FACE_NORMALS.PZ;
                        // Flames sit just off the surface (along the normal) but lick UP
                        // along the face's "up" so they read as flames, not blobs.
                        const u = DIR_FORWARD[t.dirKey]?.up ?? [0, 1, 0];
                        flames.push({ pos: [wp[0] + n.x * 0.35, wp[1] + n.y * 0.35, wp[2] + n.z * 0.35], up: u, delay });
                    };
                    pushFlame(center, 0);
                    for (const arm of arms) arm.forEach((t, idx) => pushFlame(t, (idx + 1) * 0.05));
                    blastApiRef.current?.spawn(flames);
                    feel('cut');

                    const hit = checkBlastHitWorm(worm, keys);
                    if (hit) {
                        const histEntry = hit.type === 'cut'
                            ? shAt(worm.stepHistory.current, hit.cutTrailIdx * STEPS_PER_TILE)
                            : null;
                        const hitPos = histEntry ? histEntry.pos.toArray() : worm.headInterpPos.current.toArray();
                        thunkRef.current = { active: true, pos: hitPos, colors: ['#ff7b2e', '#ffd23f'] };
                        if (hit.type === 'death') {
                            worm.killWorm({ reason: 'bomb', bombId: bomb.id });
                        } else {
                            cutWormTail(worm, hit.cutTrailIdx);
                            worm.cutFocusT.current = CUT_FOCUS_DURATION;
                            worm.cutFocusPos.current = hitPos;
                        }
                    }
                    // bomb consumed — not compacted into the kept range
                }
                if (kept !== bombs.length) {
                    bombs.length = kept;
                    bombMembershipRef.current++;
                }
            }
        }

        rotationClock.held = false;
        autoTimerRef.current += delta;
        const warningStart = ACTIVE_ROTATE_INTERVAL - AUTO_ROTATE_WARNING;

        // Arm with the NEXT inverse move the moment the cycle starts (peek, don't
        // dequeue yet). The layer stays lit for the whole ten seconds — softly at
        // first, hard through the telegraph window — so "which slice, which way"
        // is answered before the countdown gets short.
        if (!pendingRotRef.current) {
            if (inverseQueueRef.current.length === 0) {
                // All inverse moves exhausted — enter final healing phase.
                // Wormhole spawning is now blocked (checked in worm.tick).
                // Game ends only when the player heals all remaining tunnels.
                gameModePhaseRef.current = 'finalHealing';
                finalHealCheckTimer.current = 0.5; // check immediately next frame batch
                pendingRotRef.current = null;
                warningProgressRef.current = 0;
                resetRotationClock();
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

        // Publish the clock for the HUD's countdown. A plain object rather than
        // store state — this changes every frame and the readout paints itself
        // from a ref (see rotationClockBridge).
        rotationClock.armed = !!pendingRotRef.current;
        rotationClock.secondsLeft = Math.max(0, ACTIVE_ROTATE_INTERVAL - autoTimerRef.current);
        rotationClock.total = ACTIVE_ROTATE_INTERVAL;
        rotationClock.warning = warningProgressRef.current;
        rotationClock.axis = pendingRotRef.current?.axis ?? null;
        rotationClock.sliceIndex = pendingRotRef.current?.sliceIndex ?? null;

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
                    // Cue the chase camera to swing out to the impact for the WORM'D
                    // beat, then ease back to the chase (see WormChaseCamera).
                    worm.cutFocusT.current = CUT_FOCUS_DURATION;
                    worm.cutFocusPos.current = hitPos;
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
            {/* Elemental orb wash — bathes the whole cube in the claimed element. */}
            <ElementalAtmosphere size={size} />
            <TunnelInteriorView worm={worm} size={size} />
            {/* The shaft the camera actually rides inside — encloses the view so the
                trip reads as a tunnel rather than a ribbon crossing an empty room. */}
            <TunnelTube worm={worm} size={size} />
            {/* Always mounted — each component handles its own dissolve via worm.phase.current */}
            {/* Parked, not deleted — the painted route survives a hazard turn only
                in pieces, since the paint rides the slice it sits on. See
                WormTrail.jsx; the plan is to bring it back as a pickup. */}
            {wormAlive && TRAIL_PAINTING_ENABLED && <WormTrail worm={worm} size={size} />}
            {wormAlive && <WormBody worm={worm} size={size} />}
            {wormAlive && <RocketTailFire worm={worm} size={size} />}
            {wormAlive && <GlowWormAura worm={worm} size={size} />}
            {wormAlive && <WormFace worm={worm} size={size} />}
            {wormAlive && <PortalGlow worm={worm} size={size} />}
            {wormAlive && <TunnelPortalFX worm={worm} size={size} />}
            {/* Hidden, not unmounted, for the tunnel ride. The camera is inside the
                cube then so none of this exterior decoration is visible either way,
                but tearing it down and rebuilding it cost a rebuild of nine
                InstancedMeshes, a canvas texture and every live bomb's countdown
                texture — twice per trip, once going in and once coming out. That
                rebuild is the stutter players felt entering and leaving a tunnel. */}
            <WormholeRings
                cubies={cubies}
                size={size}
                worm={worm}
                voidTunnelKeysRef={worm.voidTunnelKeysRef}
                tunnelUseCountsRef={worm.tunnelUseCountsRef}
                hidden={wormInTunnel}
            />
            <HealerBombs bombsRef={bombsRef} membershipRef={bombMembershipRef} blastApiRef={blastApiRef} size={size} hidden={wormInTunnel} />
            <TunnelHealProgress size={size} />
            <HealBurstSystem worm={worm} size={size} />
            <OrbFlashSystem worm={worm} />
            <SpecialFlashSystem worm={worm} />
            {wormAlive && <MagnetFX worm={worm} />}
            <PowerupOrbs size={size} />
            <SpecialOrbs size={size} hidden={wormInTunnel} />
            <SliceWarningLights pendingRotRef={pendingRotRef} warningProgressRef={warningProgressRef} size={size} />
            <ThunkEffect thunkRef={thunkRef} />
            <CollisionGlow size={size} />
        </>
    );
}
