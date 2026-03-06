// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — complete rewrite.
// Chase camera follows the worm crawling on the cube exterior.
// Disparity Level 1 runs in background. Tap a flipped tile to ride the antipodal tunnel.

import React, { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { getNextSurfacePosition, getActiveTunnels, getTunnelWorldPos, turnWorm } from './wormLogic.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const CAM_HEIGHT_BASE = 4.6;  // base height above worm
const CAM_BACK_BASE = 4.2;  // base behind distance
const LOOK_AHEAD = 1.8;  // look-at ahead of worm
const CAM_LERP = 6;    // camera smoothing (× delta)
const WORM_LIFT = 0.08; // worm sits right on tile surface
const ZOOM_BURST = 0.8;  // brief camera pull-back on pickup (decays fast)
const MAX_EXTRA_ZOOM = 2.0; // hard cap so camera never flies away

const GLASS_MIN_OPACITY = 0.12;
const GLASS_MAX_OPACITY = 0.28;
const GLASS_MIN_TRANSMISSION = 0.72;
const GLASS_MAX_TRANSMISSION = 0.95;

// Face outward normals
const FACE_NORMALS = {
    PX: new THREE.Vector3(1, 0, 0),
    NX: new THREE.Vector3(-1, 0, 0),
    PY: new THREE.Vector3(0, 1, 0),
    NY: new THREE.Vector3(0, -1, 0),
    PZ: new THREE.Vector3(0, 0, 1),
    NZ: new THREE.Vector3(0, 0, -1),
};

// Move direction → world forward vector (on each face)
const DIR_FORWARD = {
    PZ: { up: [0, 1, 0], down: [0, -1, 0], left: [-1, 0, 0], right: [1, 0, 0] },
    NZ: { up: [0, 1, 0], down: [0, -1, 0], left: [1, 0, 0], right: [-1, 0, 0] },
    PX: { up: [0, 1, 0], down: [0, -1, 0], left: [0, 0, 1], right: [0, 0, -1] },
    NX: { up: [0, 1, 0], down: [0, -1, 0], left: [0, 0, -1], right: [0, 0, 1] },
    PY: { up: [0, 0, -1], down: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] },
    NY: { up: [0, 0, 1], down: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0] },
};

const INITIAL_DIR = 'up';
const INITIAL_POS = (size) => {
    const c = Math.floor(size / 2);
    return { x: c, y: c, z: size - 1, dirKey: 'PZ' };
};

// ─── Powerup helpers ─────────────────────────────────────────────────────────
const POWERUP_COUNT = 5;
const ORB_SEGMENT_GROWTH = 2;   // every orb adds exactly 2 visual balls
const STEPS_PER_TILE = 50;      // sub-steps recorded per tile (0.02 resolution)
const BASE_TAIL_LENGTH = 4;
const WORMHOLE_FLIP_INTERVAL = 10; // seconds between guaranteed antipodal wormhole spawns

function getAllSurfaceTiles(size) {
    const tiles = [];
    const faces = [
        ['PX', 'x', size - 1], ['NX', 'x', 0],
        ['PY', 'y', size - 1], ['NY', 'y', 0],
        ['PZ', 'z', size - 1], ['NZ', 'z', 0],
    ];
    for (const [dirKey, axis, val] of faces) {
        for (let a = 0; a < size; a++) {
            for (let b = 0; b < size; b++) {
                const p = { x: 0, y: 0, z: 0 };
                if (axis === 'x') { p.x = val; p.y = a; p.z = b; }
                else if (axis === 'y') { p.x = a; p.y = val; p.z = b; }
                else { p.x = a; p.y = b; p.z = val; }
                tiles.push({ ...p, dirKey });
            }
        }
    }
    return tiles;
}

function randomFreeTile(size, exclude) {
    const all = getAllSurfaceTiles(size);
    const excludeKeys = new Set(exclude.map(e => `${e.x},${e.y},${e.z},${e.dirKey}`));
    const free = all.filter(t => !excludeKeys.has(`${t.x},${t.y},${t.z},${t.dirKey}`));
    const pool = free.length > 0 ? free : all;
    return pool[Math.floor(Math.random() * pool.length)];
}

