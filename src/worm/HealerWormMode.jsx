// src/worm/HealerWormMode.jsx
// WORM Chase-Cam Mode — complete rewrite.
// Chase camera follows the worm crawling on the cube exterior.
// Disparity Level 1 runs in background. Flipped tiles are instant wormholes; jump to clear them.

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getStickerWorldPos, getManifoldGridId } from '../game/coordinates.js';
import { getNextSurfacePosition, getActiveTunnels, getTunnelWorldPos, turnWorm, getStableKey, findStickerByStableKey } from './wormLogic.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { healSticker, getStickerSafe } from '../game/cubeState.js';
import { rotateVec90 } from '../game/cubeRotation.js';
import { DIR_TO_VEC, VEC_TO_DIR, ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import {
    CAM_HEIGHT_BASE,
    CAM_BACK_BASE,
    LOOK_AHEAD,
    CAM_LERP,
    WORM_LIFT,
    ZOOM_BURST,
    MAX_EXTRA_ZOOM,
    GLASS_MIN_OPACITY,
    GLASS_MAX_OPACITY,
    GLASS_MIN_TRANSMISSION,
    GLASS_MAX_TRANSMISSION,
    TUNNEL_SURF_FOV,
    TUNNEL_SURF_BACK,
    TUNNEL_SURF_UP,
    TUNNEL_SURF_SWAY,
    TUNNEL_SPEED_SCALE,
    FACE_NORMALS,
    DIR_FORWARD,
    INITIAL_DIR,
    INITIAL_POS,
    DEFAULT_POWERUP_COUNT,
    ORB_SEGMENT_GROWTH,
    STEPS_PER_TILE,
    BODY_BALL_SPACING,
    BASE_TAIL_LENGTH,
    DEFAULT_WORMHOLE_FLIP_INTERVAL,
    MAX_JUMPS,
    TUNNEL_TRIGGER_PROGRESS,
    SELF_COLLISION_TRIGGER_PROGRESS,
    SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL,
    WORMHOLE_MAX_TRAVERSALS,
    MAX_TAIL,
    HEAL_COST,
} from './healerWorm/constants.js';
import {
    isSurfaceTilePos,
    randomFreeTile,
    randomUnflippedTile,
} from './healerWorm/surfaceTiles.js';
import ParityOrbs from './ParityOrb.jsx';
import { isMobile as _isMobile } from '../utils/device.js';
import { healBurstMap } from '../3d/styles/TileStyleMaterials.jsx';

// ─── Tile position rotation helper ───────────────────────────────────────────
// Transforms a {x, y, z, dirKey} surface tile through a cube slice rotation.
// Mirrors the math in rotateSliceCubies + rotateStickers.
function rotateTilePosition(tile, axis, sliceIndex, dir, size) {
    const { x, y, z, dirKey } = tile;
    const inSlice = (axis === 'col' && x === sliceIndex) ||
        (axis === 'row' && y === sliceIndex) ||
        (axis === 'depth' && z === sliceIndex);
    if (!inSlice) return tile;

    const k = (size - 1) / 2;
    const cx = x - k, cy = y - k, cz = z - k;
    const [nx, ny, nz] = rotateVec90(cx, cy, cz, axis, dir);
    const newX = Math.round(nx + k), newY = Math.round(ny + k), newZ = Math.round(nz + k);

    const [vx, vy, vz] = DIR_TO_VEC[dirKey];
    const [rvx, rvy, rvz] = rotateVec90(vx, vy, vz, axis, dir);
    const newDirKey = VEC_TO_DIR(rvx, rvy, rvz);

    return { ...tile, x: newX, y: newY, z: newZ, dirKey: newDirKey };
}

// ─── Worm Crawler Hook ────────────────────────────────────────────────────────
function useWormCrawler(size, cubies) {
    const { wormSpeed, wormControlMode, wormRunId, wormOrbCount, wormholeInterval, wormPaused } = useGameStore(
        useShallow(s => ({
            wormSpeed: s.wormSpeed ?? 1.0,
            wormControlMode: s.wormControlMode ?? 'non-oriented',
            wormRunId: s.wormRunId ?? 0,
            wormOrbCount: s.wormOrbCount ?? DEFAULT_POWERUP_COUNT,
            wormholeInterval: s.wormholeInterval ?? DEFAULT_WORMHOLE_FLIP_INTERVAL,
            wormPaused: s.wormPaused ?? false,
        }))
    );
    const wormPausedRef = useRef(false);
    wormPausedRef.current = wormPaused;
    const timeAliveRef = useRef(0);
    const timeAliveSyncRef = useRef(0);
    const healedRef = useRef(0);
    // willHealRef: true when the active tunnel has enough deposited orbs to heal on exit.
    // Consumed by TunnelPortalRings to show the pop-and-seal animation instead of a fade.
    const willHealRef = useRef(false);
    // healFiredRef: set true for one frame when a heal fires; consumed by TunnelPortalRings.
    const healFiredRef = useRef(false);

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
    const selfCollisionGraceStepsRef = useRef(0);
    // Tracks the phase on the previous tick so enter()/exit() hooks fire exactly once
    // per transition rather than every frame.
    const prevPhaseRef = useRef('crawling');

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
    const tunnelUseCountsRef = useRef(new Map());
    const voidTunnelKeysRef = useRef(new Set());
    const pendingVoidKillRef = useRef(null);
    const currentTunnelStableKeyRef = useRef(null); // stable key of the tunnel being traversed
    const pendingHealBurstRef = useRef(null); // set when a heal fires; consumed by HeartBurstSystem
    // O(1) tunnel endpoint lookup — rebuilt whenever cubies change via the effect below.
    // Both the manifold map and tunnel list are built in one pass to avoid a second O(size³×6) scan.
    const tunnelLookupRef = useRef(new Map());
    React.useEffect(() => {
        // Build manifold map once and share it with getActiveTunnels to avoid a second rebuild
        const manifoldMap = buildManifoldGridMap(cubies, size);
        const tunnels = getActiveTunnels(cubies, size, manifoldMap);

        const encodeTile = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;
        const canonical = (tunnel) => {
            const a = encodeTile(tunnel.entry);
            const b = encodeTile(tunnel.exit);
            return a < b ? `${a}|${b}` : `${b}|${a}`;
        };

        const lookup = new Map();
        for (const tunnel of tunnels) {
            const tunnelKey = canonical(tunnel);
            lookup.set(encodeTile(tunnel.entry), { tunnel, tunnelKey, reversed: false });
            lookup.set(encodeTile(tunnel.exit), { tunnel, tunnelKey, reversed: true });
        }
        tunnelLookupRef.current = lookup;
    }, [cubies, size]);

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

    const tileKey = useCallback((p) => `${p.x},${p.y},${p.z},${p.dirKey}`, []);

    const resolveTunnelAtTile = useCallback((x, y, z, dirKey) => {
        const hit = tunnelLookupRef.current.get(tileKey({ x, y, z, dirKey }));
        if (!hit) return null;

        if (hit.reversed) {
            return {
                tunnel: { ...hit.tunnel, entry: hit.tunnel.exit, exit: hit.tunnel.entry },
                tunnelKey: hit.tunnelKey,
            };
        }

        return {
            tunnel: hit.tunnel,
            tunnelKey: hit.tunnelKey,
        };
    }, [tileKey]);

    const killWorm = useCallback((details = null) => {
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
    }, []);

    const beginTunnelTransition = useCallback((x, y, z, dirKey) => {
        const resolved = resolveTunnelAtTile(x, y, z, dirKey);
        if (!resolved) return;

        const { tunnel, tunnelKey } = resolved;

        if (voidTunnelKeysRef.current.has(tunnelKey)) {
            killWorm({
                reason: 'voided',
                tunnelKey,
                headTile: tileKey({ x, y, z, dirKey }),
            });
            return;
        }

        const traversals = tunnelUseCountsRef.current.get(tunnelKey) ?? 0;
        const nextTraversals = traversals + 1;
        tunnelUseCountsRef.current.set(tunnelKey, nextTraversals);
        if (nextTraversals > WORMHOLE_MAX_TRAVERSALS) {
            // 4th touch: this tunnel is now fully void and kills immediately on contact.
            voidTunnelKeysRef.current.add(tunnelKey);
            pendingVoidKillRef.current = null;
            killWorm({
                reason: 'voided',
                tunnelKey,
                headTile: tileKey({ x, y, z, dirKey }),
                traversals: nextTraversals,
            });
            return;
        }

        // ── DEPOSIT ORBS ──────────────────────────────────────────────────────
        const liveCubies = useGameStore.getState().cubies;
        const entrySticker = liveCubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
        const entryFaceId = entrySticker?.curr ?? 0;
        const stableKey = getStableKey(x, y, z, dirKey, liveCubies);
        currentTunnelStableKeyRef.current = stableKey;

        if (stableKey && entryFaceId) {
            const depositState = useGameStore.getState();
            const healingProgress = depositState.wormHealingProgress ?? {};
            const progress = healingProgress[stableKey] ?? { deposited: 0, faceId: entryFaceId };
            const segmentsOnWorm = tailLength.current - BASE_TAIL_LENGTH;
            const available = depositState.wormOrbInventory?.[entryFaceId] ?? 0;
            const n = Math.min(available, HEAL_COST - progress.deposited, segmentsOnWorm);

            if (n > 0) {
                tailLength.current = Math.max(BASE_TAIL_LENGTH, tailLength.current - n);
                orbPickupColorsRef.current = orbPickupColorsRef.current.slice(0, -(n / ORB_SEGMENT_GROWTH));
                const orbsLeft = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
                useGameStore.getState().setWormBodyTiles(orbsLeft);
                useGameStore.getState().setWormOrbInventory({
                    ...(depositState.wormOrbInventory ?? {}),
                    [entryFaceId]: (depositState.wormOrbInventory?.[entryFaceId] ?? 0) - n,
                });
                useGameStore.getState().setWormHealingProgress({
                    ...healingProgress,
                    [stableKey]: { deposited: progress.deposited + n, faceId: entryFaceId },
                });
            }
        }
        // ── END DEPOSIT ───────────────────────────────────────────────────────

        // Determine whether this tunnel traversal will heal on exit (for portal ring pop fx).
        const postDepositProgress = useGameStore.getState().wormHealingProgress?.[stableKey];
        willHealRef.current = (postDepositProgress?.deposited ?? 0) >= HEAL_COST;

        activeTunnel.current = tunnel;
        pendingTunnelTrigger.current = null;
        pendingSelfCollision.current = null;
        // Remove the exit portal tile from the trail so the head landing on it after
        // exiting the tunnel doesn't immediately trigger a false self-collision.
        const exitTileKey = tileKey(tunnel.exit);
        tileTrail.current = tileTrail.current.filter(k => k !== exitTileKey);
        tunnelProgress.current = 0;
        phase.current = 'entering';
        onFlippedTile.current = false;
        lastFlippedRef.current = false;
        const prevVisualMode = useGameStore.getState().visualMode;
        prevVisualModeRef.current = prevVisualMode;
        const nextTunnelCount = (useGameStore.getState().wormTunnelCount ?? 0) + 1;
        useGameStore.setState({ wormPhase: 'entering', wormOnFlippedTile: false, visualMode: 'glass', wormTunnelCount: nextTunnelCount });
    }, [killWorm, resolveTunnelAtTile, tileKey]);

    // Colors of each collected orb, in pickup order — used by WormBody to color segments
    const orbPickupColorsRef = useRef([]);

    const applyOrbPickupGrowth = (color, faceId) => {
        tailLength.current = Math.min(tailLength.current + ORB_SEGMENT_GROWTH, MAX_TAIL);
        orbPickupColorsRef.current = [...orbPickupColorsRef.current, color];
        const orbCountOnWorm = Math.max(0, Math.floor((tailLength.current - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));
        useGameStore.getState().setWormBodyTiles(orbCountOnWorm);
        if (faceId) {
            const prev = useGameStore.getState().wormOrbInventory ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            useGameStore.getState().setWormOrbInventory({ ...prev, [faceId]: (prev[faceId] ?? 0) + ORB_SEGMENT_GROWTH });
        }
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
        if (wormPausedRef.current) return;

        // Track time alive and sync to store every ~0.1s to avoid excessive re-renders
        timeAliveRef.current += delta;
        timeAliveSyncRef.current += delta;
        if (timeAliveSyncRef.current >= 0.1) {
            timeAliveSyncRef.current = 0;
            useGameStore.getState().setWormTimeAlive(Math.floor(timeAliveRef.current));
        }

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

        // ── Phase handlers ───────────────────────────────────────────────────────
        // Each phase owns its update logic plus optional enter()/exit() hooks that
        // fire exactly once per phase transition (detected via prevPhaseRef).
        // Defined inline so they always close over the current cubies, wormSpeed, etc.
        // update() returns true to signal an early exit (replaces bare `return`s).
        const PHASE_HANDLERS = {
            crawling: {
                // enter() fires once when transitioning back from 'exiting'.
                enter() {
                    selfCollisionGraceStepsRef.current = SELF_COLLISION_GRACE_STEPS_AFTER_TUNNEL;
                    useGameStore.setState({ wormPhase: 'crawling', wormOnFlippedTile: false, visualMode: prevVisualModeRef.current ?? 'classic' });
                    onFlippedTile.current = false;
                    lastFlippedRef.current = false;
                },
                update(delta, STEP_SEC) {
                    const headOnSurface = isSurfaceTilePos(pos.current, size);
                    if (!headOnSurface) {
                        pendingSelfCollision.current = null;
                        pendingTunnelTrigger.current = null;
                    }

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

                    if (pendingVoidKillRef.current?.armed) {
                        const { tunnelKey, exitTileKey } = pendingVoidKillRef.current;
                        const headTileKey = tileKey(pos.current);
                        const hasClearedExitTile = headTileKey !== exitTileKey;
                        const fullyOnNextTile = interpT.current >= 1;

                        if (headOnSurface && hasClearedExitTile && fullyOnNextTile) {
                            pendingVoidKillRef.current = null;
                            voidTunnelKeysRef.current.add(tunnelKey);
                            killWorm({ reason: 'voided', tunnelKey, exitTileKey, headTile: headTileKey });
                            return true;
                        }
                    }

                    if (headOnSurface && pendingTunnelTrigger.current) {
                        const { x, y, z, dirKey } = pendingTunnelTrigger.current;
                        if (interpT.current >= TUNNEL_TRIGGER_PROGRESS && !isJumping.current) {
                            beginTunnelTransition(x, y, z, dirKey);
                            return true;
                        }
                    }

                    if (headOnSurface && pendingSelfCollision.current) {
                        if (selfCollisionGraceStepsRef.current > 0) {
                            pendingSelfCollision.current = null;
                        } else if (isJumping.current) {
                            // Allow jumping over your own body tile before impact threshold.
                            pendingSelfCollision.current = null;
                        } else if (pendingTunnelTrigger.current) {
                            // Prioritize wormhole entry over self-collision on the same tile.
                            // This fixes the bug where entering a wormhole whose entrance is occupied by your tail
                            // (which is almost always true for the first few tiles of a jump) kills you.
                            pendingSelfCollision.current = null;
                        } else if (interpT.current >= SELF_COLLISION_TRIGGER_PROGRESS) {
                            killWorm({
                                reason: 'self-collision',
                                progress: Number(interpT.current.toFixed(2)),
                                headTile: tileKey(pos.current),
                                collisionTile: pendingSelfCollision.current?.key ?? null,
                            });
                            return true;
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

                        // Chain-fountain: each history entry records the jump height that was active at THAT spatial position.
                        // Since jumpT and interpT advance at identical rates (both scale by delta/STEP_SEC), the jumpT at
                        // any recorded position r is: jumpT_now - (interpT_now - r). Clamping to [0,1] naturally zeroes
                        // out positions before the jump started or after it ended. Body segments then inherit the arc as
                        // they travel through this stored lift — exactly like beads lifting off one-by-one in a chain fountain.
                        const jumpTAtR = isJumping.current
                            ? Math.max(0, Math.min(1, jumpT.current - (interpT.current - lastRecordedT.current)))
                            : 0;
                        const ptJump = jumpTAtR > 0 ? Math.sin(jumpTAtR * Math.PI) * JUMP_HEIGHT : 0;
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
                            const nextOnSurface = isSurfaceTilePos(nextPos, size);
                            const selfHit = nextOnSurface && selfCollisionGraceStepsRef.current <= 0 && bodyTrail.includes(nextKey);
                            if (selfHit) {
                                // Defer self-hit until we've penetrated the tile by 40%.
                                // This gives players a short reaction window to jump over their body.
                                pendingSelfCollision.current = { key: nextKey };
                            }

                            pos.current = nextPos;
                            if (nextOnSurface) {
                                tileTrail.current.unshift(nextKey);
                                if (tileTrail.current.length > MAX_TAIL) tileTrail.current.length = MAX_TAIL;
                            }
                            if (next.moveDir) moveDir.current = next.moveDir;

                            if (crossedFace) {
                                crossingCorner.current = true;
                            }

                            pendingTunnelTrigger.current = null;
                            if (!selfHit) {
                                pendingSelfCollision.current = null;
                            }
                            if (selfCollisionGraceStepsRef.current > 0) {
                                selfCollisionGraceStepsRef.current -= 1;
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
                            const pickedUp = powerupsRef.current[puIdx];
                            const liveCubies = useGameStore.getState().cubies;
                            const pickedSticker = liveCubies?.[pickedUp.x]?.[pickedUp.y]?.[pickedUp.z]?.stickers?.[pickedUp.dirKey];
                            // Orbs on flipped tiles hover above the surface — worm must jump to reach them
                            const tileIsFlipped = !!(pickedSticker && pickedSticker.curr !== pickedSticker.orig);
                            if (tileIsFlipped && !isJumping.current) {
                                // Worm crawled onto the tile but didn't jump — orb is out of reach
                            } else {
                                const pickedFaceId = pickedSticker ? pickedSticker.curr : 0;
                                const liveColors = resolveColors(useGameStore.getState().settings);
                                const pickedColor = (pickedFaceId && liveColors[pickedFaceId]) ?? '#22ff88';
                                applyOrbPickupGrowth(pickedColor, pickedFaceId);
                                const newPowerup = { ...randomFreeTile(size, [...powerupsRef.current, pos.current]), type: 'apple' };
                                const next = [...powerupsRef.current];
                                next[puIdx] = newPowerup;
                                powerupsRef.current = next;
                                useGameStore.getState().setWormPowerups(next);
                            }
                        }

                        // Flipped tile detection
                        const sticker = cubies?.[x]?.[y]?.[z]?.stickers?.[dirKey];
                        const isFlipped = !!(sticker && sticker.curr !== sticker.orig);
                        const resolved = isFlipped ? resolveTunnelAtTile(x, y, z, dirKey) : null;
                        const isVoidZone = !!(resolved && voidTunnelKeysRef.current.has(resolved.tunnelKey));
                        onFlippedTile.current = isFlipped && !isVoidZone;

                        // Flipped tiles are instant wormholes unless the player is currently jumping over them.

                        if (onFlippedTile.current !== lastFlippedRef.current) {
                            lastFlippedRef.current = onFlippedTile.current;
                            useGameStore.getState().setWormOnFlippedTile(onFlippedTile.current);
                        }

                        if (isFlipped) {
                            pendingTunnelTrigger.current = { x, y, z, dirKey };
                            // Swept-entry guard: if the step accumulator remainder indicates the worm has already
                            // spent ≥ TUNNEL_TRIGGER_PROGRESS of this tile's step time on the flipped tile
                            // (possible after a lag spike where delta > STEP_SEC), fire the tunnel transition
                            // immediately. Without this, the deferred trigger can be cleared by a second step
                            // firing in the following frame before interpT reaches the threshold.
                            if (!isJumping.current && stepAcc.current / STEP_SEC >= TUNNEL_TRIGGER_PROGRESS) {
                                pendingTunnelTrigger.current = null;
                                beginTunnelTransition(x, y, z, dirKey);
                                return true;
                            }
                        }
                    }
                    return false;
                },
            },

            entering: {
                // enter() is intentionally absent: beginTunnelTransition sets wormPhase/'glass'
                // immediately on the same tick the transition is triggered — no one-frame delay.
                update(delta) {
                    tunnelProgress.current += delta * (2.5 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels first third of the tunnel (entry face → cube interior)
                        const tunnelT = tunnelProgress.current * 0.33;
                        const wp = getTunnelWorldPos(activeTunnel.current, tunnelT, size);
                        headInterpPos.current.set(wp[0], wp[1], wp[2]);
                        const entryN = FACE_NORMALS[activeTunnel.current.entry.dirKey];
                        if (entryN) currentNormal.current.copy(entryN);
                    }
                    if (tunnelProgress.current >= 1) {
                        tunnelProgress.current = 0;
                        phase.current = 'tunnel';
                        // tunnel.enter() fires next tick → setWormPhase('tunnel')
                    }
                    return false;
                },
            },

            tunnel: {
                enter() {
                    useGameStore.getState().setWormPhase('tunnel');
                },
                update(delta) {
                    tunnelProgress.current += delta * (0.65 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels middle third of the tunnel (through cube core)
                        const tunnelT = 0.33 + tunnelProgress.current * 0.34;
                        const wp = getTunnelWorldPos(activeTunnel.current, tunnelT, size);
                        headInterpPos.current.set(wp[0], wp[1], wp[2]);
                        // Switch normal to exit face at the midpoint
                        const n = tunnelProgress.current > 0.5
                            ? FACE_NORMALS[activeTunnel.current.exit.dirKey]
                            : FACE_NORMALS[activeTunnel.current.entry.dirKey];
                        if (n) currentNormal.current.copy(n);
                    }
                    if (tunnelProgress.current >= 1) {
                        tunnelProgress.current = 0;
                        phase.current = 'exiting';
                        // exiting.enter() fires next tick → setWormPhase + pos snap to exit tile
                    }
                    return false;
                },
            },

            exiting: {
                enter() {
                    useGameStore.getState().setWormPhase('exiting');
                    // Snap the logical grid position to the exit tile so crawling
                    // resumes from the correct sticker when this phase completes.
                    if (activeTunnel.current) {
                        const ex = activeTunnel.current.exit;
                        pos.current = { x: ex.x, y: ex.y, z: ex.z, dirKey: ex.dirKey };
                        curWorldPos.current = getWorldPos(pos.current);
                    }
                },
                update(delta) {
                    tunnelProgress.current += delta * (2.0 * TUNNEL_SPEED_SCALE);
                    if (activeTunnel.current) {
                        // Head travels final third of the tunnel (cube interior → exit face)
                        const tunnelT = 0.67 + tunnelProgress.current * 0.33;
                        const wp = getTunnelWorldPos(activeTunnel.current, tunnelT, size);
                        headInterpPos.current.set(wp[0], wp[1], wp[2]);
                        const exitN = FACE_NORMALS[activeTunnel.current.exit.dirKey];
                        if (exitN) currentNormal.current.copy(exitN);
                    }
                    if (tunnelProgress.current >= 1) {
                        const voidKillState = pendingVoidKillRef.current;
                        const exitedTunnel = activeTunnel.current; // capture before null
                        const exitStableKey = currentTunnelStableKeyRef.current;
                        tunnelProgress.current = 0;
                        activeTunnel.current = null;
                        currentTunnelStableKeyRef.current = null;
                        if (voidKillState) {
                            pendingVoidKillRef.current = { ...voidKillState, armed: true };
                        }

                        phase.current = 'crawling';
                        // crawling.enter() fires next tick → grace steps + Zustand crawling reset

                        // Heal immediately at exit completion (not deferred) when enough orbs deposited.
                        const exitStore = useGameStore.getState();
                        const exitProgress = exitStableKey ? (exitStore.wormHealingProgress?.[exitStableKey]) : null;
                        if (exitProgress?.deposited >= HEAL_COST && exitedTunnel) {
                            const { entry, exit: exitTile } = exitedTunnel;
                            // Write healBurstMap for both tiles BEFORE healing (sticker orig fields intact)
                            const entrySticker = getStickerSafe(exitStore.cubies, entry.x, entry.y, entry.z, entry.dirKey);
                            const exitStickerData = getStickerSafe(exitStore.cubies, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
                            if (entrySticker) healBurstMap.set(getManifoldGridId(entrySticker, size), 1);
                            if (exitStickerData) healBurstMap.set(getManifoldGridId(exitStickerData, size), 1);
                            healFiredRef.current = true;
                            let healed = healSticker(exitStore.cubies, size, entry.x, entry.y, entry.z, entry.dirKey);
                            healed = healSticker(healed, size, exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey);
                            exitStore.setCubies(healed);
                            const newProgress = { ...(exitStore.wormHealingProgress ?? {}) };
                            delete newProgress[exitStableKey];
                            exitStore.setWormHealingProgress(newProgress);
                            healedRef.current += 1;
                            exitStore.setWormHealedCount(healedRef.current);
                            pendingHealBurstRef.current = { exitTile: exitedTunnel.exit, entryTile: exitedTunnel.entry };
                        }
                        // else: partial/no deposit — tunnel stays flipped, progress persists
                    }
                    return false;
                },
            },
        };

        // ── Dispatch: detect phase transitions, then run the active handler ──────
        const currentPhase = phase.current;
        if (prevPhaseRef.current !== currentPhase) {
            PHASE_HANDLERS[prevPhaseRef.current]?.exit?.();
            PHASE_HANDLERS[currentPhase]?.enter?.();
            prevPhaseRef.current = currentPhase;
        }
        if (PHASE_HANDLERS[currentPhase].update(delta, STEP_SEC)) return;

    }, [size, cubies, wormSpeed, wormControlMode, wormholeInterval, beginTunnelTransition, resolveTunnelAtTile, killWorm]); // eslint-disable-line react-hooks/exhaustive-deps



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
        selfCollisionGraceStepsRef.current = 0;
        tailLength.current = BASE_TAIL_LENGTH;
        orbPickupColorsRef.current = [];
        stepHistory.current = [];
        lastRecordedT.current = 0;
        healedRef.current = 0;
        tunnelUseCountsRef.current = new Map();
        voidTunnelKeysRef.current = new Set();
        pendingVoidKillRef.current = null;
        prevPhaseRef.current = 'crawling';

        powerupsRef.current = initial;
        alive.current = true;
        tileTrail.current = [tileKey(startPos)];
        timeAliveRef.current = 0;
        timeAliveSyncRef.current = 0;
        useGameStore.setState({
            wormPowerups: initial,
            wormBodyTiles: 0,
            wormOrbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            wormHealingProgress: {},
            wormHealedCount: 0,
            wormholeCountdown: wormholeInterval,
            wormAlive: true,
            showWormDeathMenu: false,
            wormDeathDetails: null,
            wormPhase: 'crawling',
            wormOnFlippedTile: false,
            wormPaused: false,
            wormTimeAlive: 0,
            wormTunnelCount: 0,
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

    // Track the last pending rotation so we can apply it to powerup positions when
    // the animation commits (rotationEpoch increments).
    const lastPendingMoveRef = useRef(null);
    useEffect(() => {
        const unsub = useGameStore.subscribe(
            s => s.animState,
            animState => { if (animState) lastPendingMoveRef.current = animState; }
        );
        return unsub;
    }, []);

    // When a cube rotation commits, transform every powerup so it follows its tile.
    useEffect(() => {
        const unsub = useGameStore.subscribe(
            s => s.rotationEpoch,
            () => {
                const rot = lastPendingMoveRef.current;
                if (!rot || !powerupsRef.current.length) return;
                const { axis, dir, sliceIndex } = rot;
                const rotated = powerupsRef.current.map(p => rotateTilePosition(p, axis, sliceIndex, dir, size));
                powerupsRef.current = rotated;
                useGameStore.getState().setWormPowerups(rotated);
            }
        );
        return unsub;
    }, [size]);

    return {
        pos, moveDir, phase, tunnelProgress, activeTunnel, onFlippedTile,
        interpT, prevWorldPos, curWorldPos, jumpT, isJumping, jumpLift,
        headInterpPos, currentNormal,
        tailLength, stepHistory, orbPickupColorsRef, tick, queueTurn,
        voidTunnelKeysRef, tunnelUseCountsRef,
        willHealRef, healFiredRef, pendingHealBurstRef
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

            // Snappier lerping during transitions to avoid lag/stalling feel
            const alpha = Math.min(1, CAM_LERP * delta * 2.5);
            camPosRef.current.lerp(_camSurfCam, alpha);
            lookAtRef.current.lerp(_camLookAheadVec, alpha);
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
                e.stopImmediatePropagation();
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
    // Ref so useFrame always reads the latest wormColor without closure staleness
    const wormColorRef = useRef(wormColor);
    wormColorRef.current = wormColor;

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

        const visibleCount = Math.min(MAX_TAIL, tLen);
        mesh.count = visibleCount;

        const orbColors = worm.orbPickupColorsRef.current;
        const baseColor = wormColorRef.current;

        for (let i = 0; i < visibleCount; i++) {
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

            // Color: base segments use wormColor; tail-growth segments use the orb's face color.
            // BASE_TAIL_LENGTH segments (initial body) = wormColor.
            // Each ORB_SEGMENT_GROWTH group beyond that = the orb color picked up at that point.
            const orbPickupIndex = Math.floor((i - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
            if (orbPickupIndex >= 0 && orbPickupIndex < orbColors.length) {
                _bodyColor.set(orbColors[orbPickupIndex]);
            } else {
                _bodyColor.set(baseColor);
            }
            mesh.setColorAt(i, _bodyColor);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TAIL]} frustumCulled={false}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#ffffff" emissive={wormColor} emissiveIntensity={0.35} />
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
// Each orb inherits the color of the sticker tile it sits on and follows
// that tile through cube rotations. Rendered using the shared ParityOrbs component.
function PowerupOrbs({ size }) {
    const { wormPowerups, cubies, settings } = useGameStore(useShallow(s => ({
        wormPowerups: s.wormPowerups,
        cubies: s.cubies,
        settings: s.settings,
    })));
    const faceColors = useMemo(() => resolveColors(settings), [settings]);

    const orbs = useMemo(() => {
        if (!wormPowerups || !cubies) return [];
        return wormPowerups.map(p => {
            const sticker = getStickerSafe(cubies, p.x, p.y, p.z, p.dirKey);
            const faceId = sticker?.curr ?? 0;
            const color = (faceId && faceColors[faceId]) ?? '#22ff88';
            const antipodalFaceId = ANTIPODAL_COLOR[faceId];
            const antipodalColor = (antipodalFaceId && faceColors[antipodalFaceId]) ?? color;
            // Orbs on flipped tiles hover above the surface — worm must jump to collect
            const elevated = !!(sticker && sticker.curr !== sticker.orig);
            return { ...p, color, antipodalColor, elevated };
        });
    }, [wormPowerups, cubies, faceColors]);

    return <ParityOrbs orbs={orbs} size={size} />;
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

// ─── Module-level helpers for canonical tunnel key (mirrors useWormCrawler logic) ─
// Used by WormholeRings to check void-tunnel membership without prop-drilling.
const _tileKeyStr = (p) => `${p.x},${p.y},${p.z},${p.dirKey}`;
const _canonicalTunnelKeyStr = (tunnel) => {
    const a = _tileKeyStr(tunnel.entry);
    const b = _tileKeyStr(tunnel.exit);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
};

// ─── Wormhole portal rings — spinning neon rings at every flipped tile ────────
// Gives players a clear visual cue for all wormhole locations on the cube surface.
const _ringDummy = new THREE.Object3D();
const _ringUp = new THREE.Vector3();
const _bubbleDummy = new THREE.Object3D();
const _sparkDummy = new THREE.Object3D();
const _cautionDummy = new THREE.Object3D();
const _voidFrameDummy = new THREE.Object3D();
const _voidArcAxisY = new THREE.Vector3(0, 1, 0);
const _voidArcRight = new THREE.Vector3();
const _voidArcForward = new THREE.Vector3();
const _tapeRight = new THREE.Vector3();
const _tapeForward = new THREE.Vector3();
const _liveBaseColor = new THREE.Color('#ff44ff');
const _liveColor = new THREE.Color();

// Void swamp palette — sickly, stagnant, antipodality-gone-wrong
const VOID_OUTER_COLOR = '#b8b1ff';   // inverted-feel rim over dark tiles
const VOID_INNER_COLOR = '#121a3b';   // cool inverted core
const VOID_BUBBLE_COLOR = '#39ff14';  // neon green ooze
const CRITICAL_ARC_COLOR = '#7dff2a';  // electrical warning before full void
const _criticalArcColor = new THREE.Color(CRITICAL_ARC_COLOR);
const _tapeYellow = new THREE.Color('#ffe000');
const _tapeBlack = new THREE.Color('#111111');
// Scratch objects for the per-tape instanced-mesh loop — avoids per-frame allocations
const _tapeEdgeDir = new THREE.Vector3();
const _tapeOutwardDir = new THREE.Vector3();
const _tapeUp = new THREE.Vector3();
const _tapeNormal = new THREE.Vector3();
const _tapeCrossRight = new THREE.Vector3();
const _tapeMat4 = new THREE.Matrix4();
// Static empty collections used as safe fallbacks (never mutated)
const _EMPTY_SET = new Set();
const _EMPTY_MAP = new Map();
const BUBBLES_PER_VOID = 5;          // rising gas bubbles per dead portal
const SPARKS_PER_CRITICAL = 7;
const POLES_PER_TILE = 4;
const TAPES_PER_TILE = 4;
const FRAME_SEGMENTS_PER_VOID = 4;

// ─── Heart Burst Effect — green hearts fly out of healed tiles ────────────────
// Emits a burst of 💚 hearts when the worm exits a healed tunnel.
// Each heart gets its own CSS @keyframes rule injected once so the browser handles
// the smooth per-heart arc entirely on the compositor thread.

const HEART_COUNT = 10;
const HEART_LIFETIME_MS = 1800;

function HeartBurst({ id, wp, onDone }) {
    // Generate stable per-heart motion data once (spread outward, biased upward)
    const hearts = useMemo(() => {
        return Array.from({ length: HEART_COUNT }, (_, i) => {
            // Spread hearts in a full circle with an upward bias
            const baseAngle = (i / HEART_COUNT) * Math.PI * 2;
            const jitter = (Math.random() - 0.5) * 0.7;
            const angle = baseAngle + jitter;
            const dist = 50 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            // Always travel upward on screen (negative y = up in CSS)
            const dy = -Math.abs(Math.sin(angle) * dist) - 25 - Math.random() * 30;
            const delay = i * 55 + Math.random() * 40;
            const scale = 0.85 + Math.random() * 0.5;
            const heartId = `wh-${id}-${i}`;
            const styleEl = document.createElement('style');
            styleEl.setAttribute('data-worm-heart', heartId);
            styleEl.textContent = `@keyframes ${heartId}{` +
                `0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0;}` +
                `18%{transform:translate(-50%,-50%) scale(${(scale * 1.6).toFixed(2)}) rotate(10deg);opacity:1;}` +
                `100%{transform:translate(calc(-50% + ${dx.toFixed(1)}px),calc(-50% + ${dy.toFixed(1)}px)) ` +
                `scale(${(scale * 0.25).toFixed(2)}) rotate(${Math.round((Math.random() - 0.5) * 40)}deg);opacity:0;}}`;
            document.head.appendChild(styleEl);
            return { heartId, delay };
        });
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const timer = setTimeout(() => {
            hearts.forEach(h => {
                const el = document.querySelector(`[data-worm-heart="${h.heartId}"]`);
                if (el) el.remove();
            });
            onDone();
        }, HEART_LIFETIME_MS + 300);
        return () => clearTimeout(timer);
    }, [hearts, onDone]);

    const fontSize = _isMobile ? '22px' : '18px';
    return (
        <Html position={wp} center>
            <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
                {hearts.map(h => (
                    <div
                        key={h.heartId}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            fontSize,
                            animation: `${h.heartId} ${HEART_LIFETIME_MS}ms ease-out ${h.delay}ms both`,
                            willChange: 'transform, opacity',
                            textShadow: '0 0 6px #22ff66, 0 0 12px #00cc44',
                            lineHeight: 1,
                            userSelect: 'none',
                            filter: 'drop-shadow(0 0 4px #00ff55)',
                        }}
                    >
                        💚
                    </div>
                ))}
            </div>
        </Html>
    );
}

// Watches for heal events from the worm hook and manages active HeartBurst instances.
function HeartBurstSystem({ worm, size }) {
    const [bursts, setBursts] = useState([]);

    useFrame(() => {
        if (!worm.pendingHealBurstRef.current) return;
        const { exitTile } = worm.pendingHealBurstRef.current;
        worm.pendingHealBurstRef.current = null;
        const wp = getStickerWorldPos(exitTile.x, exitTile.y, exitTile.z, exitTile.dirKey, size, 0);
        if (!wp) return;
        const id = Date.now();
        setBursts(prev => [...prev, { id, wp: [wp[0], wp[1], wp[2]] }]);
    });

    if (bursts.length === 0) return null;
    return (
        <>
            {bursts.map(burst => (
                <HeartBurst
                    key={burst.id}
                    id={burst.id}
                    wp={burst.wp}
                    onDone={() => setBursts(prev => prev.filter(b => b.id !== burst.id))}
                />
            ))}
        </>
    );
}

function TunnelHealProgress({ size }) {
    const healingProgress = useGameStore((s) => s.wormHealingProgress ?? {});
    const cubies = useGameStore((s) => s.debouncedCubies ?? s.cubies);
    const faceColors = useGameStore((s) => {
        const settings = s.settings ?? { colorScheme: 'standard' };
        return resolveColors(settings, settings?.biomeMode?.faceAssignment) || {};
    });

    const entries = useMemo(() => {
        return Object.entries(healingProgress)
            .filter(([, p]) => p.deposited > 0 && p.deposited < HEAL_COST)
            .map(([key, p]) => {
                const pos = findStickerByStableKey(cubies, size, key);
                if (!pos) return null;
                const wp = getStickerWorldPos(pos.x, pos.y, pos.z, pos.dirKey, size, 0);
                if (!wp) return null;
                return { key, wp, remaining: HEAL_COST - p.deposited, faceId: p.faceId };
            })
            .filter(Boolean);
    }, [healingProgress, cubies, size]);

    if (entries.length === 0) return null;

    return (
        <>
            {entries.map(({ key, wp, remaining, faceId }) => {
                const color = faceColors[faceId] ?? '#ffffff';
                return (
                    <Html key={key} position={[wp[0], wp[1], wp[2]]} center>
                        <div style={{
                            background: color,
                            color: '#ffffff',
                            width: _isMobile ? '32px' : '26px',
                            height: _isMobile ? '32px' : '26px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: _isMobile ? '15px' : '13px',
                            fontWeight: 900,
                            fontFamily: "'Arial Rounded MT Bold', 'Nunito', Arial, sans-serif",
                            border: '2.5px solid #ffffff',
                            boxShadow: `0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.5)`,
                            lineHeight: 1,
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}>
                            {remaining}
                        </div>
                    </Html>
                );
            })}
        </>
    );
}

function WormholeRings({ cubies, size, voidTunnelKeysRef, tunnelUseCountsRef }) {
    const liveRef = useRef();       // live wormhole rings (neon pink)
    const voidOuterRef = useRef();  // void outer ring (sickly green, slow reverse)
    const voidInnerRef = useRef();  // void inner ring (near-black, counter-rotating)
    const bubblesRef = useRef();    // void swamp gas rising from dead portals
    const sparkRef = useRef();      // warning electricity when tunnel is one trip from void
    const poleRef = useRef();       // caution poles
    const tapeRef = useRef();       // caution tape strips
    const voidFrameRef = useRef();  // bright square frame on fully voided tiles

    const cautionTexture = React.useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffe000';
        ctx.fillRect(0, 0, 512, 64);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 44px "Arial Black", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CAUTION', 256, 36);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 1);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);

    // Stable random seeds per (position × bubble) slot — no per-frame allocation
    const MAX_RINGS = 6 * size * size;
    const bubbleSeeds = React.useMemo(() => {
        const s = new Float32Array(MAX_RINGS * Math.max(BUBBLES_PER_VOID, SPARKS_PER_CRITICAL, Math.max(POLES_PER_TILE, TAPES_PER_TILE)) * 3);
        for (let i = 0; i < s.length / 3; i++) {
            s[i * 3]     = (Math.random() - 0.5) * 0.18; // lateral x jitter
            s[i * 3 + 1] = (Math.random() - 0.5) * 0.18; // lateral y jitter
            s[i * 3 + 2] = Math.random();                 // phase start offset
        }
        return s;
    }, [MAX_RINGS]);

    // Debounce cubies so the O(size³×6) scan only reruns every 200 ms instead
    // of on every individual sticker flip (~12×/sec at chaos L4).
    const [debouncedCubies, setDebouncedCubies] = useState(cubies);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCubies(cubies), 200);
        return () => clearTimeout(timer);
    }, [cubies]);

    // All flipped surface positions, augmented with canonical tunnel key so
    // WormholeRings can tell live vs void without re-running manifold logic per frame.
    const allPositions = React.useMemo(() => {
        const manifoldMap = buildManifoldGridMap(debouncedCubies, size);
        const tunnels = getActiveTunnels(debouncedCubies, size, manifoldMap);
        // Build tile-key → canonical-tunnel-key lookup (covers both entry and exit)
        const tunnelKeyMap = new Map();
        for (const t of tunnels) {
            const ck = _canonicalTunnelKeyStr(t);
            tunnelKeyMap.set(_tileKeyStr(t.entry), ck);
            tunnelKeyMap.set(_tileKeyStr(t.exit), ck);
        }

        const result = [];
        const dirs = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cubie = debouncedCubies?.[x]?.[y]?.[z];
                    if (!cubie) continue;
                    for (const dk of dirs) {
                        const st = cubie.stickers?.[dk];
                        if (!st || st.curr === st.orig) continue;
                        const isVisible = (
                            (dk === 'PX' && x === size - 1) || (dk === 'NX' && x === 0) ||
                            (dk === 'PY' && y === size - 1) || (dk === 'NY' && y === 0) ||
                            (dk === 'PZ' && z === size - 1) || (dk === 'NZ' && z === 0)
                        );
                        if (!isVisible) continue;
                        result.push({ x, y, z, dirKey: dk, tunnelKey: tunnelKeyMap.get(`${x},${y},${z},${dk}`) ?? null });
                    }
                }
            }
        }
        return result;
    }, [debouncedCubies, size]);

    useFrame(({ clock }) => {
        const liveMesh = liveRef.current;
        const voidOuter = voidOuterRef.current;
        const voidInner = voidInnerRef.current;
        const bubbles = bubblesRef.current;
        const sparks = sparkRef.current;
        const poles = poleRef.current;
        const tapes = tapeRef.current;
        const voidFrames = voidFrameRef.current;
        if (!liveMesh || !voidOuter || !voidInner || !bubbles || !sparks || !poles || !tapes || !voidFrames) return;

        const t = clock.elapsedTime;
        const voidKeys = voidTunnelKeysRef?.current ?? _EMPTY_SET;
        const useCounts = tunnelUseCountsRef?.current ?? _EMPTY_MAP;

        let liveIdx = 0;
        let voidIdx = 0;
        let bubbleIdx = 0;
        let sparkIdx = 0;
        let poleIdx = 0;
        let tapeIdx = 0;
        let frameIdx = 0;

        for (let i = 0; i < allPositions.length; i++) {
            const { x, y, z, dirKey, tunnelKey } = allPositions[i];
            const isVoid = !!(tunnelKey && voidKeys.has(tunnelKey));
            const traversals = tunnelKey ? (useCounts.get(tunnelKey) ?? 0) : 0;
            const isCritical = !isVoid && traversals >= WORMHOLE_MAX_TRAVERSALS;

            const wp = getStickerWorldPos(x, y, z, dirKey, size, 0);
            const n = FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ;

            _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
            _ringUp.set(0, 1, 0);
            if (Math.abs(n.y) > 0.9) _ringUp.set(1, 0, 0);
            _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);

            if (isVoid) {
                // ── Void swamp portal ───────────────────────────────────────
                // Outer ring: slow reverse rotation, sluggish dying pulse
                _ringDummy.rotateOnAxis(n, -t * 0.35 + voidIdx * 1.1);
                const outerPulse = 0.9 + Math.sin(t * 0.85 + voidIdx * 2.3) * 0.1;
                _ringDummy.scale.setScalar(outerPulse);
                _ringDummy.updateMatrix();
                voidOuter.setMatrixAt(voidIdx, _ringDummy.matrix);

                // Inner ring: slightly different counter-rotation phase, smaller
                _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08);
                _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
                _ringDummy.rotateOnAxis(n, t * 0.2 - voidIdx * 0.9); // counter-phase
                const innerPulse = 0.7 + Math.sin(t * 1.1 + voidIdx * 1.7) * 0.08;
                _ringDummy.scale.setScalar(innerPulse);
                _ringDummy.updateMatrix();
                voidInner.setMatrixAt(voidIdx, _ringDummy.matrix);

                // Void swamp bubbles — rising gas from the dead portal
                for (let b = 0; b < BUBBLES_PER_VOID && bubbleIdx < bubbles.count; b++) {
                    const si = (i * BUBBLES_PER_VOID + b) * 3;
                    const phase = (t * 0.55 + bubbleSeeds[si + 2]) % 1;
                    const lift = phase * 0.72;
                    const envelope = Math.sin(phase * Math.PI); // 0→1→0 over lifetime
                    _bubbleDummy.position.set(
                        wp[0] + n.x * lift + bubbleSeeds[si] * envelope,
                        wp[1] + n.y * lift + bubbleSeeds[si + 1] * envelope,
                        wp[2] + n.z * lift
                    );
                    _bubbleDummy.scale.setScalar(Math.max(0, envelope * 0.038));
                    _bubbleDummy.updateMatrix();
                    bubbles.setMatrixAt(bubbleIdx, _bubbleDummy.matrix);
                    bubbleIdx++;
                }

                voidIdx++;
            } else {
                // ── Live wormhole ring — gets severe warning at 3rd traversal ─
                const intensityTier = Math.min(Math.max(traversals, 0), WORMHOLE_MAX_TRAVERSALS);
                const speedMul = 1 + (intensityTier * 0.35) + (isCritical ? 0.55 : 0);
                const glowMul = 1 + (intensityTier * 0.35) + (isCritical ? 0.75 : 0);
                const wobble = Math.sin(t * (9.0 * speedMul) + i * 1.4) * (0.03 + 0.03 * intensityTier);
                _ringDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, 0.08 + wobble);
                _ringDummy.quaternion.setFromUnitVectors(_ringUp, n);
                _ringDummy.rotateOnAxis(n, t * (2.1 * speedMul) + i * 0.9);
                const pulse = glowMul + Math.sin(t * (4.8 * speedMul) + i * 1.7) * (0.16 * glowMul);
                _ringDummy.scale.setScalar(pulse);
                _ringDummy.updateMatrix();
                liveMesh.setMatrixAt(liveIdx, _ringDummy.matrix);
                _liveColor.copy(_liveBaseColor).lerp(_criticalArcColor, isCritical ? 0.45 : 0).multiplyScalar(glowMul);
                liveMesh.setColorAt(liveIdx, _liveColor);
                liveIdx++;

                if (isCritical) {
                    _voidArcRight.crossVectors(n, _voidArcAxisY);
                    if (_voidArcRight.lengthSq() < 1e-4) _voidArcRight.set(1, 0, 0);
                    _voidArcRight.normalize();
                    _voidArcForward.crossVectors(n, _voidArcRight).normalize();
                    for (let sp = 0; sp < SPARKS_PER_CRITICAL && sparkIdx < sparks.count; sp++) {
                        const si = (i * SPARKS_PER_CRITICAL + sp) * 3;
                        const phase = (t * (2.5 + sp * 0.15) + bubbleSeeds[si + 2]) % 1;
                        const radial = 0.08 + Math.sin(phase * Math.PI * 2 + sp) * 0.035;
                        const lift = 0.18 + phase * 0.95;
                        const thickness = 0.010 + Math.sin(phase * Math.PI) * 0.010;
                        const height = 0.10 + Math.sin(phase * Math.PI) * 0.28;

                        _sparkDummy.position.set(
                            wp[0] + n.x * lift + _voidArcRight.x * radial + _voidArcForward.x * bubbleSeeds[si] * 0.12,
                            wp[1] + n.y * lift + _voidArcRight.y * radial + _voidArcForward.y * bubbleSeeds[si + 1] * 0.12,
                            wp[2] + n.z * lift + _voidArcRight.z * radial + _voidArcForward.z * bubbleSeeds[si] * 0.12
                        );
                        _sparkDummy.quaternion.setFromUnitVectors(_voidArcAxisY, n);
                        _sparkDummy.rotateOnAxis(n, phase * Math.PI * 8 + sp * 0.9);
                        _sparkDummy.scale.set(thickness, height, thickness);
                        _sparkDummy.updateMatrix();
                        sparks.setMatrixAt(sparkIdx, _sparkDummy.matrix);
                        sparkIdx++;
                    }
                }
            }

            if (isVoid || isCritical) {
                _tapeRight.crossVectors(n, _voidArcAxisY);
                if (_tapeRight.lengthSq() < 1e-4) _tapeRight.set(1, 0, 0);
                _tapeRight.normalize();
                _tapeForward.crossVectors(n, _tapeRight).normalize();
                
                const half = 0.45;
                const corners = [
                    [half, half],
                    [half, -half],
                    [-half, -half],
                    [-half, half]
                ];
                
                for (let c = 0; c < 4 && poleIdx < poles.count; c++) {
                    const cx = corners[c][0];
                    const cy = corners[c][1];
                    _cautionDummy.position.set(
                        wp[0] + _tapeRight.x * cx + _tapeForward.x * cy + n.x * 0.2,
                        wp[1] + _tapeRight.y * cx + _tapeForward.y * cy + n.y * 0.2,
                        wp[2] + _tapeRight.z * cx + _tapeForward.z * cy + n.z * 0.2
                    );
                    _cautionDummy.quaternion.setFromUnitVectors(_voidArcAxisY, n);
                    _cautionDummy.scale.set(1, 1, 1);
                    _cautionDummy.updateMatrix();
                    poles.setMatrixAt(poleIdx++, _cautionDummy.matrix);
                }
                
                const poleHeight = 0.4;
                const tapeWidth = 0.07;
                // Place tapes near the top of the poles, slightly below the tip
                const tapeLift = 0.2 + (poleHeight / 2) - (tapeWidth / 2) - 0.02;
                
                const loopT = t * 0.8 + i * 2.3;

                for (let e = 0; e < 4 && tapeIdx < tapes.count; e++) {
                    const si = (i * TAPES_PER_TILE + e) * 3;
                    const c1 = corners[e];
                    const c2 = corners[(e + 1) % 4];
                    const mx = (c1[0] + c2[0]) / 2;
                    const my = (c1[1] + c2[1]) / 2;
                    
                    const edgeVecX = c2[0] - c1[0];
                    const edgeVecY = c2[1] - c1[1];
                    const eD_x = _tapeRight.x * edgeVecX + _tapeForward.x * edgeVecY;
                    const eD_y = _tapeRight.y * edgeVecX + _tapeForward.y * edgeVecY;
                    const eD_z = _tapeRight.z * edgeVecX + _tapeForward.z * edgeVecY;
                    _tapeEdgeDir.set(eD_x, eD_y, eD_z).normalize();

                    // Background: A Three.js PlaneGeometry is created on the XY plane and faces +Z.
                    // To hang like a fence around the perimeter:
                    // Width (X-axis) should run along the edge: edgeDir
                    // Height (Y-axis) should point UP relative to the cube surface: tapeUp
                    // Normal (Z-axis) should point OUTWARD from the tile center: tapeNormal

                    // The outward vector for this edge
                    const outwardVecX = mx;
                    const outwardVecY = my;
                    const out_x = _tapeRight.x * outwardVecX + _tapeForward.x * outwardVecY;
                    const out_y = _tapeRight.y * outwardVecX + _tapeForward.y * outwardVecY;
                    const out_z = _tapeRight.z * outwardVecX + _tapeForward.z * outwardVecY;
                    _tapeOutwardDir.set(out_x, out_y, out_z).normalize();

                    // The UP vector is the surface normal 'n'
                    // We want the tape to stand up like a fence, so its Y axis is 'n'
                    _tapeUp.copy(n);

                    // The OUTWARD normal of the tape is 'outwardDir'
                    // We add flutter to it so the tape blows in the wind
                    const flutter = Math.sin(loopT * 15 + e * 2.1) * 0.08;
                    _tapeNormal.copy(_tapeOutwardDir).addScaledVector(n, flutter).normalize();

                    // Re-derive the exact edge direction that is perpendicular to both UP and NORMAL
                    // to ensure an orthogonal basis
                    _tapeCrossRight.crossVectors(_tapeUp, _tapeNormal).normalize();

                    // If _tapeCrossRight points opposite to edgeDir, flip it to keep texture orientation consistent
                    if (_tapeCrossRight.dot(_tapeEdgeDir) < 0) {
                        _tapeCrossRight.negate();
                        _tapeNormal.negate(); // Flip normal too to keep right-handed coordinate system
                    }

                    // X = _tapeCrossRight (along edge), Y = _tapeUp (height), Z = _tapeNormal (outward)
                    _tapeMat4.makeBasis(_tapeCrossRight, _tapeUp, _tapeNormal);
                    
                    // Tape spans from pole to pole. Distance between them is 0.9
                    const tapeLength = 0.9;
                    
                    // Add slight downward sag in the middle of the tape
                    const sag = Math.sin(loopT * 2 + e + bubbleSeeds[si + 2] * Math.PI * 2) * 0.015 - 0.015;
                    _cautionDummy.position.set(
                        wp[0] + _tapeRight.x * mx + _tapeForward.x * my + n.x * (tapeLift + sag),
                        wp[1] + _tapeRight.y * mx + _tapeForward.y * my + n.y * (tapeLift + sag),
                        wp[2] + _tapeRight.z * mx + _tapeForward.z * my + n.z * (tapeLift + sag)
                    );
                    _cautionDummy.quaternion.setFromRotationMatrix(_tapeMat4);
                    // Scale X ensures it reaches exactly pole to pole
                    _cautionDummy.scale.set(tapeLength, tapeWidth, 1);
                    _cautionDummy.updateMatrix();
                    tapes.setMatrixAt(tapeIdx++, _cautionDummy.matrix);
                }
            }


            if (isVoid) {
                const framePulse = 1 + Math.sin(t * 6.5 + i * 0.9) * 0.22;
                const half = 0.50;
                const lift = 0.11;
                const thickness = 0.028 * framePulse;
                const longEdge = 0.96;

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeRight, half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeForward);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeRight, -half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeForward);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeForward, half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeRight);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);

                _voidFrameDummy.position.set(wp[0], wp[1], wp[2]).addScaledVector(n, lift).addScaledVector(_tapeForward, -half);
                _voidFrameDummy.quaternion.setFromUnitVectors(_voidArcAxisY, _tapeRight);
                _voidFrameDummy.scale.set(thickness, longEdge, thickness);
                _voidFrameDummy.updateMatrix();
                if (frameIdx < voidFrames.count) voidFrames.setMatrixAt(frameIdx++, _voidFrameDummy.matrix);
            }
        }

        // Zero out unused slots so nothing stale renders
        _ringDummy.position.set(0, 0, 0);
        _ringDummy.scale.setScalar(0);
        _ringDummy.updateMatrix();
        for (let i = liveIdx; i < liveMesh.count; i++) liveMesh.setMatrixAt(i, _ringDummy.matrix);
        for (let i = voidIdx; i < voidOuter.count; i++) {
            voidOuter.setMatrixAt(i, _ringDummy.matrix);
            voidInner.setMatrixAt(i, _ringDummy.matrix);
        }
        _bubbleDummy.scale.setScalar(0);
        _bubbleDummy.updateMatrix();
        for (let i = bubbleIdx; i < bubbles.count; i++) bubbles.setMatrixAt(i, _bubbleDummy.matrix);
        _sparkDummy.scale.setScalar(0);
        _sparkDummy.updateMatrix();
        for (let i = sparkIdx; i < sparks.count; i++) sparks.setMatrixAt(i, _sparkDummy.matrix);
        _cautionDummy.scale.setScalar(0);
        _cautionDummy.updateMatrix();
        for (let i = poleIdx; i < poles.count; i++) poles.setMatrixAt(i, _cautionDummy.matrix);
        for (let i = tapeIdx; i < tapes.count; i++) tapes.setMatrixAt(i, _cautionDummy.matrix);
        _voidFrameDummy.scale.setScalar(0);
        _voidFrameDummy.updateMatrix();
        for (let i = frameIdx; i < voidFrames.count; i++) voidFrames.setMatrixAt(i, _voidFrameDummy.matrix);

        liveMesh.instanceMatrix.needsUpdate = true;
        if (liveMesh.instanceColor) liveMesh.instanceColor.needsUpdate = true;
        voidOuter.instanceMatrix.needsUpdate = true;
        voidInner.instanceMatrix.needsUpdate = true;
        bubbles.instanceMatrix.needsUpdate = true;
        sparks.instanceMatrix.needsUpdate = true;
        poles.instanceMatrix.needsUpdate = true;
        tapes.instanceMatrix.needsUpdate = true;
        voidFrames.instanceMatrix.needsUpdate = true;
    });

    const MAX_BUBBLES = MAX_RINGS * BUBBLES_PER_VOID;
    const MAX_SPARKS = MAX_RINGS * SPARKS_PER_CRITICAL;
    const MAX_POLES = MAX_RINGS * POLES_PER_TILE;
    const MAX_TAPES = MAX_RINGS * TAPES_PER_TILE;
    const MAX_VOID_FRAME_SEGMENTS = MAX_RINGS * FRAME_SEGMENTS_PER_VOID;
    return (
        <>
            {/* Live wormhole rings — bright neon pink, fast spin */}
            <instancedMesh ref={liveRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.42, 0.025, 8, 32]} />
                <meshBasicMaterial color="#ff44ff" vertexColors transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Dead void outer ring — sickly swamp green, slow reverse rotation */}
            <instancedMesh ref={voidOuterRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.44, 0.030, 8, 32]} />
                <meshBasicMaterial color={VOID_OUTER_COLOR} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Dead void inner ring — near-black green, barely alive counter-rotation */}
            <instancedMesh ref={voidInnerRef} args={[undefined, undefined, MAX_RINGS]} frustumCulled={false}>
                <torusGeometry args={[0.28, 0.018, 6, 24]} />
                <meshBasicMaterial color={VOID_INNER_COLOR} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Void swamp gas bubbles — dark orbs seeping out of dead portals */}
            <instancedMesh ref={bubblesRef} args={[undefined, undefined, MAX_BUBBLES]} frustumCulled={false}>
                <sphereGeometry args={[1, 5, 5]} />
                <meshBasicMaterial color={VOID_BUBBLE_COLOR} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Critical escape arcs — electricity venting from near-void portals */}
            <instancedMesh ref={sparkRef} args={[undefined, undefined, MAX_SPARKS]} frustumCulled={false}>
                <cylinderGeometry args={[1, 1, 1, 5]} />
                <meshBasicMaterial color={CRITICAL_ARC_COLOR} transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Caution poles */}
            <instancedMesh ref={poleRef} args={[undefined, undefined, MAX_POLES]} frustumCulled={false}>
                <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
                <meshBasicMaterial color="#111111" transparent opacity={0.98} depthWrite={false} />
            </instancedMesh>

            {/* Caution tape strips */}
            <instancedMesh ref={tapeRef} args={[undefined, undefined, MAX_TAPES]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={cautionTexture} color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.98} depthWrite={false} />
            </instancedMesh>

            {/* Void tile frame booster — brighter than neighbor tile frames */}
            <instancedMesh ref={voidFrameRef} args={[undefined, undefined, MAX_VOID_FRAME_SEGMENTS]} frustumCulled={false}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#9aff00" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
            </instancedMesh>
        </>
    );
}

