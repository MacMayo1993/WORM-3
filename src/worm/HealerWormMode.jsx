// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — complete rewrite.
// Chase camera follows the worm crawling on the cube exterior.
// Disparity Level 1 runs in background. Flipped tiles are instant wormholes; jump to clear them.

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
const TUNNEL_SURF_FOV = 78;
const TUNNEL_SURF_BACK = 2.2;
const TUNNEL_SURF_UP = 0.72;
const TUNNEL_SURF_SWAY = 0.22;
const TUNNEL_SPEED_SCALE = 0.8; // 20% slower tunnel traversal

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
const DEFAULT_POWERUP_COUNT = 5;
const ORB_SEGMENT_GROWTH = 2;   // every orb adds exactly 2 visual balls
const STEPS_PER_TILE = 50;      // sub-steps recorded per tile (0.02 resolution)
const BODY_BALL_SPACING = 0.14; // matches WormBody clone spacing along the trail
const BASE_TAIL_LENGTH = 4;
const DEFAULT_WORMHOLE_FLIP_INTERVAL = 10; // seconds between guaranteed antipodal wormhole spawns
const MAX_JUMPS = 2;
const MAX_POWERUP_RENDER = 24;
const TUNNEL_TRIGGER_PROGRESS = 1 / 3;
const SELF_COLLISION_TRIGGER_PROGRESS = 0.4;

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
    const wormSpeed = useGameStore(s => s.wormSpeed ?? 1.0);
    const wormControlMode = useGameStore(s => s.wormControlMode ?? 'non-oriented');
    const wormRunId = useGameStore(s => s.wormRunId ?? 0);
    const wormOrbCount = useGameStore(s => s.wormOrbCount ?? DEFAULT_POWERUP_COUNT);
    const wormholeInterval = useGameStore(s => s.wormholeInterval ?? DEFAULT_WORMHOLE_FLIP_INTERVAL);
    const healedRef = useRef(0);

    const pos = useRef(INITIAL_POS(size));
    const moveDir = useRef(INITIAL_DIR);
    const phase = useRef('crawling');
    const tunnelProgress = useRef(0);
    const activeTunnel = useRef(null);
    const prevVisualModeRef = useRef('classic');
    const stepAcc = useRef(0);
    const pendingTurns = useRef([]);
    const onFlippedTile = useRef(false);
    const lastFlippedRef = useRef(false);
    const prevDirKey = useRef(null);
    const lastRecordedT = useRef(0);
    const crossingCorner = useRef(false);
    const pendingSelfCollision = useRef(null);

    // Smooth inter-tile interpolation
    const interpT = useRef(1);          // 0→1 between prev and current tile
    const prevWorldPos = useRef(null);       // world pos of previous tile
    const curWorldPos = useRef(null);       // world pos of current tile
    const headInterpPos = useRef(new THREE.Vector3());
    const currentNormal = useRef(new THREE.Vector3(0, 0, 1));

    // Jump state
    const jumpT = useRef(0);            // 0 = grounded, >0 = in air
    const isJumping = useRef(false);
    const jumpCount = useRef(0);
    const pendingTunnelTrigger = useRef(null);
    const JUMP_HEIGHT = 1.5;   // tall arc — astronaut bounding in low gravity
    const JUMP_TILE_SPAN = 1;  // keep jump distance fixed to one traversed tile at any speed setting

    // Growing tail + powerups
    const tailLength = useRef(BASE_TAIL_LENGTH);
    const powerupsRef = useRef([]);  // local fast-access copy of wormPowerups
    const stepHistory = useRef([]);  // one world-pos per tile step, used by WormBody
    const wormholeTimer = useRef(DEFAULT_WORMHOLE_FLIP_INTERVAL);
    const lastCountdownDeci = useRef(-1);
    const alive = useRef(true);
    const tileTrail = useRef([]);
    const deathMenuTimer = useRef(null);
    // Cached tunnel list — rebuilt whenever cubies change to avoid redundant getActiveTunnels calls
    const tunnelCacheRef = useRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { tunnelCacheRef.current = getActiveTunnels(cubies, size); }, [cubies, size]);

    // Compute world centroid of current grid tile
    const getWorldPos = (p) => new THREE.Vector3(
        ...getStickerWorldPos(p.x, p.y, p.z, p.dirKey, size, 0)
    );

    // Jump offset height at current jumpT
    const jumpLift = () => isJumping.current
        ? Math.sin(jumpT.current * Math.PI) * JUMP_HEIGHT
        : 0;

    const startJump = useCallback(() => {
        if (jumpCount.current >= MAX_JUMPS) return;
        isJumping.current = true;
        jumpT.current = 0.001;
        jumpCount.current += 1;
        // If the player jumps early on a flipped tile, don't auto-enter the tunnel.
        pendingTunnelTrigger.current = null;
    }, []);

    const beginTunnelTransition = useCallback((x, y, z, dirKey) => {
        // Use cached tunnels (built when cubies change) instead of rebuilding every entry
        const tunnels = tunnelCacheRef.current ?? getActiveTunnels(cubies, size);
        const tunnel = tunnels.find(t =>
            t.entry.x === x && t.entry.y === y &&
            t.entry.z === z && t.entry.dirKey === dirKey
        ) || tunnels.find(t =>
            t.exit.x === x && t.exit.y === y &&
            t.exit.z === z && t.exit.dirKey === dirKey
        );

        if (!tunnel) return;

        if (tunnel.exit.x === x && tunnel.exit.y === y && tunnel.exit.z === z) {
            activeTunnel.current = { ...tunnel, entry: tunnel.exit, exit: tunnel.entry };
        } else {
            activeTunnel.current = tunnel;
        }

        pendingTunnelTrigger.current = null;
        tunnelProgress.current = 0;
        phase.current = 'entering';
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        const prevVisualMode = useGameStore.getState().visualMode;
        prevVisualModeRef.current = prevVisualMode;
        useGameStore.setState({ wormPhase: 'entering', wormOnFlippedTile: false, visualMode: 'glass' });
    }, [cubies, size]);

    const tileKey = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;

    const killWorm = (details = null) => {
        if (!alive.current) return;
        alive.current = false;
        phase.current = 'dead';

        if (deathMenuTimer.current) {
            clearTimeout(deathMenuTimer.current);
            deathMenuTimer.current = null;
        }

        useGameStore.setState({
            wormPhase: 'dead',
            wormOnFlippedTile: false,
            wormAlive: false,
            showWormDeathMenu: false,
            wormDeathDetails: details,
        });

        // Let death state land first, then reveal menu for clearer sequencing.
        deathMenuTimer.current = setTimeout(() => {
            useGameStore.setState({ showWormDeathMenu: true });
            deathMenuTimer.current = null;
        }, 520);
    };

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

        if (!alive.current) return;

        wormholeTimer.current -= delta;
        if (wormholeTimer.current <= 0) {
            spawnWormholePair();
            wormholeTimer.current = wormholeInterval;
        }
        const countdown = Math.max(0, Math.ceil(wormholeTimer.current * 10) / 10);
        const countdownDeci = Math.round(countdown * 10);
        if (countdownDeci !== lastCountdownDeci.current) {
            lastCountdownDeci.current = countdownDeci;
            useGameStore.getState().setWormholeCountdown(countdown);
        }

        // Always advance jump
        if (isJumping.current) {
            // Tie jump progress to tile-traverse progress so speed slider never changes jump distance.
            jumpT.current += (delta / STEP_SEC) / JUMP_TILE_SPAN;
            if (jumpT.current >= 1) {
                jumpT.current = 0;
                isJumping.current = false;
                jumpCount.current = 0;
            }
        }

        if (phase.current === 'crawling') {
            // Apply pending turn — RELATIVE to current heading
            if (pendingTurns.current.length > 0) {
                const t = pendingTurns.current.shift();
                if (t === 'jump') {
                    startJump();
                } else if (wormControlMode === 'oriented') {
                    if (t === 'up' || t === 'down' || t === 'left' || t === 'right') {
                        moveDir.current = t;
                    }
                } else {
                    if (t === 'left' || t === 'right') {
                        moveDir.current = turnWorm(moveDir.current, t);
                    }
                    if (t === 'down') moveDir.current = turnWorm(turnWorm(moveDir.current, 'left'), 'left');
                }
            }

            // Advance interpolation
            if (interpT.current < 1) {
                interpT.current = Math.min(1, interpT.current + delta / STEP_SEC);
            }

            if (pendingSelfCollision.current) {
                if (isJumping.current) {
                    // Allow jumping over your own body tile before impact threshold.
                    pendingSelfCollision.current = null;
                } else if (interpT.current >= SELF_COLLISION_TRIGGER_PROGRESS) {
                    killWorm({
                        reason: 'self-collision',
                        progress: Number(interpT.current.toFixed(2)),
                        headTile: tileKey(pos.current),
                        collisionTile: pendingSelfCollision.current?.key ?? null,
                    });
                    return;
                }
            }

            if (pendingTunnelTrigger.current) {
                const { x, y, z, dirKey } = pendingTunnelTrigger.current;
                if (interpT.current >= TUNNEL_TRIGGER_PROGRESS && !isJumping.current) {
                    beginTunnelTransition(x, y, z, dirKey);
                }
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
                const ptJump = isJumping.current ? Math.sin(jumpT.current * Math.PI) * JUMP_HEIGHT : 0;
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
                    const nextPos = { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey };
                    const nextKey = tileKey(nextPos);
                    // tailLength is measured in visual balls, not tiles.
                    // Convert to approximate occupied tile count so collision checks align with what players see.
                    const occupiedTiles = Math.max(1, Math.ceil((tailLength.current * BODY_BALL_SPACING) / 1.0));
                    const bodyTilesBehindHead = Math.max(0, occupiedTiles - 1);
                    const bodyTrail = tileTrail.current.slice(1, 1 + bodyTilesBehindHead);
                    const selfHit = bodyTrail.includes(nextKey);
                    if (selfHit) {
                        // Defer self-hit until we've penetrated the tile by 40%.
                        // This gives players a short reaction window to jump over their body.
                        pendingSelfCollision.current = { key: nextKey };
                    }

                    pos.current = nextPos;
                    tileTrail.current.unshift(nextKey);
                    if (tileTrail.current.length > MAX_TAIL) tileTrail.current.length = MAX_TAIL;
                    if (next.moveDir) moveDir.current = next.moveDir;

                    if (crossedFace) {
                        crossingCorner.current = true;
                    }

                    pendingTunnelTrigger.current = null;
                    if (!selfHit) {
                        pendingSelfCollision.current = null;
                    }
                } else {
                    moveDir.current = turnWorm(turnWorm(moveDir.current, 'left'), 'left');
                    pendingTunnelTrigger.current = null;
                    pendingSelfCollision.current = null;
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

                // Flipped tiles are instant wormholes unless the player is currently jumping over them.

                if (isFlipped !== lastFlippedRef.current) {
                    lastFlippedRef.current = isFlipped;
                    useGameStore.getState().setWormOnFlippedTile(isFlipped);
                }

                if (isFlipped) {
                    pendingTunnelTrigger.current = { x, y, z, dirKey };
                }
            }
        } else if (phase.current === 'entering') {
            tunnelProgress.current += delta * (2.5 * TUNNEL_SPEED_SCALE);
            if (tunnelProgress.current >= 1) {
                tunnelProgress.current = 0;
                phase.current = 'tunnel';
                useGameStore.getState().setWormPhase('tunnel');
            }
        } else if (phase.current === 'tunnel') {
            tunnelProgress.current += delta * (0.65 * TUNNEL_SPEED_SCALE);
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
            tunnelProgress.current += delta * (2.0 * TUNNEL_SPEED_SCALE);
            if (tunnelProgress.current >= 1) {
                tunnelProgress.current = 0;
                activeTunnel.current = null;
                phase.current = 'crawling';
                useGameStore.setState({ wormPhase: 'crawling', wormOnFlippedTile: false, visualMode: prevVisualModeRef.current ?? 'classic' });
                onFlippedTile.current = false;
                lastFlippedRef.current = false;
                healedRef.current += 1;
                useGameStore.getState().setWormHealedCount(healedRef.current);
            }
        }
    }, [size, cubies, wormSpeed, wormControlMode, wormholeInterval]); // eslint-disable-line react-hooks/exhaustive-deps



    const queueTurn = useCallback((dir) => {
        const q = pendingTurns.current;
        if (q.length >= 3) q.shift();
        if (q[q.length - 1] !== dir) q.push(dir);
    }, []);

    // Spawn initial powerups once on mount
    useEffect(() => {
        const initial = [];
        const startPos = INITIAL_POS(size);
        for (let i = 0; i < wormOrbCount; i++) {
            initial.push({ ...randomFreeTile(size, [...initial, startPos]), type: 'apple' });
        }

        // Full local-state reset for new runs (retry/new setup), not only on size changes.
        pos.current = startPos;
        moveDir.current = INITIAL_DIR;
        phase.current = 'crawling';
        tunnelProgress.current = 0;
        activeTunnel.current = null;
        stepAcc.current = 0;
        pendingTurns.current = [];
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        prevDirKey.current = null;
        crossingCorner.current = false;
        interpT.current = 1;
        prevWorldPos.current = null;
        curWorldPos.current = getWorldPos(startPos);
        headInterpPos.current.copy(curWorldPos.current);
        currentNormal.current.copy(FACE_NORMALS[startPos.dirKey] ?? new THREE.Vector3(0, 0, 1));
        isJumping.current = false;
        jumpT.current = 0;
        jumpCount.current = 0;
        pendingTunnelTrigger.current = null;
        pendingSelfCollision.current = null;
        tailLength.current = BASE_TAIL_LENGTH;
        stepHistory.current = [];
        lastRecordedT.current = 0;
        healedRef.current = 0;

        powerupsRef.current = initial;
        alive.current = true;
        tileTrail.current = [tileKey(startPos)];
        useGameStore.setState({
            wormPowerups: initial,
            wormBodyTiles: 0,
            wormHealedCount: 0,
            wormholeCountdown: wormholeInterval,
            wormAlive: true,
            showWormDeathMenu: false,
            wormDeathDetails: null,
            wormPhase: 'crawling',
            wormOnFlippedTile: false,
        });
        wormholeTimer.current = wormholeInterval;
        lastCountdownDeci.current = Math.round(wormholeInterval * 10);
    }, [size, wormRunId, wormOrbCount, wormholeInterval]);

    useEffect(() => () => {
        if (deathMenuTimer.current) {
            clearTimeout(deathMenuTimer.current);
            deathMenuTimer.current = null;
        }
    }, []);

    return {
        pos, moveDir, phase, tunnelProgress, activeTunnel, onFlippedTile,
        interpT, prevWorldPos, curWorldPos, jumpT, isJumping, jumpLift,
        headInterpPos, currentNormal,
        tailLength, stepHistory, tick, queueTurn
    };
}