function randomUnflippedTile(cubies, size, exclude = []) {
    const all = getAllSurfaceTiles(size);
    const excludeKeys = new Set(exclude.map(e => `${e.x},${e.y},${e.z},${e.dirKey}`));
    const pool = all.filter((t) => {
        if (excludeKeys.has(`${t.x},${t.y},${t.z},${t.dirKey}`)) return false;
        const st = cubies?.[t.x]?.[t.y]?.[t.z]?.stickers?.[t.dirKey];
        return !!st && st.curr === st.orig;
    });
    const pickFrom = pool.length > 0 ? pool : all;
    return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}

// ─── Worm Crawler Hook ────────────────────────────────────────────────────────
// Tail segments needed to visually cover all tiles: totalTiles / (0.14 unit spacing / ~1 unit per tile)
// For 5×5 (150 tiles): ~1100 segments. Round up generously.
const MAX_TAIL = 1200;

function useWormCrawler(size, cubies) {
    const wormSpeed = useGameStore(s => s.wormSpeed ?? 0.4);
    const healedRef = useRef(0);

    const pos = useRef(INITIAL_POS(size));
    const moveDir = useRef(INITIAL_DIR);
    const phase = useRef('crawling');
    const tunnelProgress = useRef(0);
    const activeTunnel = useRef(null);
    const stepAcc = useRef(0);
    const pendingTurn = useRef(null);
    const onFlippedTile = useRef(false);
    const lastFlippedRef = useRef(false);
    const prevDirKey = useRef(null);
    const lastRecordedT = useRef(0);
    const crossingCorner = useRef(false);

    // Smooth inter-tile interpolation
    const interpT = useRef(1);          // 0→1 between prev and current tile
    const prevWorldPos = useRef(null);       // world pos of previous tile
    const curWorldPos = useRef(null);       // world pos of current tile
    const headInterpPos = useRef(new THREE.Vector3());
    const currentNormal = useRef(new THREE.Vector3(0, 0, 1));

    // Jump state
    const jumpT = useRef(0);            // 0 = grounded, >0 = in air
    const isJumping = useRef(false);
    const JUMP_HEIGHT = 0.55;
    const JUMP_SPEED = 3.5;

    // Growing tail + powerups
    const tailLength = useRef(BASE_TAIL_LENGTH);
    const powerupsRef = useRef([]);  // local fast-access copy of wormPowerups
    const stepHistory = useRef([]);  // one world-pos per tile step, used by WormBody
    const wormholeTimer = useRef(WORMHOLE_FLIP_INTERVAL);
    const lastCountdownDeci = useRef(-1);

    // Compute world centroid of current grid tile
    const getWorldPos = (p) => new THREE.Vector3(
        ...getStickerWorldPos(p.x, p.y, p.z, p.dirKey, size, 0)
    );

    // Jump offset height at current jumpT
    const jumpLift = () => isJumping.current
        ? Math.sin(jumpT.current * Math.PI) * JUMP_HEIGHT
        : 0;

    const applyOrbPickupGrowth = () => {
        tailLength.current = Math.min(tailLength.current + ORB_SEGMENT_GROWTH, MAX_TAIL);
        const orbCountOnWorm = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
        useGameStore.getState().setWormBodyTiles(orbCountOnWorm);
    };

    const spawnWormholePair = () => {
        const tile = randomUnflippedTile(cubies, size, [pos.current]);
        if (!tile) return;
        useGameStore.setState((state) => {
            const mm = buildManifoldGridMap(state.cubies, size);
            return {
                cubies: flipStickerPair(state.cubies, size, tile.x, tile.y, tile.z, tile.dirKey, mm)
            };
        });
    };

    // ── Per-frame simulation ──────────────────────────────────────────────────
    const tick = useCallback((delta) => {
        const STEP_SEC = 1.0 / wormSpeed;

        wormholeTimer.current -= delta;
        if (wormholeTimer.current <= 0) {
            spawnWormholePair();
            wormholeTimer.current = WORMHOLE_FLIP_INTERVAL;
        }
        const countdown = Math.max(0, Math.ceil(wormholeTimer.current * 10) / 10);
        const countdownDeci = Math.round(countdown * 10);
        if (countdownDeci !== lastCountdownDeci.current) {
            lastCountdownDeci.current = countdownDeci;
            useGameStore.getState().setWormholeCountdown(countdown);
        }

        // Always advance jump
        if (isJumping.current) {
            jumpT.current += delta * JUMP_SPEED;
            if (jumpT.current >= 1) {
                jumpT.current = 0;
                isJumping.current = false;
            }
        }

        if (phase.current === 'crawling') {
            // Apply pending turn — RELATIVE to current heading
            if (pendingTurn.current) {
                const t = pendingTurn.current;
                if (t === 'left' || t === 'right') {
                    moveDir.current = turnWorm(moveDir.current, t);
                }
                if (t === 'down') moveDir.current = turnWorm(turnWorm(moveDir.current, 'left'), 'left');
                if (t === 'jump') { isJumping.current = true; jumpT.current = 0.001; }
                pendingTurn.current = null;
            }

            // Advance interpolation
            if (interpT.current < 1) {
                interpT.current = Math.min(1, interpT.current + delta / STEP_SEC);
            }

            // --- Continuous path recording for contiguous touching clones ---
            const pWorld = prevWorldPos.current;
            const cWorld = curWorldPos.current ?? getWorldPos(pos.current);

            // Function to perfectly mathematically evaluate the worm's ground position and normal at ANY timeframe
            const evaluatePosAndNormal = (tValue) => {
                let hPos = cWorld.clone();
                let cNorm = FACE_NORMALS[pos.current.dirKey] ?? new THREE.Vector3(0, 0, 1);

                if (pWorld && tValue < 1) {
                    if (crossingCorner.current) {
                        const oldDirKey = prevDirKey.current;
                        const newDirKey = pos.current.dirKey;
                        const oldNormal = FACE_NORMALS[oldDirKey];
                        const newNormal = FACE_NORMALS[newDirKey];
                        const cornerVertex = pWorld.clone().addScaledVector(newNormal, 0.52);

                        if (tValue < 0.45) {
                            hPos = pWorld.clone().lerp(cornerVertex, tValue / 0.45);
                            cNorm = oldNormal.clone();
                        } else if (tValue > 0.55) {
                            hPos = cornerVertex.clone().lerp(cWorld, (tValue - 0.55) / 0.45);
                            cNorm = newNormal.clone();
                        } else {
                            hPos = cornerVertex.clone();
                            cNorm = new THREE.Vector3().lerpVectors(oldNormal, newNormal, (tValue - 0.45) / 0.10).normalize();
                        }
                    } else {
                        hPos = pWorld.clone().lerp(cWorld, tValue);
                    }
                }
                return { hPos, cNorm };
            };

            const currentEval = evaluatePosAndNormal(interpT.current);
            headInterpPos.current.copy(currentEval.hPos);
            currentNormal.current.copy(currentEval.cNorm);

            // Back-fill step history so it is completely framerate independent
            // If the game lags and skips 0.3 seconds, this perfectly reconstructs the 15 missing physics frames along the true 3D edge curve
            while (lastRecordedT.current <= interpT.current) {
                const { hPos: ptPos, cNorm: ptNorm } = evaluatePosAndNormal(lastRecordedT.current);
                const ptJump = isJumping.current ? Math.sin(jumpT.current * Math.PI) * 0.55 : 0;
                const ptLifted = ptPos.clone().addScaledVector(ptNorm, WORM_LIFT + ptJump);

                stepHistory.current.unshift({ pos: ptLifted, normal: ptNorm });
                lastRecordedT.current += 0.02; // A guaranteed resolution of 50 mathematical sub-steps per tile traverse
            }
            if (stepHistory.current.length > MAX_TAIL * STEPS_PER_TILE) {
                stepHistory.current.length = MAX_TAIL * STEPS_PER_TILE;
            }
            // -----------------------------------------------------------

            stepAcc.current += delta;
            // When navigating a corner, traversing double the distance means we should theoretically 
            // give it more time so the speed looks constant, but the Bezier arc covers it nicely.
            if (stepAcc.current >= STEP_SEC) {
                stepAcc.current -= STEP_SEC;
                interpT.current = 0;
                lastRecordedT.current = 0;
                prevWorldPos.current = getWorldPos(pos.current);
                prevDirKey.current = pos.current.dirKey;

                const oldDirKey = pos.current.dirKey;
                const next = getNextSurfacePosition(pos.current, moveDir.current, size);

                // We clear the corner navigation flag unless we're about to cross one right now
                crossingCorner.current = false;

                if (next) {
                    const crossedFace = next.dirKey !== oldDirKey;
                    pos.current = { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey };
                    if (next.moveDir) moveDir.current = next.moveDir;

                    if (crossedFace) {
                        crossingCorner.current = true;
                    }
                } else {
                    moveDir.current = turnWorm(turnWorm(moveDir.current, 'left'), 'left');
                }

                // Immediately update curWorldPos so the interpolation target is correct
                curWorldPos.current = getWorldPos(pos.current);

                // Powerup collision
                const { x, y, z, dirKey } = pos.current;
                const puIdx = powerupsRef.current.findIndex(p => p.x === x && p.y === y && p.z === z && p.dirKey === dirKey);
                if (puIdx !== -1) {
                    applyOrbPickupGrowth();
                    const newPowerup = { ...randomFreeTile(size, [...powerupsRef.current, pos.current]), type: 'apple' };
                    const next = [...powerupsRef.current];
                    next[puIdx] = newPowerup;
                    powerupsRef.current = next;
                    useGameStore.getState().setWormPowerups(next);
                }

                // Flipped tile detection
                const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                const isFlipped = !!(sticker && sticker.curr !== sticker.orig);
                onFlippedTile.current = isFlipped;

                // Flipped tiles remain active wormholes until the player deliberately jumps to enter.

                if (isFlipped !== lastFlippedRef.current) {
                    lastFlippedRef.current = isFlipped;
                    useGameStore.getState().setWormOnFlippedTile(isFlipped);
                }
            }
        } else if (phase.current === 'entering') {
            tunnelProgress.current += delta * 2.5;
            if (tunnelProgress.current >= 1) {
                tunnelProgress.current = 0;
                phase.current = 'tunnel';
                useGameStore.getState().setWormPhase('tunnel');
            }
        } else if (phase.current === 'tunnel') {
            tunnelProgress.current += delta * 0.65;
            if (tunnelProgress.current >= 1) {
                tunnelProgress.current = 0;
                phase.current = 'exiting';
                useGameStore.getState().setWormPhase('exiting');
                if (activeTunnel.current) {
                    const ex = activeTunnel.current.exit;
                    pos.current = { x: ex.x, y: ex.y, z: ex.z, dirKey: ex.dirKey };
                    curWorldPos.current = getWorldPos(pos.current);
                }
            }
        } else if (phase.current === 'exiting') {
            tunnelProgress.current += delta * 2.0;
            if (tunnelProgress.current >= 1) {
                tunnelProgress.current = 0;
                activeTunnel.current = null;
                phase.current = 'crawling';
                useGameStore.getState().setWormPhase('crawling');
                onFlippedTile.current = false;
                lastFlippedRef.current = false;
                useGameStore.getState().setWormOnFlippedTile(false);
                healedRef.current += 1;
                useGameStore.getState().setWormHealedCount(healedRef.current);
            }
        }
    }, [size, cubies, wormSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Enter portal ─────────────────────────────────────────────────────────
    const enterPortal = useCallback(() => {
        if (phase.current !== 'crawling' || !onFlippedTile.current) return false;
        const tunnels = getActiveTunnels(cubies, size);
        const { x, y, z, dirKey } = pos.current;
        const tunnel = tunnels.find(t =>
            t.entry.x === x && t.entry.y === y &&
            t.entry.z === z && t.entry.dirKey === dirKey
        ) || tunnels.find(t =>
            t.exit.x === x && t.exit.y === y &&
            t.exit.z === z && t.exit.dirKey === dirKey
        );
        if (!tunnel) return false;
        if (tunnel.exit.x === x && tunnel.exit.y === y && tunnel.exit.z === z) {
            activeTunnel.current = { ...tunnel, entry: tunnel.exit, exit: tunnel.entry };
        } else {
            activeTunnel.current = tunnel;
        }
        tunnelProgress.current = 0;
        phase.current = 'entering';
        useGameStore.getState().setWormPhase('entering');
        return true;
    }, [cubies, size]);

    const queueTurn = useCallback((dir) => { pendingTurn.current = dir; }, []);

    // Spawn initial powerups once on mount
    useEffect(() => {
        const initial = [];
        const startPos = INITIAL_POS(size);
        for (let i = 0; i < POWERUP_COUNT; i++) {
            initial.push({ ...randomFreeTile(size, [...initial, startPos]), type: 'apple' });
        }
        powerupsRef.current = initial;
        useGameStore.getState().setWormPowerups(initial);
        useGameStore.getState().setWormBodyTiles(0);
        useGameStore.getState().setWormholeCountdown(WORMHOLE_FLIP_INTERVAL);
        wormholeTimer.current = WORMHOLE_FLIP_INTERVAL;
        lastCountdownDeci.current = Math.round(WORMHOLE_FLIP_INTERVAL * 10);
    }, [size]);

    return {
        pos, moveDir, phase, tunnelProgress, activeTunnel, onFlippedTile,
        interpT, prevWorldPos, curWorldPos, jumpT, isJumping, jumpLift,
        headInterpPos, currentNormal,
        tailLength, stepHistory, tick, enterPortal, queueTurn
    };
}

// ─── Chase Camera (dynamic zoom based on tail length) ───────────────────────
function WormChaseCamera({ worm, size }) {
    const { camera, size: viewportSize } = useThree();
    const camPosRef = useRef(new THREE.Vector3(0, 6, 10));
    const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
    const zoomExtraRef = useRef(0);   // burst zoom accumulated
    const prevTailLen = useRef(BASE_TAIL_LENGTH);   // detect new parity pickups

    useFrame((_, delta) => {
        const phase = worm.phase.current;
        const tailLen = worm.tailLength.current;
        const viewportAspect = viewportSize.width / Math.max(1, viewportSize.height);

        // Use a continuous portrait factor so camera framing doesn't jump at aspect=1.
        const portraitFactor = THREE.MathUtils.clamp((1 - viewportAspect) / 0.45, 0, 1);
        const targetFov = THREE.MathUtils.lerp(50, 62, portraitFactor);
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

        // Permanent zoom grows gently with snake length so you always see the whole cube + worm.
        // Cap is size-relative: a full-coverage snake should just fit in frame.
        const MAX_PERM_ZOOM = size * 2.6;
        const permZoom = Math.min(tailLen * 0.028, MAX_PERM_ZOOM);
        const aspectZoomBoost = THREE.MathUtils.lerp(0, 2.2, portraitFactor);
        const extraZoom = permZoom + Math.min(zoomExtraRef.current, MAX_EXTRA_ZOOM);
        const camHeight = CAM_HEIGHT_BASE + extraZoom + aspectZoomBoost;
        const camBack = CAM_BACK_BASE + extraZoom * 0.8 + aspectZoomBoost * 0.9;

        if (phase === 'crawling' || phase === 'entering' || phase === 'exiting') {
            // Smooth interpolated worm world position
            const wormWorld = worm.headInterpPos.current.clone();
            const { dirKey } = worm.pos.current;
            const normal = worm.currentNormal.current.clone();
            const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 0, -1];
            const forward = new THREE.Vector3(...fwdArr);

            // Camera position: above worm (along face normal) + behind (backward along forward).
            // This is correct for all faces and never cuts through the cube.
            const targetCam = wormWorld.clone()
                .addScaledVector(normal, camHeight)
                .addScaledVector(forward, -camBack);
            const targetLook = wormWorld.clone().addScaledVector(forward, LOOK_AHEAD);

            let liftMult = 1;
            if (phase === 'entering') liftMult = 1 - worm.tunnelProgress.current;
            if (phase === 'exiting') liftMult = worm.tunnelProgress.current;
            targetCam.addScaledVector(normal, (liftMult - 1) * camHeight * 0.4);

            // Camera UP: world-Y for side faces (no roll).
            // For PY/NY the normal is vertical so we use the face-local 'up' direction
            // which is perpendicular to both the normal and the movement vector.
            const absNormalY = Math.abs(normal.y);
            let cameraUp;
            if (absNormalY > 0.8) {
                // Top or bottom face — use face-local 'up' as camera up (avoids gimbal lock)
                const upArr = DIR_FORWARD[dirKey]?.['up'] ?? [0, 0, -1];
                cameraUp = new THREE.Vector3(...upArr);
            } else {
                cameraUp = new THREE.Vector3(0, 1, 0);
            }

            const alpha = Math.min(1, CAM_LERP * delta);
            camPosRef.current.lerp(targetCam, alpha);
            lookAtRef.current.lerp(targetLook, alpha);
            camera.position.copy(camPosRef.current);
            camera.up.copy(cameraUp);
            camera.lookAt(lookAtRef.current);



        } else if (phase === 'tunnel' && worm.activeTunnel.current) {
            const t = worm.tunnelProgress.current;
            const t1 = Math.min(t + 0.05, 1);
            const camPt = getTunnelWorldPos(worm.activeTunnel.current, t, size);
            const lookPt = getTunnelWorldPos(worm.activeTunnel.current, t1, size);

            const exitNormal = FACE_NORMALS[worm.activeTunnel.current.exit.dirKey] ?? new THREE.Vector3(0, 1, 0);
            const entryNormal = FACE_NORMALS[worm.activeTunnel.current.entry.dirKey] ?? new THREE.Vector3(0, 1, 0);
            const upVec = entryNormal.clone().lerp(exitNormal, t).normalize();

            const alpha = Math.min(1, CAM_LERP * delta);
            camPosRef.current.lerp(new THREE.Vector3(...camPt), alpha * 2);
            lookAtRef.current.lerp(new THREE.Vector3(...lookPt), alpha * 2);
            camera.position.copy(camPosRef.current);
            camera.up.copy(upVec);
            camera.lookAt(lookAtRef.current);
        }
    });

    return null;
}

// ─── Swipe Controls ───────────────────────────────────────────────────────────
function WormSwipeControls({ onTurn }) {
    const touchStart = useRef(null);

    useEffect(() => {
        const onTouchStart = (e) => {
            const t = e.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
        };
        const onTouchEnd = (e) => {
            if (!touchStart.current) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStart.current.x;
            const dy = t.clientY - touchStart.current.y;
            touchStart.current = null;

            const adx = Math.abs(dx), ady = Math.abs(dy);
            if (adx < 12 && ady < 12) return;

            if (adx > ady) {
                onTurn(dx > 0 ? 'right' : 'left');
            }
        };
        const onKey = (e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); onTurn('left'); }
            if (e.key === 'ArrowRight') { e.preventDefault(); onTurn('right'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onTurn('down'); }
            if (e.key === ' ') {
                e.preventDefault();
                const entered = useGameStore.getState()._wormEnterPortal?.() ?? false;
                if (!entered) onTurn('jump');
            }
        };
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('keydown', onKey, { capture: true });
        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('keydown', onKey, { capture: true });
        };
    }, [onTurn]);

    return null;
}