// ─── Tunnel Portal Rings — 3 gyroscope rings during antipodal traversal ──────
// Stacked torus rings rotating around X, Y, Z axes respectively; shown every
// time the worm travels through an antipodal tunnel.
const _portalRingPos = new THREE.Vector3();

function TunnelPortalRings({ worm, size }) {
    const ringXRef = useRef();
    const ringYRef = useRef();
    const ringZRef = useRef();
    // popT: -1 = idle, 0→1 = contracting-and-popping
    const popTRef = useRef(-1);
    // Saved world position for the pop (rings may have been repositioned)
    const popPosRef = useRef(new THREE.Vector3());

    useFrame(({ clock }, delta) => {
        const phase = worm.phase.current;
        const tunnel = worm.activeTunnel.current;
        const active = (phase === 'entering' || phase === 'tunnel' || phase === 'exiting') && tunnel;

        const rings = [ringXRef.current, ringYRef.current, ringZRef.current];

        // Consume healFiredRef → start pop
        if (worm.healFiredRef.current) {
            worm.healFiredRef.current = false;
            popTRef.current = 0;
            popPosRef.current.copy(_portalRingPos);
        }

        // Pop animation: rings spin fast, contract, then vanish
        if (popTRef.current >= 0) {
            popTRef.current = Math.min(1, popTRef.current + delta / 0.30);
            const pt = popTRef.current;
            const scale = Math.max(0, 1 - pt * pt); // quadratic collapse
            const t = clock.elapsedTime;
            const spinBoost = 6.0; // 6× faster spin during pop
            for (const r of rings) {
                if (!r) continue;
                r.visible = pt < 1;
                r.position.copy(popPosRef.current);
                r.scale.setScalar(scale);
            }
            if (ringXRef.current) {
                ringXRef.current.rotation.set(t * 2.2 * spinBoost, t * 0.3 * spinBoost, 0);
                ringXRef.current.material.opacity = 0.75 * (1 - pt);
            }
            if (ringYRef.current) {
                ringYRef.current.rotation.set(t * 0.4 * spinBoost, t * 1.8 * spinBoost, 0);
                ringYRef.current.material.opacity = 0.65 * (1 - pt);
            }
            if (ringZRef.current) {
                ringZRef.current.rotation.set(0, t * 0.5 * spinBoost, t * 2.5 * spinBoost);
                ringZRef.current.material.opacity = 0.55 * (1 - pt);
            }
            if (popTRef.current >= 1) {
                for (const r of rings) if (r) { r.visible = false; r.scale.setScalar(1); }
                popTRef.current = -1;
            }
            return;
        }

        if (!active) {
            for (const r of rings) if (r) r.visible = false;
            return;
        }

        // Map phase progress → tunnel t (same mapping as WormChaseCamera)
        const prog = worm.tunnelProgress.current;
        let tunnelT;
        if (phase === 'entering') tunnelT = prog * 0.35;
        else if (phase === 'exiting') tunnelT = 0.65 + prog * 0.35;
        else tunnelT = 0.35 + prog * 0.30;

        const wp = getTunnelWorldPos(tunnel, Math.min(tunnelT, 1), size);
        _portalRingPos.set(wp[0], wp[1], wp[2]);

        const t = clock.elapsedTime;
        // Healing exits: keep rings visible until the pop fires; normal exits fade out.
        let fadeIn;
        if (phase === 'entering') {
            fadeIn = Math.min(1, prog * 5);
        } else if (phase === 'exiting') {
            fadeIn = worm.willHealRef.current ? 1.0 : Math.max(0, 1 - prog * 3);
        } else {
            fadeIn = 1;
        }

        if (ringXRef.current) {
            ringXRef.current.position.copy(_portalRingPos);
            ringXRef.current.rotation.set(t * 2.2, t * 0.3, 0);
            ringXRef.current.material.opacity = 0.75 * fadeIn;
            ringXRef.current.visible = true;
        }
        if (ringYRef.current) {
            ringYRef.current.position.copy(_portalRingPos);
            ringYRef.current.rotation.set(t * 0.4, t * 1.8, 0);
            ringYRef.current.material.opacity = 0.65 * fadeIn;
            ringYRef.current.visible = true;
        }
        if (ringZRef.current) {
            ringZRef.current.position.copy(_portalRingPos);
            ringZRef.current.rotation.set(0, t * 0.5, t * 2.5);
            ringZRef.current.material.opacity = 0.55 * fadeIn;
            ringZRef.current.visible = true;
        }
    });

    return (
        <>
            {/* X-axis ring */}
            <mesh ref={ringXRef} visible={false}>
                <torusGeometry args={[0.40, 0.026, 8, 32]} />
                <meshBasicMaterial color="#cc44ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Y-axis ring */}
            <mesh ref={ringYRef} visible={false}>
                <torusGeometry args={[0.36, 0.022, 8, 32]} />
                <meshBasicMaterial color="#aa22ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {/* Z-axis ring */}
            <mesh ref={ringZRef} visible={false}>
                <torusGeometry args={[0.32, 0.020, 8, 32]} />
                <meshBasicMaterial color="#ff44ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </>
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
            <TunnelPortalRings worm={worm} size={size} />
            <WormBody worm={worm} />
            <WormFace worm={worm} size={size} />
            <PortalGlow worm={worm} size={size} />
            <WormholeRings cubies={cubies} size={size} voidTunnelKeysRef={worm.voidTunnelKeysRef} tunnelUseCountsRef={worm.tunnelUseCountsRef} />
            <TunnelHealProgress size={size} />
            <HeartBurstSystem worm={worm} size={size} />
            <PowerupOrbs size={size} />
        </>
    );
}