// Pre-allocated scratch vectors for WormChaseCamera — avoids per-frame allocations
const _camForward = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camWormWorld = new THREE.Vector3();
const _camNormal = new THREE.Vector3();
const _camTargetCam = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camUpVec = new THREE.Vector3();
const _camVec = new THREE.Vector3();
const _camLookVec = new THREE.Vector3();
const _camLookAheadVec = new THREE.Vector3();
const _camTunnelTangent = new THREE.Vector3();
const _camTunnelRight = new THREE.Vector3();
const _camSurfCam = new THREE.Vector3();

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
        const baseFov = THREE.MathUtils.lerp(50, 62, portraitFactor);
        const tunnelMix = phase === 'tunnel' ? 1 : (phase === 'entering' || phase === 'exiting' ? 0.35 : 0);
        const targetFov = THREE.MathUtils.lerp(baseFov, TUNNEL_SURF_FOV, tunnelMix);
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

        if (phase === 'crawling' || !worm.activeTunnel.current) {
            // Smooth interpolated worm world position (copy into scratch — no .clone())
            _camWormWorld.copy(worm.headInterpPos.current);
            const { dirKey } = worm.pos.current;
            _camNormal.copy(worm.currentNormal.current);
            const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 0, -1];
            _camForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);

            // Camera position: above worm (along face normal) + behind (backward along forward).
            _camTargetCam.copy(_camWormWorld)
                .addScaledVector(_camNormal, camHeight)
                .addScaledVector(_camForward, -camBack);
            _camTargetLook.copy(_camWormWorld).addScaledVector(_camForward, LOOK_AHEAD);

            let liftMult = 1;
            if (phase === 'entering') liftMult = 1 - worm.tunnelProgress.current;
            if (phase === 'exiting') liftMult = worm.tunnelProgress.current;
            _camTargetCam.addScaledVector(_camNormal, (liftMult - 1) * camHeight * 0.4);

            // Camera UP: world-Y for side faces (no roll).
            const absNormalY = Math.abs(_camNormal.y);
            if (absNormalY > 0.8) {
                const upArr = DIR_FORWARD[dirKey]?.['up'] ?? [0, 0, -1];
                _camUp.set(upArr[0], upArr[1], upArr[2]);
            } else {
                _camUp.set(0, 1, 0);
            }

            const alpha = Math.min(1, CAM_LERP * delta);
            camPosRef.current.lerp(_camTargetCam, alpha);
            lookAtRef.current.lerp(_camTargetLook, alpha);
            camera.position.copy(camPosRef.current);
            camera.up.copy(_camUp);
            camera.lookAt(lookAtRef.current);
        } else if ((phase === 'entering' || phase === 'tunnel' || phase === 'exiting') && worm.activeTunnel.current) {
            let t = worm.tunnelProgress.current;
            if (phase === 'entering') t *= 0.35;
            if (phase === 'exiting') t = 0.65 + (t * 0.35);
            const t1 = Math.min(t + 0.12, 1);
            const t2 = Math.min(t + 0.24, 1);
            const camPt = getTunnelWorldPos(worm.activeTunnel.current, t, size);
            const lookPt = getTunnelWorldPos(worm.activeTunnel.current, t1, size);
            const lookAheadPt = getTunnelWorldPos(worm.activeTunnel.current, t2, size);

            const exitNormal = FACE_NORMALS[worm.activeTunnel.current.exit.dirKey] ?? FACE_NORMALS.PY;
            const entryNormal = FACE_NORMALS[worm.activeTunnel.current.entry.dirKey] ?? FACE_NORMALS.PY;
            _camUpVec.lerpVectors(entryNormal, exitNormal, t).normalize();

            _camVec.set(camPt[0], camPt[1], camPt[2]);
            _camLookVec.set(lookPt[0], lookPt[1], lookPt[2]);
            _camLookAheadVec.set(lookAheadPt[0], lookAheadPt[1], lookAheadPt[2]);
            _camTunnelTangent.subVectors(_camLookVec, _camVec).normalize();
            _camTunnelRight.crossVectors(_camTunnelTangent, _camUpVec).normalize();
            const sway = Math.sin(performance.now() * 0.0045) * TUNNEL_SURF_SWAY;
            _camSurfCam.copy(_camVec)
                .addScaledVector(_camTunnelTangent, -TUNNEL_SURF_BACK)
                .addScaledVector(_camUpVec, TUNNEL_SURF_UP)
                .addScaledVector(_camTunnelRight, sway);

            const alpha = Math.min(1, CAM_LERP * delta);
            camPosRef.current.lerp(_camSurfCam, alpha * 2);
            lookAtRef.current.lerp(_camLookAheadVec, alpha * 2);
            camera.position.copy(camPosRef.current);
            camera.up.copy(_camUpVec);
            camera.lookAt(lookAtRef.current);
        }
    });

    return null;
}