// ─── Worm Body (head = smooth lerp; body = per-step tile history) ─────────────
const _wormDummy = new THREE.Object3D();

function WormBody({ worm }) {
    const meshRef = useRef();

    useFrame((state) => {
        // Pull mathematically exact physics track for the head including the edge rolling arc
        const headPos = worm.headInterpPos.current.clone();
        const normal = worm.currentNormal.current.clone();

        const currentJumpVal = worm.isJumping.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
        headPos.addScaledVector(normal, WORM_LIFT + currentJumpVal);

        const mesh = meshRef.current;
        if (!mesh) return;

        const tLen = worm.tailLength.current;
        const steps = worm.stepHistory.current;
        const time = state.clock.getElapsedTime();

        // Treat the head and all history points as a single continuous curve
        const pathPoints = [{ pos: headPos, normal: normal }, ...steps];
        let walkIndex = 0;
        let cumulativeDist = 0;

        for (let i = 0; i < MAX_TAIL; i++) {
            if (i >= tLen) {
                _wormDummy.scale.setScalar(0);
                _wormDummy.updateMatrix();
                mesh.setMatrixAt(i, _wormDummy.matrix);
                continue;
            }
            const fade = 1 - i / tLen;

            if (i === 0) {
                // Head
                _wormDummy.position.copy(headPos);
                _wormDummy.scale.setScalar(0.07);
            } else {
                // Clones — parameterically walk backwards along the curve to exact target distance
                const targetDist = i * 0.14; // Diameter of scale 0.07 sphere
                let clonePos = headPos.clone();
                let cloneNormal = normal;
                let foundPosition = false;

                while (walkIndex < pathPoints.length - 1) {
                    const ptA = pathPoints[walkIndex];
                    const ptB = pathPoints[walkIndex + 1];
                    const distToNext = ptA.pos.distanceTo(ptB.pos);

                    if (cumulativeDist + distToNext >= targetDist) {
                        // Found the bracket on the curve! Interpolate exact point.
                        const t = distToNext > 0 ? (targetDist - cumulativeDist) / distToNext : 0;
                        clonePos = ptA.pos.clone().lerp(ptB.pos, t);
                        cloneNormal = ptA.normal.clone().lerp(ptB.normal, t).normalize();

                        // Calculate forward/side vector for the wiggle at this exact localized point
                        const segForward = ptA.pos.clone().sub(ptB.pos).normalize();
                        const sideVec = new THREE.Vector3().crossVectors(cloneNormal, segForward).normalize();

                        const wiggleAmp = 0.08 * Math.sin(fade * Math.PI);
                        const wigglePhase = i * 0.8 - time * 6.0;
                        const wiggleOffset = Math.sin(wigglePhase) * wiggleAmp;

                        clonePos.addScaledVector(sideVec, wiggleOffset);
                        foundPosition = true;
                        break;
                    }
                    cumulativeDist += distToNext;
                    walkIndex++;
                }

                // If the track runs out (just spawned and moving), freeze at the last known point.
                if (!foundPosition && pathPoints.length > 0) {
                    clonePos = pathPoints[pathPoints.length - 1].pos.clone();
                }

                _wormDummy.position.copy(clonePos);
                // It's a true clone, so KEEP THE SCALE EXACTLY LIKE THE HEAD
                _wormDummy.scale.setScalar(0.07);
            }

            _wormDummy.updateMatrix();
            mesh.setMatrixAt(i, _wormDummy.matrix);
            mesh.setColorAt(i, new THREE.Color().setHSL(
                0.38 - i * 0.005,
                1,
                0.4 + fade * 0.3
            ));
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial emissive="#33ff66" emissiveIntensity={0.8} />
        </instancedMesh>
    );
}

// ─── Portal indicator (glows when on a flipped tile) ─────────────────────────
function PortalGlow({ worm, size }) {
    const meshRef = useRef();
    useFrame((_, _delta) => {
        if (!meshRef.current) return;
        const { x, y, z, dirKey } = worm.pos.current;
        const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
        const n = FACE_NORMALS[dirKey] ?? new THREE.Vector3(0, 0, 1);
        const p = new THREE.Vector3(...wp).addScaledVector(n, 0.2);
        meshRef.current.position.copy(p);
        meshRef.current.material.opacity = worm.onFlippedTile.current
            ? 0.3 + Math.sin(Date.now() * 0.006) * 0.2
            : 0;
    });

    return (
        <mesh ref={meshRef}>
            <ringGeometry args={[0.4, 0.7, 32]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
    );
}

// ─── Worm Face (eyes + smile) ─────────────────────────────────────────────────
const _faceRight = new THREE.Vector3();

function WormFace({ worm, size }) {
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const smile0 = useRef(), smile1 = useRef(), smile2 = useRef();
    const smileRefs = [smile0, smile1, smile2];

    useFrame(() => {
        const { dirKey } = worm.pos.current;
        const normal = FACE_NORMALS[dirKey] ?? new THREE.Vector3(0, 0, 1);
        const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
        const forward = new THREE.Vector3(...fwdArr);

        // Rightward axis in the face plane
        _faceRight.crossVectors(forward, normal).normalize();

        // Interpolated head world pos
        const prev = worm.prevWorldPos.current;
        const cur = worm.curWorldPos.current ?? new THREE.Vector3(
            ...getStickerWorldPos(worm.pos.current.x, worm.pos.current.y,
                worm.pos.current.z, dirKey, size, 0)
        );
        let headPos;
        if (prev && worm.interpT.current < 1) {
            headPos = prev.clone().lerp(cur, worm.interpT.current);
        } else {
            headPos = cur.clone();
        }
        const jumpLiftVal = worm.isJumping.current
            ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
        headPos.addScaledVector(normal, WORM_LIFT + jumpLiftVal + 0.09);

        const S = 0.022;
        if (leftEyeRef.current) {
            leftEyeRef.current.position.copy(headPos)
                .addScaledVector(_faceRight, 0.028)
                .addScaledVector(forward, 0.025);
            leftEyeRef.current.scale.setScalar(S);
        }
        if (rightEyeRef.current) {
            rightEyeRef.current.position.copy(headPos)
                .addScaledVector(_faceRight, -0.028)
                .addScaledVector(forward, 0.025);
            rightEyeRef.current.scale.setScalar(S);
        }
        const smileOffsets = [-0.022, 0, 0.022];
        smileRefs.forEach((ref, i) => {
            if (!ref.current) return;
            const xo = smileOffsets[i];
            const yo = i === 1 ? -0.028 : -0.022;
            ref.current.position.copy(headPos)
                .addScaledVector(_faceRight, xo)
                .addScaledVector(normal, yo * 0.3)
                .addScaledVector(forward, 0.025);
            ref.current.scale.setScalar(S * 0.55);
        });
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
        </>
    );
}

// ─── Powerup Orbs ─────────────────────────────────────────────────────────────
function PowerupOrbs({ size }) {
    const groupRef = useRef();

    useFrame(() => {
        const powerups = useGameStore.getState().wormPowerups;
        if (!groupRef.current) return;
        const meshes = groupRef.current.children;
        const t = Date.now() * 0.003;

        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            const p = powerups[i];
            if (!p || !mesh) { if (mesh) mesh.visible = false; continue; }
            const wp = getStickerWorldPos(p.x, p.y, p.z, p.dirKey, size, 0);
            const n = FACE_NORMALS[p.dirKey] ?? new THREE.Vector3(0, 0, 1);
            const phase = t + i * 1.5;
            const lift = 0.18 + Math.sin(phase) * 0.05;
            mesh.position.set(wp[0] + n.x * lift, wp[1] + n.y * lift, wp[2] + n.z * lift);
            mesh.scale.setScalar(0.09 + Math.sin(phase) * 0.018);
            mesh.rotation.y = t * 0.6 + i;
            mesh.visible = true;
        }
    });

    return (
        <group ref={groupRef}>
            {Array.from({ length: POWERUP_COUNT }).map((_, i) => (
                <mesh key={i}>
                    <icosahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color="#22ff88" emissive="#22ff88" emissiveIntensity={1.2} />
                </mesh>
            ))}
        </group>
    );
}


function WormInteriorGlass({ worm, size }) {
    const glassRef = useRef();

    useFrame(({ clock }) => {
        if (!glassRef.current) return;

        const phase = worm.phase.current;
        const isTunnelPhase = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const tunnelBoost = isTunnelPhase ? 1 : 0;
        const pulse = (Math.sin(clock.elapsedTime * 4.2) + 1) * 0.5;
        const transmission = THREE.MathUtils.lerp(GLASS_MIN_TRANSMISSION, GLASS_MAX_TRANSMISSION, tunnelBoost * 0.7 + pulse * 0.3);
        const opacity = THREE.MathUtils.lerp(GLASS_MIN_OPACITY, GLASS_MAX_OPACITY, tunnelBoost * 0.85 + pulse * 0.15);

        glassRef.current.transmission = transmission;
        glassRef.current.opacity = opacity;
        glassRef.current.emissiveIntensity = tunnelBoost * 0.35 + pulse * 0.08;
    });

    // Keep a thin margin from outer stickers so we read it as an interior shell.
    const innerSize = Math.max(0.8, size - 1.1);

    return (
        <mesh>
            <boxGeometry args={[innerSize, innerSize, innerSize]} />
            <meshPhysicalMaterial
                ref={glassRef}
                color="#b8f6ff"
                emissive="#4ccfe6"
                emissiveIntensity={0.06}
                roughness={0.06}
                metalness={0.02}
                transmission={GLASS_MIN_TRANSMISSION}
                thickness={1.2}
                ior={1.23}
                transparent
                opacity={GLASS_MIN_OPACITY}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// ─── Main exported wrapper ────────────────────────────────────────────────────
export function HealerWormMode3DWrapper({ cubies, size, _explosionFactor, _animState, _onRotate, _onHeal }) {
    const worm = useWormCrawler(size, cubies);

    useEffect(() => {
        useGameStore.setState({
            _wormEnterPortal: worm.enterPortal,
            _wormTurn: worm.queueTurn,
        });
        return () => {
            useGameStore.setState({ _wormEnterPortal: null, _wormTurn: null });
        };
    }, [worm.enterPortal, worm.queueTurn]);

    useFrame((_, delta) => {
        worm.tick(delta);
    });

    return (
        <>
            <WormChaseCamera worm={worm} size={size} />
            <WormSwipeControls onTurn={worm.queueTurn} />
            <WormInteriorGlass worm={worm} size={size} />
            <WormBody worm={worm} size={size} />
            <WormFace worm={worm} size={size} />
            <PortalGlow worm={worm} size={size} />
            <PowerupOrbs size={size} />
        </>
    );
}