// Pre-allocated scratch vectors for TunnelSurfFX sparks
const _sparkCenter = new THREE.Vector3();
const _sparkForward = new THREE.Vector3();
const _sparkUp = new THREE.Vector3();
const _sparkRight = new THREE.Vector3();

function TunnelSurfFX({ worm, size }) {
    const sparksRef = useRef([]);

    useFrame(({ clock }) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        if (!tunnel) return;

        const active = phase === 'entering' || phase === 'tunnel' || phase === 'exiting';
        const sparkMeshes = sparksRef.current;
        if (!active) {
            for (let i = 0; i < sparkMeshes.length; i++) {
                if (sparkMeshes[i]) sparkMeshes[i].visible = false;
            }
            return;
        }

        const baseT = worm.tunnelProgress.current;
        const tt = clock.elapsedTime;
        const exitNormal = FACE_NORMALS[tunnel.exit.dirKey] ?? FACE_NORMALS.PY;
        const entryNormal = FACE_NORMALS[tunnel.entry.dirKey] ?? FACE_NORMALS.PY;

        for (let i = 0; i < sparkMeshes.length; i++) {
            const mesh = sparkMeshes[i];
            if (!mesh) continue;
            const trailOffset = i * 0.06;
            const travel = (baseT + trailOffset + tt * 0.8) % 1;
            const p0 = getTunnelWorldPos(tunnel, travel, size);
            const p1 = getTunnelWorldPos(tunnel, Math.min(travel + 0.03, 1), size);
            // Reuse scratch vectors instead of allocating new ones each iteration
            _sparkCenter.set(p0[0], p0[1], p0[2]);
            _sparkForward.set(p1[0], p1[1], p1[2]).sub(_sparkCenter).normalize();
            _sparkUp.lerpVectors(entryNormal, exitNormal, travel).normalize();
            _sparkRight.crossVectors(_sparkForward, _sparkUp).normalize();

            const angle = tt * 5 + i * 0.9;
            const radius = 0.35 + Math.sin(tt * 2.4 + i) * 0.08;
            mesh.position.copy(_sparkCenter)
                .addScaledVector(_sparkRight, Math.cos(angle) * radius)
                .addScaledVector(_sparkUp, Math.sin(angle) * radius * 0.6);
            mesh.scale.setScalar(0.035 + Math.sin(tt * 8 + i * 1.3) * 0.01);
            mesh.visible = true;
            mesh.material.opacity = 0.35 + Math.sin(tt * 10 + i) * 0.25;
        }
    });

    return (
        <group>
            {Array.from({ length: 14 }).map((_, i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        sparksRef.current[i] = el;
                    }}
                >
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshBasicMaterial color="#80eaff" transparent opacity={0.4} />
                </mesh>
            ))}
        </group>
    );
}

// ─── Swipe Controls ───────────────────────────────────────────────────────────
function WormSwipeControls({ onTurn, worm }) {
    const { camera } = useThree();
    const wormControlMode = useGameStore(s => s.wormControlMode ?? 'non-oriented');
    const touchStart = useRef(null);

    const mapOrientedDirection = useCallback((inputDir) => {
        const dirKey = worm.pos.current?.dirKey;
        if (!dirKey) return inputDir;

        const faceNormal = FACE_NORMALS[dirKey] ?? new THREE.Vector3(0, 0, 1);
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        const camUp = camera.up.clone().normalize();
        const camRight = new THREE.Vector3().crossVectors(camForward, camUp).normalize();

        let desired = null;
        if (inputDir === 'up') desired = camUp;
        if (inputDir === 'down') desired = camUp.clone().multiplyScalar(-1);
        if (inputDir === 'left') desired = camRight.clone().multiplyScalar(-1);
        if (inputDir === 'right') desired = camRight;
        if (!desired) return inputDir;

        desired = desired.clone().sub(faceNormal.clone().multiplyScalar(desired.dot(faceNormal)));
        if (desired.lengthSq() < 1e-6) return inputDir;
        desired.normalize();

        const candidates = ['up', 'down', 'left', 'right'];
        let bestDir = 'up';
        let bestDot = -Infinity;
        for (const dir of candidates) {
            const vec = new THREE.Vector3(...(DIR_FORWARD[dirKey]?.[dir] ?? [0, 0, -1])).normalize();
            const d = vec.dot(desired);
            if (d > bestDot) {
                bestDot = d;
                bestDir = dir;
            }
        }

        return bestDir;
    }, [camera, worm]);

    const emitDirection = useCallback((dir) => {
        if (wormControlMode === 'oriented') {
            onTurn(mapOrientedDirection(dir));
            return;
        }
        onTurn(dir);
    }, [wormControlMode, onTurn, mapOrientedDirection]);

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
                emitDirection(dx > 0 ? 'right' : 'left');
            } else if (wormControlMode === 'oriented') {
                emitDirection(dy > 0 ? 'down' : 'up');
            } else if (dy > 0) {
                // non-oriented mode supports 180° turn via downward swipe
                emitDirection('down');
            }
        };
        const onKey = (e) => {
            if (e.repeat && e.key !== ' ') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); emitDirection('left'); }
            if (e.key === 'ArrowRight') { e.preventDefault(); emitDirection('right'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); emitDirection('down'); }
            if (e.key === 'ArrowUp' && wormControlMode === 'oriented') { e.preventDefault(); emitDirection('up'); }
            if (e.key === ' ') {
                e.preventDefault();
                onTurn('jump');
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
    }, [onTurn, emitDirection, wormControlMode]);

    return null;
}

// ─── Worm Body (head = smooth lerp; body = per-step tile history) ─────────────
const _wormDummy = new THREE.Object3D();
// Pre-allocated scratch objects — avoids per-frame GC pressure from WormBody loop
const _bodyColor = new THREE.Color();
const _bodyHeadPos = new THREE.Vector3();
const _bodyNormal = new THREE.Vector3();
const _bodyClonePos = new THREE.Vector3();
const _bodyCloneNormal = new THREE.Vector3();
const _bodySegForward = new THREE.Vector3();
const _bodySideVec = new THREE.Vector3();
// Stable path-points buffer: reused every frame to avoid spread-array allocation
const _pathPointsBuffer = [];
const _headPathPoint = { pos: _bodyHeadPos, normal: _bodyNormal };

function WormBody({ worm }) {
    const meshRef = useRef();
    const wormColor = useGameStore(s => s.wormColor ?? '#33ff66');

    useFrame((state) => {
        // Copy head/normal into scratch vectors (avoids .clone() allocation)
        _bodyHeadPos.copy(worm.headInterpPos.current);
        _bodyNormal.copy(worm.currentNormal.current);

        const currentJumpVal = worm.isJumping.current ? Math.sin(worm.jumpT.current * Math.PI) * 0.55 : 0;
        _bodyHeadPos.addScaledVector(_bodyNormal, WORM_LIFT + currentJumpVal);

        const mesh = meshRef.current;
        if (!mesh) return;

        const tLen = worm.tailLength.current;
        const steps = worm.stepHistory.current;
        const time = state.clock.getElapsedTime();

        // Rebuild path-points buffer in-place (no array allocation or spread)
        _pathPointsBuffer.length = steps.length + 1;
        _pathPointsBuffer[0] = _headPathPoint;
        for (let j = 0; j < steps.length; j++) _pathPointsBuffer[j + 1] = steps[j];

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
                _wormDummy.position.copy(_bodyHeadPos);
                _wormDummy.scale.setScalar(0.07);
            } else {
                // Clones — parameterically walk backwards along the curve to exact target distance
                const targetDist = i * 0.14; // Diameter of scale 0.07 sphere
                let foundPosition = false;

                while (walkIndex < _pathPointsBuffer.length - 1) {
                    const ptA = _pathPointsBuffer[walkIndex];
                    const ptB = _pathPointsBuffer[walkIndex + 1];
                    const distToNext = ptA.pos.distanceTo(ptB.pos);

                    if (cumulativeDist + distToNext >= targetDist) {
                        // Found the bracket on the curve! Interpolate exact point.
                        const t = distToNext > 0 ? (targetDist - cumulativeDist) / distToNext : 0;
                        // Use scratch vectors instead of .clone() to avoid GC pressure
                        _bodyClonePos.lerpVectors(ptA.pos, ptB.pos, t);
                        _bodyCloneNormal.lerpVectors(ptA.normal, ptB.normal, t).normalize();

                        // Calculate forward/side vector for the wiggle at this exact localized point
                        _bodySegForward.subVectors(ptA.pos, ptB.pos).normalize();
                        _bodySideVec.crossVectors(_bodyCloneNormal, _bodySegForward).normalize();

                        const wiggleAmp = 0.08 * Math.sin(fade * Math.PI);
                        const wigglePhase = i * 0.8 - time * 6.0;
                        _bodyClonePos.addScaledVector(_bodySideVec, Math.sin(wigglePhase) * wiggleAmp);
                        foundPosition = true;
                        break;
                    }
                    cumulativeDist += distToNext;
                    walkIndex++;
                }

                // If the track runs out (just spawned and moving), freeze at the last known point.
                if (!foundPosition && _pathPointsBuffer.length > 0) {
                    _bodyClonePos.copy(_pathPointsBuffer[_pathPointsBuffer.length - 1].pos);
                }

                _wormDummy.position.copy(_bodyClonePos);
                // It's a true clone, so KEEP THE SCALE EXACTLY LIKE THE HEAD
                _wormDummy.scale.setScalar(0.07);
            }

            _wormDummy.updateMatrix();
            mesh.setMatrixAt(i, _wormDummy.matrix);
            // Reuse pre-allocated color object — avoids 1 Color allocation per segment per frame
            mesh.setColorAt(i, _bodyColor.setHSL(0.38 - i * 0.005, 1, 0.4 + fade * 0.3));
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={wormColor} emissive={wormColor} emissiveIntensity={0.8} />
        </instancedMesh>
    );
}

// Pre-allocated scratch vector for PortalGlow
const _glowPos = new THREE.Vector3();

// ─── Portal indicator (glows when on a flipped tile) ─────────────────────────
function PortalGlow({ worm, size }) {
    const meshRef = useRef();
    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const { x, y, z, dirKey } = worm.pos.current;
        const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
        const n = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
        _glowPos.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.2);
        meshRef.current.position.copy(_glowPos);
        meshRef.current.material.opacity = worm.onFlippedTile.current
            ? 0.3 + Math.sin(clock.elapsedTime * 6) * 0.2
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
const _faceForward = new THREE.Vector3();
const _faceHeadPos = new THREE.Vector3();

function WormFace({ worm, size }) {
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const smile0 = useRef(), smile1 = useRef(), smile2 = useRef();
    const smileRefs = [smile0, smile1, smile2];

    useFrame(() => {
        const { dirKey } = worm.pos.current;
        const normal = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
        const fwdArr = DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 1, 0];
        _faceForward.set(fwdArr[0], fwdArr[1], fwdArr[2]);

        // Rightward axis in the face plane
        _faceRight.crossVectors(_faceForward, normal).normalize();

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
    const wormColor = useGameStore(s => s.wormColor ?? '#22ff88');

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
            {Array.from({ length: MAX_POWERUP_RENDER }).map((_, i) => (
                <mesh key={i}>
                    <icosahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color={wormColor} emissive={wormColor} emissiveIntensity={1.2} />
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

// ─── Wormhole portal rings — spinning neon rings at every flipped tile ────────
// Gives players a clear visual cue for all wormhole locations on the cube surface.
const _ringDummy = new THREE.Object3D();
const _ringUp = new THREE.Vector3();

function WormholeRings({ cubies, size }) {
    const meshRef = useRef();

    const flippedPositions = React.useMemo(() => {
        const result = [];
        const dirs = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cubie = cubies?.[x]?.[y]?.[z];
                    if (!cubie) continue;
                    for (const dk of dirs) {
                        const st = cubie.stickers?.[dk];
                        if (!st || st.curr === st.orig) continue;
                        const isVisible = (
                            (dk === 'PX' && x === size - 1) || (dk === 'NX' && x === 0) ||
                            (dk === 'PY' && y === size - 1) || (dk === 'NY' && y === 0) ||
                            (dk === 'PZ' && z === size - 1) || (dk === 'NZ' && z === 0)
                        );
                        if (isVisible) result.push({ x, y, z, dirKey: dk });
                    }
                }
            }
        }
        return result;
    }, [cubies, size]);

    useFrame(({ clock }) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const t = clock.elapsedTime;
        const count = flippedPositions.length;

        for (let i = 0; i < mesh.count; i++) {
            if (i >= count) {
                _ringDummy.scale.setScalar(0);
                _ringDummy.updateMatrix();
                mesh.setMatrixAt(i, _ringDummy.matrix);
                continue;
            }
            const { x, y, z, dirKey } = flippedPositions[i];
            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            const n = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;
            _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
            // Orient ring to face outward from the cube surface
            _ringUp.set(0, 1, 0);
            if (Math.abs(n.y) > 0.9) _ringUp.set(1, 0, 0);
            _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
            // Spin the ring + pulse scale
            _ringDummy.rotateOnAxis(n, t * 1.8 + i * 0.7);
            const pulse = 1 + Math.sin(t * 3.5 + i) * 0.12;
            _ringDummy.scale.setScalar(pulse);
            _ringDummy.updateMatrix();
            mesh.setMatrixAt(i, _ringDummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
    });

    const MAX_RINGS = 6 * size * size; // max flipped tiles possible
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
            <torusGeometry args={[0.42, 0.025, 8, 32]} />
            <meshBasicMaterial color="#ff44ff" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
        </instancedMesh>
    );
}

// ─── Main exported wrapper ────────────────────────────────────────────────────
export function HealerWormMode3DWrapper({ cubies, size, _explosionFactor, _animState, _onRotate, _onHeal }) {
    const worm = useWormCrawler(size, cubies);

    useEffect(() => {
        useGameStore.setState({ _wormTurn: worm.queueTurn });
        return () => {
            useGameStore.setState({ _wormTurn: null });
        };
    }, [worm.queueTurn]);

    useFrame((_, delta) => {
        worm.tick(delta);
    });

    return (
        <>
            <WormChaseCamera worm={worm} size={size} />
            <WormSwipeControls onTurn={worm.queueTurn} worm={worm} />
            <WormInteriorGlass worm={worm} size={size} />
            <TunnelSurfFX worm={worm} size={size} />
            <WormBody worm={worm} size={size} />
            <WormFace worm={worm} size={size} />
            <PortalGlow worm={worm} size={size} />
            <WormholeRings cubies={cubies} size={size} />
            <PowerupOrbs size={size} />
        </>
    );
}
